import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.player import PlayerOut, PlayerListResponse, PlayerDetail
from app.schemas.stats import (
    GameLogEntry, GameLogResponse, SeasonAverage, SeasonAveragesResponse,
    TrendPoint, TrendsResponse, MatchupGame, MatchupResponse,
    UpcomingGame, UpcomingGamesResponse,
)
from app.services import player_service, matchup_service, schedule_service

router = APIRouter(prefix="/api/players", tags=["players"])


def _f(value) -> float | None:
    """Postgres numeric aggregates come back as Decimal (or None) -- normalize to float."""
    return None if value is None else float(value)


def _headshot_url(player_id: int) -> str:
    # Proxied through our own API (see get_headshot below), NOT a direct
    # cdn.nba.com URL: verified that URL loads fine via curl and server-side
    # Python, but reliably fails in Chromium specifically with
    # net::ERR_HTTP2_PROTOCOL_ERROR (reproduced with a single image, zero
    # concurrency, confirmed other HTTPS hosts work fine in the same
    # browser -- so this is a real NBA-CDN/Chromium HTTP-2 incompatibility,
    # not a sandbox artifact or a rate-limit). Proxying sidesteps it entirely:
    # the browser only ever talks to our own server.
    return f"{get_settings().public_base_url}/api/players/{player_id}/headshot"


def _to_player_out(player, current_team: str | None = None) -> PlayerOut:
    return PlayerOut(
        player_id=player.player_id,
        full_name=player.full_name,
        first_season=player.first_season,
        last_season=player.last_season,
        games_played=player.games_played,
        current_team=current_team,
        headshot_url=_headshot_url(player.player_id),
    )


def _to_season_average(row, season_label: str) -> SeasonAverage:
    return SeasonAverage(
        season=season_label,
        games_played=row.games_played,
        avg_minutes=_f(row.avg_minutes) or 0.0,
        avg_pts=_f(row.avg_pts) or 0.0,
        avg_reb=_f(row.avg_reb) or 0.0,
        avg_ast=_f(row.avg_ast) or 0.0,
        avg_stl=_f(row.avg_stl) or 0.0,
        avg_blk=_f(row.avg_blk) or 0.0,
        avg_tov=_f(row.avg_tov) or 0.0,
        fg_pct=_f(row.fg_pct),
        fg3_pct=_f(row.fg3_pct),
        ft_pct=_f(row.ft_pct),
    )


def _get_player_or_404(db: Session, player_id: int):
    player = player_service.get_player(db, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail=f"Player {player_id} not found")
    return player


