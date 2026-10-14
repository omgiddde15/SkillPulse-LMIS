"""Comprehensive unit and integration test suite for SkillPulse Phase 5:
Career Copilot and Application Tracker.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Verifies:
1. Application Tracker CRUD with curated catalogue linking and external manual applications.
2. Stage transitions and strict stage validation.
3. Query filtering by application stage.
4. Non-disclosing 404 multi-tenant isolation for tracked applications.
5. Copilot conversation lifecycle (creation, listing, detail, message dispatch, deletion).
6. Deterministic Copilot fallback when AI consent is disabled (zero external provider calls).
7. AI-assisted Copilot path when consent is granted (structured schema validation).
8. Resilient deterministic fallback upon AI provider exceptions or timeouts.
9. Exclusion of closed, stale, or unconfirmed catalogue opportunities from guidance context.
10. Multi-tenant conversation isolation (User B cannot access or post to User A's thread).
11. Message payload bounds and empty message validation.
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from app.main import app
from app.db import init_db, get_db
from app.schemas.career_models import AICopilotOutput, CopilotSourceRef
from app.ai.base import AIProviderError, AITimeoutError


@pytest.fixture(autouse=True)
def setup_isolated_db(tmp_path, monkeypatch):
    """Isolates SQLite database and temporary storage for every test."""
    test_db = str(tmp_path / "test_phase5.db")
    upload_dir = str(tmp_path / "uploads")
    monkeypatch.setenv("SKILLPULSE_DB_PATH", test_db)
    monkeypatch.setenv("SKILLPULSE_UPLOAD_DIR", upload_dir)
    init_db(test_db)
    return test_db


def register_user(client: TestClient, email: str, name: str = "Test Candidate"):
    """Helper to register and login a test user on the provided client."""
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


# =============================================================================
# PART 1: Application Tracker Tests
# =============================================================================

def test_tracker_crud_lifecycle_catalogue_opportunity():
    """User tracks an official catalogue opportunity, updates its stage, and deletes it."""
    client = TestClient(app)
    register_user(client, "candidate_track1@example.com")

    # 1. Track catalogue opportunity: Generative AI (SmartBridge via SWAYAM Plus)
    create_res = client.post(
        "/api/v1/career/tracker",
        json={
            "opportunity_id": "OPP_CRS_SWAYAMPLUS_GENAI_SMARTBRIDGE",
            "stage": "saved",
            "notes": "Plan to take this to bridge Python gap.",
        },
    )
    assert create_res.status_code == 201
    item = create_res.json()
    tracker_id = item["id"]
    assert item["opportunity_id"] == "OPP_CRS_SWAYAMPLUS_GENAI_SMARTBRIDGE"
    assert item["stage"] == "saved"
    assert item["linked_opportunity"] is not None
    assert "Generative AI" in item["linked_opportunity"]["title"]
    assert "SmartBridge" in item["linked_opportunity"]["provider_name"]

    # 2. List tracked opportunities
    list_res = client.get("/api/v1/career/tracker")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["count"] == 1
    assert list_data["items"][0]["id"] == tracker_id

    # 3. Retrieve single item
    get_res = client.get(f"/api/v1/career/tracker/{tracker_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == tracker_id

    # 4. Update stage to 'applied' with date
    update_res = client.put(
        f"/api/v1/career/tracker/{tracker_id}",
        json={
            "stage": "applied",
            "date_applied": "2026-10-14",
            "notes": "Enrolled in course window.",
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["stage"] == "applied"
    assert updated["date_applied"] == "2026-10-14"
    assert updated["notes"] == "Enrolled in course window."

    # 5. Delete tracked item
    del_res = client.delete(f"/api/v1/career/tracker/{tracker_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Confirm deleted item returns 404
    get_after_del = client.get(f"/api/v1/career/tracker/{tracker_id}")
    assert get_after_del.status_code == 404


def test_tracker_manual_external_opportunity():
    """User can track a manual external application with custom title and organization."""
    client = TestClient(app)
    register_user(client, "candidate_track2@example.com")

    res = client.post(
        "/api/v1/career/tracker",
        json={
            "custom_title": "Associate Backend Engineer",
            "custom_organization": "Tata Consultancy Services",
            "stage": "interview",
            "date_applied": "2026-10-01",
            "notes": "Technical screening cleared, scheduled for system design round.",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["opportunity_id"] is None
    assert data["custom_title"] == "Associate Backend Engineer"
    assert data["custom_organization"] == "Tata Consultancy Services"
    assert data["stage"] == "interview"
    assert data["linked_opportunity"] is None


def test_tracker_stage_validation_and_bad_requests():
    """Rejects invalid stages and missing identifiers."""
    client = TestClient(app)
    register_user(client, "candidate_track3@example.com")

    # Invalid stage on create
    bad_stage = client.post(
        "/api/v1/career/tracker",
        json={
            "custom_title": "Software Developer",
            "stage": "flying_to_the_moon",
        },
    )
    assert bad_stage.status_code in (400, 422)

    # Missing both opportunity_id and custom_title
    missing_title = client.post(
        "/api/v1/career/tracker",
        json={"stage": "saved"},
    )
    assert missing_title.status_code in (400, 422)

    # Non-existent catalogue opportunity
    bogus_opp = client.post(
        "/api/v1/career/tracker",
        json={
            "opportunity_id": "OPP_NON_EXISTENT_BOGUS_12345",
            "stage": "saved",
        },
    )
    assert bogus_opp.status_code == 400
    assert "does not exist in the official catalogue" in bogus_opp.json()["detail"]


def test_tracker_stage_query_filtering():
    """Filtering by stage returns only records matching the requested stage."""
    client = TestClient(app)
    register_user(client, "candidate_track4@example.com")

    # Add 1 saved, 2 applied, 1 offer
    client.post("/api/v1/career/tracker", json={"custom_title": "Role 1", "stage": "saved"})
    client.post("/api/v1/career/tracker", json={"custom_title": "Role 2", "stage": "applied"})
    client.post("/api/v1/career/tracker", json={"custom_title": "Role 3", "stage": "applied"})
    client.post("/api/v1/career/tracker", json={"custom_title": "Role 4", "stage": "offer"})

    # Query all
    all_res = client.get("/api/v1/career/tracker")
    assert all_res.json()["count"] == 4

    # Query applied only
    applied_res = client.get("/api/v1/career/tracker?stage=applied")
    assert applied_res.json()["count"] == 2
    for item in applied_res.json()["items"]:
        assert item["stage"] == "applied"

    # Query offer only
    offer_res = client.get("/api/v1/career/tracker?stage=offer")
    assert offer_res.json()["count"] == 1
    assert offer_res.json()["items"][0]["stage"] == "offer"


def test_tracker_multi_tenant_isolation():
    """User B cannot access, modify, or delete User A's tracked applications."""
    client_a = TestClient(app)
    client_b = TestClient(app)

    register_user(client_a, "candidate_a_track@example.com")
    register_user(client_b, "candidate_b_track@example.com")

    # User A creates a tracked application
    item_a = client_a.post(
        "/api/v1/career/tracker",
        json={"custom_title": "User A Private Opportunity", "stage": "saved"},
    ).json()
    tracker_id = item_a["id"]

    # User B list should be empty
    list_b = client_b.get("/api/v1/career/tracker").json()
    assert list_b["count"] == 0

    # User B GET item A -> 404
    get_b = client_b.get(f"/api/v1/career/tracker/{tracker_id}")
    assert get_b.status_code == 404

    # User B PUT item A -> 404
    put_b = client_b.put(
        f"/api/v1/career/tracker/{tracker_id}",
        json={"stage": "offer"},
    )
    assert put_b.status_code == 404

    # User B DELETE item A -> 404
    del_b = client_b.delete(f"/api/v1/career/tracker/{tracker_id}")
    assert del_b.status_code == 404

    # Verify item A is untouched for User A
    get_a = client_a.get(f"/api/v1/career/tracker/{tracker_id}")
    assert get_a.status_code == 200
    assert get_a.json()["stage"] == "saved"


