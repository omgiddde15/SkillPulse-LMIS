"""End-to-End Connected User Journey Integration Tests for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Validates the full connected candidate lifecycle across all integrated modules:
1. Career Profile and Target-Role Selection
2. Persisted Skill Evidence and Skill-Gap Analysis
3. Career Roadmap Generation, Saved-Roadmap Selection, and Milestone Progress Persistence
4. Career Copilot Responses Grounded in Actual Skill Gaps and Active Roadmap
5. Tracking a Catalogue Opportunity and Preserving Provenance and Status
6. Multi-Tenant Isolation, Ownership Enforcement, and Consent Controls
"""

from __future__ import annotations

import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.db import init_db


@pytest.fixture(autouse=True)
def setup_isolated_db(tmp_path, monkeypatch):
    """Isolates SQLite database and temporary storage for every test."""
    test_db = str(tmp_path / "test_e2e_journey.db")
    upload_dir = str(tmp_path / "uploads")
    monkeypatch.setenv("SKILLPULSE_DB_PATH", test_db)
    monkeypatch.setenv("SKILLPULSE_UPLOAD_DIR", upload_dir)
    init_db(test_db)
    return test_db


def register_and_login(client: TestClient, email: str, name: str = "Test Candidate") -> dict:
    """Helper to register and establish authenticated session."""
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": name,
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    assert reg.status_code == 201
    return reg.json()


