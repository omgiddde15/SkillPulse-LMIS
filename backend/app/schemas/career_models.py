"""Pydantic schemas for SkillPulse Career Profile and Resume Processing."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class CareerProfileCreateOrUpdate(BaseModel):
    """Payload for creating or updating a candidate's personal career profile."""
    target_role_title: Optional[str] = Field(None, max_length=150, description="Target career role title (optional for partial profiles)")
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
    def clean_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = v.strip()
        if not clean:
            return None
        if len(clean) < 2:
            raise ValueError("Target role title must be at least 2 characters if provided.")
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
    target_role_title: Optional[str] = None
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


# -----------------------------------------------------------------------------
# Phase 2: User Skill Evidence & Explainable Skill-Gap Schemas
# -----------------------------------------------------------------------------

class UserSkillCreate(BaseModel):
    """Payload to claim or register a skill with optional evidence."""
    skill_name: str = Field(..., min_length=1, max_length=100, description="Display name of the skill (e.g., Python, Docker, Fast API)")
    category: str = Field(default="technical", pattern="^(technical|domain|tool|soft)$", description="Taxonomy category")
    evidence_status: str = Field(default="claimed", pattern="^(unconfirmed|claimed|evidenced)$", description="Evidence status")
    source_type: str = Field(default="self_reported", max_length=50, description="Source of the skill claim")
    source_context: Optional[str] = Field(None, max_length=500, description="Supporting project excerpt, job experience, or certificate context")
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Extraction or claim confidence score (not user competence)")
    verified_by_user: bool = Field(default=True, description="Whether the user explicitly affirmed this skill entry")

    @field_validator("skill_name")
    @classmethod
    def clean_skill_name(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 1:
            raise ValueError("Skill name cannot be empty.")
        return clean


class UserSkillUpdate(BaseModel):
    """Payload to update an existing user skill entry."""
    skill_name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, pattern="^(technical|domain|tool|soft)$")
    evidence_status: Optional[str] = Field(None, pattern="^(unconfirmed|claimed|evidenced)$")
    source_type: Optional[str] = Field(None, max_length=50)
    source_context: Optional[str] = Field(None, max_length=500)
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    verified_by_user: Optional[bool] = None


class UserSkillResponse(BaseModel):
    """Envelope for a user skill record."""
    id: int
    user_id: int
    skill_key: str
    skill_name: str
    category: str
    evidence_status: str
    source_type: str
    source_context: Optional[str] = None
    confidence_score: float
    verified_by_user: bool
    created_at: str
    updated_at: str


class TargetRoleSummaryResponse(BaseModel):
    """Summary of a supported starter role profile."""
    role_id: str
    title: str
    description: str
    sector: str
    benchmark_occupation_id: Optional[str] = None
    broad_occupational_reference: Optional[str] = None
    source_type: str
    source_title: str
    source_url: Optional[str] = None
    version: str
    review_date: str
    provenance_notes: str
    required_skills_count: int
    preferred_skills_count: int


class SkillEvidenceMatch(BaseModel):
    """Comparison result for a single required or preferred skill."""
    skill_key: str
    skill_name: str
    category: str
    importance_level: str  # "required" or "preferred"
    status: str  # "evidenced", "claimed", "unconfirmed", "missing"
    status_label: str
    role_justification: str
    user_skill_id: Optional[int] = None
    user_evidence_status: Optional[str] = None
    source_type: Optional[str] = None
    source_context: Optional[str] = None
    explanation: str


class SkillGapMetrics(BaseModel):
    """Deterministic coverage statistics for a selected role profile."""
    required_total: int
    required_evidenced: int
    required_claimed: int
    required_unconfirmed: int
    required_missing: int
    preferred_total: int
    preferred_evidenced: int
    preferred_claimed: int
    preferred_unconfirmed: int
    preferred_missing: int
    evidence_coverage_percentage: float
    coverage_formula: str
    metric_explanation: str
    disclaimer: str


class SkillGapAnalysisResponse(BaseModel):
    """Full explainable skill-gap analysis envelope."""
    role: TargetRoleSummaryResponse
    metrics: SkillGapMetrics
    required_skills: List[SkillEvidenceMatch]
    preferred_skills: List[SkillEvidenceMatch]
    unmatched_user_skills: List[UserSkillResponse]
    generated_at: str


# -----------------------------------------------------------------------------
# Phase 3: Opportunity Catalogue & Recommendation Models
# -----------------------------------------------------------------------------

class OpportunitySourceResponse(BaseModel):
    """Registered trusted official source directory."""
    source_id: str
    name: str
    home_url: str
    approved_domain: str
    managing_agency: str
    category: str
    supported_types: List[str]
    verification_status: str
    data_access_method: str
    last_verified_at: str
    refresh_interval: str
    provenance_notes: Optional[str] = None


