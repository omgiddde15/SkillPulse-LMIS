"""Google Gemini AI Provider implementation using the official google-genai SDK.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

import json
import logging
import os
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
        timeout_ms: int = 15000,
    ) -> Dict[str, Any]:
        """Generates schema-conforming structured JSON via Google GenAI SDK."""
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

        try:
            # Instantiate client with bounded timeout
            client = genai.Client(
                api_key=self.api_key,
                http_options=types.HttpOptions(timeout=timeout_ms),
            )

            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                system_instruction=system_instruction,
                temperature=0.2,  # Low temperature for deterministic planning
            )

            response = client.models.generate_content(
                model=self.model,
                contents=user_prompt,
                config=config,
            )

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

        except APIError as exc:
            # Check for rate limit or quota exhaustion (429)
            err_msg = str(exc)
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                raise AIRateLimitError("Gemini API rate limit or quota exceeded.", provider="gemini")
            if "DEADLINE_EXCEEDED" in err_msg or "timeout" in err_msg.lower():
                raise AITimeoutError("Gemini API request timed out.", provider="gemini")
            # General provider error - sanitize to avoid leaking internal keys
            logger.warning("Gemini API error during structured generation: %s", exc.__class__.__name__)
            raise AIProviderError(f"Gemini API request failed: {exc.__class__.__name__}", provider="gemini")

        except Exception as exc:
            if "timeout" in str(exc).lower():
                raise AITimeoutError("Request to Gemini timed out.", provider="gemini")
            logger.warning("Unexpected error during Gemini execution: %s", exc.__class__.__name__)
            raise AIProviderError(f"AI provider encountered an error: {exc.__class__.__name__}", provider="gemini")
