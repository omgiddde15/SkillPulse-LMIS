"""API endpoints for SkillPulse LMIS Reference Metadata & Taxonomy."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from app.api.v1.demand import get_demand_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Metadata"])

# Canonical centroid coordinates for the 6 pilot districts across 3 states
DISTRICT_CENTROIDS: Dict[str, Dict[str, float]] = {
    "MH_PUN": {"lat": 18.52, "lon": 73.86},
    "MH_MUM": {"lat": 19.08, "lon": 72.88},
    "KA_BLR_U": {"lat": 12.97, "lon": 77.59},
    "KA_DHA": {"lat": 15.46, "lon": 75.01},
    "TS_HYD": {"lat": 17.39, "lon": 78.49},
    "TS_MED": {"lat": 17.63, "lon": 78.48},
}


@router.get("/metadata")
def get_metadata() -> Dict[str, Any]:
    """Retrieve verified reference metadata: occupations, geographies, periods, and taxonomy."""
    service = get_demand_service()
    try:
        service.load_data()
    except Exception as exc:
        logger.exception("Failed to load metadata: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Underlying reference datasets could not be loaded.",
        )

    occupations: List[Dict[str, Any]] = []
    for occ in service._occupations.values():
        occupations.append({
            "occupation_id": occ.occupation_id,
            "occupation_title": occ.occupation_title,
            "sector": occ.sector,
            "trade": occ.trade,
            "nco_code": occ.nco_code,
            "nco_title": occ.nco_title,
            "qp_code": occ.qp_code,
            "qp_title": occ.qp_title,
            "nsqf_level": occ.nsqf_level,
        })

    geographies: List[Dict[str, Any]] = []
    for geo in service._geographies.values():
        coords = DISTRICT_CENTROIDS.get(geo.district_id, {"lat": 0.0, "lon": 0.0})
        geographies.append({
            "district_id": geo.district_id,
            "district_name": geo.district_name,
            "state_code": geo.state_code,
            "state_name": geo.state_name,
            "lat": coords["lat"],
            "lon": coords["lon"],
        })

    periods = service.get_available_periods()
    sectors = sorted(list({o.sector for o in service._occupations.values()}))

    return {
        "summary": {
            "total_occupations": len(occupations),
            "total_districts": len(geographies),
            "total_states": len({g["state_code"] for g in geographies}),
            "total_periods": len(periods),
            "period_start": periods[0] if periods else None,
            "period_end": periods[-1] if periods else None,
            "active_pilot_period": "2026-09",
            "is_synthetic": True,
            "dataset_provenance": "Synthetic demonstration dataset for SIH26246 (not official statistics)",
        },
        "occupations": occupations,
        "geographies": geographies,
        "sectors": sectors,
        "available_periods": periods,
    }