class OpportunityItemResponse(BaseModel):
    """Specific listing or official portal search destination."""
    id: str
    record_kind: str  # "portal_directory" or "individual_listing"
    title: str
    description: str
    opportunity_type: str  # "course", "job", "internship", "apprenticeship", "scheme"
    provider_name: str
    source_id: str
    source_name: Optional[str] = None
    official_url: str
    role_ids: List[str] = []
    skill_keys: List[str] = []
    eligibility: Dict[str, Any] = {}
    eligibility_status: str = "not_specified"
    location_state: Optional[str] = None
    location_district: Optional[str] = None
    work_mode: str = "online"
    fee_status: str = "unknown"
    fee_amount: Optional[float] = None
    fee_currency: str = "INR"
    stipend_min: Optional[float] = None
    stipend_max: Optional[float] = None
    stipend_period: Optional[str] = None
    application_deadline: Optional[str] = None
    published_at: Optional[str] = None
    published_contact_name: Optional[str] = None
    published_contact_email: Optional[str] = None
    published_contact_phone: Optional[str] = None
    listing_status: str = "source_listed"
    verification_status: str = "verified_official"
    verified_at: str
    source_last_updated_at: Optional[str] = None
    provenance_notes: Optional[str] = None
    is_deadline_passed: bool = False


class OpportunityRecommendationReason(BaseModel):
    """Individual transparent rationale for why an item was recommended."""
    code: str
    message: str


class OpportunityRecommendationItem(BaseModel):
    """Personalized opportunity match with score breakdown and reason codes."""
    opportunity: OpportunityItemResponse
    match_score: float
    score_breakdown: Dict[str, float]
    reasons: List[OpportunityRecommendationReason]
    matching_skills: List[str] = []
    addressed_gaps: List[str] = []


class OpportunityRecommendationsResponse(BaseModel):
    """Personalized recommendations response for authenticated user."""
    recommended_courses: List[OpportunityRecommendationItem]
    recommended_opportunities: List[OpportunityRecommendationItem]
    portal_directories: List[OpportunityItemResponse]
    user_target_role_id: Optional[str] = None
    user_target_role_title: Optional[str] = None
    user_gaps_addressed_count: int = 0
    disclaimer: str


# -----------------------------------------------------------------------------
# Phase 4: Personalized Career Roadmap Schemas
# -----------------------------------------------------------------------------

class RoadmapGenerateRequest(BaseModel):
    """Payload to request deterministic or AI-assisted career roadmap generation."""
    target_role_id: str = Field(..., min_length=2, max_length=64, description="Supported target role ID from role catalogue")
    horizon_days: int = Field(default=30, description="Planning horizon in days: 30, 60, or 90")
    client_request_token: Optional[str] = Field(None, max_length=128, description="Optional client idempotency token")

    @field_validator("horizon_days")
    @classmethod
    def validate_horizon(cls, v: int) -> int:
        if v not in (30, 60, 90):
            raise ValueError("Planning horizon must be 30, 60, or 90 days.")
        return v

    @field_validator("target_role_id")
    @classmethod
    def clean_role_id(cls, v: str) -> str:
        clean = v.strip().upper()
        if not clean:
            raise ValueError("Target role ID must be provided.")
        return clean


class MilestoneStatusUpdateRequest(BaseModel):
    """Payload to update completion state of a roadmap milestone."""
    is_completed: bool = Field(..., description="Milestone completion status")


class MilestoneItemResponse(BaseModel):
    """Structured milestone in a personalized career roadmap."""
    id: int
    roadmap_id: int
    milestone_order: int
    title: str
    description: str
    target_skill_keys: List[str] = Field(default_factory=list)
    action_type: str = Field(..., description="Action type: learn, practise, build_project, review, apply")
    suggested_duration_days: int = Field(default=7, ge=1, le=90)
    prerequisites: List[str] = Field(default_factory=list)
    linked_opportunity_id: Optional[str] = None
    linked_opportunity: Optional[OpportunityItemResponse] = None
    is_completed: bool = False
    completed_at: Optional[str] = None


class RoadmapSummaryResponse(BaseModel):
    """List summary for saved user roadmaps."""
    id: int
    user_id: int
    target_role_id: str
    role_title: str
    horizon_days: int
    summary: str
    generation_mode: str  # "ai_assisted" or "deterministic"
    methodology_note: str
    total_milestones: int
    completed_milestones: int
    progress_percentage: float
    generated_at: str
    created_at: str
    updated_at: str


class RoadmapDetailResponse(BaseModel):
    """Complete roadmap response envelope with sequenced milestones."""
    id: int
    user_id: int
    target_role_id: str
    role_title: str
    horizon_days: int
    summary: str
    generation_mode: str  # "ai_assisted" or "deterministic"
    methodology_note: str
    total_milestones: int
    completed_milestones: int
    progress_percentage: float
    generated_at: str
    created_at: str
    updated_at: str
    milestones: List[MilestoneItemResponse]
    disclaimer: str



