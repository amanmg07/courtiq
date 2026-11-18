"""League-wide statistical leaders, for the dashboard. Not one of the original
8 endpoints in the spec, but required by it indirectly: the Dashboard Home
page calls for "league-wide statistical leaders"."""
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.models import PlayerGameStat, Player

STAT_COLUMNS = {
    "pts": PlayerGameStat.pts,
    "reb": PlayerGameStat.reb,
    "ast": PlayerGameStat.ast,
    "stl": PlayerGameStat.stl,
    "blk": PlayerGameStat.blk,
}


def get_latest_season(db: Session) -> str:
    return db.scalar(select(func.max(PlayerGameStat.season)))


def get_leaders(
    db: Session,
    stat: str,
    season: str | None = None,
    limit: int = 10,
    min_games: int = 15,
):
    season = season or get_latest_season(db)
    col = STAT_COLUMNS[stat]

    stmt = (
        select(
            PlayerGameStat.player_id,
            Player.full_name,
            func.count().label("games_played"),
            func.avg(col).label("avg_value"),
        )
        .join(Player, Player.player_id == PlayerGameStat.player_id)
        .where(PlayerGameStat.season == season)
        .group_by(PlayerGameStat.player_id, Player.full_name)
        .having(func.count() >= min_games)
        .order_by(func.avg(col).desc())
        .limit(limit)
    )
    return season, db.execute(stmt).all()
