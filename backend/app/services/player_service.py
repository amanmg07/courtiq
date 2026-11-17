"""Business logic + SQL for player listing/search/detail/game-log/season-averages/trends.

Shared aggregation helper: shooting percentages are always SUM(makes)/SUM(attempts)
over the rows in the aggregate, never AVG(per-game percentage) -- see README.
"""
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.models import Player, PlayerGameStat, PlayerGameFeature


def _season_average_select(extra_where=None):
    """Builds the SELECT for one or more SeasonAverage rows, grouped by
    whatever the caller adds via .group_by() afterwards."""
    fg_pct = (func.sum(PlayerGameStat.fgm) / func.nullif(func.sum(PlayerGameStat.fga), 0)).label("fg_pct")
    fg3_pct = (func.sum(PlayerGameStat.fg3m) / func.nullif(func.sum(PlayerGameStat.fg3a), 0)).label("fg3_pct")
    ft_pct = (func.sum(PlayerGameStat.ftm) / func.nullif(func.sum(PlayerGameStat.fta), 0)).label("ft_pct")
    stmt = select(
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
    if extra_where is not None:
        stmt = stmt.where(extra_where)
    return stmt


def get_current_teams(db: Session, player_ids: list[int] | None = None) -> dict[int, str]:
    """One query, using Postgres DISTINCT ON, to get each player's most
    recent team -- avoids an N+1 query per player."""
    stmt = (
        select(PlayerGameStat.player_id, PlayerGameStat.team_abbr)
        .distinct(PlayerGameStat.player_id)
        .order_by(PlayerGameStat.player_id, PlayerGameStat.game_date.desc(), PlayerGameStat.game_id.desc())
    )
    if player_ids is not None:
        stmt = stmt.where(PlayerGameStat.player_id.in_(player_ids))
    return {row.player_id: row.team_abbr for row in db.execute(stmt)}


def list_players(db: Session, limit: int = 50, offset: int = 0) -> tuple[list[Player], int]:
    total = db.scalar(select(func.count()).select_from(Player))
    players = (
        db.execute(
            select(Player).order_by(Player.games_played.desc(), Player.full_name).limit(limit).offset(offset)
        )
        .scalars()
        .all()
    )
    return players, total


def search_players(db: Session, query: str, limit: int = 20) -> list[Player]:
    pattern = f"%{query}%"
    stmt = (
        select(Player)
        .where(Player.full_name.ilike(pattern))
        .order_by(Player.games_played.desc())
        .limit(limit)
    )
    return db.execute(stmt).scalars().all()


def get_player(db: Session, player_id: int) -> Player | None:
    return db.get(Player, player_id)


def get_career_averages(db: Session, player_id: int):
    stmt = _season_average_select(extra_where=(PlayerGameStat.player_id == player_id))
    return db.execute(stmt).one()


def get_game_log(
    db: Session,
    player_id: int,
    season: str | None = None,
    opponent: str | None = None,
    limit: int = 25,
    offset: int = 0,
) -> tuple[list[PlayerGameStat], int]:
    conditions = [PlayerGameStat.player_id == player_id]
    if season:
        conditions.append(PlayerGameStat.season == season)
    if opponent:
        conditions.append(PlayerGameStat.opponent_abbr == opponent.upper())

    count_stmt = select(func.count()).select_from(PlayerGameStat).where(*conditions)
    total = db.scalar(count_stmt)

    stmt = (
        select(PlayerGameStat)
        .where(*conditions)
        .order_by(PlayerGameStat.game_date.desc(), PlayerGameStat.game_id.desc())
        .limit(limit)
        .offset(offset)
    )
    games = db.execute(stmt).scalars().all()
    return games, total


def get_season_averages(db: Session, player_id: int):
    career = get_career_averages(db, player_id)

    stmt = _season_average_select(extra_where=(PlayerGameStat.player_id == player_id)).add_columns(
        PlayerGameStat.season
    ).group_by(PlayerGameStat.season).order_by(PlayerGameStat.season)
    by_season = db.execute(stmt).all()
    return career, by_season


def get_trends(
    db: Session,
    player_id: int,
    season: str | None = None,
    last_n: int = 30,
):
    conditions = [PlayerGameStat.player_id == player_id, PlayerGameFeature.player_id == player_id,
                  PlayerGameStat.game_id == PlayerGameFeature.game_id]
    if season:
        conditions.append(PlayerGameStat.season == season)

    stmt = (
        select(PlayerGameStat, PlayerGameFeature)
        .where(*conditions)
        .order_by(PlayerGameStat.game_date.desc(), PlayerGameStat.game_id.desc())
        .limit(last_n)
    )
    rows = db.execute(stmt).all()
    return list(reversed(rows))  # chronological order for charting
