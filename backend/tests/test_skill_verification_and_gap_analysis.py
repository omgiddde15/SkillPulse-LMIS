"""Unit and Integration Tests for Phase 2: Skill Verification and Explainable Skill-Gap Analysis.

Tests cover:
1. Resume upload registers extracted skills with 'unconfirmed' status.
2. User-claimed skills vs evidenced skills with supporting context.
3. User skill CRUD, validation and ownership isolation (User A vs User B).
4. Non-disclosing 404 on cross-user skill read, update, and delete attempts.
5. Deterministic skill-gap analysis for supported roles (Python backend vs Frontend vs Data Analyst).
6. Skill-gap result dynamically updates when user's target role changes.
7. Required skills vs Preferred skills handled separately with transparent metrics.
8. Controlled alias normalization (e.g. py -> python, reactjs -> react) without loose fuzzy matching.
9. Handling of unknown roles returning clean non-misleading response.
10. Preservation of custom target role when no pre-configured catalogue profile matches.
11. Repeat resume reviews and removing skills from review updating database predictably without duplicates.
12. Cross-user isolation: User B cannot access User A's skills, and User B's gap analysis does not use User A's skills.
"""

import os
import tempfile
from pathlib import Path
from typing import Generator
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.db import init_db
from app.services.role_catalogue import normalize_skill_key, get_supported_roles, get_role_by_id
from tests.test_career_profile_and_resume import SAMPLE_PDF_BYTES


@pytest.fixture
def temp_environment(monkeypatch) -> Generator[tuple[Path, Path], None, None]:
    """Isolated temporary SQLite database and upload directory per test."""
    db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db_path = db_file.name
    db_file.close()

    upload_temp_dir = tempfile.TemporaryDirectory()

    monkeypatch.setenv("SKILLPULSE_DB_PATH", db_path)
    monkeypatch.setenv("SKILLPULSE_UPLOAD_DIR", upload_temp_dir.name)

    init_db(db_path)

    yield Path(db_path), Path(upload_temp_dir.name)

    upload_temp_dir.cleanup()
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass


@pytest.fixture
def client_anon(temp_environment) -> TestClient:
    return TestClient(app)


@pytest.fixture
def client_user_a(temp_environment) -> tuple[TestClient, dict]:
    client = TestClient(app)
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "candidate_a_p2@skillpulse.org",
            "full_name": "Candidate Alpha P2",
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    assert reg_resp.status_code == 201
    user_data = reg_resp.json()["user"]
    return client, user_data


@pytest.fixture
def client_user_b(temp_environment) -> tuple[TestClient, dict]:
    client = TestClient(app)
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "candidate_b_p2@skillpulse.org",
            "full_name": "Candidate Beta P2",
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    assert reg_resp.status_code == 201
    user_data = reg_resp.json()["user"]
    return client, user_data


# -----------------------------------------------------------------------------
# Test Cases
# -----------------------------------------------------------------------------

def test_resume_extracted_skills_begin_as_unconfirmed(client_user_a):
    """Test 1: Extracted skills from resume upload are initially registered as 'unconfirmed'."""
    client, user = client_user_a

    # Upload resume containing Python, SQL, Docker, Git, Linux, FastAPI, React
    upload_resp = client.post(
        "/api/v1/career/resume",
        files={"file": ("candidate_resume.pdf", SAMPLE_PDF_BYTES, "application/pdf")},
    )
    assert upload_resp.status_code == 201

    # Fetch user skills
    skills_resp = client.get("/api/v1/career/skills")
    assert skills_resp.status_code == 200
    skills = skills_resp.json()["skills"]
    assert len(skills) > 0

    # Verify all resume-extracted skills start as 'unconfirmed' and verified_by_user = False
    for s in skills:
        assert s["evidence_status"] == "unconfirmed"
        assert s["verified_by_user"] is False
        assert s["source_type"] == "resume_extracted"


