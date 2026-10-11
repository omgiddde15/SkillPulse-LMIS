"""API endpoints for SkillPulse Demand and Supply Forecasting Engine."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.forecasting import ForecastingService, SUPPORTED_HORIZONS

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Forecasting"])

_PERIOD_REGEX = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
_service: Optional[ForecastingService] = None


def get_forecasting_service() -> ForecastingService:
    """Dependency / accessor for ForecastingService singleton."""
    global _service
    if _service is None:
        _service = ForecastingService()
    return _service


@router.get("/forecasts")
def get_forecasts(
    period: Optional[str] = Query(
        default=None,
        description="Base cutoff period for training (format: YYYY-MM, e.g. '2026-09'). Defaults to latest available period.",
    ),
    horizon: Optional[int] = Query(
        default=None,
        description="Forecast horizon in months: 3, 6, or 12. If omitted, returns all supported horizons.",
    ),
    state_code: Optional[str] = Query(
        default=None,
        description="Optional state code filter (e.g. 'MH', 'KA', 'TS').",
    ),
    district_id: Optional[str] = Query(
        default=None,
        description="Optional district ID filter (e.g. 'MH_PUN', 'KA_BLR_U').",
    ),
    sector: Optional[str] = Query(
        default=None,
        description="Optional sector filter (e.g. 'IT/ITeS', 'Manufacturing', 'Logistics').",
    ),
    limit: Optional[int] = Query(
        default=None,
        ge=1,
        le=500,
        description="Optional maximum number of forecast records to return (minimum 1, maximum 500).",
    ),
) -> Dict[str, Any]:
    """Retrieve demand and supply forecasts, empirical prediction intervals, and projected relative mismatch scores.
    
    Generates:
    1. Online job postings count (non-negative integer).
    2. Certified-candidate throughput (non-negative expected count).
    3. Projected relative mismatch = forecast demand percentile rank minus forecast supply-output percentile rank.
    """
    service = get_forecasting_service()

    try:
        service.load_data()
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Underlying dataset files not found. Ensure sample CSVs are properly generated.",
        )
    except Exception as exc:
        logger.exception("Failed to load dataset for forecasts: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to load dataset due to an internal server error.",
        )

    # 1. Validate period format if provided
    if period is not None:
        period_str = period.strip()
        if not _PERIOD_REGEX.match(period_str):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid period format '{period}'. Expected 'YYYY-MM' (e.g., '2026-09').",
            )
        available = service.get_available_periods()
        if period_str not in available:
            raise HTTPException(
                status_code=400,
                detail=f"Period '{period_str}' not found in dataset. Available range: {available[0]} to {available[-1]}.",
            )
    else:
        period_str = None

    # 2. Validate horizon if provided
    if horizon is not None:
        if horizon not in SUPPORTED_HORIZONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid horizon '{horizon}'. Supported horizons: {SUPPORTED_HORIZONS} months.",
            )

    # 3. Validate state_code if provided
    if state_code is not None:
        sc_clean = state_code.strip().upper()
        valid_states = {g.state_code.upper() for g in service._geographies.values()}
        if sc_clean not in valid_states:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid state_code '{state_code}'. Valid state codes: {sorted(valid_states)}.",
            )

    # 4. Validate district_id if provided
    if district_id is not None:
        dt_clean = district_id.strip().upper()
        valid_districts = {g.district_id.upper() for g in service._geographies.values()}
        if dt_clean not in valid_districts:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid district_id '{district_id}'. Valid district IDs: {sorted(valid_districts)}.",
            )

    # 5. Validate sector if provided
    if sector is not None:
        sec_clean = sector.strip().lower()
        valid_sectors = {o.sector.lower() for o in service._occupations.values()}
        if sec_clean not in valid_sectors:
            display_sectors = sorted({o.sector for o in service._occupations.values()})
            raise HTTPException(
                status_code=400,
                detail=f"Invalid sector '{sector}'. Valid sectors: {display_sectors}.",
            )

    # 6. Compute forecasts
    try:
        result = service.calculate_forecasts(
            base_period=period_str,
            horizon=horizon,
            state_code=state_code,
            district_id=district_id,
            sector=sector,
            limit=limit,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Error generating forecasts: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred while generating forecasts.",
        )
