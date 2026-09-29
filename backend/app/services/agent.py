import json
import logging
import re
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from app.db.session import SessionLocal
from app.db.models import Load, Carrier, Driver, Alert, Customer
from app.schemas.logistics import AgentActionTrace, AgentChatResponse
from app.ml.predictor import predict_for_load
from app.services.rag import query_knowledge_base
from app.services.text_to_sql import execute_text_to_sql
from app.services.conversation import classify_intent, chitchat_reply, OPERATIONAL
from app.services.entity_resolution import (
    resolve_carrier,
    resolve_carrier_mc,
    resolve_driver,
    resolve_driver_license,
    resolve_load,
    format_clarification,
    format_not_found,
)

logger = logging.getLogger(__name__)


def _extract_entity_id(query: str, keywords: List[str]) -> Optional[int]:
    """Extract an integer ID following carrier/driver/load keywords: 'carrier 12', 'MC-100005'."""
    q = query.lower()
    for kw in keywords:
        m = re.search(rf"{kw}\s*(?:id|#|no\.?|number)?\s*[:\-]?\s*(\d+)", q)
        if m:
            try:
                return int(m.group(1))
            except ValueError:
                continue
    return None


class OperationsAgent:
    """
    Autonomous ReAct AI Agent with controlled domain tools and safe execution policies.
    """

    def __init__(self, db: Optional[Session] = None):
        self.db = db if db else SessionLocal()
        self.should_close = db is None

    def __del__(self):
        if hasattr(self, "should_close") and self.should_close:
            self.db.close()

    # --- Tool Definitions ---

    def tool_get_load(self, load_id: int) -> Dict[str, Any]:
        """Tool 1: Retrieve complete status, route, and driver details for a load."""
        load = self.db.query(Load).filter(Load.id == load_id).first()
        if not load:
            return {"error": f"Load ID {load_id} not found."}
        carrier = self.db.query(Carrier).filter(Carrier.id == load.carrier_id).first() if load.carrier_id else None
        driver = self.db.query(Driver).filter(Driver.id == load.driver_id).first() if load.driver_id else None
        return {
            "load_id": load.id,
            "load_number": load.load_number,
            "status": load.status,
            "lane": f"{load.origin_city}, {load.origin_state} -> {load.destination_city}, {load.destination_state}",
            "distance_miles": load.distance_miles,
            "revenue": load.revenue,
            "carrier_name": carrier.name if carrier else "Unassigned",
            "driver_name": driver.name if driver else "Unassigned",
            "scheduled_pickup": load.pickup_datetime.isoformat(),
            "scheduled_delivery": load.delivery_datetime.isoformat()
        }

    def tool_search_loads(self, status: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Tool 2: Search loads by operational status (delayed, in_transit, delivered, pending)."""
        q = self.db.query(Load)
        if status:
            q = q.filter(Load.status == status)
        loads = q.order_by(Load.pickup_datetime.desc()).limit(limit).all()
        return [
            {
                "id": l.id,
                "load_number": l.load_number,
                "origin": f"{l.origin_city}, {l.origin_state}",
                "destination": f"{l.destination_city}, {l.destination_state}",
                "status": l.status,
                "revenue": l.revenue,
                "pickup_time": l.pickup_datetime.strftime("%Y-%m-%d %H:%M")
            }
            for l in loads
        ]

    def tool_get_carrier_performance(self, carrier_id: int) -> Dict[str, Any]:
        """Tool 3: Get carrier historical on-time delivery rate, rating, and volume."""
        carrier = self.db.query(Carrier).filter(Carrier.id == carrier_id).first()
        if not carrier:
            return {"error": f"Carrier ID {carrier_id} not found."}
        total_loads = self.db.query(Load).filter(Load.carrier_id == carrier_id).count()
        delayed_loads = self.db.query(Load).filter(Load.carrier_id == carrier_id, Load.status == "delayed").count()
        delivered_loads = self.db.query(Load).filter(Load.carrier_id == carrier_id, Load.status == "delivered").count()

        # Consistent OTD definition across backend: delivered / (delivered + delayed).
        denominator = delivered_loads + delayed_loads
        on_time_rate = round(((delivered_loads / denominator) * 100), 1) if denominator > 0 else 100.0
        return {
            "carrier_id": carrier.id,
            "name": carrier.name,
            "mc_number": carrier.mc_number,
            "rating": carrier.rating,
            "status": carrier.status,
            "fleet_size": carrier.fleet_size,
            "total_loads": total_loads,
            "delayed_loads": delayed_loads,
            "on_time_rate_pct": on_time_rate
        }

    def tool_get_driver_performance(self, driver_id: int) -> Dict[str, Any]:
        """Tool 4: Retrieve driver experience, safety rating, and carrier affiliation."""
        driver = self.db.query(Driver).filter(Driver.id == driver_id).first()
        if not driver:
            return {"error": f"Driver ID {driver_id} not found."}
        carrier = self.db.query(Carrier).filter(Carrier.id == driver.carrier_id).first()
        return {
            "driver_id": driver.id,
            "name": driver.name,
            "license_number": driver.license_number,
            "experience_years": driver.experience_years,
            "safety_score": driver.safety_score,
            "status": driver.status,
            "carrier_name": carrier.name if carrier else "Independent"
        }

    def tool_predict_load_delay(self, load_id: int) -> Dict[str, Any]:
        """Tool 5: Run ML delay-risk model and SHAP factor attribution."""
        try:
            pred = predict_for_load(load_id, db=self.db)
            return {
                "load_number": pred.load_number,
                "late_probability_pct": round(pred.late_probability * 100, 1),
                "risk_level": pred.risk_level,
                "top_factors": [
                    {"factor": f.factor_name, "impact": f.impact_description}
                    for f in pred.top_contributing_factors
                ]
            }
        except Exception as e:
            return {"error": str(e)}

    async def tool_search_knowledge_base(self, question: str) -> Dict[str, Any]:
        """Tool 6: Search internal SOP documents for operational protocols and guidelines."""
        rag_res = await query_knowledge_base(question, db=self.db, top_k=2)
        return {
            "sop_answer": rag_res.answer,
            "citations": [c.document_name for c in rag_res.citations]
        }

    def tool_generate_report(self, report_type: str = "daily_summary") -> Dict[str, Any]:
        """Tool 7: Generate structured operational digest covering KPIs, delays, and critical alerts."""
        total_loads = self.db.query(Load).count()
        delayed_count = self.db.query(Load).filter(Load.status == "delayed").count()
        in_transit = self.db.query(Load).filter(Load.status == "in_transit").count()
        delivered = self.db.query(Load).filter(Load.status == "delivered").count()
        active_alerts = self.db.query(Alert).filter(Alert.status == "active").count()

        on_time = round((delivered / (delivered + delayed_count)) * 100, 1) if (delivered + delayed_count) > 0 else 100.0

        return {
            "report_title": "AI Operations Briefing",
            "total_monitored_loads": total_loads,
            "active_in_transit": in_transit,
            "currently_delayed": delayed_count,
            "delivered_on_time_pct": on_time,
            "active_unresolved_alerts": active_alerts,
            "action_required": "Review delayed interstate corridors and reassign high-risk loads."
        }

    # --- Autonomous ReAct Loop ---

    def _finish(
        self,
        query: str,
        traces: List[AgentActionTrace],
        tools_used: List[str],
        final_answer: str,
    ) -> AgentChatResponse:
        seen: List[str] = []
        for t in tools_used:
            if t not in seen:
                seen.append(t)
        return AgentChatResponse(
            query=query,
            final_answer=final_answer,
            action_traces=traces,
            tools_used=seen,
        )

    def _driver_profile(
        self,
        driver_id: int,
        traces: List[AgentActionTrace],
        tools_used: List[str],
        step: int,
        note: str = "",
    ) -> str:
        info = self.tool_get_driver_performance(driver_id)
        if "error" in info:
            traces.append(AgentActionTrace(
                step=step,
                thought="Retrieving driver safety rating — lookup failed.",
                action="get_driver_performance",
                action_input={"driver_id": driver_id},
                observation=info["error"]
            ))
            tools_used.append("get_driver_performance")
            return f"### Driver Profile & Safety Record\n\nDriver ID {driver_id} not found. {info['error']}"
        traces.append(AgentActionTrace(
            step=step,
            thought="Retrieving driver safety rating and compliance history.",
            action="get_driver_performance",
            action_input={"driver_id": driver_id},
            observation=f"Driver {info['name']} located with safety score {info['safety_score']}."
        ))
        tools_used.append("get_driver_performance")
        return (
            f"### Driver Profile & Safety Record\n{note}\n"
            f"- **Driver:** {info['name']} ({info['license_number']})\n"
            f"- **Affiliated Carrier:** {info['carrier_name']}\n"
            f"- **Safety Score:** **{info['safety_score']}/100**\n"
            f"- **Commercial Experience:** {info['experience_years']} years\n"
            f"- **Duty Status:** `{info['status'].upper()}`"
        )

    def _carrier_profile(
        self,
        carrier_id: int,
        traces: List[AgentActionTrace],
        tools_used: List[str],
        step: int,
        note: str = "",
    ) -> str:
        perf = self.tool_get_carrier_performance(carrier_id)
        if "error" in perf:
            traces.append(AgentActionTrace(
                step=step,
                thought="User inquired about carrier metrics. Attempted lookup failed.",
                action="get_carrier_performance",
                action_input={"carrier_id": carrier_id},
                observation=perf["error"]
            ))
            tools_used.append("get_carrier_performance")
            return f"### Carrier Performance Inspection\n\nCarrier ID {carrier_id} not found. {perf['error']}"
        traces.append(AgentActionTrace(
            step=step,
            thought="User inquired about carrier metrics. Fetching performance record for requested carrier.",
            action="get_carrier_performance",
            action_input={"carrier_id": carrier_id},
            observation=f"Retrieved {perf['name']}: OTD {perf['on_time_rate_pct']}% across {perf['total_loads']} loads."
        ))
        tools_used.append("get_carrier_performance")
        otd = perf["on_time_rate_pct"]
        if otd >= 85:
            rec = "Performance satisfies standard carrier compliance (>85%). No probation action needed."
        elif otd >= 70:
            rec = "Below the 85% compliance bar — place on watchlist and review weekly."
        else:
            rec = "Breach-level performance — recommend probation review per SOP-05."
        return (
            f"### Carrier Performance Inspection: {perf['name']}\n{note}"
            f"- **MC Number:** {perf['mc_number']}\n"
            f"- **Safety Status:** `{perf['status'].upper()}`\n"
            f"- **Fleet Size:** {perf['fleet_size']} power units\n"
            f"- **On-Time Delivery Rate:** **{perf['on_time_rate_pct']}%** across {perf['total_loads']} completed dispatches.\n"
            f"- **Total Dispatches Delayed:** {perf['delayed_loads']} loads.\n"
            f"- **Operational Recommendation:** {rec}"
        )

    async def execute_task(self, query: str) -> AgentChatResponse:
        """
        Execute multi-step task by determining tools, executing actions,
        and capturing complete thought-action-observation traces.
        """
        traces: List[AgentActionTrace] = []
        tools_used: List[str] = []
        q_lower = query.lower()

        # Step 1: Analyze query intent & plan steps
        step_counter = 1

        # Step 0: conversational intents bypass tools entirely.
        # "hi" must greet, never trigger an operations report.
        intent = classify_intent(query)
        if intent != OPERATIONAL:
            traces.append(AgentActionTrace(
                step=step_counter,
                thought=f"Message is conversational ({intent}) — answering directly without tools.",
                action="classify_intent",
                action_input={"intent": intent},
                observation="No operational lookup needed."
            ))
            return self._finish(query, traces, tools_used, chitchat_reply(intent))

        # Step 1a: load lookup. The user's OWN reference (L14520 / load 4520)
        # always wins. A carried-over session reference only fires for
        # non-aggregate messages ("is it delayed?", "status?") — "delayed
        # loads" means the list, never one load.
        stripped = re.sub(r"\(context:[^)]*\)", "", query)
        own_res = resolve_load(self.db, stripped)
        fire_res = None
        if own_res["status"] == "single":
            fire_res = own_res
        elif not own_res.get("candidate"):
            ctx_res = resolve_load(self.db, query)
            if ctx_res["status"] == "single" and not re.search(
                r"\bloads\b", stripped, re.IGNORECASE
            ):
                fire_res = ctx_res
        if fire_res is not None:
            lid = fire_res["matches"][0]["id"]
            info = self.tool_get_load(lid)
            if "error" in info:
                traces.append(AgentActionTrace(
                    step=step_counter,
                    thought="User referenced a specific load. Lookup failed.",
                    action="get_load",
                    action_input={"load_id": lid},
                    observation=info["error"]
                ))
                return self._finish(
                    query, traces, tools_used,
                    f"### Load Lookup\n\n{info['error']}"
                )
            traces.append(AgentActionTrace(
                step=step_counter,
                thought=f"User referenced {info['load_number']} explicitly. Fetching live detail.",
                action="get_load",
                action_input={"load_id": lid},
                observation=f"Located {info['load_number']}: {info['lane']} ({info['status']})."
            ))
            tools_used.append("get_load")
            step_counter += 1
            ml = self.tool_predict_load_delay(lid)
            if "error" in ml:
                risk_line = f"- **Delay risk:** unavailable ({ml['error']})"
            else:
                traces.append(AgentActionTrace(
                    step=step_counter,
                    thought="Scoring explicit load with the delay-risk model.",
                    action="predict_load_delay",
                    action_input={"load_id": lid},
                    observation=f"{ml.get('late_probability_pct')}% ({ml.get('risk_level')} risk)."
                ))
                tools_used.append("predict_load_delay")
                factors = "\n".join(
                    f"  - **{f['factor']}:** {f['impact']}" for f in ml.get("top_factors", [])
                )
                risk_line = (
                    f"- **Delay risk:** {ml.get('late_probability_pct')}% "
                    f"({ml.get('risk_level')} risk)\n{factors}"
                )
            return self._finish(
                query, traces, tools_used,
                f"### Load {info['load_number']} — Status & Risk\n\n"
                f"- **Route:** {info['lane']} ({info['distance_miles']} mi)\n"
                f"- **Status:** `{info['status'].upper()}`\n"
                f"- **Carrier:** {info['carrier_name']} · **Driver:** {info['driver_name']}\n"
                f"{risk_line}"
            )
        elif own_res.get("candidate"):
            traces.append(AgentActionTrace(
                step=step_counter,
                thought="User referenced a load number that does not exist.",
                action="get_load",
                action_input={"load_number": own_res["candidate"]},
                observation="No matching load."
            ))
            return self._finish(
                query, traces, tools_used,
                f"### Load Lookup\n\nI couldn't find load "
                f"*{own_res['candidate']}* in the system. Check the load number "
                f"(e.g. L14520) and try again."
            )

        # Check for multi-step scenario: "Find high-risk/delayed loads and prepare summary/report"
        # Carrier/driver mentions route to their inspection workflows first.
        if ("risk" in q_lower or "late" in q_lower or "delayed" in q_lower or "problem" in q_lower) \
                and "carrier" not in q_lower and "driver" not in q_lower:
            delayed_loads = self.tool_search_loads(status="delayed", limit=5)
            traces.append(AgentActionTrace(
                step=step_counter,
                thought="Dispatcher requested analysis of problematic/at-risk loads. I will first query all active loads flagged as delayed.",
                action="search_loads",
                action_input={"status": "delayed", "limit": 5},
                observation=f"Retrieved {len(delayed_loads)} delayed loads requiring operational attention."
            ))
            tools_used.append("search_loads")
            step_counter += 1

            # Action 2: Inspect first delayed load with ML risk model (guard empty set)
            ml_res: Optional[Dict[str, Any]] = None
            if delayed_loads:
                sample_id = delayed_loads[0]["id"]
                sample_number = delayed_loads[0]["load_number"]
                ml_res = self.tool_predict_load_delay(sample_id)
                if "error" in ml_res:
                    obs = f"ML prediction failed for Load ID {sample_id}: {ml_res['error']}"
                else:
                    obs = (
                        f"ML prediction for {sample_number}: "
                        f"{ml_res.get('late_probability_pct')}% ({ml_res.get('risk_level')} risk)."
                    )
                traces.append(AgentActionTrace(
                    step=step_counter,
                    thought=f"Running delay-risk predictor on Load ID {sample_id} ({sample_number}) to assess probability and SHAP root causes.",
                    action="predict_load_delay",
                    action_input={"load_id": sample_id},
                    observation=obs
                ))
                tools_used.append("predict_load_delay")
                step_counter += 1

            # Action 3: Search SOP for breakdown/delay protocol if requested
            if "sop" in q_lower or "procedure" in q_lower or "protocol" in q_lower or "breakdown" in q_lower:
                sop_res = await self.tool_search_knowledge_base("delay breakdown protocol")
                traces.append(AgentActionTrace(
                    step=step_counter,
                    thought="The user mentioned operational procedures or breakdowns. Querying SOP knowledge base for the appropriate handling guidelines.",
                    action="search_knowledge_base",
                    action_input={"question": "What is the procedure when a driver experiences a delay or breakdown?"},
                    observation=f"Retrieved SOP citations: {', '.join(sop_res.get('citations', [])) or 'none'}."
                ))
                tools_used.append("search_knowledge_base")
                step_counter += 1

            # Action 4: Compile report
            traces.append(AgentActionTrace(
                step=step_counter,
                thought="Synthesizing multi-tool findings into a comprehensive operational action briefing for the operations team.",
                action="generate_report",
                action_input={"report_type": "high_risk_load_summary"},
                observation="Briefing compiled with specific carrier follow-up recommendations."
            ))
            tools_used.append("generate_report")

            if not delayed_loads:
                final_answer = (
                    "### Operational Risk & Delay Analysis\n\n"
                    "- No loads are currently flagged as delayed.\n"
                    "- Pipeline is clear; continue monitoring in-transit loads and SOP-01 readiness."
                )
            elif ml_res is None or "error" in ml_res:
                top = delayed_loads[0]
                err = ml_res.get("error") if isinstance(ml_res, dict) else "unavailable"
                final_answer = (
                    "### Operational Risk & Delay Analysis\n\n"
                    f"- **Active Problematic Loads Identified:** {len(delayed_loads)} loads currently delayed.\n"
                    f"- **Top At-Risk Shipment:** `{top['load_number']}` ({top['origin']} -> {top['destination']}).\n"
                    f"- **ML Delay Probability:** unavailable ({err}).\n\n"
                    "**Recommended Action:** Adhere to SOP-01 & SOP-02. Contact carrier dispatch immediately."
                )
            else:
                top = delayed_loads[0]
                final_answer = (
                    f"### Operational Risk & Delay Analysis\n\n"
                    f"- **Active Problematic Loads Identified:** {len(delayed_loads)} loads currently delayed.\n"
                    f"- **Top At-Risk Shipment:** `{top['load_number']}` ({top['origin']} -> {top['destination']}).\n"
                    f"- **ML Delay Probability:** {ml_res.get('late_probability_pct', 88)}% ({ml_res.get('risk_level', 'HIGH')} Risk).\n"
                    f"- **Key Root Causes (SHAP Attribution):**\n"
                )
                for f in ml_res.get("top_factors", []):
                    final_answer += f"  - **{f['factor']}:** {f['impact']}\n"
                final_answer += (
                    f"\n**Recommended Action:** Adhere to SOP-01 & SOP-02. Contact carrier dispatch immediately to verify driver HOS and issue receiver delay notification."
                )

        elif "carrier" in q_lower:
            # Carrier inspection workflow — MC numbers first (never confuse
            # them with database IDs), then explicit IDs, then names.
            # Never silently answer about an arbitrary carrier.
            fallback_note = ""
            mc_id = resolve_carrier_mc(self.db, query)
            requested_id = _extract_entity_id(query, ["carrier", "mc"])
            if mc_id is not None:
                carrier_id = mc_id
            elif requested_id is not None:
                carrier_id = requested_id
            else:
                res = resolve_carrier(self.db, query)
                if res["status"] == "single":
                    carrier_id = res["matches"][0]["id"]
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought=f"Resolved carrier name \"{res['matches'][0]['label']}\" to ID {carrier_id}.",
                        action="resolve_entity",
                        action_input={"entity": "carrier", "name": res["candidate"]},
                        observation=f"Unique match: {res['matches'][0]['label']}."
                    ))
                    step_counter += 1
                elif res["status"] == "multiple":
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought="Carrier name is ambiguous — asking user to disambiguate instead of guessing.",
                        action="resolve_entity",
                        action_input={"entity": "carrier", "name": res["candidate"]},
                        observation=f"{len(res['matches'])} candidates."
                    ))
                    return self._finish(
                        query, traces, tools_used,
                        "### Which carrier?\n\n" + format_clarification("carrier", res)
                    )
                elif res["status"] == "generic":
                    top_carrier = (
                        self.db.query(Carrier.id)
                        .join(Load, Carrier.id == Load.carrier_id)
                        .group_by(Carrier.id)
                        .order_by(func.count(Load.id).desc())
                        .first()
                    )
                    carrier_id = top_carrier[0] if top_carrier else 1
                    fallback_note = (
                        "\n*You didn't name a carrier, so I'm showing our "
                        "highest-volume carrier. Ask about one by name for specifics.*\n"
                    )
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought="No carrier named — showing the highest-volume carrier, stated explicitly.",
                        action="resolve_entity",
                        action_input={"entity": "carrier", "name": None},
                        observation="Falling back to highest-volume carrier with disclosure."
                    ))
                    step_counter += 1
                else:
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought="Carrier name matched nothing.",
                        action="resolve_entity",
                        action_input={"entity": "carrier", "name": res["candidate"]},
                        observation="No match."
                    ))
                    return self._finish(
                        query, traces, tools_used,
                        "### Carrier not found\n\n" + format_not_found("carrier", res)
                    )
            final_answer = self._carrier_profile(
                carrier_id, traces, tools_used, 1, fallback_note
            )

        elif "driver" in q_lower:
            # Driver inspection — license numbers first (never confuse them
            # with database IDs), then explicit IDs, then names.
            # Never silently answer about an arbitrary driver.
            fallback_note = ""
            lic_id = resolve_driver_license(self.db, query)
            requested_id = _extract_entity_id(query, ["driver", "cdl"])
            if lic_id is not None:
                driver_id = lic_id
            elif requested_id is not None:
                driver_id = requested_id
            else:
                res = resolve_driver(self.db, query)
                if res["status"] == "single":
                    driver_id = res["matches"][0]["id"]
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought=f"Resolved driver name \"{res['matches'][0]['label']}\" to ID {driver_id}.",
                        action="resolve_entity",
                        action_input={"entity": "driver", "name": res["candidate"]},
                        observation=f"Unique match: {res['matches'][0]['label']}."
                    ))
                    step_counter += 1
                elif res["status"] == "multiple":
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought="Driver name is ambiguous — asking user to disambiguate instead of guessing.",
                        action="resolve_entity",
                        action_input={"entity": "driver", "name": res["candidate"]},
                        observation=f"{len(res['matches'])} candidates."
                    ))
                    return self._finish(
                        query, traces, tools_used,
                        "### Which driver?\n\n" + format_clarification("driver", res)
                    )
                elif res["status"] == "generic":
                    top_driver = (
                        self.db.query(Driver.id)
                        .order_by(Driver.safety_score.desc())
                        .first()
                    )
                    driver_id = top_driver[0] if top_driver else 1
                    fallback_note = (
                        "\n*You didn't name a driver, so I'm showing our "
                        "top driver by safety score. Ask about one by name for specifics.*\n"
                    )
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought="No driver named — showing the top-safety driver, stated explicitly.",
                        action="resolve_entity",
                        action_input={"entity": "driver", "name": None},
                        observation="Falling back to top-safety driver with disclosure."
                    ))
                    step_counter += 1
                else:
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought="Driver name matched nothing.",
                        action="resolve_entity",
                        action_input={"entity": "driver", "name": res["candidate"]},
                        observation="No match."
                    ))
                    return self._finish(
                        query, traces, tools_used,
                        "### Driver not found\n\n" + format_not_found("driver", res)
                    )
            final_answer = self._driver_profile(
                driver_id, traces, tools_used, 1, fallback_note
            )

        elif "sop" in q_lower or "procedure" in q_lower or "how to" in q_lower or "rule" in q_lower:
            traces.append(AgentActionTrace(
                step=1,
                thought="User asked for internal operating procedures. Searching vector RAG knowledge base.",
                action="search_knowledge_base",
                action_input={"question": query},
                observation="Retrieved matching SOP sections and official protocols."
            ))
            tools_used.append("search_knowledge_base")
            rag_res = await self.tool_search_knowledge_base(query)
            final_answer = f"### SOP Operational Guidance\n\n{rag_res['sop_answer']}\n\n*Verified against: {', '.join(rag_res['citations'])}*"

        else:
            # Bare identifiers ("CDL-1000078", "MC-100078", "Richard Garcia")
            # carry no keyword — resolve IDs first, then names, before
            # surrendering to the generic report.
            lic_id = resolve_driver_license(self.db, query)
            if lic_id is not None:
                traces.append(AgentActionTrace(
                    step=step_counter,
                    thought="Bare license number matched a driver record.",
                    action="resolve_entity",
                    action_input={"entity": "driver_license"},
                    observation=f"Unique match: driver ID {lic_id}."
                ))
                return self._finish(
                    query, traces, tools_used,
                    self._driver_profile(lic_id, traces, tools_used, step_counter)
                )
            mc_id = resolve_carrier_mc(self.db, query)
            if mc_id is not None:
                traces.append(AgentActionTrace(
                    step=step_counter,
                    thought="Bare MC number matched a carrier record.",
                    action="resolve_entity",
                    action_input={"entity": "carrier_mc"},
                    observation=f"Unique match: carrier ID {mc_id}."
                ))
                return self._finish(
                    query, traces, tools_used,
                    self._carrier_profile(mc_id, traces, tools_used, step_counter)
                )
            res_d = resolve_driver(self.db, query)
            if res_d["status"] == "single":
                traces.append(AgentActionTrace(
                    step=step_counter,
                    thought=f"Bare name resolved to driver \"{res_d['matches'][0]['label']}\".",
                    action="resolve_entity",
                    action_input={"entity": "driver", "name": res_d["candidate"]},
                    observation=f"Unique match: {res_d['matches'][0]['label']}."
                ))
                final_answer = self._driver_profile(
                    res_d["matches"][0]["id"], traces, tools_used, step_counter
                )
            else:
                res_c = resolve_carrier(self.db, query)
                if res_c["status"] == "single":
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought=f"Bare name resolved to carrier \"{res_c['matches'][0]['label']}\".",
                        action="resolve_entity",
                        action_input={"entity": "carrier", "name": res_c["candidate"]},
                        observation=f"Unique match: {res_c['matches'][0]['label']}."
                    ))
                    final_answer = self._carrier_profile(
                        res_c["matches"][0]["id"], traces, tools_used, step_counter
                    )
                elif res_d["status"] == "multiple":
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought="Bare name is ambiguous — asking user to disambiguate.",
                        action="resolve_entity",
                        action_input={"entity": "driver", "name": res_d["candidate"]},
                        observation=f"{len(res_d['matches'])} candidates."
                    ))
                    final_answer = "### Which driver?\n\n" + format_clarification("driver", res_d)
                elif res_c["status"] == "multiple":
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought="Bare name is ambiguous — asking user to disambiguate.",
                        action="resolve_entity",
                        action_input={"entity": "carrier", "name": res_c["candidate"]},
                        observation=f"{len(res_c['matches'])} candidates."
                    ))
                    final_answer = "### Which carrier?\n\n" + format_clarification("carrier", res_c)
                elif re.search(r"\b(he|him|his|she|her|they|them|their)\b", q_lower) and re.search(
                    r"\b(score|safety|status|doing|performance|license|experience|duty|late|rate)\b", q_lower
                ):
                    # Pronoun about a person with no antecedent (e.g. right after
                    # an ambiguous answer): ask who, don't dump fleet stats.
                    traces.append(AgentActionTrace(
                        step=step_counter,
                        thought="Pronoun without a resolvable antecedent — requesting the name.",
                        action="resolve_entity",
                        action_input={"entity": "unknown", "name": None},
                        observation="No antecedent in scope."
                    ))
                    final_answer = (
                        "### Which driver?\n\nCould you tell me which driver you mean — "
                        "a full or partial name works, e.g. *\"How is driver Garcia doing?\"*"
                    )
                else:
                    # Default operational report workflow
                    traces.append(AgentActionTrace(
                        step=1,
                        thought="Dispatcher requested general operations status. Compiling executive KPI report across all loads and fleet activity.",
                        action="generate_report",
                        action_input={"report_type": "operations_overview"},
                        observation="Aggregated load counts, delay frequencies, and unresolved alerts."
                    ))
                    tools_used.append("generate_report")
                    rep = self.tool_generate_report()
                    final_answer = (
                        f"### Daily AI Operations Overview\n\n"
                        f"- **Total Monitored Loads:** {rep['total_monitored_loads']:,}\n"
                        f"- **Currently In Transit:** {rep['active_in_transit']:,}\n"
                        f"- **Active Delayed Loads:** {rep['currently_delayed']:,}\n"
                        f"- **Fleet On-Time Delivery Rate:** **{rep['delivered_on_time_pct']}%**\n"
                        f"- **Active Unresolved Alerts:** {rep['active_unresolved_alerts']}\n\n"
                        f"**Recommendation:** {rep['action_required']}"
                    )

        seen: List[str] = []
        for t in tools_used:
            if t not in seen:
                seen.append(t)
        return AgentChatResponse(
            query=query,
            final_answer=final_answer,
            action_traces=traces,
            tools_used=seen
        )
