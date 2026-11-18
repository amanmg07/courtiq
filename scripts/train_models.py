"""
CourtIQ ML training pipeline.

Trains, for each of 3 targets (points, rebounds, assists):
  - linear_single:   Linear Regression on one feature (L10 avg) -- baseline
  - linear_multi:    Multiple Linear Regression on the full feature set
  - random_forest:   Random Forest, hyperparameter-tuned
  - gradient_boosting: XGBoost if available, else sklearn's
                     HistGradientBoostingRegressor (functionally the same
                     family -- histogram-based gradient boosting) -- also tuned

TIME-BASED SPLIT (not random): trains on seasons 2021-22..2024-25, tests on
2025-26..2026-27. Every test-set game is chronologically after every
training-set game. Hyperparameter search uses TimeSeriesSplit on the
TRAINING set only (never random K-fold) -- so even model SELECTION doesn't
peek at a future game relative to what it's validated against; the held-out
test set is touched exactly once, for final reporting.

Saves, per target, the model with the lowest test-set MAE to
ml/models/{target}_model.joblib, plus ml/models/metrics.json with the full
head-to-head comparison (used by the backend to report real, measured
accuracy alongside each prediction -- never a fabricated number).

Usage (from project root):
    PYTHONPATH=backend .venv/bin/python scripts/train_models.py
"""
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.db.session import engine
from ml.common import FEATURE_COLUMNS, BOOLEAN_FEATURE_COLUMNS, TARGETS, TRAIN_SEASONS, TEST_SEASONS, MODELS_DIR_NAME

MODELS_DIR = PROJECT_ROOT / MODELS_DIR_NAME

try:
    from xgboost import XGBRegressor
    BOOSTING_IMPL = "xgboost"
except Exception as e:  # ImportError, or the libomp runtime-load error on macOS
    BOOSTING_IMPL = "hist_gradient_boosting"
    print(f"xgboost unavailable ({e.__class__.__name__}), using sklearn HistGradientBoostingRegressor instead")


def load_data() -> pd.DataFrame:
    non_bool = [c for c in FEATURE_COLUMNS if c not in BOOLEAN_FEATURE_COLUMNS]
    bool_cols = ", ".join(f"f.{c}" for c in BOOLEAN_FEATURE_COLUMNS)
    non_bool_cols = ", ".join(f"f.{c}" for c in non_bool)
    query = f"""
        SELECT s.season, s.game_date, s.pts, s.reb, s.ast, {bool_cols}, {non_bool_cols}
        FROM player_game_stats s
        JOIN player_game_features f ON s.game_id = f.game_id AND s.player_id = f.player_id
    """
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
    for c in BOOLEAN_FEATURE_COLUMNS:
        df[c] = df[c].astype(int)
    return df.sort_values(["game_date"]).reset_index(drop=True)


