"""
SQLAlchemy ORM models for NBB NBO platform.
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime,
    Text, ForeignKey, JSON,
)
from sqlalchemy.orm import relationship
from db.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(String(64), primary_key=True)           # e.g. NBB-CORP-0001
    name = Column(String(256), nullable=False)
    industry_sector = Column(String(128))
    annual_revenue_bhd = Column(Float)
    years_with_nbb = Column(Float)
    existing_products = Column(Text)                    # comma-separated
    last_transaction_date = Column(String(32))
    avg_monthly_balance_bhd = Column(Float)
    fx_volume_bhd = Column(Float)
    trade_finance_usage = Column(String(8))
    loan_outstanding_bhd = Column(Float)
    relationship_manager = Column(String(128))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    predictions = relationship("Prediction", back_populates="client", cascade="all, delete-orphan")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(String(64), ForeignKey("clients.id"), nullable=False)
    model_version = Column(String(32))
    recommended_product = Column(String(256))
    confidence_score = Column(Float)
    alternative_offer_1 = Column(String(256))
    alt1_confidence = Column(Float)
    alternative_offer_2 = Column(String(256))
    alt2_confidence = Column(Float)
    accepted = Column(Boolean, nullable=True)           # feedback: did client take the offer?
    scored_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="predictions")


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(String(32), unique=True, nullable=False)
    trained_at = Column(DateTime, default=datetime.utcnow)
    accuracy = Column(Float)
    f1_macro = Column(Float)
    precision_macro = Column(Float)
    recall_macro = Column(Float)
    n_samples = Column(Integer)
    metrics_json = Column(JSON)
    is_active = Column(Boolean, default=False)
    notes = Column(Text)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(256), unique=True, nullable=False)
    is_enabled = Column(Boolean, default=True)
    category = Column(String(128))
    description = Column(Text)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(256), unique=True, nullable=False)
    name = Column(String(256))
    role = Column(String(32), default="RM")            # Admin | RM | Analyst
    hashed_password = Column(String(512))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
