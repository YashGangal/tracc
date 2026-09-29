"""Shared audit logging for security-sensitive operations."""
import json
from typing import Any, Mapping, Optional

from sqlalchemy.orm import Session

from app.db.models import AuditLog, User


def log_audit_event(
    db: Session,
    action: str,
    entity_type: str,
    actor: Optional[User] = None,
    entity_id: Optional[str | int] = None,
    metadata: Optional[Mapping[str, Any]] = None,
) -> AuditLog:
    event = AuditLog(
        actor_user_id=actor.id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        metadata_json=json.dumps(dict(metadata or {}), default=str),
    )
    db.add(event)
    return event
