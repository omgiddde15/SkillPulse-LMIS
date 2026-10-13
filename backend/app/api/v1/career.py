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
)
from app.services.career_service import CareerService, CareerServiceError
from app.services.resume_parser import (
    parse_resume_content,
    ResumeParsingError,
    MAX_FILE_SIZE,
)

router = APIRouter(prefix="/career", tags=["Career Guidance"])
career_service = CareerService()


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
            detail="Resume not found or access denied.",
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
            detail="Resume not found or access denied.",
        )

    return {
        "status": "success",
        "message": "Resume deleted successfully.",
    }
