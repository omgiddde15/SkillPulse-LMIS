"""Early-Warning Alerts Engine for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

This service implements Module 5 (Part C) of the LMIS architecture:
- Generates explainable, decision-support alerts for:
  1. Persistently high positive projected mismatch (relative demand pressure).
  2. Persistently high negative projected mismatch (relative supply pressure).
  3. Strongly accelerating or declining demand supported by the historical series.
  4. Insufficient history, missing forecast inputs, or poor backtesting performance.
- Assigns stable, deterministic alert IDs to prevent duplicate notifications.
- Strictly guards against using immature placement rates whose 90-day follow-up is pending.
- Formulates plain-language diagnostic rationales and suggested planning actions.
- Treats alerts as decision-support signals requiring human expert validation.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from app.schemas.data_models import (
    AlertResponse,
    EarlyWarningAlert,
    Geography,
    Occupation,
)
from app.services.demand_index import find_data_dir
from app.services.forecasting import (
    DEFAULT_DEMAND_PRESSURE_THRESHOLD,
    DEFAULT_SUPPLY_PRESSURE_THRESHOLD,
    SUPPORTED_HORIZONS,
    ForecastingService,
    add_months_to_period,
)
from app.services.supply_estimation import SupplyEstimationService

DEFAULT_ACCELERATION_THRESHOLD: float = 0.20  # +20% growth rate denotes strong acceleration
DEFAULT_DECLINE_THRESHOLD: float = -0.20      # -20% growth rate denotes strong decline
DEFAULT_POOR_WAPE_THRESHOLD: float = 0.50     # WAPE > 50% denotes low forecast quality

ALERT_LIMITATIONS: str = (
    "SkillPulse early-warning alerts are decision-support heuristics designed to assist state skill missions "
    "and district planners. They operate on prototype heuristic thresholds (±15), not empirically calibrated policy rules. "
    "They do NOT represent automated policy decisions or budget mandates. All classifications require "
    "qualitative human review, ground-truth district surveys, and employer consultations."
)


class EarlyWarningService:
    """Service for detecting and formatting explainable labour market early-warning alerts."""

    def __init__(
        self,
        data_dir: Optional[Path] = None,
        demand_pressure_threshold: float = DEFAULT_DEMAND_PRESSURE_THRESHOLD,
        supply_pressure_threshold: float = DEFAULT_SUPPLY_PRESSURE_THRESHOLD,
        acceleration_threshold: float = DEFAULT_ACCELERATION_THRESHOLD,
        decline_threshold: float = DEFAULT_DECLINE_THRESHOLD,
        poor_wape_threshold: float = DEFAULT_POOR_WAPE_THRESHOLD,
    ):
        self.data_dir = data_dir or find_data_dir()
        self.demand_pressure_threshold = demand_pressure_threshold
        self.supply_pressure_threshold = supply_pressure_threshold
        self.acceleration_threshold = acceleration_threshold
        self.decline_threshold = decline_threshold
        self.poor_wape_threshold = poor_wape_threshold

        self.forecasting_service = ForecastingService(
            data_dir=self.data_dir,
            demand_pressure_threshold=self.demand_pressure_threshold,
            supply_pressure_threshold=self.supply_pressure_threshold,
        )
        self.supply_service = SupplyEstimationService(data_dir=self.data_dir)
        self._occupations: Dict[str, Occupation] = {}
        self._geographies: Dict[str, Geography] = {}
        self._loaded: bool = False

    def load_data(self) -> None:
        """Ensure all underlying master data and services are initialized."""
        if self._loaded:
            return

        self.forecasting_service.load_data()
        self.supply_service.load_data()

        occ_path = self.data_dir / "occupations.csv"
        geo_path = self.data_dir / "geographies.csv"

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

        self._loaded = True

    def calculate_alerts(
        self,
        period: Optional[str] = None,
        horizon: Optional[int] = None,
        state_code: Optional[str] = None,
        district_id: Optional[str] = None,
        sector: Optional[str] = None,
        severity: Optional[str] = None,
        alert_type: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Detect and compile early-warning alerts for a given reporting period and filters.
        
        Evaluates:
        1. Projected demand pressure (relative deficit of certified throughput vs demand).
        2. Projected supply pressure (relative surplus of certified throughput vs demand).
        3. Accelerating demand (steep positive trajectory in job postings).
        4. Declining demand (steep negative trajectory in job postings).
        5. Data quality warnings (insufficient series length, missing inputs, or poor backtest WAPE).
        """
        self.load_data()

        available_periods = self.forecasting_service.get_available_periods()
        base_period = period or available_periods[-1]
        if base_period not in available_periods:
            raise ValueError(
                f"Period '{base_period}' not found. Available range: "
                f"{available_periods[0]} to {available_periods[-1]}"
            )

        base_idx = available_periods.index(base_period)
        periods_up_to_base = available_periods[: base_idx + 1]

        # Generate forecasts across relevant horizons (e.g., 3, 6, 12)
        # Generate forecasts across all supported horizons so persistence can be evaluated across 3, 6, 12
        forecast_response = self.forecasting_service.calculate_forecasts(
            base_period=base_period,
            horizon=None,
            state_code=state_code,
            district_id=district_id,
            sector=sector,
        )
        forecast_items = forecast_response["results"]

        # Group forecast items by (district_id, occupation_id)
        grouped_by_pair: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
        for item in forecast_items:
            key = (item["district_id"], item["occupation_id"])
            grouped_by_pair.setdefault(key, []).append(item)

        alerts: List[EarlyWarningAlert] = []

        # Evaluate each district-occupation pair
        for (d_id, o_id), items in grouped_by_pair.items():
            geo = self._geographies.get(d_id)
            occ = self._occupations.get(o_id)
            if not geo or not occ:
                continue

            # Historical postings series
            postings_dict = self.forecasting_service._postings_history.get((d_id, o_id), {})
            postings_series = [
                postings_dict[p] for p in periods_up_to_base if p in postings_dict
            ]

            # -------------------------------------------------------------
            # Rule 1 & 2: Single-Horizon vs Persistent Mismatch Alerts
            # Persistence rule: Requires the same direction to cross threshold
            # at two or more of the 3-, 6-, and 12-month horizons.
            # -------------------------------------------------------------
            crossed_demand_horizons = [
                item["horizon_months"]
                for item in items
                if item["projected_mismatch"]["status"] == "valid"
                and item["projected_mismatch"]["projected_mismatch_score"] is not None
                and item["projected_mismatch"]["projected_mismatch_score"] >= self.demand_pressure_threshold
            ]
            crossed_supply_horizons = [
                item["horizon_months"]
                for item in items
                if item["projected_mismatch"]["status"] == "valid"
                and item["projected_mismatch"]["projected_mismatch_score"] is not None
                and item["projected_mismatch"]["projected_mismatch_score"] <= self.supply_pressure_threshold
            ]

            # 1a. Single-Horizon Demand and Supply Pressure Alerts
            for item in items:
                h = item["horizon_months"]
                target_p = item["target_period"]
                pm = item["projected_mismatch"]
                m_score = pm.get("projected_mismatch_score")
                m_status = pm.get("status")

                if m_status == "valid" and m_score is not None:
                    # Positive projected mismatch (Demand Pressure at horizon h)
                    if m_score >= self.demand_pressure_threshold:
                        is_critical = m_score >= 30.0
                        sev = "critical" if is_critical else "high"
                        aid = f"ALERT-DEM_PRESSURE-{d_id}-{o_id}-H{h}-{base_period}"
                        alerts.append(
                            EarlyWarningAlert(
                                alert_id=aid,
                                alert_type="demand_pressure",
                                severity=sev,
                                period=base_period,
                                horizon_months=h,
                                target_period=target_p,
                                district_id=d_id,
                                district_name=geo.district_name,
                                state_code=geo.state_code,
                                occupation_id=o_id,
                                occupation_title=occ.occupation_title,
                                sector=occ.sector,
                                key_values={
                                    "is_persistent": False,
                                    "projected_mismatch_score": m_score,
                                    "forecast_demand_rank": pm.get("forecast_demand_rank"),
                                    "forecast_supply_rank": pm.get("forecast_supply_rank"),
                                    "forecast_postings_count": item["demand_forecast"]["point_forecast_integer"],
                                    "forecast_throughput": item["supply_forecast"]["point_forecast"],
                                    "threshold_applied": self.demand_pressure_threshold,
                                    "supporting_horizon_count": len(crossed_demand_horizons),
                                },
                                explanation=(
                                    f"Single-horizon relative demand pressure in {geo.district_name}: projected employer recruitment demand rank for "
                                    f"{occ.occupation_title} ({pm.get('forecast_demand_rank'):.1f} percentile) "
                                    f"substantially outpaces projected certified-candidate throughput rank "
                                    f"({pm.get('forecast_supply_rank'):.1f} percentile) by {m_score:+.1f} points "
                                    f"at the {h}-month horizon ({target_p}). (Persistence requires >=2 valid horizons)."
                                ),
                                suggested_action=(
                                    f"Engage local vocational training providers and ITIs in {geo.district_name} "
                                    f"to expand batch intakes for {occ.trade}; consider incentivising apprenticeship "
                                    f"tie-ups with hiring employers."
                                ),
                                limitations=ALERT_LIMITATIONS,
                            )
                        )

                    # Negative projected mismatch (Supply Pressure at horizon h)
                    elif m_score <= self.supply_pressure_threshold:
                        is_critical = m_score <= -30.0
                        sev = "critical" if is_critical else "high"
                        aid = f"ALERT-SUP_PRESSURE-{d_id}-{o_id}-H{h}-{base_period}"
                        alerts.append(
                            EarlyWarningAlert(
                                alert_id=aid,
                                alert_type="supply_pressure",
                                severity=sev,
                                period=base_period,
                                horizon_months=h,
                                target_period=target_p,
                                district_id=d_id,
                                district_name=geo.district_name,
                                state_code=geo.state_code,
                                occupation_id=o_id,
                                occupation_title=occ.occupation_title,
                                sector=occ.sector,
                                key_values={
                                    "is_persistent": False,
                                    "projected_mismatch_score": m_score,
                                    "forecast_demand_rank": pm.get("forecast_demand_rank"),
                                    "forecast_supply_rank": pm.get("forecast_supply_rank"),
                                    "forecast_postings_count": item["demand_forecast"]["point_forecast_integer"],
                                    "forecast_throughput": item["supply_forecast"]["point_forecast"],
                                    "threshold_applied": self.supply_pressure_threshold,
                                    "supporting_horizon_count": len(crossed_supply_horizons),
                                },
                                explanation=(
                                    f"Single-horizon relative supply pressure in {geo.district_name}: projected certified-candidate output rank for "
                                    f"{occ.occupation_title} ({pm.get('forecast_supply_rank'):.1f} percentile) "
                                    f"substantially outpaces projected online job posting demand rank "
                                    f"({pm.get('forecast_demand_rank'):.1f} percentile) by {abs(m_score):.1f} points "
                                    f"at the {h}-month horizon ({target_p}). (Persistence requires >=2 valid horizons)."
                                ),
                                suggested_action=(
                                    f"Assess graduate placement absorption in {geo.district_name}; evaluate whether "
                                    f"graduates in {occ.trade} require inter-district placement mobility assistance "
                                    f"or curricula re-alignment with active regional clusters."
                                ),
                                limitations=ALERT_LIMITATIONS,
                            )
                        )

            # 1b. Persistent Demand Pressure Alert (requires >= 2 valid horizons)
            if len(crossed_demand_horizons) >= 2:
                supporting_scores = {
                    item["horizon_months"]: item["projected_mismatch"]["projected_mismatch_score"]
                    for item in items
                    if item["horizon_months"] in crossed_demand_horizons
                }
                is_critical = (
                    any(s >= 30.0 for s in supporting_scores.values())
                    or len(crossed_demand_horizons) == len(SUPPORTED_HORIZONS)
                )
                sev = "critical" if is_critical else "high"
                aid = f"ALERT-PERSISTENT_DEM_PRESSURE-{d_id}-{o_id}-{base_period}"
                alerts.append(
                    EarlyWarningAlert(
                        alert_id=aid,
                        alert_type="persistent_demand_pressure",
                        severity=sev,
                        period=base_period,
                        horizon_months=None,
                        target_period=None,
                        district_id=d_id,
                        district_name=geo.district_name,
                        state_code=geo.state_code,
                        occupation_id=o_id,
                        occupation_title=occ.occupation_title,
                        sector=occ.sector,
                        key_values={
                            "is_persistent": True,
                            "persistence_rule": "Projected mismatch >= +15.0 across >=2 supported horizons (3m, 6m, 12m)",
                            "supporting_horizons": sorted(crossed_demand_horizons),
                            "scores_by_horizon": supporting_scores,
                            "threshold_applied": self.demand_pressure_threshold,
                        },
                        explanation=(
                            f"Persistent relative demand pressure confirmed across {len(crossed_demand_horizons)} "
                            f"supported horizons ({', '.join(str(x) + 'm' for x in sorted(crossed_demand_horizons))}) "
                            f"in {geo.district_name} for {occ.occupation_title}. Projected employer hiring demand "
                            f"persistently exceeds training throughput over the medium-to-long term."
                        ),
                        suggested_action=(
                            f"Prioritize strategic capacity expansion and industry apprenticeship alliances for "
                            f"{occ.trade} in {geo.district_name}; persistence indicates structural demand."
                        ),
                        limitations=ALERT_LIMITATIONS,
                    )
                )

            # 1c. Persistent Supply Pressure Alert (requires >= 2 valid horizons)
            if len(crossed_supply_horizons) >= 2:
                supporting_scores = {
                    item["horizon_months"]: item["projected_mismatch"]["projected_mismatch_score"]
                    for item in items
                    if item["horizon_months"] in crossed_supply_horizons
                }
                is_critical = (
                    any(s <= -30.0 for s in supporting_scores.values())
                    or len(crossed_supply_horizons) == len(SUPPORTED_HORIZONS)
                )
                sev = "critical" if is_critical else "high"
                aid = f"ALERT-PERSISTENT_SUP_PRESSURE-{d_id}-{o_id}-{base_period}"
                alerts.append(
                    EarlyWarningAlert(
                        alert_id=aid,
                        alert_type="persistent_supply_pressure",
                        severity=sev,
                        period=base_period,
                        horizon_months=None,
                        target_period=None,
                        district_id=d_id,
                        district_name=geo.district_name,
                        state_code=geo.state_code,
                        occupation_id=o_id,
                        occupation_title=occ.occupation_title,
                        sector=occ.sector,
                        key_values={
                            "is_persistent": True,
                            "persistence_rule": "Projected mismatch <= -15.0 across >=2 supported horizons (3m, 6m, 12m)",
                            "supporting_horizons": sorted(crossed_supply_horizons),
                            "scores_by_horizon": supporting_scores,
                            "threshold_applied": self.supply_pressure_threshold,
                        },
                        explanation=(
                            f"Persistent relative supply pressure confirmed across {len(crossed_supply_horizons)} "
                            f"supported horizons ({', '.join(str(x) + 'm' for x in sorted(crossed_supply_horizons))}) "
                            f"in {geo.district_name} for {occ.occupation_title}. Projected candidate certification "
                            f"throughput persistently exceeds hiring demand over the medium-to-long term."
                        ),
                        suggested_action=(
                            f"Audit long-term absorption, coordinate with regional employers for placement outreach, "
                            f"and moderate batch seat intakes for {occ.trade} in {geo.district_name}."
                        ),
                        limitations=ALERT_LIMITATIONS,
                    )
                )

            # -------------------------------------------------------------
            # Rule 3: Strongly Accelerating or Declining Demand Trajectory
            # -------------------------------------------------------------
            if len(postings_series) >= 6:
                # Compare recent 3 months vs prior 3 months
                recent_3 = postings_series[-3:]
                prior_3 = postings_series[-6:-3]
                mean_prior = sum(prior_3) / 3.0
                mean_recent = sum(recent_3) / 3.0

                if mean_prior > 0.0:
                    growth_rate = (mean_recent - mean_prior) / mean_prior

                    if growth_rate >= self.acceleration_threshold:
                        aid = f"ALERT-ACC_DEMAND-{d_id}-{o_id}-{base_period}"
                        sev = "high" if growth_rate >= 0.35 else "medium"
                        alerts.append(
                            EarlyWarningAlert(
                                alert_id=aid,
                                alert_type="accelerating_demand",
                                severity=sev,
                                period=base_period,
                                horizon_months=None,
                                target_period=None,
                                district_id=d_id,
                                district_name=geo.district_name,
                                state_code=geo.state_code,
                                occupation_id=o_id,
                                occupation_title=occ.occupation_title,
                                sector=occ.sector,
                                key_values={
                                    "growth_rate_pct": round(growth_rate * 100.0, 1),
                                    "recent_3m_avg_postings": round(mean_recent, 1),
                                    "prior_3m_avg_postings": round(mean_prior, 1),
                                    "threshold_pct": round(self.acceleration_threshold * 100.0, 1),
                                },
                                explanation=(
                                    f"Hiring demand for {occ.occupation_title} in {geo.district_name} is accelerating "
                                    f"strongly: trailing 3-month average postings grew by {growth_rate:+.1%} "
                                    f"(from {mean_prior:.1f} to {mean_recent:.1f} postings/mo)."
                                ),
                                suggested_action=(
                                    f"Consult regional employers in {occ.sector} to verify emerging skills needs; "
                                    f"prepare fast-track modular training batches."
                                ),
                                limitations=ALERT_LIMITATIONS,
                            )
                        )
                    elif growth_rate <= self.decline_threshold:
                        aid = f"ALERT-DEC_DEMAND-{d_id}-{o_id}-{base_period}"
                        sev = "high" if growth_rate <= -0.35 else "medium"
                        alerts.append(
                            EarlyWarningAlert(
                                alert_id=aid,
                                alert_type="declining_demand",
                                severity=sev,
                                period=base_period,
                                horizon_months=None,
                                target_period=None,
                                district_id=d_id,
                                district_name=geo.district_name,
                                state_code=geo.state_code,
                                occupation_id=o_id,
                                occupation_title=occ.occupation_title,
                                sector=occ.sector,
                                key_values={
                                    "growth_rate_pct": round(growth_rate * 100.0, 1),
                                    "recent_3m_avg_postings": round(mean_recent, 1),
                                    "prior_3m_avg_postings": round(mean_prior, 1),
                                    "threshold_pct": round(self.decline_threshold * 100.0, 1),
                                },
                                explanation=(
                                    f"Hiring demand for {occ.occupation_title} in {geo.district_name} has contracted "
                                    f"sharply: trailing 3-month average postings decreased by {abs(growth_rate):.1%} "
                                    f"(from {mean_prior:.1f} to {mean_recent:.1f} postings/mo)."
                                ),
                                suggested_action=(
                                    f"Review sector health in {geo.district_name} to ascertain if contraction is "
                                    f"seasonal or structural; avoid expanding dedicated training infrastructure."
                                ),
                                limitations=ALERT_LIMITATIONS,
                            )
                        )

            # -------------------------------------------------------------
            # Rule 4: Data Quality & Low-Confidence Warnings
            # -------------------------------------------------------------
            for item in items:
                h = item["horizon_months"]
                d_forecast = item["demand_forecast"]
                s_forecast = item["supply_forecast"]

                # Insufficient history or missing data
                if d_forecast["status"] != "valid" or s_forecast["status"] != "valid":
                    aid = f"ALERT-DATA_QUALITY-{d_id}-{o_id}-H{h}-{base_period}"
                    alerts.append(
                        EarlyWarningAlert(
                            alert_id=aid,
                            alert_type="data_quality_warning",
                            severity="low",
                            period=base_period,
                            horizon_months=h,
                            target_period=item["target_period"],
                            district_id=d_id,
                            district_name=geo.district_name,
                            state_code=geo.state_code,
                            occupation_id=o_id,
                            occupation_title=occ.occupation_title,
                            sector=occ.sector,
                            key_values={
                                "demand_status": d_forecast["status"],
                                "supply_status": s_forecast["status"],
                                "data_coverage_pct": item["data_coverage_pct"],
                            },
                            explanation=(
                                f"Insufficient historical series length or missing inputs for {occ.occupation_title} "
                                f"in {geo.district_name} at horizon {h}m. Projections should not be relied upon."
                            ),
                            suggested_action=(
                                "Ensure consecutive monthly observation collection continues; rely on qualitative "
                                "district skills council feedback until sufficient series length is attained."
                            ),
                            limitations=ALERT_LIMITATIONS,
                        )
                    )
                else:
                    # High backtesting error warning (poor WAPE)
                    d_wape = d_forecast.get("backtest_wape")
                    s_wape = s_forecast.get("backtest_wape")
                    max_wape = max(w for w in [d_wape, s_wape] if w is not None) if (d_wape or s_wape) else None

                    if max_wape is not None and max_wape >= self.poor_wape_threshold:
                        aid = f"ALERT-POOR_BACKTEST-{d_id}-{o_id}-H{h}-{base_period}"
                        alerts.append(
                            EarlyWarningAlert(
                                alert_id=aid,
                                alert_type="data_quality_warning",
                                severity="medium",
                                period=base_period,
                                horizon_months=h,
                                target_period=item["target_period"],
                                district_id=d_id,
                                district_name=geo.district_name,
                                state_code=geo.state_code,
                                occupation_id=o_id,
                                occupation_title=occ.occupation_title,
                                sector=occ.sector,
                                key_values={
                                    "demand_wape": d_wape,
                                    "supply_wape": s_wape,
                                    "threshold_wape": self.poor_wape_threshold,
                                },
                                explanation=(
                                    f"Forecast for {occ.occupation_title} in {geo.district_name} exhibited elevated "
                                    f"out-of-sample backtesting error (WAPE: {max_wape:.1%}). Uncertainty is high."
                                ),
                                suggested_action=(
                                    "Review wider interval bounds and exercise caution before using point forecasts "
                                    "for institutional budget allocation."
                                ),
                                limitations=ALERT_LIMITATIONS,
                            )
                        )

        # Apply filtering
        filtered_alerts = alerts
        if severity:
            sev_clean = severity.strip().lower()
            filtered_alerts = [a for a in filtered_alerts if a.severity.lower() == sev_clean]
        if alert_type:
            at_clean = alert_type.strip().lower()
            filtered_alerts = [a for a in filtered_alerts if a.alert_type.lower() == at_clean]
        if horizon is not None:
            filtered_alerts = [
                a for a in filtered_alerts
                if a.horizon_months == horizon
                or (
                    a.horizon_months is None
                    and (
                        "supporting_horizons" not in a.key_values
                        or horizon in a.key_values.get("supporting_horizons", [])
                    )
                )
            ]

        # Deterministic sorting: severity (critical > high > medium > low), then district, occupation, alert_id
        sev_priority = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        filtered_alerts.sort(
            key=lambda a: (
                sev_priority.get(a.severity, 99),
                a.district_id,
                a.occupation_id,
                a.alert_id,
            )
        )

        if limit is not None and limit > 0:
            filtered_alerts = filtered_alerts[:limit]

        # Summary aggregates
        counts_by_severity: Dict[str, int] = {}
        counts_by_type: Dict[str, int] = {}
        for a in filtered_alerts:
            counts_by_severity[a.severity] = counts_by_severity.get(a.severity, 0) + 1
            counts_by_type[a.alert_type] = counts_by_type.get(a.alert_type, 0) + 1

        return {
            "metadata": {
                "base_period": base_period,
                "is_synthetic": True,
                "thresholds": {
                    "demand_pressure": self.demand_pressure_threshold,
                    "supply_pressure": self.supply_pressure_threshold,
                    "acceleration_rate": self.acceleration_threshold,
                    "decline_rate": self.decline_threshold,
                    "poor_wape": self.poor_wape_threshold,
                },
                "data_provenance": "Synthetic pilot baseline for SIH26246 benchmark; not real government or market statistics",
                "decision_support_notice": (
                    "Alert classifications are automated decision-support indicators requiring human review, "
                    "not prescriptive administrative mandates."
                ),
                "limitations": ALERT_LIMITATIONS,
            },
            "summary": {
                "total_alerts": len(filtered_alerts),
                "by_severity": counts_by_severity,
                "by_type": counts_by_type,
            },
            "results": [a.model_dump() for a in filtered_alerts],
        }
