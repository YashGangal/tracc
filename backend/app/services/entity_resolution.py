"""Name-based entity resolution for conversational queries.

Drivers/carriers are looked up by (partial, case-insensitive) name, loads by
load number (L14520) or numeric id. Results are explicit:

- "single"   — exactly one match, safe to answer about.
- "multiple" — ask the user to disambiguate (never guess a person).
- "none"     — graceful not-found with spelling suggestions.
- "generic"  — no name given at all (e.g. "tell me about drivers"):
               caller may list top entries, but must SAY SO.
"""

import difflib
import re
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.models import Carrier, Driver, Load

# Filler words stripped before name matching. Deliberately NOT including
# entity nouns (driver/carrier/load) — those are stripped by callers via
# keyword-anchored extraction first.
STOPWORDS = {
    "what", "whats", "what's", "how", "is", "are", "was", "were", "the",
    "a", "an", "about", "tell", "me", "show", "give", "please", "pls",
    "doing", "do", "does", "performing", "performance", "status", "named",
    "called", "for", "of", "and", "or", "my", "our", "any", "who",
    "which", "there", "here", "with", "doing", "going", "looking",
}

_LOAD_NUMBER_RE = re.compile(r"\b(L\d+)\b", re.IGNORECASE)
_NUMERIC_REF_RE = re.compile(
    r"\b(?:driver|carrier|load|truck|cdl|mc)\s*(?:id|#|no\.?|number)?\s*[:\-]?\s*(\d+)\b",
    re.IGNORECASE,
)
_QUOTED_RE = re.compile(r'"([^"]+)"|\'([^\']+)\'')
_ENTITY_LEAD_RE = re.compile(
    r"\b(?:driver|carrier|load|truck)s?\b\s*(?:named|called|no\.?|number|#|id)?\s*:?\s*(.+)$",
    re.IGNORECASE,
)


def _candidate_text(query: str) -> str:
    """Best-effort name fragment from a natural-language query."""
    q = (query or "").strip()
    m = _QUOTED_RE.search(q)
    if m:
        return (m.group(1) or m.group(2) or "").strip()
    m = _ENTITY_LEAD_RE.search(q)
    if m:
        return m.group(1).strip(" ?!.,")
    return q


def _tokens(candidate: str) -> List[str]:
    words = re.findall(r"[A-Za-z0-9\-]+", candidate)
    return [w for w in words if len(w) >= 2 and w.lower() not in STOPWORDS]


def _match_all(model, column, tokens: List[str], db: Session, limit: int = 6):
    """Full entities matching ALL tokens (AND), case-insensitive."""
    q = db.query(model)
    for tok in tokens:
        q = q.filter(column.ilike(f"%{tok}%"))
    return q.limit(limit).all()


def _exact_matches(model, column, candidate: str, db: Session) -> list:
    return (
        db.query(model)
        .filter(func.lower(column) == candidate.lower())
        .limit(2)
        .all()
    )


def _suggestions(candidate: str, names: List[str], n: int = 3) -> List[str]:
    return difflib.get_close_matches(candidate, names, n=n, cutoff=0.55)


def _driver_names(db: Session) -> List[str]:
    return [r[0] for r in db.query(Driver.name).all()]


def _carrier_names(db: Session) -> List[str]:
    return [r[0] for r in db.query(Carrier.name).all()]


def _driver_card(d: Driver, db: Session) -> Dict[str, Any]:
    carrier = db.query(Carrier).filter(Carrier.id == d.carrier_id).first() if d.carrier_id else None
    return {
        "id": d.id,
        "label": d.name,
        "detail": f"{d.license_number} · {carrier.name if carrier else 'Unassigned'} · safety {d.safety_score}",
    }


def _carrier_card(c: Carrier, db: Session) -> Dict[str, Any]:
    total = db.query(Load).filter(Load.carrier_id == c.id).count()
    late = db.query(Load).filter(Load.carrier_id == c.id, Load.status == "delayed").count()
    otd = round((total - late) / total * 100, 1) if total else 0.0
    return {
        "id": c.id,
        "label": c.name,
        "detail": f"{c.mc_number} · {total} loads · OTD {otd}%",
    }


def resolve_driver(db: Session, query: str) -> Dict[str, Any]:
    candidate = _candidate_text(query)
    tokens = _tokens(candidate)
    if not tokens:
        return {"status": "generic", "matches": [], "candidate": candidate}
    exact = _exact_matches(Driver, Driver.name, candidate, db)
    if len(exact) == 1:
        return {"status": "single", "matches": [_driver_card(exact[0], db)], "candidate": candidate}
    rows = _match_all(Driver, Driver.name, tokens, db) if not exact else exact
    if len(rows) == 1:
        return {"status": "single", "matches": [_driver_card(rows[0], db)], "candidate": candidate}
    if len(rows) > 1:
        return {"status": "multiple", "matches": [_driver_card(r, db) for r in rows[:5]], "candidate": candidate}
    return {
        "status": "none",
        "matches": [],
        "candidate": candidate,
        "suggestions": _suggestions(candidate, _driver_names(db)),
    }


