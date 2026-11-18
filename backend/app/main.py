"""FastAPI application entrypoint. Routers are added incrementally as built."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api import players, compare, predict, teams, leaders

settings = get_settings()

app = FastAPI(
    title="CourtIQ API",
    description="NBA analytics and predictive modeling platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


app.include_router(teams.router)
app.include_router(players.router)
app.include_router(compare.router)
app.include_router(predict.router)
app.include_router(leaders.router)
