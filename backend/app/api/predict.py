from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.predict import PredictionRequest, PredictionResponse
from app.services.predict_service import predict, ModelsNotTrainedError

router = APIRouter(prefix="/api/predict", tags=["predict"])


@router.post("", response_model=PredictionResponse)
def predict_stats(request: PredictionRequest, db: Session = Depends(get_db)):
    """Predicted points/rebounds/assists for a player in an upcoming game,
    using whichever trained model (linear/multiple-linear/random-forest) had
    the lowest measured MAE on the held-out test set for each stat. Returns
    503 if `scripts/train_models.py` hasn't been run yet."""
    try:
        result = predict(db, request.player_id, request.opponent_abbr, request.is_home)
    except ModelsNotTrainedError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return PredictionResponse(
        player_id=request.player_id,
        opponent_abbr=request.opponent_abbr.upper(),
        is_home=request.is_home,
        pts=result["pts"],
        reb=result["reb"],
        ast=result["ast"],
        model_info=result["model_info"],
    )
