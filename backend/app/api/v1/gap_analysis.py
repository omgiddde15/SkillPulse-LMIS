"""API endpoints for SkillPulse Relative Demand-Supply Gap Analysis Engine."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.gap_analysis import GapAnalysisService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Gap Analysis"])

_PERIOD_REGEX = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
_service: Optional[GapAnalysisService] = None

VALID_CLASSIFICATIONS = {"demand pressure", "supply pressure", "balanced / monitor"}
VALID_SORT_ORDERS = {"abs_mismatch", "demand_pressure", "supply_pressure"}


def get_gap_service() -> GapAnalysisService:
    """Dependency / accessor for GapAnalysisService singleton."""
    global _service
    if _service is None:
        _service = GapAnalysisService()
    return _service


@router.get("/gap-analysis")
def get_gap_analysis(
    period: Optional[str] = Query(
        default=None,
        description="Target monthly reporting period (format: YYYY-MM, e.g. '2026-09'). Defaults to latest available period.",
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
    classification: Optional[str] = Query(
        default=None,
        description="Optional classification filter ('Demand Pressure', 'Supply Pressure', 'Balanced / Monitor').",
    ),
    sort_by: str = Query(
        default="abs_mismatch",
        description="Sort order: 'abs_mismatch' (largest gap), 'demand_pressure' (highest positive mismatch), or 'supply_pressure' (lowest negative mismatch).",
    ),
    limit: Optional[int] = Query(
        default=None,
        ge=1,
        le=500,
        description="Optional maximum number of ranked records to return (minimum 1).",
    ),
) -> Dict[str, Any]:
    """Calculate and retrieve relative demand-supply mismatch scores and diagnostic alert classifications.
    
    Matches localized Demand Index with Training-Supply output percentile ranks for identical periods,
    districts, and occupations. Returns relative mismatch scores, alert classifications, underlying
    certification throughput volumes, cohort funnel metrics, index_data_coverage_pct, and separate
    placement follow-up maturity coverage (distinguishing matured vs pending tracking).
    """
    service = get_gap_service()

    try:
        service.demand_service.load_data()
        service.supply_service.load_data()
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Underlying dataset files not found. Ensure sample CSVs are properly generated.",
        )
    except Exception as exc:
        logger.exception("Failed to load dataset for gap analysis: %s", exc)
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
        available = service.supply_service.get_available_periods()
        if period_str not in available:
            raise HTTPException(
                status_code=400,
                detail=f"Period '{period_str}' not found in dataset. Available range: {available[0]} to {available[-1]}.",
            )
    else:
        period_str = None

    # 2. Validate state_code if provided
    if state_code is not None:
        sc_clean = state_code.strip().upper()
        valid_states = {g.state_code.upper() for g in service.supply_service._geographies.values()}
        if sc_clean not in valid_states:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid state_code '{state_code}'. Valid state codes: {sorted(valid_states)}.",
            )

    # 3. Validate district_id if provided
    if district_id is not None:
        dt_clean = district_id.strip().upper()
        valid_districts = {g.district_id.upper() for g in service.supply_service._geographies.values()}
        if dt_clean not in valid_districts:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid district_id '{district_id}'. Valid district IDs: {sorted(valid_districts)}.",
            )

    # 4. Validate sector if provided
    if sector is not None:
        sec_clean = sector.strip().lower()
        valid_sectors = {o.sector.lower() for o in service.supply_service._occupations.values()}
        if sec_clean not in valid_sectors:
            display_sectors = sorted({o.sector for o in service.supply_service._occupations.values()})
            raise HTTPException(
                status_code=400,
                detail=f"Invalid sector '{sector}'. Valid sectors: {display_sectors}.",
            )

    # 5. Validate classification if provided
    if classification is not None:
        cl_clean = classification.strip().lower()
        if cl_clean not in VALID_CLASSIFICATIONS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid classification '{classification}'. "
                    f"Valid classifications: ['Demand Pressure', 'Supply Pressure', 'Balanced / Monitor']."
                ),
            )

    # 6. Validate sort_by
    sort_clean = sort_by.strip().lower()
    if sort_clean not in VALID_SORT_ORDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort_by '{sort_by}'. Valid sort options: {sorted(VALID_SORT_ORDERS)}.",
        )

    # 7. Compute gap analysis
    try:
        result = service.calculate_gap_analysis(
            period=period_str,
            state_code=state_code,
            district_id=district_id,
            sector=sector,
            classification=classification,
            sort_by=sort_clean,
            limit=limit,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Error calculating relative demand-supply gap analysis: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred while calculating relative demand-supply gap analysis.",
        )
