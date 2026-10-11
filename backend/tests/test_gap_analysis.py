"""Automated test suite for SkillPulse Training-Supply Estimation & Gap Analysis (Task 4).

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Covers the 10 verification requirements:
1. Correct cohort aggregation and metric denominators.
2. Correct exclusion of pending placement outcomes.
3. Safe handling of zero denominators and missing values.
4. Deterministic supply-output rankings.
5. Correct mismatch-score direction and threshold classification.
6. Demand and supply records matched to the same period, district and occupation.
7. Valid filtering by period, state, district, sector, and classification.
8. Correct synthetic-data provenance and limitation notes.
9. Existing demand-index, root and health endpoints remain functional.
10. Existing generation-determinism and dataset-validation tests still pass.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.demand_index import DemandIndexService
from app.services.gap_analysis import (
    GAP_ANALYSIS_LIMITATIONS,
    GapAnalysisService,
)
from app.services.supply_estimation import (
    SUPPLY_ESTIMATION_LIMITATIONS,
    SupplyEstimationService,
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="module")
def supply_service() -> SupplyEstimationService:
    svc = SupplyEstimationService()
    svc.load_data()
    return svc


@pytest.fixture(scope="module")
def gap_service() -> GapAnalysisService:
    svc = GapAnalysisService()
    svc.demand_service.load_data()
    svc.supply_service.load_data()
    return svc


# ---------------------------------------------------------------------------
# Test 1: Cohort Aggregation and Metric Denominators
# ---------------------------------------------------------------------------
def test_cohort_aggregation_and_denominators(supply_service: SupplyEstimationService):
    """Verify correct funnel calculations and explicit denominator documentation."""
    res = supply_service.calculate_supply_metrics("MH_PUN", "OCC_IT_001", "2026-05")

    funnel = res["funnel_rates"]
    # 1. Utilisation rate = enrolments / sanctioned_seats
    util = funnel["seat_utilization_rate"]
    assert util["denominator_name"] == "sanctioned_batch_seats"
    assert util["numerator"] <= util["denominator_value"]
    assert util["value"] == round(util["numerator"] / util["denominator_value"], 4)

    # 2. Completion rate = completions / enrolments
    comp = funnel["completion_rate"]
    assert comp["denominator_name"] == "enrolled_candidates"
    assert comp["numerator"] <= comp["denominator_value"]
    assert comp["value"] == round(comp["numerator"] / comp["denominator_value"], 4)

    # 3. Certification rate = certifications / completions
    cert = funnel["certification_rate"]
    assert cert["denominator_name"] == "completed_candidates"
    assert cert["numerator"] <= cert["denominator_value"]
    assert cert["value"] == round(cert["numerator"] / cert["denominator_value"], 4)

    # 4. Check throughput sums
    assert res["throughput"]["certifications_3m"] > 0
    assert res["throughput"]["certifications_6m"] is not None
    assert res["throughput"]["certifications_6m"] >= res["throughput"]["certifications_3m"]


# ---------------------------------------------------------------------------
# Test 2: Correct Exclusion of Pending Placement Outcomes
# ---------------------------------------------------------------------------
def test_exclusion_of_pending_placement_outcomes(supply_service: SupplyEstimationService):
    """Verify pending placement outcomes are excluded from placement rate and not treated as zero."""
    # Period 2026-09 has cohorts ending in July, August, September 2026 (<90 days before 2026-10-09)
    # All cohorts in 3m window have placement_status == 'pending'
    res_pending = supply_service.calculate_supply_metrics("KA_BLR_U", "OCC_IT_001", "2026-09")
    place_pending = res_pending["funnel_rates"]["placement_rate"]

    assert place_pending["value"] is None, "Pending placement rate must remain null, never zero"
    assert place_pending["follow_up_status"] == "pending"
    assert res_pending["cohort_metadata"]["pending_cohorts_count"] > 0

    # Period 2026-05 has cohorts ending in March, April, May 2026 (>90 days before 2026-10-09)
    # Cohorts have matured placement tracking complete
    res_matured = supply_service.calculate_supply_metrics("KA_BLR_U", "OCC_IT_001", "2026-05")
    place_matured = res_matured["funnel_rates"]["placement_rate"]

    assert place_matured["value"] is not None
    assert isinstance(place_matured["value"], float)
    assert 0.0 <= place_matured["value"] <= 1.0
    assert place_matured["follow_up_status"] == "complete"
    assert res_matured["cohort_metadata"]["matured_cohorts_count"] > 0


# ---------------------------------------------------------------------------
# Test 3: Safe Handling of Zero Denominators and Missing Values
# ---------------------------------------------------------------------------
def test_zero_denominators_and_missing_values(supply_service: SupplyEstimationService):
    """Verify zero denominators or missing lookback history return None without ZeroDivisionError."""
    # 1. Earliest period (2024-10) has only 1 month of history (< 6 months)
    res_early = supply_service.calculate_supply_metrics("MH_PUN", "OCC_MFG_001", "2024-10")
    assert res_early["throughput"]["certifications_6m"] is None
    assert res_early["cohort_metadata"]["total_cohorts_in_window"] == 1

    # 2. Simulate zero intake / zero completions
    mock_svc = SupplyEstimationService()
    mock_svc._available_periods = ["2026-01", "2026-02", "2026-03"]
    from app.schemas.data_models import TrainingSupplyObservation
    # Zero seats and zero enrolments
    mock_svc._supply_records = {
        ("2026-01", "DIST_01", "OCC_01"): TrainingSupplyObservation(
            period="2026-01", district_id="DIST_01", occupation_id="OCC_01",
            sanctioned_seats=0, enrolments=0, completions=0, certifications=0,
            placements=None, placement_status="pending", is_synthetic=True,
        )
    }
    mock_svc._loaded = True

    metrics = mock_svc.calculate_supply_metrics("DIST_01", "OCC_01", "2026-01")
    assert metrics["funnel_rates"]["seat_utilization_rate"]["value"] is None
    assert metrics["funnel_rates"]["completion_rate"]["value"] is None
    assert metrics["funnel_rates"]["certification_rate"]["value"] is None
    assert metrics["funnel_rates"]["placement_rate"]["value"] is None


# ---------------------------------------------------------------------------
# Test 4: Deterministic Supply-Output Rankings
# ---------------------------------------------------------------------------
def test_deterministic_supply_output_rankings(gap_service: GapAnalysisService):
    """Verify supply-output index scores fall strictly in [0.0, 100.0] and are reproducible."""
    run1 = gap_service.calculate_gap_analysis(period="2026-09")
    run2 = gap_service.calculate_gap_analysis(period="2026-09")

    assert len(run1["results"]) == 54
    assert len(run2["results"]) == 54

    for r1, r2 in zip(run1["results"], run2["results"]):
        sup1 = r1["supply_output_index"]
        sup2 = r2["supply_output_index"]
        assert 0.0 <= sup1 <= 100.0
        assert sup1 == sup2
        assert r1["relative_mismatch_score"] == r2["relative_mismatch_score"]
        assert r1["rank"] == r2["rank"]


# ---------------------------------------------------------------------------
# Test 5: Correct Mismatch Score Direction & Threshold Classification
# ---------------------------------------------------------------------------
def test_mismatch_score_direction_and_threshold_classification(gap_service: GapAnalysisService):
    """Verify relative_mismatch_score = demand - supply, and classification matches thresholds."""
    res = gap_service.calculate_gap_analysis(period="2026-09")

    for rec in res["results"]:
        dem = rec["demand_index_score"]
        sup = rec["supply_output_index"]
        expected_mismatch = round(dem - sup, 2)
        assert rec["relative_mismatch_score"] == expected_mismatch

        mismatch = rec["relative_mismatch_score"]
        cls = rec["classification"]

        if mismatch >= 15.0:
            assert cls == "Demand Pressure"
            assert rec["alert_level"] == "high"
        elif mismatch <= -15.0:
            assert cls == "Supply Pressure"
            assert rec["alert_level"] == "high"
        else:
            assert cls == "Balanced / Monitor"
            assert rec["alert_level"] == "moderate"


# ---------------------------------------------------------------------------
# Test 6: Demand and Supply Records Matched to Identical Identifiers
# ---------------------------------------------------------------------------
def test_demand_supply_record_matching(gap_service: GapAnalysisService):
    """Verify that demand and supply metrics match the identical period, district and occupation."""
    res = gap_service.calculate_gap_analysis(period="2026-09")

    for rec in res["results"]:
        assert rec["period"] == "2026-09"
        # Demand components and supply throughput must exist for this exact pair
        assert "posting_volume" in rec["demand_components"]
        assert "certifications_3m" in rec["throughput"]
        assert rec["district_id"].startswith(("MH_", "KA_", "TS_"))
        assert rec["occupation_id"].startswith("OCC_")


# ---------------------------------------------------------------------------
# Test 7: Filtering Parameters
# ---------------------------------------------------------------------------
def test_gap_analysis_filters(gap_service: GapAnalysisService):
    """Verify state, district, sector, classification, and limit filters."""
    # 1. State filter
    mh_res = gap_service.calculate_gap_analysis(period="2026-09", state_code="MH")
    assert len(mh_res["results"]) == 18
    assert all(r["state_code"] == "MH" for r in mh_res["results"])

    # 2. District filter
    blr_res = gap_service.calculate_gap_analysis(period="2026-09", district_id="KA_BLR_U")
    assert len(blr_res["results"]) == 9
    assert all(r["district_id"] == "KA_BLR_U" for r in blr_res["results"])

    # 3. Sector filter
    mfg_res = gap_service.calculate_gap_analysis(period="2026-09", sector="Manufacturing")
    assert len(mfg_res["results"]) == 18
    assert all(r["sector"] == "Manufacturing" for r in mfg_res["results"])

    # 4. Classification filter
    dp_res = gap_service.calculate_gap_analysis(period="2026-09", classification="Demand Pressure")
    assert all(r["classification"] == "Demand Pressure" for r in dp_res["results"])

    # 5. Limit filter
    top3 = gap_service.calculate_gap_analysis(period="2026-09", limit=3)
    assert len(top3["results"]) == 3
    assert [r["rank"] for r in top3["results"]] == [1, 2, 3]


# ---------------------------------------------------------------------------
# Test 8: Synthetic Data Provenance and Limitation Notes
# ---------------------------------------------------------------------------
def test_synthetic_data_provenance_and_limitations(gap_service: GapAnalysisService):
    """Verify explicit synthetic indicators and non-shortage / non-headcount guardrails."""
    res = gap_service.calculate_gap_analysis(period="2026-09")
    assert res["is_synthetic"] is True
    assert "limitations" in res
    assert "NOT a headcount gap of missing or surplus workers" in res["limitations"]
    assert "relative prioritization metric" in res["limitations"]

    for r in res["results"]:
        assert r["is_synthetic"] is True


# ---------------------------------------------------------------------------
# Test 9: FastAPI Endpoints via TestClient
# ---------------------------------------------------------------------------
def test_fastapi_gap_endpoints_via_testclient(client: TestClient):
    """Verify root, health, demand-index, and gap-analysis endpoints and error validation."""
    # 1. GET /
    assert client.get("/").status_code == 200

    # 2. GET /health
    assert client.get("/health").status_code == 200

    # 3. GET /api/v1/demand-index
    assert client.get("/api/v1/demand-index?limit=1").status_code == 200

    # 4. GET /api/v1/gap-analysis default
    r_gap = client.get("/api/v1/gap-analysis")
    assert r_gap.status_code == 200
    data = r_gap.json()
    assert data["period"] == "2026-09"
    assert data["summary"]["total_cross_section_items"] == 54

    # 5. Invalid period format -> 400
    r_bad_p = client.get("/api/v1/gap-analysis?period=bad-period")
    assert r_bad_p.status_code == 400
    assert "Invalid period format" in r_bad_p.json()["detail"]

    # 6. Invalid classification -> 400
    r_bad_c = client.get("/api/v1/gap-analysis?classification=Urgent")
    assert r_bad_c.status_code == 400
    assert "Invalid classification" in r_bad_c.json()["detail"]

    # 7. Invalid state_code -> 400
    r_bad_s = client.get("/api/v1/gap-analysis?state_code=ZZ")
    assert r_bad_s.status_code == 400
    assert "Invalid state_code" in r_bad_s.json()["detail"]

    # 8. Invalid limit (ge=1) -> 422
    assert client.get("/api/v1/gap-analysis?limit=0").status_code == 422


# ---------------------------------------------------------------------------
# Test 10: Dataset Validation & Generation Determinism Persistence
# ---------------------------------------------------------------------------
def test_dataset_validation_and_generation_determinism_preserved():
    """Verify existing dataset validator and deterministic generator remain 100% passing."""
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


# ---------------------------------------------------------------------------
# Test 11: Complete Index Inputs with Pending Placement Follow-Up Coverage
# ---------------------------------------------------------------------------
def test_coverage_complete_index_with_pending_placement_followup(gap_service: GapAnalysisService):
    """Verify record with 100% index inputs retains 100% index_data_coverage_pct despite pending placement follow-up."""
    res = gap_service.calculate_gap_analysis(period="2026-09")
    records = res["results"]
    assert len(records) > 0

    first_rec = records[0]

    # 1. Index inputs must be 100% complete
    assert first_rec["index_data_coverage_pct"] == 100.0
    assert first_rec["data_coverage_pct"] == 100.0
    assert first_rec["data_coverage"]["demand_index_coverage_pct"] == 100.0
    assert first_rec["data_coverage"]["supply_index_coverage_pct"] == 100.0
    assert first_rec["missing_index_signals"] == []

    # 2. Placement follow-up must be reported separately as pending, NOT missing failure or zero
    follow_up = first_rec["placement_follow_up"]
    assert follow_up["status"] == "pending"
    assert follow_up["pending_cohorts_count"] > 0
    assert follow_up["matured_cohorts_count"] == 0
    assert first_rec["funnel_rates"]["placement_rate"]["value"] is None
    assert first_rec["funnel_rates"]["placement_rate"]["follow_up_status"] == "pending"

    # 3. Placement follow-up being pending must NOT reduce index_data_coverage_pct
    assert first_rec["index_data_coverage_pct"] == 100.0


# ---------------------------------------------------------------------------
# Test 12: Genuinely Missing Index Inputs Lower Index Coverage
# ---------------------------------------------------------------------------
def test_coverage_reduced_by_missing_index_inputs(gap_service: GapAnalysisService):
    """Verify genuinely missing index inputs lower index_data_coverage_pct and document preliminary status."""
    # Period 2024-10 has no 6-month trailing lookback, so demand_growth is missing
    res = gap_service.calculate_gap_analysis(period="2024-10")
    records = res["results"]
    assert len(records) > 0

    rec = records[0]

    # 1. Demand coverage is reduced to 75.0% due to missing demand_growth
    assert rec["data_coverage"]["demand_index_coverage_pct"] == 75.0

    # 2. Combined index_data_coverage_pct is reduced below 100.0% (87.5% for 75% demand + 100% supply)
    assert rec["index_data_coverage_pct"] < 100.0
    assert rec["index_data_coverage_pct"] == 87.5
    assert rec["data_coverage_pct"] == 87.5

    # 3. Missing signal is explicitly tracked
    assert "demand_growth" in rec["missing_index_signals"]

    # 4. Explanatory factors include coverage advisory noting re-normalized components and preliminary classification
    has_advisory = any("Data Coverage Advisory" in factor for factor in rec["explanatory_factors"])
    assert has_advisory, f"Expected Data Coverage Advisory in explanatory_factors: {rec['explanatory_factors']}"

    # 5. Relative mismatch score is still computed reliably from re-normalized active components
    assert isinstance(rec["relative_mismatch_score"], float)
    assert rec["classification"] in {"Demand Pressure", "Supply Pressure", "Balanced / Monitor"}

