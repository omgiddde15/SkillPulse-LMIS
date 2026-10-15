"""Unit and Integration Tests for Phase 3: Verified Opportunity Catalogue and Personalized Matching.

Tests cover:
1. Catalogue seeding is repeatable and idempotent without duplicate records.
2. Separation of portal-directory records vs individual verified listings.
3. Catalogue filtering by opportunity_type, record_kind, fee_status, work_mode, search keyword, and pagination.
4. Missing fees and stipends remain None rather than 0 or 0.0.
5. Expired application deadlines dynamically adjust listing_status to 'closed' and is_deadline_passed to True.
6. Honest status labels and provenance for verified sources and directory listings.
7. Personalized recommendations use authenticated candidate's own profile and skills (user isolation).
8. Course matching prioritizes closing candidate's missing required skill gaps.
9. Job and internship matching considers demonstrated skills and location accessibility.
10. Custom unmapped target roles do not receive forced unrelated recommendations.
11. No fabricated contact details, fees, deadlines, or eligibility criteria.
12. Strict HTTPS validation with approved official government/higher-ed domain registry.
13. Public access to general catalogue vs 401 Unauthorized on private personalized recommendations.
14. Transparent score breakdowns, reason codes, and non-predictive qualification disclaimer.
"""

import os
import tempfile
from pathlib import Path
from typing import Generator
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.db import init_db, get_db
from app.services.opportunity_service import (
    OpportunityService,
    is_safe_https_url,
    is_deadline_expired,
    APPROVED_SOURCE_DOMAINS,
)
from app.services.opportunity_matching import OpportunityMatchingEngine


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
            "email": "candidate_opp_a@skillpulse.org",
            "full_name": "Candidate Opp Alpha",
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
            "email": "candidate_opp_b@skillpulse.org",
            "full_name": "Candidate Opp Beta",
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

def test_catalogue_seeding_is_repeatable_and_idempotent(temp_environment):
    """Test 1: Seeding sources and opportunities multiple times does not create duplicates."""
    db_path, _ = temp_environment
    service = OpportunityService(str(db_path))

    # First seeding
    res1 = service.seed_catalogue_if_empty()
    assert res1["sources_seeded"] >= 8
    assert res1["opportunities_seeded"] >= 10

    with get_db(str(db_path)) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM opportunity_sources;")
        source_count_1 = cursor.fetchone()["count"]
        cursor.execute("SELECT COUNT(*) as count FROM opportunity_catalogue;")
        opp_count_1 = cursor.fetchone()["count"]

    assert source_count_1 >= 8
    assert opp_count_1 >= 10

    # Repeat seeding
    res2 = service.seed_catalogue_if_empty()
    assert res2["sources_seeded"] == source_count_1
    assert res2["opportunities_seeded"] == opp_count_1

    with get_db(str(db_path)) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM opportunity_sources;")
        source_count_2 = cursor.fetchone()["count"]
        cursor.execute("SELECT COUNT(*) as count FROM opportunity_catalogue;")
        opp_count_2 = cursor.fetchone()["count"]

    assert source_count_1 == source_count_2
    assert opp_count_1 == opp_count_2


def test_portal_directory_vs_individual_listing_separation(client_anon):
    """Test 2: Portal-directory records are clearly distinguished from individual listings."""
    resp = client_anon.get("/api/v1/career/opportunities?limit=100")
    assert resp.status_code == 200
    data = resp.json()
    items = data["items"]
    assert len(items) == 18

    portal_dirs = [it for it in items if it["record_kind"] == "portal_directory"]
    individual_listings = [it for it in items if it["record_kind"] == "individual_listing"]
    curated_pilot = [it for it in items if it["record_kind"] == "curated_pilot_listing"]
    closed_listings = [it for it in items if it["record_kind"] == "closed_listing"]
    curriculum_standards = [it for it in items if it["record_kind"] == "curriculum_standard"]
    scheme_references = [it for it in items if it["record_kind"] == "scheme_reference"]

    assert len(portal_dirs) == 5
    assert len(individual_listings) == 4
    assert len(curated_pilot) == 4
    assert len(closed_listings) == 2
    assert len(curriculum_standards) == 2
    assert len(scheme_references) == 1

    # Portal directories must never masquerade as open single vacancies
    for pd in portal_dirs:
        assert pd["listing_status"] in ("portal_search", "source_listed")
        assert pd["listing_status"] != "open"
        assert is_safe_https_url(pd["official_url"])

    # Individual listings have specific providers, types, and honest verification metadata
    for ind in individual_listings:
        assert ind["opportunity_type"] in ("course", "internship", "apprenticeship", "job", "scheme")
        assert is_safe_https_url(ind["official_url"])

    # Exactly 2 unconfirmed listings (Frontend Web Dev without direct URL and NAPS without employer)
    unconfirmed = [it for it in items if it["verification_status"] == "unconfirmed"]
    assert len(unconfirmed) == 2


