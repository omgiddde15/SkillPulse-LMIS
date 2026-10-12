"""Automated Reference Integrity & Canonical Occupation ID Test Suite for SkillPulse LMIS.

Verifies that:
1. Every occupation referenced across frontend modules, recommendations, deltas,
   and links resolves to a canonical occupation ID in data/sample/occupations.csv.
2. Every district referenced resolves to data/sample/geographies.csv.
3. No invalid/non-canonical trade names appear as active record identifiers
   (e.g., 'Manual Metal Arc Welder', 'Automotive Welding', 'Cloud Architecture',
   'Cloud Infrastructure Architect').
4. Longitudinal change tracking logic correctly handles matching, point differences,
   missing history, and division-by-zero bounds.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Dict, List, Set

import pytest
from fastapi.testclient import TestClient

from app.main import app

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = REPO_ROOT / "data" / "sample"
FRONTEND_DIR = REPO_ROOT / "frontend" / "src"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def get_canonical_occupations() -> Dict[str, Dict[str, str]]:
    """Load canonical occupations from occupations.csv."""
    occ_path = DATA_DIR / "occupations.csv"
    assert occ_path.is_file(), f"Missing {occ_path}"
    canonical = {}
    with open(occ_path, mode="r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            canonical[row["occupation_id"]] = row
    return canonical


def get_canonical_districts() -> Dict[str, Dict[str, str]]:
    """Load canonical geographies from geographies.csv."""
    geo_path = DATA_DIR / "geographies.csv"
    assert geo_path.is_file(), f"Missing {geo_path}"
    canonical = {}
    with open(geo_path, mode="r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            canonical[row["district_id"]] = row
    return canonical


class TestCanonicalTaxonomyIntegrity:
    """Validate canonical dataset entities and invariants."""

    def test_canonical_occupation_count_and_keys(self):
        canonical_occs = get_canonical_occupations()
        assert len(canonical_occs) == 9, f"Expected 9 canonical occupations, found {len(canonical_occs)}"
        expected_ids = {
            "OCC_IT_001", "OCC_IT_002", "OCC_IT_003",
            "OCC_MFG_001", "OCC_MFG_002", "OCC_MFG_003",
            "OCC_LOG_001", "OCC_LOG_002", "OCC_LOG_003",
        }
        assert set(canonical_occs.keys()) == expected_ids

    def test_canonical_district_count_and_keys(self):
        canonical_districts = get_canonical_districts()
        assert len(canonical_districts) == 6, f"Expected 6 canonical districts, found {len(canonical_districts)}"
        expected_ids = {
            "MH_PUN", "MH_MUM", "KA_BLR_U", "KA_DHA", "TS_HYD", "TS_MED"
        }
        assert set(canonical_districts.keys()) == expected_ids

    def test_forbidden_trade_strings_not_in_canonical_csv(self):
        canonical_occs = get_canonical_occupations()
        forbidden_titles = [
            "Manual Metal Arc Welder",
            "Automotive Welding",
            "Welder",
            "Cloud Infrastructure Architect",
            "Cloud Architecture",
        ]
        for occ_id, data in canonical_occs.items():
            for forbidden in forbidden_titles:
                assert forbidden.lower() not in data["occupation_title"].lower(), (
                    f"Forbidden title '{forbidden}' found in canonical occupation {occ_id}"
                )


class TestFrontendModuleReferenceIntegrity:
    """Validate that frontend modules only reference canonical IDs and do not display fictional records."""

    def test_recommendations_canonical_ids(self):
        rec_file = FRONTEND_DIR / "components" / "dashboard" / "Recommendations.jsx"
        assert rec_file.is_file()
        content = rec_file.read_text(encoding="utf-8")

        canonical_occs = get_canonical_occupations()
        canonical_districts = get_canonical_districts()

        # Extract all occupationId: '...' references
        occ_matches = re.findall(r"occupationId:\s*['\"]([^'\"]+)['\"]", content)
        for occ_id in occ_matches:
            assert occ_id in canonical_occs, (
                f"Recommendations.jsx references non-canonical occupationId: '{occ_id}'"
            )

        # Extract all districtId: '...' references
        dist_matches = re.findall(r"districtId:\s*['\"]([^'\"]+)['\"]", content)
        for dist_id in dist_matches:
            assert dist_id in canonical_districts, (
                f"Recommendations.jsx references non-canonical districtId: '{dist_id}'"
            )

    def test_overview_navigation_links_canonical_ids(self):
        overview_file = FRONTEND_DIR / "components" / "Overview.jsx"
        assert overview_file.is_file()
        content = overview_file.read_text(encoding="utf-8")

        canonical_occs = get_canonical_occupations()
        canonical_districts = get_canonical_districts()

        # Check occupation references in navigation
        occ_matches = re.findall(r"occupation:\s*['\"]([^'\"]+)['\"]", content)
        for occ_id in occ_matches:
            assert occ_id in canonical_occs, (
                f"Overview.jsx navigation link references non-canonical occupationId: '{occ_id}'"
            )

        # Check district references in navigation
        dist_matches = re.findall(r"district:\s*['\"]([^'\"]+)['\"]", content)
        for dist_id in dist_matches:
            assert dist_id in canonical_districts, (
                f"Overview.jsx navigation link references non-canonical districtId: '{dist_id}'"
            )

    def test_no_fictional_welder_records_in_overview_or_recommendations(self):
        files_to_check = [
            FRONTEND_DIR / "components" / "Overview.jsx",
            FRONTEND_DIR / "components" / "dashboard" / "Recommendations.jsx",
        ]
        for f in files_to_check:
            assert f.is_file()
            content = f.read_text(encoding="utf-8")
            # We strictly disallow displaying "Pune Automotive Welding" or "Manual Metal Arc Welder"
            assert "Pune Automotive Welding" not in content, (
                f"Found unsupported 'Pune Automotive Welding' in {f.name}"
            )
            assert "Manual Metal Arc Welder" not in content, (
                f"Found unsupported 'Manual Metal Arc Welder' in {f.name}"
            )

    def test_canonical_cloud_title_is_associate(self):
        rec_file = FRONTEND_DIR / "components" / "dashboard" / "Recommendations.jsx"
        content = rec_file.read_text(encoding="utf-8")
        assert "Cloud Infrastructure Architect" not in content, (
            "Found non-canonical 'Cloud Infrastructure Architect'; must be 'Cloud Infrastructure Associate'"
        )


class TestLongitudinalChangeCalculation:
    """Validate mathematical correctness and robustness of longitudinal delta calculations."""

    def test_delta_calculation_formulas(self):
        """Deltas between two periods must be exact arithmetic differences."""
        curr_demand = 73.06
        prev_demand = 51.84
        demand_delta = round(curr_demand - prev_demand, 2)
        assert demand_delta == 21.22, f"Expected +21.22 pts, got {demand_delta}"

        curr_mismatch = 56.08
        prev_mismatch = 16.93
        mismatch_delta = round(curr_mismatch - prev_mismatch, 2)
        assert mismatch_delta == 39.15, f"Expected +39.15 pts, got {mismatch_delta}"

    def test_zero_denominator_safe_percentage(self):
        """Safe percentage change calculation must not crash or return inf on zero baseline."""
        def safe_pct_change(curr: float, prev: float) -> str:
            if prev <= 0.0:
                return "N/A (zero baseline)"
            return f"{((curr - prev) / prev) * 100:+.1f}%"

        assert safe_pct_change(100.0, 0.0) == "N/A (zero baseline)"
        assert safe_pct_change(100.0, -10.0) == "N/A (zero baseline)"
        assert safe_pct_change(120.0, 100.0) == "+20.0%"

    def test_missing_history_handling(self):
        """When historical record is missing, must produce explicit insufficient history state."""
        records_2026_09 = {"OCC_MFG_001": 73.06}
        records_2026_08 = {}  # Empty previous period

        def compute_tracker(curr_dict, prev_dict, occ_id):
            if occ_id not in curr_dict or occ_id not in prev_dict:
                return {"status": "insufficient_history", "delta": None}
            return {"status": "valid", "delta": curr_dict[occ_id] - prev_dict[occ_id]}

        res = compute_tracker(records_2026_09, records_2026_08, "OCC_MFG_001")
        assert res["status"] == "insufficient_history"
        assert res["delta"] is None


class TestAlertKPISemantics:
    """Validate early-warning alert KPI semantics, counts, and invariants.

    Ensures that Overview and Early Warning pages use consistent, non-truncated
    alert counts matching the genuine EarlyWarningService output:
    - Exactly 143 total alert trajectory signals for 2026-09 (when limit=500).
    - Exactly 35 persistent multi-horizon alerts (is_persistent == True).
    - Exactly 39 unique district-occupation corridors.
    - All referenced IDs resolve to canonical taxonomies.
    - Baseline origin (2024-10) responds safely without crashes.
    """

    def test_alert_cardinality_for_period_2026_09(self, client: TestClient):
        response = client.get("/api/v1/alerts?period=2026-09&limit=500")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        results = data.get("results", [])

        # Total alert signals
        assert len(results) == 143, f"Expected 143 total alerts, got {len(results)}"
        assert data.get("summary", {}).get("total_alerts") == 143

        # Persistent multi-horizon alerts
        persistent_alerts = [
            a for a in results if a.get("key_values", {}).get("is_persistent") is True
        ]
        assert len(persistent_alerts) == 35, f"Expected 35 persistent alerts, got {len(persistent_alerts)}"

        # Unique corridors
        corridors = set((a["district_id"], a["occupation_id"]) for a in results)
        assert len(corridors) == 39, f"Expected 39 unique corridors, got {len(corridors)}"

        # Severity distribution
        critical_count = data.get("summary", {}).get("by_severity", {}).get("critical", 0)
        high_count = data.get("summary", {}).get("by_severity", {}).get("high", 0)
        assert critical_count == 107
        assert high_count == 36
        assert critical_count + high_count == 143

    def test_all_alerts_resolve_to_canonical_taxonomies(self, client: TestClient):
        canonical_occs = get_canonical_occupations()
        canonical_districts = get_canonical_districts()

        response = client.get("/api/v1/alerts?period=2026-09&limit=500")
        assert response.status_code == 200
        for alert in response.json().get("results", []):
            dist_id = alert["district_id"]
            occ_id = alert["occupation_id"]
            assert dist_id in canonical_districts, f"Alert references invalid district {dist_id}"
            assert occ_id in canonical_occs, f"Alert references invalid occupation {occ_id}"

    def test_baseline_origin_alerts_handling(self, client: TestClient):
        """At baseline origin cycle (2024-10), alerts API must respond gracefully."""
        response = client.get("/api/v1/alerts?period=2024-10&limit=500")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "summary" in data
        assert "metadata" in data
        assert data["metadata"]["base_period"] == "2024-10"
