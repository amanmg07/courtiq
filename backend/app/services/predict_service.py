"""
Predictive statistics service.

NOT YET IMPLEMENTED: the ML training pipeline (Linear/Multiple Regression and
Random Forest models for pts/reb/ast, per the project roadmap) has not been
built or trained yet. Rather than fabricate a prediction or accuracy numbers,
this raises so the API route can return a clear, honest 503 until real
trained models are wired in here.
"""


class ModelsNotTrainedError(Exception):
    pass


def predict(player_id: int, opponent_abbr: str, is_home: bool):
    raise ModelsNotTrainedError(
        "Prediction models have not been trained yet. This endpoint's contract "
        "(request/response shape) is final; only this function's body will "
        "change once ml/training produces pts/reb/ast models."
    )
