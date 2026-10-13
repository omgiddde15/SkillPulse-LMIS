"""Career Profile and Resume API routes for SkillPulse.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status

from app.api.deps import get_current_user
from app.schemas.career_models import (
    CareerProfileCreateOrUpdate,
    CareerProfileResponse,
    ResumeMetadataResponse,
    ResumeReviewRequest,
    UserSkillCreate,
    UserSkillUpdate,
    UserSkillResponse,
    TargetRoleSummaryResponse,
    SkillGapAnalysisResponse,
    RoadmapGenerateRequest,
    MilestoneStatusUpdateRequest,
    RoadmapDetailResponse,
    RoadmapSummaryResponse,
)
from app.services.career_service import CareerService, CareerServiceError
from app.services.resume_parser import (
    parse_resume_content,
    ResumeParsingError,
    MAX_FILE_SIZE,
)
from app.services.role_catalogue import get_supported_roles, get_role_by_id
from app.services.skill_gap_service import SkillGapService
from app.services.opportunity_service import OpportunityService
from app.services.opportunity_matching import OpportunityMatchingEngine
from app.services.roadmap_service import RoadmapService

router = APIRouter(prefix="/career", tags=["Career Guidance"])
career_service = CareerService()
skill_gap_service = SkillGapService(career_service)
opportunity_service = OpportunityService()
opportunity_matcher = OpportunityMatchingEngine(career_service, skill_gap_service, opportunity_service)
roadmap_service = RoadmapService(career_service, skill_gap_service, opportunity_service)


@router.get("/profile")
def get_user_profile(
    current_user: dict = Depends(get_current_user)
):
    """Retrieves the authenticated user's career profile."""
    profile = career_service.get_profile(current_user["id"])
    if not profile:
        return {
            "has_profile": False,
            "profile": None,
        }
    return {
        "has_profile": True,
        "profile": profile,
    }


