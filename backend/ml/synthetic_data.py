"""
Synthetic NBB corporate banking data generator.
Produces realistic rows for training the NBO XGBoost model.
"""
import random
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

PRODUCTS = [
    "Corporate Current Accounts",
    "Trade Finance – Letters of Credit (LC)",
    "Trade Finance – Bank Guarantees",
    "Trade Finance – Documentary Collections",
    "Corporate Term Loans",
    "Syndicated Loans",
    "Working Capital Finance",
    "Foreign Exchange (FX) Solutions – Spot, Forward, Swap",
    "Cash Management & Liquidity Solutions",
    "Corporate Overdraft Facilities",
    "Investment Products – Fixed Deposits (BHD & USD)",
    "Treasury Bills & Bonds",
    "Corporate Credit Cards",
    "Payroll Management Services (WPS – Wage Protection System)",
    "Internet Banking – Corporate (NBB Direct)",
]

INDUSTRY_SECTORS = [
    "Oil & Gas",
    "Construction",
    "Real Estate",
    "Manufacturing",
    "Retail & Wholesale Trade",
    "Hospitality & Tourism",
    "Healthcare",
    "Financial Services",
    "Information Technology",
    "Logistics & Transportation",
    "Education",
    "Government & Public Sector",
    "Telecommunications",
    "Food & Beverage",
    "Engineering & Contracting",
]

RELATIONSHIP_MANAGERS = [
    "Ahmed Al-Khalifa",
    "Sara Al-Mannai",
    "Khalid Al-Zayani",
    "Fatima Al-Dosari",
    "Mohammed Al-Rumaihi",
    "Noura Al-Saffar",
    "Yousif Al-Qassim",
    "Maryam Al-Shaikh",
]

CLIENT_PREFIXES = [
    "Al-Baraka", "Gulf", "NBB", "Arabian", "Bahrain", "Delta",
    "Falcon", "Crescent", "Horizon", "Khaleeji", "Manama",
    "Pearl", "Riffa", "Al-Areen", "Durrat",
]

CLIENT_SUFFIXES = [
    "Holdings", "Group", "Industries", "Trading", "Enterprises",
    "Solutions", "International", "Company", "Contracting", "Investment",
]


def _random_client_name() -> str:
    return f"{random.choice(CLIENT_PREFIXES)} {random.choice(CLIENT_SUFFIXES)}"


def _random_date_within(days: int) -> str:
    dt = datetime.now() - timedelta(days=random.randint(1, days))
    return dt.strftime("%Y-%m-%d")


