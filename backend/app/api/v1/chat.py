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

import re
from collections import deque
from typing import Any, Deque, Dict, List
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
from app.services.entity_resolution import extract_context_entity, message_names_entity
from app.services.rag import query_knowledge_base
from app.services.text_to_sql import execute_text_to_sql

router = APIRouter(prefix="/copilot", tags=["Conversational Copilot"])

PERSONA = (
    "You are Tracc, a friendly AI dispatch copilot for a US freight network. "
    "You answer in plain, warm words, stay in your dispatcher-assistant role, "
    "and ground operational claims in system data, never guesses."
)

# A knowledge-seeking question with no data/entity signals at all
# ("When is the holiday party?") deserves a grounded RAG attempt — and its
# honest refusal — instead of an unrelated fleet report.
_INTERROGATIVE_RE = re.compile(
    r"^(what|when|where|why|how|is|are|can|could|do|does|did|will|would|should|which|who|whom)\b",
    re.IGNORECASE,
)
_NO_SIGNAL_RE = re.compile(
    r"\b(loads?|carriers?|drivers?|trucks?|shipments?|deliver\w*|delay\w*|"
    r"late|risk\w*|revenue|kpis?|alerts?|sop|procedures?|protocols?|"
    r"detention|reefer|hos|compliance|invoices?|routes?|lanes?|dispatch\w*|"
    r"fleet|on-?time|otd|predict\w*|sql|reports?|dashboard|L\d+)\b",
    re.IGNORECASE,
)
_PRONOUN_PERSON_RE = re.compile(
    r"\b(he|him|his|she|her|they|them|their)\b.*\b(score|safety|status|doing|"
    r"performance|license|experience|duty|late|rate|load|loads|carrier|driver)\b"
    r"|\b(score|safety|status|doing|performance|license|experience|duty)\b.*"
    r"\b(he|him|his|she|her|they|them|their)\b",
    re.IGNORECASE,
)

# Substring matching caused real misroutes ("those" contains "hos",
# "country" contains "count"), so triggers are word-boundaried regexes.
RAG_TRIGGERS = [
    r"\bsops?\b", r"\bprocedures?\b", r"\bprotocols?\b", r"\bpolic(y|ies)\b",
    r"\bhow\s+to\b", r"\bhow\s+do\s+i\b", r"\brules?\b", r"\bhos\b",
    r"\bdetentions?\b", r"\breefers?\b", r"\bclaims?\b", r"\bcompliance\b",
    r"\bbreakdowns?\b", r"\bfatigue\b", r"\bonboard\w*\b",
]
SQL_TRIGGERS = [
    r"\bhow\s+many\b", r"\bhow\s+much\b", r"\bcounts?\b", r"\btotals?\b",
    r"\baverages?\b", r"\bavg\b", r"\blists?\b", r"\bshow\s+me\b",
    r"\bshow\s+all\b", r"\btop\b", r"\bworst\b", r"\bbest\b", r"\bwhich\b",
    r"\brevenues?\b", r"\botd\b", r"\bon-time\b", r"\bon\s+time\b",
    r"\brates?\b", r"\bpercent\b", r"\bcompar(?:e|ed|ing|ison)\b",
    r"\bselect\b",
]


def _matches_any(patterns, text: str) -> bool:
    return any(re.search(p, text) for p in patterns)

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

    Never fires when the message names its own entity — history context
    must assist, never override, an explicit new question.
    """
    if message_names_entity(db, message):
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
    if not message:
        raise HTTPException(status_code=422, detail="Message must not be blank.")
    session_id = payload.session_id or uuid4().hex[:12]
    key = f"{current_user.id}:{session_id}"
    history = _history(key)

    intent = classify_intent(message)
    traces: List[AgentActionTrace] = []
    citations: List[RAGCitation] = []
    sql = None
    row_count = None
    columns: List[str] = []
    rows: List[List[Any]] = []

    try:
        if intent != OPERATIONAL:
            mode = "chitchat"
            reply = chitchat_reply(intent, current_user.full_name)
        else:
            q = message.lower()
            if _matches_any(RAG_TRIGGERS, q) or (
                _INTERROGATIVE_RE.match(message.strip())
                and not _NO_SIGNAL_RE.search(message)
                and not _PRONOUN_PERSON_RE.search(message)
            ):
                mode = "rag"
                result = await query_knowledge_base(message, db=db)
                reply = result.answer
                citations = result.citations
            elif _matches_any(SQL_TRIGGERS, q):
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
                    columns = result.columns
                    rows = [list(r) for r in result.rows[:25]]
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
        columns=columns,
        rows=rows,
    )
