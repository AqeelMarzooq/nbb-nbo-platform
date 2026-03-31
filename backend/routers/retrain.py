"""
/retrain router — upload labelled CSV, retrain XGBoost, stream progress.
"""
import io
import asyncio
import logging
from typing import AsyncGenerator, Any

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import ModelVersion
from ml.model import train_model
from ml.synthetic_data import generate_synthetic_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/retrain", tags=["Retrain"])

REQUIRED_TRAIN_COLS = {
    "client_id", "industry_sector", "annual_revenue_bhd", "years_with_nbb",
    "existing_products", "last_transaction_date", "avg_monthly_balance_bhd",
    "fx_volume_bhd", "trade_finance_usage", "loan_outstanding_bhd",
    "actual_product_taken",
}


def _read_upload(file: UploadFile) -> pd.DataFrame:
    contents = file.file.read()
    if file.filename and file.filename.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(contents))
    return pd.read_csv(io.BytesIO(contents))


def _save_model_version(metrics: dict, meta: dict, db: Session) -> None:
    # Deactivate all previous versions
    db.query(ModelVersion).update({"is_active": False})
    mv = ModelVersion(
        version=meta["version"],
        accuracy=metrics["accuracy"],
        f1_macro=metrics.get("f1_macro"),
        precision_macro=metrics.get("precision_macro"),
        recall_macro=metrics.get("recall_macro"),
        n_samples=meta.get("n_samples"),
        metrics_json=metrics,
        is_active=True,
    )
    db.add(mv)
    db.commit()


@router.post("/")
async def retrain(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> Any:
    df = _read_upload(file)
    missing = REQUIRED_TRAIN_COLS - set(df.columns)
    if missing:
        raise HTTPException(422, detail=f"Missing columns: {sorted(missing)}")

    result = train_model(df)
    try:
        _save_model_version(result["metrics"], result["meta"], db)
    except Exception as e:
        logger.warning("Failed to persist model version: %s", e)

    return result


@router.post("/synthetic")
async def retrain_on_synthetic(db: Session = Depends(get_db)) -> Any:
    """Bootstrap / reset model with synthetic NBB corporate data."""
    df = generate_synthetic_data(700)
    result = train_model(df)
    try:
        _save_model_version(result["metrics"], result["meta"], db)
    except Exception as e:
        logger.warning("Failed to persist model version: %s", e)
    return result


async def _progress_stream(df: pd.DataFrame, db: Session) -> AsyncGenerator[str, None]:
    """SSE generator — yields text/event-stream messages."""
    yield "data: {\"step\": \"Starting retraining...\", \"pct\": 5}\n\n"
    await asyncio.sleep(0.3)

    yield "data: {\"step\": \"Engineering features...\", \"pct\": 20}\n\n"
    await asyncio.sleep(0.3)

    yield "data: {\"step\": \"Splitting train/test...\", \"pct\": 35}\n\n"
    await asyncio.sleep(0.3)

    yield "data: {\"step\": \"Training XGBoost model...\", \"pct\": 50}\n\n"
    await asyncio.sleep(0.2)

    result = train_model(df)

    yield "data: {\"step\": \"Evaluating model...\", \"pct\": 80}\n\n"
    await asyncio.sleep(0.2)

    try:
        _save_model_version(result["metrics"], result["meta"], db)
    except Exception as e:
        logger.warning("DB persist failed: %s", e)

    yield "data: {\"step\": \"Saving model artefacts...\", \"pct\": 95}\n\n"
    await asyncio.sleep(0.1)

    import json
    payload = json.dumps({"step": "Done", "pct": 100, "result": result})
    yield f"data: {payload}\n\n"


@router.post("/stream")
async def retrain_stream(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """SSE endpoint — streams retraining progress as text/event-stream."""
    df = _read_upload(file)
    missing = REQUIRED_TRAIN_COLS - set(df.columns)
    if missing:
        raise HTTPException(422, detail=f"Missing columns: {sorted(missing)}")

    return StreamingResponse(
        _progress_stream(df, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
