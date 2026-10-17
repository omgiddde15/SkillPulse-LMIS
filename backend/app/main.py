from pathlib import Path
from dotenv import load_dotenv

# Load local environment configuration if present
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path)
else:
    load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.alerts import router as alerts_router
from app.api.v1.auth import router as auth_router
from app.api.v1.career import router as career_router
from app.api.v1.demand import router as demand_router
from app.api.v1.forecasts import router as forecasts_router
from app.api.v1.gap_analysis import router as gap_router
from app.api.v1.metadata import router as metadata_router
from app.api.v1.policy_copilot import router as policy_copilot_router
from app.api.v1.scenarios import router as scenarios_router
from app.api.v1.seat_simulator import router as simulator_router
from app.db import init_db

init_db()

app = FastAPI(
    title="SkillPulse LMIS",
    description="AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine (SIH 2026 - PS SIH26246)",
    version="0.1.0",
)

# CORS configuration for local development and deployed frontends (e.g. Vercel)
_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_env_origins = os.getenv("FRONTEND_ORIGIN")
if _env_origins:
    for _origin in _env_origins.split(","):
        _trimmed = _origin.strip().rstrip("/")
        if _trimmed and _trimmed not in _allowed_origins:
            _allowed_origins.append(_trimmed)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(career_router, prefix="/api/v1")
app.include_router(scenarios_router, prefix="/api/v1")
app.include_router(demand_router, prefix="/api/v1")
app.include_router(gap_router, prefix="/api/v1")
app.include_router(forecasts_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(simulator_router, prefix="/api/v1")
app.include_router(policy_copilot_router, prefix="/api/v1")
app.include_router(metadata_router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {
        "project": "SkillPulse LMIS",
        "description": "AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
