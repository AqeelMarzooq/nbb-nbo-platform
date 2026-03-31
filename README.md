# NBB NBO Platform — Next Best Offer for Corporate Banking

ML-powered Next Best Offer (NBO) platform for **National Bank of Bahrain (NBB)** corporate clients.
Built for internal use by Relationship Managers and Analytics teams.

---

## Architecture

```
┌─────────────────────────┐      ┌──────────────────────────┐      ┌─────────────┐
│  Next.js 14 Frontend    │ ───► │  FastAPI Python Backend  │ ───► │  PostgreSQL │
│  (port 3000)            │      │  (port 8000)             │      │  (port 5432)│
│  NextAuth · Recharts    │      │  XGBoost · scikit-learn  │      │  Prisma ORM │
└─────────────────────────┘      └──────────────────────────┘      └─────────────┘
```

---

## Quick Start (Docker Compose)

```bash
# 1. Clone / extract the project
cd nbb-nbo-platform

# 2. Start all services (DB + Backend + Frontend)
docker-compose up --build

# 3. Open the app
open http://localhost:3000
```

The backend auto-bootstraps the XGBoost model with 700 rows of synthetic NBB corporate data on first startup.

---

## Local Development (without Docker)

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 14+ (or use Docker just for DB)

### 1. Start PostgreSQL

```bash
docker run -d \
  --name nbb_db \
  -e POSTGRES_USER=nbb_user \
  -e POSTGRES_PASSWORD=nbb_pass \
  -e POSTGRES_DB=nbb_nbo \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export DATABASE_URL=postgresql://nbb_user:nbb_pass@localhost:5432/nbb_nbo
export MODEL_DIR=./models
export CORS_ORIGINS=http://localhost:3000

uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install

cp .env.local.example .env.local
# Edit .env.local if needed (defaults work for local dev)

# Run Prisma migrations
npx prisma migrate dev --name init
# or for a quick push:
npx prisma db push

npm run dev
```

Open http://localhost:3000

---

## Demo Login Credentials

| Role    | Email              | Password      |
|---------|--------------------|---------------|
| Admin   | admin@nbb.bh       | Admin@123!    |
| RM      | rm@nbb.bh          | RM@123!       |
| Analyst | analyst@nbb.bh     | Analyst@123!  |

---

## Modules

| Module            | Path           | Description                                              |
|-------------------|----------------|----------------------------------------------------------|
| Dashboard         | `/dashboard`   | KPIs, product distribution chart, top scored clients    |
| Client Scoring    | `/scoring`     | Upload CSV → XGBoost predictions → confidence heatmap   |
| Model Retraining  | `/retraining`  | Upload labelled CSV → retrain → metrics + confusion matrix |
| Reporting         | `/reporting`   | Monthly trends, industry pie, RM performance table      |
| Settings          | `/settings`    | Model registry, product toggle, user management         |

---

## API Endpoints

| Method | Endpoint                         | Description                          |
|--------|----------------------------------|--------------------------------------|
| POST   | `/predict/upload`                | Score clients from CSV/Excel file    |
| POST   | `/predict/single`                | Score a single client (JSON body)    |
| GET    | `/predict/export`                | Export latest predictions as CSV     |
| POST   | `/retrain/`                      | Retrain model from labelled CSV      |
| POST   | `/retrain/synthetic`             | Retrain on synthetic NBB data        |
| POST   | `/retrain/stream`                | SSE streaming retrain progress       |
| GET    | `/reports/summary`               | Dashboard KPI data                   |
| GET    | `/reports/monthly`               | Monthly recommendation volume        |
| GET    | `/reports/industry`              | Industry sector breakdown            |
| GET    | `/reports/rm-performance`        | RM performance metrics               |
| GET    | `/reports/model-versions`        | All model versions                   |
| POST   | `/reports/model-versions/{id}/activate` | Set active model version      |
| GET    | `/model/info`                    | Current model version info           |
| GET    | `/health`                        | Health check                         |

---

## ML Model

- **Algorithm**: XGBoost multi-class classifier
- **Target**: `next_best_product` (15 NBB corporate products)
- **Features**: tenure band, revenue tier, balance tier, FX flag, trade finance flag, product gap score, industry one-hot, per-product ownership flags, log-transformed numerics
- **Training data**: 700 synthetic rows generated from realistic NBB corporate banking heuristics
- **Model storage**: persisted as pickle at `MODEL_DIR/nbo_model.pkl`

### NBB Product Universe
1. Corporate Current Accounts
2. Trade Finance – Letters of Credit (LC)
3. Trade Finance – Bank Guarantees
4. Trade Finance – Documentary Collections
5. Corporate Term Loans
6. Syndicated Loans
7. Working Capital Finance
8. Foreign Exchange (FX) Solutions – Spot, Forward, Swap
9. Cash Management & Liquidity Solutions
10. Corporate Overdraft Facilities
11. Investment Products – Fixed Deposits (BHD & USD)
12. Treasury Bills & Bonds
13. Corporate Credit Cards
14. Payroll Management Services (WPS – Wage Protection System)
15. Internet Banking – Corporate (NBB Direct)

---

## CSV Templates

| Template          | Path                              | Use For          |
|-------------------|-----------------------------------|------------------|
| Scoring template  | `samples/scoring_template.csv`    | Client Scoring   |
| Training template | `samples/training_template.csv`   | Model Retraining |

---

## Environment Variables

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<min 32 chars>
DATABASE_URL=postgresql://nbb_user:nbb_pass@localhost:5432/nbb_nbo
```

### Backend
```
DATABASE_URL=postgresql://nbb_user:nbb_pass@localhost:5432/nbb_nbo
MODEL_DIR=./models
CORS_ORIGINS=http://localhost:3000
```

---

## Tech Stack

| Layer      | Technology                                       |
|------------|--------------------------------------------------|
| Frontend   | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui  |
| Charts     | Recharts                                         |
| Auth       | NextAuth v4 (credentials + JWT)                  |
| Backend    | FastAPI, Python 3.11                             |
| ML         | XGBoost, scikit-learn, pandas, numpy             |
| Database   | PostgreSQL 16 + Prisma ORM                       |
| ORM (API)  | SQLAlchemy 2.0                                   |
| Container  | Docker + Docker Compose                          |

---

## Brand Colours (NBB)

| Colour   | Hex       | Usage                    |
|----------|-----------|--------------------------|
| Navy     | `#003366` | Primary, sidebar, buttons |
| Gold     | `#C9A84C` | Accent, active states    |
| White    | `#FFFFFF` | Background               |

---

*Internal platform — National Bank of Bahrain © 2026. Not for public distribution.*