def _product_gap_logic(
    annual_revenue: float,
    existing: list[str],
    industry: str,
    fx_volume: float,
    loan_outstanding: float,
    trade_finance_usage: str,
) -> str:
    """
    Heuristic-based label assignment to produce realistic training targets.
    """
    existing_set = set(existing)
    candidate_scores: dict[str, float] = {}

    for p in PRODUCTS:
        if p in existing_set:
            continue  # skip products already held
        score = 0.0

        if p == "Corporate Current Accounts":
            score = 0.3

        elif p == "Trade Finance – Letters of Credit (LC)":
            if trade_finance_usage == "yes":
                score += 0.6
            if industry in ("Oil & Gas", "Manufacturing", "Logistics & Transportation", "Retail & Wholesale Trade"):
                score += 0.4
            if annual_revenue > 1_000_000:
                score += 0.2

        elif p == "Trade Finance – Bank Guarantees":
            if industry in ("Construction", "Engineering & Contracting", "Government & Public Sector"):
                score += 0.7
            if annual_revenue > 500_000:
                score += 0.2

        elif p == "Trade Finance – Documentary Collections":
            if trade_finance_usage == "yes":
                score += 0.4
            if industry in ("Retail & Wholesale Trade", "Manufacturing"):
                score += 0.3

        elif p == "Corporate Term Loans":
            if loan_outstanding == 0 and annual_revenue > 500_000:
                score += 0.6
            if industry in ("Real Estate", "Construction", "Manufacturing"):
                score += 0.3

        elif p == "Syndicated Loans":
            if annual_revenue > 10_000_000:
                score += 0.8
            if industry in ("Real Estate", "Oil & Gas", "Hospitality & Tourism"):
                score += 0.3

        elif p == "Working Capital Finance":
            if annual_revenue < 5_000_000:
                score += 0.5
            if industry in ("Retail & Wholesale Trade", "Food & Beverage", "Manufacturing"):
                score += 0.3

        elif p == "Foreign Exchange (FX) Solutions – Spot, Forward, Swap":
            if fx_volume > 0:
                score += 0.7
            if industry in ("Oil & Gas", "Logistics & Transportation", "Financial Services"):
                score += 0.3

        elif p == "Cash Management & Liquidity Solutions":
            if annual_revenue > 2_000_000:
                score += 0.5
            if industry in ("Government & Public Sector", "Financial Services", "Telecommunications"):
                score += 0.3

        elif p == "Corporate Overdraft Facilities":
            if loan_outstanding == 0:
                score += 0.4
            if annual_revenue < 2_000_000:
                score += 0.3

        elif p == "Investment Products – Fixed Deposits (BHD & USD)":
            if annual_revenue > 3_000_000:
                score += 0.5
            if industry in ("Financial Services", "Government & Public Sector"):
                score += 0.3

        elif p == "Treasury Bills & Bonds":
            if annual_revenue > 5_000_000:
                score += 0.5
            if industry in ("Financial Services", "Government & Public Sector"):
                score += 0.4

        elif p == "Corporate Credit Cards":
            score += 0.3
            if industry in ("Hospitality & Tourism", "Retail & Wholesale Trade"):
                score += 0.3

        elif p == "Payroll Management Services (WPS – Wage Protection System)":
            score += 0.3
            if industry in ("Construction", "Manufacturing", "Hospitality & Tourism"):
                score += 0.3

        elif p == "Internet Banking – Corporate (NBB Direct)":
            score += 0.4

        # Add noise
        score += random.uniform(-0.1, 0.1)
        candidate_scores[p] = max(0, score)

    if not candidate_scores:
        return random.choice(PRODUCTS)

    # Pick product with highest heuristic score (with some randomness)
    top = sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)[:3]
    weights = [s for _, s in top]
    total = sum(weights)
    if total == 0:
        return top[0][0]
    weights = [w / total for w in weights]
    return random.choices([p for p, _ in top], weights=weights, k=1)[0]


def generate_synthetic_data(n: int = 700, seed: int = 42) -> pd.DataFrame:
    random.seed(seed)
    np.random.seed(seed)

    rows = []
    for i in range(1, n + 1):
        industry = random.choice(INDUSTRY_SECTORS)
        annual_revenue = round(random.lognormvariate(14.5, 1.2), 2)  # BHD, log-normal
        annual_revenue = min(max(annual_revenue, 50_000), 200_000_000)

        years_with_nbb = round(random.uniform(0.5, 25), 1)
        avg_monthly_balance = round(annual_revenue * random.uniform(0.03, 0.25), 2)
        fx_volume = round(annual_revenue * random.uniform(0, 0.4) if random.random() > 0.3 else 0, 2)
        trade_finance_usage = "yes" if random.random() < 0.45 else "no"
        loan_outstanding = round(annual_revenue * random.uniform(0, 1.5) if random.random() > 0.4 else 0, 2)
        rm = random.choice(RELATIONSHIP_MANAGERS)
        last_tx = _random_date_within(90)

        # Assign 1-5 existing products
        n_existing = random.randint(1, 6)
        existing = random.sample(PRODUCTS, n_existing)

        label = _product_gap_logic(
            annual_revenue, existing, industry, fx_volume, loan_outstanding, trade_finance_usage
        )

        rows.append({
            "client_id": f"NBB-CORP-{i:04d}",
            "client_name": _random_client_name(),
            "industry_sector": industry,
            "annual_revenue_bhd": annual_revenue,
            "years_with_nbb": years_with_nbb,
            "existing_products": ",".join(existing),
            "last_transaction_date": last_tx,
            "avg_monthly_balance_bhd": avg_monthly_balance,
            "fx_volume_bhd": fx_volume,
            "trade_finance_usage": trade_finance_usage,
            "loan_outstanding_bhd": loan_outstanding,
            "relationship_manager": rm,
            "actual_product_taken": label,
        })

    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = generate_synthetic_data(700)
    df.to_csv("synthetic_training_data.csv", index=False)
    print(f"Generated {len(df)} rows. Label distribution:")
    print(df["actual_product_taken"].value_counts())
