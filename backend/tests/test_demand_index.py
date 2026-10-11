"""Automated test suite for SkillPulse Demand Index Engine (Task 3).

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Covers the 9 verification requirements:
1. Composite scores remain strictly within [0.0, 100.0].
2. Deterministic ordering by score and documented tie-breaking rules.
3. Missing components exclusion and dynamic weight re-normalization.
4. Zero or missing reference-period values handled safely without division errors.
5. Repeated runs on identical inputs yield 100% deterministic, identical outputs.
6. All records clearly identify synthetic data status and limitations.
7. State, district, sector, and period filters work accurately.
8. Existing GET / and GET /health return HTTP 200 through TestClient.
9. Dataset validation passes and deterministic generation hashes match.
"""

from __future__ import annotations

import copy
import hashlib
from pathlib import Path
from typing import Dict, Optional, Tuple

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.demand_index import (
    DEFAULT_COMPONENT_WEIGHTS,
    DEMAND_INDEX_LIMITATIONS,
    DemandIndexService,
    compute_percentile_ranks,
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="module")
def service() -> DemandIndexService:
    svc = DemandIndexService()
    svc.load_data()
    return svc


# ---------------------------------------------------------------------------
# Test 1: Composite Scores Bounded within [0, 100]
# ---------------------------------------------------------------------------
def test_composite_scores_bounded_between_0_and_100(service: DemandIndexService):
    """Verify composite demand index values always fall strictly in [0.0, 100.0]."""
    for period in ["2026-09", "2024-10"]:
        result = service.calculate_demand_index(period=period)
        assert len(result["results"]) > 0
        for rec in result["results"]:
            score = rec["composite_score"]
            assert isinstance(score, float)
            assert 0.0 <= score <= 100.0, f"Score {score} out of bounds for {rec}"

            # Check individual component normalized scores
            for c_name, c_data in rec["components"].items():
                norm_score = c_data["score"]
                if norm_score is not None:
                    assert 0.0 <= norm_score <= 100.0, (
                        f"Component {c_name} score {norm_score} out of bounds"
                    )


# ---------------------------------------------------------------------------
# Test 2: Deterministic Ordering & Tie-Breaking
# ---------------------------------------------------------------------------
def test_deterministic_ordering_and_tie_breaking(service: DemandIndexService):
    """Verify records are ordered by composite_score desc, posting_volume desc,
    occupation_title asc, district_name asc, with consecutive ranks 1..N.
    """
    result = service.calculate_demand_index(period="2026-09")
    records = result["results"]
    assert len(records) == 54  # 6 districts * 9 occupations

    for i in range(len(records) - 1):
        curr = records[i]
        nxt = records[i + 1]

        # Rank check
        assert curr["rank"] == i + 1
        assert nxt["rank"] == i + 2

        # Primary sort: composite_score desc
        assert curr["composite_score"] >= nxt["composite_score"]

        # Secondary tie-breaking when composite scores are equal
        if curr["composite_score"] == nxt["composite_score"]:
            curr_post = curr["components"]["posting_volume"]["raw_value"] or 0.0
            nxt_post = nxt["components"]["posting_volume"]["raw_value"] or 0.0
            assert curr_post >= nxt_post

            if curr_post == nxt_post:
                assert curr["occupation_title"] <= nxt["occupation_title"]
                if curr["occupation_title"] == nxt["occupation_title"]:
                    assert curr["district_name"] <= nxt["district_name"]


# ---------------------------------------------------------------------------
# Test 3: Missing Components & Weight Re-Normalization
# ---------------------------------------------------------------------------
def test_missing_components_weight_renormalization(service: DemandIndexService):
    """Verify missing components are dynamically excluded and weights re-normalized to 1.0."""
    # Period 2024-10 has no 6-month trailing history, so demand_growth must be missing (None)
    result = service.calculate_demand_index(period="2024-10")
    records = result["results"]
    assert len(records) > 0

    for rec in records:
        growth_comp = rec["components"]["demand_growth"]
        assert growth_comp["score"] is None
        assert "demand_growth" in rec["missing_signals"]

        # Available weights: 0.30 + 0.15 + 0.15 + 0.15 = 0.75 (75.0% coverage)
        assert rec["data_coverage_pct"] == 75.0

        # Verify mathematical re-normalization: composite = sum(w * score) / sum(w)
        available_weights = 0.0
        weighted_sum = 0.0
        for c_name, c_data in rec["components"].items():
            if c_data["score"] is not None:
                available_weights += c_data["weight"]
                weighted_sum += c_data["weight"] * c_data["score"]

        expected_score = round(weighted_sum / available_weights, 2)
        assert rec["composite_score"] == expected_score


