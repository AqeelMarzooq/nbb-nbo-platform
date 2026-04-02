"""
/reports router — aggregated stats for the reporting module.
"""
import os
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, Integer, cast, Date

from db.database import get_db, DATABASE_URL
from db.models import Prediction, Client, ModelVersion

# SQLite uses strftime, PostgreSQL uses to_char
_IS_SQLITE = DATABASE_URL.startswith("sqlite")


def _month_expr(col):  # type: ignore[no-untyped-def]
    if _IS_SQLITE:
        return func.strftime("%Y-%m", col)
    return func.to_char(col, "YYYY-MM")

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)) -> Any:
    total_clients = db.query(func.count(Client.id.distinct())).scalar() or 0
    total_predictions = db.query(func.count(Prediction.id)).scalar() or 0

    active_mv = db.query(ModelVersion).filter(ModelVersion.is_active == True).first()
    model_accuracy = round(active_mv.accuracy * 100, 2) if active_mv else None
    last_retrain = active_mv.trained_at.strftime("%Y-%m-%d %H:%M") if active_mv else "Never"

    # Top product today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    today_preds = (
        db.query(Prediction.recommended_product, func.count(Prediction.id).label("cnt"))
        .filter(Prediction.scored_at >= today_start, Prediction.scored_at < tomorrow_start)
        .group_by(Prediction.recommended_product)
        .order_by(func.count(Prediction.id).desc())
        .first()
    )
    top_product_today = today_preds[0] if today_preds else "N/A"

    # Product distribution
    dist = (
        db.query(Prediction.recommended_product, func.count(Prediction.id).label("count"))
        .group_by(Prediction.recommended_product)
        .all()
    )
    product_distribution = [{"product": r[0], "count": r[1]} for r in dist]

    # Top 10 recent clients with predictions
    recent = (
        db.query(Prediction, Client)
        .join(Client, Prediction.client_id == Client.id)
        .order_by(Prediction.scored_at.desc())
        .limit(10)
        .all()
    )
    top_clients = [
        {
            "client_id": c.id,
            "client_name": c.name,
            "industry_sector": c.industry_sector,
            "relationship_manager": c.relationship_manager,
            "recommended_product": p.recommended_product,
            "confidence_score": p.confidence_score,
            "scored_at": p.scored_at.isoformat() if p.scored_at else None,
        }
        for p, c in recent
    ]

    return {
        "total_clients_scored": total_clients,
        "total_predictions": total_predictions,
        "top_product_today": top_product_today,
        "model_accuracy_pct": model_accuracy,
        "last_retrain_date": last_retrain,
        "product_distribution": product_distribution,
        "top_clients": top_clients,
    }


@router.get("/monthly")
def monthly_recommendations(
    months: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
) -> Any:
    """Monthly recommendation volume by product (last N months)."""
    since = datetime.utcnow() - timedelta(days=months * 30)
    rows = (
        db.query(
            _month_expr(Prediction.scored_at).label("month"),
            Prediction.recommended_product,
            func.count(Prediction.id).label("count"),
        )
        .filter(Prediction.scored_at >= since)
        .group_by("month", Prediction.recommended_product)
        .order_by("month")
        .all()
    )

    monthly: dict[str, dict[str, int]] = defaultdict(dict)
    products: set[str] = set()
    for month, product, count in rows:
        monthly[month][product] = count
        products.add(product)

    return {
        "months": sorted(monthly.keys()),
        "products": sorted(products),
        "data": {m: dict(v) for m, v in monthly.items()},
    }


@router.get("/industry")
def industry_breakdown(db: Session = Depends(get_db)) -> Any:
    """Industry sector distribution of recommendations."""
    rows = (
        db.query(Client.industry_sector, func.count(Prediction.id).label("count"))
        .join(Prediction, Prediction.client_id == Client.id)
        .group_by(Client.industry_sector)
        .all()
    )
    return [{"sector": r[0], "count": r[1]} for r in rows]


@router.get("/rm-performance")
def rm_performance(db: Session = Depends(get_db)) -> Any:
    """RM performance: clients scored, top product recommended."""
    rows = (
        db.query(
            Client.relationship_manager,
            func.count(Prediction.id.distinct()).label("clients_scored"),
            Prediction.recommended_product,
            func.count(Prediction.id).label("product_count"),
        )
        .join(Prediction, Prediction.client_id == Client.id)
        .group_by(Client.relationship_manager, Prediction.recommended_product)
        .all()
    )

    rm_map: dict[str, dict] = {}
    for rm, clients_scored, product, product_count in rows:
        if rm not in rm_map:
            rm_map[rm] = {"rm": rm, "clients_scored": clients_scored, "top_product": product, "top_count": product_count}
        elif product_count > rm_map[rm]["top_count"]:
            rm_map[rm]["top_product"] = product
            rm_map[rm]["top_count"] = product_count

    return list(rm_map.values())


@router.get("/model-versions")
def get_model_versions(db: Session = Depends(get_db)) -> Any:
    versions = db.query(ModelVersion).order_by(ModelVersion.trained_at.desc()).all()
    return [
        {
            "id": v.id,
            "version": v.version,
            "trained_at": v.trained_at.isoformat() if v.trained_at else None,
            "accuracy": v.accuracy,
            "f1_macro": v.f1_macro,
            "n_samples": v.n_samples,
            "is_active": v.is_active,
        }
        for v in versions
    ]


@router.get("/acceptance-rate")
def acceptance_rate_by_product(db: Session = Depends(get_db)) -> Any:
    """
    Acceptance rate per recommended product.
    Only includes predictions that have received feedback (accepted is not null).
    """
    rows = (
        db.query(
            Prediction.recommended_product,
            func.count(Prediction.id).label("total_feedback"),
            func.sum(
                func.cast(Prediction.accepted == True, Integer)
            ).label("accepted_count"),
        )
        .filter(Prediction.accepted.isnot(None))
        .group_by(Prediction.recommended_product)
        .all()
    )

    result = []
    for product, total, accepted in rows:
        accepted = accepted or 0
        rate = round((accepted / total) * 100, 1) if total > 0 else 0.0
        result.append({
            "product": product,
            "total_feedback": total,
            "accepted": accepted,
            "rejected": total - accepted,
            "acceptance_rate": rate,
        })

    return sorted(result, key=lambda x: x["acceptance_rate"], reverse=True)


@router.post("/predictions/{prediction_id}/feedback")
def submit_feedback(
    prediction_id: int,
    accepted: bool,
    db: Session = Depends(get_db),
) -> Any:
    """Submit acceptance feedback for a prediction."""
    pred = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not pred:
        from fastapi import HTTPException
        raise HTTPException(404, "Prediction not found")
    pred.accepted = accepted
    db.commit()
    return {"prediction_id": prediction_id, "accepted": accepted}


@router.post("/model-versions/{version_id}/activate")
def activate_model_version(version_id: int, db: Session = Depends(get_db)) -> Any:
    db.query(ModelVersion).update({"is_active": False})
    mv = db.query(ModelVersion).filter(ModelVersion.id == version_id).first()
    if not mv:
        from fastapi import HTTPException
        raise HTTPException(404, "Model version not found")
    mv.is_active = True
    db.commit()
    return {"activated": mv.version}