def resolve_carrier(db: Session, query: str) -> Dict[str, Any]:
    candidate = _candidate_text(query)
    tokens = _tokens(candidate)
    if not tokens:
        return {"status": "generic", "matches": [], "candidate": candidate}
    exact = _exact_matches(Carrier, Carrier.name, candidate, db)
    if len(exact) == 1:
        return {"status": "single", "matches": [_carrier_card(exact[0], db)], "candidate": candidate}
    rows = _match_all(Carrier, Carrier.name, tokens, db) if not exact else exact
    if len(rows) == 1:
        return {"status": "single", "matches": [_carrier_card(rows[0], db)], "candidate": candidate}
    if len(rows) > 1:
        return {"status": "multiple", "matches": [_carrier_card(r, db) for r in rows[:5]], "candidate": candidate}
    return {
        "status": "none",
        "matches": [],
        "candidate": candidate,
        "suggestions": _suggestions(candidate, _carrier_names(db)),
    }


def resolve_load(db: Session, query: str) -> Dict[str, Any]:
    """Loads resolve by load number (L14520) or numeric id. No generic listing."""
    m = _LOAD_NUMBER_RE.search(query or "")
    if m:
        number = m.group(1).upper()
        row = db.query(Load).filter(Load.load_number == number).first()
        if row:
            return {
                "status": "single",
                "matches": [{
                    "id": row.id,
                    "label": row.load_number,
                    "detail": f"{row.origin_city} -> {row.destination_city} · {row.status}",
                }],
                "candidate": number,
            }
        return {"status": "none", "matches": [], "candidate": number, "suggestions": []}
    m2 = re.search(r"\bload\s*(?:id|#|no\.?|number)?\s*[:\-]?\s*(\d+)\b", (query or "").lower())
    if m2:
        row = db.query(Load).filter(Load.id == int(m2.group(1))).first()
        if row:
            return {
                "status": "single",
                "matches": [{
                    "id": row.id,
                    "label": row.load_number,
                    "detail": f"{row.origin_city} -> {row.destination_city} · {row.status}",
                }],
                "candidate": m2.group(1),
            }
        return {"status": "none", "matches": [], "candidate": m2.group(1), "suggestions": []}
    return {"status": "none", "matches": [], "candidate": "", "suggestions": []}


def has_explicit_reference(query: str) -> bool:
    """True when the message already names an entity (load number or numeric id)."""
    q = query or ""
    return bool(_LOAD_NUMBER_RE.search(q) or _NUMERIC_REF_RE.search(q))


def extract_context_entity(db: Session, text: str) -> Optional[str]:
    """Pull one entity reference out of a history turn for follow-up questions.

    Returns display text like "load L14520" / "driver Elizabeth Garcia" /
    "carrier 12", or None when the turn names nothing usable.
    """
    t = text or ""
    m = _LOAD_NUMBER_RE.search(t)
    if m:
        return f"load {m.group(1).upper()}"
    m = _NUMERIC_REF_RE.search(t)
    if m:
        kind = re.match(r"\b(driver|carrier|load|truck|cdl|mc)\b", t[m.start():], re.IGNORECASE)
        label = kind.group(1).lower() if kind else "load"
        return f"{label} {m.group(1)}"
    res = resolve_driver(db, t)
    if res["status"] == "single":
        return f"driver {res['matches'][0]['label']}"
    res = resolve_carrier(db, t)
    if res["status"] == "single":
        return f"carrier {res['matches'][0]['label']}"
    return None


def format_clarification(kind: str, res: Dict[str, Any]) -> str:
    lines = [
        f"I found **{len(res['matches'])}** {kind}s matching *\"{res['candidate']}\"* — "
        "which one did you mean?"
    ]
    for mit in res["matches"]:
        lines.append(f"- **{mit['label']}** ({mit['detail']})")
    lines.append("Reply with the full name and I'll pull the details.")
    return "\n".join(lines)


def format_not_found(kind: str, res: Dict[str, Any]) -> str:
    base = f"I couldn't find any {kind} matching *\"{res['candidate']}\"* in the system."
    if res.get("suggestions"):
        base += " Did you mean: " + ", ".join(f"**{s}**" for s in res["suggestions"]) + "?"
    else:
        base += " Check the spelling, or ask me to list them."
    return base