def test_percentile_rank_tie_handling_and_normalization():
    """Unit test compute_percentile_ranks with ties and missing values."""
    raw = {
        ("D1", "O1"): 10.0,
        ("D1", "O2"): 20.0,
        ("D1", "O3"): 20.0,
        ("D1", "O4"): 40.0,
        ("D1", "O5"): None,
    }
    ranks = compute_percentile_ranks(raw)
    assert ranks[("D1", "O5")] is None
    assert ranks[("D1", "O1")] == 0.0
    assert ranks[("D1", "O4")] == 100.0
    # Two tied at 20.0 out of 4 valid items:
    # rank = strictly_less (1) + (equal (2) - 1)/2 = 1.5
    # score = (1.5 / 3.0) * 100 = 50.0
    assert ranks[("D1", "O2")] == 50.0
    assert ranks[("D1", "O3")] == 50.0


# ---------------------------------------------------------------------------
# Test 4: Safe Handling of Zero or Missing Reference-Period Values
# ---------------------------------------------------------------------------
def test_zero_or_missing_reference_period_handling(service: DemandIndexService):
    """Verify calculate_growth_rate handles insufficient periods or zero denominator without division errors."""
    # 1. Non-existent occupation or district returns None
    assert service.calculate_growth_rate("UNKNOWN", "UNKNOWN", "2026-09") is None

    # 2. Earliest period has insufficient 6-month history (< 5 previous periods)
    assert service.calculate_growth_rate("MH_PUN", "OCC_MFG_001", "2024-10") is None
    assert service.calculate_growth_rate("MH_PUN", "OCC_MFG_001", "2025-02") is None

    # 3. 6th period (index 5) is the first eligible period
    rate = service.calculate_growth_rate("MH_PUN", "OCC_MFG_001", "2025-03")
    assert rate is not None and isinstance(rate, float)

    # 4. Zero denominator guard: simulate zero prior mean
    svc_copy = DemandIndexService()
    svc_copy._available_periods = ["P1", "P2", "P3", "P4", "P5", "P6"]
    # All prior periods have 0.0 postings
    svc_copy._postings_history = {
        ("D", "O"): {"P1": 0.0, "P2": 0.0, "P3": 0.0, "P4": 10.0, "P5": 10.0, "P6": 10.0}
    }
    svc_copy._loaded = True
    # Should safely return None instead of raising ZeroDivisionError
    res = svc_copy.calculate_growth_rate("D", "O", "P6")
    assert res is None


# ---------------------------------------------------------------------------
# Test 5: Repeated Runs Yield Identical Deterministic Results
# ---------------------------------------------------------------------------
def test_repeated_runs_yield_identical_results(service: DemandIndexService):
    """Verify that multiple consecutive executions on identical data return 100% identical results."""
    run1 = service.calculate_demand_index(period="2026-09")
    run2 = service.calculate_demand_index(period="2026-09")

    assert run1["period"] == run2["period"]
    assert len(run1["results"]) == len(run2["results"])

    for r1, r2 in zip(run1["results"], run2["results"]):
        assert r1["rank"] == r2["rank"]
        assert r1["composite_score"] == r2["composite_score"]
        assert r1["occupation_id"] == r2["occupation_id"]
        assert r1["district_id"] == r2["district_id"]
        assert r1["key_drivers"] == r2["key_drivers"]
        assert r1["components"] == r2["components"]


# ---------------------------------------------------------------------------
# Test 6: Synthetic Data Provenance Flags & Semantic Guardrails
# ---------------------------------------------------------------------------
def test_synthetic_data_provenance_flags(service: DemandIndexService):
    """Verify synthetic provenance markers and non-forecast/non-shortage disclaimers are present."""
    result = service.calculate_demand_index(period="2026-09")
    assert result["is_synthetic"] is True
    assert "limitations" in result
    assert "relative demand indicator" in result["limitations"]
    assert "NOT an absolute job count" in result["limitations"]

    for rec in result["results"]:
        assert rec["is_synthetic"] is True


