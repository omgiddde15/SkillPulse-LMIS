"""IBM watsonx.ai Provider implementation using httpx.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Dict, Any, Optional

import httpx

from app.ai.base import (
    AIProvider,
    AIProviderError,
    AITimeoutError,
    AIRateLimitError,
    AISchemaValidationError,
)
from app.ai.gemini_provider import (
    DEFAULT_AI_TIMEOUT_MS,
    MIN_AI_TIMEOUT_MS,
    MAX_AI_TIMEOUT_MS,
    get_bounded_timeout_ms,
)

logger = logging.getLogger(__name__)

DEFAULT_WATSONX_API_VERSION = "2024-05-01"
IBM_IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"
TOKEN_EXPIRATION_BUFFER_SECONDS = 300  # 5 minutes buffer


class WatsonxProvider(AIProvider):
    """IBM watsonx.ai implementation conforming to AIProvider interface using httpx."""

    provider_name: str = "IBM watsonx.ai"
    provider_id: str = "watsonx"

    def __init__(
        self,
        api_key: Optional[str] = None,
        project_id: Optional[str] = None,
        url: Optional[str] = None,
        model: Optional[str] = None,
        api_version: Optional[str] = None,
    ):
        self._api_key = api_key
        self._project_id = project_id
        self._url = url
        self._model = model
        self._api_version = api_version

        # In-memory token cache: (token_str, expires_at_timestamp)
        self._cached_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    @property
    def api_key(self) -> str:
        if self._api_key is not None:
            return self._api_key
        return os.getenv("WATSONX_API_KEY", "").strip()

    @property
    def project_id(self) -> str:
        if self._project_id is not None:
            return self._project_id
        return os.getenv("WATSONX_PROJECT_ID", "").strip()

    @property
    def url(self) -> str:
        if self._url is not None:
            return self._url.rstrip("/")
        return os.getenv("WATSONX_URL", "").strip().rstrip("/")

    @property
    def model(self) -> str:
        if self._model is not None:
            return self._model
        return os.getenv("WATSONX_MODEL_ID", "").strip()

    @property
    def api_version(self) -> str:
        if self._api_version is not None:
            return self._api_version
        return os.getenv("WATSONX_API_VERSION", DEFAULT_WATSONX_API_VERSION).strip()

    def is_configured(self) -> bool:
        """Returns True only when all mandatory watsonx parameters are explicitly configured."""
        return bool(self.api_key and self.project_id and self.url and self.model)

    def _sanitize_message(self, msg: str) -> str:
        """Strips raw credentials or bearer tokens from error strings before logging or raising."""
        clean = msg
        if self.api_key and len(self.api_key) > 4:
            clean = clean.replace(self.api_key, "[REDACTED_API_KEY]")
        if self._cached_token and len(self._cached_token) > 8:
            clean = clean.replace(self._cached_token, "[REDACTED_TOKEN]")
        clean = re.sub(r"Bearer\s+[A-Za-z0-9_\-\.]+", "Bearer [REDACTED_TOKEN]", clean)
        return clean

    def _get_iam_token(self, timeout_sec: float) -> str:
        """Exchanges IBM Cloud API key for bearer token via IAM flow with memory caching."""
        now = time.time()
        if self._cached_token and now < (self._token_expires_at - TOKEN_EXPIRATION_BUFFER_SECONDS):
            return self._cached_token

        bounded_timeout = max(2.0, min(timeout_sec, 10.0))
        try:
            with httpx.Client(timeout=bounded_timeout) as client:
                res = client.post(
                    IBM_IAM_TOKEN_URL,
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "application/json",
                    },
                    data={
                        "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                        "apikey": self.api_key,
                    },
                )
        except httpx.TimeoutException:
            raise AITimeoutError("IBM IAM token request timed out.", provider="watsonx")
        except Exception as exc:
            raise AIProviderError(
                self._sanitize_message(f"Failed to connect to IBM IAM service: {exc.__class__.__name__}"),
                provider="watsonx",
            )

        if res.status_code in (400, 401, 403):
            raise AIProviderError(
                "IBM IAM authentication failed. Invalid or unauthorized API key.",
                provider="watsonx",
            )
        if res.status_code == 429:
            raise AIRateLimitError("IBM IAM token endpoint rate limit exceeded.", provider="watsonx")
        if res.status_code >= 500:
            raise AIProviderError(
                f"IBM IAM service unavailable (HTTP {res.status_code}).",
                provider="watsonx",
            )
        if res.status_code != 200:
            raise AIProviderError(
                f"IBM IAM token request failed (HTTP {res.status_code}).",
                provider="watsonx",
            )

        try:
            data = res.json()
        except Exception as exc:
            raise AIProviderError(
                f"IBM IAM returned invalid JSON response: {exc.__class__.__name__}",
                provider="watsonx",
            )

        token = data.get("access_token")
        if not token:
            raise AIProviderError(
                "IBM IAM token response missing 'access_token'.",
                provider="watsonx",
            )

        expires_in = data.get("expires_in", 3600)
        try:
            expires_in_float = float(expires_in)
        except (ValueError, TypeError):
            expires_in_float = 3600.0

        self._cached_token = token
        self._token_expires_at = time.time() + expires_in_float
        return token

    def generate_structured_content(
        self,
        system_instruction: str,
        user_prompt: str,
        response_schema: Any,
        timeout_ms: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Generates schema-conforming structured JSON via IBM watsonx.ai chat endpoint."""
        if not self.is_configured():
            missing = []
            if not self.api_key:
                missing.append("WATSONX_API_KEY")
            if not self.project_id:
                missing.append("WATSONX_PROJECT_ID")
            if not self.url:
                missing.append("WATSONX_URL")
            if not self.model:
                missing.append("WATSONX_MODEL_ID")
            raise AIProviderError(
                f"IBM watsonx provider configuration is incomplete (missing {', '.join(missing)}).",
                provider="watsonx",
            )

        effective_timeout_ms = get_bounded_timeout_ms(timeout_ms)
        start_time = time.monotonic()
        max_attempts = 2

        # 1. Obtain IAM bearer token within remaining timeout
        elapsed_sec = time.monotonic() - start_time
        remaining_sec = (effective_timeout_ms / 1000.0) - elapsed_sec
        if remaining_sec <= 1.0:
            raise AITimeoutError("watsonx request timed out before token acquisition.", provider="watsonx")

        bearer_token = self._get_iam_token(timeout_sec=remaining_sec)

        # 2. Build system instructions with schema hint if available
        system_content = system_instruction
        if hasattr(response_schema, "model_json_schema"):
            try:
                schema_json = json.dumps(response_schema.model_json_schema(), indent=2)
                system_content += f"\n\nCRITICAL: You must return ONLY a valid JSON object strictly complying with this schema:\n{schema_json}"
            except Exception:
                pass

        # 3. Assemble chat payload
        payload = {
            "model_id": self.model,
            "project_id": self.project_id,
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_prompt},
            ],
            "parameters": {
                "temperature": 0.2,
                "max_tokens": 3072,
                "response_format": {"type": "json_object"},
            },
        }

        endpoint_url = f"{self.url}/ml/v1/text/chat?version={self.api_version}"
        response_data = None

        for attempt in range(1, max_attempts + 1):
            elapsed_sec = time.monotonic() - start_time
            remaining_sec = (effective_timeout_ms / 1000.0) - elapsed_sec
            if remaining_sec <= 0:
                raise AITimeoutError("IBM watsonx request timed out before attempt could complete.", provider="watsonx")

            try:
                with httpx.Client(timeout=remaining_sec) as client:
                    resp = client.post(
                        endpoint_url,
                        headers={
                            "Authorization": f"Bearer {bearer_token}",
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                        },
                        json=payload,
                    )
            except httpx.TimeoutException:
                raise AITimeoutError("IBM watsonx request timed out.", provider="watsonx")
            except Exception as exc:
                sanitized = self._sanitize_message(f"Connection error to IBM watsonx: {exc.__class__.__name__}")
                logger.warning(sanitized)
                raise AIProviderError(sanitized, provider="watsonx")

            # Handle HTTP status codes
            if resp.status_code == 200:
                try:
                    response_data = resp.json()
                except Exception as exc:
                    raise AISchemaValidationError(
                        f"Failed to parse JSON envelope from IBM watsonx: {exc.__class__.__name__}",
                        provider="watsonx",
                    )
                break

            if resp.status_code in (401, 403):
                raise AIProviderError(
                    f"IBM watsonx authorization failed (HTTP {resp.status_code}). Check WATSONX_PROJECT_ID and permissions.",
                    provider="watsonx",
                )

            if resp.status_code == 429:
                raise AIRateLimitError(
                    "IBM watsonx rate limit or quota exceeded (HTTP 429).",
                    provider="watsonx",
                )

            if resp.status_code in (400, 404):
                raise AIProviderError(
                    f"IBM watsonx request rejected (HTTP {resp.status_code}). Verify WATSONX_MODEL_ID and regional availability.",
                    provider="watsonx",
                )

            # Handle transient 503 or 500 error with deadline-aware retry
            is_transient = resp.status_code in (500, 502, 503, 504)
            backoff_delay = 1.5
            if is_transient and attempt < max_attempts:
                elapsed_after = time.monotonic() - start_time
                time_after_backoff = elapsed_after + backoff_delay
                if time_after_backoff + 3.0 <= (effective_timeout_ms / 1000.0):
                    logger.info(
                        "IBM watsonx returned transient HTTP %d on attempt %d. Retrying once after %.1fs backoff...",
                        resp.status_code,
                        attempt,
                        backoff_delay,
                    )
                    time.sleep(backoff_delay)
                    continue
                else:
                    logger.warning("IBM watsonx transient error received but remaining deadline is insufficient for retry.")

            raise AIProviderError(
                f"IBM watsonx request failed with HTTP status {resp.status_code}.",
                provider="watsonx",
            )

        if not response_data:
            raise AISchemaValidationError("IBM watsonx returned an empty response.", provider="watsonx")

        # 4. Extract generated text from choices or results
        content = None
        choices = response_data.get("choices")
        if choices and isinstance(choices, list) and len(choices) > 0:
            msg = choices[0].get("message", {})
            content = msg.get("content")
        elif "results" in response_data and isinstance(response_data["results"], list) and len(response_data["results"]) > 0:
            content = response_data["results"][0].get("generated_text")

        if not content or not str(content).strip():
            raise AISchemaValidationError("IBM watsonx returned empty content.", provider="watsonx")

        # 5. Strip markdown fences if present
        raw_text = str(content).strip()
        if raw_text.startswith("```"):
            lines = raw_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_text = "\n".join(lines).strip()

        # 6. Parse JSON object
        try:
            parsed = json.loads(raw_text)
            if not isinstance(parsed, dict):
                raise AISchemaValidationError("IBM watsonx response is not a JSON object.", provider="watsonx")
            return parsed
        except json.JSONDecodeError as exc:
            raise AISchemaValidationError(
                f"Failed to decode JSON from IBM watsonx response: {str(exc)}",
                provider="watsonx",
            )
