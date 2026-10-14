"""AI Service Orchestration layer for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

import logging
import os
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from app.ai.base import AIProvider, AIProviderError
from app.ai.gemini_provider import GeminiProvider, get_bounded_timeout_ms
from app.ai.prompts import (
    SYSTEM_PROMPT,
    build_roadmap_prompt,
    COPILOT_SYSTEM_PROMPT,
    build_copilot_prompt,
    assert_payload_privacy,
)
from app.schemas.career_models import AICopilotOutput
from app.services.role_catalogue import normalize_skill_key

logger = logging.getLogger(__name__)


class AIRoadmapMilestone(BaseModel):
    """Structured milestone output format expected from LLM."""
    milestone_order: int = Field(..., ge=1, le=20)
    title: str = Field(..., max_length=150)
    description: str = Field(..., max_length=600)
    target_skill_keys: List[str] = Field(default_factory=list)
    action_type: str = Field(..., description="Must be one of: learn, practise, build_project, review, apply")
    suggested_duration_days: int = Field(default=7, ge=1, le=90)
    prerequisites: List[str] = Field(default_factory=list)
    linked_opportunity_id: Optional[str] = None


class AIRoadmapOutput(BaseModel):
    """Envelope output format expected from LLM."""
    summary: str = Field(..., max_length=500)
    methodology_note: str = Field(..., max_length=500)
    milestones: List[AIRoadmapMilestone] = Field(..., min_length=1, max_length=15)


class AIService:
    """Service boundary that isolates LLM interactions from domain business logic."""

    def __init__(self, provider: Optional[AIProvider] = None):
        self._explicit_provider = provider
        self._cached_gemini: Optional[GeminiProvider] = None
        self._cached_watsonx = None

    @property
    def provider(self) -> AIProvider:
        if self._explicit_provider is not None:
            return self._explicit_provider
        provider_type = os.getenv("AI_PROVIDER", "gemini").strip().lower()
        if provider_type == "watsonx":
            if self._cached_watsonx is None:
                from app.ai.watsonx_provider import WatsonxProvider
                self._cached_watsonx = WatsonxProvider()
            return self._cached_watsonx
        elif provider_type == "gemini":
            if self._cached_gemini is None:
                self._cached_gemini = GeminiProvider()
            return self._cached_gemini
        else:
            logger.warning("Unsupported AI_PROVIDER '%s', defaulting to Gemini.", provider_type)
            if self._cached_gemini is None:
                self._cached_gemini = GeminiProvider()
            return self._cached_gemini

    @provider.setter
    def provider(self, val: AIProvider):
        self._explicit_provider = val

    def is_ai_available(self) -> bool:
        """Checks if the configured AI provider is ready to execute requests."""
        if hasattr(self.provider, "is_configured"):
            return self.provider.is_configured()
        return True

    def generate_roadmap(
        self,
        role_info: Dict[str, Any],
        gap_summary: Dict[str, Any],
        horizon_days: int,
        weekly_hours: int,
        verified_opportunities: List[Dict[str, Any]],
        allowed_skill_keys: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Invokes the AI provider to generate a structured, grounded career roadmap.
        
        Returns validated roadmap data, or None if the provider call or validation failed.
        """
        if not self.is_ai_available():
            logger.info("AI provider is not configured. Falling back to deterministic generation.")
            return None

        # 1. Build prompt and verify privacy
        try:
            user_prompt = build_roadmap_prompt(
                role_info=role_info,
                gap_summary=gap_summary,
                horizon_days=horizon_days,
                weekly_hours=weekly_hours,
                verified_opportunities=verified_opportunities,
                allowed_skill_keys=allowed_skill_keys,
            )
        except Exception as exc:
            logger.warning("Prompt generation or privacy check failed: %s", exc)
            return None

        # 2. Call provider with bounded timeout
        try:
            raw_result = self.provider.generate_structured_content(
                system_instruction=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                response_schema=AIRoadmapOutput,
                timeout_ms=get_bounded_timeout_ms(),
            )
        except AIProviderError as exc:
            logger.warning("AI provider execution failed (%s): %s", exc.provider, str(exc))
            return None
        except Exception as exc:
            logger.warning("Unexpected error during AI roadmap generation: %s", exc)
            return None

        # 3. Validate against Pydantic schema
        try:
            validated = AIRoadmapOutput.model_validate(raw_result)
        except Exception as exc:
            logger.warning("LLM output failed Pydantic validation: %s", exc)
            return None

        # 4. Strict ground-truth validation of returned IDs
        allowed_opp_ids = {opp["id"] for opp in verified_opportunities}
        allowed_keys_set = set(allowed_skill_keys)

        valid_milestones = []
        valid_action_types = {"learn", "practise", "build_project", "review", "apply"}

        for idx, m in enumerate(validated.milestones, start=1):
            m_dict = m.model_dump()
            m_dict["milestone_order"] = idx

            # Action type normalization
            act_type = m_dict["action_type"].lower().replace(" ", "_")
            if act_type not in valid_action_types:
                act_type = "practise"
            m_dict["action_type"] = act_type

            # Check linked opportunity ID against verified allowed set
            opp_id = m_dict.get("linked_opportunity_id")
            if opp_id and opp_id not in allowed_opp_ids:
                logger.info("LLM referenced unknown/unverified opportunity ID '%s'. Removing link.", opp_id)
                m_dict["linked_opportunity_id"] = None

            # Filter target skills to allowed keys
            raw_skills = m_dict.get("target_skill_keys", [])
            clean_skills = [
                normalize_skill_key(k) for k in raw_skills
                if normalize_skill_key(k) in allowed_keys_set
            ]
            m_dict["target_skill_keys"] = clean_skills

            valid_milestones.append(m_dict)

        if not valid_milestones:
            logger.warning("No valid milestones after reference checking. Falling back.")
            return None

        provider_id = getattr(self.provider, "provider_id", "gemini")
        if provider_id == "watsonx":
            model_label = getattr(self.provider, "model", "")
            provider_note_label = f"IBM watsonx.ai ({model_label})" if model_label else "IBM watsonx.ai"
        elif getattr(self.provider, "model", "") and getattr(self.provider, "model", "") != "gemini-3.8-flash":
            provider_note_label = f"Gemini ({self.provider.model})"
        else:
            provider_note_label = "Gemini 3.8 Flash"

        return {
            "summary": validated.summary,
            "methodology_note": (
                f"Personalized with {provider_note_label} based on your verified skill evidence and deterministic gap analysis. "
                f"Sequenced for a {horizon_days}-day horizon with approximately {weekly_hours} hours/week effort. "
                f"Timings are planning estimates, not guaranteed outcomes."
            ),
            "generation_mode": "ai_assisted",
            "milestones": valid_milestones,
            "ai_provider": provider_id,
            "ai_model": getattr(self.provider, "model", None),
        }

    def generate_copilot_response(
        self,
        context: Dict[str, Any],
        history: List[Dict[str, str]],
        user_question: str,
    ) -> Optional[Dict[str, Any]]:
        """Generates a grounded, schema-validated career copilot answer via configured AI provider."""
        if not self.is_ai_available():
            logger.info("AI provider not configured for Copilot. Falling back to deterministic guidance.")
            return None

        # 1. Build prompt and verify privacy
        try:
            prompt = build_copilot_prompt(
                context=context,
                history=history,
                user_question=user_question,
            )
        except Exception as exc:
            logger.warning("Copilot prompt building or privacy check failed: %s", exc)
            return None

        # 2. Call provider with bounded timeout
        try:
            raw_result = self.provider.generate_structured_content(
                system_instruction=COPILOT_SYSTEM_PROMPT,
                user_prompt=prompt,
                response_schema=AICopilotOutput,
                timeout_ms=get_bounded_timeout_ms(),
            )
        except AIProviderError as exc:
            logger.warning("Copilot AI provider failed (%s): %s", exc.provider, str(exc))
            return None
        except Exception as exc:
            logger.warning("Unexpected error during Copilot generation: %s", exc)
            return None

        # 3. Validate against Pydantic schema
        try:
            validated = AICopilotOutput.model_validate(raw_result)
        except Exception as exc:
            logger.warning("Copilot output failed Pydantic validation: %s", exc)
            return None

        # 4. Strict grounding check on referenced opportunity IDs
        allowed_opp_ids = {opp["id"] for opp in context.get("verified_opportunities", [])}
        filtered_sources = []
        for src in validated.sources:
            s_dict = src.model_dump()
            if s_dict.get("kind") == "opportunity" and s_dict.get("id"):
                if s_dict["id"] not in allowed_opp_ids:
                    logger.info("Copilot referenced unverified/unknown opp '%s'; omitting source link.", s_dict["id"])
                    continue
            filtered_sources.append(s_dict)

        return {
            "answer": validated.answer,
            "sources": filtered_sources,
            "suggested_followups": validated.suggested_followups,
            "generation_mode": "ai_assisted",
        }