def test_user_claimed_vs_evidenced_skills(client_user_a):
    """Test 2: User-claimed skills remain distinguishable from evidenced skills with supporting context."""
    client, user = client_user_a

    # 1. Add a self-claimed skill without evidence context
    claim_resp = client.post(
        "/api/v1/career/skills",
        json={
            "skill_name": "Python",
            "category": "technical",
            "evidence_status": "claimed",
            "source_type": "self_reported",
            "verified_by_user": True,
        },
    )
    assert claim_resp.status_code == 201
    claimed_skill = claim_resp.json()["skill"]
    assert claimed_skill["evidence_status"] == "claimed"
    assert claimed_skill["source_context"] is None
    assert claimed_skill["verified_by_user"] is True

    # 2. Add an evidenced skill with supporting project reference
    evidence_resp = client.post(
        "/api/v1/career/skills",
        json={
            "skill_name": "FastAPI",
            "category": "technical",
            "evidence_status": "evidenced",
            "source_type": "project_experience",
            "source_context": "Production REST API for LMIS telemetry with async workers and JWT auth",
            "verified_by_user": True,
        },
    )
    assert evidence_resp.status_code == 201
    evidenced_skill = evidence_resp.json()["skill"]
    assert evidenced_skill["evidence_status"] == "evidenced"
    assert "LMIS telemetry" in evidenced_skill["source_context"]

    # Verify both exist and are clearly distinguished in listing
    list_resp = client.get("/api/v1/career/skills")
    skills = {s["skill_key"]: s for s in list_resp.json()["skills"]}
    assert skills["python"]["evidence_status"] == "claimed"
    assert skills["fastapi"]["evidence_status"] == "evidenced"


def test_resume_review_promotes_confirmed_skills(client_user_a):
    """Test 3: Confirming resume review promotes unconfirmed skills and removes discarded skills."""
    client, user = client_user_a

    # Upload resume
    upload_resp = client.post(
        "/api/v1/career/resume",
        files={"file": ("candidate_resume.pdf", SAMPLE_PDF_BYTES, "application/pdf")},
    )
    resume_id = upload_resp.json()["resume"]["id"]

    # Review resume: confirm Python, FastAPI, Docker with project summary; discard React, SQL
    reviewed_payload = {
        "candidate_name": "Priya Sharma",
        "detected_skills": ["Python", "FastAPI", "Docker"],
        "projects_summary": "High-throughput telemetry pipeline built using Python, FastAPI and Docker containers.",
    }
    review_resp = client.put(f"/api/v1/career/resume/{resume_id}/review", json=reviewed_payload)
    assert review_resp.status_code == 200

    # Verify user skills
    skills_resp = client.get("/api/v1/career/skills")
    skills = {s["skill_key"]: s for s in skills_resp.json()["skills"]}

    # Confirmed skills are promoted to evidenced (because project summary was supplied)
    assert "python" in skills
    assert skills["python"]["evidence_status"] == "evidenced"
    assert skills["python"]["verified_by_user"] is True
    assert "fastapi" in skills
    assert skills["fastapi"]["evidence_status"] == "evidenced"
    assert "docker" in skills
    assert skills["docker"]["evidence_status"] == "evidenced"

    # Discarded unconfirmed skills (e.g. react) were removed so rejected suggestions don't linger
    assert "react" not in skills


def test_repeat_resume_review_no_duplicates(client_user_a):
    """Test 4: Repeat resume reviews do not create duplicate skill records."""
    client, user = client_user_a

    upload_resp = client.post(
        "/api/v1/career/resume",
        files={"file": ("resume.pdf", SAMPLE_PDF_BYTES, "application/pdf")},
    )
    resume_id = upload_resp.json()["resume"]["id"]

    # Review 1st time
    client.put(
        f"/api/v1/career/resume/{resume_id}/review",
        json={"detected_skills": ["Python", "Git"]},
    )
    s1 = client.get("/api/v1/career/skills").json()["skills"]
    assert len(s1) == 2

    # Review 2nd time with same skills
    client.put(
        f"/api/v1/career/resume/{resume_id}/review",
        json={"detected_skills": ["Python", "Git", "SQL"]},
    )
    s2 = client.get("/api/v1/career/skills").json()["skills"]
    assert len(s2) == 3
    # Check keys are unique
    keys = [s["skill_key"] for s in s2]
    assert len(keys) == len(set(keys))


