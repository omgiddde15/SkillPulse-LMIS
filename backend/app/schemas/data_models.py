"""Core Pydantic data models for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# Regular expression for YYYY-MM formatted monthly periods
PERIOD_REGEX = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class Occupation(BaseModel):
    """Normalized occupational entity adhering to standardized taxonomy guidelines.
    
    Verified official codes (such as NCO 2015) remain null until formally validated
    against official gazette classifications to avoid fabricating codes.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    occupation_id: str = Field(
        ...,
        description="Internal unique identifier for the occupation (e.g., OCC_IT_001).",
        min_length=3,
        max_length=64,
    )
    occupation_title: str = Field(
        ...,
        description="Canonical descriptive job title for the occupation.",
        min_length=2,
        max_length=128,
    )
    sector: str = Field(
        ...,
        description="Industry sector (e.g., IT/ITeS, Manufacturing, Logistics).",
        min_length=2,
        max_length=64,
    )
    trade: str = Field(
        ...,
        description="Vocational trade or specialized skill cluster within the sector.",
        min_length=2,
        max_length=64,
    )
    nco_code: Optional[str] = Field(
        default=None,
        description="Verified National Classification of Occupations (NCO) code if formally verified; null if pending.",
        max_length=16,
    )
    nco_title: Optional[str] = Field(
        default=None,
        description="Official title associated with the NCO code in the National Classification of Occupations.",
        max_length=128,
    )
    qp_code: Optional[str] = Field(
        default=None,
        description="Official Qualification Pack (QP) code from Sector Skill Council / NCVET (e.g., SSC/Q8304).",
        max_length=32,
    )
    qp_title: Optional[str] = Field(
        default=None,
        description="Official title of the Qualification Pack / National Occupational Standard.",
        max_length=128,
    )
    nsqf_level: Optional[float] = Field(
        default=None,
        description="National Skills Qualifications Framework (NSQF) level (1.0 to 10.0).",
    )

    @field_validator("nco_code")
    @classmethod
    def validate_nco_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v or v.lower() in {"null", "none", "nan", "n/a", ""}:
            return None
        if not re.match(r"^\d{4}(\.?\d{2,4})?$", v):
            raise ValueError(f"Invalid NCO code format: '{v}'. Expected 4-digit unit or 8-digit leaf code (e.g., '2522' or '2522.0100').")
        return v

    @field_validator("nco_title", "qp_code", "qp_title", mode="before")
    @classmethod
    def validate_optional_text(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str):
            v = v.strip()
            if not v or v.lower() in {"null", "none", "nan", "n/a", ""}:
                return None
            return v
        return str(v)

    @field_validator("nsqf_level", mode="before")
    @classmethod
    def validate_nsqf_level(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        if isinstance(v, str):
            v = v.strip()
            if not v or v.lower() in {"null", "none", "nan", "n/a", ""}:
                return None
            try:
                val = float(v)
            except ValueError:
                raise ValueError(f"Invalid NSQF level: '{v}'. Must be numeric.")
        elif isinstance(v, (int, float)):
            val = float(v)
        else:
            raise ValueError(f"Invalid NSQF level type: {type(v)}")

        if val < 1.0 or val > 10.0:
            raise ValueError(f"NSQF level must be between 1.0 and 10.0 inclusive, got {val}")
        return val


class Geography(BaseModel):
    """Geographic entity representing administrative state and district hierarchies."""

    model_config = ConfigDict(str_strip_whitespace=True)

    district_id: str = Field(
        ...,
        description="Standardized district code (e.g., MH_PUN, KA_BLR_U, TS_HYD).",
        min_length=3,
        max_length=32,
    )
    district_name: str = Field(
        ...,
        description="Official district name.",
        min_length=2,
        max_length=64,
    )
    state_code: str = Field(
        ...,
        description="Two-letter or standard state code (e.g., MH, KA, TS).",
        min_length=2,
        max_length=8,
    )
    state_name: str = Field(
        ...,
        description="Full official state name.",
        min_length=2,
        max_length=64,
    )


class DemandObservation(BaseModel):
    """Observed signal indicating employer demand intensity for an occupation in a district.
    
    Supports multi-source, multi-signal architectures: distinct signal types (e.g.,
    online job postings count vs. active employer vacancy index) from different sources
    can co-exist for the same period, district, and occupation.
    Uniqueness composite key: (period, district_id, occupation_id, source, signal_type, unit).
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    observation_id: Optional[str] = Field(
        default=None,
        description="Optional unique identifier for the observation record (e.g., OBS_DEM_001).",
        max_length=64,
    )
    period: str = Field(
        ...,
        description="Observation period formatted as YYYY-MM (e.g., 2026-01).",
    )
    district_id: str = Field(
        ...,
        description="District identifier referencing Geography.district_id.",
        min_length=3,
        max_length=32,
    )
    occupation_id: str = Field(
        ...,
        description="Occupation identifier referencing Occupation.occupation_id.",
        min_length=3,
        max_length=64,
    )
    source: str = Field(
        ...,
        description="Data origin or reporting channel (e.g., public_job_portal_aggregate).",
        min_length=2,
        max_length=128,
    )
    signal_type: str = Field(
        ...,
        description="Type of demand signal (e.g., online_job_postings, active_openings_index).",
        min_length=2,
        max_length=64,
    )
    signal_value: float = Field(
        ...,
        ge=0.0,
        description="Non-negative numeric metric representing signal magnitude.",
    )
    unit: str = Field(
        ...,
        description="Unit of measurement (e.g., count, index_points).",
        min_length=1,
        max_length=32,
    )
    data_provenance: str = Field(
        ...,
        description="Traceability description and metadata noting the generation or collection method.",
        min_length=5,
    )
    is_synthetic: bool = Field(
        default=True,
        description="Explicit flag indicating whether the observation is synthetic benchmark data.",
    )

    @field_validator("period")
    @classmethod
    def validate_period_format(cls, v: str) -> str:
        if not PERIOD_REGEX.match(v):
            raise ValueError(f"Period must be in YYYY-MM format, got '{v}'")
        return v

    @model_validator(mode="after")
    def validate_integer_signals(self) -> DemandObservation:
        """Reject fractional counts for integer demand signal types (e.g. online_job_postings)."""
        if self.signal_type == "online_job_postings":
            if not float(self.signal_value).is_integer():
                raise ValueError(
                    f"Signal type 'online_job_postings' requires a non-negative integer count, "
                    f"got fractional value {self.signal_value}"
                )
        return self


class TrainingSupplyObservation(BaseModel):
    """Training pipeline throughput metrics for an occupation, district, and period.
    
    Semantics: Concluding Cohort Throughput Model.
    - Each record represents distinct training cohort(s) / batches concluding their
      curriculum and assessment within the reporting monthly period.
    - Funnel Lifecycle: Enrolments, completions, certifications, and placements track
      the same cohort through its lifecycle.
    - Placement Follow-Up: Placements reflect certified candidates from this cohort who
      secured verified employment within the standardized post-certification observation
      window (e.g., 90-day tracking window).
    - Capacity Semantics: Sanctioned seats denotes the intake capacity allocated specifically
      to this cohort batch (e.g., 30-120 seats per batch), NOT repeated measurements of
      fixed annual physical institutional capacity.

    Funnel Monotonicity Invariant:
    enrolments <= sanctioned_seats
    completions <= enrolments
    certifications <= completions
    placements <= certifications (where placements are recorded)
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    period: str = Field(
        ...,
        description="Observation period formatted as YYYY-MM (e.g., 2026-01).",
    )
    district_id: str = Field(
        ...,
        description="District identifier referencing Geography.district_id.",
        min_length=3,
        max_length=32,
    )
    occupation_id: str = Field(
        ...,
        description="Occupation identifier referencing Occupation.occupation_id.",
        min_length=3,
        max_length=64,
    )
    sanctioned_seats: int = Field(
        ...,
        ge=0,
        description="Sanctioned batch capacity for cohort(s) concluding within the period (avoids multi-counting annual seats).",
    )
    enrolments: int = Field(
        ...,
        ge=0,
        description="Number of candidates enrolled in the training pipeline.",
    )
    completions: int = Field(
        ...,
        ge=0,
        description="Number of enrolled candidates who completed the instructional curriculum.",
    )
    certifications: int = Field(
        ...,
        ge=0,
        description="Number of completing candidates who successfully passed formal assessment.",
    )
    placements: Optional[int] = Field(
        default=None,
        ge=0,
        description="Number of certified candidates successfully placed in employment (null if placement follow-up is pending).",
    )
    placement_status: str = Field(
        default="complete",
        description="Follow-up maturity status: 'complete' if 90-day post-certification window has elapsed, 'pending' if immature.",
    )
    is_synthetic: bool = Field(
        default=True,
        description="Explicit flag indicating whether the observation is synthetic benchmark data.",
    )

    @field_validator("period")
    @classmethod
    def validate_period_format(cls, v: str) -> str:
        if not PERIOD_REGEX.match(v):
            raise ValueError(f"Period must be in YYYY-MM format, got '{v}'")
        return v

    @field_validator("placement_status")
    @classmethod
    def validate_placement_status(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"complete", "pending"}:
            raise ValueError(f"placement_status must be 'complete' or 'pending', got '{v}'")
        return v

    @model_validator(mode="after")
    def validate_funnel_consistency(self) -> TrainingSupplyObservation:
        if self.enrolments > self.sanctioned_seats:
            raise ValueError(
                f"enrolments ({self.enrolments}) cannot exceed sanctioned_seats ({self.sanctioned_seats})"
            )
        if self.completions > self.enrolments:
            raise ValueError(
                f"completions ({self.completions}) cannot exceed enrolments ({self.enrolments})"
            )
        if self.certifications > self.completions:
            raise ValueError(
                f"certifications ({self.certifications}) cannot exceed completions ({self.completions})"
            )
        if self.placement_status == "pending":
            if self.placements is not None:
                raise ValueError(
                    f"placements must be null when placement_status is 'pending' (got {self.placements})"
                )
        elif self.placement_status == "complete":
            if self.placements is None:
                raise ValueError(
                    "placements count must be provided when placement_status is 'complete'"
                )
            if self.placements > self.certifications:
                raise ValueError(
                    f"placements ({self.placements}) cannot exceed certifications ({self.certifications})"
                )
        return self


class DatasetMetadata(BaseModel):
    """Metadata schema documenting dataset provenance, temporal range, and synthetic status."""

    model_config = ConfigDict(str_strip_whitespace=True)

    dataset_name: str = Field(
        ...,
        description="Descriptive name of the dataset.",
        min_length=2,
        max_length=128,
    )
    period_start: str = Field(
        ...,
        description="Earliest period covered (YYYY-MM).",
    )
    period_end: str = Field(
        ...,
        description="Latest period covered (YYYY-MM).",
    )
    geographic_coverage: List[str] = Field(
        ...,
        description="List of states or regions included in the dataset.",
    )
    source: str = Field(
        ...,
        description="Source institution, generator, or benchmark provider.",
        min_length=2,
        max_length=128,
    )
    retrieval_date: str = Field(
        ...,
        description="Date of extraction or generation in YYYY-MM-DD format.",
    )
    is_synthetic: bool = Field(
        default=True,
        description="Flag indicating if the dataset contains synthetic pilot data.",
    )
    status: str = Field(
        default="synthetic_pilot",
        description="Curation status (e.g., synthetic_pilot, verified_benchmark).",
    )

    @field_validator("period_start", "period_end")
    @classmethod
    def validate_period_format(cls, v: str) -> str:
        if not PERIOD_REGEX.match(v):
            raise ValueError(f"Period must be in YYYY-MM format, got '{v}'")
        return v


class ForecastPoint(BaseModel):
    """Point forecast with empirical prediction interval and backtesting error metrics."""

    model_config = ConfigDict(str_strip_whitespace=True)

    quantity: str = Field(
        ...,
        description="Target series quantity (e.g. 'online_job_postings' or 'certified_candidate_throughput').",
    )
    model_selected: Optional[str] = Field(
        default=None,
        description="Selected baseline model: 'naive', 'ma3', or 'linear_trend'.",
    )
    point_forecast: Optional[float] = Field(
        default=None,
        description="Non-negative point forecast value.",
    )
    point_forecast_integer: Optional[int] = Field(
        default=None,
        description="Non-negative integer forecast count (populated for discrete job postings).",
    )
    prediction_interval_lower: Optional[float] = Field(
        default=None,
        description="Approximate empirical lower prediction interval bound (non-negative).",
    )
    prediction_interval_upper: Optional[float] = Field(
        default=None,
        description="Approximate empirical upper prediction interval bound (non-negative).",
    )
    interval_confidence: float = Field(
        default=0.80,
        description="Nominal coverage probability of the empirical prediction interval.",
    )
    interval_type: str = Field(
        default="rmse_normal_approximation_80pct",
        description="Methodological category of the prediction interval: 'rmse_normal_approximation_80pct' or empirical quantile.",
    )
    interval_disclaimer: str = Field(
        default=(
            "Approximate 80% prediction interval calculated as point forecast ± 1.282 × out-of-sample RMSE "
            "assuming normal error dispersion (not a direct empirical quantile interval). Evidence is limited "
            "when sample size of out-of-sample residuals is small (particularly at the 12-month horizon). "
            "Not a guaranteed coverage interval."
        ),
        description="Disclaimer on prediction interval interpretation.",
    )
    residual_sample_size: Optional[int] = Field(
        default=None,
        description="Number of out-of-sample backtesting residuals supporting interval estimation.",
    )
    uncertainty_evidence_status: Optional[str] = Field(
        default="adequate_sample",
        description="Evidence adequacy status: 'limited_sample' (<10 folds, 12m horizon), 'adequate_sample', or 'insufficient_history'.",
    )
    backtest_mae: Optional[float] = Field(
        default=None,
        description="Mean Absolute Error from rolling-origin time-ordered backtesting.",
    )
    backtest_wape: Optional[float] = Field(
        default=None,
        description="Weighted Absolute Percentage Error handling zero denominators safely.",
    )
    rounding_explanation: str = Field(
        default="Job postings rounded to nearest integer; candidate throughput rounded to 1 decimal place.",
        description="Transparent documentation of rounding rules applied.",
    )
    status: str = Field(
        default="valid",
        description="Forecast validity status: 'valid', 'insufficient_history', or 'missing_inputs'.",
    )
    status_detail: Optional[str] = Field(
        default=None,
        description="Human-readable reason if status is not valid.",
    )


class ProjectedMismatch(BaseModel):
    """Projected cross-sectional relative mismatch for a future horizon."""

    model_config = ConfigDict(str_strip_whitespace=True)

    forecast_demand_rank: Optional[float] = Field(
        default=None,
        description="Cross-sectional percentile rank of forecast job postings (0 to 100).",
    )
    forecast_supply_rank: Optional[float] = Field(
        default=None,
        description="Cross-sectional percentile rank of forecast certification throughput (0 to 100).",
    )
    projected_mismatch_score: Optional[float] = Field(
        default=None,
        description="Projected relative mismatch: forecast demand rank minus forecast supply rank (-100 to +100).",
    )
    classification: Optional[str] = Field(
        default=None,
        description="Classification: 'Demand Pressure', 'Supply Pressure', 'Balanced / Monitor', or 'Insufficient Data'.",
    )
    thresholds_applied: Dict[str, float] = Field(
        default_factory=lambda: {"demand_pressure": 15.0, "supply_pressure": -15.0},
        description="Configurable prototype thresholds applied.",
    )
    status: str = Field(
        default="valid",
        description="Status of the projected mismatch computation.",
    )
    policy_disclaimer: str = Field(
        default=(
            "Projected relative mismatch is an experimental cross-sectional percentile difference "
            "comparing projected recruitment demand rank against projected certification throughput rank. "
            "It is NOT an absolute job opening deficit or worker shortage headcount, and alert thresholds "
            "are prototype heuristic thresholds (±15), not empirically calibrated policy rules."
        ),
        description="Disclosures regarding prototype nature of mismatch score.",
    )


class ForecastResultItem(BaseModel):
    """Unified forecast result for a district, occupation, and horizon."""

    model_config = ConfigDict(str_strip_whitespace=True)

    district_id: str = Field(..., description="District code (e.g., MH_PUN).")
    district_name: str = Field(..., description="District name.")
    state_code: str = Field(..., description="State code (e.g., MH).")
    occupation_id: str = Field(..., description="Occupation ID (e.g., OCC_IT_001).")
    occupation_title: str = Field(..., description="Occupation job title.")
    sector: str = Field(..., description="Industry sector.")
    trade: str = Field(..., description="Vocational trade.")
    nco_code: Optional[str] = Field(default=None, description="Verified National Classification of Occupations code.")
    nco_title: Optional[str] = Field(default=None, description="Official NCO-2015 title.")
    qp_code: Optional[str] = Field(default=None, description="Sector Skill Council Qualification Pack code.")
    qp_title: Optional[str] = Field(default=None, description="Official Qualification Pack title.")
    nsqf_level: Optional[float] = Field(default=None, description="National Skills Qualifications Framework level.")
    base_period: str = Field(..., description="Base cutoff period for training (YYYY-MM).")
    horizon_months: int = Field(..., description="Forecast horizon in months (3, 6, or 12).")
    target_period: str = Field(..., description="Target forecasted period (YYYY-MM).")
    demand_forecast: ForecastPoint = Field(..., description="Forecast of online job postings.")
    supply_forecast: ForecastPoint = Field(..., description="Forecast of certified-candidate throughput.")
    projected_mismatch: ProjectedMismatch = Field(..., description="Cross-sectional projected relative mismatch.")
    data_coverage_pct: float = Field(default=100.0, description="Percentage of required input history available.")
    benchmark_ratio: Optional[float] = Field(
        default=None,
        description="Descriptive benchmark ratio: forecast certified throughput per 100 online job postings.",
    )


class ForecastResponse(BaseModel):
    """Complete API response envelope for forecasts endpoint."""

    model_config = ConfigDict(str_strip_whitespace=True)

    metadata: Dict[str, Any] = Field(..., description="Provenance, methodology, and limitations metadata.")
    summary: Dict[str, Any] = Field(..., description="High-level counts and breakdown.")
    results: List[ForecastResultItem] = Field(..., description="List of district-occupation forecast items.")


class EarlyWarningAlert(BaseModel):
    """Explainable decision-support alert for labour market imbalances or data quality risks."""

    model_config = ConfigDict(str_strip_whitespace=True)

    alert_id: str = Field(..., description="Stable deterministic alert ID.")
    alert_type: str = Field(
        ...,
        description=(
            "Category: 'demand_pressure', 'supply_pressure', 'persistent_demand_pressure', "
            "'persistent_supply_pressure', 'accelerating_demand', 'declining_demand', 'data_quality_warning'."
        ),
    )
    severity: str = Field(..., description="Severity level: 'low', 'medium', 'high', 'critical'.")
    period: str = Field(..., description="Base reporting period (YYYY-MM).")
    horizon_months: Optional[int] = Field(default=None, description="Forecast horizon months if horizon-specific.")
    target_period: Optional[str] = Field(default=None, description="Target period if horizon-specific.")
    district_id: str = Field(..., description="District code.")
    district_name: str = Field(..., description="District name.")
    state_code: str = Field(..., description="State code.")
    occupation_id: str = Field(..., description="Occupation code.")
    occupation_title: str = Field(..., description="Occupation title.")
    sector: str = Field(..., description="Industry sector.")
    key_values: Dict[str, Any] = Field(..., description="Key numerical metrics justifying the alert.")
    explanation: str = Field(..., description="Plain-language diagnostic rationale.")
    suggested_action: str = Field(..., description="Actionable planning recommendation.")
    limitations: str = Field(..., description="Disclaimers regarding decision-support usage and data nature.")


class AlertResponse(BaseModel):
    """Complete API response envelope for alerts endpoint."""

    model_config = ConfigDict(str_strip_whitespace=True)

    metadata: Dict[str, Any] = Field(..., description="Methodology, disclaimer, and provenance metadata.")
    summary: Dict[str, Any] = Field(..., description="Aggregate counts by severity and alert type.")
    results: List[EarlyWarningAlert] = Field(..., description="List of explainable early-warning alerts.")


class CoverageScenario(BaseModel):
    """Assumption-adjusted workforce pipeline coverage scenario projection."""

    model_config = ConfigDict(str_strip_whitespace=True)

    posting_to_opening_multiplier: float = Field(
        default=1.0,
        ge=0.5,
        le=1.5,
        description="Assumed multiplier (k) converting forecast online postings into estimated openings.",
    )
    local_availability_factor: float = Field(
        default=1.0,
        ge=0.4,
        le=1.0,
        description="Assumed share (alpha) of certified throughput available to the local labour market.",
    )
    forecast_demand_postings: Optional[int] = Field(
        default=None,
        description="Forecast active online job postings in the target period.",
    )
    estimated_openings: Optional[float] = Field(
        default=None,
        description="Estimated job openings (forecast_demand_postings * posting_to_opening_multiplier).",
    )
    baseline_supply_throughput: Optional[float] = Field(
        default=None,
        description="Baseline forecast certified-candidate throughput.",
    )
    baseline_effective_output: Optional[float] = Field(
        default=None,
        description="Baseline effective local certified throughput (baseline_supply * local_availability_factor).",
    )
    baseline_coverage_pct: Optional[float] = Field(
        default=None,
        description="Baseline pipeline coverage percentage (baseline_effective_output / estimated_openings * 100).",
    )
    baseline_benchmark_ratio: Optional[float] = Field(
        default=None,
        description="Baseline raw benchmark ratio: candidates per 100 online postings.",
    )
    scenario_supply_throughput: Optional[float] = Field(
        default=None,
        description="Scenario forecast certified-candidate throughput.",
    )
    scenario_effective_output: Optional[float] = Field(
        default=None,
        description="Scenario effective local certified throughput (scenario_supply * local_availability_factor).",
    )
    scenario_coverage_pct: Optional[float] = Field(
        default=None,
        description="Scenario pipeline coverage percentage (scenario_effective_output / estimated_openings * 100).",
    )
    scenario_benchmark_ratio: Optional[float] = Field(
        default=None,
        description="Scenario raw benchmark ratio: candidates per 100 online postings.",
    )
    coverage_pct_delta: Optional[float] = Field(
        default=None,
        description="Percentage point change in pipeline coverage (scenario_coverage_pct - baseline_coverage_pct).",
    )
    benchmark_ratio_delta: Optional[float] = Field(
        default=None,
        description="Delta in raw benchmark ratio per 100 postings.",
    )
    metric_label: str = Field(
        default="Assumption-Adjusted Pipeline Scenario",
        description="Canonical label for this metric.",
    )
    assumptions_summary: str = Field(
        default=(
            "Starting assumptions: k = 1.0 (1 posting = 1 opening); alpha = 1.0 (100% local availability). "
            "These are neutral illustrative scenario assumptions, NOT observed empirical parameters."
        ),
        description="Summary of assumed parameter inputs.",
    )
    methodology_disclaimer: str = Field(
        default=(
            "This assumption-adjusted pipeline scenario is an exploratory decision-support simulation. "
            "It does NOT represent actual vacancy fulfilment, a verified labor shortage, or a prediction "
            "of guaranteed employment. Online job postings may be duplicated, renewed, or omit off-platform hiring. "
            "Certified candidates may enter jobs later, migrate, pursue further study, or not immediately become available workers."
        ),
        description="Disclosures and semantic guardrails for pipeline coverage.",
    )


class SeatSimulationRequest(BaseModel):
    """Request payload for training-seat allocation scenario simulation."""

    model_config = ConfigDict(str_strip_whitespace=True)

    period: Optional[str] = Field(
        default=None,
        description="Base reporting period for baseline cutoff (format: YYYY-MM, e.g. '2026-09'). Defaults to latest available period.",
    )
    horizon_months: int = Field(
        ...,
        description="Forecast horizon in months for evaluation (must be 3, 6, or 12).",
    )
    district_id: str = Field(
        ...,
        description="Standardized district code (e.g., 'MH_PUN', 'KA_BLR_U', 'TS_HYD').",
        min_length=3,
        max_length=32,
    )
    occupation_id: str = Field(
        ...,
        description="Internal unique identifier for the occupation (e.g., 'OCC_IT_001', 'OCC_MFG_001').",
        min_length=3,
        max_length=64,
    )
    proposed_seats_per_cohort: int = Field(
        ...,
        description="Proposed sanctioned batch/cohort seats for future intakes (positive integer between 1 and 5000).",
        ge=1,
        le=5000,
    )
    posting_to_opening_multiplier: float = Field(
        default=1.0,
        ge=0.5,
        le=1.5,
        description="Assumed multiplier (k) converting forecast online postings into estimated openings (range: 0.5 to 1.5). Default 1.0.",
    )
    local_availability_factor: float = Field(
        default=1.0,
        ge=0.4,
        le=1.0,
        description="Assumed share (alpha) of projected certified throughput available to the local labour market (range: 0.4 to 1.0). Default 1.0.",
    )

    @field_validator("horizon_months")
    @classmethod
    def validate_horizon(cls, v: int) -> int:
        if v not in [3, 6, 12]:
            raise ValueError(f"Invalid horizon_months '{v}'. Supported horizons: [3, 6, 12].")
        return v

    @field_validator("period")
    @classmethod
    def validate_period_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_clean = v.strip()
            if not PERIOD_REGEX.match(v_clean):
                raise ValueError(f"Invalid period format '{v}'. Expected 'YYYY-MM' (e.g., '2026-09').")
            return v_clean
        return None


class SeatSimulationResponse(BaseModel):
    """Complete API response for training-seat allocation scenario simulation."""

    model_config = ConfigDict(str_strip_whitespace=True)

    scenario_id: str = Field(..., description="Deterministic scenario request identifier.")
    is_synthetic: bool = Field(default=True, description="Provenance indicator confirming synthetic pilot data.")
    status: str = Field(default="valid", description="Simulation status: 'valid' or 'insufficient_history'.")
    status_detail: Optional[str] = Field(default=None, description="Diagnostic detail if status is not valid.")
    parameters: Dict[str, Any] = Field(..., description="Target geographic, occupational, and temporal parameters.")
    baseline_seat_allocation: Dict[str, Any] = Field(..., description="Historical baseline seat allocation across concluding cohorts.")
    proposed_seat_allocation: Dict[str, Any] = Field(..., description="Proposed seat allocation and relative change.")
    funnel_metrics: Dict[str, Any] = Field(..., description="Historical cohort funnel rates and overall yield rate.")
    baseline_projection: Dict[str, Any] = Field(..., description="Baseline demand, supply, and mismatch projections.")
    scenario_projection: Dict[str, Any] = Field(..., description="Scenario-adjusted supply throughput, rank, and mismatch.")
    impact_summary: Dict[str, Any] = Field(..., description="Calculated absolute and percentage deltas from baseline.")
    coverage_scenario: Optional[CoverageScenario] = Field(default=None, description="Assumption-adjusted pipeline coverage scenario projection.")
    methodology: str = Field(..., description="Documented simulation methodology.")
    assumptions: str = Field(..., description="Constant-yield and proportional scaling assumptions.")
    limitations: str = Field(..., description="Human decision-support disclaimers and constraints.")
    policy_disclaimer: str = Field(..., description="Notice that outputs do not represent physical headcount shortages.")

