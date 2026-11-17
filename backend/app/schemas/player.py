from pydantic import BaseModel, ConfigDict


class PlayerOut(BaseModel):
    """Lightweight player record used in lists, search results, and comparisons."""

    model_config = ConfigDict(from_attributes=True)

    player_id: int
    full_name: str
    first_season: str | None
    last_season: str | None
    games_played: int
    current_team: str | None = None  # abbreviation; most recent game's team


class PlayerListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    players: list[PlayerOut]


class PlayerDetail(PlayerOut):
    career_avg_pts: float | None
    career_avg_reb: float | None
    career_avg_ast: float | None
    career_avg_minutes: float | None
    career_fg_pct: float | None
    career_fg3_pct: float | None
    career_ft_pct: float | None
