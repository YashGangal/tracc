from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.db.models import User
from app.schemas.logistics import CopilotQueryRequest, SQLQueryResult
from app.services.text_to_sql import execute_text_to_sql
from app.api.v1.auth import get_current_user_or_workflow_token
from app.services.audit import log_audit_event

router = APIRouter(prefix="/copilot", tags=["AI Copilot (Text-to-SQL)"])


@router.post("/query", response_model=SQLQueryResult)
async def query_copilot_sql(
    payload: CopilotQueryRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_or_workflow_token),
):
    try:
        result = await execute_text_to_sql(payload.query)
        log_audit_event(
            db,
            "copilot.sql_query",
            "copilot_query",
            actor=current_user,
            metadata={"query_length": len(payload.query), "row_count": result.row_count},
        )
        db.commit()
        return result
    except ValueError as e:
        log_audit_event(
            db,
            "copilot.sql_query_rejected",
            "copilot_query",
            actor=current_user,
            metadata={"query_length": len(payload.query)},
        )
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text-to-SQL query failed: {e}")
