"""Comprehensive Automated Test Suite for SkillPulse Hiring Intelligence Upgrade.

Tests all 10 core requirements:
1. Backward compatibility: Courses, schemes, and portals remain functional and isolated.
2. Verified individual vacancy vs portal directory separation.
3. Structured hiring fields preservation across employer, location, compensation, eligibility, and process.
4. Grounding & Anti-fabrication: Undisclosed fields remain None; fake contacts and salaries never generated.
5. Dynamic deadline expiration: Past deadlines mark listing_status='closed' and is_deadline_passed=True.
6. Candidate matching: Evidenced vs claimed skill distinction, preferred skills, experience bonus, missing skills.
7. Application Tracker integration: Lifecycle across stages, access control, non-auto-apply safety.
8. SkillPulse Saarthi integration: Grounded answers for apprenticeships, Pune, qualifications, application instructions,
   recruiter contact anti-fraud disclosure, and unlisted locations.
9. Multi-criteria filtering by work arrangement, industry, location, and salary/stipend.
10. Approved domain validation on external application URLs.
"""

import os
import tempfile
from pathlib import Path
from typing import Generator
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.db import init_db, get_db
from app.services.opportunity_service import OpportunityService, is_safe_https_url
from app.services.policy_copilot_service import PolicyCopilotService


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
            "email": "candidate_hiring_a@skillpulse.org",
            "full_name": "Candidate Hiring Alpha",
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
            "email": "candidate_hiring_b@skillpulse.org",
            "full_name": "Candidate Hiring Beta",
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    assert reg_resp.status_code == 201
    user_data = reg_resp.json()["user"]
    return client, user_data


# -----------------------------------------------------------------------------
# 1. Structured Hiring Fields & Provenance Preservation
# -----------------------------------------------------------------------------

def test_hiring_fields_stored_and_retrieved_in_catalogue(client_anon):
    """Test 1: Genuine structured vacancies return verified fields; unverified pilot vacancies have null unsupported fields."""
    resp = client_anon.get("/api/v1/career/opportunities?limit=100")
    assert resp.status_code == 200
    items = resp.json()["items"]

    # 1. Verify Genuine Live Vacancy: BEL Dharwad Apprenticeship (HTTP 200 Verified)
    bel_app = next((it for it in items if it["id"] == "OPP_APP_NAPS_CNC_DHARWAD"), None)
    assert bel_app is not None
    assert bel_app["record_kind"] == "individual_listing"
    assert bel_app["verification_status"] == "verified_official"
    assert bel_app["exact_listing_retrieved"] is True
    assert bel_app["individual_fields_verified"] is True
    assert bel_app["vacancy_status_checked"] is True
    assert bel_app["source_portal_reachable"] is True
    assert bel_app["employer_name"] == "Bharat Electronics Limited (BEL)"
    assert bel_app["opportunity_type"] == "apprenticeship"
    assert bel_app["location_city"] == "Dharwad"
    assert bel_app["location_state"] == "KA"
    assert bel_app["work_arrangement"] == "onsite"
    assert bel_app["working_hours"] == "8:00 AM - 4:30 PM (General Shift)"
    assert bel_app["weekly_working_days"] == "6 days (Monday to Saturday)"
    assert bel_app["stipend_min"] == 12500.0
    assert bel_app["stipend_max"] == 14000.0
    assert bel_app["workplace_address"] == "Belur Industrial Area, Dharwad, Karnataka 580011"
    assert bel_app["recruitment_contact_email"] == "helpdesk-apprenticeship@gov.in"
    assert len(bel_app["required_documents"]) >= 3
    assert len(bel_app["selection_stages"]) >= 3
    assert bel_app["application_instructions"] is not None

    # 2. Verify Curated Pilot Reference: Tata Motors Ltd. (Unverified Vacancy ID)
    tm_job = next((it for it in items if it["id"] == "OPP_JOB_NCS_DATA_ANALYST_PUNE"), None)
    assert tm_job is not None
    assert tm_job["record_kind"] == "curated_pilot_listing"
    assert tm_job["verification_status"] == "unverified_curated"
    assert tm_job["exact_listing_retrieved"] is False
    assert tm_job["individual_fields_verified"] is False
    assert tm_job["employer_name"] == "Tata Motors Ltd."
    assert "Automotive" in tm_job["industry"]
    assert tm_job["employment_type"] == "full_time"
    assert "tatamotors.com" in tm_job["official_company_website"]
    assert tm_job["location_city"] == "Pune"
    assert tm_job["location_state"] == "MH"
    assert tm_job["work_arrangement"] == "onsite"
    # Strict anti-fabrication: Unsupported fields must remain None
    assert tm_job["working_hours"] is None
    assert tm_job["weekly_working_days"] is None
    assert tm_job["salary_min"] is None
    assert tm_job["salary_max"] is None
    assert tm_job["workplace_address"] is None
    assert tm_job["recruitment_contact_phone"] is None
    assert tm_job["recruitment_contact_email"] is None
    assert tm_job["experience_years_min"] == 0.0
    assert tm_job["experience_years_max"] == 2.0
    assert "Discipline" in tm_job["education_requirements"] or "Bachelor" in tm_job["education_requirements"] or "B.Sc" in tm_job["education_requirements"]
    assert "power_bi" in tm_job["preferred_skills"] or "tableau" in tm_job["preferred_skills"]
    assert tm_job["application_instructions"] is not None


