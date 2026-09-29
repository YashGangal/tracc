from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User
from app.schemas.logistics import CopilotQueryRequest, AgentChatResponse
from app.services.agent import OperationsAgent
from app.api.v1.auth import get_current_user
from app.services.audit import log_audit_event

router = APIRouter(prefix="/agent", tags=["AI Operations Agent"], dependencies=[Depends(get_current_user)])


@router.post("/chat", response_model=AgentChatResponse)
async def chat_with_agent(
    payload: CopilotQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        agent = OperationsAgent(db=db)
        response = await agent.execute_task(payload.query)
        log_audit_event(
            db,
            "agent.task",
            "agent_query",
            actor=current_user,
            metadata={"query_length": len(payload.query), "tools_used": response.tools_used},
        )
        db.commit()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent execution error: {e}")
