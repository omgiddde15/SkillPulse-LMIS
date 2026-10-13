"""Deterministic explainable skill-gap analysis service for SkillPulse.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Compares a candidate's current registered skills and supporting evidence against
standardized role profiles. Produces deterministic, explainable classifications:
- Evidenced (supported by project, experience, or certificate reference)
- Claimed (self-reported without supporting context)
- Unconfirmed (extracted from resume awaiting user review)
- Missing (not yet demonstrated in profile)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from app.services.role_catalogue import (
    get_role_by_id,
    normalize_skill_key,
    get_supported_roles,
)
from app.services.career_service import CareerService


class SkillGapService:
    def __init__(self, career_service: Optional[CareerService] = None):
        self.career_service = career_service or CareerService()

    def analyze_gap_for_user(
        self,
        user_id: int,
        role_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Calculates deterministic skill-gap analysis for a specific user and role profile.
        
        Returns None if role_id does not exist in the catalogue.
        """
        role = get_role_by_id(role_id)
        if not role:
            return None

        # 1. Fetch authenticated user's skills
        user_skills = self.career_service.get_user_skills(user_id)

        # 2. Build normalized skill lookup map
        # Priority order: evidenced > claimed > unconfirmed
        priority_map = {"evidenced": 3, "claimed": 2, "unconfirmed": 1}
        user_skill_map: Dict[str, Dict[str, Any]] = {}

        for us in user_skills:
            k = normalize_skill_key(us["skill_key"])
            if not k:
                continue
            if k in user_skill_map:
                current_p = priority_map.get(user_skill_map[k]["evidence_status"], 0)
                new_p = priority_map.get(us["evidence_status"], 0)
                if new_p > current_p:
                    user_skill_map[k] = us
            else:
                user_skill_map[k] = us

        # Track matched user skill IDs
        matched_user_skill_ids = set()

        def match_requirement(req: Dict[str, Any], importance: str) -> Dict[str, Any]:
            req_key = normalize_skill_key(req["skill_key"])
            aliases = req.get("approved_aliases", [])
            candidate_keys = [req_key] + [normalize_skill_key(a) for a in aliases if normalize_skill_key(a)]

            matched_record = None
            for ck in candidate_keys:
                if ck in user_skill_map:
                    matched_record = user_skill_map[ck]
                    break

            if matched_record:
                matched_user_skill_ids.add(matched_record["id"])
                ev_status = matched_record["evidence_status"]
                source_ctx = matched_record.get("source_context")
                src_type = matched_record.get("source_type")

                if ev_status == "evidenced":
                    status = "evidenced"
                    status_label = "Demonstrated with Evidence"
                    if source_ctx:
                        explanation = f"Supported by user evidence reference: \"{source_ctx}\"."
                    else:
                        explanation = "Verified by candidate with supporting project or work experience."
                elif ev_status == "claimed":
                    status = "claimed"
                    status_label = "Self-Claimed"
                    explanation = "Self-reported in candidate profile. Consider attaching a project reference or certificate to substantiate."
                else:  # unconfirmed
                    status = "unconfirmed"
                    status_label = "Extracted / Unconfirmed"
                    explanation = "Extracted from uploaded resume. Pending user confirmation and validation."

                return {
                    "skill_key": req["skill_key"],
                    "skill_name": req["skill_name"],
                    "category": req["category"],
                    "importance_level": importance,
                    "status": status,
                    "status_label": status_label,
                    "role_justification": req["role_justification"],
                    "user_skill_id": matched_record["id"],
                    "user_evidence_status": ev_status,
                    "source_type": src_type,
                    "source_context": source_ctx,
                    "explanation": explanation,
                }
            else:
                return {
                    "skill_key": req["skill_key"],
                    "skill_name": req["skill_name"],
                    "category": req["category"],
                    "importance_level": importance,
                    "status": "missing",
                    "status_label": "Not Yet Demonstrated",
                    "role_justification": req["role_justification"],
                    "user_skill_id": None,
                    "user_evidence_status": None,
                    "source_type": None,
                    "source_context": None,
                    "explanation": f"Not currently documented in your profile. {req['role_justification']}",
                }

        # 3. Match required skills
        required_matches = [
            match_requirement(req, "required") for req in role.get("required_skills", [])
        ]

        # 4. Match preferred skills
        preferred_matches = [
            match_requirement(pref, "preferred") for pref in role.get("preferred_skills", [])
        ]

        # 5. Compute metrics
        req_total = len(required_matches)
        req_evidenced = sum(1 for m in required_matches if m["status"] == "evidenced")
        req_claimed = sum(1 for m in required_matches if m["status"] == "claimed")
        req_unconfirmed = sum(1 for m in required_matches if m["status"] == "unconfirmed")
        req_missing = sum(1 for m in required_matches if m["status"] == "missing")

        pref_total = len(preferred_matches)
        pref_evidenced = sum(1 for m in preferred_matches if m["status"] == "evidenced")
        pref_claimed = sum(1 for m in preferred_matches if m["status"] == "claimed")
        pref_unconfirmed = sum(1 for m in preferred_matches if m["status"] == "unconfirmed")
        pref_missing = sum(1 for m in preferred_matches if m["status"] == "missing")

        coverage_pct = round((req_evidenced / req_total) * 100, 1) if req_total > 0 else 0.0

        metrics = {
            "required_total": req_total,
            "required_evidenced": req_evidenced,
            "required_claimed": req_claimed,
            "required_unconfirmed": req_unconfirmed,
            "required_missing": req_missing,
            "preferred_total": pref_total,
            "preferred_evidenced": pref_evidenced,
            "preferred_claimed": pref_claimed,
            "preferred_unconfirmed": pref_unconfirmed,
            "preferred_missing": pref_missing,
            "evidence_coverage_percentage": coverage_pct,
            "coverage_formula": f"{req_evidenced} evidenced / {req_total} required * 100",
            "metric_explanation": f"{req_evidenced} of {req_total} required skills have supporting evidence ({coverage_pct}%). {req_claimed} self-claimed; {req_missing} not yet demonstrated.",
            "disclaimer": "Deterministic qualification gap analysis based on current profile evidence. Not an employability score, hiring likelihood, or job-readiness certification.",
        }

        # 6. Unmatched user skills
        unmatched_skills = [
            s for s in user_skills if s["id"] not in matched_user_skill_ids
        ]

        role_summary = {
            "role_id": role["role_id"],
            "title": role["title"],
            "description": role["description"],
            "sector": role["sector"],
            "benchmark_occupation_id": role.get("benchmark_occupation_id"),
            "source_type": role["source_type"],
            "source_title": role["source_title"],
            "source_url": role.get("source_url"),
            "version": role["version"],
            "review_date": role["review_date"],
            "provenance_notes": role["provenance_notes"],
            "required_skills_count": req_total,
            "preferred_skills_count": pref_total,
        }

        return {
            "role": role_summary,
            "metrics": metrics,
            "required_skills": required_matches,
            "preferred_skills": preferred_matches,
            "unmatched_user_skills": unmatched_skills,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
