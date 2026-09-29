from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Alert, User
from app.schemas.logistics import AlertOut
from app.services.automation_runner import AutomationRunner
from app.api.v1.auth import authorize_workflow_trigger, get_current_user, require_roles
from app.services.audit import log_audit_event

router = APIRouter(prefix="/alerts", tags=["Alerts & Automations"])


@router.get("", response_model=List[AlertOut])
def get_alerts(
    status: Optional[str] = "active",
    alert_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Alert)
    if status and status != "all":
        query = query.filter(Alert.status == status)
    if alert_type and alert_type != "all":
        query = query.filter(Alert.alert_type == alert_type)
    return query.order_by(Alert.created_at.desc()).offset(offset).limit(limit).all()


@router.post("/{id}/resolve")
def resolve_alert(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("dispatcher", "operations_manager", "admin")),
):
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status == "resolved":
        return {"status": "success", "message": f"Alert {id} was already resolved.", "already_resolved": True}
    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    log_audit_event(db, "alert.resolve", "alert", actor=current_user, entity_id=alert.id)
    db.commit()
    return {"status": "success", "message": f"Alert {id} resolved successfully."}


@router.post("/trigger/{workflow_name}")
async def trigger_workflow(
    workflow_name: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(authorize_workflow_trigger),
) -> Dict[str, Any]:
    """Manually trigger one of the 3 automated operational workflows."""
    if workflow_name in ["workflow_a", "delayed_load"]:
        result = await AutomationRunner.run_delayed_load_workflow(db=db)
    elif workflow_name in ["workflow_b", "daily_report"]:
        result = await AutomationRunner.run_daily_ops_report_workflow(db=db)
    elif workflow_name in ["workflow_c", "carrier_breach"]:
        result = await AutomationRunner.run_carrier_risk_workflow(db=db)
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"Unknown workflow '{workflow_name}'. Available: workflow_a, workflow_b, workflow_c"
        )

    log_audit_event(
        db,
        "workflow.trigger",
        "workflow",
        actor=current_user,
        entity_id=workflow_name,
        metadata={
            "workflow": result.get("workflow"),
            "status": result.get("status"),
            "trigger_source": "n8n" if current_user is None else "manual",
        },
    )
    db.commit()
    return result
