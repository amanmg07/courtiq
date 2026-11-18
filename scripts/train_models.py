"""
CourtIQ ML training pipeline.

Trains 3 model types (single-feature Linear Regression, Multiple Linear
Regression, Random Forest Regression) for each of 3 targets (points,
rebounds, assists) = 9 models, using the leakage-safe features already
computed in player_game_features (scripts/build_features.py).

TIME-BASED SPLIT (not random): trains on seasons 2021-22..2024-25, tests on
2025-26..2026-27. Every test-set game is chronologically after every
training-set game -- the standard a real forecaster must meet, and the one
explicitly required by the project spec.

Saves, per target, the model with the lowest test-set MAE to
ml/models/{target}_model.joblib, plus ml/models/metrics.json with the full
head-to-head comparison (used by the backend to report real, measured
accuracy alongside each prediction -- never a fabricated number).

Usage (from project root):
    PYTHONPATH=backend .venv/bin/python scripts/train_models.py
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.db.session import engine
from ml.common import FEATURE_COLUMNS, TARGETS, TRAIN_SEASONS, TEST_SEASONS, MODELS_DIR_NAME

MODELS_DIR = PROJECT_ROOT / MODELS_DIR_NAME


def load_data() -> pd.DataFrame:
    cols = ", ".join(f"f.{c}" for c in FEATURE_COLUMNS if c != "is_home")
    query = f"""
        SELECT s.season, s.game_date, s.pts, s.reb, s.ast,
               f.is_home, {cols}
        FROM player_game_stats s
        JOIN player_game_features f ON s.game_id = f.game_id AND s.player_id = f.player_id
    """
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
    df["is_home"] = df["is_home"].astype(int)
    return df


def build_pipeline(kind: str, columns: list[str]) -> tuple[Pipeline, list[str]]:
    if kind == "random_forest":
        pipe = Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("reg", RandomForestRegressor(n_estimators=200, max_depth=12, min_samples_leaf=5, random_state=42, n_jobs=-1)),
        ])
    else:  # linear_single or linear_multi -- same pipeline shape, different column set
        pipe = Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
            ("reg", LinearRegression()),
        ])
    return pipe, columns


def evaluate(model: Pipeline, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    preds = model.predict(X_test)
    return {
        "mae": float(mean_absolute_error(y_test, preds)),
        "rmse": float(np.sqrt(mean_squared_error(y_test, preds))),
        "r2": float(r2_score(y_test, preds)),
    }


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    print("1/4 loading data from Postgres...")
    df = load_data()
    train_df = df[df["season"].isin(TRAIN_SEASONS)].copy()
    test_df = df[df["season"].isin(TEST_SEASONS)].copy()
    print(f"  train: {len(train_df)} rows ({TRAIN_SEASONS[0]}..{TRAIN_SEASONS[-1]})")
    print(f"  test:  {len(test_df)} rows ({TEST_SEASONS[0]}..{TEST_SEASONS[-1]})")
    assert train_df["game_date"].max() < test_df["game_date"].min(), "train/test overlap in time -- leakage!"

    results: dict[str, dict] = {}
    feature_importances: dict[str, dict] = {}

    for target in TARGETS:
        print(f"\n2/4 training models for target='{target}'...")
        y_train, y_test = train_df[target], test_df[target]

        candidates = {
            "linear_single": (build_pipeline("linear_single", [f"{target}_l10_avg"])),
            "linear_multi": (build_pipeline("linear_multi", FEATURE_COLUMNS)),
            "random_forest": (build_pipeline("random_forest", FEATURE_COLUMNS)),
        }

        target_results = {}
        fitted = {}
        for name, (pipe, cols) in candidates.items():
            pipe.fit(train_df[cols], y_train)
            metrics = evaluate(pipe, test_df[cols], y_test)
            target_results[name] = {**metrics, "features": cols}
            fitted[name] = pipe
            print(f"  {name:15s} MAE={metrics['mae']:.3f}  RMSE={metrics['rmse']:.3f}  R2={metrics['r2']:.3f}")

        best_name = min(target_results, key=lambda n: target_results[n]["mae"])
        target_results["best_model"] = best_name
        results[target] = target_results
        print(f"  -> best for {target}: {best_name}")

        best_pipe = fitted[best_name]
        joblib.dump({"pipeline": best_pipe, "features": candidates[best_name][1], "model_type": best_name},
                    MODELS_DIR / f"{target}_model.joblib")

        if best_name == "random_forest" or "random_forest" in fitted:
            rf = fitted["random_forest"].named_steps["reg"]
            feature_importances[target] = dict(
                sorted(zip(FEATURE_COLUMNS, rf.feature_importances_.tolist()), key=lambda kv: -kv[1])
            )

    print("\n3/4 writing metrics.json...")
    metrics_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "train_seasons": TRAIN_SEASONS,
        "test_seasons": TEST_SEASONS,
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "feature_columns": FEATURE_COLUMNS,
        "results": results,
        "feature_importances_random_forest": feature_importances,
    }
    with open(MODELS_DIR / "metrics.json", "w") as f:
        json.dump(metrics_payload, f, indent=2)

    print("\n4/4 summary:")
    for target in TARGETS:
        best = results[target]["best_model"]
        m = results[target][best]
        print(f"  {target}: best={best}  MAE={m['mae']:.3f}  RMSE={m['rmse']:.3f}  R2={m['r2']:.3f}")
    print(f"\nModels saved to {MODELS_DIR}/")


if __name__ == "__main__":
    main()
