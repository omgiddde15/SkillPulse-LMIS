"""Forecasting Service for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

This service implements Module 5 (Part A & B) of the LMIS architecture:
- Time-ordered, rolling-origin backtesting comparing Naive, 3-Month Moving Average (MA3),
  and Linear Trend models.
- Generates separate forecasts for:
  1. Monthly online job-posting counts (non-negative integers).
  2. Monthly certified-candidate throughput (non-negative expected counts).
- Supports forecast horizons of 3, 6, and 12 months.
- Employs deterministic model selection based on rolling-origin out-of-sample MAE
  with tie-breaking by model simplicity.
- Derives approximate empirical prediction intervals (80% nominal coverage) from
  out-of-sample backtesting residuals.
- Calculates projected relative mismatch scores via cross-sectional percentile ranking.
- Strictly guards against future data leakage: temporal ordering is preserved throughout.
- Clearly flags synthetic data provenance and methodological limitations.
"""

from __future__ import annotations

import csv
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from app.schemas.data_models import (
    ForecastPoint,
    ForecastResponse,
    ForecastResultItem,
    Geography,
    Occupation,
    ProjectedMismatch,
)
from app.services.demand_index import compute_percentile_ranks, find_data_dir

SUPPORTED_HORIZONS: List[int] = [3, 6, 12]
MIN_TRAIN_HISTORY: int = 6  # Minimum consecutive historical periods required to train a baseline model
CANDIDATE_MODELS: List[str] = ["naive", "ma3", "linear_trend"]

DEFAULT_DEMAND_PRESSURE_THRESHOLD: float = 15.0
DEFAULT_SUPPLY_PRESSURE_THRESHOLD: float = -15.0

FORECAST_LIMITATIONS: str = (
    "SkillPulse forecasts and prediction intervals are decision-support projections "
    "derived from synthetic monthly pilot series. They are NOT guaranteed real-world outcomes "
    "or definitive econometric forecasts. The baseline models (Naive, MA3, Linear Trend) represent "
    "transparent benchmarks. Prediction intervals use an out-of-sample RMSE normal error approximation "
    "(not a direct empirical quantile interval); uncertainty evidence is explicitly flagged as limited "
    "where out-of-sample residual samples are small (such as the 12-month horizon with 7 backtest folds). "
    "Backtesting metrics (MAE, WAPE) evaluate performance strictly on the synthetic training horizon. "
    "Projected relative mismatch thresholds are prototype heuristic thresholds (±15), not empirically calibrated policy rules."
)

FORECAST_METHODOLOGY: str = (
    "Rolling-origin time-ordered backtesting across historical cutoffs without data shuffling "
    "or future leakage. Training slice uses history through index t-1 (history[:t]); horizon h evaluates "
    "the ground truth at index t + h - 1. Best model selected deterministically by minimum out-of-sample "
    "MAE (tie-breaker: Naive > MA3 > Linear Trend). Prediction intervals are computed using a normal "
    "error distribution approximation (±1.282 × out-of-sample RMSE) with out-of-sample residual sample size "
    "reported and marked as limited where the backtest sample is small (e.g. 12-month horizon)."
)


def add_months_to_period(period_str: str, months: int) -> str:
    """Add integer number of months to a YYYY-MM period string."""
    parts = period_str.split("-")
    year = int(parts[0])
    month = int(parts[1])
    total = year * 12 + (month - 1) + months
    new_year = total // 12
    new_month = (total % 12) + 1
    return f"{new_year:04d}-{new_month:02d}"


def get_period_difference(p1: str, p2: str) -> int:
    """Calculate the number of months between p1 and p2 (p2 - p1)."""
    y1, m1 = map(int, p1.split("-"))
    y2, m2 = map(int, p2.split("-"))
    return (y2 * 12 + (m2 - 1)) - (y1 * 12 + (m1 - 1))


def predict_naive(history: List[float], horizon: int) -> float:
    """Last-observation / naive forecast: repeats the most recent observed value."""
    if not history:
        return 0.0
    return float(history[-1])


def predict_ma3(history: List[float], horizon: int) -> float:
    """3-month moving average forecast: average of the 3 most recent values."""
    if not history:
        return 0.0
    if len(history) >= 3:
        return float(sum(history[-3:]) / 3.0)
    return float(sum(history) / len(history))


