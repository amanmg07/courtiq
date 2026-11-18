from datetime import date

from pydantic import BaseModel, ConfigDict

from app.schemas.player import PlayerOut


class GameLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    game_id: str
    game_date: date
    season: str
    team_abbr: str
    opponent_abbr: str
    is_home: bool
    minutes: float
    pts: int
    reb: int
    ast: int
    stl: int
    blk: int
    tov: int
    pf: int
    plus_minus: int
    fgm: int
    fga: int
    fg_pct: float | None
    fg3m: int
    fg3a: int
    fg3_pct: float | None
    ftm: int
    fta: int
    ft_pct: float | None


class GameLogResponse(BaseModel):
    player: PlayerOut
    total: int
    limit: int
    offset: int
    games: list[GameLogEntry]


class SeasonAverage(BaseModel):
    """One row of aggregated stats. `season` is a real season string
    (e.g. "2023-24") or the literal "career" for an all-time aggregate.

    Shooting percentages are SUM(makes)/SUM(attempts) over the games in this
    aggregate -- never an average of each game's own percentage, which is
    statistically wrong (see README)."""

    season: str
    games_played: int
    avg_minutes: float
    avg_pts: float
    avg_reb: float
    avg_ast: float
    avg_stl: float
    avg_blk: float
    avg_tov: float
    fg_pct: float | None
    fg3_pct: float | None
    ft_pct: float | None


class SeasonAveragesResponse(BaseModel):
    player: PlayerOut
    career: SeasonAverage
    by_season: list[SeasonAverage]


class TrendPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    game_id: str
    game_date: date
    season: str
    opponent_abbr: str
    is_home: bool
    minutes: float
    pts: int
    reb: int
    ast: int
    stl: int
    blk: int
    fg_pct: float | None
    fg3_pct: float | None
    ft_pct: float | None
    pts_l5_avg: float | None
    pts_l10_avg: float | None
    reb_l5_avg: float | None
    reb_l10_avg: float | None
    ast_l5_avg: float | None
    ast_l10_avg: float | None


class TrendsResponse(BaseModel):
    player: PlayerOut
    points: list[TrendPoint]


class MatchupGame(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    game_id: str
    game_date: date
    season: str
    is_home: bool
    minutes: float
    pts: int
    reb: int
    ast: int
    stl: int
    blk: int
    fg_pct: float | None


class MatchupResponse(BaseModel):
    player: PlayerOut
    opponent: str  # team abbreviation
    games_played: int
    avg_pts: float | None
    avg_reb: float | None
    avg_ast: float | None
    avg_stl: float | None
    avg_blk: float | None
    avg_minutes: float | None
    fg_pct: float | None
    home_avg_pts: float | None
    away_avg_pts: float | None
    recent_games: list[MatchupGame]


class ComparisonEntry(BaseModel):
    player: PlayerOut
    stats: SeasonAverage


class ComparisonResponse(BaseModel):
    season: str  # the requested season, or "career"
    players: list[ComparisonEntry]


class LeaderEntry(BaseModel):
    player: PlayerOut
    avg_value: float
    games_played: int


class LeadersResponse(BaseModel):
    stat: str
    season: str
    leaders: list[LeaderEntry]


class UpcomingGame(BaseModel):
    game_date: str  # ISO 8601 UTC, from ESPN -- not a DB date (future games aren't in our DB)
    opponent_abbr: str
    is_home: bool


class UpcomingGamesResponse(BaseModel):
    player: PlayerOut
    games: list[UpcomingGame]
