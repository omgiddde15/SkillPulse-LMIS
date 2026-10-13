"""Prompt templates, system instructions, and privacy verification for AI roadmap generation.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine
"""

import json
from typing import Dict, Any, List

SYSTEM_PROMPT = """You are the SkillPulse AI Career Guidance Engine, specialized in formulating transparent, explainable career roadmaps for technical candidates in India.

Your objective is to sequence and elaborate learning milestones for a candidate seeking a target role based on deterministic skill gap analysis and verified educational/government catalogue listings.

CRITICAL INTEGRITY AND SAFETY RULES:
1. GROUNDING IN PROVIDED DATA: You must ONLY reference the canonical skill keys and verified opportunity IDs provided in the prompt context.
2. ABSOLUTE BAN ON FABRICATION: Do NOT invent courses, company names, job vacancies, stipends, salaries, deadlines, contact numbers, or URLs.
3. OPPORTUNITY REFERENCING: You may only set "linked_opportunity_id" to an ID from the provided verified opportunities list. If no verified opportunity exists for a milestone, set "linked_opportunity_id" to null.
4. ACTION TYPES: Each milestone must have an "action_type" strictly matching one of: "learn", "practise", "build_project", "review", "apply".
5. TIMELINE ESTIMATES: Milestone durations must sum up approximately to the requested horizon days. Timings are planning estimates for self-directed study, NOT promises of course completion or job placement.
6. NO EMPLOYABILITY GUARANTEES: Never claim or imply guaranteed employment, interview calls, or official certification outcomes.
7. TONE AND STYLE: Keep explanations concise, professional, and practical. Do NOT use emojis anywhere.
"""


def assert_payload_privacy(payload: Dict[str, Any]) -> None:
    """Verifies that the structured payload contains only non-identifying data.
    
    Raises ValueError if personal identifiers or raw resume text are detected.
    """
    prohibited_keys = {
        "candidate_name", "full_name", "email", "phone", "address", 
        "institution_name", "raw_text", "resume_text", "original_filename"
    }
    
    def check_dict(d: Any):
        if isinstance(d, dict):
            for k, v in d.items():
                if k.lower() in prohibited_keys:
                    raise ValueError(f"Privacy violation: prohibited identifier '{k}' detected in AI payload.")
                check_dict(v)
        elif isinstance(d, list):
            for item in d:
                check_dict(item)

    check_dict(payload)


def build_roadmap_prompt(
    role_info: Dict[str, Any],
    gap_summary: Dict[str, Any],
    horizon_days: int,
    weekly_hours: int,
    verified_opportunities: List[Dict[str, Any]],
    allowed_skill_keys: List[str],
) -> str:
    """Constructs a compact, privacy-safe prompt with structured context for Gemini."""
    
    # Format verified opportunities compactly
    opp_context = [
        {
            "id": opp["id"],
            "title": opp["title"],
            "type": opp["opportunity_type"],
            "provider": opp.get("provider_name"),
            "skills": opp.get("skill_keys", []),
            "fee_status": opp.get("fee_status", "unknown"),
        }
        for opp in verified_opportunities
    ]

    prompt_data = {
        "target_role": {
            "role_id": role_info.get("role_id"),
            "title": role_info.get("title"),
            "sector": role_info.get("sector"),
            "required_skills": [
                {"skill_key": s["skill_key"], "name": s.get("skill_name"), "rationale": s.get("role_justification")}
                for s in role_info.get("required_skills", [])
            ],
            "preferred_skills": [
                {"skill_key": s["skill_key"], "name": s.get("skill_name"), "rationale": s.get("role_justification")}
                for s in role_info.get("preferred_skills", [])
            ],
        },
        "candidate_evidence_status": {
            "missing_required_skills": gap_summary.get("missing_required", []),
            "unconfirmed_or_claimed_required_skills": gap_summary.get("unconfirmed_or_claimed_required", []),
            "evidenced_skills": gap_summary.get("evidenced", []),
            "missing_preferred_skills": gap_summary.get("missing_preferred", []),
        },
        "planning_parameters": {
            "horizon_days": horizon_days,
            "weekly_study_hours": weekly_hours,
        },
        "allowed_skill_keys": allowed_skill_keys,
        "allowed_verified_opportunities": opp_context,
    }

    # Verify no PII is included
    assert_payload_privacy(prompt_data)

    return f"""Please generate a structured, personalized career roadmap for the following candidate profile:

{json.dumps(prompt_data, indent=2)}

Ensure the milestones sequence learning of missing required skills first, followed by hands-on practice, portfolio projects, and exploration of official portals.
"""
