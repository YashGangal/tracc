"""Shared operational statistics helpers (single implementation, many endpoints)."""
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.models import Load


def carrier_weekly_otd(db: Session, carrier_id: int, fallback: float) -> List[float]:
    """Real 7-week OTD history (oldest -> newest) for honest sparklines.
    Empty weeks forward-fill; carriers with no history fall back to overall."""
    ref = db.query(func.max(Load.pickup_datetime)).scalar() or datetime.utcnow()
    weeks: List[Optional[float]] = []
    for w in range(6, -1, -1):
        stop = ref - timedelta(weeks=w)
        start = stop - timedelta(weeks=1)
        delivered = db.query(func.count(Load.id)).filter(
            Load.carrier_id == carrier_id,
            Load.status == "delivered",
            Load.pickup_datetime >= start,
            Load.pickup_datetime < stop,
        ).scalar() or 0
        delayed = db.query(func.count(Load.id)).filter(
            Load.carrier_id == carrier_id,
            Load.status == "delayed",
            Load.pickup_datetime >= start,
            Load.pickup_datetime < stop,
        ).scalar() or 0
        denom = delivered + delayed
        weeks.append(round(delivered / denom * 100, 1) if denom else None)
    filled: List[float] = []
    last = fallback
    for v in weeks:
        if v is not None:
            last = v
        filled.append(last)
    return filled
