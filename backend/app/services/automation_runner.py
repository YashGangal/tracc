import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.db.session import SessionLocal
from app.db.models import Load, Carrier, Alert
from app.core.ai_provider import AIProvider

logger = logging.getLogger(__name__)


class AutomationRunner:
    """
    Direct Python runner for the 3 n8n operational workflows.
    Allows running and testing automated workflows both via scheduled triggers 
    and manually via API triggers without external n8n dependencies.
    """

    @staticmethod
    async def run_delayed_load_workflow(db: Session = None) -> Dict[str, Any]:
        """
        Workflow A: Delayed Load Alert
        Finds delayed active loads and creates dispatcher alerts.
        """
        close = False
        if db is None:
            db = SessionLocal()
            close = True

        try:
            # Query delayed loads (bounded scan, newest first; per-load idempotency via existing-alert check).
            delayed_loads = db.query(Load).filter(Load.status == "delayed").order_by(Load.pickup_datetime.desc()).limit(20).all()
            created_alerts = []

            for load in delayed_loads:
                # Check if alert already exists
                existing = db.query(Alert).filter(
                    Alert.load_id == load.id,
                    Alert.alert_type == "delayed_load",
                    Alert.status == "active"
                ).first()
                if existing:
                    continue

                carrier = db.query(Carrier).filter(Carrier.id == load.carrier_id).first()
                carrier_name = carrier.name if carrier else "Carrier"
                
                alert_title = f"Transit Delay Notice: {load.load_number}"
                alert_msg = (
                    f"Load {load.load_number} ({load.origin_city}, {load.origin_state} -> "
                    f"{load.destination_city}, {load.destination_state}) hauled by {carrier_name} "
                    f"is experiencing an active operational transit delay. Immediate dispatcher check-in required."
                )

                new_alert = Alert(
                    alert_type="delayed_load",
                    severity="high",
                    load_id=load.id,
                    carrier_id=load.carrier_id,
                    title=alert_title,
                    message=alert_msg,
                    status="active"
                )
                db.add(new_alert)
                created_alerts.append(alert_title)

            db.commit()
            return {
                "workflow": "Workflow A - Delayed Load Alert",
                "status": "success",
                "delayed_loads_inspected": len(delayed_loads),
                "alerts_created": len(created_alerts),
                "alert_details": created_alerts
            }
        finally:
            if close:
                db.close()

    @staticmethod
    async def run_daily_ops_report_workflow(db: Session = None) -> Dict[str, Any]:
        """
        Workflow B: Daily Operations Report
        Executes daily KPI rollup and creates an executive briefing summary.
        """
        close = False
        if db is None:
            db = SessionLocal()
            close = True

        try:
            report_day = datetime.utcnow().date()
            day_start = datetime.combine(report_day, datetime.min.time())
            day_end = day_start + timedelta(days=1)
            existing_report = db.query(Alert).filter(
                Alert.alert_type == "daily_ops_report",
                Alert.created_at >= day_start,
                Alert.created_at < day_end,
            ).first()
            if existing_report:
                return {
                    "workflow": "Workflow B - Daily Operations Report",
                    "status": "success",
                    "already_generated": True,
                    "report": existing_report.message,
                }

            total_loads = db.query(Load).count()
            delivered = db.query(Load).filter(Load.status == "delivered").count()
            delayed = db.query(Load).filter(Load.status == "delayed").count()
            in_transit = db.query(Load).filter(Load.status == "in_transit").count()
            
            on_time = round((delivered / (delivered + delayed)) * 100, 1) if (delivered + delayed) > 0 else 100.0

            briefing_text = (
                f"### Daily Operations Briefing - {datetime.utcnow().strftime('%B %d, %Y')}\n\n"
                f"- **Total Dispatches:** {total_loads:,} loads\n"
                f"- **Delivered Successfully:** {delivered:,} loads\n"
                f"- **Delayed in Transit:** {delayed:,} loads\n"
                f"- **Active In-Transit Pipeline:** {in_transit:,} loads\n"
                f"- **On-Time Delivery Performance:** **{on_time}%**\n\n"
                f"**Dispatcher Focus Today:** Prioritize Reefer loads moving through Midwest lanes. Follow up on active detention at high-dwell customer facilities."
            )

            # Store as an informational alert for operations managers
            briefing_alert = Alert(
                alert_type="daily_ops_report",
                severity="low",
                title=f"Daily Operations Briefing ({datetime.utcnow().strftime('%b %d')})",
                message=briefing_text,
                status="active"
            )
            db.add(briefing_alert)
            db.commit()

            return {
                "workflow": "Workflow B - Daily Operations Report",
                "status": "success",
                "report": briefing_text
            }
        finally:
            if close:
                db.close()

    @staticmethod
    async def run_carrier_risk_workflow(db: Session = None) -> Dict[str, Any]:
        """
        Workflow C: High-Risk Carrier Alert
        Calculates 14-day rolling late delivery rates and flags carriers exceeding 15% late deliveries.
        """
        close = False
        if db is None:
            db = SessionLocal()
            close = True

        try:
            reference_time = db.query(func.max(Load.pickup_datetime)).scalar() or datetime.utcnow()
            window_start = reference_time - timedelta(days=14)
            # Single aggregate query per status instead of 2 counts per carrier.
            rows = (
                db.query(
                    Carrier.id,
                    Carrier.name,
                    Carrier.mc_number,
                    Carrier.rating,
                    func.count(Load.id).label("total"),
                    func.sum(case((Load.status == "delayed", 1), else_=0)).label("delays"),
                )
                .join(Load, (Load.carrier_id == Carrier.id)
                    & (Load.pickup_datetime >= window_start)
                    & (Load.pickup_datetime <= reference_time)
                    & (Load.status.in_(["delivered", "delayed"])))
                .group_by(Carrier.id, Carrier.name, Carrier.mc_number, Carrier.rating)
                .all()
            )
            breaches = []
            carriers_inspected = 0

            for row in rows:
                total = row.total or 0
                if total == 0:
                    continue
                carriers_inspected += 1
                delays = row.delays or 0
                late_rate = round((delays / total * 100), 1) if total > 0 else 0.0

                if late_rate >= 15.0:
                    alert_title = f"Carrier Performance Breach: {row.name}"
                    alert_msg = (
                        f"Carrier {row.name} (MC: {row.mc_number}) has breached the allowable delay threshold "
                        f"with a {late_rate}% late rate over {total} completed loads in the rolling 14-day window. "
                        f"Carrier rating: {row.rating}/5.0. "
                        f"Recommended: Review for probation status."
                    )

                    # Check if already alerted
                    exists = db.query(Alert).filter(
                        Alert.carrier_id == row.id,
                        Alert.alert_type == "high_risk_carrier",
                        Alert.status == "active"
                    ).first()

                    if not exists:
                        new_alert = Alert(
                            alert_type="high_risk_carrier",
                            severity="medium",
                            carrier_id=row.id,
                            title=alert_title,
                            message=alert_msg,
                            status="active"
                        )
                        db.add(new_alert)
                        breaches.append(row.name)

            db.commit()
            return {
                "workflow": "Workflow C - High-Risk Carrier Alert",
                "status": "success",
                "window_start": window_start.isoformat(),
                "window_end": reference_time.isoformat(),
                "carriers_inspected": carriers_inspected,
                "carriers_flagged": len(breaches),
                "breach_list": breaches
            }
        finally:
            if close:
                db.close()