def test_e2e_connected_candidate_journey_complete():
    """Validates the seamless end-to-end user journey across profile, gaps, roadmap, copilot, and tracker."""
    client = TestClient(app)
    user_email = "e2e_connected_candidate@example.com"
    user_data = register_and_login(client, user_email, name="Aarav Sharma")
    user_id = user_data["user"]["id"]

    # =========================================================================
    # STEP 1: Career Profile and Target-Role Selection
    # =========================================================================
    profile_payload = {
        "target_role_title": "Python / Backend Developer",
        "target_occupation_id": "OCC_DEV_PY_01",
        "target_sector": "IT/ITeS",
        "current_education_level": "B.Tech Computer Science",
        "institution_name": "National Institute of Technology Karnataka",
        "graduation_year": 2025,
        "years_experience": 1.0,
        "current_state": "KA",
        "current_district": "KA_BLR_U",
        "preferred_locations": ["KA_BLR_U", "TS_HYD"],
        "consent_ai_processing": False,
    }
    prof_res = client.put("/api/v1/career/profile", json=profile_payload)
    assert prof_res.status_code == 200
    prof = prof_res.json()["profile"]
    assert prof["target_role_title"] == "Python / Backend Developer"
    assert prof["target_occupation_id"] == "OCC_DEV_PY_01"
    assert prof["consent_ai_processing"] is False

    # Verify profile retrieval
    get_prof = client.get("/api/v1/career/profile")
    assert get_prof.status_code == 200
    assert get_prof.json()["profile"]["target_role_title"] == "Python / Backend Developer"

    # Verify target role is verified in the catalogue
    role_res = client.get("/api/v1/career/roles/ROLE_PY_BACKEND")
    assert role_res.status_code == 200
    role_meta = role_res.json()["role"]
    assert role_meta["role_id"] == "ROLE_PY_BACKEND"
    assert len(role_meta["required_skills"]) > 0

    # =========================================================================
    # STEP 2: Persisted Skill Evidence and Skill-Gap Analysis
    # =========================================================================
    # User records:
    # - Python: evidenced (supported by projects)
    # - FastAPI: claimed (self-reported, unconfirmed)
    # - Docker: evidenced (preferred tool)
    sk1 = client.post(
        "/api/v1/career/skills",
        json={"skill_name": "Python", "category": "technical", "evidence_status": "evidenced"},
    )
    assert sk1.status_code == 201

    sk2 = client.post(
        "/api/v1/career/skills",
        json={"skill_name": "FastAPI", "category": "technical", "evidence_status": "claimed"},
    )
    assert sk2.status_code == 201

    sk3 = client.post(
        "/api/v1/career/skills",
        json={"skill_name": "Docker", "category": "tool", "evidence_status": "evidenced"},
    )
    assert sk3.status_code == 201

    # Verify skills list
    skills_list = client.get("/api/v1/career/skills")
    assert skills_list.status_code == 200
    assert skills_list.json()["count"] == 3

    # Query deterministic gap analysis for the target role
    gap_res = client.get("/api/v1/career/skill-gaps?role_id=ROLE_PY_BACKEND")
    assert gap_res.status_code == 200
    gaps = gap_res.json()
    assert gaps["role"]["role_id"] == "ROLE_PY_BACKEND"
    assert gaps["role"]["title"] == "Python / Backend Developer"

    # Verify explainable evidence classification
    req_skills = gaps["required_skills"]
    py_skill = next(s for s in req_skills if s["skill_key"] == "python")
    assert py_skill["status"] == "evidenced"

    fastapi_skill = next(s for s in req_skills if s["skill_key"] == "fastapi")
    assert fastapi_skill["status"] == "claimed"

    missing_req_keys = [s["skill_key"] for s in req_skills if s["status"] == "missing"]
    assert "sql" in missing_req_keys
    assert "git" in missing_req_keys
    assert "rest_api" in missing_req_keys

    # Coverage percentage must be deterministic and > 0 (Python is evidenced)
    assert 0 < gaps["metrics"]["evidence_coverage_percentage"] < 100

    # =========================================================================
    # STEP 3: Career Roadmap Generation, Saved-Roadmap Selection, and Progress
    # =========================================================================
    rm_res = client.post(
        "/api/v1/career/roadmaps/generate",
        json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 30},
    )
    assert rm_res.status_code == 201
    roadmap = rm_res.json()
    roadmap_id = roadmap["id"]
    assert roadmap["target_role_id"] == "ROLE_PY_BACKEND"
    assert roadmap["horizon_days"] == 30
    assert roadmap["generation_mode"] == "deterministic"
    assert roadmap["progress_percentage"] == 0
    assert roadmap["completed_milestones"] == 0
    assert len(roadmap["milestones"]) >= 3

    # Total days must sum to horizon
    assert sum(m["suggested_duration_days"] for m in roadmap["milestones"]) == 30

    # Ensure no advanced GenAI course is erroneously attached to Python fundamentals
    for m in roadmap["milestones"]:
        if "python" in [s.lower() for s in m.get("target_skills", [])]:
            assert m.get("linked_opportunity_id") != "OPP_CRS_SWAYAMPLUS_GENAI_SMARTBRIDGE"

    # List saved roadmaps
    list_rm = client.get("/api/v1/career/roadmaps")
    assert list_rm.status_code == 200
    assert list_rm.json()["count"] == 1
    assert list_rm.json()["roadmaps"][0]["id"] == roadmap_id

    # Retrieve roadmap details
    detail_rm = client.get(f"/api/v1/career/roadmaps/{roadmap_id}")
    assert detail_rm.status_code == 200
    m1 = detail_rm.json()["milestones"][0]
    m1_id = m1["id"]
    assert m1["is_completed"] is False

    # Complete Milestone 1
    patch_res = client.patch(
        f"/api/v1/career/roadmaps/{roadmap_id}/milestones/{m1_id}",
        json={"is_completed": True},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["milestone"]["is_completed"] is True

    # Re-retrieve detail to confirm progress percentage recalculated
    detail_rm_updated = client.get(f"/api/v1/career/roadmaps/{roadmap_id}")
    assert detail_rm_updated.status_code == 200
    up_data = detail_rm_updated.json()
    assert up_data["completed_milestones"] == 1
    assert up_data["progress_percentage"] > 0
    assert up_data["milestones"][0]["is_completed"] is True

    # =========================================================================
    # STEP 4: Career Copilot Grounded in Skill Gaps and Roadmap Progress
    # =========================================================================
    conv_res = client.post(
        "/api/v1/career/copilot/conversations",
        json={"title": "E2E Advisory Session"},
    )
    assert conv_res.status_code == 201
    conv_id = conv_res.json()["id"]

    # 4a. Query missing skills -- must reflect exact gaps and distinction between claimed and evidenced
    msg_gaps = client.post(
        f"/api/v1/career/copilot/conversations/{conv_id}/messages",
        json={"content": "What are my remaining skill gaps for my target role?"},
    )
    assert msg_gaps.status_code == 201
    gaps_answer = msg_gaps.json()
    assert gaps_answer["sender"] == "assistant"
    assert gaps_answer["generation_mode"] == "deterministic"
    assert "Python / Backend Developer" in gaps_answer["content"]
    assert "FastAPI" in gaps_answer["content"]
    assert "claimed but not yet verified" in gaps_answer["content"]
    assert len(gaps_answer["sources"]) > 0

    # 4b. Query roadmap guidance -- must reflect Milestone #1 is done and recommend Milestone #2
    msg_rm = client.post(
        f"/api/v1/career/copilot/conversations/{conv_id}/messages",
        json={"content": "What should I do this week based on my roadmap?"},
    )
    assert msg_rm.status_code == 201
    rm_answer = msg_rm.json()
    assert rm_answer["sender"] == "assistant"
    assert rm_answer["generation_mode"] == "deterministic"
    assert "30-day roadmap" in rm_answer["content"]
    assert "1/" in rm_answer["content"]  # 1 out of N completed
    assert "Milestone #2" in rm_answer["content"]
    assert any(s["kind"] == "roadmap_milestone" for s in rm_answer["sources"])

    # =========================================================================
    # STEP 5: Opportunity Discovery, Tracking, and Provenance Verification
    # =========================================================================
    recs_res = client.get("/api/v1/career/recommendations")
    assert recs_res.status_code == 200
    assert recs_res.json()["status"] == "success"

    # Track an authoritative catalogue opportunity
    track_res = client.post(
        "/api/v1/career/tracker",
        json={
            "opportunity_id": "OPP_CRS_SWAYAMPLUS_GENAI_SMARTBRIDGE",
            "stage": "saved",
            "notes": "Exploring as an applied machine learning extension.",
        },
    )
    assert track_res.status_code == 201
    tracked_item = track_res.json()
    tracker_id = tracked_item["id"]
    assert tracked_item["opportunity_id"] == "OPP_CRS_SWAYAMPLUS_GENAI_SMARTBRIDGE"
    assert tracked_item["stage"] == "saved"

    # Verify authoritative provenance and listing status
    linked = tracked_item["linked_opportunity"]
    assert linked is not None
    assert linked["title"] == "Generative AI"
    assert linked["provider_name"] == "SmartBridge (via SWAYAM Plus)"
    assert linked["verification_status"] == "verified_official"
    assert linked["official_url"] is not None

    # Update tracker stage to 'applied' with application date
    tr_update = client.put(
        f"/api/v1/career/tracker/{tracker_id}",
        json={"stage": "applied", "date_applied": "2026-10-14"},
    )
    assert tr_update.status_code == 200
    assert tr_update.json()["stage"] == "applied"
    assert tr_update.json()["date_applied"] == "2026-10-14"

    # Retrieve tracker list to confirm persistence
    tr_list = client.get("/api/v1/career/tracker")
    assert tr_list.status_code == 200
    assert tr_list.json()["count"] == 1
    assert tr_list.json()["items"][0]["id"] == tracker_id


def test_e2e_copilot_with_ai_consent_and_mocked_provider():
    """Validates that enabling AI consent correctly routes grounded context to AI provider."""
    client = TestClient(app)
    user_email = "e2e_ai_consented@example.com"
    register_and_login(client, user_email, name="Priya Patel")

    # Set profile with AI consent ENABLED
    client.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Python / Backend Developer",
            "target_occupation_id": "OCC_DEV_PY_01",
            "consent_ai_processing": True,
        },
    )

    # Generate a roadmap
    client.post(
        "/api/v1/career/roadmaps/generate",
        json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 30},
    )

    conv = client.post(
        "/api/v1/career/copilot/conversations",
        json={"title": "AI Consented Conversation"},
    ).json()
    conv_id = conv["id"]

    mock_ai_response = {
        "answer": "As a Python Backend candidate, prioritize SQL and complete your active milestone.",
        "sources": [{"kind": "skill_gap", "id": "sql", "title": "SQL", "url": None, "verification_status": "required_gap"}],
        "suggested_followups": ["What projects should I build?"],
        "generation_mode": "ai_assisted",
    }

    with patch("app.ai.ai_service.AIService.generate_copilot_response", return_value=mock_ai_response) as mock_ai_call:
        msg_res = client.post(
            f"/api/v1/career/copilot/conversations/{conv_id}/messages",
            json={"content": "How should I structure my backend preparation?"},
        )
        assert msg_res.status_code == 201
        data = msg_res.json()

        assert mock_ai_call.call_count == 1
        call_context = mock_ai_call.call_args[1]["context"]
        assert call_context["target_role"]["title"] == "Python / Backend Developer"
        assert call_context["consent_ai_processing"] is True
        assert call_context["roadmap"] is not None

        assert data["generation_mode"] == "ai_assisted"
        assert "As a Python Backend candidate" in data["content"]