# =============================================================================
# PART 2: Career Copilot Tests
# =============================================================================

def test_copilot_conversation_thread_lifecycle():
    """Full lifecycle: create thread, verify welcome message, list, get detail, and delete."""
    client = TestClient(app)
    register_user(client, "candidate_copilot1@example.com")

    # 1. Create conversation thread
    create_res = client.post(
        "/api/v1/career/copilot/conversations",
        json={"title": "Target Role Advisory"},
    )
    assert create_res.status_code == 201
    conv = create_res.json()
    conv_id = conv["id"]
    assert conv["title"] == "Target Role Advisory"
    assert len(conv["messages"]) == 1
    assert conv["messages"][0]["sender"] == "assistant"
    assert "Career Copilot" in conv["messages"][0]["content"]

    # 2. List conversations
    list_res = client.get("/api/v1/career/copilot/conversations")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["count"] == 1
    assert list_data["conversations"][0]["id"] == conv_id
    assert list_data["conversations"][0]["message_count"] == 1

    # 3. Retrieve conversation detail
    detail_res = client.get(f"/api/v1/career/copilot/conversations/{conv_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == conv_id

    # 4. Delete conversation
    del_res = client.delete(f"/api/v1/career/copilot/conversations/{conv_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Confirm 404 after deletion
    get_after_del = client.get(f"/api/v1/career/copilot/conversations/{conv_id}")
    assert get_after_del.status_code == 404


def test_copilot_deterministic_mode_when_consent_disabled():
    """When consent_ai_processing is False, Copilot uses deterministic rules engine with zero AI provider calls."""
    client = TestClient(app)
    register_user(client, "candidate_copilot_determ@example.com")

    # Set up career profile with consent_ai_processing = False and target role Python Backend
    client.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Python Developer",
            "target_occupation_id": "OCC_DEV_PY_01",
            "consent_ai_processing": False,
        },
    )

    # Add evidenced skill Python (category: technical)
    res_py = client.post(
        "/api/v1/career/skills",
        json={"skill_name": "Python", "category": "technical", "evidence_status": "evidenced"},
    )
    assert res_py.status_code == 201

    # Create conversation
    conv = client.post(
        "/api/v1/career/copilot/conversations",
        json={"title": "Skill Gap Check"},
    ).json()
    conv_id = conv["id"]

    # Send message with mocked AI provider to verify zero calls
    with patch("app.ai.gemini_provider.GeminiProvider.generate_structured_content") as mock_gemini:
        msg_res = client.post(
            f"/api/v1/career/copilot/conversations/{conv_id}/messages",
            json={"content": "What are my missing skills for Python / Backend Developer?"},
        )
        assert msg_res.status_code == 201
        data = msg_res.json()

        # Zero AI provider calls made
        assert mock_gemini.call_count == 0

        # Response metadata and content
        assert data["sender"] == "assistant"
        assert data["generation_mode"] == "deterministic"
        assert "External AI consent is disabled" in data["content"]
        assert "Python / Backend Developer" in data["content"]
        assert "missing required competencies" in data["content"].lower()
        assert "No claimed-but-unverified skills are currently recorded in your profile." in data["content"]
        assert "include: None." not in data["content"]

        # Sources include grounded benchmark or gap references
        assert len(data["sources"]) > 0