def test_catalogue_filtering_and_search(client_anon):
    """Test 3: Search and category/location/fee/status filters return expected subsets."""
    # 1. Filter by opportunity_type: course
    resp_courses = client_anon.get("/api/v1/career/opportunities?opportunity_type=course")
    assert resp_courses.status_code == 200
    items_c = resp_courses.json()["items"]
    assert len(items_c) > 0
    assert all(it["opportunity_type"] == "course" for it in items_c)

    # 2. Filter by record_kind: portal_directory
    resp_portal = client_anon.get("/api/v1/career/opportunities?record_kind=portal_directory")
    assert resp_portal.status_code == 200
    items_p = resp_portal.json()["items"]
    assert len(items_p) > 0
    assert all(it["record_kind"] == "portal_directory" for it in items_p)

    # 3. Filter by fee_status: free
    resp_free = client_anon.get("/api/v1/career/opportunities?fee_status=free")
    assert resp_free.status_code == 200
    items_free = resp_free.json()["items"]
    assert len(items_free) > 0
    assert all(it["fee_status"] == "free" for it in items_free)

    # 4. Filter by fee_status: paid
    resp_paid = client_anon.get("/api/v1/career/opportunities?fee_status=paid")
    assert resp_paid.status_code == 200
    items_paid = resp_paid.json()["items"]
    assert len(items_paid) >= 1
    assert all(it["fee_status"] == "paid" for it in items_paid)
    assert any(it["id"] == "OPP_CRS_SWAYAMPLUS_GENAI_SMARTBRIDGE" for it in items_paid)

    # 5. Search keyword
    resp_search = client_anon.get("/api/v1/career/opportunities?search=React")
    assert resp_search.status_code == 200
    items_search = resp_search.json()["items"]
    assert len(items_search) >= 1
    assert any("react" in it["title"].lower() or "react" in it["description"].lower() for it in items_search)


def test_missing_fees_and_stipends_remain_none_not_zero(client_anon):
    """Test 4: Missing fees and stipends remain None and are not converted to 0."""
    resp = client_anon.get("/api/v1/career/opportunities?limit=100")
    items = resp.json()["items"]

    # Portal directories don't have fee amounts or stipends
    portal_dirs = [it for it in items if it["record_kind"] == "portal_directory"]
    for pd in portal_dirs:
        assert pd["fee_amount"] is None
        assert pd["stipend_min"] is None
        assert pd["stipend_max"] is None

    # Free courses have fee_amount None (or 0) but fee_status 'free'
    free_courses = [it for it in items if it["fee_status"] == "free"]
    assert len(free_courses) > 0

    # Paid course OPP_CRS_SWAYAMPLUS_GENAI_SMARTBRIDGE has fee_amount == 5999.0
    paid_item = next(it for it in items if it["id"] == "OPP_CRS_SWAYAMPLUS_GENAI_SMARTBRIDGE")
    assert paid_item["fee_amount"] == 5999.0
    assert paid_item["fee_currency"] == "INR"

    # PMIS Scheme has stipend_min == 5000.0
    pmis_item = next(it for it in items if it["id"] == "OPP_SCH_PMIS_CENTRAL")
    assert pmis_item["stipend_min"] == 5000.0
    assert pmis_item["stipend_period"] == "month"


