"""
CourtIQ data ingestion pipeline.

Downloads the source dataset (see scripts/_dataset.py), validates/cleans it,
and loads it into Postgres: teams -> players -> games -> player_game_stats.

Idempotent: truncates and reloads the four tables each run, so it's safe to
re-run after schema changes or to pick up newly released games for the
in-progress season. Run `alembic upgrade head` first to create the schema.

Usage (from project root):
    PYTHONPATH=backend .venv/bin/python scripts/ingest_data.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
from sqlalchemy import text

from app.db.session import engine, SessionLocal
from app.db.models import Team, Player, Game, PlayerGameStat
from app.db.seed_data import TEAMS

from _dataset import load_all_seasons


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Validate assumptions and drop any rows that violate them. Every check
    here is logged with a count so silent data loss is never invisible."""
    before = len(df)

    # exact duplicate (game, player) rows
    df = df.drop_duplicates(subset=["game_id", "player_id"])
    dupes = before - len(df)
    if dupes:
        print(f"  dropped {dupes} duplicate (game_id, player_id) rows")

    # structural sanity: makes can't exceed attempts; counts can't be negative
    before2 = len(df)
    valid = (
        (df["fgm"] <= df["fga"])
        & (df["fg3m"] <= df["fg3a"])
        & (df["ftm"] <= df["fta"])
        & (df["minutes"] >= 0)
        & (df[["pts", "reb", "ast"]] >= 0).all(axis=1)
    )
    df = df[valid]
    bad = before2 - len(df)
    if bad:
        print(f"  dropped {bad} rows failing stat sanity checks")

    unknown_teams = set(df["team"]) | set(df["opponent"])
    known_teams = {abbr for abbr, *_ in TEAMS}
    unexpected = unknown_teams - known_teams
    if unexpected:
        # fail loudly rather than silently losing games to a bad FK
        raise ValueError(f"Unrecognized team abbreviations in source data: {unexpected}")

    return df.reset_index(drop=True)


def build_games(df: pd.DataFrame) -> pd.DataFrame:
    home = (
        df[df["home"]]
        .drop_duplicates(subset="game_id")[["game_id", "game_date", "season", "team"]]
        .rename(columns={"team": "home_team_abbr"})
    )
    away = (
        df[~df["home"]]
        .drop_duplicates(subset="game_id")[["game_id", "team"]]
        .rename(columns={"team": "away_team_abbr"})
    )
    games = home.merge(away, on="game_id", how="inner")
    missing = len(df["game_id"].unique()) - len(games)
    if missing:
        print(f"  warning: {missing} game_id(s) missing a clean home/away pair, excluded")
    return games


def build_players(df: pd.DataFrame) -> pd.DataFrame:
    g = df.groupby("player_id")
    players = g.agg(
        full_name=("player_name", "last"),  # most recent row's name spelling
        first_season=("season", "min"),
        last_season=("season", "max"),
        games_played=("game_id", "nunique"),
    ).reset_index()
    return players


def main():
    print("1/6 downloading & combining season files...")
    raw = load_all_seasons()
    print(f"  {len(raw)} raw rows across {raw['season'].nunique()} seasons")

    print("2/6 cleaning...")
    df = clean(raw)
    print(f"  {len(df)} rows after cleaning ({len(raw) - len(df)} dropped)")

    print("3/6 deriving teams/players/games tables...")
    games_df = build_games(df)
    players_df = build_players(df)
    print(f"  {len(games_df)} games, {len(players_df)} players, {len(TEAMS)} teams")

    print("4/6 computing shooting percentages (from makes/attempts, not averaged)...")
    df["fg_pct"] = (df["fgm"] / df["fga"]).where(df["fga"] > 0)
    df["fg3_pct"] = (df["fg3m"] / df["fg3a"]).where(df["fg3a"] > 0)
    df["ft_pct"] = (df["ftm"] / df["fta"]).where(df["fta"] > 0)

    print("5/6 loading into Postgres...")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE player_game_stats, games, players, teams RESTART IDENTITY CASCADE"))

        conn.execute(
            Team.__table__.insert(),
            [{"abbreviation": a, "name": n, "conference": c, "division": d} for a, n, c, d in TEAMS],
        )

        conn.execute(
            Player.__table__.insert(),
            players_df.to_dict(orient="records"),
        )

        conn.execute(
            Game.__table__.insert(),
            games_df[["game_id", "game_date", "season", "home_team_abbr", "away_team_abbr"]].to_dict(
                orient="records"
            ),
        )

        stat_cols = [
            "game_id", "player_id", "game_date", "season", "team", "opponent", "home",
            "minutes", "pts", "reb", "ast", "oreb", "dreb", "stl", "blk", "tov", "pf",
            "plus_minus", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta",
            "fg_pct", "fg3_pct", "ft_pct",
        ]
        stats_df = df[stat_cols].rename(columns={"team": "team_abbr", "opponent": "opponent_abbr", "home": "is_home"})

        records = stats_df.to_dict(orient="records")
        chunk = 5000
        for i in range(0, len(records), chunk):
            conn.execute(PlayerGameStat.__table__.insert(), records[i : i + chunk])
            print(f"  inserted {min(i + chunk, len(records))}/{len(records)} player_game_stats rows")

    print("6/6 verifying...")
    with SessionLocal() as session:
        counts = {
            "teams": session.query(Team).count(),
            "players": session.query(Player).count(),
            "games": session.query(Game).count(),
            "player_game_stats": session.query(PlayerGameStat).count(),
        }
    print(f"  row counts: {counts}")
    print("Done.")


if __name__ == "__main__":
    main()
