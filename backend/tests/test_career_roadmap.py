"""Comprehensive unit and integration test suite for SkillPulse Career Roadmaps (Phase 4).

Verifies:
1. Deterministic roadmap generation without Gemini API key.
2. Server-side enforcement of AI consent: when false, zero provider calls are made.
3. When consent is true, only minimized structured data is transmitted (no PII or raw resume text).
4. Provider timeouts, missing keys, rate limits, and schema failures fall back safely.
5. Unknown role IDs and invalid horizons are rejected with 400 Bad Request.
6. Closed, stale, and unconfirmed opportunity listings are never linked to milestones.
7. Strict user ownership across generate, list, detail, delete, and milestone update endpoints.
8. Non-disclosing 404 responses when User B attempts to access or modify User A's roadmap.
9. Milestone completion toggle updates timestamps and calculates progress percentages correctly.
"""

import os
import json
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from app.main import app
from app.db import init_db, get_db
from app.ai.base import AIProviderError, AITimeoutError, AIRateLimitError, AISchemaValidationError
from app.ai.ai_service import AIService
from app.services.roadmap_service import RoadmapService


@pytest.fixture(autouse=True)
def setup_isolated_db(tmp_path, monkeypatch):
    """Isolates SQLite database and temporary storage for every test."""
    test_db = str(tmp_path / "test_roadmap.db")
    upload_dir = str(tmp_path / "uploads")
    monkeypatch.setenv("SKILLPULSE_DB_PATH", test_db)
    monkeypatch.setenv("SKILLPULSE_UPLOAD_DIR", upload_dir)
    init_db(test_db)
    return test_db


@pytest.fixture
def client():
    return TestClient(app)


def register_and_login(client: TestClient, email: str, name: str = "Test Candidate") -> str:
    """Helper to register and login a test user, returning session cookie."""
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "full_name": name,
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    assert reg.status_code == 201
    return reg.cookies.get("session_id")


# -----------------------------------------------------------------------------
# 1. Deterministic Roadmap Tests
# -----------------------------------------------------------------------------

def test_deterministic_roadmap_without_api_key(client: TestClient, monkeypatch):
    """Deterministic roadmap succeeds without GEMINI_API_KEY and produces structured milestones."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    cookie = register_and_login(client, "deterministic_user@example.com")

    # Generate 30-day roadmap
    res = client.post(
        "/api/v1/career/roadmaps/generate",
        json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 30},
        cookies={"session_id": cookie},
    )
    assert res.status_code == 201
    data = res.json()

    assert data["target_role_id"] == "ROLE_PY_BACKEND"
    assert data["role_title"] == "Python / Backend Developer"
    assert data["horizon_days"] == 30
    assert data["generation_mode"] == "deterministic"
    assert "deterministic" in data["methodology_note"].lower()
    assert len(data["milestones"]) > 0

    # Verify duration days sum to horizon
    total_days = sum(m["suggested_duration_days"] for m in data["milestones"])
    assert total_days == 30

    # Verify milestones have allowed action types
    valid_actions = {"learn", "practise", "build_project", "review", "apply"}
    for m in data["milestones"]:
        assert m["action_type"] in valid_actions
        assert m["milestone_order"] >= 1
        assert m["is_completed"] is False


def test_invalid_role_id_returns_400(client: TestClient):
    """Requesting an unknown role ID is rejected with 400 Bad Request."""
    cookie = register_and_login(client, "invalid_role@example.com")
    res = client.post(
        "/api/v1/career/roadmaps/generate",
        json={"target_role_id": "ROLE_NON_EXISTENT_999", "horizon_days": 30},
        cookies={"session_id": cookie},
    )
    assert res.status_code == 400
    assert "not a supported benchmark role" in res.json()["detail"].lower()


def test_invalid_horizon_days_returns_422_or_400(client: TestClient):
    """Requesting an invalid horizon (e.g., 45 days) fails schema validation."""
    cookie = register_and_login(client, "invalid_horizon@example.com")
    res = client.post(
        "/api/v1/career/roadmaps/generate",
        json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 45},
        cookies={"session_id": cookie},
    )
    assert res.status_code in (400, 422)


# -----------------------------------------------------------------------------
# 2. Privacy & AI Consent Enforcement Tests
# -----------------------------------------------------------------------------

def test_consent_false_never_calls_ai_provider(client: TestClient, monkeypatch):
    """When consent_ai_processing is false, the AI provider is NEVER called even if key is present."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-test-key-12345")
    cookie = register_and_login(client, "no_consent_user@example.com")

    # Explicitly ensure consent is false in career profile
    client.put(
        "/api/v1/career/profile",
        json={"target_role_title": "Python Developer", "consent_ai_processing": False},
        cookies={"session_id": cookie},
    )

    with patch("app.ai.ai_service.AIService.generate_roadmap") as mock_ai_call:
        res = client.post(
            "/api/v1/career/roadmaps/generate",
            json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 60},
            cookies={"session_id": cookie},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["generation_mode"] == "deterministic"
        assert "consent is disabled" in data["methodology_note"].lower()
        mock_ai_call.assert_not_called()