def test_deterministic_skill_gap_analysis(client_user_a):
    """Test 5: Deterministic skill gap analysis separates required and preferred skills with clear explanations."""
    client, user = client_user_a

    # Add Python and SQL as evidenced, Git as claimed
    client.post(
        "/api/v1/career/skills",
        json={
            "skill_name": "Python",
            "evidence_status": "evidenced",
            "source_context": "3 years backend microservices at TechCorp",
        },
    )
    client.post(
        "/api/v1/career/skills",
        json={
            "skill_name": "SQL",
            "evidence_status": "evidenced",
            "source_context": "PostgreSQL database optimization and migrations",
        },
    )
    client.post(
        "/api/v1/career/skills",
        json={
            "skill_name": "Git",
            "evidence_status": "claimed",
        },
    )

    # Analyze against ROLE_PY_BACKEND
    gap_resp = client.get("/api/v1/career/skill-gaps?role_id=ROLE_PY_BACKEND")
    assert gap_resp.status_code == 200
    data = gap_resp.json()

    role = data["role"]
    assert role["role_id"] == "ROLE_PY_BACKEND"
    assert role["sector"] == "IT/ITeS"

    metrics = data["metrics"]
    assert metrics["required_total"] == 5
    assert metrics["required_evidenced"] == 2  # Python and SQL
    assert metrics["required_claimed"] == 1    # Git
    assert metrics["required_missing"] == 2    # FastAPI and RESTful API Design
    assert metrics["evidence_coverage_percentage"] == 40.0
    assert "40.0%" in metrics["metric_explanation"]
    assert "Not an employability score" in metrics["disclaimer"]

    # Verify required skills breakdown
    req_map = {r["skill_key"]: r for r in data["required_skills"]}
    assert req_map["python"]["status"] == "evidenced"
    assert "TechCorp" in req_map["python"]["explanation"]

    assert req_map["git"]["status"] == "claimed"
    assert "Self-reported" in req_map["git"]["explanation"]

    assert req_map["fastapi"]["status"] == "missing"
    assert "Not currently documented" in req_map["fastapi"]["explanation"]
    assert req_map["fastapi"]["role_justification"] != ""


def test_skill_gap_result_changes_when_role_changes(client_user_a):
    """Test 6: Skill-gap analysis dynamically changes when target role changes."""
    client, user = client_user_a

    # User has React, JavaScript, HTML, CSS as evidenced
    for s in ["React", "JavaScript", "HTML", "CSS"]:
        client.post(
            "/api/v1/career/skills",
            json={
                "skill_name": s,
                "evidence_status": "evidenced",
                "source_context": f"Built responsive web app using {s}",
            },
        )

    # Check against Frontend Developer -> High coverage
    fe_resp = client.get("/api/v1/career/skill-gaps?role_id=ROLE_FRONTEND_DEV")
    assert fe_resp.status_code == 200
    fe_data = fe_resp.json()
    assert fe_data["metrics"]["required_evidenced"] == 4
    assert fe_data["metrics"]["evidence_coverage_percentage"] == 80.0  # 4 of 5 (missing git)

    # Check against Embedded IoT -> Zero or low coverage
    iot_resp = client.get("/api/v1/career/skill-gaps?role_id=ROLE_EMBEDDED_IOT")
    assert iot_resp.status_code == 200
    iot_data = iot_resp.json()
    assert iot_data["metrics"]["required_evidenced"] == 0
    assert iot_data["metrics"]["required_missing"] == 5


def test_alias_normalization_controlled_only(client_user_a):
    """Test 7: Alias normalization works only for explicit aliases (py -> python; reactjs -> react)."""
    assert normalize_skill_key("py") == "python"
    assert normalize_skill_key("Python3") == "python"
    assert normalize_skill_key("reactjs") == "react"
    assert normalize_skill_key("PostgreSQL") == "sql"
    assert normalize_skill_key("k8s") == "kubernetes"

    # Unrelated keywords are NOT treated as equivalent
    assert normalize_skill_key("Java") != "javascript"
    assert normalize_skill_key("C++") != "c_sharp"

    client, user = client_user_a
    # User enters "py"
    client.post(
        "/api/v1/career/skills",
        json={"skill_name": "py", "evidence_status": "evidenced", "source_context": "Scripting"},
    )

    # Analyze against Python Backend
    resp = client.get("/api/v1/career/skill-gaps?role_id=ROLE_PY_BACKEND")
    req_map = {r["skill_key"]: r for r in resp.json()["required_skills"]}
    assert req_map["python"]["status"] == "evidenced"


def test_unknown_role_returns_clear_response(client_user_a):
    """Test 8: Unknown role IDs return clear, non-misleading HTTP 404 response."""
    client, user = client_user_a

    resp = client.get("/api/v1/career/skill-gaps?role_id=UNKNOWN_ROLE_XYZ")
    assert resp.status_code == 404
    assert "not in the supported role catalogue" in resp.json()["detail"]


