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

import asyncio
import json
import re
from collections import deque
from typing import Any, Deque, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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


_ORDINAL_WORDS = {"first": 0, "second": 1, "third": 2, "fourth": 3, "fifth": 4, "last": -1}
_ORDINAL_RE = re.compile(
    r"\b(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th|"
    r"#[1-5]|option\s+[1-5]|number\s+[1-5])\b|\b([1-5])\b",
    re.IGNORECASE,
)
_CLARIFY_MARKER = "which one did you mean"
_CANDIDATE_LINE_RE = re.compile(r"^-\s+\*\*(.+?)\*\*\s+\(([^)]+)\)")
_ID_IN_DETAIL_RE = re.compile(r"\b(CDL-[\w-]+|MC-[\w-]+)\b", re.IGNORECASE)


def _ordinal_index(match: re.Match) -> Optional[int]:
    word = (match.group(1) or "").lower()
    if word == "last":
        return -1
    if word in _ORDINAL_WORDS:
        return _ORDINAL_WORDS[word]
    digits = re.search(r"\d+", word)
    if digits:
        return int(digits.group(0)) - 1
    if match.group(2):
        return int(match.group(2)) - 1
    return None


def _resolve_ordinal(history: List[Dict[str, str]], message: str) -> Optional[str]:
    """Rewrite ordinal selections ("the second one", "number 3", "last") into
    an explicit entity query using the last clarification list in history.
    Prefers license/MC identifiers so duplicates resolve uniquely."""
    m = _ORDINAL_RE.search(message or "")
    if not m:
        return None
    for turn in reversed(history):
        text = turn.get("content", "")
        if _CLARIFY_MARKER not in text.lower():
            continue
        kind = "carrier" if "which carrier" in text.lower() else "driver"
        cands = []
        for line in text.splitlines():
            cm = _CANDIDATE_LINE_RE.match(line.strip())
            if cm:
                cands.append((cm.group(1).strip(), cm.group(2)))
        if not cands:
            return None
        idx = _ordinal_index(m)
        if idx is None or not (-len(cands) <= idx < len(cands)):
            return None
        name, detail = cands[idx]
        im = _ID_IN_DETAIL_RE.search(detail)
        if im:
            key = "driver" if kind == "driver" else "carrier"
            return f"{key} {im.group(1)}"
        return f"Tell me about {kind} {name}"
    return None

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


# Delay between streamed word-chunks (patched to 0 in tests).
STREAM_WORD_DELAY = 0.02


async def _process_message(
    db: Session,
    user_full_name: str,
    message: str,
    history: List[Dict[str, str]],
) -> Dict[str, Any]:
    """Route one message and build the full reply payload (shared by the
    JSON and streaming endpoints so both behave identically)."""
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
            reply = chitchat_reply(intent, user_full_name)
        else:
            # Ordinal selections ("the second one") resolve against the last
            # clarification list before normal routing runs.
            ordinal = _resolve_ordinal(history, message)
            routing_message = ordinal or message
            q = routing_message.lower()
            if _matches_any(RAG_TRIGGERS, q) or (
                _INTERROGATIVE_RE.match(message.strip())
                and not _NO_SIGNAL_RE.search(message)
                and not _PRONOUN_PERSON_RE.search(message)
            ):
                mode = "rag"
                result = await query_knowledge_base(routing_message, db=db)
                reply = result.answer
                citations = result.citations
            elif _matches_any(SQL_TRIGGERS, q):
                mode = "sql"
                try:
                    result = await execute_text_to_sql(routing_message)
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
                contextual = _with_context(db, history, routing_message)
                agent = OperationsAgent(db=db)
                result = await agent.execute_task(contextual)
                reply = result.final_answer
                traces = result.action_traces
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversational query failed: {e}")

    return {
        "reply": reply,
        "intent": intent,
        "mode": mode,
        "traces": traces,
        "citations": citations,
        "sql": sql,
        "row_count": row_count,
        "columns": columns,
        "rows": rows,
    }


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

    result = await _process_message(db, current_user.full_name, message, history)

    _remember(key, "user", message)
    _remember(key, "assistant", result["reply"])
    log_audit_event(
        db,
        "copilot.chat",
        "chat_message",
        actor=current_user,
        metadata={"intent": result["intent"], "mode": result["mode"], "query_length": len(message)},
    )
    db.commit()

    return ChatResponse(
        reply=result["reply"],
        intent=result["intent"],
        mode_used=result["mode"],
        session_id=session_id,
        action_traces=result["traces"],
        citations=result["citations"],
        generated_sql=result["sql"],
        row_count=result["row_count"],
        columns=result["columns"],
        rows=result["rows"],
    )


@router.post("/chat/stream")
async def chat_stream(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Same pipeline as /chat, but the reply streams as SSE word-chunks
    (ChatGPT-style live typing) followed by one done-event carrying the
    full metadata (mode, traces, citations, SQL, table)."""
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message must not be blank.")
    session_id = payload.session_id or uuid4().hex[:12]
    key = f"{current_user.id}:{session_id}"
    history = _history(key)

    result = await _process_message(db, current_user.full_name, message, history)

    _remember(key, "user", message)
    _remember(key, "assistant", result["reply"])
    log_audit_event(
        db,
        "copilot.chat",
        "chat_message",
        actor=current_user,
        metadata={"intent": result["intent"], "mode": result["mode"], "query_length": len(message)},
    )
    db.commit()

    async def gen():
        for chunk in re.findall(r"\S+\s*", result["reply"]):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
            await asyncio.sleep(STREAM_WORD_DELAY)
        done = {
            "done": True,
            "intent": result["intent"],
            "mode_used": result["mode"],
            "session_id": session_id,
            "action_traces": [t.model_dump() for t in result["traces"]],
            "citations": [c.model_dump() for c in result["citations"]],
            "generated_sql": result["sql"],
            "row_count": result["row_count"],
            "columns": result["columns"],
            "rows": result["rows"],
        }
        yield f"data: {json.dumps(done, default=str)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