def test_copilot_deterministic_mode_with_claimed_skills():
    """Verify deterministic guidance properly notes claimed skills when present."""
    client = TestClient(app)
    register_user(client, "candidate_copilot_claimed@example.com")

    # Set up career profile with consent_ai_processing = False
    client.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Python Developer",
            "target_occupation_id": "OCC_DEV_PY_01",
            "consent_ai_processing": False,
        },
    )

    # Add evidenced skill Python, claimed skill FastAPI (which is a required benchmark skill for Python backend)
    res1 = client.post(
        "/api/v1/career/skills",
        json={"skill_name": "Python", "category": "technical", "evidence_status": "evidenced"},
    )
    assert res1.status_code == 201
    res2 = client.post(
        "/api/v1/career/skills",
        json={"skill_name": "FastAPI", "category": "technical", "evidence_status": "claimed"},
    )
    assert res2.status_code == 201

    # Create conversation
    conv = client.post(
        "/api/v1/career/copilot/conversations",
        json={"title": "Claimed Skills Check"},
    ).json()
    conv_id = conv["id"]

    msg_res = client.post(
        f"/api/v1/career/copilot/conversations/{conv_id}/messages",
        json={"content": "What are my missing skills for Python / Backend Developer?"},
    )
    assert msg_res.status_code == 201
    data = msg_res.json()

    assert data["generation_mode"] == "deterministic"
    assert "Skills you have claimed but not yet verified with evidence include:" in data["content"]
    assert "FastAPI" in data["content"]


def test_copilot_ai_assisted_mode_when_consent_enabled():
    """When consent_ai_processing is True, Copilot dispatches to AI provider and validates structured output."""
    client = TestClient(app)
    register_user(client, "candidate_copilot_ai@example.com")

    # Enable AI consent in career profile
    client.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Python Developer",
            "target_occupation_id": "OCC_DEV_PY_01",
            "consent_ai_processing": True,
        },
    )

    # Create conversation
    conv = client.post(
        "/api/v1/career/copilot/conversations",
        json={"title": "Career Acceleration"},
    ).json()
    conv_id = conv["id"]

    mock_ai_output = {
        "answer": "Based on your verified skills and benchmark gap analysis for Python Backend Developer, your highest priority is mastering PostgreSQL and FastAPI.",
        "sources": [
            {
                "kind": "opportunity",
                "id": "OPP_CRS_SWAYAMPLUS_GENAI_SMARTBRIDGE",
                "title": "Generative AI (SmartBridge via SWAYAM Plus)",
                "url": "https://swayamplus.education.gov.in/courses/generative-ai",
                "verification_status": "verified_official",
            }
        ],
        "suggested_followups": [
            "How do I complete the FastAPI milestone?",
            "What projects can I build to demonstrate PostgreSQL?",
        ],
    }

    with patch("app.ai.ai_service.AIService.generate_copilot_response", return_value={
        "answer": mock_ai_output["answer"],
        "sources": mock_ai_output["sources"],
        "suggested_followups": mock_ai_output["suggested_followups"],
        "generation_mode": "ai_assisted",
    }) as mock_service:
        msg_res = client.post(
            f"/api/v1/career/copilot/conversations/{conv_id}/messages",
            json={"content": "What skills should I prioritize next?"},
        )
        assert msg_res.status_code == 201
        data = msg_res.json()

        assert mock_service.call_count == 1
        assert data["sender"] == "assistant"
        assert data["generation_mode"] == "ai_assisted"
        assert "PostgreSQL and FastAPI" in data["content"]
        assert len(data["sources"]) == 1
        assert data["sources"][0]["id"] == "OPP_CRS_SWAYAMPLUS_GENAI_SMARTBRIDGE"


