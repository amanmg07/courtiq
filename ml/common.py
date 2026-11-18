"""
Shared between the training script (scripts/train_models.py) and the backend
inference service (backend/app/services/predict_service.py) -- both must
agree on exactly which features a model expects, in what order. Keeping this
one list in one place (rather than copy-pasted) is the point of this file.
"""

# Must match player_game_features columns (see backend/app/db/models.py) --
# every one of these is leakage-safe: computed only from games strictly
# before the row's own game (see scripts/build_features.py).
FEATURE_COLUMNS = [
    "games_played_career_to_date",
    "days_rest",
    "is_home",
    "is_back_to_back", "home_stand_streak",
    "pts_l5_avg", "reb_l5_avg", "ast_l5_avg", "min_l5_avg",
    "pts_l10_avg", "reb_l10_avg", "ast_l10_avg", "min_l10_avg",
    "pts_season_avg", "reb_season_avg", "ast_season_avg", "min_season_avg",
    "pts_home_avg", "pts_away_avg",
    "opp_pts_allowed_avg", "opp_reb_allowed_avg", "opp_ast_allowed_avg",
    "matchup_pts_avg", "matchup_reb_avg", "matchup_ast_avg", "matchup_games_played",
]

# Columns that are booleans in Postgres and need an explicit int cast after
# pd.read_sql (sklearn wants numeric, not Python bool objects in a mixed
# dtype frame going through SimpleImputer/StandardScaler).
BOOLEAN_FEATURE_COLUMNS = ["is_home", "is_back_to_back"]

TARGETS = ["pts", "reb", "ast"]

# Train on earlier seasons, test on the most recent ones -- a genuine
# time-based split (never random), per the project spec: the model must
# never be evaluated on a game chronologically earlier than one it trained on.
TRAIN_SEASONS = ["2021-22", "2022-23", "2023-24", "2024-25"]
TEST_SEASONS = ["2025-26", "2026-27"]

MODELS_DIR_NAME = "ml/models"  # relative to project root
