"""Unit and integration tests for SkillPulse Grounded Policy Copilot Analytical Engine."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.policy_copilot_service import PolicyCopilotService

client = TestClient(app)


def test_policy_copilot_service_direct():
    service = PolicyCopilotService()
    
    # 1. Test highest pressure query
    res = service.process_query("Which district has the highest demand pressure in this cycle?", period="2026-09")
    assert res["intent"] == "highest_pressure"
    assert "Top Demand Pressure" in res["title"]
    assert "evidence" in res
    assert res["period"] == "2026-09"
    assert len(res["suggested_followups"]) > 0

    # 2. Test Dharwad CNC gap diagnostics
    res_gap = service.process_query("Why is the skill gap high for CNC Machine Operators in Dharwad?", period="2026-09")
    assert res_gap["intent"] == "gap_diagnostics"
    assert "Dharwad" in res_gap["title"]
    assert "CNC" in res_gap["title"]
    assert res_gap["evidence"]["district_id"] == "KA_DHA"

    # 3. Test alerts interpretation
    res_alerts = service.process_query("What are the top persistent alerts across the pilot corridors?", period="2026-09")
    assert res_alerts["intent"] == "alerts_interpretation"
    assert "ALERTS ACTIVE" in res_alerts["badge"]

    # 4. Test alerts seat planning meaning
    res_seat_plan = service.process_query("What does the latest alert mean for training-seat planning?", period="2026-09")
    assert res_seat_plan["intent"] == "alerts_interpretation"
    assert "Training-Seat Planning" in res_seat_plan["title"]
    assert "Persistent Demand Pressure" in res_seat_plan["answer"]

    # 5. Test forecast accuracy comparison
    res_fc = service.process_query("Compare forecast accuracy across forecasting models.", period="2026-09")
    assert res_fc["intent"] == "forecast_comparison"
    assert "ROLLING-ORIGIN" in res_fc["badge"]
    assert "Linear Trend" in res_fc["answer"]

    # 6. Test Bengaluru logistics seat simulation
    res_sim = service.process_query("What seat planning scenario can be evaluated for Bengaluru Urban Logistics?", period="2026-09")
    assert res_sim["intent"] == "seat_simulation"
    assert "Bengaluru Urban Logistics" in res_sim["title"]
    assert res_sim["evidence"]["baseline_seats"] == 80

    # 7. Test methodological limitations
    res_limits = service.process_query("What are the methodological limitations of this dataset?", period="2026-09")
    assert res_limits["intent"] == "methodological_limitations"
    assert "Synthetic Pilot Data" in res_limits["answer"]

    # 8. Test greetings
    res_greet = service.process_query("Hello! Who are you?", period="2026-09")
    assert res_greet["intent"] == "greetings"
    assert "SkillPulse Policy Copilot" in res_greet["title"]

    # 9. Test out of scope
    res_oos = service.process_query("Can you write a poem about the weather?", period="2026-09")
    assert res_oos["intent"] == "unsupported"
    assert "OUT OF SCOPE" in res_oos["badge"]


def test_policy_copilot_api_endpoint_highest_pressure():
    response = client.post(
        "/api/v1/policy-copilot/query",
        json={"query": "Which district has the highest demand pressure this cycle?", "period": "2026-09"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "highest_pressure"
    assert data["period"] == "2026-09"
    assert "MISMATCH" in data["badge"]
    assert data["action_tab"] == "simulator"


def test_policy_copilot_api_endpoint_preset_inquiry_ids():
    presets = [
        ("highest_pressure", "highest_pressure"),
        ("top_alerts", "alerts_interpretation"),
        ("dharwad_cnc", "gap_diagnostics"),
        ("bengaluru_logistics", "seat_simulation"),
        ("forecast_comparison", "forecast_comparison"),
        ("pilot_limitations", "methodological_limitations"),
    ]
    for preset_id, expected_intent in presets:
        response = client.post(
            "/api/v1/policy-copilot/query",
            json={"query": preset_id, "period": "2026-09"},
        )
        assert response.status_code == 200, f"Failed for {preset_id}"
        data = response.json()
        assert data["intent"] == expected_intent, f"Expected {expected_intent} for {preset_id}, got {data['intent']}"


def test_policy_copilot_api_endpoint_empty_query():
    # Empty string should fail with 422
    response = client.post(
        "/api/v1/policy-copilot/query",
        json={"query": "", "period": "2026-09"},
    )
    assert response.status_code == 422

    # Whitespace only should fail with 422
    response_ws = client.post(
        "/api/v1/policy-copilot/query",
        json={"query": "   \n  \t  ", "period": "2026-09"},
    )
    assert response_ws.status_code == 422


def test_policy_copilot_api_endpoint_conversational_history():
    history = [
        {"role": "user", "content": "Tell me about the CNC Machine Operator in Dharwad."},
        {"role": "assistant", "content": "In Dharwad, CNC Machine Operator has high demand."},
    ]
    response = client.post(
        "/api/v1/policy-copilot/query",
        json={
            "query": "What about Bengaluru?",
            "period": "2026-09",
            "history": history,
        },
    )
    assert response.status_code == 200
    data = response.json()
    # Bengaluru should be detected from current turn, CNC from history
    assert data["intent"] == "gap_diagnostics"
    assert data["evidence"]["district_id"] == "KA_BLR_U"


def test_policy_copilot_api_endpoint_hindi():
    response = client.post(
        "/api/v1/policy-copilot/query",
        json={
            "query": "धारवाड़ में सीएनसी मशीन ऑपरेटर कौशल अंतर का विवरण दें।",
            "period": "2026-09",
            "language": "hi",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "gap_diagnostics"
    assert "धारवाड़" in data["title"] or "कौशल अंतर" in data["title"]