def test_copilot_resilient_fallback_on_ai_exception():
    """When AI provider times out or raises an error, Copilot seamlessly falls back to deterministic guidance."""
    client = TestClient(app)
    register_user(client, "candidate_copilot_fail@example.com")

    client.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Python Developer",
            "target_occupation_id": "OCC_DEV_PY_01",
            "consent_ai_processing": True,
        },
    )

    conv = client.post(
        "/api/v1/career/copilot/conversations",
        json={"title": "Fallback Test"},
    ).json()
    conv_id = conv["id"]

    with patch("app.ai.ai_service.AIService.generate_copilot_response", side_effect=AITimeoutError("Request timed out")):
        msg_res = client.post(
            f"/api/v1/career/copilot/conversations/{conv_id}/messages",
            json={"content": "Give me career advice."},
        )
        assert msg_res.status_code == 201
        data = msg_res.json()

        # Deterministic fallback engaged
        assert data["sender"] == "assistant"
        assert data["generation_mode"] == "deterministic"
        assert "temporarily unavailable" in data["content"]
        assert "deterministic rules engine" in data["content"]


def test_copilot_grounding_excludes_closed_or_unconfirmed_opportunities():
    """Copilot context assembly excludes closed or unconfirmed listings."""
    from app.services.copilot_service import CopilotService

    copilot_svc = CopilotService()
    client = TestClient(app)
    register_user(client, "candidate_grounding@example.com")

    # Get user id from db
    with get_db() as conn:
        user_row = conn.execute("SELECT id FROM users WHERE email = 'candidate_grounding@example.com'").fetchone()
        user_id = user_row["id"]

    context = copilot_svc.assemble_context(user_id)
    active_opps = context.get("verified_active_opportunities", [])

    # Closed or unconfirmed listings must NOT be in active opportunities
    opp_ids = [o["id"] for o in active_opps]
    assert "OPP_CRS_SWAYAM_NPTEL_DBMS" not in opp_ids  # Closed window
    assert "OPP_CRS_SIDH_FRONTEND_REACT" not in opp_ids  # Stale
    assert "OPP_APP_NAPS_ELECTRONICS_TEST" not in opp_ids  # Unconfirmed


def test_copilot_multi_tenant_isolation():
    """User B cannot access, read, send messages to, or delete User A's Copilot conversation."""
    client_a = TestClient(app)
    client_b = TestClient(app)

    register_user(client_a, "candidate_a_copilot@example.com")
    register_user(client_b, "candidate_b_copilot@example.com")

    # User A creates a conversation
    conv_a = client_a.post(
        "/api/v1/career/copilot/conversations",
        json={"title": "Confidential User A Discussion"},
    ).json()
    conv_id = conv_a["id"]

    # User B list should not show User A's conversation
    list_b = client_b.get("/api/v1/career/copilot/conversations").json()
    assert list_b["count"] == 0

    # User B GET conversation -> 404
    get_b = client_b.get(f"/api/v1/career/copilot/conversations/{conv_id}")
    assert get_b.status_code == 404

    # User B POST message to conversation -> 404
    post_b = client_b.post(
        f"/api/v1/career/copilot/conversations/{conv_id}/messages",
        json={"content": "Intruding question"},
    )
    assert post_b.status_code == 404

    # User B DELETE conversation -> 404
    del_b = client_b.delete(f"/api/v1/career/copilot/conversations/{conv_id}")
    assert del_b.status_code == 404


def test_copilot_message_validation():
    """Validates message length bounds and empty message rejections."""
    client = TestClient(app)
    register_user(client, "candidate_val@example.com")

    conv = client.post(
        "/api/v1/career/copilot/conversations",
        json={"title": "Validation Thread"},
    ).json()
    conv_id = conv["id"]

    # Empty message
    empty_res = client.post(
        f"/api/v1/career/copilot/conversations/{conv_id}/messages",
        json={"content": "   "},
    )
    assert empty_res.status_code in (400, 422)

    # Exceedingly long message (> 1000 characters)
    long_res = client.post(
        f"/api/v1/career/copilot/conversations/{conv_id}/messages",
        json={"content": "A" * 1050},
    )
    assert long_res.status_code in (400, 422)
