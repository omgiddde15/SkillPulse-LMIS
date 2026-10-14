"""Offline Automated Unit and Integration Tests for IBM watsonx.ai Provider.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Validates provider configuration, IAM token caching, structured JSON inference,
error mappings, rate limits, timeouts, privacy assertions, and fallback safety.
"""

from __future__ import annotations

import json
import time
from unittest.mock import patch, MagicMock
import pytest
import httpx
from pydantic import BaseModel, Field

from app.ai.base import (
    AIProviderError,
    AITimeoutError,
    AIRateLimitError,
    AISchemaValidationError,
)
from app.ai.watsonx_provider import (
    WatsonxProvider,
    IBM_IAM_TOKEN_URL,
)
from app.ai.ai_service import AIService, AIRoadmapOutput
from app.ai.prompts import assert_payload_privacy


class SampleOutputSchema(BaseModel):
    title: str = Field(...)
    score: int = Field(...)


def create_mock_response(status_code: int, json_data: dict) -> MagicMock:
    """Creates a mock httpx.Response object."""
    mock = MagicMock(spec=httpx.Response)
    mock.status_code = status_code
    mock.json.return_value = json_data
    return mock


# -----------------------------------------------------------------------------
# 1. Configuration Detection
# -----------------------------------------------------------------------------

def test_watsonx_missing_configuration_handled_safely(monkeypatch):
    """Verifies that an incomplete watsonx environment is marked unconfigured and raises on execution."""
    monkeypatch.delenv("WATSONX_API_KEY", raising=False)
    monkeypatch.delenv("WATSONX_PROJECT_ID", raising=False)
    monkeypatch.delenv("WATSONX_URL", raising=False)
    monkeypatch.delenv("WATSONX_MODEL_ID", raising=False)

    provider = WatsonxProvider()
    assert provider.is_configured() is False

    with pytest.raises(AIProviderError) as exc_info:
        provider.generate_structured_content("System", "User", SampleOutputSchema)
    assert "incomplete" in str(exc_info.value).lower()
    assert exc_info.value.provider == "watsonx"


def test_watsonx_partial_configuration_is_unconfigured(monkeypatch):
    """Verifies that having only some variables set still leaves provider unconfigured."""
    provider = WatsonxProvider(api_key="key123", url="https://eu-gb.ml.cloud.ibm.com")
    assert provider.is_configured() is False


def test_watsonx_complete_configuration_recognized():
    """Verifies that supplying all 4 required parameters marks provider as configured."""
    provider = WatsonxProvider(
        api_key="test-api-key",
        project_id="test-proj-uuid-1234",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )
    assert provider.is_configured() is True
    assert provider.provider_name == "IBM watsonx.ai"
    assert provider.provider_id == "watsonx"
    assert provider.model == "meta-llama/llama-3-3-70b-instruct"


# -----------------------------------------------------------------------------
# 2. IAM Token Exchange & In-Memory Caching
# -----------------------------------------------------------------------------

def test_watsonx_iam_token_request_format():
    """Verifies IAM token request sends the exact form parameters to the IAM endpoint."""
    provider = WatsonxProvider(
        api_key="secret-api-key-xyz",
        project_id="pid-123",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )

    iam_resp = create_mock_response(200, {"access_token": "token-abc-123", "expires_in": 3600})
    with patch.object(httpx.Client, "post", return_value=iam_resp) as mock_post:
        token = provider._get_iam_token(timeout_sec=5.0)
        assert token == "token-abc-123"

        mock_post.assert_called_once()
        call_args, call_kwargs = mock_post.call_args
        assert call_args[0] == IBM_IAM_TOKEN_URL
        assert call_kwargs["data"]["grant_type"] == "urn:ibm:params:oauth:grant-type:apikey"
        assert call_kwargs["data"]["apikey"] == "secret-api-key-xyz"


