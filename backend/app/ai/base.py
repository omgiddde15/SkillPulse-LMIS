"""Base interfaces and custom exception definitions for AI providers in SkillPulse.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional


class AIProviderError(Exception):
    """Base exception for AI provider operations."""
    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(message)
        self.provider = provider


class AITimeoutError(AIProviderError):
    """Raised when an external AI provider call exceeds bounded timeout limits."""
    pass


class AIRateLimitError(AIProviderError):
    """Raised when an external AI provider reports quota exhaustion or 429 rate limit."""
    pass


class AISchemaValidationError(AIProviderError):
    """Raised when AI response fails structural or JSON schema validation."""
    pass


class AIProvider(ABC):
    """Abstract provider boundary for LLM integrations (Gemini, future providers)."""

    @abstractmethod
    def generate_structured_content(
        self,
        system_instruction: str,
        user_prompt: str,
        response_schema: Any,
        timeout_ms: int = 15000,
    ) -> Dict[str, Any]:
        """Executes a bounded request to the underlying model returning parsed schema-valid JSON.
        
        Must raise an appropriate AIProviderError subclass on failure without leaking API keys
        or internal runtime details.
        """
        pass
