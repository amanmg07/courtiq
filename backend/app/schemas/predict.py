from pydantic import BaseModel


class PredictionRequest(BaseModel):
    player_id: int
    opponent_abbr: str
    is_home: bool = True
    # season is implicit: predictions always use the most recent data available


class StatPrediction(BaseModel):
    predicted: float
    recent_avg_l10: float | None
    season_avg: float | None
    mae: float  # model's measured mean absolute error on held-out test data


class PredictionResponse(BaseModel):
    player_id: int
    opponent_abbr: str
    is_home: bool
    pts: StatPrediction
    reb: StatPrediction
    ast: StatPrediction
    model_info: str
