"""Google Gemini AI Provider implementation using the official google-genai SDK.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

import json
import logging
import os
import time
from typing import Dict, Any, Optional

from app.ai.base import (
    AIProvider,
    AIProviderError,
    AITimeoutError,
    AIRateLimitError,
    AISchemaValidationError,
)

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"
DEFAULT_AI_TIMEOUT_MS = 20000
MIN_AI_TIMEOUT_MS = 5000
MAX_AI_TIMEOUT_MS = 30000


def get_bounded_timeout_ms(override_ms: Optional[int] = None) -> int:
    """Returns a consistently bounded timeout in milliseconds (between 5,000 and 30,000 ms)."""
    if override_ms is not None:
        try:
            target = int(override_ms)
        except (ValueError, TypeError):
            target = DEFAULT_AI_TIMEOUT_MS
    else:
        env_val = os.getenv("AI_TIMEOUT_MS")
        if env_val:
            try:
                target = int(env_val)
            except (ValueError, TypeError):
                target = DEFAULT_AI_TIMEOUT_MS
        else:
            target = DEFAULT_AI_TIMEOUT_MS
    return max(MIN_AI_TIMEOUT_MS, min(target, MAX_AI_TIMEOUT_MS))


class GeminiProvider(AIProvider):
    """Google Gemini implementation conforming to AIProvider interface."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self._api_key = api_key
        self._model = model
        # Note: Do not make network calls on initialization

    @property
    def api_key(self) -> str:
        if self._api_key is not None:
            return self._api_key
        return os.getenv("GEMINI_API_KEY", "").strip()

    @property
    def model(self) -> str:
        if self._model is not None:
            return self._model
        return os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip()

    def is_configured(self) -> bool:
        """Returns True if a valid API key is present."""
        return bool(self.api_key)

    def generate_structured_content(
        self,
        system_instruction: str,
        user_prompt: str,
        response_schema: Any,
        timeout_ms: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Generates schema-conforming structured JSON via Google GenAI SDK with latency bounding and transient 503 retry."""
        if not self.is_configured():
            raise AIProviderError("Gemini API key is not configured.", provider="gemini")

        try:
            from google import genai
            from google.genai import types
            from google.genai.errors import APIError
        except ImportError as exc:
            raise AIProviderError(
                f"google-genai SDK is not installed or import failed: {str(exc)}",
                provider="gemini",
            )

        effective_timeout_ms = get_bounded_timeout_ms(timeout_ms)
        start_time = time.monotonic()
        max_attempts = 2
        response = None

        # Build thinking configuration: use lower thinking budget/level to minimize latency
        # while preserving structured JSON roadmap generation
        thinking_config = None
        try:
            budget_env = os.getenv("GEMINI_THINKING_BUDGET")
            if budget_env is not None:
                budget_val = int(budget_env)
                thinking_config = types.ThinkingConfig(
                    thinking_budget=budget_val,
                    include_thoughts=False,
                )
            else:
                # Default thinking budget=0 minimizes latency for deterministic schema generation
                thinking_config = types.ThinkingConfig(
                    thinking_budget=0,
                    include_thoughts=False,
                )
        except Exception as exc:
            logger.debug("ThinkingConfig not supported or failed to build: %s", exc)
            thinking_config = None

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            system_instruction=system_instruction,
            temperature=0.2,  # Low temperature for deterministic planning
            max_output_tokens=3072,  # Bound maximum token generation
            thinking_config=thinking_config,
        )

        for attempt in range(1, max_attempts + 1):
            elapsed_sec = time.monotonic() - start_time
            remaining_ms = effective_timeout_ms - int(elapsed_sec * 1000)
            if remaining_ms <= 0:
                raise AITimeoutError("Gemini API request timed out before attempt could complete.", provider="gemini")

            try:
                client = genai.Client(
                    api_key=self.api_key,
                    http_options=types.HttpOptions(timeout=remaining_ms),
                )

                response = client.models.generate_content(
                    model=self.model,
                    contents=user_prompt,
                    config=config,
                )
                break

            except APIError as exc:
                err_msg = str(exc)
                if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                    raise AIRateLimitError("Gemini API rate limit or quota exceeded.", provider="gemini")
                if "DEADLINE_EXCEEDED" in err_msg or "timeout" in err_msg.lower():
                    raise AITimeoutError("Gemini API request timed out.", provider="gemini")
                if exc.code in (400, 401, 403, 404):
                    logger.warning("Gemini API non-retryable error: %s (code %s)", exc.__class__.__name__, exc.code)
                    raise AIProviderError(f"Gemini API request failed: {exc.__class__.__name__}", provider="gemini")

                # Check for transient 503 / high demand
                is_503 = (exc.code == 503) or ("503" in err_msg) or ("UNAVAILABLE" in err_msg) or ("high demand" in err_msg.lower())
                backoff_delay = 1.5
                if is_503 and attempt < max_attempts:
                    elapsed_after = time.monotonic() - start_time
                    time_after_backoff = elapsed_after + backoff_delay
                    # Retry only if backoff + minimum 3s generation window fits within the overall deadline
                    if time_after_backoff + 3.0 <= (effective_timeout_ms / 1000.0):
                        logger.info(
                            "Gemini returned transient 503 on attempt %d. Retrying once after %.1fs backoff within deadline...",
                            attempt,
                            backoff_delay,
                        )
                        time.sleep(backoff_delay)
                        continue
                    else:
                        logger.warning("Gemini 503 received but remaining deadline is insufficient for retry.")

                logger.warning("Gemini API error during structured generation: %s", exc.__class__.__name__)
                raise AIProviderError(f"Gemini API request failed: {exc.__class__.__name__}", provider="gemini")

            except Exception as exc:
                if "timeout" in str(exc).lower():
                    raise AITimeoutError("Request to Gemini timed out.", provider="gemini")
                logger.warning("Unexpected error during Gemini execution: %s", exc.__class__.__name__)
                raise AIProviderError(f"AI provider encountered an error: {exc.__class__.__name__}", provider="gemini")

        if not response:
            raise AISchemaValidationError("Gemini returned an empty response.", provider="gemini")

        # Check if SDK returned structured parsed object directly
        if hasattr(response, "parsed") and response.parsed is not None:
            if isinstance(response.parsed, dict):
                return response.parsed
            if hasattr(response.parsed, "model_dump"):
                return response.parsed.model_dump()

        if not getattr(response, "text", None):
            raise AISchemaValidationError("Gemini returned an empty response text.", provider="gemini")

        try:
            data = json.loads(response.text)
            if not isinstance(data, dict):
                raise AISchemaValidationError("Model response is not a valid JSON object.", provider="gemini")
            return data
        except json.JSONDecodeError as exc:
            raise AISchemaValidationError(
                f"Failed to parse JSON from Gemini response: {str(exc)}",
                provider="gemini",
            )
