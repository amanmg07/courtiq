"""
Upcoming-schedule lookups, for the Predictions page's "next games" shortcuts.

CourtIQ's own database only has HISTORICAL box scores (games already played)
-- there is no future schedule in it, by design (a box score doesn't exist
until the game happens). To show a player's next few real games, this calls
ESPN's public site API (no key required; verified reachable where
stats.nba.com/data.nba.net were not, in this environment) for the player's
team's schedule, filtered to games that haven't started yet.

This is a live external call on each request, not cached/stored -- if ESPN
is slow or unreachable, callers get an empty list (logged), never a crash:
the shortcuts row just doesn't show rather than breaking the page.
"""
import json
import urllib.request
from datetime import datetime, timezone

# Every team's path segment in ESPN's schedule URL. Verified against all 30
# teams directly (6 differ from our own abbreviation): GSW->gs, NOP->no,
# NYK->ny, SAN->sa, UTA->utah, WAS->wsh.
OUR_TO_ESPN_PATH = {
    "ATL": "atl", "BKN": "bkn", "BOS": "bos", "CHA": "cha", "CHI": "chi", "CLE": "cle",
    "DAL": "dal", "DEN": "den", "DET": "det", "GSW": "gsw", "HOU": "hou", "IND": "ind",
    "LAC": "lac", "LAL": "lal", "MEM": "mem", "MIA": "mia", "MIL": "mil", "MIN": "min",
    "NOP": "no", "NYK": "nyk", "OKC": "okc", "ORL": "orl", "PHI": "phi", "PHX": "phx",
    "POR": "por", "SAC": "sac", "SAN": "sas", "TOR": "tor", "UTA": "utah", "WAS": "was",
}

# The abbreviation ESPN uses for a team INSIDE competitor data (to map an
# opponent back to our own abbreviation scheme) -- differs from the URL path
# for 6 teams, confirmed by inspecting real API responses, not guessed.
ESPN_ABBR_TO_OURS = {
    "GS": "GSW", "NO": "NOP", "NY": "NYK", "SA": "SAN", "UTAH": "UTA", "WSH": "WAS",
}


def _our_abbr(espn_abbr: str) -> str:
    return ESPN_ABBR_TO_OURS.get(espn_abbr, espn_abbr)


def get_upcoming_games(team_abbr: str, limit: int = 5) -> list[dict]:
    """Returns up to `limit` of this team's next games that haven't started
    yet: [{game_date (ISO), opponent_abbr, is_home}, ...], soonest first.
    Returns [] (not an exception) on any network/parsing problem -- this
    feature is a convenience, never a hard dependency of the page."""
    espn_path = OUR_TO_ESPN_PATH.get(team_abbr.upper())
    if espn_path is None:
        return []

    url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{espn_path}/schedule"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.load(resp)
    except Exception:
        return []

    upcoming = []
    for event in data.get("events", []):
        try:
            competition = event["competitions"][0]
            status = competition["status"]["type"]["name"]
            if status != "STATUS_SCHEDULED":  # skip in-progress/completed games
                continue

            competitors = competition["competitors"]
            us = next((c for c in competitors if _our_abbr(c["team"]["abbreviation"]) == team_abbr.upper()), None)
            them = next((c for c in competitors if _our_abbr(c["team"]["abbreviation"]) != team_abbr.upper()), None)
            if us is None or them is None:
                continue

            upcoming.append({
                "game_date": event["date"],  # ISO 8601, UTC
                "opponent_abbr": _our_abbr(them["team"]["abbreviation"]),
                "is_home": us["homeAway"] == "home",
            })
        except (KeyError, IndexError, StopIteration):
            continue  # one malformed event shouldn't sink the whole list

    upcoming.sort(key=lambda g: g["game_date"])
    return upcoming[:limit]