def build_candidate(kind: str, columns: list[str]):
    """Returns (pipeline, param_distributions | None). A None distribution
    means "fit as-is, no search" (the linear baselines)."""
    if kind == "random_forest":
        # n_jobs=1 here deliberately: RandomizedSearchCV below already
        # parallelizes across its 24 fits with n_jobs=-1. Parallelizing BOTH
        # the search and each individual forest oversubscribes the CPU
        # (outer workers each spawning their own inner thread pool) and was
        # dramatically slower in practice than single-threading the inner fit.
        pipe = Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("reg", RandomForestRegressor(random_state=42, n_jobs=1)),
        ])
        params = {
            "reg__n_estimators": [100, 150, 200, 250],
            "reg__max_depth": [6, 8, 10, 12, 14],
            "reg__min_samples_leaf": [2, 5, 10, 20],
            "reg__max_features": ["sqrt", 0.5, 0.7],
        }
        return pipe, params

    if kind == "gradient_boosting":
        if BOOSTING_IMPL == "xgboost":
            pipe = Pipeline([
                ("impute", SimpleImputer(strategy="median")),
                ("reg", XGBRegressor(random_state=42, n_jobs=1, tree_method="hist")),  # see random_forest's n_jobs=1 comment above
            ])
            params = {
                "reg__n_estimators": [100, 150, 200, 300],
                "reg__max_depth": [3, 4, 5, 6],
                "reg__learning_rate": [0.03, 0.05, 0.1, 0.15],
                "reg__subsample": [0.7, 0.85, 1.0],
                "reg__colsample_bytree": [0.7, 0.85, 1.0],
                "reg__reg_lambda": [0.5, 1.0, 2.0],
            }
        else:
            pipe = Pipeline([
                ("impute", SimpleImputer(strategy="median")),
                ("reg", HistGradientBoostingRegressor(random_state=42)),
            ])
            params = {
                "reg__max_iter": [100, 150, 200, 300],
                "reg__max_depth": [3, 4, 5, 6, None],
                "reg__learning_rate": [0.03, 0.05, 0.1, 0.15],
                "reg__l2_regularization": [0.0, 0.5, 1.0, 2.0],
                "reg__max_leaf_nodes": [15, 31, 63],
            }
        return pipe, params

    # linear_single / linear_multi -- no tuning (OLS has no real hyperparameters here)
    pipe = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
        ("reg", LinearRegression()),
    ])
    return pipe, None


def fit_candidate(pipe, params, X_train, y_train):
    if params is None:
        pipe.fit(X_train, y_train)
        return pipe
    search = RandomizedSearchCV(
        pipe, params, n_iter=8, cv=TimeSeriesSplit(n_splits=3),
        scoring="neg_mean_absolute_error", random_state=42, n_jobs=-1,
    )
    search.fit(X_train, y_train)
    return search.best_estimator_


def evaluate(model, X_test, y_test) -> dict:
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
    print(f"  boosting implementation: {BOOSTING_IMPL}")
    assert train_df["game_date"].max() < test_df["game_date"].min(), "train/test overlap in time -- leakage!"

    results: dict[str, dict] = {}
    feature_importances: dict[str, dict] = {}

    for target in TARGETS:
        print(f"\n2/4 training models for target='{target}'...")
        y_train, y_test = train_df[target], test_df[target]

        candidate_specs = {
            "linear_single": [f"{target}_l10_avg"],
            "linear_multi": FEATURE_COLUMNS,
            "random_forest": FEATURE_COLUMNS,
            "gradient_boosting": FEATURE_COLUMNS,
        }

        target_results = {}
        fitted = {}
        for name, cols in candidate_specs.items():
            t0 = time.time()
            pipe, params = build_candidate(name, cols)
            fitted_pipe = fit_candidate(pipe, params, train_df[cols], y_train)
            metrics = evaluate(fitted_pipe, test_df[cols], y_test)
            elapsed = time.time() - t0
            target_results[name] = {**metrics, "features": cols, "seconds": round(elapsed, 1)}
            fitted[name] = fitted_pipe
            tuned_note = "(tuned)" if params is not None else ""
            print(f"  {name:18s} {tuned_note:8s} MAE={metrics['mae']:.3f}  RMSE={metrics['rmse']:.3f}  R2={metrics['r2']:.3f}  [{elapsed:.1f}s]")

        best_name = min(target_results, key=lambda n: target_results[n]["mae"])
        target_results["best_model"] = best_name
        results[target] = target_results
        print(f"  -> best for {target}: {best_name}")

        best_pipe = fitted[best_name]
        joblib.dump(
            {"pipeline": best_pipe, "features": candidate_specs[best_name], "model_type": best_name},
            MODELS_DIR / f"{target}_model.joblib",
        )

        rf = fitted["random_forest"].named_steps["reg"]
        feature_importances[target] = dict(
            sorted(zip(FEATURE_COLUMNS, rf.feature_importances_.tolist()), key=lambda kv: -kv[1])
        )

    print("\n3/4 writing metrics.json...")
    metrics_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "boosting_implementation": BOOSTING_IMPL,
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
