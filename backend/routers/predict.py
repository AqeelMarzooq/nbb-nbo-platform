"""
/predict router — score one or many corporate clients.
"""
import io
import csv
import json
import logging
from typing import Any

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Client, Prediction, ModelVersion, Product
from ml.model import predict, get_model_info

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predict", tags=["Predict"])

REQUIRED_COLS = {
    "client_id", "client_name", "industry_sector", "annual_revenue_bhd",
    "years_with_nbb", "existing_products", "last_transaction_date",
    "avg_monthly_balance_bhd", "fx_volume_bhd", "trade_finance_usage",
    "loan_outstanding_bhd", "relationship_manager",
}


class SingleClientRequest(BaseModel):
    client_id: str
    client_name: str
    industry_sector: str
    annual_revenue_bhd: float
    years_with_nbb: float
    existing_products: str
    last_transaction_date: str
    avg_monthly_balance_bhd: float
    fx_volume_bhd: float
    trade_finance_usage: str
    loan_outstanding_bhd: float
    relationship_manager: str


def _read_upload(file: UploadFile) -> pd.DataFrame:
    contents = file.file.read()
    if file.filename and file.filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(contents))
    else:
        df = pd.read_csv(io.BytesIO(contents))
    return df


def _validate_cols(df: pd.DataFrame) -> None:
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing columns: {sorted(missing)}",
        )


def _persist_predictions(result_df: pd.DataFrame, raw_df: pd.DataFrame, db: Session) -> None:
    info = get_model_info()
    version = info.get("version", "unknown")

    for _, row in raw_df.iterrows():
        cid = str(row.get("client_id", ""))
        existing = db.query(Client).filter(Client.id == cid).first()
        if not existing:
            client = Client(
                id=cid,
                name=str(row.get("client_name", "")),
                industry_sector=str(row.get("industry_sector", "")),
                annual_revenue_bhd=float(row.get("annual_revenue_bhd", 0) or 0),
                years_with_nbb=float(row.get("years_with_nbb", 0) or 0),
                existing_products=str(row.get("existing_products", "")),
                last_transaction_date=str(row.get("last_transaction_date", "")),
                avg_monthly_balance_bhd=float(row.get("avg_monthly_balance_bhd", 0) or 0),
                fx_volume_bhd=float(row.get("fx_volume_bhd", 0) or 0),
                trade_finance_usage=str(row.get("trade_finance_usage", "no")),
                loan_outstanding_bhd=float(row.get("loan_outstanding_bhd", 0) or 0),
                relationship_manager=str(row.get("relationship_manager", "")),
            )
            db.add(client)

    db.flush()

    for _, row in result_df.iterrows():
        cid = str(row.get("client_id", ""))
        pred = Prediction(
            client_id=cid,
            model_version=version,
            recommended_product=str(row.get("recommended_product", "")),
            confidence_score=float(row.get("confidence_score", 0)),
            alternative_offer_1=str(row.get("alternative_offer_1", "")),
            alt1_confidence=float(row.get("alt1_confidence", 0)),
            alternative_offer_2=str(row.get("alternative_offer_2", "")),
            alt2_confidence=float(row.get("alt2_confidence", 0)),
        )
        db.add(pred)

    db.commit()


def _get_enabled_products(db: Session) -> set[str]:
    """Return set of product names that are enabled. Falls back to all if table is empty."""
    rows = db.query(Product).filter(Product.is_enabled == True).all()
    if not rows:
        return set()   # empty = no filter (all allowed)
    return {r.name for r in rows}


def _filter_to_enabled(result_df: pd.DataFrame, enabled: set[str]) -> pd.DataFrame:
    """
    If the model's top recommendation is disabled, replace it with the best
    enabled alternative from the alt offers (or leave as-is if no alternative).
    """
    if not enabled:
        return result_df  # no filter

    def fix_row(row: pd.Series) -> pd.Series:
        if row["recommended_product"] in enabled:
            return row
        # try alt1
        if row.get("alternative_offer_1") in enabled:
            row["recommended_product"] = row["alternative_offer_1"]
            row["confidence_score"] = row["alt1_confidence"]
            row["alternative_offer_1"] = row.get("alternative_offer_2", "")
            row["alt1_confidence"] = row.get("alt2_confidence", 0)
        # try alt2
        elif row.get("alternative_offer_2") in enabled:
            row["recommended_product"] = row["alternative_offer_2"]
            row["confidence_score"] = row["alt2_confidence"]
        return row

    return result_df.apply(fix_row, axis=1)


@router.get("/products")
def list_products(db: Session = Depends(get_db)) -> Any:
    """List all NBB products with their enabled status."""
    products = db.query(Product).order_by(Product.category, Product.name).all()
    return [{"id": p.id, "name": p.name, "category": p.category, "is_enabled": p.is_enabled} for p in products]


@router.patch("/products/{product_id}/toggle")
def toggle_product(product_id: int, enabled: bool, db: Session = Depends(get_db)) -> Any:
    """Enable or disable a product from the recommendation universe."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    product.is_enabled = enabled
    db.commit()
    return {"id": product.id, "name": product.name, "is_enabled": product.is_enabled}


@router.post("/upload")
async def predict_from_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> Any:
    df = _read_upload(file)
    _validate_cols(df)
    result = predict(df)
    # Enforce product enable/disable settings
    enabled = _get_enabled_products(db)
    result = _filter_to_enabled(result, enabled)
    try:
        _persist_predictions(result, df, db)
    except Exception as e:
        logger.warning("Failed to persist predictions: %s", e)
    return {"count": len(result), "predictions": result.to_dict(orient="records")}


@router.post("/single")
async def predict_single(
    payload: SingleClientRequest,
    db: Session = Depends(get_db),
) -> Any:
    df = pd.DataFrame([payload.model_dump()])
    result = predict(df)
    enabled = _get_enabled_products(db)
    result = _filter_to_enabled(result, enabled)
    try:
        _persist_predictions(result, df, db)
    except Exception as e:
        logger.warning("Failed to persist prediction: %s", e)
    return result.to_dict(orient="records")[0]


@router.get("/export")
async def export_latest_predictions(db: Session = Depends(get_db)):
    """Export the most recent batch of predictions as CSV."""
    rows = (
        db.query(Prediction, Client)
        .join(Client, Prediction.client_id == Client.id)
        .order_by(Prediction.scored_at.desc())
        .limit(5000)
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "client_id", "client_name", "industry_sector", "annual_revenue_bhd",
        "relationship_manager", "recommended_product", "confidence_score",
        "alternative_offer_1", "alternative_offer_2", "scored_at",
    ])
    for pred, client in rows:
        writer.writerow([
            client.id, client.name, client.industry_sector,
            client.annual_revenue_bhd, client.relationship_manager,
            pred.recommended_product, pred.confidence_score,
            pred.alternative_offer_1, pred.alternative_offer_2,
            pred.scored_at.isoformat() if pred.scored_at else "",
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=nbo_predictions.csv"},
    )
