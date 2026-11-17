from fastapi import APIRouter, HTTPException

from app.schemas.predict import PredictionRequest, PredictionResponse
from app.services.predict_service import predict, ModelsNotTrainedError

router = APIRouter(prefix="/api/predict", tags=["predict"])


@router.post("", response_model=PredictionResponse)
def predict_stats(request: PredictionRequest):
    """Predicted points/rebounds/assists for a player in an upcoming game.

    NOT YET AVAILABLE: returns 503 until the ML training pipeline (see
    project roadmap) has produced trained models. The request/response
    contract is final so the frontend can integrate against it now.
    """
    try:
        return predict(request.player_id, request.opponent_abbr, request.is_home)
    except ModelsNotTrainedError as e:
        raise HTTPException(status_code=503, detail=str(e))
