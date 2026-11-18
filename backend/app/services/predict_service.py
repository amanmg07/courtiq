"""
Predictive statistics service.

Loads the models trained by scripts/train_models.py (one per target: pts,
reb, ast -- whichever model type won on the real, time-based held-out test
set) and serves inference. The MAE returned alongside each prediction is the
actual measured test-set MAE from ml/models/metrics.json, never a made-up
number.

LIVE FEATURE COMPUTATION: player_game_features (built by
scripts/build_features.py) holds, for each HISTORICAL game, the rolling
stats as of strictly before that game -- correct for training, but not
directly usable for a future, not-yet-played game. This module recomputes
the same feature set "as of right now": every one of a player's games played
to date, including their most recent one, counts toward their current L5/L10/
season averages. The column semantics are identical to training; only the
time anchor (now vs. a past game) differs.

If the model files aren't present (training hasn't been run yet), raises
ModelsNotTrainedError so the API route can return a clear 503 instead of
crashing -- this keeps `uvicorn` startup robust even on a fresh clone.
"""
import datetime
import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sqlalchemy import select, func
from sqlalchemy.orm import Session

PROJECT_ROOT = Path(__file__).resolve().parents[3]  # services/ -> app/ -> backend/ -> project root
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.common import FEATURE_COLUMNS, TARGETS, MODELS_DIR_NAME  # noqa: E402

from app.db.models import Player, PlayerGameStat  # noqa: E402

MODELS_DIR = PROJECT_ROOT / MODELS_DIR_NAME


class ModelsNotTrainedError(Exception):
    pass


class _ModelRegistry:
    """Lazily loads and caches the trained models + metrics, so a missing
    model directory doesn't crash the app at import time -- only the first
    prediction request after a fresh clone (before training) sees the error,
    as a clean 503 rather than a startup crash."""

    def __init__(self):
        self._models: dict | None = None
        self._metrics: dict | None = None

    def _load(self):
        if self._models is not None:
            return
        try:
            models = {}
            for target in TARGETS:
                bundle = joblib.load(MODELS_DIR / f"{target}_model.joblib")
                models[target] = bundle
            with open(MODELS_DIR / "metrics.json") as f:
                metrics = json.load(f)
        except FileNotFoundError as e:
            raise ModelsNotTrainedError(
                "Prediction models have not been trained yet. Run "
                "`python scripts/train_models.py` from the project root, then retry. "
                f"(missing: {e.filename})"
            ) from e
        self._models = models
        self._metrics = metrics

    @property
    def models(self) -> dict:
        self._load()
        return self._models

    @property
    def metrics(self) -> dict:
        self._load()
        return self._metrics


_registry = _ModelRegistry()