def test_watsonx_iam_token_caching_and_refresh_near_expiration():
    """Verifies that cached tokens prevent duplicate IAM requests, and refresh when near expiration."""
    provider = WatsonxProvider(
        api_key="test-key",
        project_id="pid-123",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )

    resp_1 = create_mock_response(200, {"access_token": "token-1", "expires_in": 3600})
    resp_2 = create_mock_response(200, {"access_token": "token-2", "expires_in": 3600})

    with patch.object(httpx.Client, "post", side_effect=[resp_1, resp_2]) as mock_post:
        # First request: fetches token 1
        t1 = provider._get_iam_token(timeout_sec=5.0)
        assert t1 == "token-1"
        assert mock_post.call_count == 1

        # Second request immediately after: reuses cached token 1 without network call
        t2 = provider._get_iam_token(timeout_sec=5.0)
        assert t2 == "token-1"
        assert mock_post.call_count == 1

        # Advance time by 3400 seconds (past the 3600 - 300 = 3300 second threshold)
        provider._token_expires_at = time.time() + 200  # only 200s left (< 300 buffer)

        # Third request: refreshes token
        t3 = provider._get_iam_token(timeout_sec=5.0)
        assert t3 == "token-2"
        assert mock_post.call_count == 2


# -----------------------------------------------------------------------------
# 3. Successful Chat Inference & Markdown Fence Stripping
# -----------------------------------------------------------------------------

def test_watsonx_successful_inference_json_parsing():
    """Verifies successful structured output parsing from watsonx choices message."""
    provider = WatsonxProvider(
        api_key="key",
        project_id="pid",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )

    iam_resp = create_mock_response(200, {"access_token": "valid-token", "expires_in": 3600})
    chat_resp = create_mock_response(200, {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": json.dumps({"title": "Junior Python Dev", "score": 88}),
                }
            }
        ]
    })

    def mock_post(url, *args, **kwargs):
        if "identity/token" in url:
            return iam_resp
        return chat_resp

    with patch.object(httpx.Client, "post", side_effect=mock_post):
        result = provider.generate_structured_content(
            system_instruction="You are a career planner.",
            user_prompt="Evaluate role.",
            response_schema=SampleOutputSchema,
        )
        assert result["title"] == "Junior Python Dev"
        assert result["score"] == 88


def test_watsonx_successful_inference_with_markdown_code_fences():
    """Verifies that markdown code blocks (```json ... ```) are cleanly stripped and parsed."""
    provider = WatsonxProvider(
        api_key="key",
        project_id="pid",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )

    iam_resp = create_mock_response(200, {"access_token": "valid-token", "expires_in": 3600})
    fenced_text = "```json\n{\"title\": \"Fenced Title\", \"score\": 95}\n```"
    chat_resp = create_mock_response(200, {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": fenced_text,
                }
            }
        ]
    })

    def mock_post(url, *args, **kwargs):
        if "identity/token" in url:
            return iam_resp
        return chat_resp

    with patch.object(httpx.Client, "post", side_effect=mock_post):
        result = provider.generate_structured_content("Sys", "User", SampleOutputSchema)
        assert result["title"] == "Fenced Title"
        assert result["score"] == 95


# -----------------------------------------------------------------------------
# 4. Error Mappings: 401, 403, 429, Timeout, Invalid JSON
# -----------------------------------------------------------------------------

def test_watsonx_invalid_json_raises_schema_validation_error():
    """Verifies non-JSON response raises AISchemaValidationError."""
    provider = WatsonxProvider(
        api_key="key",
        project_id="pid",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )

    iam_resp = create_mock_response(200, {"access_token": "valid-token", "expires_in": 3600})
    chat_resp = create_mock_response(200, {
        "choices": [{"message": {"role": "assistant", "content": "I cannot formulate this as JSON."}}]
    })

    with patch.object(httpx.Client, "post", side_effect=[iam_resp, chat_resp]):
        with pytest.raises(AISchemaValidationError):
            provider.generate_structured_content("Sys", "User", SampleOutputSchema)


def test_watsonx_authentication_failure_401_maps_to_provider_error():
    """Verifies HTTP 401 raises AIProviderError and is not retried."""
    provider = WatsonxProvider(
        api_key="bad-key",
        project_id="pid",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )

    iam_fail = create_mock_response(401, {"error": "unauthorized"})
    with patch.object(httpx.Client, "post", return_value=iam_fail) as mock_post:
        with pytest.raises(AIProviderError) as exc_info:
            provider.generate_structured_content("Sys", "User", SampleOutputSchema)
        assert exc_info.value.provider == "watsonx"
        assert mock_post.call_count == 1  # Never retried


