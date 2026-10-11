"""Training-Seat Allocation Simulator Service for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

This service implements Module 6 (Training-Seat Allocation Simulator):
- Calibrates baseline training intake capacity over trailing concluding cohorts (T, T-1, T-2).
- Calculates empirical pipeline funnel rates (seat utilization, completion, certification).
- Evaluates proposed future sanctioned batch/cohort seat allocations for a district-occupation.
- Scales forecast certified-candidate throughput under a transparent constant-yield assumption.
- Recalculates cross-sectional supply percentile ranks and projected relative mismatch scores.
- Compares baseline vs scenario projections side-by-side with explainable impact metrics.
- Enforces non-negative bounds and guards against treating seat increases as immediate graduate surpluses.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.data_models import (
    Geography,
    Occupation,
    SeatSimulationResponse,
)
from app.services.demand_index import compute_percentile_ranks, find_data_dir
from app.services.forecasting import (
    ForecastingService,
    SUPPORTED_HORIZONS,
    DEFAULT_DEMAND_PRESSURE_THRESHOLD,
    DEFAULT_SUPPLY_PRESSURE_THRESHOLD,
    add_months_to_period,
)
from app.services.supply_estimation import SupplyEstimationService

SIMULATION_METHODOLOGY: str = (
    "Proportional scenario scaling based on empirical cohort funnel metrics. "
    "Baseline intake capacity is established as the average sanctioned seats across the trailing "
    "three concluding cohort periods. Expected certified-candidate throughput at horizon h is scaled "
    "by the ratio (proposed seats / baseline average seats). Cross-sectional supply percentile ranking "
    "is subsequently recalculated across all regional series, updating the projected relative mismatch score."
)

SIMULATION_ASSUMPTIONS: str = (
    "Proportional constant-yield assumption: Training pipeline yield (seat utilization rate × "
    "completion rate × assessment certification rate) is assumed to remain invariant across simulated "
    "capacity adjustments. The simulation models future stabilized cohort throughput and does NOT assume "
    "instantaneous labor market entry or immediate graduate availability upon administrative seat changes."
)

SIMULATION_LIMITATIONS: str = (
    "SkillPulse seat simulations provide strategic scenario planning aids and decision-support tools for state "
    "skill development missions, ITI directorates, and sector skill councils. Projections reflect synthetic pilot series and "
    "prototype threshold assumptions (±15 percentile points). Simulated outcomes do NOT constitute binding "
    "budget allocations, physical staffing quotas, or guaranteed employment additions. All policy adjustments "
    "require ground-level capacity feasibility checks, instructor readiness reviews, and employer validation."
)

SIMULATION_POLICY_DISCLAIMER: str = (
    "Projected relative mismatch is an experimental cross-sectional rank difference comparing projected "
    "employer hiring demand rank against projected certification throughput rank. It is NOT an absolute "
    "job vacancy deficit or physical worker shortage headcount. Percentile score changes must not be "
    "interpreted as literal counts of missing or excess personnel."
)


class SeatSimulatorService:
    """Service for simulating regional TVET training-seat allocation adjustments and their impact on projected mismatch."""

    def __init__(
        self,
        data_dir: Optional[Path] = None,
        forecasting_service: Optional[ForecastingService] = None,
        supply_service: Optional[SupplyEstimationService] = None,
    ):
        self.data_dir = data_dir or find_data_dir()
        self.forecasting_service = forecasting_service or ForecastingService(data_dir=self.data_dir)
        self.supply_service = supply_service or SupplyEstimationService(data_dir=self.data_dir)
        self._occupations: Dict[str, Occupation] = {}
        self._geographies: Dict[str, Geography] = {}
        self._loaded: bool = False

    def load_data(self) -> None:
        """Load and validate master entities and dependent services."""
        if self._loaded:
            return

        self.forecasting_service.load_data()
        self.supply_service.load_data()

        self._occupations = dict(self.forecasting_service._occupations)
        self._geographies = dict(self.forecasting_service._geographies)
        self._loaded = True

    def get_available_periods(self) -> List[str]:
        """Return chronologically sorted list of available reporting periods."""
        self.load_data()
        return self.forecasting_service.get_available_periods()

    def simulate_seat_allocation(
        self,
        period: Optional[str],
        horizon_months: int,
        district_id: str,
        occupation_id: str,
        proposed_seats_per_cohort: int,
        posting_to_opening_multiplier: float = 1.0,
        local_availability_factor: float = 1.0,
    ) -> Dict[str, Any]:
        """Simulate the effect of adjusted training batch seats on future supply and mismatch.

        Args:
            period: Base reporting period (YYYY-MM). If None, defaults to latest available period.
            horizon_months: Forecast horizon (3, 6, or 12).
            district_id: Standardized district code (e.g., 'MH_PUN').
            occupation_id: Occupation identifier (e.g., 'OCC_IT_001').
            proposed_seats_per_cohort: Proposed future sanctioned batch/cohort seat capacity (positive integer).
            posting_to_opening_multiplier: Assumed multiplier (k) converting forecast postings into estimated openings (range: 0.5 to 1.5).
            local_availability_factor: Assumed share (alpha) of certified throughput available to local market (range: 0.4 to 1.0).

        Returns:
            Dictionary matching the SeatSimulationResponse schema.
        """
        self.load_data()

        # 1. Parameter Validation
        if posting_to_opening_multiplier < 0.5 or posting_to_opening_multiplier > 1.5:
            raise ValueError(
                f"posting_to_opening_multiplier must be between 0.5 and 1.5, got {posting_to_opening_multiplier}."
            )

        if local_availability_factor < 0.4 or local_availability_factor > 1.0:
            raise ValueError(
                f"local_availability_factor must be between 0.4 and 1.0, got {local_availability_factor}."
            )

        available_periods = self.get_available_periods()
        if not available_periods:
            raise ValueError("No historical periods available in dataset.")

        base_period = period.strip() if period else available_periods[-1]
        if base_period not in available_periods:
            raise ValueError(
                f"Period '{base_period}' not found in dataset. "
                f"Available range: {available_periods[0]} to {available_periods[-1]}."
            )

        if horizon_months not in SUPPORTED_HORIZONS:
            raise ValueError(
                f"Invalid horizon_months '{horizon_months}'. Supported horizons: {SUPPORTED_HORIZONS}."
            )

        d_clean = district_id.strip().upper()
        if d_clean not in self._geographies:
            valid_districts = sorted(self._geographies.keys())
            raise ValueError(f"Invalid district_id '{district_id}'. Valid districts: {valid_districts}.")

        o_clean = occupation_id.strip()
        if o_clean not in self._occupations:
            valid_occs = sorted(self._occupations.keys())
            raise ValueError(f"Invalid occupation_id '{occupation_id}'. Valid occupations: {valid_occs}.")

        if proposed_seats_per_cohort <= 0:
            raise ValueError(
                f"proposed_seats_per_cohort must be a positive integer, got {proposed_seats_per_cohort}."
            )

        geo = self._geographies[d_clean]
        occ = self._occupations[o_clean]
        target_period = add_months_to_period(base_period, horizon_months)
        scenario_id = (
            f"SIM-SEAT-{d_clean}-{o_clean}-H{horizon_months}-{base_period}-S{proposed_seats_per_cohort}"
        )

        # 2. Retrieve Baseline Forecasts for Horizon h
        forecast_response = self.forecasting_service.calculate_forecasts(
            base_period=base_period,
            horizon=horizon_months,
        )
        all_items = [
            it for it in forecast_response.get("results", [])
            if it.get("horizon_months") == horizon_months
        ]

        target_forecast = next(
            (
                it for it in all_items
                if it.get("district_id") == d_clean and it.get("occupation_id") == o_clean
            ),
            None,
        )

        # If baseline forecast is invalid or has insufficient history, return explicit status
        if (
            target_forecast is None
            or target_forecast.get("demand_forecast", {}).get("status") != "valid"
            or target_forecast.get("supply_forecast", {}).get("status") != "valid"
        ):
            return {
                "scenario_id": scenario_id,
                "is_synthetic": True,
                "status": "insufficient_history",
                "status_detail": (
                    f"Insufficient time-series history to establish a valid baseline forecast for "
                    f"{occ.occupation_title} in {geo.district_name} at the {horizon_months}-month horizon. "
                    "Simulation aborted to prevent fabricating speculative projections."
                ),
                "parameters": {
                    "period": base_period,
                    "horizon_months": horizon_months,
                    "target_period": target_period,
                    "district_id": geo.district_id,
                    "district_name": geo.district_name,
                    "state_code": geo.state_code,
                    "state_name": geo.state_name,
                    "occupation_id": occ.occupation_id,
                    "occupation_title": occ.occupation_title,
                    "sector": occ.sector,
                    "trade": occ.trade,
                },
                "baseline_seat_allocation": {
                    "baseline_avg_seats_per_cohort": 0.0,
                    "recent_cohort_periods": [],
                    "total_seats_in_window": 0,
                    "cohort_count_in_window": 0,
                },
                "proposed_seat_allocation": {
                    "proposed_seats_per_cohort": proposed_seats_per_cohort,
                    "absolute_seat_delta": 0.0,
                    "percentage_seat_change": 0.0,
                    "scaling_ratio": 1.0,
                },
                "funnel_metrics": {
                    "seat_utilization_rate": None,
                    "completion_rate": None,
                    "certification_rate": None,
                    "overall_yield_rate": None,
                    "current_monthly_throughput": None,
                },
                "baseline_projection": {
                    "forecast_demand_postings": None,
                    "forecast_demand_rank": None,
                    "forecast_supply_throughput": None,
                    "forecast_supply_rank": None,
                    "mismatch_score": None,
                    "classification": "Insufficient Data",
                },
                "scenario_projection": {
                    "scenario_supply_throughput": None,
                    "scenario_supply_rank": None,
                    "scenario_mismatch_score": None,
                    "scenario_classification": "Insufficient Data",
                },
                "impact_summary": {
                    "supply_throughput_delta": 0.0,
                    "supply_throughput_pct_change": 0.0,
                    "supply_rank_delta": 0.0,
                    "mismatch_score_delta": 0.0,
                    "classification_transition": "Insufficient Data -> Insufficient Data",
                },
                "coverage_scenario": {
                    "posting_to_opening_multiplier": round(posting_to_opening_multiplier, 4),
                    "local_availability_factor": round(local_availability_factor, 4),
                    "forecast_demand_postings": None,
                    "estimated_openings": None,
                    "baseline_supply_throughput": None,
                    "baseline_effective_output": None,
                    "baseline_coverage_pct": None,
                    "baseline_benchmark_ratio": None,
                    "scenario_supply_throughput": None,
                    "scenario_effective_output": None,
                    "scenario_coverage_pct": None,
                    "scenario_benchmark_ratio": None,
                    "coverage_pct_delta": None,
                    "benchmark_ratio_delta": None,
                    "metric_label": "Assumption-Adjusted Pipeline Scenario",
                    "assumptions_summary": (
                        f"Scenario assumptions: k = {posting_to_opening_multiplier:.2f} (multiplier converting postings to openings); "
                        f"alpha = {local_availability_factor:.2f} (local candidate availability share). "
                        "These are neutral illustrative scenario assumptions, NOT observed empirical parameters."
                    ),
                    "methodology_disclaimer": (
                        "This assumption-adjusted pipeline scenario is an exploratory decision-support simulation. "
                        "It does NOT represent actual vacancy fulfilment, a verified labor shortage, or a prediction "
                        "of guaranteed employment. Online job postings may be duplicated, renewed, or omit off-platform hiring. "
                        "Certified candidates may enter jobs later, migrate, pursue further study, or not immediately become available workers."
                    ),
                },
                "methodology": SIMULATION_METHODOLOGY,
                "assumptions": SIMULATION_ASSUMPTIONS,
                "limitations": SIMULATION_LIMITATIONS,
                "policy_disclaimer": SIMULATION_POLICY_DISCLAIMER,
            }

        # 3. Retrieve Historical Training Cohort & Funnel Rates
        sup_metrics = self.supply_service.calculate_supply_metrics(d_clean, o_clean, base_period)
        recent_periods = sup_metrics.get("throughput", {}).get("window_periods_3m", [])
        cohort_records = [
            self.supply_service._supply_records.get((p, d_clean, o_clean))
            for p in recent_periods
        ]
        valid_cohorts = [c for c in cohort_records if c is not None]
        cohort_count = len(valid_cohorts)
        total_sanctioned_seats = sum(c.sanctioned_seats for c in valid_cohorts)
        total_enrolments = sum(c.enrolments for c in valid_cohorts)
        total_completions = sum(c.completions for c in valid_cohorts)
        total_certifications = sum(c.certifications for c in valid_cohorts)

        baseline_avg_seats = (
            round(total_sanctioned_seats / cohort_count, 2)
            if cohort_count > 0
            else 0.0
        )

        if baseline_avg_seats <= 0.0:
            return {
                "scenario_id": scenario_id,
                "is_synthetic": True,
                "status": "insufficient_history",
                "status_detail": (
                    f"No sanctioned training seats recorded in historical cohorts for "
                    f"{occ.occupation_title} in {geo.district_name}. Baseline capacity cannot be calculated."
                ),
                "parameters": {
                    "period": base_period,
                    "horizon_months": horizon_months,
                    "target_period": target_period,
                    "district_id": geo.district_id,
                    "district_name": geo.district_name,
                    "state_code": geo.state_code,
                    "state_name": geo.state_name,
                    "occupation_id": occ.occupation_id,
                    "occupation_title": occ.occupation_title,
                    "sector": occ.sector,
                    "trade": occ.trade,
                },
                "baseline_seat_allocation": {
                    "baseline_avg_seats_per_cohort": 0.0,
                    "recent_cohort_periods": recent_periods,
                    "total_seats_in_window": 0,
                    "cohort_count_in_window": cohort_count,
                },
                "proposed_seat_allocation": {
                    "proposed_seats_per_cohort": proposed_seats_per_cohort,
                    "absolute_seat_delta": 0.0,
                    "percentage_seat_change": 0.0,
                    "scaling_ratio": 1.0,
                },
                "funnel_metrics": {
                    "seat_utilization_rate": None,
                    "completion_rate": None,
                    "certification_rate": None,
                    "overall_yield_rate": None,
                    "current_monthly_throughput": None,
                },
                "baseline_projection": {
                    "forecast_demand_postings": None,
                    "forecast_demand_rank": None,
                    "forecast_supply_throughput": None,
                    "forecast_supply_rank": None,
                    "mismatch_score": None,
                    "classification": "Insufficient Data",
                },
                "scenario_projection": {
                    "scenario_supply_throughput": None,
                    "scenario_supply_rank": None,
                    "scenario_mismatch_score": None,
                    "scenario_classification": "Insufficient Data",
                },
                "impact_summary": {
                    "supply_throughput_delta": 0.0,
                    "supply_throughput_pct_change": 0.0,
                    "supply_rank_delta": 0.0,
                    "mismatch_score_delta": 0.0,
                    "classification_transition": "Insufficient Data -> Insufficient Data",
                },
                "methodology": SIMULATION_METHODOLOGY,
                "assumptions": SIMULATION_ASSUMPTIONS,
                "limitations": SIMULATION_LIMITATIONS,
                "policy_disclaimer": SIMULATION_POLICY_DISCLAIMER,
            }

        # Rates
        utilization_rate = (
            round(total_enrolments / total_sanctioned_seats, 4)
            if total_sanctioned_seats > 0
            else None
        )
        completion_rate = (
            round(total_completions / total_enrolments, 4)
            if total_enrolments > 0
            else None
        )
        certification_rate = (
            round(total_certifications / total_completions, 4)
            if total_completions > 0
            else None
        )
        overall_yield_rate = (
            round(total_certifications / total_sanctioned_seats, 4)
            if total_sanctioned_seats > 0
            else None
        )
        current_monthly_throughput = (
            round(total_certifications / max(1, cohort_count), 1)
        )

        # 4. Scenario Scaling
        scaling_ratio = round(proposed_seats_per_cohort / baseline_avg_seats, 4)
        baseline_supply = float(target_forecast["supply_forecast"]["point_forecast"])

        # Proportional scaling under constant-yield pipeline assumption
        if abs(proposed_seats_per_cohort - baseline_avg_seats) < 1e-4:
            # Exact match when proposed seats equals baseline average
            scenario_supply = baseline_supply
        else:
            scenario_supply = max(
                0.0,
                round(baseline_supply * (proposed_seats_per_cohort / baseline_avg_seats), 1),
            )

        # 5. Recalculate Cross-Sectional Supply Percentile Rank
        supply_points: Dict[Tuple[str, str], Optional[float]] = {
            (it["district_id"], it["occupation_id"]): (
                float(it["supply_forecast"]["point_forecast"])
                if it.get("supply_forecast", {}).get("point_forecast") is not None
                else None
            )
            for it in all_items
        }

        scenario_supply_points = dict(supply_points)
        scenario_supply_points[(d_clean, o_clean)] = scenario_supply

        scenario_supply_ranks = compute_percentile_ranks(scenario_supply_points)
        scenario_supply_rank = scenario_supply_ranks.get((d_clean, o_clean), 50.0)
        if scenario_supply_rank is None:
            scenario_supply_rank = 50.0

        # Baseline metrics
        baseline_demand_postings = target_forecast["demand_forecast"].get("point_forecast_integer")
        baseline_demand_rank = float(target_forecast["projected_mismatch"]["forecast_demand_rank"])
        baseline_supply_rank = float(target_forecast["projected_mismatch"]["forecast_supply_rank"])
        baseline_mismatch_score = float(target_forecast["projected_mismatch"]["projected_mismatch_score"])
        baseline_classification = target_forecast["projected_mismatch"]["classification"]

        # Scenario mismatch calculation
        scenario_mismatch_score = round(baseline_demand_rank - scenario_supply_rank, 2)
        if scenario_mismatch_score >= DEFAULT_DEMAND_PRESSURE_THRESHOLD:
            scenario_classification = "Demand Pressure"
        elif scenario_mismatch_score <= DEFAULT_SUPPLY_PRESSURE_THRESHOLD:
            scenario_classification = "Supply Pressure"
        else:
            scenario_classification = "Balanced / Monitor"

        # 6. Calculate Deltas
        seat_delta = round(proposed_seats_per_cohort - baseline_avg_seats, 1)
        seat_pct_change = (
            round(
                ((proposed_seats_per_cohort - baseline_avg_seats) / baseline_avg_seats)
                * 100.0,
                1,
            )
            if baseline_avg_seats > 0.0
            else 0.0
        )

        supply_delta = round(scenario_supply - baseline_supply, 1)
        supply_pct_change = (
            round(((scenario_supply - baseline_supply) / baseline_supply) * 100.0, 1)
            if baseline_supply > 0.0
            else 0.0
        )

        supply_rank_delta = round(scenario_supply_rank - baseline_supply_rank, 2)
        mismatch_score_delta = round(scenario_mismatch_score - baseline_mismatch_score, 2)

        if baseline_classification != scenario_classification:
            transition_str = f"{baseline_classification} -> {scenario_classification}"
        else:
            transition_str = f"Unchanged ({scenario_classification})"

        # 7. Calculate Assumption-Adjusted Pipeline Coverage Scenario
        k_mult = round(float(posting_to_opening_multiplier), 4)
        alpha_fac = round(float(local_availability_factor), 4)

        if baseline_demand_postings is not None and baseline_demand_postings > 0:
            estimated_openings = round(baseline_demand_postings * k_mult, 1)
            base_effective = round(baseline_supply * alpha_fac, 1)
            scen_effective = round(scenario_supply * alpha_fac, 1)

            base_cov_pct = (
                round((base_effective / estimated_openings) * 100.0, 1)
                if estimated_openings > 0
                else None
            )
            scen_cov_pct = (
                round((scen_effective / estimated_openings) * 100.0, 1)
                if estimated_openings > 0
                else None
            )
            cov_delta = (
                round(scen_cov_pct - base_cov_pct, 1)
                if base_cov_pct is not None and scen_cov_pct is not None
                else None
            )

            base_bench_ratio = round((baseline_supply / baseline_demand_postings) * 100.0, 1)
            scen_bench_ratio = round((scenario_supply / baseline_demand_postings) * 100.0, 1)
            bench_delta = round(scen_bench_ratio - base_bench_ratio, 1)
        else:
            estimated_openings = 0.0 if baseline_demand_postings == 0 else None
            base_effective = round(baseline_supply * alpha_fac, 1)
            scen_effective = round(scenario_supply * alpha_fac, 1)
            base_cov_pct = None
            scen_cov_pct = None
            cov_delta = None
            base_bench_ratio = None
            scen_bench_ratio = None
            bench_delta = None

        coverage_scenario = {
            "posting_to_opening_multiplier": k_mult,
            "local_availability_factor": alpha_fac,
            "forecast_demand_postings": baseline_demand_postings,
            "estimated_openings": estimated_openings,
            "baseline_supply_throughput": baseline_supply,
            "baseline_effective_output": base_effective,
            "baseline_coverage_pct": base_cov_pct,
            "baseline_benchmark_ratio": base_bench_ratio,
            "scenario_supply_throughput": scenario_supply,
            "scenario_effective_output": scen_effective,
            "scenario_coverage_pct": scen_cov_pct,
            "scenario_benchmark_ratio": scen_bench_ratio,
            "coverage_pct_delta": cov_delta,
            "benchmark_ratio_delta": bench_delta,
            "metric_label": "Assumption-Adjusted Pipeline Scenario",
            "assumptions_summary": (
                f"Scenario assumptions: k = {k_mult:.2f} (multiplier converting postings to openings); "
                f"alpha = {alpha_fac:.2f} (local candidate availability share). "
                "These are neutral illustrative scenario assumptions, NOT observed empirical parameters."
            ),
            "methodology_disclaimer": (
                "This assumption-adjusted pipeline scenario is an exploratory decision-support simulation. "
                "It does NOT represent actual vacancy fulfilment, a verified labor shortage, or a prediction "
                "of guaranteed employment. Online job postings may be duplicated, renewed, or omit off-platform hiring. "
                "Certified candidates may enter jobs later, migrate, pursue further study, or not immediately become available workers."
            ),
        }

        return {
            "scenario_id": scenario_id,
            "is_synthetic": True,
            "status": "valid",
            "status_detail": None,
            "parameters": {
                "period": base_period,
                "horizon_months": horizon_months,
                "target_period": target_period,
                "district_id": geo.district_id,
                "district_name": geo.district_name,
                "state_code": geo.state_code,
                "state_name": geo.state_name,
                "occupation_id": occ.occupation_id,
                "occupation_title": occ.occupation_title,
                "sector": occ.sector,
                "trade": occ.trade,
            },
            "baseline_seat_allocation": {
                "baseline_avg_seats_per_cohort": baseline_avg_seats,
                "recent_cohort_periods": recent_periods,
                "total_seats_in_window": total_sanctioned_seats,
                "cohort_count_in_window": cohort_count,
            },
            "proposed_seat_allocation": {
                "proposed_seats_per_cohort": proposed_seats_per_cohort,
                "absolute_seat_delta": seat_delta,
                "percentage_seat_change": seat_pct_change,
                "scaling_ratio": scaling_ratio,
            },
            "funnel_metrics": {
                "seat_utilization_rate": utilization_rate,
                "completion_rate": completion_rate,
                "certification_rate": certification_rate,
                "overall_yield_rate": overall_yield_rate,
                "current_monthly_throughput": current_monthly_throughput,
            },
            "baseline_projection": {
                "forecast_demand_postings": baseline_demand_postings,
                "forecast_demand_rank": baseline_demand_rank,
                "forecast_supply_throughput": baseline_supply,
                "forecast_supply_rank": baseline_supply_rank,
                "mismatch_score": baseline_mismatch_score,
                "classification": baseline_classification,
            },
            "scenario_projection": {
                "scenario_supply_throughput": scenario_supply,
                "scenario_supply_rank": scenario_supply_rank,
                "scenario_mismatch_score": scenario_mismatch_score,
                "scenario_classification": scenario_classification,
            },
            "impact_summary": {
                "supply_throughput_delta": supply_delta,
                "supply_throughput_pct_change": supply_pct_change,
                "supply_rank_delta": supply_rank_delta,
                "mismatch_score_delta": mismatch_score_delta,
                "classification_transition": transition_str,
            },
            "coverage_scenario": coverage_scenario,
            "methodology": SIMULATION_METHODOLOGY,
            "assumptions": SIMULATION_ASSUMPTIONS,
            "limitations": SIMULATION_LIMITATIONS,
            "policy_disclaimer": SIMULATION_POLICY_DISCLAIMER,
        }
