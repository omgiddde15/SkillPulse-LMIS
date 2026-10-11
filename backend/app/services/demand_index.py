"""Explainable Demand Index Engine for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

This service implements Module 3 of the planned LMIS architecture:
- Computes multi-component occupational demand intensity scores across districts and monthly periods.
- Derives 3-month demand growth dynamically from trailing historical posting volumes.
- Applies cross-sectional percentile rank normalization (0 to 100) with deterministic tie-breaking.
- Re-normalizes weights dynamically when components are missing, reporting exact data coverage.
- Provides transparent, human-readable explanatory factors for each scored occupation.
- Enforces strict semantic guardrails: the index is a relative prioritization metric within the
  evaluated sample, NOT a raw headcount of jobs, a probabilistic forecast, or proof of a shortage.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from app.schemas.data_models import DemandObservation, Geography, Occupation

# Initial configurable design weights (heuristic prototype assumptions, not statistically proven weights)
DEFAULT_COMPONENT_WEIGHTS: Dict[str, float] = {
    "posting_volume": 0.30,       # 30% — Volume of active online recruitment postings
    "demand_growth": 0.25,        # 25% — Trailing 3-month growth vs preceding 3-month average
    "vacancy_persistence": 0.15,  # 15% — Score indicating duration / recruitment friction
    "employer_diversity": 0.15,   # 15% — Active employer hiring count diversity
    "wage_attractiveness": 0.15,  # 15% — Synthetic wage competitiveness benchmark index
}

DEMAND_INDEX_LIMITATIONS: str = (
    "SkillPulse Demand Index is a cross-sectional relative demand indicator within the evaluated pilot sample. "
    "It reflects relative employer hiring appetite and recruitment intensity across occupations and districts. "
    "It is NOT an absolute job count, an employment forecast probability, or definitive proof of a skill shortage. "
    "Initial component weights are configurable design assumptions and have not been empirically econometrically calibrated."
)


def find_data_dir() -> Path:
    """Locate data/sample directory across various run contexts."""
    candidates = [
        Path.cwd() / "data" / "sample",
        Path.cwd() / "SkillPulse" / "data" / "sample",
        Path(__file__).resolve().parent.parent.parent.parent / "data" / "sample",
        Path("C:/SIH26246/SkillPulse/data/sample"),
        Path("C:/SIH26246/data/sample"),
    ]
    for candidate in candidates:
        if candidate.is_dir() and (candidate / "occupations.csv").exists():
            return candidate.resolve()
    # Fallback to standard project structure
    target = Path(__file__).resolve().parent.parent.parent.parent / "data" / "sample"
    return target.resolve()


def compute_percentile_ranks(values: Dict[Tuple[str, str], Optional[float]]) -> Dict[Tuple[str, str], Optional[float]]:
    """Compute deterministic cross-sectional percentile ranks normalized strictly from 0 to 100.
    
    Formula for item with value v among M valid items:
    rank = count(x < v) + (count(x == v) - 1) / 2
    score = (rank / (M - 1)) * 100.0 if M > 1 else 50.0
    
    Ties are handled deterministically via fractional mid-point ranking.
    Items with None value receive None score.
    """
    valid_items = [(k, v) for k, v in values.items() if v is not None]
    if not valid_items:
        return {k: None for k in values}

    m = len(valid_items)
    val_list = [v for _, v in valid_items]

    # If all items have identical values, return neutral 50.0 for all
    if min(val_list) == max(val_list):
        return {k: (50.0 if v is not None else None) for k, v in values.items()}

    scores: Dict[Tuple[str, str], Optional[float]] = {}
    for k, v in values.items():
        if v is None:
            scores[k] = None
            continue
        strictly_less = sum(1 for x in val_list if x < v)
        equal_to = sum(1 for x in val_list if x == v)
        rank = strictly_less + (equal_to - 1) / 2.0
        pct_score = (rank / (m - 1)) * 100.0 if m > 1 else 50.0
        scores[k] = round(pct_score, 2)

    return scores


class DemandIndexService:
    """Service for loading validated demand signals and computing explainable demand indices."""

    def __init__(
        self,
        data_dir: Optional[Path] = None,
        weights: Optional[Dict[str, float]] = None,
    ):
        self.data_dir = data_dir or find_data_dir()
        self.weights = weights or dict(DEFAULT_COMPONENT_WEIGHTS)
        self._occupations: Dict[str, Occupation] = {}
        self._geographies: Dict[str, Geography] = {}
        self._demand_by_period: Dict[str, List[DemandObservation]] = {}
        self._postings_history: Dict[Tuple[str, str], Dict[str, float]] = {}
        self._available_periods: List[str] = []
        self._loaded = False

    def load_data(self) -> None:
        """Load and validate master entities and demand observations from CSV."""
        if self._loaded:
            return

        occ_path = self.data_dir / "occupations.csv"
        geo_path = self.data_dir / "geographies.csv"
        dem_path = self.data_dir / "demand_observations.csv"

        if not occ_path.is_file() or not geo_path.is_file() or not dem_path.is_file():
            raise FileNotFoundError(
                f"Missing required CSV data files in {self.data_dir}. "
                "Ensure occupations.csv, geographies.csv, and demand_observations.csv exist."
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

        # 3. Load demand observations
        self._demand_by_period.clear()
        self._postings_history.clear()
        period_set: Set[str] = set()

        with open(dem_path, mode="r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                is_synth = row.get("is_synthetic", "True").strip().lower() in {"true", "1", "yes"}
                obs = DemandObservation(
                    period=row["period"],
                    district_id=row["district_id"],
                    occupation_id=row["occupation_id"],
                    source=row["source"],
                    signal_type=row["signal_type"],
                    signal_value=float(row["signal_value"]),
                    unit=row["unit"],
                    data_provenance=row["data_provenance"],
                    is_synthetic=is_synth,
                )
                self._demand_by_period.setdefault(obs.period, []).append(obs)
                period_set.add(obs.period)

                if obs.signal_type == "online_job_postings":
                    key = (obs.district_id, obs.occupation_id)
                    self._postings_history.setdefault(key, {})[obs.period] = obs.signal_value

        self._available_periods = sorted(period_set)
        self._loaded = True

    def get_available_periods(self) -> List[str]:
        """Return list of chronologically sorted periods available in dataset."""
        self.load_data()
        return list(self._available_periods)

    def calculate_growth_rate(
        self,
        district_id: str,
        occupation_id: str,
        target_period: str,
    ) -> Optional[float]:
        """Calculate trailing 3-month fractional growth rate relative to preceding 3-month average.
        
        Requires 6 consecutive periods:
        Recent 3: periods T, T-1, T-2
        Prior 3:  periods T-3, T-4, T-5
        
        Formula: (mean(recent) - mean(prior)) / mean(prior) = (recent / prior) - 1.0
        Semantics: Fractional growth rate where e.g. 0.0752 denotes +7.52% growth
        (NOT an uncentered ratio of 1.0752).
        Returns None if history is insufficient, any value is missing, or prior denominator <= 0.
        """
        self.load_data()
        if target_period not in self._available_periods:
            return None

        t_idx = self._available_periods.index(target_period)
        # We need at least 5 preceding periods (total 6 periods including target)
        if t_idx < 5:
            return None

        history = self._postings_history.get((district_id, occupation_id), {})
        recent_periods = [self._available_periods[t_idx - i] for i in range(3)]
        prior_periods = [self._available_periods[t_idx - 3 - i] for i in range(3)]

        recent_vals = [history.get(p) for p in recent_periods]
        prior_vals = [history.get(p) for p in prior_periods]

        if any(v is None for v in recent_vals) or any(v is None for v in prior_vals):
            return None

        mean_recent = sum(recent_vals) / 3.0  # type: ignore[arg-type]
        mean_prior = sum(prior_vals) / 3.0    # type: ignore[arg-type]

        if mean_prior <= 0.0:
            return None

        return round((mean_recent - mean_prior) / mean_prior, 4)

    def calculate_demand_index(
        self,
        period: Optional[str] = None,
        state_code: Optional[str] = None,
        district_id: Optional[str] = None,
        sector: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Calculate explainable demand index rankings and component diagnostics.
        
        Args:
            period: Target monthly period (YYYY-MM). Defaults to latest available period.
            state_code: Optional 2-letter state filter (e.g., 'MH').
            district_id: Optional district filter (e.g., 'MH_PUN').
            sector: Optional sector filter (e.g., 'IT/ITeS').
            limit: Optional maximum number of ranked records to return.
            
        Returns:
            Dictionary containing period metadata, methodology, limitations, and ranked results.
        """
        self.load_data()

        # 1. Period resolution
        if period is None:
            if not self._available_periods:
                raise ValueError("No demand observations available in dataset.")
            target_period = self._available_periods[-1]
        else:
            target_period = period.strip()
            if target_period not in self._available_periods:
                raise ValueError(
                    f"Period '{target_period}' not found. Available periods: "
                    f"{self._available_periods[0]} to {self._available_periods[-1]}"
                )

        # 2. Extract signals for target period
        period_obs = self._demand_by_period.get(target_period, [])
        signal_map: Dict[Tuple[str, str], Dict[str, float]] = {}
        for obs in period_obs:
            key = (obs.district_id, obs.occupation_id)
            signal_map.setdefault(key, {})[obs.signal_type] = obs.signal_value

        # 3. Identify all distinct active (district, occupation) pairs
        all_keys: Set[Tuple[str, str]] = set()
        for dist in self._geographies:
            for occ in self._occupations:
                all_keys.add((dist, occ))

        # 4. Extract raw values for all 5 components across cross-section
        raw_postings: Dict[Tuple[str, str], Optional[float]] = {}
        raw_growth: Dict[Tuple[str, str], Optional[float]] = {}
        raw_persistence: Dict[Tuple[str, str], Optional[float]] = {}
        raw_employers: Dict[Tuple[str, str], Optional[float]] = {}
        raw_wages: Dict[Tuple[str, str], Optional[float]] = {}

        for key in all_keys:
            d_id, o_id = key
            sigs = signal_map.get(key, {})
            raw_postings[key] = sigs.get("online_job_postings")
            raw_growth[key] = self.calculate_growth_rate(d_id, o_id, target_period)
            raw_persistence[key] = sigs.get("vacancy_persistence_score")
            raw_employers[key] = sigs.get("active_employer_count")
            raw_wages[key] = sigs.get("wage_attractiveness_index")

        # 5. Cross-sectional percentile rank normalization (0 to 100)
        norm_postings = compute_percentile_ranks(raw_postings)
        norm_growth = compute_percentile_ranks(raw_growth)
        norm_persistence = compute_percentile_ranks(raw_persistence)
        norm_employers = compute_percentile_ranks(raw_employers)
        norm_wages = compute_percentile_ranks(raw_wages)

        # 6. Composite scoring with dynamic weight re-normalization
        calculated_records: List[Dict[str, Any]] = []

        for key in all_keys:
            dist_id, occ_id = key
            geo = self._geographies[dist_id]
            occ = self._occupations[occ_id]

            components: Dict[str, Dict[str, Any]] = {
                "posting_volume": {
                    "raw_value": int(raw_postings[key]) if raw_postings[key] is not None else None,
                    "unit": "postings_count",
                    "score": norm_postings[key],
                    "weight": self.weights["posting_volume"],
                },
                "demand_growth": {
                    "raw_value": raw_growth[key],
                    "unit": "fractional_growth_rate",
                    "interpretation": "Trailing 3-month growth rate relative to preceding 3-month average (e.g., 0.0752 denotes +7.52% growth, not a ratio of 1.0752)",
                    "score": norm_growth[key],
                    "weight": self.weights["demand_growth"],
                },
                "vacancy_persistence": {
                    "raw_value": raw_persistence[key],
                    "unit": "score_points",
                    "score": norm_persistence[key],
                    "weight": self.weights["vacancy_persistence"],
                },
                "employer_diversity": {
                    "raw_value": int(raw_employers[key]) if raw_employers[key] is not None else None,
                    "unit": "employer_count",
                    "score": norm_employers[key],
                    "weight": self.weights["employer_diversity"],
                },
                "wage_attractiveness": {
                    "raw_value": raw_wages[key],
                    "unit": "index_points",
                    "score": norm_wages[key],
                    "weight": self.weights["wage_attractiveness"],
                },
            }

            available_weight = 0.0
            weighted_sum = 0.0
            missing_signals: List[str] = []

            for c_name, c_data in components.items():
                if c_data["score"] is not None:
                    w = c_data["weight"]
                    available_weight += w
                    weighted_sum += w * c_data["score"]
                else:
                    missing_signals.append(c_name)

            data_coverage_pct = round(available_weight * 100.0, 1)

            if available_weight > 0.0:
                composite_score = round(weighted_sum / available_weight, 2)
                # Strict bound protection
                composite_score = max(0.0, min(100.0, composite_score))
            else:
                composite_score = 0.0

            # 7. Generate key explanatory factors (top contributing drivers)
            contributing = [
                (c_name, c_data["score"])
                for c_name, c_data in components.items()
                if c_data["score"] is not None
            ]
            # Sort drivers by normalized score descending
            contributing.sort(key=lambda x: x[1], reverse=True)

            key_drivers: List[str] = []
            for c_name, score_val in contributing[:3]:
                raw_v = components[c_name]["raw_value"]
                if c_name == "posting_volume" and raw_v is not None:
                    key_drivers.append(f"Posting volume ({int(raw_v):d} postings, score: {score_val:.1f})")
                elif c_name == "demand_growth" and raw_v is not None:
                    trend_dir = "+" if raw_v >= 0 else ""
                    key_drivers.append(f"3-Month growth momentum ({trend_dir}{raw_v:.2%}, score: {score_val:.1f})")
                elif c_name == "vacancy_persistence" and raw_v is not None:
                    key_drivers.append(f"Vacancy persistence ({raw_v:.1f} pts, score: {score_val:.1f})")
                elif c_name == "employer_diversity" and raw_v is not None:
                    key_drivers.append(f"Employer recruitment breadth ({int(raw_v):d} employers, score: {score_val:.1f})")
                elif c_name == "wage_attractiveness" and raw_v is not None:
                    key_drivers.append(f"Wage attractiveness index ({raw_v:.1f} pts, score: {score_val:.1f})")

            calculated_records.append({
                "period": target_period,
                "district_id": geo.district_id,
                "district_name": geo.district_name,
                "state_code": geo.state_code,
                "state_name": geo.state_name,
                "occupation_id": occ.occupation_id,
                "occupation_title": occ.occupation_title,
                "sector": occ.sector,
                "trade": occ.trade,
                "nco_code": occ.nco_code,
                "nco_title": occ.nco_title,
                "qp_code": occ.qp_code,
                "qp_title": occ.qp_title,
                "nsqf_level": occ.nsqf_level,
                "composite_score": composite_score,
                "data_coverage_pct": data_coverage_pct,
                "components": components,
                "key_drivers": key_drivers,
                "missing_signals": missing_signals,
                "is_synthetic": True,
            })

        # 8. Sort deterministically: composite_score desc, posting_volume desc, occupation_title asc, district_name asc
        calculated_records.sort(
            key=lambda r: (
                -r["composite_score"],
                -(r["components"]["posting_volume"]["raw_value"] or 0.0),
                r["occupation_title"],
                r["district_name"],
            )
        )

        # 9. Assign ranks across full cross-section before filtering
        for idx, rec in enumerate(calculated_records, start=1):
            rec["rank"] = idx

        # 10. Apply optional user filters
        filtered_records = calculated_records
        if state_code:
            st = state_code.strip().upper()
            filtered_records = [r for r in filtered_records if r["state_code"].upper() == st]
        if district_id:
            dt = district_id.strip().upper()
            filtered_records = [r for r in filtered_records if r["district_id"].upper() == dt]
        if sector:
            sc = sector.strip().lower()
            filtered_records = [r for r in filtered_records if r["sector"].lower() == sc]

        total_evaluated = len(calculated_records)
        total_filtered = len(filtered_records)

        # 11. Pagination / limit
        if limit is not None and limit > 0:
            output_records = filtered_records[:limit]
        else:
            output_records = filtered_records

        return {
            "period": target_period,
            "reference_date": "2026-10-09",
            "is_synthetic": True,
            "methodology": {
                "name": "SkillPulse Explainable Composite Demand Index",
                "normalization": "Cross-Sectional Percentile Rank (0 to 100)",
                "growth_metric": "Fractional growth rate: (recent_3m_avg - prior_3m_avg) / prior_3m_avg (e.g., 0.0752 denotes +7.52% growth, NOT a ratio of 1.0752)",
                "growth_lookback": "Trailing 3-Month Average vs Preceding 3-Month Average",
                "tie_breaking": "Deterministic Fractional Mid-Point Ranking",
                "component_weights": self.weights,
                "weight_assumptions_note": "Weights are configurable prototype design assumptions, not empirically calibrated econometric weights.",
            },
            "limitations": DEMAND_INDEX_LIMITATIONS,
            "summary": {
                "total_cross_section_items": total_evaluated,
                "returned_items": len(output_records),
                "filter_matches": total_filtered,
                "filters_applied": {
                    "state_code": state_code,
                    "district_id": district_id,
                    "sector": sector,
                    "limit": limit,
                },
            },
            "results": output_records,
        }
