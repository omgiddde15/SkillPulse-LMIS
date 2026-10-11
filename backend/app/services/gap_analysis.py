"""Relative Demand-Supply Gap Analysis Engine for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

This service implements Module 5 of the planned LMIS architecture:
- Matches localized occupational Demand Index scores with Training-Supply output indices
  for identical periods, districts, and occupations.
- Normalizes recent 3-month certification throughput into a Supply-Output Index (0 to 100)
  using cross-sectional percentile ranks.
- Calculates the Relative Mismatch Score:
    relative_mismatch_score = demand_index_score - supply_output_index
  Positive scores indicate relatively stronger employer demand than training throughput.
  Negative scores indicate relatively stronger training throughput than hiring appetite.
- Flags records against configurable alert thresholds (+15 for Demand Pressure, -15 for Supply Pressure).
- Enforces strict semantic guardrails: the mismatch score is a relative prioritization metric,
  NOT a headcount shortage/surplus of workers or proof of an absolute shortage.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app.services.demand_index import (
    DemandIndexService,
    compute_percentile_ranks,
)
from app.services.supply_estimation import SupplyEstimationService

DEFAULT_DEMAND_PRESSURE_THRESHOLD: float = 15.0
DEFAULT_SUPPLY_PRESSURE_THRESHOLD: float = -15.0

GAP_ANALYSIS_LIMITATIONS: str = (
    "SkillPulse Relative Demand-Supply Mismatch Score is a relative prioritization metric comparing "
    "cross-sectional percentile ranks of recruitment intensity versus institutional certification throughput. "
    "It is NOT a headcount gap of missing or surplus workers, an econometric forecast, or definitive proof "
    "of an actual labour shortage or glut. Positive mismatch denotes relatively stronger hiring appetite "
    "compared to training throughput within the pilot sample; negative mismatch denotes relatively stronger "
    "training throughput compared to hiring appetite. Thresholds (+15 / -15) are configurable prototype design "
    "assumptions and have not been validated as statutory policy triggers."
)


class GapAnalysisService:
    """Service for computing relative demand-supply mismatch scores and diagnostic flags."""

    def __init__(
        self,
        demand_service: Optional[DemandIndexService] = None,
        supply_service: Optional[SupplyEstimationService] = None,
        demand_pressure_threshold: float = DEFAULT_DEMAND_PRESSURE_THRESHOLD,
        supply_pressure_threshold: float = DEFAULT_SUPPLY_PRESSURE_THRESHOLD,
    ):
        self.demand_service = demand_service or DemandIndexService()
        self.supply_service = supply_service or SupplyEstimationService()
        self.demand_pressure_threshold = demand_pressure_threshold
        self.supply_pressure_threshold = supply_pressure_threshold

    def calculate_gap_analysis(
        self,
        period: Optional[str] = None,
        state_code: Optional[str] = None,
        district_id: Optional[str] = None,
        sector: Optional[str] = None,
        classification: Optional[str] = None,
        sort_by: str = "abs_mismatch",
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Calculate relative mismatch between demand intensity and training-supply output.
        
        Args:
            period: Target monthly reporting period (YYYY-MM). Defaults to latest available period.
            state_code: Optional state filter (e.g., 'MH').
            district_id: Optional district filter (e.g., 'MH_PUN').
            sector: Optional economic sector filter (e.g., 'IT/ITeS').
            classification: Optional alert classification filter ('Demand Pressure', 'Supply Pressure', 'Balanced / Monitor').
            sort_by: Sorting strategy ('abs_mismatch', 'demand_pressure', 'supply_pressure').
            limit: Optional maximum number of ranked records to return.
            
        Returns:
            Dictionary containing period metadata, thresholds, methodology, and ranked matched results.
        """
        # 1. Compute Demand Index for target period
        demand_response = self.demand_service.calculate_demand_index(period=period)
        target_period = demand_response["period"]

        # 2. Extract Cross-Sectional Supply Metrics for target period
        supply_map = self.supply_service.get_cross_sectional_supply(target_period=target_period)

        # 3. Derive Supply-Output Index across cross-section
        # Percentile rank of recent 3-month certified-candidate throughput across all evaluated pairs
        raw_cert_throughput: Dict[Tuple[str, str], Optional[float]] = {}
        for key, s_metrics in supply_map.items():
            raw_cert_throughput[key] = float(s_metrics["throughput"]["certifications_3m"])

        supply_output_ranks = compute_percentile_ranks(raw_cert_throughput)

        # 4. Match Demand and Supply for identical period, district, occupation
        matched_records: List[Dict[str, Any]] = []

        # Index demand records by (district_id, occupation_id)
        for dem_rec in demand_response["results"]:
            d_id = dem_rec["district_id"]
            o_id = dem_rec["occupation_id"]
            key = (d_id, o_id)

            sup_metrics = supply_map.get(key)
            if not sup_metrics:
                continue

            demand_score = float(dem_rec["composite_score"])
            supply_score = float(supply_output_ranks.get(key, 50.0) or 50.0)

            # Calculate relative mismatch score: Demand - Supply
            mismatch_score = round(demand_score - supply_score, 2)

            # Classify mismatch against configurable threshold assumptions
            if mismatch_score >= self.demand_pressure_threshold:
                alert_class = "Demand Pressure"
                alert_desc = "Employer demand intensity substantially exceeds training certification throughput."
                alert_level = "high"
            elif mismatch_score <= self.supply_pressure_threshold:
                alert_class = "Supply Pressure"
                alert_desc = "Training certification throughput substantially exceeds employer recruitment demand."
                alert_level = "high"
            else:
                alert_class = "Balanced / Monitor"
                alert_desc = "Demand intensity and training throughput are broadly aligned within relative range."
                alert_level = "moderate"

            # Formulate clear explanatory factors
            cert_3m = sup_metrics["throughput"]["certifications_3m"]
            cert_6m = sup_metrics["throughput"]["certifications_6m"]
            cert_6m_str = f"{cert_6m} candidates" if cert_6m is not None else "Insufficient history (<6m)"

            funnel = sup_metrics["funnel_rates"]
            util_val = funnel["seat_utilization_rate"]["value"]
            comp_val = funnel["completion_rate"]["value"]
            cert_val = funnel["certification_rate"]["value"]
            place_val = funnel["placement_rate"]["value"]

            util_str = f"{util_val:.1%}" if util_val is not None else "N/A"
            comp_str = f"{comp_val:.1%}" if comp_val is not None else "N/A"
            cert_str = f"{cert_val:.1%}" if cert_val is not None else "N/A"
            place_str = (
                f"{place_val:.1%}"
                if place_val is not None
                else "Pending follow-up (immature)"
            )

            # 5. Data coverage calculations
            demand_coverage_pct = float(dem_rec.get("data_coverage_pct", 100.0))
            supply_coverage_pct = float(sup_metrics.get("supply_data_coverage_pct", 100.0))

            # index_data_coverage_pct measures availability of active inputs needed to compute the mismatch score
            index_data_coverage_pct = round(0.5 * demand_coverage_pct + 0.5 * supply_coverage_pct, 1)

            missing_demand = dem_rec.get("missing_signals", [])
            missing_supply: List[str] = []
            if supply_coverage_pct < 100.0:
                avail_cohorts = sup_metrics["cohort_metadata"]["total_cohorts_in_window"]
                missing_supply.append(f"missing_{3 - avail_cohorts}_cohort_month(s)")
            missing_index_signals = list(missing_demand) + list(missing_supply)

            placement_follow_up = sup_metrics.get("placement_follow_up", {})

            explanatory_factors: List[str] = [
                f"Mismatch Score: {mismatch_score:+.1f} pts ({alert_class}). {alert_desc}",
                f"Relative Scores: Demand Index: {demand_score:.1f}/100, Supply Output Index: {supply_score:.1f}/100.",
                f"Training Throughput: 3-Month certified volume is {cert_3m} candidates (6-Month: {cert_6m_str}).",
                f"Funnel Efficiency: Utilization: {util_str}, Completion: {comp_str}, Certification: {cert_str}, Placement: {place_str}.",
            ]

            # Append coverage advisory when inputs are missing
            if missing_index_signals:
                explanatory_factors.append(
                    f"Data Coverage Advisory: Index input coverage is {index_data_coverage_pct:.1f}% due to missing signals: {missing_index_signals}. "
                    f"The relative mismatch score reflects re-normalized active components; alert classification ({alert_class}) should be treated as preliminary pending full longitudinal history."
                )

            # Append top demand index driver if available
            if dem_rec.get("key_drivers"):
                explanatory_factors.append(f"Top Demand Driver: {dem_rec['key_drivers'][0]}")

            matched_records.append({
                "period": target_period,
                "district_id": d_id,
                "district_name": dem_rec["district_name"],
                "state_code": dem_rec["state_code"],
                "state_name": dem_rec["state_name"],
                "occupation_id": o_id,
                "occupation_title": dem_rec["occupation_title"],
                "sector": dem_rec["sector"],
                "trade": dem_rec["trade"],
                "nco_code": dem_rec["nco_code"],
                "nco_title": dem_rec.get("nco_title"),
                "qp_code": dem_rec.get("qp_code"),
                "qp_title": dem_rec.get("qp_title"),
                "nsqf_level": dem_rec.get("nsqf_level"),
                "demand_index_score": demand_score,
                "supply_output_index": supply_score,
                "relative_mismatch_score": mismatch_score,
                "classification": alert_class,
                "alert_level": alert_level,
                "index_data_coverage_pct": index_data_coverage_pct,
                "data_coverage_pct": index_data_coverage_pct,  # Backward compatible alias
                "data_coverage": {
                    "index_data_coverage_pct": index_data_coverage_pct,
                    "demand_index_coverage_pct": demand_coverage_pct,
                    "supply_index_coverage_pct": supply_coverage_pct,
                    "missing_index_signals": missing_index_signals,
                    "placement_follow_up_coverage": {
                        "status": placement_follow_up.get("status"),
                        "matured_cohorts_count": placement_follow_up.get("matured_cohorts_count"),
                        "pending_cohorts_count": placement_follow_up.get("pending_cohorts_count"),
                        "total_cohorts_in_window": placement_follow_up.get("total_cohorts_in_window"),
                        "matured_follow_up_pct": placement_follow_up.get("matured_follow_up_pct"),
                    },
                },
                "placement_follow_up": placement_follow_up,
                "missing_index_signals": missing_index_signals,
                "throughput": sup_metrics["throughput"],
                "funnel_rates": sup_metrics["funnel_rates"],
                "cohort_metadata": sup_metrics["cohort_metadata"],
                "demand_components": dem_rec["components"],
                "explanatory_factors": explanatory_factors,
                "is_synthetic": True,
            })

        # 5. Deterministic sorting
        if sort_by == "demand_pressure":
            # Highest positive mismatch first (greatest demand pressure)
            matched_records.sort(
                key=lambda r: (
                    -r["relative_mismatch_score"],
                    -r["demand_index_score"],
                    r["occupation_title"],
                    r["district_name"],
                )
            )
        elif sort_by == "supply_pressure":
            # Lowest negative mismatch first (greatest supply pressure)
            matched_records.sort(
                key=lambda r: (
                    r["relative_mismatch_score"],
                    r["supply_output_index"],
                    r["occupation_title"],
                    r["district_name"],
                )
            )
        else:
            # Default 'abs_mismatch': largest divergence first
            matched_records.sort(
                key=lambda r: (
                    -abs(r["relative_mismatch_score"]),
                    -r["relative_mismatch_score"],
                    -r["demand_index_score"],
                    r["occupation_title"],
                    r["district_name"],
                )
            )

        # 6. Assign overall ranks before filtering
        for idx, rec in enumerate(matched_records, start=1):
            rec["rank"] = idx

        # 7. Apply optional user filters
        filtered = matched_records
        if state_code:
            st = state_code.strip().upper()
            filtered = [r for r in filtered if r["state_code"].upper() == st]
        if district_id:
            dt = district_id.strip().upper()
            filtered = [r for r in filtered if r["district_id"].upper() == dt]
        if sector:
            sc = sector.strip().lower()
            filtered = [r for r in filtered if r["sector"].lower() == sc]
        if classification:
            cl = classification.strip().lower()
            filtered = [r for r in filtered if r["classification"].lower() == cl]

        total_evaluated = len(matched_records)
        total_filtered = len(filtered)

        # 8. Limit
        if limit is not None and limit > 0:
            output_records = filtered[:limit]
        else:
            output_records = filtered

        return {
            "period": target_period,
            "reference_date": "2026-10-09",
            "is_synthetic": True,
            "methodology": {
                "name": "SkillPulse Relative Demand-Supply Mismatch Engine",
                "demand_metric": "SkillPulse Explainable Composite Demand Index (0 to 100 percentile rank)",
                "supply_metric": "Cross-sectional percentile rank of recent 3-month certification throughput (0 to 100)",
                "mismatch_formula": "relative_mismatch_score = demand_index_score - supply_output_index",
                "scale": "Relative index score difference ranging from -100 to +100",
                "tie_breaking": "Deterministic Fractional Mid-Point Ranking",
                "coverage_semantics": {
                    "index_data_coverage_pct": (
                        "Measures completeness of inputs required to compute the relative mismatch score "
                        "(equal weighting of demand components and supply certification throughput). "
                        "Missing inputs (e.g., lack of trailing 6-month history for demand growth) lower index coverage "
                        "and trigger dynamic component weight re-normalization. Mismatch scores with <100% coverage "
                        "reflect re-normalized active signals and should be interpreted as preliminary."
                    ),
                    "placement_follow_up_separation": (
                        "Placement follow-up tracking is an outcome metric reported separately and does NOT reduce index_data_coverage_pct. "
                        "Cohorts with immature follow-up (<90 days post-certification) are marked 'pending', which represents immature observation, "
                        "NOT a missing data failure or zero placements."
                    ),
                },
            },
            "alert_thresholds": {
                "demand_pressure": f">= +{self.demand_pressure_threshold:.1f}",
                "supply_pressure": f"<= {self.supply_pressure_threshold:.1f}",
                "balanced_monitoring": f"Between {self.supply_pressure_threshold:.1f} and +{self.demand_pressure_threshold:.1f}",
                "assumptions_note": (
                    "Alert thresholds (+15 / -15) are configurable prototype heuristic design assumptions, "
                    "not empirically validated econometric or statutory policy triggers."
                ),
            },
            "limitations": GAP_ANALYSIS_LIMITATIONS,
            "summary": {
                "total_cross_section_items": total_evaluated,
                "returned_items": len(output_records),
                "filter_matches": total_filtered,
                "filters_applied": {
                    "state_code": state_code,
                    "district_id": district_id,
                    "sector": sector,
                    "classification": classification,
                    "sort_by": sort_by,
                    "limit": limit,
                },
            },
            "results": output_records,
        }
