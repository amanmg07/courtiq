"""
CourtIQ feature engineering pipeline.

Reads player_game_stats from Postgres and computes PlayerGameFeature rows:
rolling L5/L10 averages, season-to-date averages, home/away splits, an
opponent defensive proxy, and historical matchup averages.

LEAKAGE RULE: every *_avg / *_allowed_avg / matchup_* value for a given row is
computed using ONLY games with an earlier game_date (ties broken by game_id)
than that row's own game. This is enforced with pandas `.shift(1)` + expanding/
rolling windows grouped per player (or per opponent, for the defensive proxy)
BEFORE the current row is included -- never on a window that includes the
game being predicted.

Usage (from project root, after ingest_data.py):
    PYTHONPATH=backend .venv/bin/python scripts/build_features.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pandas as pd
from sqlalchemy import text

from app.db.session import engine
from app.db.models import PlayerGameFeature


def shifted_rolling_mean(s: pd.Series, window: int | None) -> pd.Series:
    """Mean of the PRIOR `window` games (or all prior games if window=None),
    for a series already sorted by date within one group."""
    shifted = s.shift(1)
    if window is None:
        return shifted.expanding(min_periods=1).mean()
    return shifted.rolling(window=window, min_periods=1).mean()


def build_player_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["player_id", "game_date", "game_id"]).reset_index(drop=True)
    g = df.groupby("player_id", group_keys=False)

    out = pd.DataFrame(index=df.index)
    out["game_id"] = df["game_id"]
    out["player_id"] = df["player_id"]
    out["game_date"] = df["game_date"]
    out["season"] = df["season"]
    out["is_home"] = df["is_home"]

    out["games_played_career_to_date"] = g.cumcount()
    out["days_rest"] = g["game_date"].diff().dt.days - 1

    for stat, col in [("pts", "pts"), ("reb", "reb"), ("ast", "ast"), ("minutes", "min")]:
        out[f"{col}_l5_avg"] = g[stat].apply(lambda s: shifted_rolling_mean(s, 5))
        out[f"{col}_l10_avg"] = g[stat].apply(lambda s: shifted_rolling_mean(s, 10))
        out[f"{col}_season_avg"] = (
            df.groupby(["player_id", "season"], group_keys=False)[stat].apply(
                lambda s: shifted_rolling_mean(s, None)
            )
        )

    # home/away season-to-date splits: expanding mean of pts, computed
    # separately within each (player, season, is_home) group, prior games only
    out["pts_home_avg"] = pd.Series(index=df.index, dtype=float)
    out["pts_away_avg"] = pd.Series(index=df.index, dtype=float)
    for is_home_val, col in [(True, "pts_home_avg"), (False, "pts_away_avg")]:
        mask = df["is_home"] == is_home_val
        sub = df.loc[mask].groupby(["player_id", "season"], group_keys=False)["pts"]
        out.loc[mask, col] = sub.apply(lambda s: shifted_rolling_mean(s, None))
        # forward-fill within player+season so away games still carry the
        # most recent home avg available (and vice versa), without peeking ahead
        out[col] = out.groupby([df["player_id"], df["season"]])[col].ffill()

    return out


def build_opponent_defense_features(df: pd.DataFrame) -> pd.DataFrame:
    """For each (opponent_abbr, season), the average pts/reb/ast the opponent
    has ALLOWED in games strictly before this one -- a simple defense proxy."""
    df = df.sort_values(["opponent_abbr", "game_date", "game_id"]).reset_index(drop=True)
    out = pd.DataFrame(index=df.index)
    out["game_id"] = df["game_id"]
    out["player_id"] = df["player_id"]

    g = df.groupby(["opponent_abbr", "season"], group_keys=False)
    out["opp_pts_allowed_avg"] = g["pts"].apply(lambda s: shifted_rolling_mean(s, None))
    out["opp_reb_allowed_avg"] = g["reb"].apply(lambda s: shifted_rolling_mean(s, None))
    out["opp_ast_allowed_avg"] = g["ast"].apply(lambda s: shifted_rolling_mean(s, None))
    return out


def build_matchup_features(df: pd.DataFrame) -> pd.DataFrame:
    """Each player's career average vs this exact opponent, prior meetings only
    (spans seasons -- a player's history vs. an opponent is relevant beyond
    just the current season)."""
    df = df.sort_values(["player_id", "opponent_abbr", "game_date", "game_id"]).reset_index(drop=True)
    out = pd.DataFrame(index=df.index)
    out["game_id"] = df["game_id"]
    out["player_id"] = df["player_id"]

    g = df.groupby(["player_id", "opponent_abbr"], group_keys=False)
    out["matchup_pts_avg"] = g["pts"].apply(lambda s: shifted_rolling_mean(s, None))
    out["matchup_reb_avg"] = g["reb"].apply(lambda s: shifted_rolling_mean(s, None))
    out["matchup_ast_avg"] = g["ast"].apply(lambda s: shifted_rolling_mean(s, None))
    out["matchup_games_played"] = g.cumcount()
    return out


def main():
    print("1/4 loading player_game_stats from Postgres...")
    with engine.connect() as conn:
        df = pd.read_sql(
            "SELECT game_id, player_id, game_date, season, opponent_abbr, is_home, "
            "minutes, pts, reb, ast FROM player_game_stats",
            conn,
        )
    df["game_date"] = pd.to_datetime(df["game_date"])
    print(f"  {len(df)} rows")

    print("2/4 computing player rolling/season/home-away features...")
    player_feats = build_player_features(df)

    print("3/4 computing opponent-defense and matchup features...")
    opp_feats = build_opponent_defense_features(df)
    matchup_feats = build_matchup_features(df)

    print("4/4 merging and loading player_game_features...")
    merged = (
        player_feats
        .merge(opp_feats, on=["game_id", "player_id"], how="left")
        .merge(matchup_feats, on=["game_id", "player_id"], how="left")
    )
    merged["game_date"] = merged["game_date"].dt.date

    cols = [c.name for c in PlayerGameFeature.__table__.columns if c.name != "id"]
    merged = merged[cols]
    # NaN -> None for real SQL NULL (e.g. days_rest/averages on a player's first
    # game). Must cast to object dtype FIRST: assigning None into a float64/int64
    # column silently reverts to NaN again (pandas can't hold None in a numeric
    # dtype column) -- that bug let NaN reach Postgres, which stores it silently
    # in FLOAT columns but raises "integer out of range" when CAST to INTEGER.
    records = merged.astype(object).where(pd.notnull(merged), None).to_dict(orient="records")

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE player_game_features RESTART IDENTITY"))
        chunk = 5000
        for i in range(0, len(records), chunk):
            conn.execute(PlayerGameFeature.__table__.insert(), records[i : i + chunk])
            print(f"  inserted {min(i + chunk, len(records))}/{len(records)} feature rows")

    print("Done.")


if __name__ == "__main__":
    main()
