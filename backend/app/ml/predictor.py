import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

# Ensure backend directory is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.db.session import SessionLocal, engine
from app.db.models import Load, Carrier, Driver, Prediction
from app.schemas.logistics import PredictionOut, SHAPFactor

ARTIFACTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "artifacts"))
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "model.joblib")
EXPLAINER_PATH = os.path.join(ARTIFACTS_DIR, "explainer.joblib")
COLUMNS_PATH = os.path.join(ARTIFACTS_DIR, "feature_columns.json")
METRICS_PATH = os.path.join(ARTIFACTS_DIR, "benchmark_metrics.json")

_model = None
_explainer = None
_feature_columns = None
_model_version = "unversioned-model"


def _load_artifacts():
    global _model, _explainer, _feature_columns, _model_version
    if _model is None or _explainer is None:
        if not os.path.exists(MODEL_PATH) or not os.path.exists(EXPLAINER_PATH):
            from app.ml.train import train_models
            train_models()
        
        _model = joblib.load(MODEL_PATH)
        _explainer = joblib.load(EXPLAINER_PATH)
        with open(COLUMNS_PATH, "r") as f:
            _feature_columns = json.load(f)
        if os.path.exists(METRICS_PATH):
            with open(METRICS_PATH, "r") as f:
                metrics = json.load(f)
            best_model = metrics.get("best_model", "model").lower().replace(" ", "-")
            _model_version = f"{best_model}-v1.0"


def _feature_display_name(feature_name: str, value: float) -> str:
    """Format feature name and value into clear dispatcher English."""
    if feature_name == "pickup_delay_minutes":
        return f"Origin Pickup Delay ({int(value)} mins)"
    elif feature_name == "distance_miles":
        return f"Route Distance ({int(value)} miles)"
    elif feature_name == "carrier_late_rate":
        return f"Carrier Historical Delay Rate ({value*100:.1f}%)"
    elif feature_name == "scheduled_transit_hours":
        return f"Scheduled Transit Window ({value:.1f} hrs)"
    elif feature_name == "driver_safety_score":
        return f"Driver Safety Rating ({value:.1f}/100)"
    elif feature_name == "driver_experience":
        return f"Driver Experience ({int(value)} yrs)"
    elif feature_name == "is_long_haul":
        return "Long-Haul Interstate Corridor"
    elif feature_name == "rate_per_mile":
        return f"Rate/Mile (${value:.2f})"
    elif feature_name.startswith("type_"):
        return f"Equipment Type ({feature_name.replace('type_', '')})"
    else:
        return feature_name.replace("_", " ").title()


def predict_for_load(load_id: int, db: Optional[Session] = None) -> PredictionOut:
    """
    Run late delivery prediction and SHAP explanation for a specific load.
    """
    _load_artifacts()
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        load = db.query(Load).filter(Load.id == load_id).first()
        if not load:
            raise ValueError(f"Load with ID {load_id} not found.")

        carrier = db.query(Carrier).filter(Carrier.id == load.carrier_id).first() if load.carrier_id else None
        driver = db.query(Driver).filter(Driver.id == load.driver_id).first() if load.driver_id else None

        # Build feature vector matching training columns
        feat_dict = {col: 0.0 for col in _feature_columns}
        
        feat_dict["distance_miles"] = float(load.distance_miles)
        feat_dict["scheduled_transit_hours"] = float(
            (load.delivery_datetime - load.pickup_datetime).total_seconds() / 3600.0
        )
        
        # Pickup delay
        if load.actual_pickup_datetime and load.actual_pickup_datetime > load.pickup_datetime:
            delay_mins = (load.actual_pickup_datetime - load.pickup_datetime).total_seconds() / 60.0
        else:
            delay_mins = 0.0
        feat_dict["pickup_delay_minutes"] = float(max(0.0, delay_mins))

        carrier_rating = carrier.rating if carrier else 4.2
        feat_dict["carrier_late_rate"] = float((5.0 - carrier_rating) * 0.15 + 0.05)
        feat_dict["carrier_fleet_size"] = float(carrier.fleet_size if carrier else 25)
        feat_dict["driver_experience"] = float(driver.experience_years if driver else 3)
        feat_dict["driver_safety_score"] = float(driver.safety_score if driver else 90.0)
        feat_dict["is_long_haul"] = 1.0 if load.distance_miles > 800 else 0.0
        feat_dict["pickup_day_of_week"] = float(load.pickup_datetime.weekday())
        feat_dict["rate_per_mile"] = float(load.rate_per_mile)

        # Load type dummy
        type_key = f"type_{load.load_type}"
        if type_key in feat_dict:
            feat_dict[type_key] = 1.0

        # Construct dataframe
        X_input = pd.DataFrame([feat_dict])[_feature_columns]

        # Predict probability
        probs = _model.predict_proba(X_input)[0]
        late_prob = float(probs[1])

        # Risk categorization
        if late_prob >= 0.65:
            risk_level = "HIGH"
        elif late_prob >= 0.30:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # Calculate SHAP values
        shap_values = _explainer.shap_values(X_input)
        if isinstance(shap_values, list):
            # Binary classification list of arrays [class 0, class 1]
            raw_shap = shap_values[1][0]
        elif len(shap_values.shape) == 3:
            raw_shap = shap_values[0, :, 1]
        else:
            raw_shap = shap_values[0]

        factors = []
        for feat_name, shap_val, feat_val in zip(_feature_columns, raw_shap, X_input.iloc[0]):
            direction = "increases_risk" if shap_val > 0 else "decreases_risk"
            readable_name = _feature_display_name(feat_name, feat_val)
            impact_desc = (
                f"{readable_name} adds +{abs(shap_val):.2f} risk score"
                if shap_val > 0
                else f"{readable_name} reduces delay risk by -{abs(shap_val):.2f}"
            )
            factors.append(SHAPFactor(
                factor_name=readable_name,
                importance_value=float(abs(shap_val)),
                impact_description=impact_desc,
                direction=direction
            ))

        # Sort top 3 factors by absolute SHAP importance
        top_factors = sorted(factors, key=lambda f: f.importance_value, reverse=True)[:3]

        return PredictionOut(
            load_id=load.id,
            load_number=load.load_number,
            late_probability=round(late_prob, 3),
            risk_level=risk_level,
            confidence_score=round(max(probs), 3),
            top_contributing_factors=top_factors,
            model_version=_model_version
        )
    finally:
        if should_close:
            db.close()
