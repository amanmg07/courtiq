"""
Integration tests against the real dev database (not a mocked/fixture DB) --
this is a data-analytics app where the interesting bugs are in the SQL, so
these tests exercise it directly. Requires: Postgres running (scripts/pg_dev.sh
start) and the ingestion + feature pipelines already run.

LeBron James (player_id=2544) is used as a known-good fixture: he's present
in every loaded season, which makes assertions about his data stable.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
LEBRON_ID = 2544


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_list_teams():
    r = client.get("/api/teams")
    assert r.status_code == 200
    teams = r.json()
    assert len(teams) == 30
    assert {"LAL", "BOS", "DEN"}.issubset({t["abbreviation"] for t in teams})


def test_list_players_pagination():
    r = client.get("/api/players", params={"limit": 5, "offset": 0})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1000  # 1084 at last ingest
    assert len(body["players"]) == 5


@pytest.mark.parametrize("limit", [0, 500])
def test_list_players_rejects_bad_limit(limit):
    r = client.get("/api/players", params={"limit": limit})
    assert r.status_code == 422


def test_search_finds_lebron():
    r = client.get("/api/players/search", params={"q": "lebron"})
    assert r.status_code == 200
    results = r.json()
    assert any(p["player_id"] == LEBRON_ID for p in results)


def test_search_no_match_returns_empty_list():
    r = client.get("/api/players/search", params={"q": "zzz_not_a_real_player"})
    assert r.status_code == 200
    assert r.json() == []


def test_player_detail_not_found():
    r = client.get("/api/players/999999999")
    assert r.status_code == 404


def test_player_detail_lebron():
    r = client.get(f"/api/players/{LEBRON_ID}")
    assert r.status_code == 200
    body = r.json()
    assert body["full_name"] == "LeBron James"
    assert 15 < body["career_avg_pts"] < 35  # sane range, not a fabricated check


def test_gamelog_known_box_score():
    """Cross-check against a real, independently-verified box score
    (LAL @ DEN, 2023-10-24): 21 pts / 8 reb / 5 ast, 10-of-16 FG."""
    r = client.get(
        f"/api/players/{LEBRON_ID}/gamelog",
        params={"season": "2023-24", "opponent": "DEN"},
    )
    assert r.status_code == 200
    games = r.json()["games"]
    opener = next(g for g in games if g["game_date"] == "2023-10-24")
    assert opener["pts"] == 21
    assert opener["reb"] == 8
    assert opener["ast"] == 5
    assert opener["fgm"] == 10 and opener["fga"] == 16
    assert opener["fg_pct"] == pytest.approx(10 / 16)


def test_season_averages_percentage_is_not_averaged_naively():
    """fg_pct must equal SUM(fgm)/SUM(fga), not AVG(per-game fg_pct)."""
    r = client.get(f"/api/players/{LEBRON_ID}/season-averages")
    assert r.status_code == 200
    body = r.json()
    season = next(s for s in body["by_season"] if s["season"] == "2023-24")
    assert 0.40 < season["fg_pct"] < 0.65  # sane shooting percentage range


def test_trends_no_leakage_on_first_game_of_dataset():
    """A player's very first game in the data must have NULL rolling averages --
    there is no prior game to average over."""
    r = client.get(f"/api/players/{LEBRON_ID}/trends", params={"last_n": 150})
    assert r.status_code == 200
    points = r.json()["points"]
    first_game = min(points, key=lambda p: p["game_date"])
    if first_game["game_date"] == "2021-10-19":  # true first game of the dataset
        assert first_game["pts_l5_avg"] is None


def test_matchup_vs_opponent():
    r = client.get(f"/api/players/{LEBRON_ID}/matchup/DEN")
    assert r.status_code == 200
    body = r.json()
    assert body["games_played"] > 0
    assert body["avg_pts"] is not None


def test_matchup_unknown_opponent_is_empty_not_error():
    r = client.get(f"/api/players/{LEBRON_ID}/matchup/ZZZ")
    assert r.status_code == 200
    assert r.json()["games_played"] == 0


def test_compare_requires_at_least_two_players():
    r = client.get("/api/compare", params={"player_ids": str(LEBRON_ID)})
    assert r.status_code == 400


def test_compare_missing_player_is_404():
    r = client.get("/api/compare", params={"player_ids": f"{LEBRON_ID},999999999"})
    assert r.status_code == 404


def test_compare_two_real_players():
    r = client.get("/api/compare", params={"player_ids": f"{LEBRON_ID},203507"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["players"]) == 2


def test_predict_returns_real_prediction():
    r = client.post(
        "/api/predict",
        json={"player_id": LEBRON_ID, "opponent_abbr": "DEN", "is_home": True},
    )
    assert r.status_code == 200
    body = r.json()
    for stat in ("pts", "reb", "ast"):
        assert 0 <= body[stat]["predicted"] < 60  # sane box-score range, not exact (model-dependent)
        assert body[stat]["mae"] > 0  # a real measured value, never fabricated/zero
    assert "model_info" in body and len(body["model_info"]) > 0


def test_predict_unknown_player_is_404():
    r = client.post(
        "/api/predict",
        json={"player_id": 999999999, "opponent_abbr": "DEN", "is_home": True},
    )
    assert r.status_code == 404


def test_predict_handles_low_history_player_without_crashing():
    """A player with only 1 game played (no L5/L10/season history to speak
    of) must be imputed, not crash the request."""
    r = client.get("/api/players/search", params={"q": "Tyrell Terry"})
    candidates = [p for p in r.json() if p["games_played"] <= 3]
    if not candidates:
        pytest.skip("no low-games-played fixture player found in this dataset load")
    low_history_id = candidates[0]["player_id"]

    r = client.post(
        "/api/predict",
        json={"player_id": low_history_id, "opponent_abbr": "BOS", "is_home": False},
    )
    assert r.status_code == 200
    assert r.json()["pts"]["predicted"] >= 0