def test_consent_true_calls_provider_with_minimized_data_only(client: TestClient, monkeypatch):
    """When consent is true, AI provider receives ONLY minimal structured data, never PII or raw resume."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-test-key-12345")
    cookie = register_and_login(client, "consent_user@example.com", name="John Doe")

    # Set profile with consent true and institution details
    client.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Python Developer",
            "institution_name": "Indian Institute of Science",
            "consent_ai_processing": True,
        },
        cookies={"session_id": cookie},
    )

    mock_ai_response = {
        "summary": "AI generated 30-day accelerated backend roadmap.",
        "methodology_note": "Personalized with Gemini 3.8 Flash based on verified requirements.",
        "milestones": [
            {
                "milestone_order": 1,
                "title": "Learn Relational Data Modeling with SQL",
                "description": "Master SQL querying and join optimization.",
                "target_skill_keys": ["sql"],
                "action_type": "learn",
                "suggested_duration_days": 15,
                "prerequisites": [],
                "linked_opportunity_id": "OPP_CRS_SWAYAM_NPTEL_DBMS_EVERGREEN",
            },
            {
                "milestone_order": 2,
                "title": "Build RESTful API Services",
                "description": "Design secure endpoints using Python and FastAPI.",
                "target_skill_keys": ["python", "rest_api"],
                "action_type": "build_project",
                "suggested_duration_days": 15,
                "prerequisites": ["python"],
                "linked_opportunity_id": None,
            },
        ],
    }

    with patch.object(AIService, "generate_roadmap", return_value={
        "summary": mock_ai_response["summary"],
        "methodology_note": mock_ai_response["methodology_note"],
        "generation_mode": "ai_assisted",
        "milestones": mock_ai_response["milestones"],
    }) as mock_service_call:
        res = client.post(
            "/api/v1/career/roadmaps/generate",
            json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 30},
            cookies={"session_id": cookie},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["generation_mode"] == "ai_assisted"
        mock_service_call.assert_called_once()

        # Inspect the keyword arguments passed to generate_roadmap
        call_kwargs = mock_service_call.call_args.kwargs
        role_info = call_kwargs["role_info"]
        gap_summary = call_kwargs["gap_summary"]

        # Assert no candidate name, email, phone, or institution name in passed parameters
        serialized_args = json.dumps(call_kwargs)
        assert "John Doe" not in serialized_args
        assert "consent_user@example.com" not in serialized_args
        assert "Indian Institute of Science" not in serialized_args
        assert "raw_resume_text" not in serialized_args


# -----------------------------------------------------------------------------
# 3. Provider Failure and Safe Fallback Tests
# -----------------------------------------------------------------------------

@pytest.mark.parametrize("error_cls", [
    AITimeoutError("Request timed out", provider="gemini"),
    AIRateLimitError("Quota exceeded 429", provider="gemini"),
    AISchemaValidationError("Malformed JSON output", provider="gemini"),
    AIProviderError("Generic service error", provider="gemini"),
])
def test_ai_provider_failures_fall_back_safely_to_deterministic(client: TestClient, monkeypatch, error_cls):
    """Any AI provider error (timeout, quota, invalid JSON) falls back safely to deterministic roadmap."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    cookie = register_and_login(client, f"fallback_{error_cls.__class__.__name__}@example.com")

    client.put(
        "/api/v1/career/profile",
        json={"target_role_title": "Python Developer", "consent_ai_processing": True},
        cookies={"session_id": cookie},
    )

    with patch("app.ai.gemini_provider.GeminiProvider.generate_structured_content", side_effect=error_cls):
        res = client.post(
            "/api/v1/career/roadmaps/generate",
            json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 30},
            cookies={"session_id": cookie},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["generation_mode"] == "deterministic"
        assert "fallback" in data["methodology_note"].lower()
        assert len(data["milestones"]) > 0


