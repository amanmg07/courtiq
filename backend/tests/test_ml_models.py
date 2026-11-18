"""
Tests the artifacts produced by scripts/train_models.py: that models exist,
report sane (not fabricated) metrics, and -- the one that matters most --
that the train/test split is genuinely chronological with zero leakage.

Requires scripts/train_models.py to have been run already (these read the
saved artifacts rather than retraining, to stay fast).
"""
import json
import sys
from pathlib import Path

import joblib
import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
from ml.common import FEATURE_COLUMNS, TARGETS, TRAIN_SEASONS, TEST_SEASONS, MODELS_DIR_NAME  # noqa: E402

MODELS_DIR = PROJECT_ROOT / MODELS_DIR_NAME


@pytest.fixture(scope="module")
def metrics():
    path = MODELS_DIR / "metrics.json"
    if not path.exists():
        pytest.skip("models not trained yet -- run scripts/train_models.py first")
    return json.loads(path.read_text())


def test_train_test_seasons_do_not_overlap():
    assert set(TRAIN_SEASONS).isdisjoint(set(TEST_SEASONS))
    # and genuinely chronological, not just non-overlapping
    assert max(TRAIN_SEASONS) < min(TEST_SEASONS)


def test_schedule_fatigue_features_are_included(metrics):
    """The free-improvements pass added is_back_to_back/home_stand_streak --
    confirm they actually made it into what the models were trained on."""
    assert "is_back_to_back" in metrics["feature_columns"]
    assert "home_stand_streak" in metrics["feature_columns"]


def test_metrics_cover_every_target_and_model_type(metrics):
    for target in TARGETS:
        assert target in metrics["results"]
        for model_type in ("linear_single", "linear_multi", "random_forest", "gradient_boosting"):
            m = metrics["results"][target][model_type]
            assert m["mae"] > 0
            assert m["rmse"] >= m["mae"]  # RMSE >= MAE always holds mathematically
            assert -1 <= m["r2"] <= 1


def test_multi_feature_models_beat_or_match_single_feature_baseline(metrics):
    """Not a hard requirement of a good model, but if adding 20+ engineered
    features does worse than one column, something is likely wrong (leakage
    masking signal, a broken feature, etc.) -- worth a loud failure, not a
    silent bad model shipped to the API."""
    for target in TARGETS:
        baseline_mae = metrics["results"][target]["linear_single"]["mae"]
        best_mae = metrics["results"][target][metrics["results"][target]["best_model"]]["mae"]
        assert best_mae <= baseline_mae * 1.05  # allow tiny noise margin


def test_saved_model_files_load_and_match_feature_columns(metrics):
    for target in TARGETS:
        bundle = joblib.load(MODELS_DIR / f"{target}_model.joblib")
        assert bundle["model_type"] == metrics["results"][target]["best_model"]
        assert set(bundle["features"]).issubset(set(FEATURE_COLUMNS))
        # the pipeline must actually be fitted (predict without error) on a
        # single all-NaN row -- simulates a brand-new player with no history
        import pandas as pd
        row = pd.DataFrame([{c: None for c in bundle["features"]}])
        pred = bundle["pipeline"].predict(row)
        assert pred[0] == pred[0]  # not NaN