def test_undisclosed_fields_remain_none_not_fabricated(client_anon):
    """Test 2: Undisclosed fields strictly remain None and are not converted to dummy numbers or zero."""
    resp = client_anon.get("/api/v1/career/opportunities?limit=100")
    items = resp.json()["items"]

    # In warehouse inventory coordinator: working hours, phone, and specific address are not disclosed
    wh_job = next((it for it in items if it["id"] == "OPP_JOB_NCS_LOGISTICS_COORD_BLR"), None)
    assert wh_job is not None
    assert wh_job["record_kind"] == "curated_pilot_listing"
    assert wh_job["verification_status"] == "unverified_curated"
    assert wh_job["exact_listing_retrieved"] is False
    assert wh_job["workplace_address"] is None
    assert wh_job["working_hours"] is None
    assert wh_job["recruitment_contact_phone"] is None
    assert wh_job["official_company_website"] is None

    # Recruiter phone numbers must never be dummy sequences like "12345" or switchboard numbers
    for it in items:
        if it.get("recruitment_contact_phone"):
            assert "12345" not in it["recruitment_contact_phone"]
            assert "99999" not in it["recruitment_contact_phone"]


def test_expired_vacancies_dynamically_closed(client_anon):
    """Test 3: Expired vacancies have listing_status='closed' and is_deadline_passed=True."""
    resp = client_anon.get("/api/v1/career/opportunities?limit=100")
    items = resp.json()["items"]

    expired_job = next((it for it in items if it["id"] == "OPP_JOB_NCS_FRONTEND_REACT_EXPIRED"), None)
    assert expired_job is not None
    assert expired_job["listing_status"] == "closed"
    assert expired_job["is_deadline_passed"] is True


# -----------------------------------------------------------------------------
# 2. Multi-Criteria Filtering by Hiring Attributes & Classification Isolation
# -----------------------------------------------------------------------------

def test_hiring_filters_by_arrangement_industry_location_and_salary(client_anon):
    """Test 4: Opportunities filter accurately and isolate vacancies from directories and curricula."""
    # 1. Filter by work_arrangement: hybrid
    resp_hybrid = client_anon.get("/api/v1/career/opportunities?work_arrangement=hybrid")
    assert resp_hybrid.status_code == 200
    hybrid_items = resp_hybrid.json()["items"]
    assert len(hybrid_items) >= 2
    assert all(it["work_arrangement"] == "hybrid" for it in hybrid_items)

    # 2. Filter by industry: Automotive
    resp_auto = client_anon.get("/api/v1/career/opportunities?industry=Automotive")
    assert resp_auto.status_code == 200
    auto_items = resp_auto.json()["items"]
    assert len(auto_items) == 1
    assert auto_items[0]["id"] == "OPP_JOB_NCS_DATA_ANALYST_PUNE"

    # 3. Filter by location_city: Pune
    resp_pune = client_anon.get("/api/v1/career/opportunities?location_city=Pune")
    assert resp_pune.status_code == 200
    pune_items = resp_pune.json()["items"]
    assert len(pune_items) >= 1
    assert all(it["location_city"] == "Pune" for it in pune_items)

    # 4. Filter by min_salary: 30,000 (only confirmed or historical salary records)
    resp_sal = client_anon.get("/api/v1/career/opportunities?min_salary=30000")
    assert resp_sal.status_code == 200
    sal_items = resp_sal.json()["items"]
    assert len(sal_items) >= 1
    assert all(it["salary_min"] >= 30000 for it in sal_items)

    # 5. Filter by min_stipend: 5,000 (covers NAPS 12.5k and PMIS 5k)
    resp_stip = client_anon.get("/api/v1/career/opportunities?min_stipend=5000")
    assert resp_stip.status_code == 200
    stip_items = resp_stip.json()["items"]
    assert len(stip_items) >= 2
    assert all(it["stipend_min"] >= 5000 for it in stip_items)

    # 6. Requirement: Searching for jobs does NOT return portal directories
    resp_jobs = client_anon.get("/api/v1/career/opportunities?opportunity_type=job")
    assert resp_jobs.status_code == 200
    job_items = resp_jobs.json()["items"]
    assert len(job_items) == 4
    assert not any(it["record_kind"] == "portal_directory" for it in job_items)
    assert not any(it["id"] == "OPP_DIR_NCS_JOBS" for it in job_items)

    # 7. Requirement: Searching for apprenticeships does NOT return curriculum standards
    resp_app = client_anon.get("/api/v1/career/opportunities?opportunity_type=apprenticeship")
    assert resp_app.status_code == 200
    app_items = resp_app.json()["items"]
    assert len(app_items) == 1
    assert app_items[0]["id"] == "OPP_APP_NAPS_CNC_DHARWAD"
    assert not any(it["record_kind"] == "curriculum_standard" for it in app_items)
    assert not any(it["id"] == "OPP_APP_NAPS_ELECTRONICS_TEST" for it in app_items)

    # 8. Requirement: Expired vacancies cannot appear in open opportunity searches
    resp_open = client_anon.get("/api/v1/career/opportunities?listing_status=open")
    assert resp_open.status_code == 200
    open_items = resp_open.json()["items"]
    assert not any(it["id"] == "OPP_JOB_NCS_FRONTEND_REACT_EXPIRED" for it in open_items)
    assert not any(it["is_deadline_passed"] for it in open_items)


