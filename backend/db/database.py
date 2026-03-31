import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite:///./nbb_nbo_dev.db",   # SQLite for local dev; Neon/Postgres in production
)

# SQLite — local dev (no SSL, no pool)
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

# PostgreSQL / Neon — production
# Neon connection strings contain ?sslmode=require which SQLAlchemy handles natively.
# We also set pool_pre_ping so stale connections are recycled (important for Neon's
# serverless compute that pauses idle branches).
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args={
            "sslmode": "require",          # Neon requires SSL
            "connect_timeout": 10,
        } if "sslmode" not in DATABASE_URL else {},   # avoid duplicate if already in URL
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
