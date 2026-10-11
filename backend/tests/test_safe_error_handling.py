"""Focused Tests for Safe Internal-Error Responses across All API Routes.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Verifies that unexpected runtime exceptions (I/O, database, compute faults)
are logged server-side and return generic, user-safe HTTP 500 error messages
without leaking internal stack traces, system paths, or exception details.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.api.v1.alerts as alerts_api
import app.api.v1.demand as demand_api
import app.api.v1.forecasts as forecasts_api
import app.api.v1.gap_analysis as gap_api
import app.api.v1.seat_simulator as simulator_api

SECRET_TRACE = "CRITICAL_INTERNAL_DB_PASSWORD_OR_PATH_C:/private/keys/secret.pem"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def test_alerts_calculation_error_does_not_leak_exception(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Early-warning alerts endpoint hides internal exceptions."""
    service = alerts_api.get_alerts_service()

    def mock_fail(*args, **kwargs):
        raise RuntimeError(SECRET_TRACE)

    monkeypatch.setattr(service, "calculate_alerts", mock_fail)

    resp = client.get("/api/v1/alerts")
    assert resp.status_code == 500
    assert SECRET_TRACE not in resp.text
    detail = resp.json().get("detail", "")
    assert SECRET_TRACE not in detail
    assert "internal error" in detail.lower()


def test_alerts_load_data_error_does_not_leak_exception(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Early-warning alerts data loading failure hides internal exceptions."""
    service = alerts_api.get_alerts_service()

    def mock_fail(*args, **kwargs):
        raise RuntimeError(SECRET_TRACE)

    monkeypatch.setattr(service, "load_data", mock_fail)

    resp = client.get("/api/v1/alerts")
    assert resp.status_code == 500
    assert SECRET_TRACE not in resp.text
    detail = resp.json().get("detail", "")
    assert SECRET_TRACE not in detail
    assert "internal server error" in detail.lower()


def test_demand_index_calculation_error_does_not_leak_exception(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Demand index endpoint hides internal exceptions."""
    service = demand_api.get_demand_service()

    def mock_fail(*args, **kwargs):
        raise RuntimeError(SECRET_TRACE)

    monkeypatch.setattr(service, "calculate_demand_index", mock_fail)

    resp = client.get("/api/v1/demand-index")
    assert resp.status_code == 500
    assert SECRET_TRACE not in resp.text
    detail = resp.json().get("detail", "")
    assert SECRET_TRACE not in detail
    assert "internal error" in detail.lower()


def test_demand_index_load_data_error_does_not_leak_exception(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Demand index data loading failure hides internal exceptions."""
    service = demand_api.get_demand_service()

    def mock_fail(*args, **kwargs):
        raise RuntimeError(SECRET_TRACE)

    monkeypatch.setattr(service, "load_data", mock_fail)

    resp = client.get("/api/v1/demand-index")
    assert resp.status_code == 500
    assert SECRET_TRACE not in resp.text
    detail = resp.json().get("detail", "")
    assert SECRET_TRACE not in detail
    assert "internal server error" in detail.lower()


def test_forecasts_calculation_error_does_not_leak_exception(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Forecasting endpoint hides internal exceptions."""
    service = forecasts_api.get_forecasting_service()

    def mock_fail(*args, **kwargs):
        raise RuntimeError(SECRET_TRACE)

    monkeypatch.setattr(service, "calculate_forecasts", mock_fail)

    resp = client.get("/api/v1/forecasts")
    assert resp.status_code == 500
    assert SECRET_TRACE not in resp.text
    detail = resp.json().get("detail", "")
    assert SECRET_TRACE not in detail
    assert "internal error" in detail.lower()


def test_forecasts_load_data_error_does_not_leak_exception(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Forecasting data loading failure hides internal exceptions."""
    service = forecasts_api.get_forecasting_service()

    def mock_fail(*args, **kwargs):
        raise RuntimeError(SECRET_TRACE)

    monkeypatch.setattr(service, "load_data", mock_fail)

    resp = client.get("/api/v1/forecasts")
    assert resp.status_code == 500
    assert SECRET_TRACE not in resp.text
    detail = resp.json().get("detail", "")
    assert SECRET_TRACE not in detail
    assert "internal server error" in detail.lower()


def test_gap_analysis_calculation_error_does_not_leak_exception(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Gap analysis endpoint hides internal exceptions."""
    service = gap_api.get_gap_service()

    def mock_fail(*args, **kwargs):
        raise RuntimeError(SECRET_TRACE)

    monkeypatch.setattr(service, "calculate_gap_analysis", mock_fail)

    resp = client.get("/api/v1/gap-analysis")
    assert resp.status_code == 500
    assert SECRET_TRACE not in resp.text
    detail = resp.json().get("detail", "")
    assert SECRET_TRACE not in detail
    assert "internal error" in detail.lower()


def test_gap_analysis_load_data_error_does_not_leak_exception(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Gap analysis data loading failure hides internal exceptions."""
    service = gap_api.get_gap_service()

    def mock_fail(*args, **kwargs):
        raise RuntimeError(SECRET_TRACE)

    monkeypatch.setattr(service.demand_service, "load_data", mock_fail)

    resp = client.get("/api/v1/gap-analysis")
    assert resp.status_code == 500
    assert SECRET_TRACE not in resp.text
    detail = resp.json().get("detail", "")
    assert SECRET_TRACE not in detail
    assert "internal server error" in detail.lower()


def test_seat_simulator_load_data_error_does_not_leak_exception(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    """Seat simulator data loading failure hides internal exceptions."""
    service = simulator_api.get_simulator_service()

    def mock_fail(*args, **kwargs):
        raise RuntimeError(SECRET_TRACE)

    monkeypatch.setattr(service, "load_data", mock_fail)

    payload = {
        "period": "2026-09",
        "horizon_months": 3,
        "district_id": "KA_BLR_U",
        "occupation_id": "OCC_IT_001",
        "proposed_seats_per_cohort": 150,
    }
    resp = client.post("/api/v1/simulations/seat-allocation", json=payload)
    assert resp.status_code == 500
    assert SECRET_TRACE not in resp.text
    detail = resp.json().get("detail", "")
    assert SECRET_TRACE not in detail
    assert "internal server error" in detail.lower()