def test_custom_profile_role_preserved_without_forcing(client_user_a):
    """Test 9: Custom profile roles are preserved even when not in the starter role catalogue."""
    client, user = client_user_a

    # User sets a specialized custom role
    client.put(
        "/api/v1/career/profile",
        json={"target_role_title": "Quantum Algorithm Researcher"},
    )

    prof = client.get("/api/v1/career/profile").json()["profile"]
    assert prof["target_role_title"] == "Quantum Algorithm Researcher"

    # Supported role list is accessible
    roles_resp = client.get("/api/v1/career/roles")
    assert roles_resp.status_code == 200
    role_ids = [r["role_id"] for r in roles_resp.json()["roles"]]
    assert "ROLE_PY_BACKEND" in role_ids
    assert "ROLE_FRONTEND_DEV" in role_ids
    assert "ROLE_DATA_ANALYST" in role_ids
    assert "ROLE_EMBEDDED_IOT" in role_ids
    assert "ROLE_ELECTRONICS_TEST" in role_ids


def test_cross_user_skill_isolation(client_user_a, client_user_b):
    """Test 10: User A cannot read, edit, or delete User B's skills, and analysis is isolated."""
    client_a, user_a = client_user_a
    client_b, user_b = client_user_b

    # User A creates a skill
    create_resp = client_a.post(
        "/api/v1/career/skills",
        json={
            "skill_name": "Python",
            "evidence_status": "evidenced",
            "source_context": "User A secret project",
        },
    )
    skill_a_id = create_resp.json()["skill"]["id"]

    # User B checks their skill list (must be empty)
    b_skills = client_b.get("/api/v1/career/skills").json()["skills"]
    assert len(b_skills) == 0

    # User B attempts to edit User A's skill -> 404 non-disclosing
    b_edit = client_b.put(
        f"/api/v1/career/skills/{skill_a_id}",
        json={"skill_name": "Hacked Skill"},
    )
    assert b_edit.status_code == 404
    assert b_edit.json()["detail"] == "Skill record not found."

    # User B attempts to delete User A's skill -> 404 non-disclosing
    b_del = client_b.delete(f"/api/v1/career/skills/{skill_a_id}")
    assert b_del.status_code == 404
    assert b_del.json()["detail"] == "Skill record not found."

    # User A's skill is untouched
    a_skills = client_a.get("/api/v1/career/skills").json()["skills"]
    assert len(a_skills) == 1
    assert a_skills[0]["skill_name"] == "Python"
    assert a_skills[0]["source_context"] == "User A secret project"

    # User B's skill gap analysis shows Python as missing (does not leak User A's skill)
    b_gap = client_b.get("/api/v1/career/skill-gaps?role_id=ROLE_PY_BACKEND").json()
    b_req_map = {r["skill_key"]: r for r in b_gap["required_skills"]}
    assert b_req_map["python"]["status"] == "missing"


def test_removing_skill_updates_gap_analysis(client_user_a):
    """Test 11: Removing a skill updates the gap analysis dynamically."""
    client, user = client_user_a

    # Add Python
    add_resp = client.post(
        "/api/v1/career/skills",
        json={"skill_name": "Python", "evidence_status": "evidenced"},
    )
    skill_id = add_resp.json()["skill"]["id"]

    # Gap analysis shows Python evidenced
    gap1 = client.get("/api/v1/career/skill-gaps?role_id=ROLE_PY_BACKEND").json()
    assert gap1["metrics"]["required_evidenced"] == 1

    # Delete Python
    del_resp = client.delete(f"/api/v1/career/skills/{skill_id}")
    assert del_resp.status_code == 200

    # Gap analysis shows Python missing
    gap2 = client.get("/api/v1/career/skill-gaps?role_id=ROLE_PY_BACKEND").json()
    assert gap2["metrics"]["required_evidenced"] == 0
    assert gap2["metrics"]["required_missing"] == 5


def test_role_catalogue_provenance_and_metadata():
    """Test 12: Role catalogue defines official and curated starter profiles with provenance."""
    roles = get_supported_roles()
    assert len(roles) >= 5

    role_ids = {r["role_id"] for r in roles}
    assert "ROLE_PY_BACKEND" in role_ids
    assert "ROLE_FRONTEND_DEV" in role_ids
    assert "ROLE_DATA_ANALYST" in role_ids
    assert "ROLE_EMBEDDED_IOT" in role_ids
    assert "ROLE_ELECTRONICS_TEST" in role_ids

    for r in roles:
        assert r["version"] == "2026.1"
        assert r["provenance_notes"] != ""
        assert r["source_type"] in ("curated_starter", "official_qualification_pack", "official_nco")
        assert r["required_skills_count"] > 0
        assert r["preferred_skills_count"] > 0
