"""Personalized Career Roadmap Service for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Provides deterministic roadmap generation grounded in verified catalogue listings and
user skill evidence, with privacy-compliant, schema-validated AI assistance when enabled.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from app.db import get_db
from app.services.career_service import CareerService
from app.services.role_catalogue import (
    get_role_by_id,
    normalize_skill_key,
    get_skill_display_name,
)
from app.services.skill_gap_service import SkillGapService
from app.services.opportunity_service import OpportunityService
from app.ai.ai_service import AIService

logger = logging.getLogger(__name__)

DISCLAIMER_TEXT = (
    "Milestone timings and activities are planning estimates for self-directed professional development. "
    "They do not constitute a guarantee of course completion, academic credit, certification, or employment."
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RoadmapService:
    def __init__(
        self,
        career_service: Optional[CareerService] = None,
        skill_gap_service: Optional[SkillGapService] = None,
        opportunity_service: Optional[OpportunityService] = None,
        ai_service: Optional[AIService] = None,
    ):
        self.career_service = career_service or CareerService()
        self.skill_gap_service = skill_gap_service or SkillGapService(self.career_service)
        self.opportunity_service = opportunity_service or OpportunityService()
        self.ai_service = ai_service or AIService()

    def generate_deterministic_roadmap(
        self,
        user_id: int,
        target_role_id: str,
        horizon_days: int,
        override_methodology_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Deterministically builds a structured career roadmap without external network dependencies.
        
        Reads missing and evidenced requirements for the role and maps them to verified
        catalogue opportunities, practical exercises, and portfolio projects.
        """
        role = get_role_by_id(target_role_id)
        if not role:
            raise ValueError(f"Target role '{target_role_id}' is not a supported benchmark role.")

        if horizon_days not in (30, 60, 90):
            raise ValueError("Planning horizon must be 30, 60, or 90 days.")

        # 1. Calculate deterministic skill gap
        gap_analysis = self.skill_gap_service.analyze_gap_for_user(user_id, target_role_id) or {}
        required_skills = gap_analysis.get("required_skills", [])
        preferred_skills = gap_analysis.get("preferred_skills", [])

        # Categorize gaps
        missing_required = []
        claimed_or_unconfirmed_required = []
        for req in required_skills:
            st = req.get("status")
            if st == "missing":
                missing_required.append(req)
            elif st in ("claimed", "unconfirmed"):
                claimed_or_unconfirmed_required.append(req)

        missing_preferred = [p for p in preferred_skills if p.get("status") in ("missing", "unconfirmed", "claimed")]

        # 2. Query verified active opportunities only
        all_opps = self.opportunity_service.get_opportunities(limit=100).get("items", [])
        verified_courses = []
        verified_schemes = []

        for opp in all_opps:
            if opp.get("record_kind") == "portal_directory":
                continue
            if opp.get("verification_status") != "verified_official":
                continue
            if opp.get("listing_status") in ("closed", "stale", "unconfirmed"):
                continue
            if opp.get("is_deadline_passed", False):
                continue

            if opp.get("opportunity_type") == "course":
                verified_courses.append(opp)
            elif opp.get("opportunity_type") in ("scheme", "internship", "apprenticeship"):
                verified_schemes.append(opp)

        # Map skills to verified courses
        skill_to_course = {}
        for c in verified_courses:
            for sk in c.get("skill_keys", []):
                norm_sk = normalize_skill_key(sk)
                if norm_sk and norm_sk not in skill_to_course:
                    skill_to_course[norm_sk] = c

        # 3. Build sequence of milestones
        milestones = []

        # A. Address missing required skills (Core Learn & Practise)
        for req in missing_required:
            k = normalize_skill_key(req["skill_key"])
            sname = req.get("skill_name") or get_skill_display_name(k)
            matched_course = skill_to_course.get(k)
            # Ensure matched course reasonably supports learning this foundational skill
            if matched_course:
                course_title_lower = matched_course.get("title", "").lower()
                # Exclude advanced applied programs (e.g. Generative AI) where Python is a prerequisite rather than foundational learning
                if k == "python" and "generative ai" in course_title_lower:
                    matched_course = None

            if matched_course:
                milestones.append({
                    "title": f"Master {sname} Fundamentals",
                    "description": (
                        f"Study structured curriculum via '{matched_course['title']}' from {matched_course['provider_name']}. "
                        f"Focus on core concepts: {req.get('role_justification', sname)}."
                    ),
                    "target_skill_keys": [k],
                    "action_type": "learn",
                    "prerequisites": [],
                    "linked_opportunity_id": matched_course["id"],
                })
            else:
                milestones.append({
                    "title": f"Build {sname} Core Competency",
                    "description": (
                        f"Engage in structured study and interactive tutorials covering {sname}. "
                        f"Target proficiency in: {req.get('role_justification', sname)}."
                    ),
                    "target_skill_keys": [k],
                    "action_type": "learn",
                    "prerequisites": [],
                    "linked_opportunity_id": None,
                })

            # Add practical execution milestone for this required skill
            milestones.append({
                "title": f"Implement {sname} Hands-on Exercises",
                "description": (
                    f"Develop clean, reproducible code examples and unit tests demonstrating practical usage of {sname}. "
                    f"Commit exercises to a personal Git repository."
                ),
                "target_skill_keys": [k],
                "action_type": "practise",
                "prerequisites": [k],
                "linked_opportunity_id": None,
            })

        # B. Address claimed or unconfirmed required skills (Evidence Consolidation)
        for req in claimed_or_unconfirmed_required:
            k = normalize_skill_key(req["skill_key"])
            sname = req.get("skill_name") or get_skill_display_name(k)
            milestones.append({
                "title": f"Document Project Evidence for {sname}",
                "description": (
                    f"Consolidate technical write-ups, architecture diagrams, or pull requests demonstrating demonstrated experience in {sname}. "
                    f"Transform self-reported claims into verifiable portfolio artifacts."
                ),
                "target_skill_keys": [k],
                "action_type": "review",
                "prerequisites": [],
                "linked_opportunity_id": None,
            })

        # C. Address secondary/preferred skills if horizon allows (60 or 90 days)
        if horizon_days >= 60 and missing_preferred:
            pref_limit = 2 if horizon_days == 60 else 4
            for pref in missing_preferred[:pref_limit]:
                pk = normalize_skill_key(pref["skill_key"])
                pname = pref.get("skill_name") or get_skill_display_name(pk)
                matched_pref_course = skill_to_course.get(pk)

                milestones.append({
                    "title": f"Explore {pname} Tooling & Practices",
                    "description": (
                        f"Gain foundational exposure to {pname} as a preferred skill for {role['title']}. "
                        f"Rationale: {pref.get('role_justification', pname)}."
                    ),
                    "target_skill_keys": [pk],
                    "action_type": "learn",
                    "prerequisites": [],
                    "linked_opportunity_id": matched_pref_course["id"] if matched_pref_course else None,
                })

        # D. Portfolio Capstone Project Milestone
        capstone_skills = [normalize_skill_key(r["skill_key"]) for r in required_skills[:4]]
        milestones.append({
            "title": f"{role['title']} Portfolio Showcase Project",
            "description": (
                f"Design, build, and deploy an end-to-end project integrating your primary skills ({', '.join(capstone_skills[:3])}). "
                f"Document setup instructions, architectural decisions, and testing procedures in a comprehensive README."
            ),
            "target_skill_keys": capstone_skills,
            "action_type": "build_project",
            "prerequisites": capstone_skills[:2],
            "linked_opportunity_id": None,
        })

        # E. Official Portal & Scheme Exploration Milestone
        scheme_id = verified_schemes[0]["id"] if verified_schemes else None
        milestones.append({
            "title": "Review Verified Portals & Prepare Applications",
            "description": (
                f"Review open listings on the National Career Service (NCS) portal and corporate internship guidelines under "
                f"the PM Internship Scheme. Align your resume and portfolio evidence with specific employer requirements."
            ),
            "target_skill_keys": [],
            "action_type": "apply",
            "prerequisites": [],
            "linked_opportunity_id": scheme_id,
        })

        # 4. Limit and distribute suggested duration days
        # Ensure total milestone count fits horizon neatly
        max_milestones = 5 if horizon_days == 30 else (8 if horizon_days == 60 else 10)
        selected_milestones = milestones[:max_milestones]

        # Allocate durations to sum to horizon_days
        count = len(selected_milestones)
        base_days = max(1, horizon_days // count)
        remainder = horizon_days - (base_days * count)

        formatted_milestones = []
        for idx, m in enumerate(selected_milestones, start=1):
            dur = base_days + (1 if idx <= remainder else 0)
            formatted_milestones.append({
                "milestone_order": idx,
                "title": m["title"],
                "description": m["description"],
                "target_skill_keys": m["target_skill_keys"],
                "action_type": m["action_type"],
                "suggested_duration_days": dur,
                "prerequisites": m.get("prerequisites", []),
                "linked_opportunity_id": m.get("linked_opportunity_id"),
                "is_completed": False,
                "completed_at": None,
            })

        methodology = override_methodology_note or (
            f"Generated using SkillPulse deterministic rules engine based on candidate evidence statuses and "
            f"verified government/educational catalogue entries. Sequenced for a {horizon_days}-day horizon. "
            f"All milestones are planning estimates."
        )

        summary = (
            f"Structured {horizon_days}-day skill development roadmap for {role['title']}. "
            f"Prioritizes {len(missing_required)} missing required competencies, followed by hands-on portfolio "
            f"implementation and official opportunity portal exploration."
        )

        return {
            "target_role_id": target_role_id,
            "role_title": role["title"],
            "horizon_days": horizon_days,
            "summary": summary,
            "generation_mode": "deterministic",
            "methodology_note": methodology,
            "milestones": formatted_milestones,
        }

    def generate_roadmap(
        self,
        user_id: int,
        target_role_id: str,
        horizon_days: int,
    ) -> Dict[str, Any]:
        """Main entry point: Evaluates AI consent and server readiness before invoking Gemini or falling back."""
        role = get_role_by_id(target_role_id)
        if not role:
            raise ValueError(f"Target role '{target_role_id}' is not a supported benchmark role.")

        if horizon_days not in (30, 60, 90):
            raise ValueError("Planning horizon must be 30, 60, or 90 days.")

        # Check user profile for AI consent
        profile = self.career_service.get_profile(user_id) or {}
        has_ai_consent = bool(profile.get("consent_ai_processing", False))

        # 1. If user has NOT granted AI consent: purely deterministic
        if not has_ai_consent:
            note = (
                f"Generated using SkillPulse deterministic rules engine. External AI personalization was skipped "
                f"because AI processing consent is disabled in your career profile. "
                f"Timings are planning estimates."
            )
            return self.generate_deterministic_roadmap(
                user_id=user_id,
                target_role_id=target_role_id,
                horizon_days=horizon_days,
                override_methodology_note=note,
            )

        # 2. If user HAS granted consent, check AI provider readiness
        if not self.ai_service.is_ai_available():
            note = (
                f"Generated using SkillPulse deterministic rules engine. Gemini API key is not configured on the server. "
                f"Timings are planning estimates."
            )
            return self.generate_deterministic_roadmap(
                user_id=user_id,
                target_role_id=target_role_id,
                horizon_days=horizon_days,
                override_methodology_note=note,
            )

        # 3. User consented and AI is available: prepare minimal structured context
        gap_analysis = self.skill_gap_service.analyze_gap_for_user(user_id, target_role_id) or {}
        required_skills = gap_analysis.get("required_skills", [])
        preferred_skills = gap_analysis.get("preferred_skills", [])

        gap_summary = {
            "missing_required": [
                {"skill_key": r["skill_key"], "name": r.get("skill_name"), "rationale": r.get("role_justification")}
                for r in required_skills if r.get("status") == "missing"
            ],
            "unconfirmed_or_claimed_required": [
                {"skill_key": r["skill_key"], "name": r.get("skill_name"), "status": r.get("status")}
                for r in required_skills if r.get("status") in ("claimed", "unconfirmed")
            ],
            "evidenced": [
                {"skill_key": r["skill_key"], "name": r.get("skill_name")}
                for r in required_skills if r.get("status") == "evidenced"
            ],
            "missing_preferred": [
                {"skill_key": p["skill_key"], "name": p.get("skill_name"), "rationale": p.get("role_justification")}
                for p in preferred_skills if p.get("status") in ("missing", "unconfirmed", "claimed")
            ],
        }

        # Filter verified opportunities strictly
        all_opps = self.opportunity_service.get_opportunities(limit=100).get("items", [])
        verified_opps = [
            opp for opp in all_opps
            if opp.get("record_kind") != "portal_directory"
            and opp.get("verification_status") == "verified_official"
            and opp.get("listing_status") not in ("closed", "stale", "unconfirmed")
            and not opp.get("is_deadline_passed", False)
        ]

        allowed_skill_keys = [
            normalize_skill_key(s["skill_key"])
            for s in (role.get("required_skills", []) + role.get("preferred_skills", []))
        ]

        weekly_hours = 10  # Standard conservative benchmark

        # 4. Invoke AI service
        ai_result = self.ai_service.generate_roadmap(
            role_info=role,
            gap_summary=gap_summary,
            horizon_days=horizon_days,
            weekly_hours=weekly_hours,
            verified_opportunities=verified_opps,
            allowed_skill_keys=allowed_skill_keys,
        )

        if ai_result:
            return {
                "target_role_id": target_role_id,
                "role_title": role["title"],
                "horizon_days": horizon_days,
                "summary": ai_result["summary"],
                "generation_mode": "ai_assisted",
                "methodology_note": ai_result["methodology_note"],
                "milestones": ai_result["milestones"],
            }

        # 5. Fallback if AI generation failed or timed out
        fallback_note = (
            f"Generated using SkillPulse deterministic fallback engine. External AI generation was temporarily "
            f"unavailable or timed out. All milestones are grounded in verified requirements."
        )
        return self.generate_deterministic_roadmap(
            user_id=user_id,
            target_role_id=target_role_id,
            horizon_days=horizon_days,
            override_methodology_note=fallback_note,
        )

    def save_roadmap(
        self,
        user_id: int,
        roadmap_data: Dict[str, Any],
        client_request_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Persists roadmap and its child milestones into SQLite with idempotency checks."""
        now = _now_iso()

        with get_db() as conn:
            cursor = conn.cursor()

            # Idempotency check: if client_request_token provided, look for recent match
            if client_request_token:
                cursor.execute(
                    """
                    SELECT id FROM career_roadmaps
                    WHERE user_id = ? AND client_request_token = ?
                    ORDER BY id DESC LIMIT 1;
                    """,
                    (user_id, client_request_token),
                )
                existing = cursor.fetchone()
                if existing:
                    existing_id = existing["id"]
                    # Return existing saved roadmap
                    full = self.get_roadmap_by_id(user_id, existing_id)
                    if full:
                        return full

            # 1. Insert roadmap header
            cursor.execute(
                """
                INSERT INTO career_roadmaps (
                    user_id, target_role_id, role_title, horizon_days,
                    summary, generation_mode, methodology_note, client_request_token,
                    generated_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    user_id,
                    roadmap_data["target_role_id"],
                    roadmap_data["role_title"],
                    roadmap_data["horizon_days"],
                    roadmap_data["summary"],
                    roadmap_data["generation_mode"],
                    roadmap_data["methodology_note"],
                    client_request_token,
                    now,
                    now,
                    now,
                ),
            )
            roadmap_id = cursor.lastrowid

            # 2. Insert milestones
            for m in roadmap_data.get("milestones", []):
                cursor.execute(
                    """
                    INSERT INTO roadmap_milestones (
                        roadmap_id, milestone_order, title, description,
                        target_skill_keys_json, action_type, suggested_duration_days,
                        linked_opportunity_id, is_completed, completed_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        roadmap_id,
                        m["milestone_order"],
                        m["title"],
                        m["description"],
                        json.dumps(m.get("target_skill_keys", [])),
                        m["action_type"],
                        m.get("suggested_duration_days", 7),
                        m.get("linked_opportunity_id"),
                        1 if m.get("is_completed") else 0,
                        m.get("completed_at"),
                        now,
                        now,
                    ),
                )

            conn.commit()

        return self.get_roadmap_by_id(user_id, roadmap_id)

    def get_user_roadmaps(self, user_id: int) -> List[Dict[str, Any]]:
        """Retrieves summary list of all roadmaps owned by the user."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT r.*,
                       COUNT(m.id) as total_milestones,
                       SUM(CASE WHEN m.is_completed = 1 THEN 1 ELSE 0 END) as completed_milestones
                FROM career_roadmaps r
                LEFT JOIN roadmap_milestones m ON r.id = m.roadmap_id
                WHERE r.user_id = ?
                GROUP BY r.id
                ORDER BY r.created_at DESC;
                """,
                (user_id,),
            )
            rows = cursor.fetchall()

        results = []
        for row in rows:
            tot = row["total_milestones"] or 0
            comp = row["completed_milestones"] or 0
            prog = round((comp / tot * 100.0), 1) if tot > 0 else 0.0

            results.append({
                "id": row["id"],
                "user_id": row["user_id"],
                "target_role_id": row["target_role_id"],
                "role_title": row["role_title"],
                "horizon_days": row["horizon_days"],
                "summary": row["summary"],
                "generation_mode": row["generation_mode"],
                "methodology_note": row["methodology_note"],
                "total_milestones": tot,
                "completed_milestones": comp,
                "progress_percentage": prog,
                "generated_at": row["generated_at"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            })

        return results

    def get_roadmap_by_id(self, user_id: int, roadmap_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves complete roadmap details with ordered milestones and joined opportunity details."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM career_roadmaps
                WHERE id = ? AND user_id = ?;
                """,
                (roadmap_id, user_id),
            )
            rm = cursor.fetchone()
            if not rm:
                return None

            cursor.execute(
                """
                SELECT * FROM roadmap_milestones
                WHERE roadmap_id = ?
                ORDER BY milestone_order ASC;
                """,
                (roadmap_id,),
            )
            m_rows = cursor.fetchall()

        milestones = []
        comp_count = 0
        for m in m_rows:
            is_comp = bool(m["is_completed"])
            if is_comp:
                comp_count += 1

            linked_opp = None
            opp_id = m["linked_opportunity_id"]
            if opp_id:
                linked_opp = self.opportunity_service.get_opportunity_by_id(opp_id)

            milestones.append({
                "id": m["id"],
                "roadmap_id": m["roadmap_id"],
                "milestone_order": m["milestone_order"],
                "title": m["title"],
                "description": m["description"],
                "target_skill_keys": json.loads(m["target_skill_keys_json"] or "[]"),
                "action_type": m["action_type"],
                "suggested_duration_days": m["suggested_duration_days"],
                "prerequisites": [],
                "linked_opportunity_id": opp_id,
                "linked_opportunity": linked_opp,
                "is_completed": is_comp,
                "completed_at": m["completed_at"],
            })

        tot = len(milestones)
        prog = round((comp_count / tot * 100.0), 1) if tot > 0 else 0.0

        return {
            "id": rm["id"],
            "user_id": rm["user_id"],
            "target_role_id": rm["target_role_id"],
            "role_title": rm["role_title"],
            "horizon_days": rm["horizon_days"],
            "summary": rm["summary"],
            "generation_mode": rm["generation_mode"],
            "methodology_note": rm["methodology_note"],
            "total_milestones": tot,
            "completed_milestones": comp_count,
            "progress_percentage": prog,
            "generated_at": rm["generated_at"],
            "created_at": rm["created_at"],
            "updated_at": rm["updated_at"],
            "milestones": milestones,
            "disclaimer": DISCLAIMER_TEXT,
        }

    def delete_roadmap(self, user_id: int, roadmap_id: int) -> bool:
        """Deletes a roadmap and its milestones ensuring ownership."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id FROM career_roadmaps WHERE id = ? AND user_id = ?;",
                (roadmap_id, user_id),
            )
            if not cursor.fetchone():
                return False

            cursor.execute("DELETE FROM career_roadmaps WHERE id = ?;", (roadmap_id,))
            conn.commit()
            return True

    def update_milestone_status(
        self,
        user_id: int,
        roadmap_id: int,
        milestone_id: int,
        is_completed: bool,
    ) -> Optional[Dict[str, Any]]:
        """Updates the completion state of a milestone in a user-owned roadmap."""
        now = _now_iso()

        with get_db() as conn:
            cursor = conn.cursor()
            # Verify roadmap ownership
            cursor.execute(
                "SELECT id FROM career_roadmaps WHERE id = ? AND user_id = ?;",
                (roadmap_id, user_id),
            )
            if not cursor.fetchone():
                return None

            # Verify milestone belongs to roadmap
            cursor.execute(
                "SELECT id FROM roadmap_milestones WHERE id = ? AND roadmap_id = ?;",
                (milestone_id, roadmap_id),
            )
            if not cursor.fetchone():
                return None

            completed_at = now if is_completed else None
            cursor.execute(
                """
                UPDATE roadmap_milestones
                SET is_completed = ?, completed_at = ?, updated_at = ?
                WHERE id = ?;
                """,
                (1 if is_completed else 0, completed_at, now, milestone_id),
            )
            cursor.execute(
                "UPDATE career_roadmaps SET updated_at = ? WHERE id = ?;",
                (now, roadmap_id),
            )
            conn.commit()

            cursor.execute("SELECT * FROM roadmap_milestones WHERE id = ?;", (milestone_id,))
            m = cursor.fetchone()

        linked_opp = None
        if m["linked_opportunity_id"]:
            linked_opp = self.opportunity_service.get_opportunity_by_id(m["linked_opportunity_id"])

        return {
            "id": m["id"],
            "roadmap_id": m["roadmap_id"],
            "milestone_order": m["milestone_order"],
            "title": m["title"],
            "description": m["description"],
            "target_skill_keys": json.loads(m["target_skill_keys_json"] or "[]"),
            "action_type": m["action_type"],
            "suggested_duration_days": m["suggested_duration_days"],
            "prerequisites": [],
            "linked_opportunity_id": m["linked_opportunity_id"],
            "linked_opportunity": linked_opp,
            "is_completed": bool(m["is_completed"]),
            "completed_at": m["completed_at"],
        }
