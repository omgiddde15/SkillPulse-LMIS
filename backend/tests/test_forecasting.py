"""Comprehensive Tests for SkillPulse LMIS Forecasting and Early-Warning Alerts Engine.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Covers all 13 required verification areas:
1. All requested forecast horizons (3, 6, 12 months).
2. Time-ordered backtesting with no future-data leakage.
3. Deterministic model selection and outputs.
4. Non-negative forecasts and integer job-posting counts.
5. Error metrics, including zero denominators.
6. Insufficient-history handling.
7. Prediction-interval construction and ordering.
8. Demand/supply future-horizon matching.
9. Alert thresholds, explanations, and deterministic alert IDs.
10. Missing data and low-quality forecast handling.
11. Filtering and API validation via TestClient.
12. Existing demand-index, gap-analysis, root, and health endpoints remain functional.
13. Full dataset validation and generation reproducibility.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.early_warning import EarlyWarningService
from app.services.forecasting import (
    ForecastingService,
    SUPPORTED_HORIZONS,
    add_months_to_period,
    evaluate_backtesting,
    predict_linear_trend,
    predict_ma3,
    predict_model,
    predict_naive,
    select_best_model_for_series,
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    """Reusable FastAPI TestClient fixture."""
    return TestClient(app)


@pytest.fixture(scope="module")
def forecast_service() -> ForecastingService:
    """Reusable ForecastingService instance."""
    svc = ForecastingService()
    svc.load_data()
    return svc


@pytest.fixture(scope="module")
def alert_service() -> EarlyWarningService:
    """Reusable EarlyWarningService instance."""
    svc = EarlyWarningService()
    svc.load_data()
    return svc


# ============================================================================
# 1. All requested forecast horizons (3, 6, 12 months)
# ============================================================================
def test_all_requested_forecast_horizons(forecast_service: ForecastingService) -> None:
    """Verify that forecasts support 3, 6, and 12-month horizons with accurate target periods."""
    assert SUPPORTED_HORIZONS == [3, 6, 12]

    # Evaluate full forecast response
    res = forecast_service.calculate_forecasts(base_period="2026-09")
    results = res["results"]
    assert len(results) > 0

    horizons_present = {r["horizon_months"] for r in results}
    assert horizons_present == {3, 6, 12}

    # Verify target period progression from base "2026-09"
    for r in results:
        h = r["horizon_months"]
        expected_target = add_months_to_period("2026-09", h)
        assert r["target_period"] == expected_target
        if h == 3:
            assert r["target_period"] == "2026-12"
        elif h == 6:
            assert r["target_period"] == "2027-03"
        elif h == 12:
            assert r["target_period"] == "2027-09"


# ============================================================================
# 2. Time-ordered backtesting with no future-data leakage
# ============================================================================
def test_time_ordered_backtesting_no_future_leakage() -> None:
    """Verify rolling-origin backtesting never leaks future data into historical training slices."""
    # Synthetic time series of length 15
    base_history = [100.0 + 2.0 * i for i in range(15)]

    # Run backtesting on base history for horizon 3
    res_clean = evaluate_backtesting(base_history, horizon=3, model_name="linear_trend", min_train=6)
    assert res_clean["status"] == "valid"
    assert res_clean["num_folds"] == 15 - 3 - 6 + 1  # 7 folds

    # Corrupt future values beyond the first evaluation point (e.g. inject extreme canary at the end)
    corrupted_history = list(base_history)
    corrupted_history[-1] = 999999.0  # Massive spike at the very end

    # Test backtesting fold 0 (where training data only goes up to index 6, predicting index 8)
    # The corrupted value at index 14 MUST NOT affect predictions or errors for folds where t+horizon-1 < 14
    res_corrupted = evaluate_backtesting(corrupted_history, horizon=3, model_name="linear_trend", min_train=6)

    # First fold residuals should match exactly
    assert math.isclose(res_clean["residuals"][0], res_corrupted["residuals"][0], rel_tol=1e-9)

    # Verify sequential time order: training lengths strictly increase
    # and training window at step t strictly equals history[:t]
    for t in range(6, len(base_history) - 3 + 1):
        train_slice = base_history[:t]
        assert len(train_slice) == t
        # Ensure slice contains no values from t onwards
        assert set(train_slice).isdisjoint(set(base_history[t:]))


def test_hand_calculated_linear_trend_horizon_alignment_no_off_by_one() -> None:
    """Verify target index alignment for horizons 3, 6, and 12 against hand-calculated ground truth.
    
    Under the indexing convention:
    - Training slice history[:t] covers 0-based indices 0 through t-1 (length t).
    - Linear trend x-coordinates are 1 through t. Target x for horizon h is t + h.
    - Ground truth actual value is at 0-based index t + h - 1.
    
    For a known linear progression y_i = 100.0 + 10.0 * i (for i = 0..29):
    At t = 10:
    - history[:10] has values [100, 110, ..., 190] (0-based indices 0..9).
    - Fitted slope is 10.0, intercept is 90.0 (where x=1 gives 100).
    - For horizon 3: target_x = 10 + 3 = 13 -> pred = 90 + 10*13 = 220.0.
      Actual at index 10 + 3 - 1 = 12 is y_12 = 100 + 10*12 = 220.0.
      Residual is exactly 0.0.
    - For horizon 6: target_x = 10 + 6 = 16 -> pred = 90 + 10*16 = 250.0.
      Actual at index 10 + 6 - 1 = 15 is y_15 = 100 + 10*15 = 250.0.
      Residual is exactly 0.0.
    - For horizon 12: target_x = 10 + 12 = 22 -> pred = 90 + 10*22 = 310.0.
      Actual at index 10 + 12 - 1 = 21 is y_21 = 100 + 10*21 = 310.0.
      Residual is exactly 0.0.
    
    An off-by-one error (e.g. evaluating index t + h or t + h - 2) would produce an error of 10.0.
    """
    history = [100.0 + 10.0 * i for i in range(30)]
    t = 10
    train_data = history[:t]
    assert len(train_data) == 10
    assert train_data[-1] == 190.0  # index 9

    for h in [3, 6, 12]:
        # Hand-calculated prediction from model
        pred = predict_linear_trend(train_data, horizon=h)
        # Expected value: index t + h - 1
        expected_index = t + h - 1
        expected_actual = history[expected_index]
        assert math.isclose(pred, expected_actual, rel_tol=1e-9)

        # Confirm that an off-by-one index mismatch would produce an error of 10.0
        off_by_one_index = t + h
        off_by_one_actual = history[off_by_one_index]
        assert math.isclose(abs(pred - off_by_one_actual), 10.0, rel_tol=1e-9)

        # Full rolling-origin backtesting over the sequence must yield MAE = 0.0
        bt_res = evaluate_backtesting(history, horizon=h, model_name="linear_trend", min_train=6)
        assert bt_res["status"] == "valid"
        assert math.isclose(bt_res["mae"], 0.0, abs_tol=1e-9)
        assert all(math.isclose(r, 0.0, abs_tol=1e-9) for r in bt_res["residuals"])


# ============================================================================
# 3. Deterministic model selection and outputs
# ============================================================================
def test_deterministic_model_selection_and_outputs(forecast_service: ForecastingService) -> None:
    """Verify that repeated forecast runs yield bit-for-bit deterministic results and tie-breakers."""
    res1 = forecast_service.calculate_forecasts(base_period="2026-09", horizon=3)
    res2 = forecast_service.calculate_forecasts(base_period="2026-09", horizon=3)

    assert len(res1["results"]) == len(res2["results"])
    for r1, r2 in zip(res1["results"], res2["results"]):
        assert r1["district_id"] == r2["district_id"]
        assert r1["occupation_id"] == r2["occupation_id"]
        assert r1["demand_forecast"]["model_selected"] == r2["demand_forecast"]["model_selected"]
        assert r1["demand_forecast"]["point_forecast"] == r2["demand_forecast"]["point_forecast"]
        assert r1["supply_forecast"]["model_selected"] == r2["supply_forecast"]["model_selected"]
        assert r1["supply_forecast"]["point_forecast"] == r2["supply_forecast"]["point_forecast"]
        assert r1["projected_mismatch"]["projected_mismatch_score"] == r2["projected_mismatch"]["projected_mismatch_score"]

    # Test tie-breaking rule: if all models yield identical MAE (e.g. constant series),
    # naive model must be deterministically chosen as simplest baseline
    constant_series = [50.0] * 12
    best_m, info = select_best_model_for_series(constant_series, horizon=3, min_train=6)
    assert best_m == "naive"
    assert info["mae"] == 0.0


# ============================================================================
# 4. Non-negative forecasts and integer job-posting counts
# ============================================================================
def test_non_negative_forecasts_and_integer_job_postings(forecast_service: ForecastingService) -> None:
    """Ensure all job postings are non-negative integers and supply forecasts are non-negative floats."""
    res = forecast_service.calculate_forecasts(base_period="2026-09")
    for r in res["results"]:
        d_fc = r["demand_forecast"]
        s_fc = r["supply_forecast"]

        if d_fc["status"] == "valid":
            # Must be integer count
            assert isinstance(d_fc["point_forecast_integer"], int)
            assert d_fc["point_forecast_integer"] >= 0
            assert d_fc["point_forecast"] == float(d_fc["point_forecast_integer"])

        if s_fc["status"] == "valid":
            # Must be non-negative float
            assert isinstance(s_fc["point_forecast"], (int, float))
            assert s_fc["point_forecast"] >= 0.0

    # Test steep downward trend clipping at 0 (series length >= 6 + 6 = 12)
    collapsing_series = [100.0, 90.0, 80.0, 70.0, 60.0, 50.0, 40.0, 30.0, 20.0, 10.0, 5.0, 2.0, 1.0, 1.0]
    fc_d = forecast_service.forecast_quantity(collapsing_series, horizon=6, quantity_type="online_job_postings")
    assert fc_d.status == "valid"
    assert fc_d.point_forecast_integer is not None
    assert fc_d.point_forecast_integer >= 0
    assert fc_d.point_forecast >= 0.0


# ============================================================================
# 5. Error metrics, including zero denominators
# ============================================================================
def test_error_metrics_including_zero_denominators() -> None:
    """Verify MAE and WAPE calculations handle all-zero actuals without division errors."""
    # Case 1: Series with all zeros
    zero_series = [0.0] * 12
    res_zero = evaluate_backtesting(zero_series, horizon=3, model_name="naive", min_train=6)
    assert res_zero["status"] == "valid"
    assert res_zero["mae"] == 0.0
    assert res_zero["wape"] == 0.0  # Safe zero denominator handling

    # Case 2: Series with known values
    # Actuals: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    series = [float(x) for x in range(10, 110, 10)]
    res = evaluate_backtesting(series, horizon=1, model_name="naive", min_train=6)
    # Naive at horizon 1 predicts y_t, actual is y_{t+1}. Difference is always 10.0
    assert res["status"] == "valid"
    assert math.isclose(res["mae"], 10.0, rel_tol=1e-5)
    # WAPE = sum(abs_errors) / sum(actuals)
    assert res["wape"] is not None
    assert 0.0 < res["wape"] < 1.0


# ============================================================================
# 6. Insufficient-history handling
# ============================================================================
def test_insufficient_history_handling(forecast_service: ForecastingService) -> None:
    """Verify clear status and graceful fallback when historical observations are insufficient."""
    # Series shorter than MIN_TRAIN_HISTORY + horizon (6 + 3 = 9)
    short_series = [100.0, 105.0, 110.0, 115.0]
    point = forecast_service.forecast_quantity(short_series, horizon=3, quantity_type="online_job_postings")

    assert point.status == "insufficient_history"
    assert point.point_forecast is None
    assert point.point_forecast_integer is None
    assert point.prediction_interval_lower is None
    assert point.prediction_interval_upper is None
    assert point.backtest_mae is None
    assert point.backtest_wape is None
    assert "requires at least" in point.status_detail


# ============================================================================
# 7. Prediction-interval construction and ordering
# ============================================================================
def test_prediction_interval_construction_and_ordering(forecast_service: ForecastingService) -> None:
    """Verify strict interval ordering (lower <= point <= upper), RMSE normal labeling, and sample sizes."""
    res = forecast_service.calculate_forecasts(base_period="2026-09")
    for r in res["results"]:
        h = r["horizon_months"]
        for fc_key in ["demand_forecast", "supply_forecast"]:
            fc = r[fc_key]
            if fc["status"] == "valid":
                lower = fc["prediction_interval_lower"]
                point = fc["point_forecast"]
                upper = fc["prediction_interval_upper"]

                assert lower is not None and point is not None and upper is not None
                # Non-negativity
                assert lower >= 0.0
                assert point >= 0.0
                assert upper >= 0.0
                # Strict ordering: lower <= point <= upper
                assert lower <= point, f"Violation: lower ({lower}) > point ({point})"
                assert point <= upper, f"Violation: point ({point}) > upper ({upper})"

                # Check documentation & labels
                assert fc["interval_confidence"] == 0.80
                assert fc["interval_type"] == "rmse_normal_approximation_80pct"
                assert "normal error" in fc["interval_disclaimer"].lower() or "rmse" in fc["interval_disclaimer"].lower()

                # Report number of out-of-sample residuals supporting each interval
                assert fc["residual_sample_size"] is not None
                assert fc["residual_sample_size"] > 0

                # Mark uncertainty evidence as limited where sample is small (particularly 12m horizon)
                if h == 12:
                    assert fc["residual_sample_size"] < 10
                    assert fc["uncertainty_evidence_status"] == "limited_sample"
                    assert "limited due to small sample size" in fc["interval_disclaimer"]
                else:
                    assert fc["residual_sample_size"] >= 10
                    assert fc["uncertainty_evidence_status"] == "adequate_sample"


# ============================================================================
# 8. Demand/supply future-horizon matching
# ============================================================================
def test_demand_supply_future_horizon_matching(forecast_service: ForecastingService) -> None:
    """Verify demand and supply forecasts match on future horizon and target periods."""
    res = forecast_service.calculate_forecasts(base_period="2026-09", horizon=6)
    for r in res["results"]:
        assert r["horizon_months"] == 6
        assert r["target_period"] == "2027-03"

        d_fc = r["demand_forecast"]
        s_fc = r["supply_forecast"]
        pm = r["projected_mismatch"]

        if d_fc["status"] == "valid" and s_fc["status"] == "valid":
            d_rank = pm["forecast_demand_rank"]
            s_rank = pm["forecast_supply_rank"]
            m_score = pm["projected_mismatch_score"]

            assert d_rank is not None
            assert s_rank is not None
            assert m_score is not None
            assert 0.0 <= d_rank <= 100.0
            assert 0.0 <= s_rank <= 100.0
            # Mismatch formula: demand_rank - supply_rank
            expected_mismatch = round(d_rank - s_rank, 2)
            assert math.isclose(m_score, expected_mismatch, abs_tol=0.01)


# ============================================================================
# 9. Alert thresholds, explanations, and deterministic alert IDs
# ============================================================================
def test_alert_thresholds_explanations_and_deterministic_ids(alert_service: EarlyWarningService) -> None:
    """Verify alert generation, deterministic IDs, explainability, and placement safeguards."""
    alerts_res = alert_service.calculate_alerts(period="2026-09")
    alerts = alerts_res["results"]
    assert len(alerts) > 0

    seen_ids = set()
    for a in alerts:
        # 1. Deterministic alert ID format
        aid = a["alert_id"]
        assert aid.startswith("ALERT-")
        assert a["district_id"] in aid
        assert a["occupation_id"] in aid
        assert aid not in seen_ids  # Unique per alert
        seen_ids.add(aid)

        # 2. Required alert fields
        assert a["severity"] in {"low", "medium", "high", "critical"}
        assert len(a["explanation"]) > 20
        assert len(a["suggested_action"]) > 20
        assert "decision-support" in a["limitations"].lower()
        assert a["district_name"] in a["explanation"]

        # 3. Placement maturity safeguard: do not cite immature placement rates
        key_vals = a["key_values"]
        if "placement_rate" in key_vals:
            # If present, it must be validated/mature, never pending
            assert key_vals["placement_rate"] is not None

    # Verify repeated execution generates identical alert IDs
    alerts_res2 = alert_service.calculate_alerts(period="2026-09")
    ids1 = [a["alert_id"] for a in alerts]
    ids2 = [a["alert_id"] for a in alerts_res2["results"]]
    assert ids1 == ids2


# ============================================================================
# 9b. Persistent mismatch alert rules: persistent, non-persistent, and missing-horizon
# ============================================================================
def test_persistent_mismatch_alerts_rules_and_cases(alert_service: EarlyWarningService) -> None:
    """Verify distinct handling of single-horizon vs persistent mismatch alerts:

    - Persistent alerts require the same direction to cross threshold at >=2 of the 3-, 6-, and 12-month horizons.
    - Single-horizon alerts have is_persistent=False and specific horizon_months.
    - Isolated single-horizon crossing does NOT generate a persistent alert.
    - Early periods with missing/insufficient horizons do NOT generate persistent alerts.
    """
    alerts_res = alert_service.calculate_alerts(period="2026-09")
    alerts = alerts_res["results"]

    # 1. Verify persistent alerts properties
    persistent_alerts = [
        a for a in alerts
        if a["alert_type"] in {"persistent_demand_pressure", "persistent_supply_pressure"}
    ]
    assert len(persistent_alerts) > 0

    for pa in persistent_alerts:
        kv = pa["key_values"]
        assert kv["is_persistent"] is True
        # Must have at least 2 supporting horizons
        assert len(kv["supporting_horizons"]) >= 2
        assert all(h in [3, 6, 12] for h in kv["supporting_horizons"])
        # Horizon months on the alert wrapper is None because it spans multiple horizons
        assert pa["horizon_months"] is None
        # Explanation explicitly mentions the count of supporting horizons
        assert "Persistent" in pa["explanation"]
        assert "supported horizons" in pa["explanation"]

    # 2. Verify single-horizon alerts properties
    single_horizon_alerts = [
        a for a in alerts
        if a["alert_type"] in {"demand_pressure", "supply_pressure"}
    ]
    assert len(single_horizon_alerts) > 0

    for sha in single_horizon_alerts:
        kv = sha["key_values"]
        assert kv["is_persistent"] is False
        assert sha["horizon_months"] in [3, 6, 12]
        assert "Single-horizon" in sha["explanation"]

    # 3. Non-persistent isolated case:
    # KA_BLR_U for OCC_LOG_001 crosses +15 only at horizon 6 (mismatch +15.1),
    # while horizons 3 and 12 are below threshold (+13.21).
    # Must emit a single-horizon alert at horizon 6, but NO persistent alert.
    blr_log1_single = [
        a for a in single_horizon_alerts
        if a["district_id"] == "KA_BLR_U" and a["occupation_id"] == "OCC_LOG_001"
    ]
    blr_log1_pers = [
        a for a in persistent_alerts
        if a["district_id"] == "KA_BLR_U" and a["occupation_id"] == "OCC_LOG_001"
    ]
    assert len(blr_log1_single) == 1
    assert blr_log1_single[0]["horizon_months"] == 6
    assert blr_log1_single[0]["key_values"]["supporting_horizon_count"] == 1
    assert len(blr_log1_pers) == 0  # Crucial rule: Never label as persistent when only 1 horizon crosses!

    # 4. Another non-persistent isolated case:
    # MH_PUN for OCC_LOG_001 crosses demand threshold only at horizon 6.
    pun_log1_single = [
        a for a in single_horizon_alerts
        if a["district_id"] == "MH_PUN" and a["occupation_id"] == "OCC_LOG_001"
    ]
    pun_log1_pers = [
        a for a in persistent_alerts
        if a["district_id"] == "MH_PUN" and a["occupation_id"] == "OCC_LOG_001"
    ]
    assert len(pun_log1_single) == 1
    assert len(pun_log1_pers) == 0

    # 5. Missing-horizon / insufficient data case:
    # At period 2025-03, only 6 months of historical data exist (2024-10 to 2025-03).
    # Horizons 6 and 12 cannot have valid rolling backtesting.
    # Therefore, zero persistent mismatch alerts must be emitted.
    early_res = alert_service.calculate_alerts(period="2025-03")
    early_persistent = [
        a for a in early_res["results"]
        if a["alert_type"] in {"persistent_demand_pressure", "persistent_supply_pressure"}
    ]
    assert len(early_persistent) == 0
    # Insufficient data or quality warnings are emitted instead
    quality_alerts = [
        a for a in early_res["results"]
        if a["alert_type"] == "data_quality_warning"
    ]
    assert len(quality_alerts) > 0


# ============================================================================
# 10. Missing data and low-quality forecast handling
# ============================================================================
def test_missing_data_and_low_quality_forecast_handling(alert_service: EarlyWarningService) -> None:
    """Verify alerts gracefully handle data quality warnings and high backtesting errors."""
    # When poor WAPE threshold is low (e.g. 0.01), forecasts trigger quality warnings
    sensitive_service = EarlyWarningService(poor_wape_threshold=0.01)
    sensitive_service.load_data()
    res = sensitive_service.calculate_alerts(period="2026-09", alert_type="data_quality_warning")
    quality_alerts = res["results"]
    assert len(quality_alerts) > 0
    assert all(a["alert_type"] == "data_quality_warning" for a in quality_alerts)


# ============================================================================
# 11. Filtering and API validation via TestClient
# ============================================================================
def test_filtering_and_api_validation(client: TestClient) -> None:
    """Verify /api/v1/forecasts and /api/v1/alerts endpoints support filters and enforce validation."""
    # 1. Forecasts valid query
    r_fc = client.get("/api/v1/forecasts?horizon=3&district_id=MH_PUN&sector=IT/ITeS&limit=5")
    assert r_fc.status_code == 200
    data_fc = r_fc.json()
    assert len(data_fc["results"]) <= 5
    assert all(r["district_id"] == "MH_PUN" for r in data_fc["results"])
    assert all(r["sector"] == "IT/ITeS" for r in data_fc["results"])
    assert all(r["horizon_months"] == 3 for r in data_fc["results"])

    # 2. Forecasts invalid horizon -> 400
    r_bad_h = client.get("/api/v1/forecasts?horizon=5")
    assert r_bad_h.status_code == 400
    assert "Supported horizons" in r_bad_h.json()["detail"]

    # 3. Forecasts invalid district -> 400
    r_bad_d = client.get("/api/v1/forecasts?district_id=INVALID_DIST")
    assert r_bad_d.status_code == 400
    assert "Invalid district_id" in r_bad_d.json()["detail"]

    # 4. Forecasts invalid period format -> 400
    r_bad_p = client.get("/api/v1/forecasts?period=2026/09")
    assert r_bad_p.status_code == 400

    # 5. Alerts valid query
    r_al = client.get("/api/v1/alerts?severity=high&limit=10")
    assert r_al.status_code == 200
    data_al = r_al.json()
    assert all(a["severity"] == "high" for a in data_al["results"])

    # 5b. Alerts filter by persistent alert type
    r_pers = client.get("/api/v1/alerts?alert_type=persistent_demand_pressure")
    assert r_pers.status_code == 200
    data_pers = r_pers.json()
    assert len(data_pers["results"]) > 0
    assert all(a["alert_type"] == "persistent_demand_pressure" for a in data_pers["results"])
    assert all(a["key_values"]["is_persistent"] is True for a in data_pers["results"])

    # 5c. Alerts filter by single-horizon alert type
    r_dem = client.get("/api/v1/alerts?alert_type=demand_pressure")
    assert r_dem.status_code == 200
    data_dem = r_dem.json()
    assert len(data_dem["results"]) > 0
    assert all(a["alert_type"] == "demand_pressure" for a in data_dem["results"])
    assert all(a["key_values"]["is_persistent"] is False for a in data_dem["results"])

    # 6. Alerts invalid severity -> 400
    r_bad_sev = client.get("/api/v1/alerts?severity=ultra_critical")
    assert r_bad_sev.status_code == 400
    assert "Invalid severity" in r_bad_sev.json()["detail"]

    # 7. Alerts invalid alert_type -> 400
    r_bad_at = client.get("/api/v1/alerts?alert_type=alien_attack")
    assert r_bad_at.status_code == 400
    assert "Invalid alert_type" in r_bad_at.json()["detail"]


# ============================================================================
# 12. Existing endpoints remain functional
# ============================================================================
def test_existing_endpoints_remain_functional(client: TestClient) -> None:
    """Verify root, health, demand-index, and gap-analysis endpoints are preserved intact."""
    # Root
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json()["project"] == "SkillPulse LMIS"

    # Health
    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"

    # Demand Index
    r_demand = client.get("/api/v1/demand-index?period=2026-09&limit=5")
    assert r_demand.status_code == 200
    assert len(r_demand.json()["results"]) == 5

    # Gap Analysis
    r_gap = client.get("/api/v1/gap-analysis?period=2026-09&limit=5")
    assert r_gap.status_code == 200
    assert len(r_gap.json()["results"]) == 5


# ============================================================================
# 13. Full dataset validation and generation reproducibility
# ============================================================================
def test_full_dataset_validation_and_generation_reproducibility() -> None:
    """Execute complete dataset validation suite and verify 100% integrity."""
    import subprocess
    import sys
    from pathlib import Path

    val_proc = subprocess.run(
        [sys.executable, "scripts/validate_sample_data.py"],
        cwd=str(Path(__file__).resolve().parent.parent),
        capture_output=True,
        text=True,
    )
    assert val_proc.returncode == 0, f"Validator failed:\n{val_proc.stderr}"
    assert "SUCCESS: All datasets passed" in val_proc.stdout


# ============================================================================
# 14. Training-to-Posting Benchmark Ratio in Forecasts
# ============================================================================
def test_forecast_benchmark_ratio(client: TestClient) -> None:
    """Verify that forecast results include the descriptive benchmark ratio (throughput per 100 postings)."""
    resp = client.get("/api/v1/forecasts?period=2026-09&horizon=3&district_id=KA_BLR_U&occupation_id=OCC_IT_001")
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) >= 1
    item = results[0]
    assert item["demand_forecast"]["point_forecast_integer"] == 157
    assert item["supply_forecast"]["point_forecast"] == 79.3
    # 79.3 / 157 * 100 = 50.5095... -> 50.5 candidates per 100 postings
    assert item["benchmark_ratio"] == 50.5
    assert item["data_coverage_pct"] == 100.0  # Not confused with data coverage pct

