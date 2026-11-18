# CourtIQ

A full-stack NBA analytics and predictive modeling platform: player search,
multi-player comparison, opponent matchup analysis, trend exploration, and
ML-based predictions for points/rebounds/assists.

**Status:** Phase 1 (database + data pipeline), Phase 2 (backend API), and
Phase 4 (frontend) are complete and tested — done out of order at the user's
request, so the Predictions page is real UI wired to a real (not yet trained)
endpoint. ML models are not yet built (see Roadmap).

## Architecture

```
courtiq/
├── frontend/   React + TypeScript + Tailwind + Recharts
├── backend/    FastAPI + SQLAlchemy + Pydantic + Alembic
├── data/       local cache of downloaded source files (not committed)
├── ml/         pandas/scikit-learn training & evaluation pipeline
├── scripts/    CLI entry points: ingest_data.py, build_features.py, train_models.py
└── docs/
```

**How the pieces talk to each other:**

- The **frontend never touches Postgres directly.** It only calls the FastAPI
  REST API (`/api/players`, `/api/players/{id}/gamelog`, `/api/predict/...`)
  and renders JSON responses with Recharts.
- **FastAPI owns all database access** (via SQLAlchemy) and, for predictions,
  loads pre-trained model files (`.joblib`) produced offline by `ml/` — so a
  request never triggers live model training, only inference.
- **`ml/` trains offline** against the same Postgres tables the API reads,
  using the SQLAlchemy models defined once in `backend/app/db/models.py` and
  imported by both the backend and the training/ingestion scripts, so there
  is a single schema definition, not two copies that can drift apart.
- **`scripts/`** are the operational entry points that actually move data:
  `ingest_data.py` (raw data → Postgres) and `build_features.py` (Postgres →
  leakage-safe feature table), both run from the project root.

## Dataset

