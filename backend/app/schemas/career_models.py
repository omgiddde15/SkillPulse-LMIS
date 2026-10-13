"""Pydantic schemas for SkillPulse Career Profile and Resume Processing."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class CareerProfileCreateOrUpdate(BaseModel):
    """Payload for creating or updating a candidate's personal career profile."""
    target_role_title: str = Field(..., min_length=2, max_length=150, description="Target career role title (e.g., Embedded Software Engineer)")
    target_occupation_id: Optional[str] = Field(None, max_length=64, description="Optional canonical occupation reference ID (e.g., OCC_IT_001)")
    target_sector: Optional[str] = Field(None, max_length=64, description="Primary industry sector (e.g., IT/ITeS, Manufacturing, Logistics)")
    current_education_level: Optional[str] = Field(None, max_length=64, description="Highest qualification level (e.g., B.Tech, ITI, Diploma)")
    institution_name: Optional[str] = Field(None, max_length=150, description="College, university or vocational training institute name")
    graduation_year: Optional[int] = Field(None, ge=1960, le=2035, description="Year of completion or expected graduation")
    years_experience: float = Field(default=0.0, ge=0.0, le=60.0, description="Cumulative years of professional or apprentice experience")
    current_state: Optional[str] = Field(None, max_length=10, description="State code (e.g., KA, MH, TS)")
    current_district: Optional[str] = Field(None, max_length=50, description="Current residential or working district ID (e.g., KA_BLR_U)")
    preferred_locations: Optional[List[str]] = Field(default_factory=list, description="List of preferred work or training district codes/names")
    consent_ai_processing: bool = Field(default=False, description="Explicit opt-in consent for future external AI processing (default: False)")

    @field_validator("target_role_title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("Target role title must be at least 2 characters.")
        return clean

    @field_validator("preferred_locations", mode="before")
    @classmethod
    def validate_locations(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return [str(item).strip() for item in v if str(item).strip()]
        return []


class CareerProfileResponse(BaseModel):
    """API response envelope for user's career profile."""
    id: int
    user_id: int
    target_role_title: str
    target_occupation_id: Optional[str] = None
    target_occupation_title: Optional[str] = None
    target_sector: Optional[str] = None
    current_education_level: Optional[str] = None
    institution_name: Optional[str] = None
    graduation_year: Optional[int] = None
    years_experience: float = 0.0
    current_state: Optional[str] = None
    current_district: Optional[str] = None
    preferred_locations: List[str] = Field(default_factory=list)
    consent_ai_processing: bool = False
    created_at: str
    updated_at: str


class ResumeParsedData(BaseModel):
    """Structured heuristic fields extracted from a text-based PDF resume."""
    candidate_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=30)
    education_level: Optional[str] = Field(None, max_length=80)
    institution: Optional[str] = Field(None, max_length=150)
    graduation_year: Optional[int] = Field(None, ge=1960, le=2035)
    detected_skills: List[str] = Field(default_factory=list)
    experience_years: Optional[float] = Field(None, ge=0.0, le=60.0)
    experience_summary: Optional[str] = Field(None, max_length=2000)
    projects_summary: Optional[str] = Field(None, max_length=2000)
    page_count: int = Field(default=1, ge=1, le=20)
    extraction_note: Optional[str] = Field(None, max_length=300)


class ResumeReviewRequest(BaseModel):
    """User-confirmed or edited parsed data payload."""
    candidate_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=30)
    education_level: Optional[str] = Field(None, max_length=80)
    institution: Optional[str] = Field(None, max_length=150)
    graduation_year: Optional[int] = Field(None, ge=1960, le=2035)
    detected_skills: List[str] = Field(default_factory=list)
    experience_years: Optional[float] = Field(None, ge=0.0, le=60.0)
    experience_summary: Optional[str] = Field(None, max_length=2000)
    projects_summary: Optional[str] = Field(None, max_length=2000)

    @field_validator("detected_skills", mode="before")
    @classmethod
    def clean_skills(cls, v: Any) -> List[str]:
        if not v:
            return []
        if isinstance(v, list):
            seen = set()
            clean = []
            for item in v:
                s = str(item).strip()
                if s and s.lower() not in seen:
                    seen.add(s.lower())
                    clean.append(s)
            return clean
        return []


class ResumeMetadataResponse(BaseModel):
    """Public metadata for an uploaded user resume (internal storage key & raw text omitted)."""
    id: int
    user_id: int
    original_filename: str
    file_size_bytes: int
    parsed_data: Dict[str, Any]
    is_reviewed: bool
    uploaded_at: str
    updated_at: str
