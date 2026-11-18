from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.stats import ComparisonEntry, ComparisonResponse
from app.services import player_service, compare_service
from app.api.players import _to_player_out, _to_season_average

router = APIRouter(prefix="/api/compare", tags=["compare"])


@router.get("", response_model=ComparisonResponse)
def compare_players(
    player_ids: str = Query(..., description="Comma-separated player IDs, e.g. 2544,201939"),
    season: str | None = Query(None, description='e.g. "2023-24"; omit for career stats'),
    db: Session = Depends(get_db),
):
    try:
        ids = [int(x) for x in player_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="player_ids must be a comma-separated list of integers")

    if len(ids) < 1:
        raise HTTPException(status_code=400, detail="Provide at least 1 player_id")
    if len(ids) > 6:
        raise HTTPException(status_code=400, detail="At most 6 players can be compared at once")

    teams = player_service.get_current_teams(db, ids)
    stats_by_id = compare_service.compare_players(db, ids, season=season)

    entries = []
    missing = []
    for pid in ids:
        player = player_service.get_player(db, pid)
        if player is None:
            missing.append(pid)
            continue
        row = stats_by_id.get(pid)
        if row is None:
            # player exists but has no games in the requested season
            continue
        entries.append(
            ComparisonEntry(
                player=_to_player_out(player, teams.get(pid)),
                stats=_to_season_average(row, season or "career"),
            )
        )

    if missing:
        raise HTTPException(status_code=404, detail=f"Player id(s) not found: {missing}")

    return ComparisonResponse(season=season or "career", players=entries)
