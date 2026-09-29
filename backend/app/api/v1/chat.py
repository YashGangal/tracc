"""Unified conversational copilot: one ChatGPT-style entry point.

Flow per message:
  1. Classify intent — chitchat (hi, thanks, help, ...) answers instantly
     with the Tracc persona and never touches tools or data.
  2. Route operational messages: SOP/procedure questions -> RAG,
     data questions -> safe Text-to-SQL, everything else -> ReAct agent.
  3. Record the turn in per-user session memory so follow-ups
     ("what is his safety score?") inherit the last discussed entity.

Guardrails are unchanged: chitchat cannot reach SQL/tools, and every
operational path keeps its existing validation, whitelists, and audit trail.
"""

from collections import deque
from typing import Deque, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.logistics import (
    AgentActionTrace,
    ChatRequest,
    ChatResponse,
    RAGCitation,
)
from app.services.agent import OperationsAgent
from app.services.audit import log_audit_event
from app.services.conversation import (
    OPERATIONAL,
    chitchat_reply,
    classify_intent,
)
from app.services.entity_resolution import extract_context_entity, has_explicit_reference
from app.services.rag import query_knowledge_base
from app.services.text_to_sql import execute_text_to_sql

router = APIRouter(prefix="/copilot", tags=["Conversational Copilot"])

PERSONA = (
    "You are Tracc, a friendly AI dispatch copilot for a US freight network. "
    "You answer in plain, warm words, stay in your dispatcher-assistant role, "
    "and ground operational claims in system data, never guesses."
)

# Procedure-flavored questions go to RAG first (intent dominates); data
# questions go to SQL; everything else falls through to the agent.
RAG_TRIGGERS = [
    "sop", "procedure", "protocol", "polic", "how to", "how do i",
    "rule", "hos", "detention", "reefer", "claim", "compliance",
    "breakdown", "fatigue", "onboard",
]
SQL_TRIGGERS = [
    "how many", "how much", "count", "total", "average", "avg ",
    "list", "show me", "show all", "top ", "worst", "best", "which",
    "revenue", "otd", "on-time", "on time", "rate", "percent", "compare",
]

_MAX_TURNS = 10
_MAX_SESSIONS = 2000
_sessions: Dict[str, Deque[Dict[str, str]]] = {}


def _history(key: str) -> List[Dict[str, str]]:
    return list(_sessions.get(key, []))


def _remember(key: str, role: str, content: str) -> None:
    if key not in _sessions:
        if len(_sessions) >= _MAX_SESSIONS:
            _sessions.pop(next(iter(_sessions)))
        _sessions[key] = deque(maxlen=_MAX_TURNS)
    _sessions[key].append({"role": role, "content": content[:800]})


def _with_context(db: Session, history: List[Dict[str, str]], message: str) -> str:
    """Append the last discussed entity so pronoun follow-ups resolve.

    Only fires when the message itself names nothing; the appended
    "(context: …)" hint carries the entity noun the agent branches on.
    """
    if has_explicit_reference(message):
        return message
    for turn in reversed(history):
        entity = extract_context_entity(db, turn["content"])
        if entity:
            return f"{message} (context: {entity})"
    return message


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = payload.message.strip()
    session_id = payload.session_id or uuid4().hex[:12]
    key = f"{current_user.id}:{session_id}"
    history = _history(key)

    intent = classify_intent(message)
    traces: List[AgentActionTrace] = []
    citations: List[RAGCitation] = []
    sql = None
    row_count = None

    try:
        if intent != OPERATIONAL:
            mode = "chitchat"
            reply = chitchat_reply(intent, current_user.full_name)
        else:
            q = message.lower()
            if any(t in q for t in RAG_TRIGGERS):
                mode = "rag"
                result = await query_knowledge_base(message, db=db)
                reply = result.answer
                citations = result.citations
            elif any(t in q for t in SQL_TRIGGERS):
                mode = "sql"
                try:
                    result = await execute_text_to_sql(message)
                except ValueError:
                    reply = (
                        "I couldn't turn that into a safe data query. Try asking "
                        "about loads, delays, revenue, carriers, or drivers — "
                        "for example, *“How many loads are delayed?”*"
                    )
                    result = None
                if result is not None:
                    reply = result.explanation
                    sql = result.generated_sql
                    row_count = result.row_count
            else:
                mode = "agent"
                contextual = _with_context(db, history, message)
                agent = OperationsAgent(db=db)
                result = await agent.execute_task(contextual)
                reply = result.final_answer
                traces = result.action_traces
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversational query failed: {e}")

    _remember(key, "user", message)
    _remember(key, "assistant", reply)
    log_audit_event(
        db,
        "copilot.chat",
        "chat_message",
        actor=current_user,
        metadata={"intent": intent, "mode": mode, "query_length": len(message)},
    )
    db.commit()

    return ChatResponse(
        reply=reply,
        intent=intent,
        mode_used=mode,
        session_id=session_id,
        action_traces=traces,
        citations=citations,
        generated_sql=sql,
        row_count=row_count,
    )