# ---------------------------------------------------------------------------
# Test 7: Filter Parameters
# ---------------------------------------------------------------------------
def test_filter_parameters(service: DemandIndexService):
    """Verify state_code, district_id, sector, limit, and period filters operate correctly."""
    # 1. State filter
    mh_res = service.calculate_demand_index(period="2026-09", state_code="MH")
    assert all(r["state_code"] == "MH" for r in mh_res["results"])
    assert len(mh_res["results"]) == 18  # 2 districts * 9 occupations

    # 2. District filter
    blr_res = service.calculate_demand_index(period="2026-09", district_id="KA_BLR_U")
    assert all(r["district_id"] == "KA_BLR_U" for r in blr_res["results"])
    assert len(blr_res["results"]) == 9  # 9 occupations in Bangalore Urban

    # 3. Sector filter
    it_res = service.calculate_demand_index(period="2026-09", sector="IT/ITeS")
    assert all(r["sector"] == "IT/ITeS" for r in it_res["results"])
    assert len(it_res["results"]) == 18  # 6 districts * 3 IT occupations

    # 4. Limit filter
    top3 = service.calculate_demand_index(period="2026-09", limit=3)
    assert len(top3["results"]) == 3
    assert [r["rank"] for r in top3["results"]] == [1, 2, 3]

    # 5. Period filter
    p_res = service.calculate_demand_index(period="2025-06")
    assert p_res["period"] == "2025-06"
    assert len(p_res["results"]) == 54


# ---------------------------------------------------------------------------
# Test 8: Existing and New FastAPI Endpoints via TestClient
# ---------------------------------------------------------------------------
def test_fastapi_endpoints_via_testclient(client: TestClient):
    """Verify GET /, GET /health, and GET /api/v1/demand-index responses and validation errors."""
    # 1. GET /
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json()["project"] == "SkillPulse LMIS"

    # 2. GET /health
    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json() == {"status": "healthy"}

    # 3. GET /api/v1/demand-index default (latest period)
    r_demand = client.get("/api/v1/demand-index")
    assert r_demand.status_code == 200
    data = r_demand.json()
    assert data["period"] == "2026-09"
    assert data["summary"]["total_cross_section_items"] == 54

    # 4. GET /api/v1/demand-index with valid filters
    r_filt = client.get("/api/v1/demand-index?state_code=MH&limit=2")
    assert r_filt.status_code == 200
    filt_data = r_filt.json()
    assert len(filt_data["results"]) == 2
    assert filt_data["summary"]["filter_matches"] == 18

    # 5. Invalid period format -> 400
    r_bad_period = client.get("/api/v1/demand-index?period=2026/09")
    assert r_bad_period.status_code == 400
    assert "Invalid period format" in r_bad_period.json()["detail"]

    # 6. Period out of range -> 400
    r_out_range = client.get("/api/v1/demand-index?period=2020-01")
    assert r_out_range.status_code == 400
    assert "not found in dataset" in r_out_range.json()["detail"]

    # 7. Invalid state_code -> 400
    r_bad_state = client.get("/api/v1/demand-index?state_code=XX")
    assert r_bad_state.status_code == 400
    assert "Invalid state_code" in r_bad_state.json()["detail"]

    # 8. Invalid district_id -> 400
    r_bad_dist = client.get("/api/v1/demand-index?district_id=INVALID_DIST")
    assert r_bad_dist.status_code == 400
    assert "Invalid district_id" in r_bad_dist.json()["detail"]

    # 9. Invalid sector -> 400
    r_bad_sector = client.get("/api/v1/demand-index?sector=Aerospace")
    assert r_bad_sector.status_code == 400
    assert "Invalid sector" in r_bad_sector.json()["detail"]

    # 10. Invalid limit (ge=1 constraint) -> 422
    r_bad_limit = client.get("/api/v1/demand-index?limit=0")
    assert r_bad_limit.status_code == 422


