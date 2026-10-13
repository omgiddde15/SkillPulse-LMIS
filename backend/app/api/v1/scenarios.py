"""Scenario API endpoints for SkillPulse LMIS.

Allows authenticated users to manage their saved Seat Simulator scenarios.
Strictly isolates user data: Demo users and other accounts cannot read, mutate,
or delete other users' scenarios.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.services.scenario_service import ScenarioService

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])
scenario_service = ScenarioService()


class CreateScenarioRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    notes: Optional[str] = Field(None, max_length=1000)
    period: str = Field(..., max_length=10)
    district_id: str = Field(..., max_length=50)
    district_name: Optional[str] = Field(None, max_length=100)
    state_code: Optional[str] = Field(None, max_length=10)
    occupation_id: str = Field(..., max_length=50)
    occupation_title: Optional[str] = Field(None, max_length=150)
    horizon_months: int = Field(..., ge=1, le=24)
    proposed_seats_per_cohort: int = Field(..., ge=1, le=5000)
    posting_to_opening_multiplier: float = Field(default=1.0, ge=0.1, le=5.0)
    local_availability_factor: float = Field(default=1.0, ge=0.1, le=1.0)
    inputs: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None


@router.get("")
def list_scenarios(current_user: dict = Depends(get_current_user)):
    """Retrieves all saved scenarios for the authenticated user."""
    scenarios = scenario_service.list_scenarios(current_user["id"])
    return {
        "count": len(scenarios),
        "results": scenarios,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_scenario(
    payload: CreateScenarioRequest,
    current_user: dict = Depends(get_current_user),
):
    """Saves a simulation scenario for the authenticated user."""
    try:
        scenario = scenario_service.save_scenario(
            user_id=current_user["id"],
            payload=payload.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return {
        "status": "success",
        "message": "Scenario saved to your workspace.",
        "scenario": scenario,
    }


@router.get("/{scenario_id}")
def get_scenario_detail(
    scenario_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves a single scenario by ID, strictly enforcing user ownership."""
    scenario = scenario_service.get_scenario(scenario_id, current_user["id"])
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found or access denied.",
        )
    return scenario


@router.delete("/{scenario_id}")
def delete_scenario(
    scenario_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Deletes a saved scenario, strictly enforcing user ownership."""
    deleted = scenario_service.delete_scenario(scenario_id, current_user["id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found or access denied.",
        )
    return {
        "status": "success",
        "message": "Scenario deleted successfully.",
    }
