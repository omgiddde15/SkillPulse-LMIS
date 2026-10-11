from fastapi import FastAPI

from app.api.v1.alerts import router as alerts_router
from app.api.v1.demand import router as demand_router
from app.api.v1.forecasts import router as forecasts_router
from app.api.v1.gap_analysis import router as gap_router
from app.api.v1.seat_simulator import router as simulator_router

app = FastAPI(
    title="SkillPulse LMIS",
    description="AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine (SIH 2026 - PS SIH26246)",
    version="0.1.0",
)

app.include_router(demand_router, prefix="/api/v1")
app.include_router(gap_router, prefix="/api/v1")
app.include_router(forecasts_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(simulator_router, prefix="/api/v1")


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
