"""
Generates evaluation plots from the trained models + metrics.json: actual-vs-
predicted scatter per target (on the real time-based test set) and a feature
importance chart for the Random Forest models. Run after scripts/train_models.py.

Usage (from project root):
    PYTHONPATH=backend .venv/bin/python ml/evaluation/plots.py
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import joblib
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

from app.db.session import engine
from ml.common import FEATURE_COLUMNS, BOOLEAN_FEATURE_COLUMNS, TARGETS, TEST_SEASONS, MODELS_DIR_NAME

MODELS_DIR = PROJECT_ROOT / MODELS_DIR_NAME
PLOTS_DIR = PROJECT_ROOT / "docs" / "ml_plots"

sns.set_theme(style="darkgrid", rc={"figure.facecolor": "#1a1a19", "axes.facecolor": "#1a1a19",
                                     "savefig.facecolor": "#1a1a19", "text.color": "#ffffff",
                                     "axes.labelcolor": "#ffffff", "xtick.color": "#c3c2b7",
                                     "ytick.color": "#c3c2b7", "axes.edgecolor": "#383835",
                                     "grid.color": "#2c2c2a"})
SERIES_COLOR = "#3987e5"


def load_test_data() -> pd.DataFrame:
    bool_cols = ", ".join(f"f.{c}" for c in BOOLEAN_FEATURE_COLUMNS)
    non_bool_cols = ", ".join(f"f.{c}" for c in FEATURE_COLUMNS if c not in BOOLEAN_FEATURE_COLUMNS)
    query = f"""
        SELECT s.season, s.pts, s.reb, s.ast, {bool_cols}, {non_bool_cols}
        FROM player_game_stats s
        JOIN player_game_features f ON s.game_id = f.game_id AND s.player_id = f.player_id
        WHERE s.season = ANY(%(seasons)s)
    """
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"seasons": TEST_SEASONS})
    for c in BOOLEAN_FEATURE_COLUMNS:
        df[c] = df[c].astype(int)
    return df


def main():
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    test_df = load_test_data()

    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    for ax, target in zip(axes, TARGETS):
        bundle = joblib.load(MODELS_DIR / f"{target}_model.joblib")
        pipe, cols, model_type = bundle["pipeline"], bundle["features"], bundle["model_type"]
        y_true = test_df[target]
        y_pred = pipe.predict(test_df[cols])

        ax.scatter(y_true, y_pred, alpha=0.08, s=8, color=SERIES_COLOR, edgecolors="none")
        lims = [0, max(y_true.max(), y_pred.max())]
        ax.plot(lims, lims, color="#e66767", linewidth=1.5, linestyle="--", label="Perfect prediction")
        ax.set_xlabel(f"Actual {target.upper()}")
        ax.set_ylabel(f"Predicted {target.upper()}")
        ax.set_title(f"{target.upper()} -- {model_type} (test: {TEST_SEASONS[0]}+{TEST_SEASONS[1]})")
        ax.legend(fontsize=8, facecolor="#222221", labelcolor="#ffffff")
    fig.tight_layout()
    fig.savefig(PLOTS_DIR / "actual_vs_predicted.png", dpi=130)
    plt.close(fig)
    print(f"saved {PLOTS_DIR / 'actual_vs_predicted.png'}")

    # Random Forest feature importances are computed for every target during
    # training (see scripts/train_models.py), independent of whether RF
    # happens to be the WINNING model for that target -- so read them from
    # metrics.json rather than assuming the saved pts_model.joblib is an RF.
    import json
    with open(MODELS_DIR / "metrics.json") as f:
        metrics = json.load(f)
    pts_importances = metrics.get("feature_importances_random_forest", {}).get("pts")
    if pts_importances:
        importances = pd.Series(pts_importances).sort_values()
        fig, ax = plt.subplots(figsize=(8, 7))
        importances.plot.barh(ax=ax, color=SERIES_COLOR)
        ax.set_xlabel("Feature importance")
        ax.set_title("Random Forest feature importances -- points model")
        fig.tight_layout()
        fig.savefig(PLOTS_DIR / "pts_feature_importance.png", dpi=130)
        plt.close(fig)
        print(f"saved {PLOTS_DIR / 'pts_feature_importance.png'}")


if __name__ == "__main__":
    main()