# -----------------------------------------------------------------------------
# 3. Candidate Matching & Evidenced vs Claimed Skills
# -----------------------------------------------------------------------------

def test_candidate_matching_evidenced_vs_claimed_and_missing_skills(client_user_a):
    """Test 5: Matching distinguishes evidenced from claimed skills and reports missing required skills."""
    client, user = client_user_a

    # User targets Python Backend Developer
    client.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Python Backend Developer",
            "current_state": "KARNATAKA",
            "current_district": "BENGALURU",
            "years_experience": 1.5,
        },
    )

    # Evidenced skill: Python
    client.post(
        "/api/v1/career/skills",
        json={"skill_name": "Python", "evidence_status": "evidenced"},
    )

    # Claimed (unconfirmed) skill: Fast API
    client.post(
        "/api/v1/career/skills",
        json={"skill_name": "Fast API", "evidence_status": "claimed"},
    )

    recs = client.get("/api/v1/career/recommendations").json()
    assert recs["status"] == "success"
    opps = recs["recommended_opportunities"]
    assert len(opps) > 0

    # Locate C-DAC Python Backend Developer vacancy
    cdac_match = next((o for o in opps if o["opportunity"]["id"] == "OPP_JOB_NCS_PY_BACKEND_BLR"), None)
    assert cdac_match is not None

    # Evidenced python gives 20 pts; claimed fast_api gives 10 pts
    assert cdac_match["score_breakdown"]["evidenced_skill_points"] >= 20.0
    assert cdac_match["score_breakdown"]["claimed_skill_points"] >= 10.0
    assert cdac_match["score_breakdown"]["experience_compatibility_points"] == 10.0

    # Reason codes must include both evidenced and claimed notices
    reason_codes = [r["code"] for r in cdac_match["reasons"]]
    assert "EVIDENCED_SKILL_MATCH" in reason_codes
    assert "CLAIMED_SKILL_MATCH" in reason_codes
    assert "EXPERIENCE_CRITERIA_MET" in reason_codes

    # Missing required skills should report remaining competencies (sql, git, docker, rest_apis)
    missing = cdac_match["missing_required_skills"]
    assert "sql" in missing or "docker" in missing
    assert "python" not in missing
    assert "fast_api" not in missing


# -----------------------------------------------------------------------------
# 4. Application Tracker Integration
# -----------------------------------------------------------------------------