def test_e2e_cross_module_multi_tenant_isolation():
    """User B cannot view or mutate User A's profile, skills, roadmaps, copilot chats, or tracked items."""
    client_a = TestClient(app)
    client_b = TestClient(app)

    register_and_login(client_a, "user_a_e2e@example.com", name="User A")
    register_and_login(client_b, "user_b_e2e@example.com", name="User B")

    # User A creates resources across all modules
    client_a.put("/api/v1/career/profile", json={"target_role_title": "Python Developer"})
    sk_a = client_a.post("/api/v1/career/skills", json={"skill_name": "Python", "category": "technical", "evidence_status": "evidenced"}).json()
    rm_a = client_a.post("/api/v1/career/roadmaps/generate", json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 30}).json()
    conv_a = client_a.post("/api/v1/career/copilot/conversations", json={"title": "Private Chat A"}).json()
    tr_a = client_a.post("/api/v1/career/tracker", json={"custom_title": "Private Job A", "stage": "saved"}).json()

    # User B isolated queries
    assert client_b.get("/api/v1/career/skills").json()["count"] == 0
    assert client_b.get("/api/v1/career/roadmaps").json()["count"] == 0
    assert client_b.get("/api/v1/career/copilot/conversations").json()["count"] == 0
    assert client_b.get("/api/v1/career/tracker").json()["count"] == 0

    # User B direct ID access returns 404
    assert client_b.get(f"/api/v1/career/roadmaps/{rm_a['id']}").status_code == 404
    assert client_b.delete(f"/api/v1/career/roadmaps/{rm_a['id']}").status_code == 404
    assert client_b.get(f"/api/v1/career/copilot/conversations/{conv_a['id']}").status_code == 404
    assert client_b.delete(f"/api/v1/career/copilot/conversations/{conv_a['id']}").status_code == 404
    assert client_b.get(f"/api/v1/career/tracker/{tr_a['id']}").status_code == 404
    assert client_b.delete(f"/api/v1/career/tracker/{tr_a['id']}").status_code == 404

    # User B cannot update User A's milestone
    m1_id = rm_a["milestones"][0]["id"]
    assert client_b.patch(f"/api/v1/career/roadmaps/{rm_a['id']}/milestones/{m1_id}", json={"is_completed": True}).status_code == 404


