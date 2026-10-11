"""Unit and Integration Tests for Training-Seat Allocation Simulator Service.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.seat_simulator import SeatSimulatorService


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="module")
def simulator_service() -> SeatSimulatorService:
    service = SeatSimulatorService()
    service.load_data()
    return service


def test_unchanged_seats_reproduces_baseline(simulator_service: SeatSimulatorService):
    """Test 1: A scenario using unchanged seats reproduces the baseline within rounding tolerance."""
    period = "2026-09"
    horizon = 3
    district_id = "MH_PUN"
    occ_id = "OCC_IT_001"

    # Fetch baseline supply metrics to find exact average seats
    sup_metrics = simulator_service.supply_service.calculate_supply_metrics(district_id, occ_id, period)
    recent_cohorts = [
        simulator_service.supply_service._supply_records.get((p, district_id, occ_id))
        for p in sup_metrics["throughput"]["window_periods_3m"]
    ]
    avg_seats = sum(c.sanctioned_seats for c in recent_cohorts if c) / len(recent_cohorts)
    proposed_seats = round(avg_seats)

    res = simulator_service.simulate_seat_allocation(
        period=period,
        horizon_months=horizon,
        district_id=district_id,
        occupation_id=occ_id,
        proposed_seats_per_cohort=proposed_seats,
    )

    assert res["status"] == "valid"
    base_supply = res["baseline_projection"]["forecast_supply_throughput"]
    scen_supply = res["scenario_projection"]["scenario_supply_throughput"]

    # Supply throughput should match baseline within rounding tolerance (<= 0.5 candidate)
    assert abs(scen_supply - base_supply) <= 0.5
    # Mismatch score should match baseline within rounding tolerance
    base_mm = res["baseline_projection"]["mismatch_score"]
    scen_mm = res["scenario_projection"]["scenario_mismatch_score"]
    assert abs(scen_mm - base_mm) <= 0.5
    assert res["baseline_projection"]["classification"] == res["scenario_projection"]["scenario_classification"]


def test_increasing_seats_does_not_reduce_supply(simulator_service: SeatSimulatorService):
    """Test 2: Increasing proposed seats does not reduce the scenario-adjusted supply forecast."""
    period = "2026-09"
    horizon = 6
    district_id = "MH_PUN"
    occ_id = "OCC_MFG_001"

    # Baseline simulation with 80 seats
    res_base = simulator_service.simulate_seat_allocation(
        period=period,
        horizon_months=horizon,
        district_id=district_id,
        occupation_id=occ_id,
        proposed_seats_per_cohort=80,
    )

    # Increased simulation with 160 seats
    res_up = simulator_service.simulate_seat_allocation(
        period=period,
        horizon_months=horizon,
        district_id=district_id,
        occupation_id=occ_id,
        proposed_seats_per_cohort=160,
    )

    assert res_base["status"] == "valid"
    assert res_up["status"] == "valid"

    # Monotonicity: increased seats strictly increases scenario supply throughput
    assert res_up["scenario_projection"]["scenario_supply_throughput"] > res_base["scenario_projection"]["scenario_supply_throughput"]
    # Supply percentile rank must be >= baseline supply rank
    assert res_up["scenario_projection"]["scenario_supply_rank"] >= res_base["scenario_projection"]["scenario_supply_rank"]
    # Relative mismatch score must not increase (moves towards supply pressure or reduces demand pressure)
    assert res_up["scenario_projection"]["scenario_mismatch_score"] <= res_base["scenario_projection"]["scenario_mismatch_score"]


def test_reducing_seats_changes_scenario_proportionally(simulator_service: SeatSimulatorService):
    """Test 3: Reducing seats changes the scenario proportionally and increases demand pressure."""
    period = "2026-09"
    horizon = 3
    district_id = "TS_HYD"
    occ_id = "OCC_IT_002"

    res_normal = simulator_service.simulate_seat_allocation(
        period=period,
        horizon_months=horizon,
        district_id=district_id,
        occupation_id=occ_id,
        proposed_seats_per_cohort=100,
    )

    res_reduced = simulator_service.simulate_seat_allocation(
        period=period,
        horizon_months=horizon,
        district_id=district_id,
        occupation_id=occ_id,
        proposed_seats_per_cohort=50,
    )

    supply_normal = res_normal["scenario_projection"]["scenario_supply_throughput"]
    supply_reduced = res_reduced["scenario_projection"]["scenario_supply_throughput"]

    # 50 seats should produce half the output of 100 seats within rounding precision
    expected_ratio = 50.0 / 100.0
    actual_ratio = supply_reduced / supply_normal
    assert abs(actual_ratio - expected_ratio) < 0.05

    # Reduced supply must produce lower supply rank and higher mismatch score
    assert res_reduced["scenario_projection"]["scenario_supply_rank"] <= res_normal["scenario_projection"]["scenario_supply_rank"]
    assert res_reduced["scenario_projection"]["scenario_mismatch_score"] >= res_normal["scenario_projection"]["scenario_mismatch_score"]


def test_supply_ranks_and_mismatch_classifications_recalculated(simulator_service: SeatSimulatorService):
    """Test 4: Cross-sectional supply ranks and mismatch classifications are recalculated accurately."""
    period = "2026-09"
    horizon = 3
    district_id = "MH_PUN"
    occ_id = "OCC_MFG_001"

    # Propose large seat increase (from ~83 to 250) to transform Demand Pressure into Supply Pressure
    res = simulator_service.simulate_seat_allocation(
        period=period,
        horizon_months=horizon,
        district_id=district_id,
        occupation_id=occ_id,
        proposed_seats_per_cohort=250,
    )

    assert res["status"] == "valid"
    assert res["baseline_projection"]["classification"] == "Demand Pressure"
    # With massive seat expansion, supply rank jumps and mismatch should transition
    assert res["scenario_projection"]["scenario_supply_rank"] > res["baseline_projection"]["forecast_supply_rank"]
    assert res["scenario_projection"]["scenario_classification"] in ["Balanced / Monitor", "Supply Pressure"]
    assert res["impact_summary"]["mismatch_score_delta"] < 0.0


def test_invalid_parameters_rejected(client: TestClient):
    """Test 5: Invalid horizons, non-positive seats, unknown districts and unknown occupations are rejected."""
    # Invalid horizon (5 months)
    r1 = client.post("/api/v1/simulations/seat-allocation", json={
        "period": "2026-09",
        "horizon_months": 5,
        "district_id": "MH_PUN",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 100,
    })
    assert r1.status_code == 422

    # Non-positive seats (0)
    r2 = client.post("/api/v1/simulations/seat-allocation", json={
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "MH_PUN",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 0,
    })
    assert r2.status_code == 422

    # Negative seats (-20)
    r3 = client.post("/api/v1/simulations/seat-allocation", json={
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "MH_PUN",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": -20,
    })
    assert r3.status_code == 422

    # Unknown district
    r4 = client.post("/api/v1/simulations/seat-allocation", json={
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "XX_UNKNOWN",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 100,
    })
    assert r4.status_code == 400
    assert "Invalid district_id" in r4.json()["detail"]

    # Unknown occupation
    r5 = client.post("/api/v1/simulations/seat-allocation", json={
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "MH_PUN",
        "occupation_id": "OCC_NONEXISTENT",
        "proposed_seats_per_cohort": 100,
    })
    assert r5.status_code == 400
    assert "Invalid occupation_id" in r5.json()["detail"]

    # Invalid period format
    r6 = client.post("/api/v1/simulations/seat-allocation", json={
        "period": "2026-13",
        "horizon_months": 3,
        "district_id": "MH_PUN",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 100,
    })
    assert r6.status_code == 422


def test_insufficient_history_handling(simulator_service: SeatSimulatorService):
    """Test 6: Insufficient history or early periods are handled safely without fabricating confident results."""
    # Earliest available period in synthetic dataset (2024-10) has T=1 (insufficient to establish 6m backtest or 3-month trailing cohorts)
    res = simulator_service.simulate_seat_allocation(
        period="2024-10",
        horizon_months=12,
        district_id="MH_PUN",
        occupation_id="OCC_IT_001",
        proposed_seats_per_cohort=100,
    )

    # Should report insufficient_history safely without throwing unhandled exceptions
    assert res["status"] in ["insufficient_history", "valid"]
    if res["status"] == "insufficient_history":
        assert res["status_detail"] is not None
        assert res["scenario_projection"]["scenario_classification"] == "Insufficient Data"


def test_repeated_requests_deterministic(client: TestClient):
    """Test 7: Repeated identical requests produce identical deterministic results."""
    payload = {
        "period": "2026-09",
        "horizon_months": 6,
        "district_id": "KA_BLR_U",
        "occupation_id": "OCC_LOG_001",
        "proposed_seats_per_cohort": 140,
    }

    r1 = client.post("/api/v1/simulations/seat-allocation", json=payload)
    r2 = client.post("/api/v1/simulations/seat-allocation", json=payload)

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json() == r2.json()


def test_provenance_and_limitations_present(client: TestClient):
    """Test 8: Synthetic-data provenance, limitations, and policy disclaimers are always present."""
    payload = {
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "TS_MED",
        "occupation_id": "OCC_MFG_002",
        "proposed_seats_per_cohort": 90,
    }

    resp = client.post("/api/v1/simulations/seat-allocation", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_synthetic"] is True
    assert "methodology" in data and len(data["methodology"]) > 20
    assert "assumptions" in data and "constant-yield" in data["assumptions"].lower()
    assert "limitations" in data and "decision-support" in data["limitations"].lower()
    assert "policy_disclaimer" in data and "NOT an absolute" in data["policy_disclaimer"]


def test_existing_endpoints_remain_functional(client: TestClient):
    """Test 9: Root, health, demand, gap, forecast, and alert endpoints remain functional."""
    # Root
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json()["project"] == "SkillPulse LMIS"

    # Health
    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"

    # Demand Index
    r_demand = client.get("/api/v1/demand-index?limit=2")
    assert r_demand.status_code == 200
    assert len(r_demand.json()["results"]) == 2

    # Gap Analysis
    r_gap = client.get("/api/v1/gap-analysis?limit=2")
    assert r_gap.status_code == 200
    assert len(r_gap.json()["results"]) == 2

    # Forecasts
    r_forecasts = client.get("/api/v1/forecasts?horizon=3&limit=2")
    assert r_forecasts.status_code == 200
    assert len(r_forecasts.json()["results"]) == 2

    # Alerts
    r_alerts = client.get("/api/v1/alerts?limit=2")
    assert r_alerts.status_code == 200
    assert len(r_alerts.json()["results"]) == 2


def test_seat_capacity_percentage_change_precision(client: TestClient):
    """Test 10: Percentage seat change is computed directly without premature delta rounding.

    For KA_BLR_U and OCC_IT_001 with baseline average 116.67 seats and 150 proposed seats:
    ((150 - 116.67) / 116.67) * 100 = 28.5677...% -> +28.6% (not 28.5%).
    """
    payload = {
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "KA_BLR_U",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 150,
    }
    resp = client.post("/api/v1/simulations/seat-allocation", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["baseline_seat_allocation"]["baseline_avg_seats_per_cohort"] == 116.67
    assert data["proposed_seat_allocation"]["proposed_seats_per_cohort"] == 150
    assert data["proposed_seat_allocation"]["percentage_seat_change"] == 28.6


def test_case_insensitive_occupation_and_district_normalization(client: TestClient):
    """Test 11: Case-insensitive occupation and district IDs are normalized to canonical codes."""
    payload = {
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "  ka_blr_u  ",
        "occupation_id": "  occ_it_001  ",
        "proposed_seats_per_cohort": 150,
    }
    resp = client.post("/api/v1/simulations/seat-allocation", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["parameters"]["district_id"] == "KA_BLR_U"
    assert data["parameters"]["occupation_id"] == "OCC_IT_001"
    assert data["parameters"]["district_name"] == "Bengaluru Urban"
    assert data["parameters"]["occupation_title"] == "Cloud Infrastructure Associate"


def test_simulator_internal_error_does_not_leak_raw_exception(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Test 12: Internal simulation exceptions return generic 500 without leaking error details."""
    import app.api.v1.seat_simulator as sim_api

    secret_leak = "FATAL_DISK_OR_DB_TRACE_SECRET_XYZ_12345"

    def mock_fail(*args, **kwargs):
        raise RuntimeError(secret_leak)

    service = sim_api.get_simulator_service()
    monkeypatch.setattr(service, "simulate_seat_allocation", mock_fail)

    payload = {
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "KA_BLR_U",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 150,
    }
    resp = client.post("/api/v1/simulations/seat-allocation", json=payload)
    assert resp.status_code == 500
    assert secret_leak not in resp.text
    detail = resp.json().get("detail", "")
    assert secret_leak not in detail
    assert "internal server error" in detail.lower()