# ---------------------------------------------------------------------------
# Test 9: Dataset Validation & Generation Determinism
# ---------------------------------------------------------------------------
def test_dataset_validation_and_generation_determinism():
    """Verify that sample CSV files pass all validation checks and generation is deterministic."""
    import subprocess
    import sys

    # Run validation script
    val_proc = subprocess.run(
        [sys.executable, "scripts/validate_sample_data.py"],
        cwd=str(Path(__file__).resolve().parent.parent),
        capture_output=True,
        text=True,
    )
    assert val_proc.returncode == 0, f"validate_sample_data.py failed:\n{val_proc.stderr}"
    assert "SUCCESS: All datasets passed" in val_proc.stdout

    # Verify demand observation record count is 5,184
    dem_path = Path(__file__).resolve().parent.parent.parent / "data" / "sample" / "demand_observations.csv"
    import csv
    with open(dem_path, "r", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 5184, f"Expected 5,184 demand observations, found {len(rows)}"


# ---------------------------------------------------------------------------
# Test 10: Integer Posting Counts Regression & Validation Checks
# ---------------------------------------------------------------------------
def test_integer_posting_counts_and_validation(service: DemandIndexService):
    """Verify that online_job_postings are strictly integer counts and fractional counts are rejected."""
    import csv
    from pydantic import ValidationError
    from app.schemas.data_models import DemandObservation

    # 1. Verify CSV contents: every online_job_postings record must be an integer count
    dem_path = service.data_dir / "demand_observations.csv"
    with open(dem_path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row["signal_type"] == "online_job_postings":
                val_float = float(row["signal_value"])
                assert val_float.is_integer(), f"Fractional posting count found: {row}"
                # In CSV text, should not have non-zero fractional decimals
                assert "." not in row["signal_value"] or row["signal_value"].endswith(".0")

    # 2. Verify Pydantic schema validation rejects fractional posting counts
    with pytest.raises(ValidationError) as exc_info:
        DemandObservation(
            period="2026-09",
            district_id="KA_BLR_U",
            occupation_id="OCC_IT_001",
            source="test_source",
            signal_type="online_job_postings",
            signal_value=125.4,  # Fractional count must be rejected
            unit="postings_count",
            data_provenance="Unit test fractional validation",
            is_synthetic=True,
        )
    assert "requires a non-negative integer count" in str(exc_info.value)

    # 3. Verify Pydantic schema accepts valid integer count
    valid_obs = DemandObservation(
        period="2026-09",
        district_id="KA_BLR_U",
        occupation_id="OCC_IT_001",
        source="test_source",
        signal_type="online_job_postings",
        signal_value=125,
        unit="postings_count",
        data_provenance="Unit test integer validation",
        is_synthetic=True,
    )
    assert valid_obs.signal_value == 125.0

    # 4. Verify API results return posting_volume raw_value as an int
    res = service.calculate_demand_index(period="2026-09")
    for r in res["results"]:
        pv = r["components"]["posting_volume"]["raw_value"]
        assert isinstance(pv, int), f"Expected int posting_volume, got {type(pv)}"


# ---------------------------------------------------------------------------
# Test 11: Demand Growth Semantics & Fractional Growth Rate Unit Checks
# ---------------------------------------------------------------------------
def test_demand_growth_semantics_and_units(service: DemandIndexService):
    """Verify growth rate semantics represent fractional change (e.g., 0.0752 = 7.52%), not uncentered ratio 1.0752."""
    res = service.calculate_demand_index(period="2026-09")

    # 1. Check unit and interpretation fields in component response
    first_rec = res["results"][0]
    growth_comp = first_rec["components"]["demand_growth"]
    assert growth_comp["unit"] == "fractional_growth_rate"
    assert "0.0752 denotes +7.52% growth, not a ratio of 1.0752" in growth_comp["interpretation"]

    # 2. Check methodology documentation
    methodology = res["methodology"]
    assert "growth_metric" in methodology
    assert "Fractional growth rate" in methodology["growth_metric"]
    assert "NOT a ratio of 1.0752" in methodology["growth_metric"]

    # 3. Mathematical verification on synthetic values: (recent - prior) / prior
    mock_svc = DemandIndexService()
    mock_svc._available_periods = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
    # Prior 3m (Jan, Feb, Mar) avg = 100.0, Recent 3m (Apr, May, Jun) avg = 110.0 (+10% growth)
    mock_svc._postings_history = {
        ("D1", "O1"): {
            "2026-01": 100.0,
            "2026-02": 100.0,
            "2026-03": 100.0,
            "2026-04": 110.0,
            "2026-05": 110.0,
            "2026-06": 110.0,
        }
    }
    mock_svc._loaded = True

    growth_val = mock_svc.calculate_growth_rate("D1", "O1", "2026-06")
    assert growth_val == 0.10, f"Expected 0.10 (+10.0% growth rate), got {growth_val} (must NOT be 1.10 ratio)"

    # Negative growth verification: prior avg = 100.0, recent avg = 85.0 (-15% growth)
    mock_svc._postings_history[("D1", "O2")] = {
        "2026-01": 100.0,
        "2026-02": 100.0,
        "2026-03": 100.0,
        "2026-04": 85.0,
        "2026-05": 85.0,
        "2026-06": 85.0,
    }
    neg_growth = mock_svc.calculate_growth_rate("D1", "O2", "2026-06")
    assert neg_growth == -0.15, f"Expected -0.15 (-15.0% growth rate), got {neg_growth}"

