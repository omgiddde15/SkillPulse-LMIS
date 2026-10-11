"""Training-Supply Estimation Service for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

This service implements Module 4 of the planned LMIS architecture:
- Ingests institutional training throughput data under the Concluding Training Cohort Model.
- Computes recent 3-month and 6-month certified-candidate throughput.
- Calculates pipeline funnel efficiency rates (seat utilisation, completion, certification, placement).
- Enforces strict placement follow-up maturity rules: cohorts with pending 90-day tracking are
  strictly excluded from placement rate calculations (never treated as zero).
- Clearly documents the formula and denominator for every calculated rate.
- Avoids double-counting annual capacity: treats rows as distinct concluding cohorts.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from app.schemas.data_models import Geography, Occupation, TrainingSupplyObservation
from app.services.demand_index import find_data_dir


SUPPLY_ESTIMATION_LIMITATIONS: str = (
    "Training-supply metrics represent aggregated pipeline throughput from concluding vocational cohorts. "
    "Utilization, completion, and certification rates reflect batch-level funnel progression, NOT repeated "
    "annual institutional capacity. Placement rates strictly exclude immature cohorts whose 90-day follow-up "
    "is pending. All figures are synthetic pilot benchmarks and do not reflect official ministry statistics."
)


class SupplyEstimationService:
    """Service for loading training supply observations and estimating localized talent throughput."""

    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = data_dir or find_data_dir()
        self._occupations: Dict[str, Occupation] = {}
        self._geographies: Dict[str, Geography] = {}
        self._supply_records: Dict[Tuple[str, str, str], TrainingSupplyObservation] = {}
        self._available_periods: List[str] = []
        self._loaded: bool = False

    def load_data(self) -> None:
        """Load and validate master entities and training supply observations from CSV."""
        if self._loaded:
            return

        occ_path = self.data_dir / "occupations.csv"
        geo_path = self.data_dir / "geographies.csv"
        sup_path = self.data_dir / "training_supply.csv"

        if not occ_path.is_file() or not geo_path.is_file() or not sup_path.is_file():
            raise FileNotFoundError(
                f"Missing required CSV files in {self.data_dir}. "
                "Ensure occupations.csv, geographies.csv, and training_supply.csv exist."
            )

        # 1. Load occupations
        self._occupations.clear()
        with open(occ_path, mode="r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                occ = Occupation(
                    occupation_id=row["occupation_id"],
                    occupation_title=row["occupation_title"],
                    sector=row["sector"],
                    trade=row["trade"],
                    nco_code=row.get("nco_code") or None,
                    nco_title=row.get("nco_title") or None,
                    qp_code=row.get("qp_code") or None,
                    qp_title=row.get("qp_title") or None,
                    nsqf_level=row.get("nsqf_level") or None,
                )
                self._occupations[occ.occupation_id] = occ

        # 2. Load geographies
        self._geographies.clear()
        with open(geo_path, mode="r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                geo = Geography(
                    district_id=row["district_id"],
                    district_name=row["district_name"],
                    state_code=row["state_code"],
                    state_name=row["state_name"],
                )
                self._geographies[geo.district_id] = geo

        # 3. Load training supply records
        self._supply_records.clear()
        periods_set: Set[str] = set()

        with open(sup_path, mode="r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                raw_place = row.get("placements", "").strip()
                placements_val = (
                    int(raw_place)
                    if (raw_place and raw_place.lower() not in {"null", "none", ""})
                    else None
                )
                is_synth = row.get("is_synthetic", "True").strip().lower() in {"true", "1", "yes"}

                obs = TrainingSupplyObservation(
                    period=row["period"].strip(),
                    district_id=row["district_id"].strip(),
                    occupation_id=row["occupation_id"].strip(),
                    sanctioned_seats=int(row["sanctioned_seats"]),
                    enrolments=int(row["enrolments"]),
                    completions=int(row["completions"]),
                    certifications=int(row["certifications"]),
                    placements=placements_val,
                    placement_status=row.get("placement_status", "complete").strip(),
                    is_synthetic=is_synth,
                )
                key = (obs.period, obs.district_id, obs.occupation_id)
                self._supply_records[key] = obs
                periods_set.add(obs.period)

        self._available_periods = sorted(periods_set)
        self._loaded = True

    def get_available_periods(self) -> List[str]:
        """Return chronologically sorted list of available reporting periods."""
        self.load_data()
        return list(self._available_periods)

    def calculate_supply_metrics(
        self,
        district_id: str,
        occupation_id: str,
        target_period: str,
    ) -> Dict[str, Any]:
        """Calculate throughput volume and funnel efficiency rates for a district-occupation.
        
        Args:
            district_id: District identifier (e.g., 'MH_PUN').
            occupation_id: Occupation identifier (e.g., 'OCC_IT_001').
            target_period: Reporting period formatted as 'YYYY-MM'.
            
        Returns:
            Dictionary of volume throughputs, documented funnel rates, and follow-up status.
        """
        self.load_data()

        if target_period not in self._available_periods:
            raise ValueError(
                f"Period '{target_period}' not found. Available periods: "
                f"{self._available_periods[0]} to {self._available_periods[-1]}"
            )

        t_idx = self._available_periods.index(target_period)

        # 1. Trailing 3-month window (T, T-1, T-2)
        if t_idx >= 2:
            recent_3_periods = [
                self._available_periods[t_idx - 2],
                self._available_periods[t_idx - 1],
                self._available_periods[t_idx],
            ]
        else:
            recent_3_periods = self._available_periods[: t_idx + 1]

        # 2. Trailing 6-month window (T down to T-5) where sufficient history exists
        if t_idx >= 5:
            recent_6_periods: Optional[List[str]] = [
                self._available_periods[t_idx - i] for i in reversed(range(6))
            ]
        else:
            recent_6_periods = None

        # 3. Collect cohorts in the trailing 3-month window
        cohorts_3m: List[TrainingSupplyObservation] = []
        for p in recent_3_periods:
            obs = self._supply_records.get((p, district_id, occupation_id))
            if obs:
                cohorts_3m.append(obs)

        # 4. Certification Throughput Volumes
        certifications_3m = sum(c.certifications for c in cohorts_3m)

        if recent_6_periods is not None:
            cohorts_6m = [
                self._supply_records.get((p, district_id, occupation_id))
                for p in recent_6_periods
            ]
            certifications_6m: Optional[int] = sum(
                c.certifications for c in cohorts_6m if c is not None
            )
        else:
            certifications_6m = None

        # 5. Funnel aggregates over the trailing 3-month window
        total_seats = sum(c.sanctioned_seats for c in cohorts_3m)
        total_enrolments = sum(c.enrolments for c in cohorts_3m)
        total_completions = sum(c.completions for c in cohorts_3m)
        total_certifications = sum(c.certifications for c in cohorts_3m)

        # Separate matured cohorts from pending cohorts
        matured_cohorts = [
            c for c in cohorts_3m if c.placement_status == "complete" and c.placements is not None
        ]
        pending_cohorts = [c for c in cohorts_3m if c.placement_status == "pending"]

        total_matured_certifications = sum(c.certifications for c in matured_cohorts)
        total_matured_placements = sum(c.placements for c in matured_cohorts)  # type: ignore[misc]

        # 6. Rate calculations with explicitly documented denominators
        # Rate 1: Enrolment-to-Seat Utilisation Rate
        utilization_rate: Optional[float] = None
        if total_seats > 0:
            utilization_rate = round(total_enrolments / total_seats, 4)

        # Rate 2: Completion Rate
        completion_rate: Optional[float] = None
        if total_enrolments > 0:
            completion_rate = round(total_completions / total_enrolments, 4)

        # Rate 3: Certification Rate
        certification_rate: Optional[float] = None
        if total_completions > 0:
            certification_rate = round(total_certifications / total_completions, 4)

        # Rate 4: Placement Rate (strictly on matured cohorts)
        placement_rate: Optional[float] = None
        if total_matured_certifications > 0:
            placement_rate = round(total_matured_placements / total_matured_certifications, 4)

        # Follow-up status summary
        if len(pending_cohorts) == len(cohorts_3m):
            follow_up_status = "pending"
        elif len(matured_cohorts) == len(cohorts_3m):
            follow_up_status = "complete"
        else:
            follow_up_status = "partial"

        # Expected cohorts for the 3-month throughput window
        expected_cohorts_3m = 3 if t_idx >= 2 else (t_idx + 1)
        supply_data_coverage_pct = round((len(cohorts_3m) / max(1, expected_cohorts_3m)) * 100.0, 1)

        matured_follow_up_pct = (
            round((len(matured_cohorts) / len(cohorts_3m)) * 100.0, 1)
            if cohorts_3m
            else 0.0
        )

        # Latest single-month cohort snapshot
        curr_obs = self._supply_records.get((target_period, district_id, occupation_id))

        return {
            "period": target_period,
            "district_id": district_id,
            "occupation_id": occupation_id,
            "supply_data_coverage_pct": supply_data_coverage_pct,
            "throughput": {
                "certifications_3m": certifications_3m,
                "certifications_6m": certifications_6m,
                "window_periods_3m": recent_3_periods,
                "window_periods_6m": recent_6_periods,
            },
            "funnel_rates": {
                "seat_utilization_rate": {
                    "value": utilization_rate,
                    "formula": "enrolments / sanctioned_seats",
                    "numerator": total_enrolments,
                    "denominator_name": "sanctioned_batch_seats",
                    "denominator_value": total_seats,
                    "interpretation": "Ratio of enrolled candidates to cohort batch intake capacity.",
                },
                "completion_rate": {
                    "value": completion_rate,
                    "formula": "completions / enrolments",
                    "numerator": total_completions,
                    "denominator_name": "enrolled_candidates",
                    "denominator_value": total_enrolments,
                    "interpretation": "Ratio of enrolled candidates who completed training curriculum.",
                },
                "certification_rate": {
                    "value": certification_rate,
                    "formula": "certifications / completions",
                    "numerator": total_certifications,
                    "denominator_name": "completed_candidates",
                    "denominator_value": total_completions,
                    "interpretation": "Ratio of completers who passed standardized assessment.",
                },
                "placement_rate": {
                    "value": placement_rate,
                    "formula": "matured_placements / matured_certifications",
                    "numerator": total_matured_placements if total_matured_certifications > 0 else None,
                    "denominator_name": "matured_certified_candidates",
                    "denominator_value": total_matured_certifications,
                    "follow_up_status": follow_up_status,
                    "interpretation": (
                        "Placement rate computed exclusively on cohorts where the 90-day tracking window "
                        "has elapsed. Immature/pending cohorts are strictly excluded and remain null."
                    ),
                },
            },
            "placement_follow_up": {
                "status": follow_up_status,
                "matured_cohorts_count": len(matured_cohorts),
                "pending_cohorts_count": len(pending_cohorts),
                "total_cohorts_in_window": len(cohorts_3m),
                "matured_follow_up_pct": matured_follow_up_pct,
                "follow_up_window_days": 90,
                "interpretation": (
                    "Placement tracking requires a standardized 90-day post-certification follow-up window. "
                    "Cohorts concluding within the last 90 days are marked 'pending' and are excluded from placement rates; "
                    "pending status is immature tracking, NOT missing data failure or zero placements."
                ),
            },
            "cohort_metadata": {
                "total_cohorts_in_window": len(cohorts_3m),
                "matured_cohorts_count": len(matured_cohorts),
                "pending_cohorts_count": len(pending_cohorts),
                "reporting_month_snapshot": {
                    "sanctioned_seats": curr_obs.sanctioned_seats if curr_obs else None,
                    "enrolments": curr_obs.enrolments if curr_obs else None,
                    "completions": curr_obs.completions if curr_obs else None,
                    "certifications": curr_obs.certifications if curr_obs else None,
                    "placements": curr_obs.placements if curr_obs else None,
                    "placement_status": curr_obs.placement_status if curr_obs else None,
                },
            },
            "is_synthetic": True,
        }

    def get_cross_sectional_supply(
        self,
        target_period: Optional[str] = None,
    ) -> Dict[Tuple[str, str], Dict[str, Any]]:
        """Calculate supply metrics across all district-occupation pairs for a reporting period.
        
        Returns:
            Dictionary mapping (district_id, occupation_id) to its calculated supply metrics dictionary.
        """
        self.load_data()
        period = (target_period or self._available_periods[-1]).strip()

        cross_section: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for dist_id in self._geographies:
            for occ_id in self._occupations:
                key = (dist_id, occ_id)
                cross_section[key] = self.calculate_supply_metrics(dist_id, occ_id, period)

        return cross_section
