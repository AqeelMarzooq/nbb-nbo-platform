"""
Feature engineering for the NBB NBO model.
Transforms raw client fields into ML-ready features.
"""
import pandas as pd
import numpy as np
from typing import Union

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


def tenure_band(years: float) -> int:
    if years < 2:
        return 0
    elif years < 5:
        return 1
    elif years < 10:
        return 2
    else:
        return 3


def revenue_tier(revenue: float) -> int:
    """SME=0, Mid-Corp=1, Large Corp=2"""
    if revenue < 1_000_000:
        return 0
    elif revenue < 10_000_000:
        return 1
    else:
        return 2


def balance_tier(balance: float) -> int:
    if balance < 50_000:
        return 0
    elif balance < 250_000:
        return 1
    elif balance < 1_000_000:
        return 2
    else:
        return 3


def parse_existing_products(existing_str: Union[str, float, None]) -> list[str]:
    if pd.isna(existing_str) or not existing_str:
        return []
    return [p.strip() for p in str(existing_str).split(",") if p.strip()]


def product_gap_score(existing_str: Union[str, float, None]) -> int:
    existing = parse_existing_products(existing_str)
    return len(PRODUCTS) - len(set(existing) & set(PRODUCTS))


def product_flags(existing_str: Union[str, float, None]) -> dict[str, int]:
    existing = set(parse_existing_products(existing_str))
    return {f"has_{i}": int(PRODUCTS[i] in existing) for i in range(len(PRODUCTS))}


def days_since_last_transaction(date_str: Union[str, float, None]) -> int:
    if pd.isna(date_str) or not date_str:
        return 999
    try:
        dt = pd.to_datetime(date_str)
        delta = pd.Timestamp.now() - dt
        return max(0, delta.days)
    except Exception:
        return 999


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a raw client dataframe and returns an ML-ready feature dataframe.
    All original columns are preserved; engineered features are appended.
    """
    out = df.copy()

    # Numeric safety
    out["annual_revenue_bhd"] = pd.to_numeric(out["annual_revenue_bhd"], errors="coerce").fillna(0)
    out["years_with_nbb"] = pd.to_numeric(out["years_with_nbb"], errors="coerce").fillna(0)
    out["avg_monthly_balance_bhd"] = pd.to_numeric(out["avg_monthly_balance_bhd"], errors="coerce").fillna(0)
    out["fx_volume_bhd"] = pd.to_numeric(out["fx_volume_bhd"], errors="coerce").fillna(0)
    out["loan_outstanding_bhd"] = pd.to_numeric(out["loan_outstanding_bhd"], errors="coerce").fillna(0)

    # Derived
    out["tenure_band"] = out["years_with_nbb"].apply(tenure_band)
    out["revenue_tier"] = out["annual_revenue_bhd"].apply(revenue_tier)
    out["balance_tier"] = out["avg_monthly_balance_bhd"].apply(balance_tier)
    out["fx_flag"] = (out["fx_volume_bhd"] > 0).astype(int)
    out["trade_finance_flag"] = (out["trade_finance_usage"].str.lower().str.strip() == "yes").astype(int)
    out["product_gap_score"] = out["existing_products"].apply(product_gap_score)
    out["days_since_last_tx"] = out["last_transaction_date"].apply(days_since_last_transaction)
    out["loan_flag"] = (out["loan_outstanding_bhd"] > 0).astype(int)
    out["log_revenue"] = np.log1p(out["annual_revenue_bhd"])
    out["log_balance"] = np.log1p(out["avg_monthly_balance_bhd"])
    out["log_fx_volume"] = np.log1p(out["fx_volume_bhd"])
    out["log_loan"] = np.log1p(out["loan_outstanding_bhd"])

    # Industry one-hot
    for sector in INDUSTRY_SECTORS:
        col = "industry_" + sector.lower().replace(" ", "_").replace("&", "and").replace("/", "_")
        out[col] = (out["industry_sector"] == sector).astype(int)

    # Per-product flags
    product_flag_df = out["existing_products"].apply(
        lambda x: pd.Series(product_flags(x))
    )
    out = pd.concat([out, product_flag_df], axis=1)

    return out


FEATURE_COLS = [
    "tenure_band", "revenue_tier", "balance_tier",
    "fx_flag", "trade_finance_flag", "product_gap_score",
    "days_since_last_tx", "loan_flag",
    "log_revenue", "log_balance", "log_fx_volume", "log_loan",
] + [
    "industry_" + s.lower().replace(" ", "_").replace("&", "and").replace("/", "_")
    for s in INDUSTRY_SECTORS
] + [f"has_{i}" for i in range(len(PRODUCTS))]
