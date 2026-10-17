"""Tests for Cross-Origin Resource Sharing (CORS) Configuration.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Verifies that FastAPI properly handles:
- Local development origins (localhost, 127.0.0.1)
- Vercel production and preview deployment domains (*.vercel.app)
- Preflight OPTIONS requests for authenticated endpoints
- Credentials support (Access-Control-Allow-Credentials: true)
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_cors_local_dev_origin():
    """Verify local development origins receive CORS headers."""
    resp = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert resp.headers.get("access-control-allow-credentials") == "true"


def test_cors_vercel_production_origin():
    """Verify Vercel production domains match regex and receive CORS headers."""
    resp = client.get("/health", headers={"Origin": "https://skillpulse.vercel.app"})
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "https://skillpulse.vercel.app"
    assert resp.headers.get("access-control-allow-credentials") == "true"


def test_cors_vercel_preview_origin():
    """Verify arbitrary Vercel preview deployment URLs match regex."""
    resp = client.get(
        "/api/v1/metadata",
        headers={"Origin": "https://skillpulse-lmis-git-feature-omgiddde15.vercel.app"},
    )
    assert resp.status_code == 200
    assert (
        resp.headers.get("access-control-allow-origin")
        == "https://skillpulse-lmis-git-feature-omgiddde15.vercel.app"
    )
    assert resp.headers.get("access-control-allow-credentials") == "true"


def test_cors_options_preflight():
    """Verify OPTIONS preflight request succeeds with correct allow headers."""
    resp = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "https://skillpulse.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "https://skillpulse.vercel.app"
    assert "POST" in resp.headers.get("access-control-allow-methods", "")
    assert resp.headers.get("access-control-allow-credentials") == "true"


def test_cors_disallows_untrusted_origin():
    """Verify non-whitelisted, non-Vercel origins do not receive allow-origin header."""
    resp = client.get("/health", headers={"Origin": "https://evil-hacker.com"})
    assert resp.status_code == 200
    assert "access-control-allow-origin" not in resp.headers