@router.put("/profile", status_code=status.HTTP_200_OK)
def update_user_profile(
    payload: CareerProfileCreateOrUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Creates or updates the authenticated user's career profile."""
    try:
        updated = career_service.save_or_update_profile(
            user_id=current_user["id"],
            payload=payload.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except CareerServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist career profile.",
        )

    return {
        "status": "success",
        "message": "Career profile saved successfully.",
        "profile": updated,
    }


@router.post("/resume", status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Uploads a text-based PDF resume, validates structure, and heuristically extracts fields."""
    # 1. Validate file extension
    filename = file.filename or "resume.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents are supported. Please upload a .pdf file.",
        )

    # 2. Read bytes with stream size enforcement
    chunk_size = 64 * 1024  # 64 KiB
    content = bytearray()

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        content.extend(chunk)
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum allowed size of 5 MiB.",
            )

    file_bytes = bytes(content)

    # 3. Parse and extract text
    try:
        parsed_data = parse_resume_content(file_bytes)
    except ResumeParsingError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to parse PDF document. The file may be corrupted, encrypted, or contain unsupported formatting.",
        )

    # 4. Save to private storage and database
    try:
        saved_resume = career_service.save_resume(
            user_id=current_user["id"],
            original_filename=filename,
            file_bytes=file_bytes,
            parsed_data=parsed_data,
        )
    except CareerServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store resume securely.",
        )

    return {
        "status": "success",
        "message": "Resume uploaded and parsed successfully. Please review the extracted information.",
        "resume": saved_resume,
    }


@router.get("/resume/latest")
def get_latest_resume(
    current_user: dict = Depends(get_current_user)
):
    """Retrieves metadata and parsed content for the user's latest resume."""
    resume = career_service.get_latest_resume(current_user["id"])
    if not resume:
        return {
            "has_resume": False,
            "resume": None,
        }
    return {
        "has_resume": True,
        "resume": resume,
    }


@router.put("/resume/{resume_id}/review", status_code=status.HTTP_200_OK)
def review_resume(
    resume_id: int,
    payload: ResumeReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    """Saves user-corrected parsed data and marks the resume as reviewed."""
    updated = career_service.review_resume(
        user_id=current_user["id"],
        resume_id=resume_id,
        reviewed_data=payload.model_dump(),
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found.",
        )

    return {
        "status": "success",
        "message": "Resume review confirmed and saved.",
        "resume": updated,
    }


@router.delete("/resume/{resume_id}")
def delete_resume(
    resume_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Deletes a resume file from private storage and purges the database record."""
    try:
        deleted = career_service.delete_resume(
            user_id=current_user["id"],
            resume_id=resume_id,
        )
    except CareerServiceError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete resume file.",
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found.",
        )

    return {
        "status": "success",
        "message": "Resume deleted successfully.",
    }


# -----------------------------------------------------------------------------
# Phase 2: User Skill Evidence Endpoints
# -----------------------------------------------------------------------------

@router.get("/skills", status_code=status.HTTP_200_OK)
def list_user_skills(
    current_user: dict = Depends(get_current_user),
):
    """Retrieves all registered skills and evidence statuses for the authenticated user."""
    skills = career_service.get_user_skills(current_user["id"])
    return {
        "status": "success",
        "count": len(skills),
        "skills": skills,
    }


@router.post("/skills", status_code=status.HTTP_201_CREATED)
def create_user_skill(
    payload: UserSkillCreate,
    current_user: dict = Depends(get_current_user),
):
    """Adds a new self-claimed or evidenced skill to the authenticated user's profile."""
    try:
        skill = career_service.add_user_skill(current_user["id"], payload.model_dump())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except CareerServiceError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save user skill.",
        )
    return {
        "status": "success",
        "message": f"Skill '{skill['skill_name']}' registered successfully.",
        "skill": skill,
    }


@router.put("/skills/{skill_id}", status_code=status.HTTP_200_OK)
def update_user_skill(
    skill_id: int,
    payload: UserSkillUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Updates an existing skill claim or evidence context for the authenticated user."""
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    try:
        updated = career_service.update_user_skill(current_user["id"], skill_id, update_data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except CareerServiceError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user skill.",
        )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill record not found.",
        )

    return {
        "status": "success",
        "message": "Skill evidence updated successfully.",
        "skill": updated,
    }


@router.delete("/skills/{skill_id}", status_code=status.HTTP_200_OK)
def delete_user_skill(
    skill_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Removes a skill from the authenticated user's profile."""
    deleted = career_service.delete_user_skill(current_user["id"], skill_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill record not found.",
        )
    return {
        "status": "success",
        "message": "Skill removed successfully.",
    }


# -----------------------------------------------------------------------------
# Phase 2: Role Catalogue & Skill-Gap Endpoints
# -----------------------------------------------------------------------------

@router.get("/roles", status_code=status.HTTP_200_OK)
def list_supported_roles():
    """Lists all supported starter role profiles with required/preferred counts and provenance."""
    roles = get_supported_roles()
    return {
        "status": "success",
        "count": len(roles),
        "roles": roles,
    }


@router.get("/roles/{role_id}", status_code=status.HTTP_200_OK)
def get_role_details(role_id: str):
    """Retrieves full specification and required skills for a supported role profile."""
    role = get_role_by_id(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role profile '{role_id}' not found in the supported catalogue.",
        )
    return {
        "status": "success",
        "role": role,
    }


@router.get("/skill-gaps", status_code=status.HTTP_200_OK)
def get_skill_gap_analysis(
    role_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Calculates deterministic explainable skill-gap analysis for the authenticated user.
    
    If role_id is not specified, attempts to use the user's benchmark occupation or defaults to ROLE_PY_BACKEND.
    """
    selected_role_id = role_id
    if not selected_role_id:
        profile = career_service.get_profile(current_user["id"])
        if profile and profile.get("target_occupation_id"):
            occ_id = profile["target_occupation_id"]
            for r in get_supported_roles():
                if r.get("benchmark_occupation_id") == occ_id:
                    selected_role_id = r["role_id"]
                    break
        if not selected_role_id:
            selected_role_id = "ROLE_PY_BACKEND"

    analysis = skill_gap_service.analyze_gap_for_user(
        user_id=current_user["id"],
        role_id=selected_role_id,
    )
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role profile '{selected_role_id}' is not in the supported role catalogue. Custom roles are preserved in your profile; pre-configured skill benchmarks are available for supported starter roles.",
        )

    return analysis


# -----------------------------------------------------------------------------
# Phase 3: Verified Opportunity Catalogue & Recommendations Endpoints
# -----------------------------------------------------------------------------

@router.get("/sources", status_code=status.HTTP_200_OK)
def list_opportunity_sources():
    """Retrieves all registered trusted official source directories."""
    sources = opportunity_service.get_sources()
    return {
        "status": "success",
        "count": len(sources),
        "sources": sources,
    }


@router.get("/opportunities", status_code=status.HTTP_200_OK)
def list_opportunities(
    opportunity_type: Optional[str] = None,
    record_kind: Optional[str] = None,
    search: Optional[str] = None,
    role_id: Optional[str] = None,
    skill_key: Optional[str] = None,
    location_state: Optional[str] = None,
    work_mode: Optional[str] = None,
    fee_status: Optional[str] = None,
    listing_status: Optional[str] = None,
    verification_status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """Searches and filters the opportunity catalogue with pagination and freshness checks."""
    results = opportunity_service.get_opportunities(
        opportunity_type=opportunity_type,
        record_kind=record_kind,
        search=search,
        role_id=role_id,
        skill_key=skill_key,
        location_state=location_state,
        work_mode=work_mode,
        fee_status=fee_status,
        listing_status=listing_status,
        verification_status=verification_status,
        limit=limit,
        offset=offset,
    )
    return {
        "status": "success",
        **results,
    }


@router.get("/opportunities/{opportunity_id}", status_code=status.HTTP_200_OK)
def get_opportunity_detail(opportunity_id: str):
    """Retrieves full specification for an opportunity catalogue item."""
    item = opportunity_service.get_opportunity_by_id(opportunity_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Opportunity record '{opportunity_id}' not found in the catalogue.",
        )
    return {
        "status": "success",
        "opportunity": item,
    }


@router.get("/recommendations", status_code=status.HTTP_200_OK)
def get_personalized_recommendations(
    target_role_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Calculates deterministic personalized recommendations for the authenticated candidate."""
    recs = opportunity_matcher.get_recommendations_for_user(
        user_id=current_user["id"],
        target_role_id=target_role_id,
    )
    return {
        "status": "success",
        **recs,
    }


# -----------------------------------------------------------------------------
# Phase 4: Personalized Career Roadmap Endpoints
# -----------------------------------------------------------------------------

@router.post("/roadmaps/generate", status_code=status.HTTP_201_CREATED, response_model=RoadmapDetailResponse)
def generate_and_save_roadmap(
    payload: RoadmapGenerateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generates and persists an explainable personalized career roadmap.
    
    Uses deterministic gap analysis and verified catalogue items, enriched with
    Gemini 3.8 Flash assistance when AI consent is active and the API key is configured.
    """
    try:
        generated = roadmap_service.generate_roadmap(
            user_id=current_user["id"],
            target_role_id=payload.target_role_id,
            horizon_days=payload.horizon_days,
        )
        saved = roadmap_service.save_roadmap(
            user_id=current_user["id"],
            roadmap_data=generated,
            client_request_token=payload.client_request_token,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate career roadmap.",
        )

    return saved


@router.get("/roadmaps", status_code=status.HTTP_200_OK)
def list_user_roadmaps(
    current_user: dict = Depends(get_current_user),
):
    """Retrieves list of all saved career roadmaps for the authenticated candidate."""
    roadmaps = roadmap_service.get_user_roadmaps(current_user["id"])
    return {
        "status": "success",
        "count": len(roadmaps),
        "roadmaps": roadmaps,
    }


@router.get("/roadmaps/{roadmap_id}", status_code=status.HTTP_200_OK, response_model=RoadmapDetailResponse)
def get_roadmap_detail(
    roadmap_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves full details of a saved roadmap including milestones and verified resources.
    
    Enforces user ownership. Does not disclose other users' roadmaps (returns 404).
    """
    roadmap = roadmap_service.get_roadmap_by_id(current_user["id"], roadmap_id)
    if not roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career roadmap not found.",
        )
    return roadmap


@router.delete("/roadmaps/{roadmap_id}", status_code=status.HTTP_200_OK)
def delete_user_roadmap(
    roadmap_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Deletes a career roadmap and cascaded milestones.
    
    Enforces user ownership. Does not disclose other users' roadmaps (returns 404).
    """
    success = roadmap_service.delete_roadmap(current_user["id"], roadmap_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career roadmap not found.",
        )
    return {
        "status": "success",
        "message": "Career roadmap deleted successfully.",
    }


@router.patch("/roadmaps/{roadmap_id}/milestones/{milestone_id}", status_code=status.HTTP_200_OK)
def update_milestone_completion(
    roadmap_id: int,
    milestone_id: int,
    payload: MilestoneStatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Updates the completion state of a specific milestone in the user's roadmap.
    
    Enforces user ownership. Returns 404 if the roadmap or milestone is not found or unauthorized.
    """
    updated = roadmap_service.update_milestone_status(
        user_id=current_user["id"],
        roadmap_id=roadmap_id,
        milestone_id=milestone_id,
        is_completed=payload.is_completed,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roadmap milestone not found.",
        )
    return {
        "status": "success",
        "milestone": updated,
    }



