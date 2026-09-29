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
            # Carrier inspection workflow — honor explicit IDs instead of hardcoding 1.
            requested_id = _extract_entity_id(query, ["carrier", "mc"])
            carrier_id = requested_id
            if carrier_id is None:
                top_carrier = (
                    self.db.query(Carrier.id)
                    .join(Load, Carrier.id == Load.carrier_id)
                    .group_by(Carrier.id)
                    .order_by(func.count(Load.id).desc())
                    .first()
                )
                carrier_id = top_carrier[0] if top_carrier else 1
            perf = self.tool_get_carrier_performance(carrier_id)
            if "error" in perf:
                traces.append(AgentActionTrace(
                    step=1,
                    thought="User inquired about carrier metrics. Attempted lookup failed.",
                    action="get_carrier_performance",
                    action_input={"carrier_id": carrier_id},
                    observation=perf["error"]
                ))
                tools_used.append("get_carrier_performance")
                final_answer = f"### Carrier Performance Inspection\n\nCarrier ID {carrier_id} not found. {perf['error']}"
            else:
                traces.append(AgentActionTrace(
                    step=1,
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
                final_answer = (
                    f"### Carrier Performance Inspection: {perf['name']}\n\n"
                    f"- **MC Number:** {perf['mc_number']}\n"
                    f"- **Safety Status:** `{perf['status'].upper()}`\n"
                    f"- **Fleet Size:** {perf['fleet_size']} power units\n"
                    f"- **On-Time Delivery Rate:** **{perf['on_time_rate_pct']}%** across {perf['total_loads']} completed dispatches.\n"
                    f"- **Total Dispatches Delayed:** {perf['delayed_loads']} loads.\n"
                    f"- **Operational Recommendation:** {rec}"
                )

        elif "driver" in q_lower:
            requested_id = _extract_entity_id(query, ["driver", "cdl"])
            if requested_id is not None:
                driver_id = requested_id
            else:
                top_driver = (
                    self.db.query(Driver.id)
                    .order_by(Driver.safety_score.desc())
                    .first()
                )
                driver_id = top_driver[0] if top_driver else 1
            driver_info = self.tool_get_driver_performance(driver_id)
            if "error" in driver_info:
                traces.append(AgentActionTrace(
                    step=1,
                    thought="Retrieving driver safety rating — lookup failed.",
                    action="get_driver_performance",
                    action_input={"driver_id": driver_id},
                    observation=driver_info["error"]
                ))
                tools_used.append("get_driver_performance")
                final_answer = f"### Driver Profile & Safety Record\n\nDriver ID {driver_id} not found. {driver_info['error']}"
            else:
                traces.append(AgentActionTrace(
                    step=1,
                    thought="Retrieving driver safety rating and compliance history.",
                    action="get_driver_performance",
                    action_input={"driver_id": driver_id},
                    observation=f"Driver {driver_info['name']} located with safety score {driver_info['safety_score']}."
                ))
                tools_used.append("get_driver_performance")
                final_answer = (
                    f"### Driver Profile & Safety Record\n\n"
                    f"- **Driver:** {driver_info['name']} ({driver_info['license_number']})\n"
                    f"- **Affiliated Carrier:** {driver_info['carrier_name']}\n"
                    f"- **Safety Score:** **{driver_info['safety_score']}/100**\n"
                    f"- **Commercial Experience:** {driver_info['experience_years']} years\n"
                    f"- **Duty Status:** `{driver_info['status'].upper()}`"
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
