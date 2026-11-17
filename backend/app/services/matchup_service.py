"""Matchup analysis: a player's historical performance against one specific opponent."""
from sqlalchemy import select, func, case
from sqlalchemy.orm import Session

from app.db.models import PlayerGameStat


def get_matchup(db: Session, player_id: int, opponent_abbr: str, season: str | None = None):
    opponent_abbr = opponent_abbr.upper()
    conditions = [PlayerGameStat.player_id == player_id, PlayerGameStat.opponent_abbr == opponent_abbr]
    if season:
        conditions.append(PlayerGameStat.season == season)

    fg_pct = (func.sum(PlayerGameStat.fgm) / func.nullif(func.sum(PlayerGameStat.fga), 0)).label("fg_pct")
    home_avg_pts = func.avg(case((PlayerGameStat.is_home.is_(True), PlayerGameStat.pts))).label("home_avg_pts")
    away_avg_pts = func.avg(case((PlayerGameStat.is_home.is_(False), PlayerGameStat.pts))).label("away_avg_pts")

    agg_stmt = select(
        func.count().label("games_played"),
        func.avg(PlayerGameStat.pts).label("avg_pts"),
        func.avg(PlayerGameStat.reb).label("avg_reb"),
        func.avg(PlayerGameStat.ast).label("avg_ast"),
        func.avg(PlayerGameStat.minutes).label("avg_minutes"),
        fg_pct,
        home_avg_pts,
        away_avg_pts,
    ).where(*conditions)
    agg = db.execute(agg_stmt).one()

    recent_stmt = (
        select(PlayerGameStat)
        .where(*conditions)
        .order_by(PlayerGameStat.game_date.desc())
        .limit(20)
    )
    recent_games = db.execute(recent_stmt).scalars().all()

    return agg, recent_games
