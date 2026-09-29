import json
import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Load, Prediction
from app.ml.predictor import predict_for_load, METRICS_PATH
from app.schemas.logistics import PredictionOut
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/predictions", tags=["ML Predictions"], dependencies=[Depends(get_current_user)])


@router.get("/benchmark")
def get_benchmark() -> dict:
    """Return the held-out model benchmark (best model + per-model metrics)."""
    if not os.path.exists(METRICS_PATH):
        raise HTTPException(status_code=404, detail="Benchmark metrics not available")
    with open(METRICS_PATH, "r") as f:
        return json.load(f)


def _persist_prediction(db: Session, pred: PredictionOut) -> None:
    """Persist latest prediction so the predictions table stays populated for audit.

    Keeps only the 10 most recent rows per load to bound table growth.
    """
    try:
        row = Prediction(
            load_id=pred.load_id,
            model_version=pred.model_version,
            late_probability=pred.late_probability,
            risk_level=pred.risk_level,
            factor_json=json.dumps([f.model_dump() for f in pred.top_contributing_factors]),
        )
        db.add(row)
        db.flush()
        stale_ids = [
            r[0]
            for r in db.query(Prediction.id)
            .filter(Prediction.load_id == pred.load_id)
            .order_by(Prediction.id.desc())
            .offset(10)
            .all()
        ]
        if stale_ids:
            db.query(Prediction).filter(Prediction.id.in_(stale_ids)).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()


@router.get("/load/{load_id}", response_model=PredictionOut)
def get_prediction(load_id: int, db: Session = Depends(get_db)):
    try:
        prediction = predict_for_load(load_id, db=db)
        _persist_prediction(db, prediction)
        return prediction
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {e}")


@router.get("/batch/high-risk", response_model=List[PredictionOut])
def get_high_risk_predictions(limit: int = Query(12, ge=1, le=20), db: Session = Depends(get_db)):
    """
    Return the highest-risk loads by scanning active/delayed loads.
    Delayed loads are included as confirmed high-risk; pending/in_transit
    loads are scored by the ML delay-risk model. Falls back to a random
    sample of all loads so the page is never empty.
    Scan is bounded (15 delayed + 15 active) since each load costs
    several queries plus a SHAP explanation.
    """
    # Priority 1: delayed loads (confirmed late — always high-risk)
    delayed_loads = db.query(Load).filter(
        Load.status == "delayed"
    ).order_by(Load.pickup_datetime.desc()).limit(15).all()

    # Priority 2: active pipeline loads
    active_loads = db.query(Load).filter(
        Load.status.in_(["in_transit", "pending"])
    ).order_by(Load.pickup_datetime.desc()).limit(15).all()

    # Combine, deduplicating by id
    all_loads = {l.id: l for l in delayed_loads + active_loads}.values()

    predictions = []
    for l in all_loads:
        try:
            pred = predict_for_load(l.id, db=db)
            predictions.append(pred)
        except Exception:
            continue

    # Sort highest risk probability first
    predictions.sort(key=lambda p: p.late_probability, reverse=True)
    top = predictions[:limit]

    # Fallback: if we somehow still have nothing, sample any 12 loads
    if not top:
        sample_loads = db.query(Load).order_by(Load.id).limit(30).all()
        for l in sample_loads:
            try:
                pred = predict_for_load(l.id, db=db)
                top.append(pred)
                if len(top) >= limit:
                    break
            except Exception:
                continue
        top.sort(key=lambda p: p.late_probability, reverse=True)

    return top