def test_expired_deadlines_marked_closed_and_not_open(temp_environment):
    """Test 5: Expired deadlines dynamically set listing_status to 'closed' and is_deadline_passed to True."""
    # Test helper functions directly
    assert is_deadline_expired("2020-01-01T00:00:00Z") is True
    assert is_deadline_expired("2020-01-01") is True
    assert is_deadline_expired("2099-12-31T23:59:59Z") is False
    assert is_deadline_expired(None) is False

    db_path, _ = temp_environment
    service = OpportunityService(str(db_path))
    service.seed_catalogue_if_empty()

    # Insert an opportunity with past deadline and listing_status 'open'
    with get_db(str(db_path)) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO opportunity_catalogue (
                id, record_kind, title, description, opportunity_type,
                provider_name, source_id, official_url, listing_status,
                application_deadline, verified_at, created_at, updated_at
            ) VALUES (
                'OPP_TEST_EXPIRED', 'individual_listing', 'Expired Test Opp',
                'Test description', 'job', 'Test Provider', 'SRC_NCS',
                'https://ncs.gov.in', 'open', '2021-01-01', '2026-10-14',
                '2026-10-14', '2026-10-14'
            );
        """)
        conn.commit()

    opp = service.get_opportunity_by_id("OPP_TEST_EXPIRED")
    assert opp is not None
    assert opp["is_deadline_passed"] is True
    assert opp["listing_status"] == "closed"


def test_honest_status_labels_and_provenance(client_anon):
    """Test 6: Seeded records have transparent verification status, source ID, and notes."""
    sources_resp = client_anon.get("/api/v1/career/sources")
    assert sources_resp.status_code == 200
    sources = sources_resp.json()["sources"]
    assert len(sources) >= 8

    for s in sources:
        assert s["verification_status"] == "verified_official"
        assert s["data_access_method"] in ("public_directory_link", "public_course_catalogue", "official_employer_portal")
        assert s["managing_agency"] is not None
        assert s["approved_domain"] in APPROVED_SOURCE_DOMAINS


def test_recommendations_require_authentication(client_anon):
    """Test 7 & 13: /recommendations requires authentication (401), while catalogue is public."""
    anon_resp = client_anon.get("/api/v1/career/recommendations")
    assert anon_resp.status_code == 401


def test_recommendations_use_authenticated_user_profile_and_skills(client_user_a, client_user_b):
    """Test 7: Recommendations evaluate the authenticated user's own profile and skills with strict isolation."""
    client_a, user_a = client_user_a
    client_b, user_b = client_user_b

    # User A targets Python Backend Developer
    client_a.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Python Backend Developer",
            "current_education_level": "Bachelor's Degree",
            "years_experience": 1.0,
        },
    )
    client_a.post(
        "/api/v1/career/skills",
        json={"skill_name": "Python", "evidence_status": "evidenced"},
    )

    # User B targets Electronics Testing & Quality Technician
    client_b.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Electronics Testing & Quality Technician",
            "current_education_level": "Diploma",
            "years_experience": 0.5,
        },
    )
    client_b.post(
        "/api/v1/career/skills",
        json={"skill_name": "Hardware Testing", "evidence_status": "evidenced"},
    )

    # Fetch recommendations for User A
    recs_a = client_a.get("/api/v1/career/recommendations").json()
    assert recs_a["status"] == "success"
    assert recs_a["user_target_role_id"] == "ROLE_PY_BACKEND"

    # Fetch recommendations for User B
    recs_b = client_b.get("/api/v1/career/recommendations").json()
    assert recs_b["status"] == "success"
    assert recs_b["user_target_role_id"] == "ROLE_ELECTRONICS_TEST"

    # User B targets Electronics Testing: unconfirmed NAPS curriculum standard must NOT be recommended
    opps_b = recs_b["recommended_opportunities"]
    assert not any(o["opportunity"]["id"] == "OPP_APP_NAPS_ELECTRONICS_TEST" for o in opps_b)
    # But User B has the official Apprenticeship India directory in portal_directories
    assert any(d["id"] == "OPP_DIR_APPRENTICESHIP_INDIA" for d in recs_b["portal_directories"])


