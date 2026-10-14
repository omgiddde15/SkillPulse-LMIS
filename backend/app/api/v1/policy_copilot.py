"""API endpoints for SkillPulse Policy Copilot Analytical Engine."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, status

from app.schemas.data_models import PolicyCopilotQueryRequest, PolicyCopilotQueryResponse
from app.services.policy_copilot_service import PolicyCopilotService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Policy Copilot"])

_service: Optional[PolicyCopilotService] = None


def get_policy_copilot_service() -> PolicyCopilotService:
    """Dependency accessor for PolicyCopilotService singleton."""
    global _service
    if _service is None:
        _service = PolicyCopilotService()
    return _service


@router.post(
    "/policy-copilot/query",
    response_model=PolicyCopilotQueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Process natural language or preset policy inquiry deterministically",
)
def process_policy_copilot_query(payload: PolicyCopilotQueryRequest) -> PolicyCopilotQueryResponse:
    """Execute deterministic, source-grounded policy analytics for a user query or preset inquiry.
    
    Adheres strictly to the SkillPulse Grounded Analytical Engine architecture:
    1. Validates query string presence (non-empty, non-whitespace).
    2. Resolves reporting period, geography, and occupational context.
    3. Traverses conversational history to resolve follow-up questions.
    4. Evaluates live data models across demand index, gap analysis, early warnings,
       forecasting benchmarks, and seat allocation simulations.
    5. Formulates structured, explainable responses with evidence, sources, and suggested follow-ups.
    """
    clean_query = payload.query.strip()
    if not clean_query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Query string cannot be empty or contain only whitespace.",
        )

    try:
        service = get_policy_copilot_service()
        result = service.process_query(
            query=clean_query,
            period=payload.period,
            state_code=payload.state_code,
            district_id=payload.district_id,
            sector=payload.sector,
            history=payload.history,
            language=payload.language or "en",
        )
        return PolicyCopilotQueryResponse(**result)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )
    except Exception as exc:
        logger.exception("Failed to process policy copilot query: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while evaluating the policy analytics query.",
        )