def predict_linear_trend(history: List[float], horizon: int) -> float:
    """Ordinary least squares linear trend forecast: extrapolates fitted linear slope."""
    if not history:
        return 0.0
    n = len(history)
    if n == 1:
        return float(history[0])

    x = list(range(1, n + 1))
    x_mean = sum(x) / n
    y_mean = sum(history) / n
    denom = sum((xi - x_mean) ** 2 for xi in x)
    if denom == 0.0:
        slope = 0.0
        intercept = y_mean
    else:
        numer = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, history))
        slope = numer / denom
        intercept = y_mean - slope * x_mean

    target_x = n + horizon
    raw_val = intercept + slope * target_x
    return max(0.0, float(raw_val))


def predict_model(model_name: str, history: List[float], horizon: int) -> float:
    """Dispatch prediction by model name and clamp to non-negative."""
    if model_name == "naive":
        val = predict_naive(history, horizon)
    elif model_name == "ma3":
        val = predict_ma3(history, horizon)
    elif model_name == "linear_trend":
        val = predict_linear_trend(history, horizon)
    else:
        raise ValueError(f"Unknown model name '{model_name}'.")
    return max(0.0, float(val))


def evaluate_backtesting(
    history: List[float],
    horizon: int,
    model_name: str,
    min_train: int = MIN_TRAIN_HISTORY,
) -> Dict[str, Any]:
    """Perform rolling-origin, time-ordered backtesting for a model at a specific horizon.
    
    Guarantees:
    - Origins step forward chronologically from min_train to len(history) - horizon.
    - Training slice strictly contains history before the origin (no future data leakage).
    - Errors are out-of-sample evaluated against actual values at origin + horizon.
    - WAPE metric safely handles zero denominators without crashing.
    """
    n = len(history)
    if n < min_train + horizon:
        return {
            "status": "insufficient_history",
            "num_folds": 0,
            "mae": None,
            "wape": None,
            "rmse": None,
            "residuals": [],
        }

    actuals: List[float] = []
    predictions: List[float] = []
    residuals: List[float] = []

    # Rolling origin: t denotes training length (from min_train up to n - horizon)
    for t in range(min_train, n - horizon + 1):
        train_data = history[:t]
        actual_val = history[t + horizon - 1]
        pred_val = predict_model(model_name, train_data, horizon)

        residuals.append(actual_val - pred_val)
        actuals.append(actual_val)
        predictions.append(pred_val)

    num_folds = len(residuals)
    if num_folds == 0:
        return {
            "status": "insufficient_history",
            "num_folds": 0,
            "mae": None,
            "wape": None,
            "rmse": None,
            "residuals": [],
        }

    abs_errors = [abs(r) for r in residuals]
    mae = sum(abs_errors) / num_folds
    rmse = math.sqrt(sum(r**2 for r in residuals) / num_folds)

    actuals_sum = sum(actuals)
    abs_errors_sum = sum(abs_errors)
    if actuals_sum > 0.0:
        wape = abs_errors_sum / actuals_sum
    else:
        wape = 0.0 if abs_errors_sum == 0.0 else None

    return {
        "status": "valid",
        "num_folds": num_folds,
        "mae": round(mae, 4),
        "wape": round(wape, 4) if wape is not None else None,
        "rmse": round(rmse, 4),
        "residuals": residuals,
    }


def select_best_model_for_series(
    history: List[float],
    horizon: int,
    min_train: int = MIN_TRAIN_HISTORY,
) -> Tuple[str, Dict[str, Any]]:
    """Deterministically choose the best model for a series and horizon based on backtest MAE.
    
    Tie-breaking policy:
    If MAEs are tied (within 1e-6), select simpler model in order:
    1. naive
    2. ma3
    3. linear_trend
    """
    n = len(history)
    if n < min_train + horizon:
        return "naive", {
            "status": "insufficient_history",
            "reason": (
                f"History has {n} periods; minimum required for {horizon}-month horizon is "
                f"{min_train + horizon} ({min_train} train + {horizon} horizon)."
            ),
            "mae": None,
            "wape": None,
            "rmse": None,
            "residuals": [],
        }

    results: Dict[str, Dict[str, Any]] = {}
    for m in CANDIDATE_MODELS:
        results[m] = evaluate_backtesting(history, horizon, m, min_train=min_train)

    # Sort deterministically: lowest MAE, tie-broken by CANDIDATE_MODELS index
    def sort_key(model_name: str) -> Tuple[float, int]:
        m_res = results[model_name]
        mae = m_res.get("mae")
        val = float("inf") if mae is None else mae
        return (val, CANDIDATE_MODELS.index(model_name))

    best_model = min(CANDIDATE_MODELS, key=sort_key)
    return best_model, results[best_model]