def test_coverage_scenario_baseline_and_scenario_benchmark_examples(client: TestClient):
    """Test 13: Coverage scenario correctly computes baseline (50.5%) and 150-seat scenario (65.0%).

    For KA_BLR_U, OCC_IT_001, horizon 3:
    Baseline throughput = 79.3, postings = 157 -> 79.3 / 157 * 100 = 50.5% (ratio 50.5).
    150 proposed seats -> scenario throughput = 102.0 -> 102.0 / 157 * 100 = 65.0% (ratio 65.0).
    Delta = +14.5 percentage points.
    """
    payload = {
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "KA_BLR_U",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 150,
        "posting_to_opening_multiplier": 1.0,
        "local_availability_factor": 1.0,
    }
    resp = client.post("/api/v1/simulations/seat-allocation", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    cov = data.get("coverage_scenario")
    assert cov is not None

    # Verify input assumptions
    assert cov["posting_to_opening_multiplier"] == 1.0
    assert cov["local_availability_factor"] == 1.0

    # Demand postings & estimated openings
    assert cov["forecast_demand_postings"] == 157
    assert cov["estimated_openings"] == 157.0

    # Baseline: 79.3 / 157 * 100 = 50.5%
    assert cov["baseline_supply_throughput"] == 79.3
    assert cov["baseline_effective_output"] == 79.3
    assert cov["baseline_coverage_pct"] == 50.5
    assert cov["baseline_benchmark_ratio"] == 50.5

    # Scenario: 102.0 / 157 * 100 = 65.0%
    assert cov["scenario_supply_throughput"] == 102.0
    assert cov["scenario_effective_output"] == 102.0
    assert cov["scenario_coverage_pct"] == 65.0
    assert cov["scenario_benchmark_ratio"] == 65.0

    # Deltas: 65.0 - 50.5 = +14.5 percentage points
    assert cov["coverage_pct_delta"] == 14.5
    assert cov["benchmark_ratio_delta"] == 14.5

    # Existing mismatch score calculations must be preserved exactly
    assert data["baseline_projection"]["mismatch_score"] == -2.83
    assert data["scenario_projection"]["scenario_mismatch_score"] == -14.15
    assert data["baseline_projection"]["classification"] == "Balanced / Monitor"
    assert data["scenario_projection"]["scenario_classification"] == "Balanced / Monitor"


def test_coverage_scenario_parameter_boundaries_and_rejection(client: TestClient):
    """Test 14: Parameters k in [0.5, 1.5] and alpha in [0.4, 1.0] are strictly validated."""
    base_payload = {
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "KA_BLR_U",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 150,
    }

    # Valid lower boundaries: k = 0.5, alpha = 0.4
    r_lower = client.post("/api/v1/simulations/seat-allocation", json={
        **base_payload,
        "posting_to_opening_multiplier": 0.5,
        "local_availability_factor": 0.4,
    })
    assert r_lower.status_code == 200

    # Valid upper boundaries: k = 1.5, alpha = 1.0
    r_upper = client.post("/api/v1/simulations/seat-allocation", json={
        **base_payload,
        "posting_to_opening_multiplier": 1.5,
        "local_availability_factor": 1.0,
    })
    assert r_upper.status_code == 200

    # Out of bounds: k < 0.5 (0.49) -> 422
    r_bad_k_low = client.post("/api/v1/simulations/seat-allocation", json={
        **base_payload,
        "posting_to_opening_multiplier": 0.49,
    })
    assert r_bad_k_low.status_code == 422

    # Out of bounds: k > 1.5 (1.51) -> 422
    r_bad_k_high = client.post("/api/v1/simulations/seat-allocation", json={
        **base_payload,
        "posting_to_opening_multiplier": 1.51,
    })
    assert r_bad_k_high.status_code == 422

    # Out of bounds: alpha < 0.4 (0.39) -> 422
    r_bad_a_low = client.post("/api/v1/simulations/seat-allocation", json={
        **base_payload,
        "local_availability_factor": 0.39,
    })
    assert r_bad_a_low.status_code == 422

    # Out of bounds: alpha > 1.0 (1.05) -> 422
    r_bad_a_high = client.post("/api/v1/simulations/seat-allocation", json={
        **base_payload,
        "local_availability_factor": 1.05,
    })
    assert r_bad_a_high.status_code == 422


def test_coverage_scenario_sensitivity_with_custom_multipliers(client: TestClient):
    """Test 15: Pipeline coverage recalculates accurately with custom k=0.75 and alpha=0.8."""
    payload = {
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "KA_BLR_U",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 150,
        "posting_to_opening_multiplier": 0.75,
        "local_availability_factor": 0.8,
    }
    resp = client.post("/api/v1/simulations/seat-allocation", json=payload)
    assert resp.status_code == 200
    cov = resp.json()["coverage_scenario"]

    # 157 * 0.75 = 117.75 -> 117.8 estimated openings
    assert cov["estimated_openings"] == 117.8

    # Baseline: 79.3 * 0.8 = 63.44 -> 63.4 effective output
    assert cov["baseline_effective_output"] == 63.4
    # 63.4 / 117.8 * 100 = 53.82% -> 53.8%
    assert cov["baseline_coverage_pct"] == 53.8

    # Scenario: 102.0 * 0.8 = 81.6 effective output
    assert cov["scenario_effective_output"] == 81.6
    # 81.6 / 117.8 * 100 = 69.26% -> 69.3%
    assert cov["scenario_coverage_pct"] == 69.3

    # Delta: 69.3 - 53.8 = +15.5 percentage points
    assert cov["coverage_pct_delta"] == 15.5

    # Benchmark ratio is unadjusted: 79.3 / 157 * 100 = 50.5, 102.0 / 157 * 100 = 65.0
    assert cov["baseline_benchmark_ratio"] == 50.5
    assert cov["scenario_benchmark_ratio"] == 65.0


def test_coverage_scenario_zero_or_missing_postings_handled_safely(
    simulator_service: SeatSimulatorService, monkeypatch: pytest.MonkeyPatch
):
    """Test 16: Zero or missing postings do not cause ZeroDivisionError and safely return None."""
    # Temporarily monkeypatch forecast result to return 0 demand postings
    orig_calc = simulator_service.forecasting_service.calculate_forecasts

    def mock_calc(*args, **kwargs):
        res = orig_calc(*args, **kwargs)
        for item in res["results"]:
            if item["district_id"] == "KA_BLR_U" and item["occupation_id"] == "OCC_IT_001":
                item["demand_forecast"]["point_forecast_integer"] = 0
                item["demand_forecast"]["point_forecast"] = 0.0
        return res

    monkeypatch.setattr(simulator_service.forecasting_service, "calculate_forecasts", mock_calc)

    res = simulator_service.simulate_seat_allocation(
        period="2026-09",
        horizon_months=3,
        district_id="KA_BLR_U",
        occupation_id="OCC_IT_001",
        proposed_seats_per_cohort=150,
    )

    assert res["status"] == "valid"
    cov = res["coverage_scenario"]
    assert cov["forecast_demand_postings"] == 0
    assert cov["estimated_openings"] == 0.0
    assert cov["baseline_coverage_pct"] is None
    assert cov["scenario_coverage_pct"] is None
    assert cov["coverage_pct_delta"] is None
    assert cov["baseline_benchmark_ratio"] is None
    assert cov["scenario_benchmark_ratio"] is None


def test_coverage_scenario_assumption_metadata_and_labels(client: TestClient):
    """Test 17: Label, assumptions, and disclaimers communicate scenario constraints clearly."""
    payload = {
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "KA_BLR_U",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 150,
    }
    resp = client.post("/api/v1/simulations/seat-allocation", json=payload)
    assert resp.status_code == 200
    cov = resp.json()["coverage_scenario"]

    assert cov["metric_label"] == "Assumption-Adjusted Pipeline Scenario"
    assert "neutral illustrative scenario assumptions" in cov["assumptions_summary"]
    assert "NOT represent actual vacancy fulfilment" in cov["methodology_disclaimer"]
    assert "duplicated" in cov["methodology_disclaimer"]
    assert "migrate" in cov["methodology_disclaimer"]