def test_e2e_copilot_roadmap_progress_lifecycle_sync():
    """Toggling milestone completion in the roadmap dynamically updates Copilot's grounded guidance."""
    client = TestClient(app)
    register_and_login(client, "user_sync_e2e@example.com", name="Sync User")

    client.put("/api/v1/career/profile", json={"target_role_title": "Python Developer"})

    # Generate 30-day roadmap
    rm_res = client.post(
        "/api/v1/career/roadmaps/generate",
        json={"target_role_id": "ROLE_PY_BACKEND", "horizon_days": 30},
    )
    assert rm_res.status_code == 201
    rm = rm_res.json()
    rm_id = rm["id"]
    milestones = rm["milestones"]

    # Create Copilot conversation
    conv = client.post("/api/v1/career/copilot/conversations", json={"title": "Roadmap Sync"}).json()
    cid = conv["id"]

    # Phase A: 0 milestones completed -> recommends Milestone #1
    q1 = client.post(
        f"/api/v1/career/copilot/conversations/{cid}/messages",
        json={"content": "What should I do this week based on my roadmap?"},
    ).json()
    assert "Milestone #1" in q1["content"]

    # Phase B: Mark Milestone #1 as completed
    client.patch(
        f"/api/v1/career/roadmaps/{rm_id}/milestones/{milestones[0]['id']}",
        json={"is_completed": True},
    )

    # Copilot now dynamically recommends Milestone #2
    q2 = client.post(
        f"/api/v1/career/copilot/conversations/{cid}/messages",
        json={"content": "What should I do this week based on my roadmap?"},
    ).json()
    assert "Milestone #2" in q2["content"]

    # Phase C: Mark all remaining milestones as completed
    for m in milestones[1:]:
        client.patch(
            f"/api/v1/career/roadmaps/{rm_id}/milestones/{m['id']}",
            json={"is_completed": True},
        )

    # Copilot recognizes full roadmap completion
    q3 = client.post(
        f"/api/v1/career/copilot/conversations/{cid}/messages",
        json={"content": "What should I do this week based on my roadmap?"},
    ).json()
    assert "completed all milestones" in q3["content"].lower()