class ForecastingService:
    """Service for time-series forecasting, backtesting, and projected mismatch analysis."""

    def __init__(
        self,
        data_dir: Optional[Path] = None,
        demand_pressure_threshold: float = DEFAULT_DEMAND_PRESSURE_THRESHOLD,
        supply_pressure_threshold: float = DEFAULT_SUPPLY_PRESSURE_THRESHOLD,
    ):
        self.data_dir = data_dir or find_data_dir()
        self.demand_pressure_threshold = demand_pressure_threshold
        self.supply_pressure_threshold = supply_pressure_threshold
        self._occupations: Dict[str, Occupation] = {}
        self._geographies: Dict[str, Geography] = {}
        self._postings_history: Dict[Tuple[str, str], Dict[str, float]] = {}
        self._certifications_history: Dict[Tuple[str, str], Dict[str, float]] = {}
        self._available_periods: List[str] = []
        self._loaded: bool = False

    def load_data(self) -> None:
        """Load and index master entities and historical observations from CSV."""
        if self._loaded:
            return

        occ_path = self.data_dir / "occupations.csv"
        geo_path = self.data_dir / "geographies.csv"
        dem_path = self.data_dir / "demand_observations.csv"
        sup_path = self.data_dir / "training_supply.csv"

        if not (occ_path.is_file() and geo_path.is_file() and dem_path.is_file() and sup_path.is_file()):
            raise FileNotFoundError(
                f"Missing required CSV files in {self.data_dir}. "
                "Ensure occupations.csv, geographies.csv, demand_observations.csv, and training_supply.csv exist."
            )

        # 1. Occupations
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

        # 2. Geographies
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

        # 3. Demand Observations (online job postings)
        self._postings_history.clear()
        periods_set: Set[str] = set()

        with open(dem_path, mode="r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                if row.get("signal_type") == "online_job_postings":
                    p = row["period"].strip()
                    d_id = row["district_id"].strip()
                    o_id = row["occupation_id"].strip()
                    val = float(row["signal_value"])
                    self._postings_history.setdefault((d_id, o_id), {})[p] = val
                    periods_set.add(p)

        # 4. Supply Observations (certifications)
        self._certifications_history.clear()
        with open(sup_path, mode="r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                p = row["period"].strip()
                d_id = row["district_id"].strip()
                o_id = row["occupation_id"].strip()
                val = float(row["certifications"])
                self._certifications_history.setdefault((d_id, o_id), {})[p] = val
                periods_set.add(p)

        self._available_periods = sorted(periods_set)
        self._loaded = True

    def get_available_periods(self) -> List[str]:
        """Return chronologically sorted list of available reporting periods."""
        self.load_data()
        return list(self._available_periods)

    def forecast_quantity(
        self,
        series: List[float],
        horizon: int,
        quantity_type: str,
    ) -> ForecastPoint:
        """Run backtesting, deterministic model selection, and forecast generation for a series.
        
        Args:
            series: Consecutive time-ordered historical values.
            horizon: Forecast horizon (3, 6, 12).
            quantity_type: 'online_job_postings' or 'certified_candidate_throughput'.
            
        Returns:
            ForecastPoint model populated with point forecast, empirical intervals, and errors.
        """
        n = len(series)
        is_postings = quantity_type == "online_job_postings"

        if n < MIN_TRAIN_HISTORY + horizon:
            last_obs_insufficient = (
                float(int(round(series[-1]))) if is_postings else round(float(series[-1]), 1)
            ) if series else None
            return ForecastPoint(
                quantity=quantity_type,
                model_selected=None,
                point_forecast=None,
                point_forecast_integer=None,
                last_observed_value=last_obs_insufficient,
                prediction_interval_lower=None,
                prediction_interval_upper=None,
                interval_confidence=0.80,
                interval_type="rmse_normal_approximation_80pct",
                interval_disclaimer=(
                    "Prediction interval unavailable due to insufficient history to conduct out-of-sample backtesting."
                ),
                residual_sample_size=None,
                uncertainty_evidence_status="insufficient_history",
                backtest_mae=None,
                backtest_wape=None,
                status="insufficient_history",
                status_detail=(
                    f"Series contains {n} periods; requires at least {MIN_TRAIN_HISTORY + horizon} "
                    f"periods for {horizon}-month backtesting evaluation."
                ),
                rounding_explanation=(
                    "Job postings rounded to nearest integer; candidate throughput rounded to 1 decimal place."
                ),
            )

        # 1. Deterministic model selection via rolling-origin backtesting
        best_model, backtest_info = select_best_model_for_series(series, horizon)

        # 2. Final point forecast on full series
        raw_point = predict_model(best_model, series, horizon)

        # 3. Prediction intervals from out-of-sample backtesting residuals (RMSE normal approximation)
        residuals = backtest_info.get("residuals", [])
        num_residuals = len(residuals)
        if num_residuals > 0:
            rmse = math.sqrt(sum(r**2 for r in residuals) / num_residuals)
            margin = 1.282 * rmse  # ~80% coverage under normal distribution assumption
        else:
            rmse = 0.0
            margin = 0.0

        raw_lower = max(0.0, raw_point - margin)
        raw_upper = max(raw_point, raw_point + margin)

        # Evaluate uncertainty evidence adequacy based on sample size
        evidence_status = "limited_sample" if num_residuals < 10 else "adequate_sample"
        disclaimer_text = (
            f"Approximate 80% prediction interval calculated as point forecast ± 1.282 × out-of-sample RMSE ({rmse:.2f}) "
            f"assuming normal error dispersion (not a direct empirical quantile interval). Supported by {num_residuals} "
            f"out-of-sample backtesting residuals. Uncertainty evidence is "
            f"{'limited due to small sample size (especially for 12-month horizon)' if num_residuals < 10 else 'adequate'}. "
            f"Not a guaranteed coverage interval."
        )

        # 4. Non-negative rounding rules
        if is_postings:
            pt_int = max(0, int(round(raw_point)))
            low_int = max(0, int(round(raw_lower)))
            # Strictly guarantee low_int <= pt_int <= up_int
            low_int = min(low_int, pt_int)
            up_int = max(pt_int, int(round(raw_upper)))

            pt_val = float(pt_int)
            pt_int_val = pt_int
            low_val = float(low_int)
            up_val = float(up_int)
            rounding_text = (
                "Postings rounded to nearest non-negative integer using standard midpoint rounding. "
                "Intervals constrained to integer counts with lower <= point <= upper."
            )
        else:
            pt_val = round(max(0.0, raw_point), 1)
            low_val = round(max(0.0, raw_lower), 1)
            low_val = min(low_val, pt_val)
            up_val = round(max(pt_val, raw_upper), 1)
            pt_int_val = None
            rounding_text = (
                "Expected certification throughput rounded to 1 decimal place. "
                "Intervals constrained to non-negative floats with lower <= point <= upper."
            )

        last_obs = float(int(round(series[-1]))) if is_postings else round(float(series[-1]), 1)

        return ForecastPoint(
            quantity=quantity_type,
            model_selected=best_model,
            point_forecast=pt_val,
            point_forecast_integer=pt_int_val,
            last_observed_value=last_obs,
            prediction_interval_lower=low_val,
            prediction_interval_upper=up_val,
            interval_confidence=0.80,
            interval_type="rmse_normal_approximation_80pct",
            interval_disclaimer=disclaimer_text,
            residual_sample_size=num_residuals,
            uncertainty_evidence_status=evidence_status,
            backtest_mae=backtest_info.get("mae"),
            backtest_wape=backtest_info.get("wape"),
            rounding_explanation=rounding_text,
            status="valid",
            status_detail=None,
        )

    def calculate_forecasts(
        self,
        base_period: Optional[str] = None,
        horizon: Optional[int] = None,
        state_code: Optional[str] = None,
        district_id: Optional[str] = None,
        sector: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Calculate demand and supply forecasts and projected relative mismatch scores.
        
        Args:
            base_period: Base cutoff period (default: latest available in data).
            horizon: Optional horizon filter (3, 6, or 12).
            state_code: Optional state filter.
            district_id: Optional district filter.
            sector: Optional sector filter.
            limit: Maximum items to return.
            
        Returns:
            Dictionary matching ForecastResponse schema.
        """
        self.load_data()

        # 1. Base period resolution
        if base_period is None:
            base_period = self._available_periods[-1]
        elif base_period not in self._available_periods:
            raise ValueError(
                f"Base period '{base_period}' not found. Available range: "
                f"{self._available_periods[0]} to {self._available_periods[-1]}"
            )

        base_idx = self._available_periods.index(base_period)
        periods_up_to_base = self._available_periods[: base_idx + 1]

        # 2. Horizons to compute
        if horizon is not None:
            if horizon not in SUPPORTED_HORIZONS:
                raise ValueError(
                    f"Unsupported horizon '{horizon}'. Supported horizons: {SUPPORTED_HORIZONS} months."
                )
            target_horizons = [horizon]
        else:
            target_horizons = list(SUPPORTED_HORIZONS)

        # 3. Compute forecasts across all master entities to ensure
        # cross-sectional percentile ranks are calculated across the entire pilot sample
        all_geos = list(self._geographies.values())
        all_occs = list(self._occupations.values())

        # 4. Generate forecasts for all (geo, occ) pairs across horizons
        # Collect items by horizon so we can compute cross-sectional percentile ranks per horizon
        items_by_horizon: Dict[int, List[Dict[str, Any]]] = {h: [] for h in target_horizons}

        for h in target_horizons:
            target_period = add_months_to_period(base_period, h)

            demand_points: Dict[Tuple[str, str], Optional[float]] = {}
            supply_points: Dict[Tuple[str, str], Optional[float]] = {}

            # First pass: calculate demand and supply point forecasts
            stage_items: List[Dict[str, Any]] = []
            for geo in all_geos:
                for occ in all_occs:
                    key = (geo.district_id, occ.occupation_id)

                    # Extract postings series up to base_period
                    postings_dict = self._postings_history.get(key, {})
                    postings_series = [
                        postings_dict[p] for p in periods_up_to_base if p in postings_dict
                    ]

                    # Extract certifications series up to base_period
                    certs_dict = self._certifications_history.get(key, {})
                    certs_series = [
                        certs_dict[p] for p in periods_up_to_base if p in certs_dict
                    ]

                    # Compute individual forecasts
                    d_point = self.forecast_quantity(
                        postings_series, h, "online_job_postings"
                    )
                    s_point = self.forecast_quantity(
                        certs_series, h, "certified_candidate_throughput"
                    )

                    if d_point.status == "valid" and d_point.point_forecast is not None:
                        demand_points[key] = d_point.point_forecast
                    else:
                        demand_points[key] = None

                    if s_point.status == "valid" and s_point.point_forecast is not None:
                        supply_points[key] = s_point.point_forecast
                    else:
                        supply_points[key] = None

                    # Coverage calculation
                    expected_periods = len(periods_up_to_base)
                    actual_p = len(postings_series)
                    actual_s = len(certs_series)
                    coverage_pct = round(
                        ((actual_p + actual_s) / (2.0 * max(1, expected_periods))) * 100.0, 1
                    )

                    stage_items.append({
                        "geo": geo,
                        "occ": occ,
                        "key": key,
                        "demand_forecast": d_point,
                        "supply_forecast": s_point,
                        "coverage_pct": coverage_pct,
                    })

            # Second pass: cross-sectional percentile rankings for horizon h
            demand_ranks = compute_percentile_ranks(demand_points)
            supply_ranks = compute_percentile_ranks(supply_points)

            for it in stage_items:
                geo = it["geo"]
                occ = it["occ"]
                key = it["key"]
                d_point: ForecastPoint = it["demand_forecast"]
                s_point: ForecastPoint = it["supply_forecast"]

                d_rank = demand_ranks.get(key)
                s_rank = supply_ranks.get(key)

                if (
                    d_point.status == "valid"
                    and s_point.status == "valid"
                    and d_rank is not None
                    and s_rank is not None
                ):
                    mismatch_score = round(d_rank - s_rank, 2)
                    if mismatch_score >= self.demand_pressure_threshold:
                        classification = "Demand Pressure"
                    elif mismatch_score <= self.supply_pressure_threshold:
                        classification = "Supply Pressure"
                    else:
                        classification = "Balanced / Monitor"
                    mismatch_status = "valid"
                else:
                    mismatch_score = None
                    classification = "Insufficient Data"
                    mismatch_status = "insufficient_history"

                mismatch_obj = ProjectedMismatch(
                    forecast_demand_rank=d_rank,
                    forecast_supply_rank=s_rank,
                    projected_mismatch_score=mismatch_score,
                    classification=classification,
                    thresholds_applied={
                        "demand_pressure": self.demand_pressure_threshold,
                        "supply_pressure": self.supply_pressure_threshold,
                    },
                    status=mismatch_status,
                )

                # Descriptive benchmark ratio (candidates per 100 online postings)
                if (
                    d_point.status == "valid"
                    and d_point.point_forecast_integer is not None
                    and d_point.point_forecast_integer > 0
                    and s_point.status == "valid"
                    and s_point.point_forecast is not None
                ):
                    b_ratio = round((s_point.point_forecast / d_point.point_forecast_integer) * 100.0, 1)
                else:
                    b_ratio = None

                result_item = ForecastResultItem(
                    district_id=geo.district_id,
                    district_name=geo.district_name,
                    state_code=geo.state_code,
                    occupation_id=occ.occupation_id,
                    occupation_title=occ.occupation_title,
                    sector=occ.sector,
                    trade=occ.trade,
                    nco_code=occ.nco_code,
                    nco_title=occ.nco_title,
                    qp_code=occ.qp_code,
                    qp_title=occ.qp_title,
                    nsqf_level=occ.nsqf_level,
                    base_period=base_period,
                    horizon_months=h,
                    target_period=target_period,
                    demand_forecast=d_point,
                    supply_forecast=s_point,
                    projected_mismatch=mismatch_obj,
                    data_coverage_pct=it["coverage_pct"],
                    benchmark_ratio=b_ratio,
                )
                items_by_horizon[h].append(result_item.model_dump())

        # Flatten results in horizon order, applying optional filters post-percentile-ranking
        all_results: List[Dict[str, Any]] = []
        for h in target_horizons:
            horizon_items = items_by_horizon[h]
            if state_code:
                horizon_items = [r for r in horizon_items if r["state_code"].upper() == state_code.upper()]
            if district_id:
                horizon_items = [r for r in horizon_items if r["district_id"].upper() == district_id.upper()]
            if sector:
                horizon_items = [r for r in horizon_items if r["sector"].lower() == sector.lower()]
            all_results.extend(horizon_items)

        if limit is not None and limit > 0:
            all_results = all_results[:limit]

        valid_count = sum(
            1
            for r in all_results
            if r["demand_forecast"]["status"] == "valid" and r["supply_forecast"]["status"] == "valid"
        )

        return {
            "metadata": {
                "base_period": base_period,
                "supported_horizons_months": SUPPORTED_HORIZONS,
                "evaluated_horizons_months": target_horizons,
                "model_selection_metric": "Out-of-sample MAE via rolling-origin backtesting",
                "candidate_models": CANDIDATE_MODELS,
                "nominal_interval_confidence": 0.80,
                "interval_method": "Normal error distribution approximation on out-of-sample RMSE (±1.282 × RMSE)",
                "interval_sample_limitation": (
                    "Uncertainty evidence is marked as limited when residual sample size is small (<10 folds, "
                    "notably for the 12-month horizon with 7 folds). Not a direct empirical quantile interval."
                ),
                "is_synthetic": True,
                "data_provenance": "Synthetic pilot baseline for SIH26246 benchmark; not real government or market statistics",
                "methodology": FORECAST_METHODOLOGY,
                "limitations": FORECAST_LIMITATIONS,
            },
            "summary": {
                "base_period": base_period,
                "total_items": len(all_results),
                "valid_forecasts": valid_count,
                "insufficient_history_items": len(all_results) - valid_count,
                "demand_pressure_count": sum(
                    1 for r in all_results if r["projected_mismatch"]["classification"] == "Demand Pressure"
                ),
                "supply_pressure_count": sum(
                    1 for r in all_results if r["projected_mismatch"]["classification"] == "Supply Pressure"
                ),
                "balanced_count": sum(
                    1 for r in all_results if r["projected_mismatch"]["classification"] == "Balanced / Monitor"
                ),
            },
            "results": all_results,
        }