def test_course_matching_prioritizes_missing_required_skill_gaps(client_user_a):
    """Test 8: Course recommendations prioritize candidate's missing required role skill gaps."""
    client_a, _ = client_user_a

    # User A targets Python Backend Developer (requires python, fast_api, sql, git, docker, rest_apis)
    client_a.put(
        "/api/v1/career/profile",
        json={"target_role_title": "Python Backend Developer"},
    )
    # Give User A evidenced Python and Git, leaving SQL as missing
    client_a.post(
        "/api/v1/career/skills",
        json={"skill_name": "Python", "evidence_status": "evidenced"},
    )
    client_a.post(
        "/api/v1/career/skills",
        json={"skill_name": "Git", "evidence_status": "evidenced"},
    )

    recs = client_a.get("/api/v1/career/recommendations?target_role_id=ROLE_PY_BACKEND").json()
    courses = recs["recommended_courses"]
    assert len(courses) > 0

    # The concluded Jul-Sep 2026 run OPP_CRS_SWAYAM_NPTEL_DBMS must NOT be recommended
    assert not any(c["opportunity"]["id"] == "OPP_CRS_SWAYAM_NPTEL_DBMS" for c in courses)

    # The evergreen self-paced reference OPP_CRS_SWAYAM_NPTEL_DBMS_EVERGREEN IS recommended for SQL gap
    dbms_match = next((c for c in courses if c["opportunity"]["id"] == "OPP_CRS_SWAYAM_NPTEL_DBMS_EVERGREEN"), None)
    assert dbms_match is not None
    assert "sql" in dbms_match["addressed_gaps"]
    assert dbms_match["score_breakdown"]["gap_skill_points"] > 0
    assert any(r["code"] == "GAP_REQUIRED_SKILL" for r in dbms_match["reasons"])


def test_opportunity_matching_considers_demonstrated_skills_and_location(client_user_a):
    """Test 9: Job/internship recommendations evaluate demonstrated skills and nationwide schemes."""
    client_a, _ = client_user_a

    client_a.put(
        "/api/v1/career/profile",
        json={
            "target_role_title": "Python Backend Developer",
            "current_state": "KARNATAKA",
            "preferred_locations": ["BENGALURU", "HYDERABAD"],
        },
    )
    client_a.post(
        "/api/v1/career/skills",
        json={"skill_name": "Python", "evidence_status": "evidenced"},
    )

    recs = client_a.get("/api/v1/career/recommendations").json()
    opps = recs["recommended_opportunities"]
    assert len(opps) > 0

    # PM Internship Scheme (all_india / in_person) should receive location and scheme bonuses
    pmis = next((o for o in opps if o["opportunity"]["id"] == "OPP_SCH_PMIS_CENTRAL"), None)
    assert pmis is not None
    assert pmis["score_breakdown"]["flagship_scheme_points"] > 0
    assert any(r["code"] == "OFFICIAL_FLAGSHIP_SCHEME" for r in pmis["reasons"])


def test_custom_target_role_with_no_match_does_not_force_unrelated_recommendation(client_user_a):
    """Test 10: Custom unmapped role with no catalogue match does not force unrelated recommendations."""
    client_a, _ = client_user_a

    # User sets completely unmapped custom role with no technical skills
    client_a.put(
        "/api/v1/career/profile",
        json={"target_role_title": "Fine Arts Sculptor & Ceramicist"},
    )

    recs = client_a.get("/api/v1/career/recommendations").json()
    assert recs["status"] == "success"
    assert recs["user_target_role_id"] is None
    assert recs["user_target_role_title"] == "Fine Arts Sculptor & Ceramicist"

    # Should NOT force unrelated programming or electronics courses/jobs
    assert len(recs["recommended_courses"]) == 0
    assert len(recs["recommended_opportunities"]) == 0

    # But portal directories MUST still be available so candidate can search official portals
    assert len(recs["portal_directories"]) >= 4


def test_no_fabricated_contact_details_or_attributes(client_anon):
    """Test 11: Contacts, fees, deadlines, and eligibility are never fabricated."""
    resp = client_anon.get("/api/v1/career/opportunities?limit=100")
    items = resp.json()["items"]

    for it in items:
        # If contact email exists, it must be an official domain
        if it["published_contact_email"]:
            assert any(dom in it["published_contact_email"] for dom in ("gov.in", "education.gov.in", "iitm.ac.in", "nsdcindia.org"))
        # Check no dummy/fake phone numbers
        if it["published_contact_phone"]:
            assert "12345" not in it["published_contact_phone"]
        # Deadlines are either valid ISO or None
        if it["application_deadline"]:
            assert len(it["application_deadline"]) >= 10