@router.get("", response_model=PlayerListResponse)
def list_players(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """All NBA players (paginated), ordered by career games played."""
    players, total = player_service.list_players(db, limit=limit, offset=offset)
    teams = player_service.get_current_teams(db, [p.player_id for p in players])
    return PlayerListResponse(
        total=total,
        limit=limit,
        offset=offset,
        players=[_to_player_out(p, teams.get(p.player_id)) for p in players],
    )


@router.get("/search", response_model=list[PlayerOut])
def search_players(
    q: str = Query(..., min_length=1, description="Name substring, case-insensitive"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    players = player_service.search_players(db, q, limit=limit)
    teams = player_service.get_current_teams(db, [p.player_id for p in players])
    return [_to_player_out(p, teams.get(p.player_id)) for p in players]


@router.get("/{player_id}", response_model=PlayerDetail)
def get_player(player_id: int, db: Session = Depends(get_db)):
    player = _get_player_or_404(db, player_id)
    team = player_service.get_current_teams(db, [player_id]).get(player_id)
    career = player_service.get_career_averages(db, player_id)
    return PlayerDetail(
        **_to_player_out(player, team).model_dump(),
        career_avg_pts=_f(career.avg_pts),
        career_avg_reb=_f(career.avg_reb),
        career_avg_ast=_f(career.avg_ast),
        career_avg_stl=_f(career.avg_stl),
        career_avg_blk=_f(career.avg_blk),
        career_avg_minutes=_f(career.avg_minutes),
        career_fg_pct=_f(career.fg_pct),
        career_fg3_pct=_f(career.fg3_pct),
        career_ft_pct=_f(career.ft_pct),
    )


@router.get("/{player_id}/gamelog", response_model=GameLogResponse)
def get_game_log(
    player_id: int,
    season: str | None = Query(None, description='e.g. "2023-24"'),
    opponent: str | None = Query(None, description="Team abbreviation, e.g. DEN"),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    player = _get_player_or_404(db, player_id)
    team = player_service.get_current_teams(db, [player_id]).get(player_id)
    games, total = player_service.get_game_log(
        db, player_id, season=season, opponent=opponent, limit=limit, offset=offset
    )
    return GameLogResponse(
        player=_to_player_out(player, team),
        total=total,
        limit=limit,
        offset=offset,
        games=[GameLogEntry.model_validate(g) for g in games],
    )


@router.get("/{player_id}/season-averages", response_model=SeasonAveragesResponse)
def get_season_averages(player_id: int, db: Session = Depends(get_db)):
    player = _get_player_or_404(db, player_id)
    team = player_service.get_current_teams(db, [player_id]).get(player_id)
    career, by_season = player_service.get_season_averages(db, player_id)
    return SeasonAveragesResponse(
        player=_to_player_out(player, team),
        career=_to_season_average(career, "career"),
        by_season=[_to_season_average(row, row.season) for row in by_season],
    )


@router.get("/{player_id}/trends", response_model=TrendsResponse)
def get_trends(
    player_id: int,
    season: str | None = Query(None),
    last_n: int = Query(30, ge=1, le=150),
    db: Session = Depends(get_db),
):
    player = _get_player_or_404(db, player_id)
    team = player_service.get_current_teams(db, [player_id]).get(player_id)
    rows = player_service.get_trends(db, player_id, season=season, last_n=last_n)

    points = []
    for stat, feat in rows:
        points.append(
            TrendPoint(
                game_id=stat.game_id,
                game_date=stat.game_date,
                season=stat.season,
                opponent_abbr=stat.opponent_abbr,
                is_home=stat.is_home,
                minutes=stat.minutes,
                pts=stat.pts,
                reb=stat.reb,
                ast=stat.ast,
                stl=stat.stl,
                blk=stat.blk,
                fg_pct=stat.fg_pct,
                fg3_pct=stat.fg3_pct,
                ft_pct=stat.ft_pct,
                pts_l5_avg=feat.pts_l5_avg,
                pts_l10_avg=feat.pts_l10_avg,
                reb_l5_avg=feat.reb_l5_avg,
                reb_l10_avg=feat.reb_l10_avg,
                ast_l5_avg=feat.ast_l5_avg,
                ast_l10_avg=feat.ast_l10_avg,
            )
        )
    return TrendsResponse(player=_to_player_out(player, team), points=points)


@router.get("/{player_id}/matchup/{opponent_abbr}", response_model=MatchupResponse)
def get_matchup(
    player_id: int,
    opponent_abbr: str,
    season: str | None = Query(None),
    db: Session = Depends(get_db),
):
    player = _get_player_or_404(db, player_id)
    team = player_service.get_current_teams(db, [player_id]).get(player_id)
    agg, recent_games = matchup_service.get_matchup(db, player_id, opponent_abbr, season=season)

    return MatchupResponse(
        player=_to_player_out(player, team),
        opponent=opponent_abbr.upper(),
        games_played=agg.games_played,
        avg_pts=_f(agg.avg_pts),
        avg_reb=_f(agg.avg_reb),
        avg_ast=_f(agg.avg_ast),
        avg_stl=_f(agg.avg_stl),
        avg_blk=_f(agg.avg_blk),
        avg_minutes=_f(agg.avg_minutes),
        fg_pct=_f(agg.fg_pct),
        home_avg_pts=_f(agg.home_avg_pts),
        away_avg_pts=_f(agg.away_avg_pts),
        recent_games=[MatchupGame.model_validate(g) for g in recent_games],
    )


@router.get("/{player_id}/headshot")
def get_headshot(player_id: int):
    """Proxies the player's real NBA.com headshot (see _headshot_url's
    comment for why: it's a Chromium/cdn.nba.com HTTP-2 incompatibility,
    not a hotlink or CORS restriction). No DB lookup needed -- the id
    pattern is the same regardless of whether the id is a real player."""
    url = f"https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            image_bytes = resp.read()
            content_type = resp.headers.get("Content-Type", "image/png")
    except Exception:
        raise HTTPException(status_code=502, detail="Headshot temporarily unavailable")

    return Response(
        content=image_bytes,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},  # static content; let the browser cache it
    )


@router.get("/{player_id}/upcoming", response_model=UpcomingGamesResponse)
def get_upcoming_games(
    player_id: int,
    limit: int = Query(5, ge=1, le=15),
    db: Session = Depends(get_db),
):
    """The player's team's next games that haven't been played yet, for
    Predictions-page shortcuts. Live lookup (ESPN's public schedule, no key
    needed) -- our own DB has no future games by design. Returns an empty
    list, never an error, if the team is unknown or ESPN is unreachable."""
    player = _get_player_or_404(db, player_id)
    team = player_service.get_current_teams(db, [player_id]).get(player_id)
    games = schedule_service.get_upcoming_games(team, limit=limit) if team else []
    return UpcomingGamesResponse(
        player=_to_player_out(player, team),
        games=[UpcomingGame(**g) for g in games],
    )
