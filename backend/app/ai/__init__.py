"""AI Provider Integration Layer for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

from app.ai.base import AIProvider, AIProviderError
from app.ai.ai_service import AIService

__all__ = ["AIProvider", "AIProviderError", "AIService"]
