"""
SQLAlchemy ORM models — the single source of truth for the schema.
Used by the API, the ingestion scripts, and the ML feature/training scripts.

Design notes:
- `Team.abbreviation` is used as the natural primary key (e.g. "LAL"). No team
  relocations/renames occur inside our data window (2021-22 .. present), so this
  avoids an extra surrogate-key join on every query.
- `PlayerGameStat` denormalizes `game_date` and `season` from `Game` directly onto
  the row. This is a deliberate star-schema-style choice: almost every analytics
  query here ("last 10 games", "this season", "vs this opponent over time") filters
  or orders by date/season per player, and avoiding a join on the hot path matters
  once this table holds 100K+ rows.
- `PlayerGameFeature` holds precomputed, leakage-safe features (rolling averages,
  opponent defensive proxy, historical matchup averages) used by both the
  "trends" API endpoints and the ML training pipeline, so the two never compute
  features differently. Every feature value is computed from games STRICTLY
  BEFORE the row's own game_date — see scripts/build_features.py.
"""
from datetime import date

from sqlalchemy import (
    String,
    Integer,
    Float,
    Boolean,
    Date,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Team(Base):
    __tablename__ = "teams"

    abbreviation: Mapped[str] = mapped_column(String(3), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    conference: Mapped[str] = mapped_column(String(4), nullable=False)  # "East" / "West"
    division: Mapped[str] = mapped_column(String(16), nullable=False)
    # Real NBA team brand colors (public, well-documented -- not fabricated),
    # used for consistent team-identity theming across the frontend.
    primary_color: Mapped[str] = mapped_column(String(7), nullable=False)
    secondary_color: Mapped[str] = mapped_column(String(7), nullable=False)


class Player(Base):
    __tablename__ = "players"

    player_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    first_season: Mapped[str | None] = mapped_column(String(7), nullable=True)
    last_season: Mapped[str | None] = mapped_column(String(7), nullable=True)
    games_played: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Game(Base):
    __tablename__ = "games"

    game_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    game_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    season: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    home_team_abbr: Mapped[str] = mapped_column(ForeignKey("teams.abbreviation"), nullable=False)
    away_team_abbr: Mapped[str] = mapped_column(ForeignKey("teams.abbreviation"), nullable=False)

    home_team: Mapped["Team"] = relationship(foreign_keys=[home_team_abbr])
    away_team: Mapped["Team"] = relationship(foreign_keys=[away_team_abbr])


class PlayerGameStat(Base):
    __tablename__ = "player_game_stats"
    __table_args__ = (
        UniqueConstraint("game_id", "player_id", name="uq_game_player"),
        Index("ix_pgs_player_date", "player_id", "game_date"),
        Index("ix_pgs_player_opponent", "player_id", "opponent_abbr"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[str] = mapped_column(ForeignKey("games.game_id"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.player_id"), nullable=False)

    # denormalized for fast per-player time-series queries (see module docstring)
    game_date: Mapped[date] = mapped_column(Date, nullable=False)
    season: Mapped[str] = mapped_column(String(7), nullable=False)

    team_abbr: Mapped[str] = mapped_column(ForeignKey("teams.abbreviation"), nullable=False)
    opponent_abbr: Mapped[str] = mapped_column(ForeignKey("teams.abbreviation"), nullable=False)
    is_home: Mapped[bool] = mapped_column(Boolean, nullable=False)

    minutes: Mapped[float] = mapped_column(Float, nullable=False)
    pts: Mapped[int] = mapped_column(Integer, nullable=False)
    reb: Mapped[int] = mapped_column(Integer, nullable=False)
    ast: Mapped[int] = mapped_column(Integer, nullable=False)
    oreb: Mapped[int] = mapped_column(Integer, nullable=False)
    dreb: Mapped[int] = mapped_column(Integer, nullable=False)
    stl: Mapped[int] = mapped_column(Integer, nullable=False)
    blk: Mapped[int] = mapped_column(Integer, nullable=False)
    tov: Mapped[int] = mapped_column(Integer, nullable=False)
    pf: Mapped[int] = mapped_column(Integer, nullable=False)
    plus_minus: Mapped[int] = mapped_column(Integer, nullable=False)

    fgm: Mapped[int] = mapped_column(Integer, nullable=False)
    fga: Mapped[int] = mapped_column(Integer, nullable=False)
    fg3m: Mapped[int] = mapped_column(Integer, nullable=False)
    fg3a: Mapped[int] = mapped_column(Integer, nullable=False)
    ftm: Mapped[int] = mapped_column(Integer, nullable=False)
    fta: Mapped[int] = mapped_column(Integer, nullable=False)

    # Stored (not just computed on the fly) for query speed, but ALWAYS derived
    # from makes/attempts at ingest time -- never averaged across games, since
    # averaging per-game percentages is statistically wrong (see README).
    fg_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    fg3_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    ft_pct: Mapped[float | None] = mapped_column(Float, nullable=True)


class PlayerGameFeature(Base):
    """Leakage-safe, precomputed features: every *_to_date value is computed
    from games strictly before this row's game_date (see scripts/build_features.py).
    One row per (player_id, game_id), aligned 1:1 with PlayerGameStat."""

    __tablename__ = "player_game_features"
    __table_args__ = (
        UniqueConstraint("game_id", "player_id", name="uq_feat_game_player"),
        Index("ix_feat_player_date", "player_id", "game_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[str] = mapped_column(ForeignKey("games.game_id"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.player_id"), nullable=False)
    game_date: Mapped[date] = mapped_column(Date, nullable=False)
    season: Mapped[str] = mapped_column(String(7), nullable=False)

    games_played_career_to_date: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    days_rest: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_home: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # last-5 / last-10 game rolling averages
    pts_l5_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    reb_l5_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    ast_l5_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_l5_avg: Mapped[float | None] = mapped_column(Float, nullable=True)

    pts_l10_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    reb_l10_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    ast_l10_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_l10_avg: Mapped[float | None] = mapped_column(Float, nullable=True)

    # season-to-date averages (this season, prior games only)
    pts_season_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    reb_season_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    ast_season_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_season_avg: Mapped[float | None] = mapped_column(Float, nullable=True)

    # home/away season-to-date splits
    pts_home_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    pts_away_avg: Mapped[float | None] = mapped_column(Float, nullable=True)

    # opponent defensive proxy: avg points/rebounds/assists the opponent has
    # ALLOWED to opposing players over their prior games this season
    opp_pts_allowed_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    opp_reb_allowed_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    opp_ast_allowed_avg: Mapped[float | None] = mapped_column(Float, nullable=True)

    # historical matchup: this player's career avg vs this exact opponent, prior games only
    matchup_pts_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    matchup_reb_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    matchup_ast_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    matchup_games_played: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # schedule-fatigue features, added for the free-improvements ML pass:
    # back-to-back is a well-known real fatigue effect (no leakage -- the
    # upcoming game's date/is_home are schedule facts known ahead of time,
    # same as days_rest above; only the game's own OUTCOME is off-limits).
    is_back_to_back: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # consecutive prior games sharing this game's is_home value (0 = this
    # breaks the pattern, e.g. first game of a new road trip or homestand)
    home_stand_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
