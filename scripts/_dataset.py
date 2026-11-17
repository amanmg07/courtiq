"""
Shared loader for the CourtIQ source dataset: cbratkovics/nba-game-logs on the
Hugging Face Hub (a public, un-gated backfill of the Kaggle "NBA Dataset: Box
Scores and Stats" by Eoin Moore, resolved to one clean row per player per
regular-season game). No auth/API key required.

Only the `game_logs/game_logs_<season>.parquet` files are used -- the repo
also contains an unrelated betting/model-ops pipeline (gold/, replay/,
drift/, ledger/ folders) belonging to the dataset author's own project.
"""
from pathlib import Path

import pandas as pd
from huggingface_hub import hf_hub_download

REPO_ID = "cbratkovics/nba-game-logs"
SEASONS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26", "2026-27"]

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"


def load_all_seasons(seasons: list[str] = SEASONS) -> pd.DataFrame:
    """Downloads (and locally caches under data/raw/) each season's parquet
    file and returns them concatenated into one DataFrame."""
    frames = []
    for season in seasons:
        path = hf_hub_download(
            repo_id=REPO_ID,
            repo_type="dataset",
            filename=f"game_logs/game_logs_{season}.parquet",
            local_dir=str(RAW_DIR),
        )
        frames.append(pd.read_parquet(path))
    return pd.concat(frames, ignore_index=True)
