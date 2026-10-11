"""API endpoints for SkillPulse Training-Seat Allocation Simulator."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, status

from app.schemas.data_models import SeatSimulationRequest, SeatSimulationResponse
from app.services.seat_simulator import SeatSimulatorService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Seat Simulator"])

_service: Optional[SeatSimulatorService] = None


def get_simulator_service() -> SeatSimulatorService:
    """Dependency / accessor for SeatSimulatorService singleton."""
    global _service
    if _service is None:
        _service = SeatSimulatorService()
    return _service


@router.post(
    "/simulations/seat-allocation",
    response_model=SeatSimulationResponse,
    status_code=status.HTTP_200_OK,
    summary="Simulate regional training-seat adjustments and evaluate future mismatch impacts",
)
def simulate_seat_allocation(payload: SeatSimulationRequest) -> Dict[str, Any]:
    """Simulate future training-seat allocation scenarios for a target district and occupation.
    
    Evaluates:
    1. Historical baseline sanctioned seats across the trailing three cohort periods.
    2. Empirical training pipeline funnel yields (utilization, completion, certification).
    3. Proportional scaling of forecast certified candidate throughput at horizon h.
    4. Recalculation of cross-sectional regional supply percentile ranks.
    5. Net delta on projected relative mismatch score and classification.
    """
    service = get_simulator_service()

    try:
        service.load_data()
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Underlying dataset files not found. Ensure sample CSVs are properly generated.",
        )
    except Exception as exc:
        logger.exception("Failed to load simulator data: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load simulator data due to an internal server error.",
        )

    # 1. Validate period exists if provided
    available_periods = service.get_available_periods()
    if payload.period is not None:
        p_clean = payload.period.strip()
        if p_clean not in available_periods:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Period '{p_clean}' not found in dataset. Available range: {available_periods[0]} to {available_periods[-1]}.",
            )
        target_period = p_clean
    else:
        target_period = available_periods[-1]

    # 2. Validate district_id exists
    d_clean = payload.district_id.strip().upper()
    if d_clean not in service._geographies:
        valid_districts = sorted(service._geographies.keys())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid district_id '{payload.district_id}'. Valid district codes: {valid_districts}.",
        )

    # 3. Validate occupation_id exists
    o_clean = payload.occupation_id.strip().upper()
    if o_clean not in service._occupations:
        valid_occupations = sorted(service._occupations.keys())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid occupation_id '{payload.occupation_id}'. Valid occupation IDs: {valid_occupations}.",
        )

    # 4. Execute simulation
    try:
        result = service.simulate_seat_allocation(
            period=target_period,
            horizon_months=payload.horizon_months,
            district_id=d_clean,
            occupation_id=o_clean,
            proposed_seats_per_cohort=payload.proposed_seats_per_cohort,
            posting_to_opening_multiplier=payload.posting_to_opening_multiplier,
            local_availability_factor=payload.local_availability_factor,
        )
        return result
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as exc:
        logger.exception("Seat allocation simulation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Seat allocation simulation failed due to an internal server error.",
        )