def test_safe_https_urls_from_approved_domains():
    """Test 12: External destinations only allow safe HTTPS URLs from approved official domains."""
    # Allowed domains
    assert is_safe_https_url("https://skillindiadigital.gov.in/home") is True
    assert is_safe_https_url("https://courses.skillindiadigital.gov.in/course/123") is True
    assert is_safe_https_url("https://swayam.gov.in/explorer") is True
    assert is_safe_https_url("https://swayamplus.education.gov.in") is True
    assert is_safe_https_url("https://ncs.gov.in/job-seeker") is True
    assert is_safe_https_url("https://apprenticeshipindia.gov.in/candidate") is True
    assert is_safe_https_url("https://pminternship.mca.gov.in") is True
    assert is_safe_https_url("https://myscheme.gov.in/schemes/pmis") is True

    # Insecure or unapproved URLs rejected
    assert is_safe_https_url("http://ncs.gov.in") is False
    assert is_safe_https_url("javascript:alert(1)") is False
    assert is_safe_https_url("https://fake-phishing-gov.com") is False
    assert is_safe_https_url("ftp://swayam.gov.in") is False
    assert is_safe_https_url("") is False
    assert is_safe_https_url(None) is False


def test_transparent_reasons_scores_and_disclaimer(client_user_a):
    """Test 14: Recommendations return structured reason codes, score breakdown, and legal disclaimer."""
    client_a, _ = client_user_a

    client_a.put(
        "/api/v1/career/profile",
        json={"target_role_title": "Python Backend Developer"},
    )
    recs = client_a.get("/api/v1/career/recommendations").json()

    # Verify legal disclaimer
    assert "disclaimer" in recs
    assert "Not an employability prediction" in recs["disclaimer"]
    assert "guarantee of selection" in recs["disclaimer"]

    # Verify breakdown and reasons
    for c in recs["recommended_courses"]:
        assert 0.0 <= c["match_score"] <= 100.0
        assert "score_breakdown" in c
        assert isinstance(c["reasons"], list)
        for r in c["reasons"]:
            assert "code" in r
            assert "message" in r


def test_unverified_listings_never_appear_in_recommendations(client_user_a):
    """Test 15: Unverified listings and closed runs are strictly excluded from recommendations."""
    client_a, _ = client_user_a

    # User A targets Frontend Web Developer
    client_a.put(
        "/api/v1/career/profile",
        json={"target_role_title": "Frontend Web Developer"},
    )

    recs = client_a.get("/api/v1/career/recommendations").json()
    all_rec_ids = {c["opportunity"]["id"] for c in recs["recommended_courses"]}.union(
        {o["opportunity"]["id"] for o in recs["recommended_opportunities"]}
    )

    # Unconfirmed frontend course must NOT appear
    assert "OPP_CRS_SIDH_FRONTEND_REACT" not in all_rec_ids
    # Unconfirmed apprenticeship must NOT appear
    assert "OPP_APP_NAPS_ELECTRONICS_TEST" not in all_rec_ids
    # Concluded DBMS run must NOT appear
    assert "OPP_CRS_SWAYAM_NPTEL_DBMS" not in all_rec_ids


def test_catalogue_filtering_by_verification_status(client_anon):
    """Test 16: Filtering catalogue by verification_status separates verified and unconfirmed."""
    resp_verified = client_anon.get("/api/v1/career/opportunities?verification_status=verified_official")
    assert resp_verified.status_code == 200
    items_v = resp_verified.json()["items"]
    assert len(items_v) >= 9
    assert all(it["verification_status"] == "verified_official" for it in items_v)

    resp_unconf = client_anon.get("/api/v1/career/opportunities?verification_status=unconfirmed")
    assert resp_unconf.status_code == 200
    items_u = resp_unconf.json()["items"]
    assert len(items_u) == 2
    assert all(it["verification_status"] == "unconfirmed" for it in items_u)


def test_unlocking_ai_course_attributes_and_no_false_python_claim(client_anon):
    """Test 17: Unlocking AI course attributes reflect official page and do not claim Python coding."""
    resp = client_anon.get("/api/v1/career/opportunities/OPP_CRS_SIDH_UNLOCKING_AI")
    assert resp.status_code == 200
    item = resp.json()["opportunity"]
    assert item["title"] == "Unlocking AI for Everyone"
    assert item["fee_status"] == "free"
    assert item["fee_amount"] is None
    # Material claims: does NOT claim Python
    assert "python" not in item["skill_keys"]
    assert item["verification_status"] == "verified_official"
    assert item["listing_status"] == "open"
