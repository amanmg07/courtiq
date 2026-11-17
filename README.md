# CourtIQ

A full-stack NBA analytics and predictive modeling platform: player search,
multi-player comparison, opponent matchup analysis, trend exploration, and
ML-based predictions for points/rebounds/assists.

**Status:** Phase 1 complete — database schema, data ingestion pipeline, and
leakage-safe feature engineering pipeline are built, loaded, and verified.
Backend API, ML models, and frontend are not yet built (see Roadmap).

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

- [ ] FastAPI routes: players, search, game logs, season averages, compare, matchup, trends, predict
- [ ] ML training pipeline: Linear/Multiple Regression + Random Forest for pts/reb/ast, time-based train/test split, MAE/RMSE/R² evaluation
- [ ] React frontend: dashboard, player search, comparison, matchup analysis, predictions