**Source:** [`cbratkovics/nba-game-logs`](https://huggingface.co/datasets/cbratkovics/nba-game-logs)
on the Hugging Face Hub — a public, un-gated backfill of the Kaggle
["NBA Dataset: Box Scores and Stats"](https://www.kaggle.com/datasets/eoinamoore/historical-nba-data-and-player-box-scores)
by Eoin Moore, resolved to one row per player per regular-season game.

**Why this one:** it needed no account/API key (several alternatives required
Kaggle credentials), ships as clean per-season Parquet files, and — verified
directly, not assumed — contains exactly the fields the spec calls for
(points, rebounds, assists, minutes, makes/attempts for FG/3P/FT, steals,
blocks, turnovers, plus/minus, opponent, home/away, date, season) with **zero
nulls, zero duplicate (game, player) pairs, and zero stat inconsistencies**
(no `fgm > fga` etc.) across all six seasons loaded.

**Coverage loaded:** seasons `2021-22` through `2026-27` (current, in
progress) — **134,960 player-game rows**, 6,345 games, 1,084 players, well
over the 100K-record target and across multiple full seasons.

The dataset repo also contains an unrelated betting/model-ops pipeline
(`gold/`, `replay/`, `drift/`, `ledger/` folders) belonging to its author's
own project — only the `game_logs/*.parquet` files are used here.

To extend history further back, the original Kaggle dataset covers 1946–present;
that path needs a Kaggle API key (`~/.kaggle/kaggle.json`) and isn't wired up
yet, since the HF mirror already clears the data requirements on its own.

## Database schema

Postgres, via SQLAlchemy models in `backend/app/db/models.py`:

| Table | Grain | Notes |
|---|---|---|
| `teams` | 1 row / franchise | Static reference data (name, conference, division); abbreviation is the PK. |
| `players` | 1 row / player | `full_name`, first/last season seen, career games played. |
| `games` | 1 row / game | Home/away team FKs, date, season. |
| `player_game_stats` | 1 row / player / game | The raw box score. `game_date`/`season` are **denormalized** from `games` directly onto this table — nearly every analytics query here filters/orders by date per player, and avoiding a join on a 135K-row hot path was a deliberate call. Shooting percentages (`fg_pct`, `fg3_pct`, `ft_pct`) are computed from makes/attempts at ingest time, **never averaged across games** — averaging per-game percentages is statistically wrong; the correct aggregate is sum(makes)/sum(attempts). |
| `player_game_features` | 1 row / player / game, 1:1 with `player_game_stats` | Precomputed ML/trend features — see below. Shared by the "trends" API endpoints and the ML training pipeline so both use identical feature definitions. |

### Feature engineering (`player_game_features`)

Every value is computed from games **strictly before** that row's own
`game_date` — enforced with `.shift(1)` ahead of any rolling/expanding window,
verified directly (see Verification below), not just asserted:

- Last-5 / last-10 game rolling averages (pts, reb, ast, minutes)
- Season-to-date averages (reset each season)
- Home vs. away season-to-date splits
- **Opponent defensive proxy:** average pts/reb/ast the opponent has allowed
  to all players, prior games only
- **Historical matchup:** the player's own career average vs. this specific
  opponent, prior meetings only (spans seasons)
- Career games played to date, days of rest since the previous game

## Backend API

FastAPI, modular by layer: `app/api/` (routers, HTTP concerns only) →
`app/services/` (SQL/business logic, framework-agnostic) → `app/db/models.py`
(schema). `app/schemas/` holds the Pydantic request/response models.

| Endpoint | Purpose |
|---|---|
| `GET /api/teams` | All 30 teams |
| `GET /api/players?limit=&offset=` | All players, paginated |
| `GET /api/players/search?q=` | Search by name |
| `GET /api/players/{id}` | Player detail + career averages |
| `GET /api/players/{id}/gamelog?season=&opponent=&limit=&offset=` | Game-by-game box scores |
| `GET /api/players/{id}/season-averages` | Per-season + career aggregates (shooting % = ΣmakesΣattempts, not averaged) |
| `GET /api/players/{id}/trends?season=&last_n=` | Time series with L5/L10 rolling averages, for charting |
| `GET /api/players/{id}/matchup/{opponent}?season=` | History vs. one specific opponent, home/away split |
| `GET /api/compare?player_ids=1,2,3&season=` | Side-by-side averages for 2–6 players |
| `POST /api/predict` | **Not yet available — returns 503.** Models aren't trained yet (next phase); the request/response contract is final so the frontend can integrate now. |

Run it:
```bash
cd backend
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
# interactive docs: http://localhost:8000/docs
```

Tests (18, integration-style against the real dev DB — this is a data app,
so the SQL itself is what needs covering):
```bash
python -m pytest   # from project root; pytest.ini points at backend/tests
```

**A bug the tests caught:** the same "`None` into a float64/int64 pandas
column silently reverts to `NaN`" issue fixed in `build_features.py` during
Phase 1 also existed, unfixed, in `ingest_data.py`'s shooting-percentage
calculation — `fg_pct`/`fg3_pct`/`ft_pct` were stored as literal Postgres
`NaN` (not `NULL`) whenever a player had 0 attempts (e.g. no 3-point
attempts that game: 27,808 of 134,960 rows). This didn't error on insert
(Postgres floats accept `NaN`), so Phase 1's verification missed it — it
surfaced when the `/trends` endpoint tried to JSON-serialize a response
containing one, since strict JSON has no `NaN` token. Fixed the same way
(cast to object dtype before replacing), re-ran ingestion + features, and
added a regression test (`test_trends_no_leakage_on_first_game_of_dataset`)
plus direct DB checks so this class of bug can't hide behind `IS NOT NULL`
again.

## Frontend

React 19 + TypeScript + Tailwind v4 + Recharts, built with Vite. Dark theme
only (a deliberate product choice, not a default awaiting a light mode) —
tokens come from the `dataviz` skill's validated reference palette, so
chart/series colors are colorblind-safe by construction rather than picked by
eye. `pts`/`reb`/`ast` keep a fixed color (blue/orange/aqua) everywhere in the
app; compared players take categorical slots in selection order.

| Page | Route | What it does |
|---|---|---|
| Dashboard | `/` | League leaders (pts/reb/ast) for the latest season, player search |
| Players | `/players` | Browse (paginated) or search the full player database |
| Player Profile | `/players/:id` | Career + season-by-season stats, L5/L10 trend chart with stat tabs |
| Compare | `/compare` | 2–6 players side-by-side, career or one season, bar chart + table |
| Matchup | `/matchup` | A player's history vs. one opponent, home/away split, game log |
| Predictions | `/predict` | Real UI wired to the real `/api/predict` endpoint — shows its honest 503 ("not trained yet") alongside real L10/season/matchup context pulled from other endpoints |

Structure: `src/api/client.ts` (typed fetch wrapper) → `src/hooks/useFetch.ts`
(loading/error state) → `src/pages/*` (one per route) → `src/components/*`
(shared: layout, autocomplete, team select, stat card, chart wrappers).
`src/types/api.ts` mirrors the backend Pydantic schemas by hand (no codegen
yet — keep both in sync when either changes).

Run it:
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (needs the backend running on :8000)
```

**Verification:** no interactive browser was available in this environment
(no Chrome extension connected), so this was tested with a headless
Playwright Chromium instead — `npm run smoke` (every route, fresh page,
captures console errors) and `npm run smoke:interactive` (fills in real
selections: a player + opponent on Matchup/Predict, two players on Compare)
write PNGs to `frontend/screenshots/` (gitignored) and print any console
errors per page.

**Two real bugs this verification caught and fixed:**
1. `PlayerAutocomplete`'s `excludeIds` prop defaulted via `= []`. A JS default
   parameter allocates a *new* array every time the function runs — including
   a re-render triggered by the component's *own* internal state, independent
   of its parent. That new reference fed the search-debounce effect's
   dependency array, re-triggering the effect every render: a self-sustaining
   infinite loop, entirely self-contained, whenever a caller omitted the prop
   (Dashboard, Matchup, Predict all did). It didn't surface on Compare only
   because there the prop was actually passed through from the parent.
   Fixed with a module-level constant array instead of a fresh literal.
2. (Not a bug, but worth recording:) a bar chart briefly screenshotted as
   empty — turned out to be Recharts' default ~1.5s enter animation caught
   mid-flight by a 1-second wait in the test script, not broken rendering
   (confirmed by re-reading the DOM: valid `<path>` geometry, correct resolved
   `fill` color, just not yet animated in). Disabled enter animations on all
   charts app-wide (`isAnimationActive={false}`) since instant rendering suits
   a dense analytics dashboard and makes automated verification deterministic.

## Setup

### Prerequisites
Python 3.13, Node 22 (for the frontend, once built). No system Postgres or
Docker required for local dev — see below.

### 1. Python environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Local Postgres
Homebrew's `postgresql@16` builds Postgres **and every dependency from
source** in this environment (no prebuilt bottle available), which can take
30–60+ minutes. Instead, a prebuilt Postgres.app binary (PG 16.16) is vendored
locally under `.tools/` — no system install, no sudo, no Docker:

```bash
scripts/pg_dev.sh start   # starts Postgres on localhost:5432
scripts/pg_dev.sh status
scripts/pg_dev.sh psql    # opens a psql shell
scripts/pg_dev.sh stop
```

(`.tools/` is gitignored — it's a local binary cache, not part of the repo.
On a machine with Docker available, use `docker-compose.yml`'s `db` service
instead and skip this step.)

The `courtiq` role/database were created once via:
```sql
CREATE ROLE courtiq WITH LOGIN PASSWORD 'courtiq_dev_password';
CREATE DATABASE courtiq OWNER courtiq;
```

### 3. Schema
```bash
cp .env.example .env   # adjust if needed
alembic upgrade head
```

### 4. Load data
```bash
PYTHONPATH=backend python scripts/ingest_data.py     # downloads + cleans + loads raw box scores
PYTHONPATH=backend python scripts/build_features.py  # computes leakage-safe rolling/matchup features
```

Both are idempotent (truncate-and-reload) — safe to re-run after a schema
change or to pick up newly played games in the current season.

## Verification (what's actually been tested, not just asserted)

- **Row counts:** 134,960 rows in both `player_game_stats` and
  `player_game_features` (1:1 as designed); 6,345 games; 1,084 players; 30 teams.
- **No leakage:** every player's very first game in the data has `NULL`
  rolling/season/matchup averages (checked by SQL query against the full table,
  zero violations) — there is no prior game to average, and the pipeline
  doesn't invent one.
- **Correctness against ground truth:** LeBron James' actual 2023-10-24
  season-opener box score (LAL @ DEN: 21 pts / 8 reb / 5 ast, 10-of-16 FG) is
  correctly stored; a manually-computed `AVG(pts)` SQL aggregate over his
  2023-24 games before 2024-01-01 (25.4194) matches the stored
  `pts_season_avg` feature value for his first game on/after 2024-01-01 to
  11 decimal places.
- **Data quality:** zero duplicate `(game_id, player_id)` pairs, zero
  `fgm > fga` (or 3P/FT equivalents), zero negative stats, zero nulls in the
  raw source — checked across all 134,960 source rows before load.

## Roadmap (not yet built)

- [x] FastAPI routes: players, search, game logs, season averages, compare, matchup, trends
- [ ] ML training pipeline: Linear/Multiple Regression + Random Forest for pts/reb/ast, time-based train/test split, MAE/RMSE/R² evaluation, then wire `predict_service.py` + `/api/predict` to it
- [x] React frontend: dashboard, player search, comparison, matchup analysis, predictions (built ahead of ML at the user's request; Predictions page shows real context + an honest "not trained yet" state)