def test_watsonx_rate_limit_429_maps_to_rate_limit_error_and_never_retried():
    """Verifies HTTP 429 raises AIRateLimitError and is never retried."""
    provider = WatsonxProvider(
        api_key="key",
        project_id="pid",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )

    iam_resp = create_mock_response(200, {"access_token": "token", "expires_in": 3600})
    rate_resp = create_mock_response(429, {"message": "Rate limit exceeded"})

    with patch.object(httpx.Client, "post", side_effect=[iam_resp, rate_resp]) as mock_post:
        with pytest.raises(AIRateLimitError):
            provider.generate_structured_content("Sys", "User", SampleOutputSchema)
        assert mock_post.call_count == 2  # 1 for IAM, 1 for inference (no retry)


def test_watsonx_timeout_maps_to_ai_timeout_error():
    """Verifies httpx.TimeoutException maps to AITimeoutError."""
    provider = WatsonxProvider(
        api_key="key",
        project_id="pid",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )

    iam_resp = create_mock_response(200, {"access_token": "token", "expires_in": 3600})
    with patch.object(httpx.Client, "post", side_effect=[iam_resp, httpx.ReadTimeout("Timeout")]):
        with pytest.raises(AITimeoutError):
            provider.generate_structured_content("Sys", "User", SampleOutputSchema)


def test_watsonx_transient_503_retry_succeeds_on_attempt_2():
    """Verifies that transient 503 error performs at most one retry and succeeds if second attempt passes."""
    provider = WatsonxProvider(
        api_key="key",
        project_id="pid",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )

    iam_resp = create_mock_response(200, {"access_token": "token", "expires_in": 3600})
    fail_503 = create_mock_response(503, {"error": "Service Unavailable"})
    success_200 = create_mock_response(200, {
        "choices": [{"message": {"content": json.dumps({"title": "Recovered", "score": 90})}}]
    })

    with patch.object(httpx.Client, "post", side_effect=[iam_resp, fail_503, success_200]) as mock_post, \
         patch("time.sleep") as mock_sleep:
        res = provider.generate_structured_content("Sys", "User", SampleOutputSchema, timeout_ms=25000)
        assert res["title"] == "Recovered"
        assert mock_post.call_count == 3  # 1 IAM, 2 chat attempts
        mock_sleep.assert_called_once_with(1.5)


# -----------------------------------------------------------------------------
# 5. Security & Sanitization
# -----------------------------------------------------------------------------

def test_watsonx_credentials_scrubbed_from_errors_and_logs():
    """Verifies that the API key and bearer token never leak into exception messages or logs."""
    provider = WatsonxProvider(
        api_key="super_secret_watsonx_api_key_value_99999",
        project_id="pid",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )

    # Force connection error
    with patch.object(httpx.Client, "post", side_effect=Exception("Failed to call super_secret_watsonx_api_key_value_99999 with Bearer token_xyz")):
        with pytest.raises(AIProviderError) as exc_info:
            provider._get_iam_token(timeout_sec=5.0)
        err_text = str(exc_info.value)
        assert "super_secret_watsonx_api_key_value_99999" not in err_text
        assert "token_xyz" not in err_text


# -----------------------------------------------------------------------------
# 6. AIService Integration & Provider Switching
# -----------------------------------------------------------------------------

def test_ai_service_watsonx_provider_selection_when_env_set(monkeypatch):
    """Verifies AIService selects WatsonxProvider when AI_PROVIDER=watsonx."""
    monkeypatch.setenv("AI_PROVIDER", "watsonx")
    monkeypatch.setenv("WATSONX_API_KEY", "env-key")
    monkeypatch.setenv("WATSONX_PROJECT_ID", "env-pid")
    monkeypatch.setenv("WATSONX_URL", "https://eu-gb.ml.cloud.ibm.com")
    monkeypatch.setenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct")

    service = AIService()
    assert service.provider.provider_id == "watsonx"
    assert service.provider.provider_name == "IBM watsonx.ai"
    assert service.is_ai_available() is True


