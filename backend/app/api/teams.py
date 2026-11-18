from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Team
from app.schemas.common import TeamOut
from app.services.schedule_service import OUR_TO_ESPN_PATH

router = APIRouter(prefix="/api/teams", tags=["teams"])


def _logo_url(abbreviation: str) -> str:
    # ESPN's public logo CDN -- verified directly (curl + actual Chromium,
    # unlike cdn.nba.com's headshots, this one loads fine in-browser with no
    # proxy needed). Reuses the same abbreviation mapping as the schedule
    # lookup (6 teams differ from our own code: GSW/NOP/NYK/SAN/UTA/WAS).
    espn_path = OUR_TO_ESPN_PATH.get(abbreviation.upper(), abbreviation.lower())
    return f"https://a.espncdn.com/i/teamlogos/nba/500/{espn_path}.png"


def _to_team_out(team: Team) -> TeamOut:
    return TeamOut(
        abbreviation=team.abbreviation,
        name=team.name,
        conference=team.conference,
        division=team.division,
        primary_color=team.primary_color,
        secondary_color=team.secondary_color,
        logo_url=_logo_url(team.abbreviation),
    )


@router.get("", response_model=list[TeamOut])
def list_teams(db: Session = Depends(get_db)):
    teams = db.execute(select(Team).order_by(Team.conference, Team.division, Team.name)).scalars().all()
    return [_to_team_out(t) for t in teams]
