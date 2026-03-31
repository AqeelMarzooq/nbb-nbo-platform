"""
NBB NBO Platform — FastAPI entrypoint.
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import engine, Base
from db.models import Product  # noqa: F401 (ensures table is created)
from routers import predict, retrain, reports
from ml.model import get_model_info, load_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

NBB_PRODUCTS = [
    ("Corporate Current Accounts", "Accounts"),
    ("Trade Finance – Letters of Credit (LC)", "Trade Finance"),
    ("Trade Finance – Bank Guarantees", "Trade Finance"),
    ("Trade Finance – Documentary Collections", "Trade Finance"),
    ("Corporate Term Loans", "Lending"),
    ("Syndicated Loans", "Lending"),
    ("Working Capital Finance", "Lending"),
    ("Foreign Exchange (FX) Solutions – Spot, Forward, Swap", "FX & Treasury"),
    ("Cash Management & Liquidity Solutions", "Cash Management"),
    ("Corporate Overdraft Facilities", "Lending"),
    ("Investment Products – Fixed Deposits (BHD & USD)", "Investments"),
    ("Treasury Bills & Bonds", "Investments"),
    ("Corporate Credit Cards", "Cards"),
    ("Payroll Management Services (WPS – Wage Protection System)", "Payroll"),
    ("Internet Banking – Corporate (NBB Direct)", "Digital Banking"),
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up NBB NBO Platform …")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified.")

    # Seed product catalogue if empty
    from db.database import SessionLocal
    from db.models import Product as ProductModel
    db = SessionLocal()
    try:
        if db.query(ProductModel).count() == 0:
            for name, category in NBB_PRODUCTS:
                db.add(ProductModel(name=name, category=category, is_enabled=True))
            db.commit()
            logger.info("Seeded %d NBB products.", len(NBB_PRODUCTS))
    finally:
        db.close()

    # Pre-load / bootstrap ML model
    try:
        info = get_model_info()
        if info.get("status") == "untrained":
            logger.info("No model found — bootstrapping with synthetic data …")
            load_model()
        else:
            logger.info("Model loaded: version=%s accuracy=%.4f", info.get("version"), info.get("accuracy", 0))
    except Exception as e:
        logger.warning("Model bootstrap failed (non-fatal): %s", e)

    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="NBB Next Best Offer API",
    description="ML-powered NBO platform for NBB corporate clients",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend
origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router)
app.include_router(retrain.router)
app.include_router(reports.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "NBB NBO API"}


@app.get("/model/info")
def model_info():
    return get_model_info()
