"""Tests for the SkillPulse Metadata API endpoint."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_metadata_endpoint():
    response = client.get("/api/v1/metadata")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "occupations" in data
    assert "geographies" in data
    assert "available_periods" in data

    assert data["summary"]["total_occupations"] == 9
    assert data["summary"]["total_districts"] == 6
    assert data["summary"]["total_states"] == 3
    assert data["summary"]["active_pilot_period"] == "2026-09"

    # Verify that occupations preserve taxonomy invariants
    occ_map = {o["occupation_id"]: o for o in data["occupations"]}
    assert len(occ_map) == 9
    assert "OCC_IT_001" in occ_map
    assert occ_map["OCC_IT_001"]["nsqf_level"] == 6.0
    # Null NCO codes preserved
    assert occ_map["OCC_IT_001"]["nco_code"] is None
    # Verified NCO preserved
    assert occ_map["OCC_IT_003"]["nco_code"] == "2513.0101"

    # Verify geographies
    geo_map = {g["district_id"]: g for g in data["geographies"]}
    assert len(geo_map) == 6
    assert "MH_PUN" in geo_map
    assert geo_map["MH_PUN"]["lat"] == 18.52
    assert geo_map["MH_PUN"]["lon"] == 73.86
