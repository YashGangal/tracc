import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix
)
import xgboost as xgb
import shap

# Ensure backend directory is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.ml.dataset import extract_features_df

ARTIFACTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "artifacts"))
os.makedirs(ARTIFACTS_DIR, exist_ok=True)


def train_models():
    print("Extracting feature matrix from historical load dispatches...")
    X, y, raw_df = extract_features_df()
    print(f"Total training dataset: {X.shape[0]} records, {X.shape[1]} features. Positive (Late) class ratio: {y.mean():.1%}")

    # Standard train/test split (80/20) with stratification
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42),
        "XGBoost": xgb.XGBClassifier(
            n_estimators=120,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            eval_metric="logloss"
        )
    }

    results = {}
    best_f1 = -1.0
    best_name = None
    best_model = None

    print("\n--- Model Benchmark Results ---")
    for name, model in models.items():
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1]

        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        roc_auc = roc_auc_score(y_test, y_prob)
        pr_auc = average_precision_score(y_test, y_prob)

        print(f"[{name}] Acc: {acc:.4f} | Prec: {prec:.4f} | Recall: {rec:.4f} | F1: {f1:.4f} | ROC-AUC: {roc_auc:.4f} | PR-AUC: {pr_auc:.4f}")

        results[name] = {
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1": float(f1),
            "roc_auc": float(roc_auc),
            "pr_auc": float(pr_auc)
        }

        if f1 > best_f1:
            best_f1 = f1
            best_name = name
            best_model = model

    print(f"\nOptimal Model Selected: {best_name} with F1-Score: {best_f1:.4f}")

    # Retrain best model on full dataset for maximum production accuracy
    print("Fitting production model and SHAP TreeExplainer...")
    best_model.fit(X, y)

    # Initialize SHAP explainer
    if best_name in ["XGBoost", "Random Forest"]:
        explainer = shap.TreeExplainer(best_model)
    else:
        explainer = shap.LinearExplainer(best_model, X)

    # Save artifacts
    model_path = os.path.join(ARTIFACTS_DIR, "model.joblib")
    explainer_path = os.path.join(ARTIFACTS_DIR, "explainer.joblib")
    columns_path = os.path.join(ARTIFACTS_DIR, "feature_columns.json")
    metrics_path = os.path.join(ARTIFACTS_DIR, "benchmark_metrics.json")

    joblib.dump(best_model, model_path)
    joblib.dump(explainer, explainer_path)

    with open(columns_path, "w") as f:
        json.dump(list(X.columns), f)

    with open(metrics_path, "w") as f:
        json.dump({
            "best_model": best_name,
            "benchmark": results,
            "feature_names": list(X.columns)
        }, f, indent=2)

    print(f"[OK] Serialized model and SHAP artifacts to {ARTIFACTS_DIR}")
    return results


if __name__ == "__main__":
    train_models()
