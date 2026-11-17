"""Multi-player comparison: same SeasonAverage aggregate as player_service,
grouped per player instead of per season."""
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.models import PlayerGameStat


def compare_players(db: Session, player_ids: list[int], season: str | None = None):
    conditions = [PlayerGameStat.player_id.in_(player_ids)]
    if season:
        conditions.append(PlayerGameStat.season == season)

    fg_pct = (func.sum(PlayerGameStat.fgm) / func.nullif(func.sum(PlayerGameStat.fga), 0)).label("fg_pct")
    fg3_pct = (func.sum(PlayerGameStat.fg3m) / func.nullif(func.sum(PlayerGameStat.fg3a), 0)).label("fg3_pct")
    ft_pct = (func.sum(PlayerGameStat.ftm) / func.nullif(func.sum(PlayerGameStat.fta), 0)).label("ft_pct")

    stmt = (
        select(
            PlayerGameStat.player_id,
            func.count().label("games_played"),
            func.avg(PlayerGameStat.minutes).label("avg_minutes"),
            func.avg(PlayerGameStat.pts).label("avg_pts"),
            func.avg(PlayerGameStat.reb).label("avg_reb"),
            func.avg(PlayerGameStat.ast).label("avg_ast"),
            func.avg(PlayerGameStat.stl).label("avg_stl"),
            func.avg(PlayerGameStat.blk).label("avg_blk"),
            func.avg(PlayerGameStat.tov).label("avg_tov"),
            fg_pct,
            fg3_pct,
            ft_pct,
        )
        .where(*conditions)
        .group_by(PlayerGameStat.player_id)
    )
    rows = db.execute(stmt).all()
    return {row.player_id: row for row in rows}