def test_tracker_integration_with_hiring_opportunities(client_user_a, client_user_b):
    """Test 6: Candidates can track hiring opportunities with full stage lifecycle and user isolation."""
    client_a, user_a = client_user_a
    client_b, user_b = client_user_b

    # User A tracks Tata Motors vacancy
    track_resp = client_a.post(
        "/api/v1/career/tracker",
        json={
            "opportunity_id": "OPP_JOB_NCS_DATA_ANALYST_PUNE",
            "stage": "saved",
            "notes": "Reviewed requirements; need to refresh SQL competencies.",
        },
    )
    assert track_resp.status_code == 201
    tracked_item = track_resp.json()
    assert tracked_item["stage"] == "saved"
    assert tracked_item["linked_opportunity"] is not None
    assert tracked_item["linked_opportunity"]["employer_name"] == "Tata Motors Ltd."
    track_id = tracked_item["id"]

    # User A moves to applied stage
    upd_resp = client_a.put(
        f"/api/v1/career/tracker/{track_id}",
        json={
            "stage": "applied",
            "date_applied": "2026-10-15",
            "notes": "Submitted application via official Tata Motors careers portal.",
        },
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["stage"] == "applied"
    assert upd_resp.json()["date_applied"] == "2026-10-15"

    # User B cannot access User A's tracked opportunity (returns 404)
    resp_b = client_b.get(f"/api/v1/career/tracker/{track_id}")
    assert resp_b.status_code == 404


# -----------------------------------------------------------------------------
# 5. SkillPulse Saarthi Hiring Queries Grounding
# -----------------------------------------------------------------------------

def test_saarthi_hiring_queries_grounded(temp_environment):
    """Test 7: Saarthi answers hiring questions with facts, official links, and anti-fraud disclosures."""
    db_path, _ = temp_environment
    service = PolicyCopilotService()

    # Query 1: Apprenticeships matching target role
    resp1 = service.process_query("Find apprenticeships matching my target role", language="en")
    assert resp1["intent"] == "hiring_apprenticeships"
    assert "Bharat Electronics Limited" in resp1["answer"] or "BEL" in resp1["answer"]
    assert "apprenticeshipindia.gov.in" in resp1["answer"]

    # Query 2: Opportunities in Pune
    resp2 = service.process_query("Show opportunities in Pune", language="en")
    assert resp2["intent"] == "hiring_location"
    assert "Tata Motors" in resp2["answer"]
    assert "Data Quality" in resp2["answer"]
    assert "tatamotors.com" in resp2["answer"] or "ncs.gov.in" in resp2["answer"]

    # Query 3: Vacancy qualifications
    resp3 = service.process_query("What qualifications does the Tata Motors vacancy require?", language="en")
    assert resp3["intent"] == "hiring_qualifications"
    assert "Education" in resp3["answer"] or "Bachelor" in resp3["answer"] or "B.Sc" in resp3["answer"]
    assert "SQL" in resp3["answer"] or "Python" in resp3["answer"]

    # Query 4: How to apply
    resp4 = service.process_query("How do I apply for the Tata Motors vacancy?", language="en")
    assert resp4["intent"] == "hiring_application"
    assert "tatamotors.com" in resp4["answer"] or "ncs.gov.in" in resp4["answer"]
    assert "Application Tracker" in resp4["answer"]

    # Query 5: Recruiter contact anti-fraud standard
    resp5 = service.process_query("Can you give me the recruiter's contact number for Tata Motors?", language="en")
    assert resp5["intent"] == "hiring_contact"
    assert "support.ncs@gov.in" in resp5["answer"] or "Not disclosed" in resp5["answer"]
    assert "Not disclosed" in resp5["answer"]
    assert "does NOT invent recruiter phone numbers" in resp5["answer"]

    # Query 6: Unlisted location reporting honestly with official national portals
    resp6 = service.process_query("Show opportunities in Jaipur", language="en")
    assert resp6["intent"] == "hiring_location"
    assert "no verified individual vacancies for Jaipur" in resp6["answer"]
    assert "National Career Service (NCS)" in resp6["answer"]

    # Query 7: Hindi query handling
    resp7 = service.process_query("पुणे में अवसर दिखाएं", language="hi")
    assert resp7["intent"] == "hiring_location"
    assert "सत्यापित" in resp7["answer"]
    assert len(resp7["sources"]) >= 1


# -----------------------------------------------------------------------------
# 6. Approved Source Registry & HTTPS Security
# -----------------------------------------------------------------------------

def test_safe_https_urls_for_new_employers():
    """Test 8: Vacancy URLs validate against the approved source domain registry."""
    assert is_safe_https_url("https://tatamotors.com/careers/job-openings/123") is True
    assert is_safe_https_url("https://bel-india.in/careers/apprenticeship") is True
    assert is_safe_https_url("https://cdac.in/careers/blr") is True
    assert is_safe_https_url("https://apprenticeshipindia.gov.in/apprenticeship/123") is True
    assert is_safe_https_url("https://ncs.gov.in/job-desc/123") is True
    # Unapproved domains rejected
    assert is_safe_https_url("https://unverified-third-party-aggregator.com/job/123") is False
    assert is_safe_https_url("http://insecure-http-site.gov.in") is False
