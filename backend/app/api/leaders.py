from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Player
from app.schemas.stats import LeadersResponse, LeaderEntry
from app.services import leaders_service, player_service
from app.api.players import _to_player_out

router = APIRouter(prefix="/api/leaders", tags=["leaders"])


@router.get("", response_model=LeadersResponse)
def get_leaders(
    stat: str = Query("pts", pattern="^(pts|reb|ast|stl|blk)$"),
    season: str | None = Query(None, description='Defaults to the most recent season loaded'),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    if stat not in leaders_service.STAT_COLUMNS:
        raise HTTPException(status_code=400, detail=f"Unsupported stat '{stat}'")

    resolved_season, rows = leaders_service.get_leaders(db, stat, season=season, limit=limit)
    ids = [r.player_id for r in rows]
    teams = player_service.get_current_teams(db, ids)
    players_by_id = {p.player_id: p for p in db.execute(select(Player).where(Player.player_id.in_(ids))).scalars()}

    leaders = [
        LeaderEntry(
            player=_to_player_out(players_by_id[r.player_id], teams.get(r.player_id)),
            avg_value=float(r.avg_value),
            games_played=r.games_played,
        )
        for r in rows
    ]
    return LeadersResponse(stat=stat, season=resolved_season, leaders=leaders)