def test_ai_unverified_opportunity_reference_is_stripped_or_fallback(client: TestClient, monkeypatch):
    """If AI generates a non-existent or unverified opportunity ID, AIService strips the invalid reference."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    ai_service = AIService()

    # Create dummy role and gap data
    role = {
        "role_id": "ROLE_PY_BACKEND",
        "title": "Python / Backend Developer",
        "required_skills": [{"skill_key": "python"}, {"skill_key": "sql"}],
        "preferred_skills": [],
    }
    gap = {"missing_required": ["sql"], "unconfirmed_or_claimed_required": [], "evidenced": [], "missing_preferred": []}

    # Verified catalogue containing only OPP_CRS_SWAYAM_NPTEL_DBMS_EVERGREEN
    verified = [
        {"id": "OPP_CRS_SWAYAM_NPTEL_DBMS_EVERGREEN", "title": "DBMS", "opportunity_type": "course", "skill_keys": ["sql"]}
    ]

    mock_llm_output = {
        "summary": "Plan summary",
        "methodology_note": "AI plan",
        "milestones": [
            {
                "milestone_order": 1,
                "title": "Learn SQL",
                "description": "SQL learning",
                "target_skill_keys": ["sql"],
                "action_type": "learn",
                "suggested_duration_days": 15,
                "prerequisites": [],
                # Injected invented opportunity ID!
                "linked_opportunity_id": "OPP_INVENTED_FAKE_COURSE_999",
            }
        ]
    }

    with patch.object(ai_service.provider, "generate_structured_content", return_value=mock_llm_output):
        res = ai_service.generate_roadmap(
            role_info=role,
            gap_summary=gap,
            horizon_days=30,
            weekly_hours=10,
            verified_opportunities=verified,
            allowed_skill_keys=["sql", "python"],
        )
        assert res is not None
        # The fake ID must have been stripped to None
        assert res["milestones"][0]["linked_opportunity_id"] is None


def test_closed_or_unconfirmed_opportunities_never_in_deterministic_roadmap(client: TestClient):
    """Closed exam run (OPP_CRS_SWAYAM_NPTEL_DBMS) and unconfirmed listings are never linked."""
    cookie = register_and_login(client, "catalogue_safety@example.com")
    res = client.post(
        "/api/v1/career/roadmaps/generate",
        json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 90},
        cookies={"session_id": cookie},
    )
    assert res.status_code == 201
    data = res.json()

    linked_ids = [m["linked_opportunity_id"] for m in data["milestones"] if m["linked_opportunity_id"]]
    # Must NOT contain concluded exam run
    assert "OPP_CRS_SWAYAM_NPTEL_DBMS" not in linked_ids
    # Must NOT contain unconfirmed frontend course
    assert "OPP_CRS_SIDH_FRONTEND_REACT" not in linked_ids
    # Must NOT contain unconfirmed NAPS trade standard
    assert "OPP_APP_NAPS_ELECTRONICS_TEST" not in linked_ids


# -----------------------------------------------------------------------------
# 4. User Ownership and Non-Disclosing 404 Tests
# -----------------------------------------------------------------------------

def test_user_ownership_and_milestone_completion():
    """Tests list, detail, milestone toggle, and delete operations with multi-user isolation."""
    client_a = TestClient(app)
    client_b = TestClient(app)

    # User A creates a roadmap
    register_and_login(client_a, "user_a@example.com")
    create_res = client_a.post(
        "/api/v1/career/roadmaps/generate",
        json={"target_role_id": "ROLE_FRONTEND_DEV", "horizon_days": 30},
    )
    assert create_res.status_code == 201
    roadmap_a = create_res.json()
    roadmap_a_id = roadmap_a["id"]
    milestone_a_1 = roadmap_a["milestones"][0]
    milestone_a_1_id = milestone_a_1["id"]

    # User B registers
    register_and_login(client_b, "user_b@example.com")

    # 1. User B lists roadmaps -> empty
    list_b = client_b.get("/api/v1/career/roadmaps")
    assert list_b.status_code == 200
    assert list_b.json()["count"] == 0

    # 2. User B tries to view User A's roadmap -> 404 non-disclosing
    detail_b = client_b.get(f"/api/v1/career/roadmaps/{roadmap_a_id}")
    assert detail_b.status_code == 404
    assert detail_b.json()["detail"] == "Career roadmap not found."

    # 3. User B tries to toggle milestone in User A's roadmap -> 404 non-disclosing
    patch_b = client_b.patch(
        f"/api/v1/career/roadmaps/{roadmap_a_id}/milestones/{milestone_a_1_id}",
        json={"is_completed": True},
    )
    assert patch_b.status_code == 404
    assert patch_b.json()["detail"] == "Roadmap milestone not found."

    # Verify milestone in User A's roadmap remained incomplete
    detail_a_before = client_a.get(f"/api/v1/career/roadmaps/{roadmap_a_id}").json()
    assert detail_a_before["milestones"][0]["is_completed"] is False
    assert detail_a_before["progress_percentage"] == 0.0

    # 4. User A toggles milestone to completed -> 200 OK
    patch_a = client_a.patch(
        f"/api/v1/career/roadmaps/{roadmap_a_id}/milestones/{milestone_a_1_id}",
        json={"is_completed": True},
    )
    assert patch_a.status_code == 200
    updated_m = patch_a.json()["milestone"]
    assert updated_m["is_completed"] is True
    assert updated_m["completed_at"] is not None

    # Check progress percentage updated on roadmap detail
    detail_a_after = client_a.get(f"/api/v1/career/roadmaps/{roadmap_a_id}").json()
    assert detail_a_after["completed_milestones"] == 1
    assert detail_a_after["progress_percentage"] > 0.0

    # 5. User B tries to delete User A's roadmap -> 404 non-disclosing
    del_b = client_b.delete(f"/api/v1/career/roadmaps/{roadmap_a_id}")
    assert del_b.status_code == 404

    # 6. User A deletes their roadmap -> 200 OK
    del_a = client_a.delete(f"/api/v1/career/roadmaps/{roadmap_a_id}")
    assert del_a.status_code == 200

    # Re-reading after deletion returns 404
    assert client_a.get(f"/api/v1/career/roadmaps/{roadmap_a_id}").status_code == 404


def test_unauthenticated_requests_return_401(client: TestClient):
    """Unauthenticated requests to roadmap endpoints are rejected with 401 Unauthorized."""
    assert client.get("/api/v1/career/roadmaps").status_code == 401
    assert client.post("/api/v1/career/roadmaps/generate", json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 30}).status_code == 401
    assert client.get("/api/v1/career/roadmaps/1").status_code == 401
    assert client.delete("/api/v1/career/roadmaps/1").status_code == 401
    assert client.patch("/api/v1/career/roadmaps/1/milestones/1", json={"is_completed": True}).status_code == 401


# -----------------------------------------------------------------------------
# 5. Complete 10-Step End-to-End Integration Audit Flow
# -----------------------------------------------------------------------------

def test_complete_10_step_integration_audit(tmp_path, monkeypatch):
    """Audits the full user lifecycle: profile setup, skills, consent, safe fallback, and isolation."""
    test_db = str(tmp_path / "audit_test.db")
    monkeypatch.setenv("SKILLPULSE_DB_PATH", test_db)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    init_db(test_db)

    client_a = TestClient(app)
    client_b = TestClient(app)

    # 1. Register User A
    reg_a = client_a.post(
        "/api/v1/auth/register",
        json={
            "email": "auditor_a@skillpulse.org",
            "full_name": "Auditor Alpha",
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    assert reg_a.status_code == 201

    # 2. Set supported role
    prof_res = client_a.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Python / Backend Developer",
            "target_occupation_id": None,
            "consent_ai_processing": False,
        },
    )
    assert prof_res.status_code == 200

    # 3. Add synthetic skills with distinct evidence statuses
    s1 = client_a.post(
        "/api/v1/career/skills",
        json={
            "skill_name": "Python",
            "category": "technical",
            "evidence_status": "evidenced",
            "source_context": "FastAPI microservices",
        },
    )
    s2 = client_a.post(
        "/api/v1/career/skills",
        json={
            "skill_name": "SQL",
            "category": "technical",
            "evidence_status": "claimed",
        },
    )
    s3 = client_a.post(
        "/api/v1/career/skills",
        json={
            "skill_name": "Docker",
            "category": "tool",
            "evidence_status": "unconfirmed",
        },
    )
    assert s1.status_code == 201
    assert s2.status_code == 201
    assert s3.status_code == 201

    # 4. Generate 30-day roadmap with AI consent disabled
    rm_res = client_a.post(
        "/api/v1/career/roadmaps/generate",
        json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 30},
    )
    assert rm_res.status_code == 201
    rm_data = rm_res.json()
    assert rm_data["generation_mode"] == "deterministic"
    assert "consent is disabled" in rm_data["methodology_note"].lower()
    roadmap_a_id = rm_data["id"]

    # 5. Enable AI consent
    prof_res2 = client_a.put(
        "/api/v1/career/profile",
        json={"consent_ai_processing": True},
    )
    assert prof_res2.status_code == 200

    # 6. Generate roadmap again without API key (offline safe fallback)
    rm_res2 = client_a.post(
        "/api/v1/career/roadmaps/generate",
        json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 30},
    )
    assert rm_res2.status_code == 201
    rm_data2 = rm_res2.json()
    assert rm_data2["generation_mode"] == "deterministic"
    assert "gemini api key is not configured" in rm_data2["methodology_note"].lower()

    # 7 & 8. Check milestones and catalogue verification rules
    assert len(rm_data["milestones"]) > 0
    for m in rm_data["milestones"]:
        opp_id = m.get("linked_opportunity_id")
        if opp_id:
            assert opp_id != "OPP_CRS_SWAYAM_NPTEL_DBMS", "Closed exam cycle was linked!"
            assert opp_id != "OPP_CRS_SIDH_FRONTEND_REACT", "Unconfirmed SIDH course was linked!"
            assert opp_id != "OPP_APP_NAPS_ELECTRONICS_TEST", "Unconfirmed NAPS was linked!"

    # 9. Reopen and toggle milestone
    m1_id = rm_data["milestones"][0]["id"]
    patch_res = client_a.patch(
        f"/api/v1/career/roadmaps/{roadmap_a_id}/milestones/{m1_id}",
        json={"is_completed": True},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["milestone"]["is_completed"] is True
    reopen_res = client_a.get(f"/api/v1/career/roadmaps/{roadmap_a_id}")
    assert reopen_res.status_code == 200
    assert reopen_res.json()["completed_milestones"] == 1
    assert reopen_res.json()["progress_percentage"] > 0

    # 10. User B isolation check
    reg_b = client_b.post(
        "/api/v1/auth/register",
        json={
            "email": "auditor_b@skillpulse.org",
            "full_name": "Auditor Beta",
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    assert reg_b.status_code == 201
    b_get = client_b.get(f"/api/v1/career/roadmaps/{roadmap_a_id}")
    assert b_get.status_code == 404
    b_patch = client_b.patch(
        f"/api/v1/career/roadmaps/{roadmap_a_id}/milestones/{m1_id}",
        json={"is_completed": False},
    )
    assert b_patch.status_code == 404
    b_del = client_b.delete(f"/api/v1/career/roadmaps/{roadmap_a_id}")
    assert b_del.status_code == 404


# -----------------------------------------------------------------------------
# 6. Latency Hardening, Timeout Bounding & 503 Retry Tests
# -----------------------------------------------------------------------------

def test_get_bounded_timeout_ms(monkeypatch):
    """Verifies that timeout configuration is read consistently and bounded between 5s and 30s."""
    from app.ai.gemini_provider import (
        get_bounded_timeout_ms,
        DEFAULT_AI_TIMEOUT_MS,
        MIN_AI_TIMEOUT_MS,
        MAX_AI_TIMEOUT_MS,
    )

    # 1. Default when unset
    monkeypatch.delenv("AI_TIMEOUT_MS", raising=False)
    assert get_bounded_timeout_ms() == DEFAULT_AI_TIMEOUT_MS

    # 2. Within bounds
    monkeypatch.setenv("AI_TIMEOUT_MS", "15000")
    assert get_bounded_timeout_ms() == 15000

    # 3. Below minimum clamp
    monkeypatch.setenv("AI_TIMEOUT_MS", "1000")
    assert get_bounded_timeout_ms() == MIN_AI_TIMEOUT_MS

    # 4. Above maximum clamp
    monkeypatch.setenv("AI_TIMEOUT_MS", "60000")
    assert get_bounded_timeout_ms() == MAX_AI_TIMEOUT_MS

    # 5. Invalid string falls back to default
    monkeypatch.setenv("AI_TIMEOUT_MS", "invalid_number")
    assert get_bounded_timeout_ms() == DEFAULT_AI_TIMEOUT_MS

    # 6. Explicit override parameter
    assert get_bounded_timeout_ms(override_ms=25000) == 25000
    assert get_bounded_timeout_ms(override_ms=500) == MIN_AI_TIMEOUT_MS
    assert get_bounded_timeout_ms(override_ms=90000) == MAX_AI_TIMEOUT_MS


def test_gemini_provider_thinking_config_and_token_bounds(monkeypatch):
    """Verifies that GenerateContentConfig configures lower thinking budget and max token limits."""
    from app.ai.gemini_provider import GeminiProvider

    provider = GeminiProvider(api_key="fake-test-key")

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = {
        "summary": "Mock summary",
        "methodology_note": "Mock note",
        "milestones": [],
    }
    mock_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client):
        result = provider.generate_structured_content(
            system_instruction="System",
            user_prompt="Prompt",
            response_schema=dict,
            timeout_ms=10000,
        )
        assert result["summary"] == "Mock summary"

        # Check the GenerateContentConfig passed to generate_content
        call_kwargs = mock_client.models.generate_content.call_args.kwargs
        config = call_kwargs["config"]
        assert config.max_output_tokens == 3072
        assert config.response_mime_type == "application/json"
        assert config.thinking_config is not None
        assert config.thinking_config.thinking_budget == 0
        assert config.thinking_config.include_thoughts is False


def test_gemini_provider_transient_503_retry_succeeds_on_attempt_2(monkeypatch):
    """Verifies that a transient 503 triggers at most one retry and succeeds if the second attempt passes."""
    from app.ai.gemini_provider import GeminiProvider
    from google.genai.errors import APIError

    provider = GeminiProvider(api_key="fake-test-key")

    mock_client = MagicMock()
    err_503 = APIError(503, "This model is currently experiencing high demand.")
    mock_success = MagicMock()
    mock_success.parsed = {
        "summary": "Recovered plan",
        "methodology_note": "AI note",
        "milestones": [],
    }
    mock_client.models.generate_content.side_effect = [err_503, mock_success]

    with patch("google.genai.Client", return_value=mock_client), patch("time.sleep") as mock_sleep:
        res = provider.generate_structured_content(
            system_instruction="System",
            user_prompt="Prompt",
            response_schema=dict,
            timeout_ms=25000,
        )
        assert res["summary"] == "Recovered plan"
        assert mock_client.models.generate_content.call_count == 2
        mock_sleep.assert_called_once_with(1.5)


def test_gemini_provider_transient_503_fails_after_single_retry(monkeypatch):
    """Verifies that if both attempt 1 and attempt 2 return 503, exactly one retry is attempted and AIProviderError is raised."""
    from app.ai.gemini_provider import GeminiProvider
    from google.genai.errors import APIError

    provider = GeminiProvider(api_key="fake-test-key")

    mock_client = MagicMock()
    err_503 = APIError(503, "High demand unavailable")
    mock_client.models.generate_content.side_effect = [err_503, err_503]

    with patch("google.genai.Client", return_value=mock_client), patch("time.sleep"):
        with pytest.raises(AIProviderError):
            provider.generate_structured_content(
                system_instruction="System",
                user_prompt="Prompt",
                response_schema=dict,
                timeout_ms=25000,
            )
        assert mock_client.models.generate_content.call_count == 2


def test_gemini_provider_permanent_errors_never_retried(monkeypatch):
    """Permanent errors (e.g., 400 Bad Request, 429 Rate Limit) are never retried."""
    from app.ai.gemini_provider import GeminiProvider
    from google.genai.errors import APIError

    provider = GeminiProvider(api_key="fake-test-key")

    # 400 Client error
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = APIError(400, "Invalid argument")
    with patch("google.genai.Client", return_value=mock_client), patch("time.sleep") as mock_sleep:
        with pytest.raises(AIProviderError):
            provider.generate_structured_content("Sys", "Prompt", dict)
        assert mock_client.models.generate_content.call_count == 1
        mock_sleep.assert_not_called()

    # 429 Rate limit error
    mock_client_429 = MagicMock()
    mock_client_429.models.generate_content.side_effect = APIError(429, "Quota exceeded")
    with patch("google.genai.Client", return_value=mock_client_429), patch("time.sleep") as mock_sleep:
        with pytest.raises(AIRateLimitError):
            provider.generate_structured_content("Sys", "Prompt", dict)
        assert mock_client_429.models.generate_content.call_count == 1
        mock_sleep.assert_not_called()

