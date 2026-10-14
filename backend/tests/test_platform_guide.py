"""Comprehensive tests for SkillPulse Saarthi Platform Guide & Dual-Engine Router.

Validates:
1. "How do I use this site?" returns a Platform Guide response with executive overview link.
2. "Where can I find skill gaps?" returns the correct route ('gap').
3. "How do I generate a forecast?" returns grounded workflow instructions and route ('forecasts').
4. "How do I simulate training seats?" returns accurate steps and the Scenario Studio route ('simulator').
5. "Explain the relative mismatch score" returns the documented formula and limitations.
6. Supported labour-market questions still execute the real analytical engine.
7. Mixed-intent questions provide a grounded answer and useful navigation action.
8. Unsupported questions are handled honestly (OUT OF SCOPE).
9. Greetings remain concise and introduce Saarthi.
10. Navigation routes are verified against VALID_NAVIGATION_ROUTES.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.policy_copilot_service import PolicyCopilotService
from app.services.platform_guide_data import VALID_NAVIGATION_ROUTES

client = TestClient(app)


def test_platform_guide_how_to_use_site():
    """1. Test 'How do I use this site?' returns Platform Guide with overview action."""
    service = PolicyCopilotService()
    res = service.process_query("How do I use this site?", period="2026-09")
    assert res["intent"] == "platform_guide"
    assert res["badge"] == "PLATFORM GUIDE"
    assert res["action_route"] == "overview"
    assert res["action_tab"] == "overview"
    assert res["guide_topic"] == "getting_started"
    assert "Overview" in res["answer"]
    assert "Skill Gaps" in res["answer"]
    assert len(res["suggested_followups"]) > 0


def test_platform_guide_where_can_i_find_skill_gaps():
    """2. Test 'Where can I find skill gaps?' returns the correct route ('gap')."""
    service = PolicyCopilotService()
    res = service.process_query("Where can I find skill gaps?", period="2026-09")
    assert res["intent"] == "platform_guide"
    assert res["action_route"] == "gap"
    assert res["action_tab"] == "gap"
    assert res["guide_topic"] == "gap"
    assert "Open Skill Gaps" in res["action_label"]
    assert "TVET" in res["answer"]


def test_platform_guide_how_to_generate_forecast():
    """3. Test 'How do I generate a forecast?' returns grounded workflow instructions."""
    service = PolicyCopilotService()
    res = service.process_query("How do I generate a forecast?", period="2026-09")
    assert res["intent"] == "platform_guide"
    assert res["action_route"] == "forecasts"
    assert res["action_tab"] == "forecasts"
    assert res["guide_topic"] == "forecasts"
    assert "Open Predictive Forecasts" in res["action_label"]
    assert "3-Month" in res["answer"]
    assert "Moving Average" in res["answer"]


def test_platform_guide_how_to_simulate_training_seats():
    """4. Test 'How do I simulate training seats?' returns Scenario Studio route."""
    service = PolicyCopilotService()
    res = service.process_query("How do I simulate changing training seats?", period="2026-09")
    assert res["intent"] == "platform_guide"
    assert res["action_route"] == "simulator"
    assert res["action_tab"] == "simulator"
    assert res["guide_topic"] == "simulator"
    assert "Open Scenario Studio" in res["action_label"]
    assert "Donor Trade" in res["answer"]
    assert "Constant-Yield" in res["answer"]


def test_platform_guide_explain_relative_mismatch_score():
    """5. Test 'Explain the relative mismatch score' returns documented formula and limitations."""
    service = PolicyCopilotService()
    res = service.process_query("Explain the relative mismatch score", period="2026-09")
    assert res["intent"] == "platform_guide"
    assert res["guide_topic"] == "metric_relative_mismatch"
    assert res["action_route"] == "gap"
    assert "Relative Mismatch Score = Demand Score - Supply Score" in res["answer"]
    assert "90-day placement maturity" in res["answer"].lower()
    assert "Severe Deficit" in res["answer"]


def test_policy_analytics_execution_preserved():
    """6. Supported labour-market questions still execute the real analytical engine."""
    service = PolicyCopilotService()
    res = service.process_query("Which district has the highest demand pressure this cycle?", period="2026-09")
    assert res["intent"] == "highest_pressure"
    assert res["action_route"] == "simulator"
    assert "evidence" in res
    assert res["evidence"]["demand_index_score"] > 0
    assert res["evidence"]["relative_mismatch_score"] > 0


def test_mixed_intent_question():
    """7. Mixed-intent questions provide a grounded answer and useful navigation action."""
    service = PolicyCopilotService()
    res = service.process_query("How do I inspect the CNC Machinist skill gap in Dharwad?", period="2026-09")
    assert res["intent"] == "gap_diagnostics"
    assert res["action_route"] == "gap"
    assert res["action_tab"] == "gap"
    assert "Dharwad" in res["title"]
    assert "CNC" in res["title"]
    assert res["evidence"]["district_id"] == "KA_DHA"
    assert res["evidence"]["mismatch_score"] > 0
    assert "Skill Gaps" in res["answer"]


def test_unsupported_questions_handled_honestly():
    """8. Unsupported questions are handled honestly with OUT OF SCOPE badge."""
    service = PolicyCopilotService()
    res = service.process_query("What is the recipe for chocolate cake?", period="2026-09")
    assert res["intent"] == "unsupported"
    assert res["badge"] == "OUT OF SCOPE"
    assert "Saarthi" in res["title"] or "Scope" in res["title"]
    assert len(res["suggested_followups"]) > 0


def test_greetings_remain_concise():
    """9. Greetings remain concise and introduce SkillPulse Saarthi."""
    service = PolicyCopilotService()
    res = service.process_query("Hello!", period="2026-09")
    assert res["intent"] == "greetings"
    assert "SAARTHI" in res["badge"]
    assert "SkillPulse Saarthi" in res["answer"]
    assert "Platform Guide" in res["answer"]
    assert "Policy Analytics" in res["answer"]


def test_navigation_metadata_integrity():
    """10. Missing or invalid navigation metadata never creates a broken destination."""
    service = PolicyCopilotService()
    queries = [
        "How do I use this site?",
        "Where can I find skill gaps?",
        "How do I generate a forecast?",
        "How do I simulate changing training seats?",
        "Explain the relative mismatch score.",
        "How do I check data quality?",
        "How do I find learning opportunities?",
        "Where can I track my applications?",
        "How do I export data?",
        "Which district has the highest demand pressure this cycle?",
    ]
    for q in queries:
        res = service.process_query(q, period="2026-09")
        if res.get("action_route"):
            assert res["action_route"] in VALID_NAVIGATION_ROUTES, f"Invalid route: {res['action_route']} for query: {q}"
        if res.get("action_tab"):
            assert res["action_tab"] in VALID_NAVIGATION_ROUTES, f"Invalid tab: {res['action_tab']} for query: {q}"


def test_api_endpoint_platform_guide():
    """API test for platform guide query over HTTP."""
    response = client.post(
        "/api/v1/policy-copilot/query",
        json={"query": "How do I use this site?", "period": "2026-09"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "platform_guide"
    assert data["action_route"] == "overview"
    assert data["guide_topic"] == "getting_started"
