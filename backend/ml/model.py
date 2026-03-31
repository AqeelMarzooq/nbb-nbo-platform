"""
NBB NBO XGBoost model: train, persist, predict, evaluate.
"""
import os
import json
import pickle
import logging
from pathlib import Path
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)
from xgboost import XGBClassifier

from ml.features import engineer_features, FEATURE_COLS, PRODUCTS
from ml.synthetic_data import generate_synthetic_data

logger = logging.getLogger(__name__)

MODEL_DIR = Path(os.environ.get("MODEL_DIR", "/app/models"))
MODEL_PATH = MODEL_DIR / "nbo_model.pkl"
ENCODER_PATH = MODEL_DIR / "label_encoder.pkl"
META_PATH = MODEL_DIR / "model_meta.json"


def _ensure_model_dir() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)


def train_model(df: pd.DataFrame) -> dict[str, Any]:
    """Train XGBoost on a labelled dataframe. Returns metrics dict."""
    _ensure_model_dir()

    feat_df = engineer_features(df)
    available_cols = [c for c in FEATURE_COLS if c in feat_df.columns]

    X = feat_df[available_cols].fillna(0).values
    y_raw = df["actual_product_taken"].values

    le = LabelEncoder()
    le.fit(PRODUCTS)  # fit on all known products so classes are stable
    y = le.transform(y_raw)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    y_pred = model.predict(X_test)

    # Per-class metrics
    labels = list(range(len(le.classes_)))
    per_class_precision = precision_score(y_test, y_pred, labels=labels, average=None, zero_division=0)
    per_class_recall = recall_score(y_test, y_pred, labels=labels, average=None, zero_division=0)
    per_class_f1 = f1_score(y_test, y_pred, labels=labels, average=None, zero_division=0)

    per_class = {}
    for idx, cls in enumerate(le.classes_):
        per_class[cls] = {
            "precision": round(float(per_class_precision[idx]), 4),
            "recall": round(float(per_class_recall[idx]), 4),
            "f1": round(float(per_class_f1[idx]), 4),
        }

    cm = confusion_matrix(y_test, y_pred, labels=labels)

    # Feature importance
    importances = model.feature_importances_
    feat_imp = sorted(
        zip(available_cols, importances.tolist()),
        key=lambda x: x[1],
        reverse=True,
    )[:10]

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision_macro": round(float(precision_score(y_test, y_pred, average="macro", zero_division=0)), 4),
        "recall_macro": round(float(recall_score(y_test, y_pred, average="macro", zero_division=0)), 4),
        "f1_macro": round(float(f1_score(y_test, y_pred, average="macro", zero_division=0)), 4),
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
        "confusion_matrix_labels": le.classes_.tolist(),
        "feature_importance": [{"feature": f, "importance": round(i, 6)} for f, i in feat_imp],
        "train_samples": len(X_train),
        "test_samples": len(X_test),
    }

    # Persist
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": model, "feature_cols": available_cols}, f)
    with open(ENCODER_PATH, "wb") as f:
        pickle.dump(le, f)

    version = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    meta = {
        "version": version,
        "trained_at": datetime.utcnow().isoformat(),
        "accuracy": metrics["accuracy"],
        "n_samples": len(df),
        "feature_cols": available_cols,
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    logger.info("Model trained. Version=%s Accuracy=%.4f", version, metrics["accuracy"])
    return {"metrics": metrics, "meta": meta}


def load_model() -> tuple[XGBClassifier, LabelEncoder, list[str]]:
    if not MODEL_PATH.exists():
        logger.info("No model found — bootstrapping with synthetic data …")
        df = generate_synthetic_data(700)
        train_model(df)

    with open(MODEL_PATH, "rb") as f:
        payload = pickle.load(f)
    with open(ENCODER_PATH, "rb") as f:
        le = pickle.load(f)

    return payload["model"], le, payload["feature_cols"]


def predict(df: pd.DataFrame) -> pd.DataFrame:
    """Run predictions on a client dataframe. Returns df with new columns."""
    model, le, feature_cols = load_model()
    feat_df = engineer_features(df)
    available = [c for c in feature_cols if c in feat_df.columns]
    X = feat_df[available].fillna(0).values

    proba = model.predict_proba(X)
    top3_idx = np.argsort(proba, axis=1)[:, -3:][:, ::-1]

    results = []
    for i, row in enumerate(proba):
        best_idx = top3_idx[i]
        results.append({
            "recommended_product": le.classes_[best_idx[0]],
            "confidence_score": round(float(row[best_idx[0]]) * 100, 2),
            "alternative_offer_1": le.classes_[best_idx[1]],
            "alt1_confidence": round(float(row[best_idx[1]]) * 100, 2),
            "alternative_offer_2": le.classes_[best_idx[2]],
            "alt2_confidence": round(float(row[best_idx[2]]) * 100, 2),
        })

    result_df = pd.DataFrame(results)
    base_cols = [c for c in ["client_id", "client_name", "industry_sector",
                              "annual_revenue_bhd", "relationship_manager"] if c in df.columns]
    return pd.concat([df[base_cols].reset_index(drop=True), result_df], axis=1)


def get_model_info() -> dict[str, Any]:
    if not META_PATH.exists():
        return {"status": "untrained", "message": "No model has been trained yet."}
    with open(META_PATH) as f:
        return json.load(f)