def test_ai_service_watsonx_unconfigured_falls_back_cleanly(monkeypatch):
    """Verifies AIService reports AI unavailable and falls back without crashing when unconfigured."""
    monkeypatch.setenv("AI_PROVIDER", "watsonx")
    monkeypatch.delenv("WATSONX_API_KEY", raising=False)
    monkeypatch.delenv("WATSONX_PROJECT_ID", raising=False)
    monkeypatch.delenv("WATSONX_URL", raising=False)
    monkeypatch.delenv("WATSONX_MODEL_ID", raising=False)

    service = AIService()
    assert service.provider.provider_id == "watsonx"
    assert service.is_ai_available() is False


def test_ai_service_default_provider_remains_gemini(monkeypatch):
    """Verifies AIService defaults to Gemini when AI_PROVIDER is not set."""
    monkeypatch.delenv("AI_PROVIDER", raising=False)
    service = AIService()
    assert service.provider.provider_id == "gemini"
    assert service.provider.provider_name == "Google Gemini"


def test_watsonx_full_roadmap_generation_pipeline(monkeypatch):
    """End-to-end integration: AIService generates roadmap using mocked WatsonxProvider and returns structured data."""
    provider = WatsonxProvider(
        api_key="key",
        project_id="pid",
        url="https://eu-gb.ml.cloud.ibm.com",
        model="meta-llama/llama-3-3-70b-instruct",
    )
    service = AIService(provider=provider)

    mock_roadmap = {
        "summary": "Watsonx generated backend development roadmap.",
        "methodology_note": "Personalized using Granite 3.3.",
        "milestones": [
            {
                "milestone_order": 1,
                "title": "Master Backend Python",
                "description": "Deep dive into asynchronous programming.",
                "target_skill_keys": ["python"],
                "action_type": "learn",
                "suggested_duration_days": 15,
                "prerequisites": [],
                "linked_opportunity_id": "OPP_CRS_1",
            },
            {
                "milestone_order": 2,
                "title": "Build FastAPI Microservice",
                "description": "Construct high-throughput endpoints.",
                "target_skill_keys": ["fastapi"],
                "action_type": "build_project",
                "suggested_duration_days": 15,
                "prerequisites": ["python"],
                "linked_opportunity_id": None,
            },
        ],
    }

    with patch.object(WatsonxProvider, "generate_structured_content", return_value=mock_roadmap):
        result = service.generate_roadmap(
            role_info={"role_id": "ROLE_BACKEND", "title": "Backend Developer", "sector": "IT"},
            gap_summary={"missing_required": [{"skill_key": "python", "name": "Python"}]},
            horizon_days=30,
            weekly_hours=10,
            verified_opportunities=[{
                "id": "OPP_CRS_1",
                "title": "Verified Course",
                "opportunity_type": "course",
                "provider_name": "NPTEL",
                "skill_keys": ["python"],
                "fee_status": "free",
            }],
            allowed_skill_keys=["python", "fastapi"],
        )

        assert result is not None
        assert result["generation_mode"] == "ai_assisted"
        assert "IBM watsonx.ai (meta-llama/llama-3-3-70b-instruct)" in result["methodology_note"]
        assert len(result["milestones"]) == 2
        assert result["milestones"][0]["linked_opportunity_id"] == "OPP_CRS_1"


# -----------------------------------------------------------------------------
# 7. Privacy Verification
# -----------------------------------------------------------------------------

def test_watsonx_privacy_guard_enforced():
    """Verifies that assert_payload_privacy prevents PII from ever reaching any LLM payload."""
    leaky_payload = {
        "candidate_name": "Aarav Sharma",
        "email": "aarav@example.com",
        "role": "Python Developer",
    }
    with pytest.raises(ValueError) as exc_info:
        assert_payload_privacy(leaky_payload)
    assert "prohibited identifier" in str(exc_info.value).lower()