def _get_live_features(db: Session, player_id: int, opponent_abbr: str, is_home: bool) -> dict:
    """Computes the same feature set as player_game_features, but anchored
    to "right now" -- i.e. including the player's most recent game, for a
    hypothetical next game that hasn't been played."""
    opponent_abbr = opponent_abbr.upper()

    player = db.get(Player, player_id)
    if player is None:
        raise ValueError(f"Player {player_id} not found")
    current_season = player.last_season

    def agg_row(*conditions):
        stmt = select(
            func.avg(PlayerGameStat.pts).label("pts"),
            func.avg(PlayerGameStat.reb).label("reb"),
            func.avg(PlayerGameStat.ast).label("ast"),
            func.avg(PlayerGameStat.minutes).label("minutes"),
            func.count().label("n"),
        ).where(PlayerGameStat.player_id == player_id, *conditions)
        return db.execute(stmt).one()

    last5 = db.execute(
        select(PlayerGameStat)
        .where(PlayerGameStat.player_id == player_id)
        .order_by(PlayerGameStat.game_date.desc())
        .limit(5)
    ).scalars().all()
    last10 = db.execute(
        select(PlayerGameStat)
        .where(PlayerGameStat.player_id == player_id)
        .order_by(PlayerGameStat.game_date.desc())
        .limit(10)
    ).scalars().all()

    def mean_or_none(rows, attr):
        return sum(getattr(r, attr) for r in rows) / len(rows) if rows else None

    season_row = agg_row(PlayerGameStat.season == current_season)
    home_row = agg_row(PlayerGameStat.season == current_season, PlayerGameStat.is_home.is_(True))
    away_row = agg_row(PlayerGameStat.season == current_season, PlayerGameStat.is_home.is_(False))

    opp_stmt = select(
        func.avg(PlayerGameStat.pts).label("pts"),
        func.avg(PlayerGameStat.reb).label("reb"),
        func.avg(PlayerGameStat.ast).label("ast"),
    ).where(PlayerGameStat.opponent_abbr == opponent_abbr, PlayerGameStat.season == current_season)
    opp_defense = db.execute(opp_stmt).one()

    matchup_stmt = select(
        func.avg(PlayerGameStat.pts).label("pts"),
        func.avg(PlayerGameStat.reb).label("reb"),
        func.avg(PlayerGameStat.ast).label("ast"),
        func.count().label("n"),
    ).where(PlayerGameStat.player_id == player_id, PlayerGameStat.opponent_abbr == opponent_abbr)
    matchup = db.execute(matchup_stmt).one()

    last_game_date = db.scalar(
        select(func.max(PlayerGameStat.game_date)).where(PlayerGameStat.player_id == player_id)
    )
    days_rest = (datetime.date.today() - last_game_date).days - 1 if last_game_date else None
    is_back_to_back = days_rest == 0

    # home_stand_streak "as of now": how many of the player's most recent
    # CONSECUTIVE games already share the requested game's is_home value,
    # counting backward from their last played game and stopping at the
    # first mismatch -- the live-inference analog of the leakage-safe
    # training feature (see scripts/build_features.py's identical definition).
    recent_locations = db.execute(
        select(PlayerGameStat.is_home)
        .where(PlayerGameStat.player_id == player_id)
        .order_by(PlayerGameStat.game_date.desc())
        .limit(20)
    ).scalars().all()
    home_stand_streak = 0
    for loc in recent_locations:
        if loc != is_home:
            break
        home_stand_streak += 1

    return {
        "games_played_career_to_date": player.games_played,
        "days_rest": days_rest,
        "is_home": int(is_home),
        "is_back_to_back": int(is_back_to_back),
        "home_stand_streak": home_stand_streak,
        "pts_l5_avg": mean_or_none(last5, "pts"), "reb_l5_avg": mean_or_none(last5, "reb"),
        "ast_l5_avg": mean_or_none(last5, "ast"), "min_l5_avg": mean_or_none(last5, "minutes"),
        "pts_l10_avg": mean_or_none(last10, "pts"), "reb_l10_avg": mean_or_none(last10, "reb"),
        "ast_l10_avg": mean_or_none(last10, "ast"), "min_l10_avg": mean_or_none(last10, "minutes"),
        "pts_season_avg": season_row.pts, "reb_season_avg": season_row.reb,
        "ast_season_avg": season_row.ast, "min_season_avg": season_row.minutes,
        "pts_home_avg": home_row.pts, "pts_away_avg": away_row.pts,
        "opp_pts_allowed_avg": opp_defense.pts, "opp_reb_allowed_avg": opp_defense.reb,
        "opp_ast_allowed_avg": opp_defense.ast,
        "matchup_pts_avg": matchup.pts, "matchup_reb_avg": matchup.reb, "matchup_ast_avg": matchup.ast,
        "matchup_games_played": matchup.n or 0,
    }, {
        "pts_l10_avg": mean_or_none(last10, "pts"),
        "reb_l10_avg": mean_or_none(last10, "reb"),
        "ast_l10_avg": mean_or_none(last10, "ast"),
        "pts_season_avg": season_row.pts,
        "reb_season_avg": season_row.reb,
        "ast_season_avg": season_row.ast,
    }


def predict(db: Session, player_id: int, opponent_abbr: str, is_home: bool) -> dict:
    models = _registry.models
    metrics = _registry.metrics

    features, context = _get_live_features(db, player_id, opponent_abbr, is_home)
    X = pd.DataFrame([features])[FEATURE_COLUMNS]

    result = {}
    for target in TARGETS:
        bundle = models[target]
        pipe, cols = bundle["pipeline"], bundle["features"]
        predicted = float(pipe.predict(X[cols])[0])
        result[target] = {
            "predicted": max(0.0, predicted),  # a box-score stat can't be negative
            "recent_avg_l10": context[f"{target}_l10_avg"],
            "season_avg": context[f"{target}_season_avg"],
            "mae": metrics["results"][target][bundle["model_type"]]["mae"],
        }

    best_types = {t: models[t]["model_type"] for t in TARGETS}
    result["model_info"] = (
        f"pts: {best_types['pts']}, reb: {best_types['reb']}, ast: {best_types['ast']} "
        f"(selected by lowest MAE on a {metrics['test_seasons'][0]}+{metrics['test_seasons'][1]} "
        f"held-out test set, trained on {metrics['train_seasons'][0]}-{metrics['train_seasons'][-1]})"
    )
    return result
