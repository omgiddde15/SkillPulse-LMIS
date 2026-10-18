"""Comprehensive authentication and scenario isolation tests for SkillPulse LMIS.

Tests verify:
- Registration, validation, duplicate email prevention
- Password hashing with bcrypt (no plaintext storage)
- Login, generic error messages (no email enumeration)
- Server-side session generation and restoration via HttpOnly cookie
- Logout and session invalidation
- Expired or invalid session handling
- Scenario creation, listing, retrieval, deletion
- Strict tenant isolation: User A cannot see, access, or delete User B's scenarios
- Unauthenticated/demo requests cannot access or save private scenarios
"""

import os
import tempfile
import pytest
from datetime import datetime, timedelta, timezone
from starlette.testclient import TestClient

from app.main import app
from app.db import init_db, get_db
import bcrypt


@pytest.fixture(autouse=True)
def isolated_test_db(monkeypatch):
    """Creates a pristine temporary SQLite database for each test to avoid pollution."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db_path = f.name

    monkeypatch.setenv("SKILLPULSE_DB_PATH", temp_db_path)
    init_db(temp_db_path)

    yield temp_db_path

    # Cleanup temporary file
    try:
        os.remove(temp_db_path)
    except OSError:
        pass


@pytest.fixture
def client():
    return TestClient(app)


def test_registration_and_password_hashing(client, isolated_test_db):
    """Verifies that registration succeeds, passwords are never stored in plaintext, and session cookie is set."""
    payload = {
        "email": "planner.officer@domain.gov.in",
        "full_name": "Regional Officer Sharma",
        "password": "SecurePassword2026",
        "confirm_password": "SecurePassword2026",
    }
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "success"
    assert data["user"]["email"] == "planner.officer@domain.gov.in"
    assert data["user"]["full_name"] == "Regional Officer Sharma"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]

    # Verify session cookie is set
    assert "sp_session" in res.cookies

    # Verify directly in SQLite that the stored password is a valid bcrypt hash
    with get_db(isolated_test_db) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT email, password_hash FROM users WHERE id = ?", (data["user"]["id"],))
        row = cursor.fetchone()
        assert row is not None
        assert row["email"] == "planner.officer@domain.gov.in"
        stored_hash = row["password_hash"]
        assert stored_hash != "SecurePassword2026"
        assert stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$")
        assert bcrypt.checkpw(b"SecurePassword2026", stored_hash.encode("utf-8")) is True


def test_registration_duplicate_email_prevention(client):
    """Verifies that duplicate registrations are rejected case-insensitively with friendly error."""
    payload = {
        "email": "officer@domain.gov.in",
        "full_name": "First Officer",
        "password": "SecurePassword1",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Attempt duplicate registration with uppercase variant
    payload_dup = {
        "email": "OFFICER@DOMAIN.GOV.IN",
        "full_name": "Second Officer",
        "password": "SecurePassword2",
    }
    res2 = client.post("/api/v1/auth/register", json=payload_dup)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


def test_registration_validation(client):
    """Verifies that short passwords, missing numbers, and invalid emails are rejected."""
    # Too short
    res = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "full_name": "Test User",
        "password": "short1",
    })
    assert res.status_code in (400, 422)

    # No number
    res = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "full_name": "Test User",
        "password": "PasswordWithoutNumber",
    })
    assert res.status_code in (400, 422)

    # Invalid email
    res = client.post("/api/v1/auth/register", json={
        "email": "invalid-email-format",
        "full_name": "Test User",
        "password": "ValidPassword123",
    })
    assert res.status_code in (400, 422)


def test_login_success_and_session_cookie(client):
    """Verifies login succeeds with correct credentials and returns session cookie."""
    # Register first
    client.post("/api/v1/auth/register", json={
        "email": "analyst@skillpulse.gov",
        "full_name": "Policy Analyst",
        "password": "AnalystPassword99",
    })

    # Login
    res = client.post("/api/v1/auth/login", json={
        "email": "analyst@skillpulse.gov",
        "password": "AnalystPassword99",
        "remember_me": True,
    })
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert "sp_session" in res.cookies


def test_login_invalid_credentials_generic_error(client):
    """Verifies generic error is returned for invalid password and non-existent email (no enumeration)."""
    # Non-existent user
    res = client.post("/api/v1/auth/login", json={
        "email": "nonexistent@domain.gov",
        "password": "AnyPassword123",
    })
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password."

    # Existing user with incorrect password
    client.post("/api/v1/auth/register", json={
        "email": "realuser@domain.gov",
        "full_name": "Real User",
        "password": "CorrectPassword123",
    })
    res_wrong = client.post("/api/v1/auth/login", json={
        "email": "realuser@domain.gov",
        "password": "WrongPassword456",
    })
    assert res_wrong.status_code == 401
    assert res_wrong.json()["detail"] == "Invalid email or password."


def test_session_restoration_via_auth_me(client):
    """Verifies /api/v1/auth/me restores user session from cookie on page refresh."""
    # Unauthenticated initial call
    res_initial = client.get("/api/v1/auth/me")
    assert res_initial.status_code == 200
    assert res_initial.json() == {"authenticated": False, "user": None}

    # Register sets cookie
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "refresh.user@domain.gov",
        "full_name": "Refresh User",
        "password": "MyPassword2026",
    })
    session_cookie = reg_res.cookies.get("sp_session")

    # Simulate page refresh with session cookie
    client.cookies.set("sp_session", session_cookie)
    res_me = client.get("/api/v1/auth/me")
    assert res_me.status_code == 200
    data = res_me.json()
    assert data["authenticated"] is True
    assert data["user"]["email"] == "refresh.user@domain.gov"
    assert data["user"]["full_name"] == "Refresh User"


def test_logout_and_session_invalidation(client, isolated_test_db):
    """Verifies logout deletes the server-side session and subsequent requests are unauthenticated."""
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "logout.user@domain.gov",
        "full_name": "Logout Tester",
        "password": "LogoutPassword123",
    })
    session_id = reg_res.cookies.get("sp_session")
    client.cookies.set("sp_session", session_id)

    # Perform logout
    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200

    # Verify session row was removed from database
    with get_db(isolated_test_db) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,))
        assert cursor.fetchone() is None

    # Subsequent /api/v1/auth/me returns unauthenticated
    res_after = client.get("/api/v1/auth/me")
    assert res_after.json() == {"authenticated": False, "user": None}


def test_expired_session_handling(client, isolated_test_db):
    """Verifies that an expired session is pruned and rejected."""
    # Register user
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "expired.user@domain.gov",
        "full_name": "Expired Tester",
        "password": "ExpiredPassword123",
    })
    user_id = reg_res.json()["user"]["id"]

    # Manually insert an expired session
    expired_session_id = "test_expired_session_token_xyz"
    past_date = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    with get_db(isolated_test_db) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (expired_session_id, user_id, past_date, past_date)
        )
        conn.commit()

    # Attempt to use expired session
    client.cookies.set("sp_session", expired_session_id)
    res = client.get("/api/v1/auth/me")
    assert res.json() == {"authenticated": False, "user": None}

    # Verify it was cleaned up
    with get_db(isolated_test_db) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE session_id = ?", (expired_session_id,))
        assert cursor.fetchone() is None


def test_scenario_creation_and_ownership_isolation(client):
    """
    Verifies that:
    1. Unauthenticated users cannot list or save scenarios (401).
    2. User A can save and view their scenarios.
    3. User B cannot see, access, or delete User A's scenarios (strict isolation).
    """
    # 1. Unauthenticated attempt
    client.cookies.clear()
    unauth_list = client.get("/api/v1/scenarios")
    assert unauth_list.status_code == 401

    unauth_save = client.post("/api/v1/scenarios", json={
        "title": "Unauthorized Plan",
        "period": "2026-09",
        "district_id": "KA_DHA",
        "occupation_id": "OCC_MFG_001",
        "horizon_months": 3,
        "proposed_seats_per_cohort": 100,
    })
    assert unauth_save.status_code == 401

    # 2. Register User A
    res_a = client.post("/api/v1/auth/register", json={
        "email": "officer.a@state.gov",
        "full_name": "Officer Alice",
        "password": "PasswordAlice1",
    })
    cookie_a = res_a.cookies.get("sp_session")

    # User A saves a scenario
    client.cookies.set("sp_session", cookie_a)
    scenario_payload = {
        "title": "Dharwad CNC Precision Expansion Q3",
        "notes": "Targeted reallocation for manufacturing corridor demand.",
        "period": "2026-09",
        "district_id": "KA_DHA",
        "district_name": "Dharwad",
        "state_code": "KA",
        "occupation_id": "OCC_MFG_001",
        "occupation_title": "CNC Machine Operator",
        "horizon_months": 3,
        "proposed_seats_per_cohort": 180,
        "posting_to_opening_multiplier": 1.2,
        "local_availability_factor": 0.85,
        "inputs": {"district_id": "KA_DHA", "seats": 180},
        "results": {"simulated_relative_mismatch": 42.5, "delta": -13.6},
    }
    save_res = client.post("/api/v1/scenarios", json=scenario_payload)
    assert save_res.status_code == 201
    scenario_a = save_res.json()["scenario"]
    scenario_a_id = scenario_a["id"]
    assert scenario_a["title"] == "Dharwad CNC Precision Expansion Q3"
    assert "Simulated Scenario" in scenario_a["disclaimer"]

    # User A lists scenarios -> 1 record
    list_a = client.get("/api/v1/scenarios")
    assert list_a.status_code == 200
    assert list_a.json()["count"] == 1
    assert list_a.json()["results"][0]["id"] == scenario_a_id

    # 3. Register User B
    client.cookies.clear()
    res_b = client.post("/api/v1/auth/register", json={
        "email": "officer.b@state.gov",
        "full_name": "Officer Bob",
        "password": "PasswordBob123",
    })
    cookie_b = res_b.cookies.get("sp_session")
    client.cookies.set("sp_session", cookie_b)

    # User B lists scenarios -> 0 records (isolated!)
    list_b = client.get("/api/v1/scenarios")
    assert list_b.status_code == 200
    assert list_b.json()["count"] == 0
    assert list_b.json()["results"] == []

    # User B attempts to GET User A's scenario -> 404 access denied
    get_cross = client.get(f"/api/v1/scenarios/{scenario_a_id}")
    assert get_cross.status_code == 404

    # User B attempts to DELETE User A's scenario -> 404 access denied
    del_cross = client.delete(f"/api/v1/scenarios/{scenario_a_id}")
    assert del_cross.status_code == 404

    # 4. User A deletes their own scenario
    client.cookies.set("sp_session", cookie_a)
    del_own = client.delete(f"/api/v1/scenarios/{scenario_a_id}")
    assert del_own.status_code == 200

    list_a_after = client.get("/api/v1/scenarios")
    assert list_a_after.json()["count"] == 0


def test_registration_and_login_return_token(client):
    """Verifies that register and login return session token and session_id in JSON payload."""
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "token_check@domain.gov",
        "full_name": "Token Check User",
        "password": "Password123!",
    })
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "token" in reg_data
    assert "session_id" in reg_data
    assert len(reg_data["token"]) >= 32
    assert reg_data["token"] == reg_data["session_id"]

    login_res = client.post("/api/v1/auth/login", json={
        "email": "token_check@domain.gov",
        "password": "Password123!",
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "token" in login_data
    assert "session_id" in login_data
    assert login_data["token"] == login_data["session_id"]


def test_bearer_token_session_restoration_and_protected_access(client):
    """Verifies Bearer token restores session via /me and authorizes protected career endpoints without cookies."""
    # Register user to get session token
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "bearer_candidate@domain.gov",
        "full_name": "Bearer Candidate",
        "password": "Password123!",
    })
    token = reg_res.json()["token"]

    # Clear all cookies to strictly test Bearer header auth
    client.cookies.clear()

    # 1. Unauthenticated request without credentials must be rejected
    unauth_resp = client.get("/api/v1/career/profile")
    assert unauth_resp.status_code == 401
    assert "Authentication required" in unauth_resp.json()["detail"]

    # 2. Session restoration via /me using Bearer token
    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["authenticated"] is True
    assert me_resp.json()["user"]["email"] == "bearer_candidate@domain.gov"

    # 3. Access protected workspace resource via Bearer token
    profile_resp = client.get("/api/v1/career/profile", headers={"Authorization": f"Bearer {token}"})
    assert profile_resp.status_code == 200
    assert profile_resp.json()["has_profile"] is False  # valid candidate with no profile yet

    # 4. Invalid Bearer token must be rejected
    invalid_resp = client.get("/api/v1/career/profile", headers={"Authorization": "Bearer invalid_nonexistent_token"})
    assert invalid_resp.status_code == 401

    # 5. Logout using Bearer token invalidates session
    logout_resp = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_resp.status_code == 200

    # 6. Post-logout request with invalidated token must be rejected
    post_logout_resp = client.get("/api/v1/career/profile", headers={"Authorization": f"Bearer {token}"})
    assert post_logout_resp.status_code == 401


def test_https_cookie_attributes_samesite_none_secure(client):
    """Verifies that reverse-proxied HTTPS requests (e.g. on Render) set SameSite=None and Secure=True."""
    res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "test@nonexistent.gov",
            "password": "Password123!",
        },
        headers={"X-Forwarded-Proto": "https"},
    )
    # Even if 401, test login with real user over HTTPS
    client.post("/api/v1/auth/register", json={
        "email": "https_cookie_user@domain.gov",
        "full_name": "HTTPS User",
        "password": "Password123!",
    })
    res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "https_cookie_user@domain.gov",
            "password": "Password123!",
        },
        headers={"X-Forwarded-Proto": "https"},
    )
    assert res.status_code == 200
    raw_cookies = res.headers.get_list("set-cookie")
    assert any("samesite=none" in c.lower() and "secure" in c.lower() for c in raw_cookies)
