"""Career Copilot Service for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Provides grounded career guidance conversation using user profile, skill evidence,
gap analysis, saved roadmaps, and verified catalogue listings.
Strictly separates evidence levels, enforces privacy, and provides deterministic fallback.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from app.db import get_db
from app.services.career_service import CareerService
from app.services.skill_gap_service import SkillGapService
from app.services.opportunity_service import OpportunityService
from app.services.roadmap_service import RoadmapService
from app.services.role_catalogue import get_supported_roles, get_role_by_id, get_skill_display_name
from app.ai.ai_service import AIService

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CopilotService:
    def __init__(
        self,
        career_service: Optional[CareerService] = None,
        skill_gap_service: Optional[SkillGapService] = None,
        opportunity_service: Optional[OpportunityService] = None,
        roadmap_service: Optional[RoadmapService] = None,
        ai_service: Optional[AIService] = None,
    ):
        self.career_service = career_service or CareerService()
        self.skill_gap_service = skill_gap_service or SkillGapService(self.career_service)
        self.opportunity_service = opportunity_service or OpportunityService()
        self.roadmap_service = roadmap_service or RoadmapService(
            self.career_service, self.skill_gap_service, self.opportunity_service
        )
        self.ai_service = ai_service or AIService()

    # -------------------------------------------------------------------------
    # Conversation Management
    # -------------------------------------------------------------------------

    def create_conversation(
        self,
        user_id: int,
        title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a new Copilot conversation thread for the authenticated user."""
        now = _now_iso()
        conv_title = (title or "").strip() or "Career Guidance"

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO copilot_conversations (user_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?);
                """,
                (user_id, conv_title[:120], now, now),
            )
            conv_id = cursor.lastrowid

            # Add welcome message
            welcome_text = (
                "Hello! I am your SkillPulse Career Copilot. I can help answer questions about your "
                "target role, skill gaps, roadmap progress, and verified government or educational opportunities. "
                "What would you like to explore today?"
            )
            cursor.execute(
                """
                INSERT INTO copilot_messages (
                    conversation_id, sender, content, sources_json, generation_mode, created_at
                ) VALUES (?, 'assistant', ?, '[]', 'deterministic', ?);
                """,
                (conv_id, welcome_text, now),
            )
            conn.commit()

        return self.get_conversation(user_id, conv_id)

    def get_conversations(self, user_id: int) -> List[Dict[str, Any]]:
        """Lists all conversations owned by the user with preview metrics."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at,
                       COUNT(m.id) as message_count
                FROM copilot_conversations c
                LEFT JOIN copilot_messages m ON m.conversation_id = c.id
                WHERE c.user_id = ?
                GROUP BY c.id
                ORDER BY c.updated_at DESC;
                """,
                (user_id,),
            )
            rows = cursor.fetchall()

        conversations = []
        for r in rows:
            conv = dict(r)
            # Fetch last message preview
            with get_db() as conn:
                cur2 = conn.cursor()
                cur2.execute(
                    """
                    SELECT content FROM copilot_messages
                    WHERE conversation_id = ?
                    ORDER BY id DESC LIMIT 1;
                    """,
                    (conv["id"],),
                )
                last_m = cur2.fetchone()
                conv["last_message_preview"] = (
                    (last_m["content"][:100] + "...") if last_m and len(last_m["content"]) > 100
                    else (last_m["content"] if last_m else None)
                )
            conversations.append(conv)

        return conversations

    def get_conversation(
        self,
        user_id: int,
        conversation_id: int,
    ) -> Optional[Dict[str, Any]]:
        """Retrieves full conversation with message history, enforcing ownership."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, title, created_at, updated_at
                FROM copilot_conversations
                WHERE id = ? AND user_id = ?;
                """,
                (conversation_id, user_id),
            )
            conv_row = cursor.fetchone()
            if not conv_row:
                return None

            conv = dict(conv_row)

            cursor.execute(
                """
                SELECT id, conversation_id, sender, content, sources_json, generation_mode, created_at
                FROM copilot_messages
                WHERE conversation_id = ?
                ORDER BY id ASC;
                """,
                (conversation_id,),
            )
            msg_rows = cursor.fetchall()

        messages = []
        for m in msg_rows:
            m_dict = dict(m)
            try:
                m_dict["sources"] = json.loads(m_dict.get("sources_json") or "[]")
            except Exception:
                m_dict["sources"] = []
            m_dict.pop("sources_json", None)
            messages.append(m_dict)

        conv["messages"] = messages
        return conv

    def delete_conversation(self, user_id: int, conversation_id: int) -> bool:
        """Deletes a conversation and cascaded messages, enforcing ownership."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM copilot_conversations
                WHERE id = ? AND user_id = ?;
                """,
                (conversation_id, user_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    # -------------------------------------------------------------------------
    # Context Assembly & Deterministic Grounding
    # -------------------------------------------------------------------------

    def assemble_context(self, user_id: int) -> Dict[str, Any]:
        """Assembles privacy-safe, grounded context from existing database records."""
        # 1. Profile & Role info
        profile = self.career_service.get_profile(user_id) or {}
        target_role_title = profile.get("target_role_title") or "Not Specified"
        target_sector = profile.get("target_sector") or "Not Specified"

        # Determine benchmark role ID
        supported_roles = get_supported_roles()
        matched_role = None
        if profile.get("target_occupation_id"):
            for r in supported_roles:
                if r.get("benchmark_occupation_id") == profile["target_occupation_id"]:
                    matched_role = r
                    break
        if not matched_role and target_role_title:
            for r in supported_roles:
                if r["title"].lower() in target_role_title.lower() or target_role_title.lower() in r["title"].lower():
                    matched_role = r
                    break
        if not matched_role:
            matched_role = get_role_by_id("ROLE_PY_BACKEND")

        role_id = matched_role["role_id"] if matched_role else "ROLE_PY_BACKEND"
        role_title = matched_role["title"] if matched_role else target_role_title

        # 2. Candidate skills with distinct evidence levels
        skills_resp = self.career_service.get_user_skills(user_id) or {}
        all_skills = skills_resp.get("skills", [])
        evidenced_skills = [s["skill_name"] for s in all_skills if s.get("evidence_status") == "evidenced"]
        claimed_skills = [s["skill_name"] for s in all_skills if s.get("evidence_status") == "claimed"]
        unconfirmed_skills = [s["skill_name"] for s in all_skills if s.get("evidence_status") == "unconfirmed"]

        # 3. Deterministic skill gap analysis
        gap_data = self.skill_gap_service.analyze_gap_for_user(user_id, role_id) or {}
        req_skills = gap_data.get("required_skills", [])
        pref_skills = gap_data.get("preferred_skills", [])

        missing_required = [
            {"skill_key": r["skill_key"], "name": r.get("skill_name"), "justification": r.get("role_justification")}
            for r in req_skills if r.get("status") == "missing"
        ]
        claimed_or_unconfirmed_required = [
            {"skill_key": r["skill_key"], "name": r.get("skill_name"), "status": r.get("status")}
            for r in req_skills if r.get("status") in ("claimed", "unconfirmed")
        ]

        # 4. Roadmap progress
        roadmaps = self.roadmap_service.get_user_roadmaps(user_id)
        latest_roadmap = None
        if roadmaps:
            latest_rm_summary = roadmaps[0]
            latest_roadmap = self.roadmap_service.get_roadmap_by_id(user_id, latest_rm_summary["id"])

        roadmap_context = None
        if latest_roadmap:
            milestones = latest_roadmap.get("milestones", [])
            pending = [m for m in milestones if not m.get("is_completed")]
            next_m = pending[0] if pending else None
            roadmap_context = {
                "id": latest_roadmap["id"],
                "role_title": latest_roadmap["role_title"],
                "horizon_days": latest_roadmap["horizon_days"],
                "progress_percentage": latest_roadmap["progress_percentage"],
                "total_milestones": latest_roadmap["total_milestones"],
                "completed_milestones": latest_roadmap["completed_milestones"],
                "next_milestone": (
                    {"order": next_m["milestone_order"], "title": next_m["title"], "action_type": next_m["action_type"]}
                    if next_m else None
                ),
            }

        # 5. Verified active opportunities only (strictly omitting closed/unconfirmed)
        catalogue_items = self.opportunity_service.get_opportunities(limit=50).get("items", [])
        verified_opps = []
        for opp in catalogue_items:
            if opp.get("record_kind") == "portal_directory":
                continue
            if opp.get("verification_status") != "verified_official":
                continue
            if opp.get("listing_status") in ("closed", "stale", "unconfirmed"):
                continue
            if opp.get("is_deadline_passed", False):
                continue
            verified_opps.append({
                "id": opp["id"],
                "title": opp["title"],
                "opportunity_type": opp["opportunity_type"],
                "provider_name": opp.get("provider_name"),
                "official_url": opp.get("official_url"),
                "skill_keys": opp.get("skill_keys", []),
                "verification_status": opp.get("verification_status"),
            })

        return {
            "target_role": {
                "role_id": role_id,
                "title": role_title,
                "sector": target_sector,
            },
            "candidate_skills": {
                "evidenced": evidenced_skills,
                "claimed": claimed_skills,
                "unconfirmed": unconfirmed_skills,
            },
            "skill_gaps": {
                "missing_required": missing_required,
                "claimed_or_unconfirmed_required": claimed_or_unconfirmed_required,
                "missing_preferred_count": len([p for p in pref_skills if p.get("status") == "missing"]),
            },
            "roadmap": roadmap_context,
            "verified_opportunities": verified_opps,
            "consent_ai_processing": bool(profile.get("consent_ai_processing", False)),
        }

    def generate_deterministic_guidance(
        self,
        context: Dict[str, Any],
        user_question: str,
        note_prefix: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Formulates an explainable, factually grounded answer using deterministic rules."""
        q_lower = user_question.lower()
        role = context["target_role"]
        gaps = context["skill_gaps"]
        skills = context["candidate_skills"]
        roadmap = context["roadmap"]
        opps = context["verified_opportunities"]

        missing_req = gaps["missing_required"]
        claimed_req = gaps["claimed_or_unconfirmed_required"]

        sources = []
        suggested_followups = []

        # Intent 1: Skill gaps / prioritization
        if any(w in q_lower for w in ("gap", "prioritize", "priority", "missing", "require")):
            if missing_req:
                top_missing = missing_req[:3]
                names = [m["name"] for m in top_missing]
                answer = (
                    f"For your target role as **{role['title']}**, you have {len(missing_req)} missing required competencies. "
                    f"You should prioritize these first: **{', '.join(names)}**.\n\n"
                    f"Skills you have claimed but not yet verified with evidence include: "
                    f"{', '.join(s['name'] for s in claimed_req) if claimed_req else 'None'}. "
                    f"Remember that skills mentioned on a resume are treated as unconfirmed until supported by portfolio evidence or verified assessments."
                )
                for m in top_missing:
                    sources.append({
                        "kind": "skill_gap",
                        "id": m["skill_key"],
                        "title": f"Missing Requirement: {m['name']}",
                        "url": None,
                        "verification_status": "required_gap",
                    })
                suggested_followups = [
                    "What should I learn next for my target role?",
                    "Which catalogue opportunities are relevant to my goals?",
                ]
            else:
                answer = (
                    f"Great news! Your skill profile currently covers all core required skills for **{role['title']}**. "
                    f"Your next step is to strengthen user-evidenced projects for claimed skills and examine preferred skills."
                )
                suggested_followups = [
                    "What should I do this week based on my roadmap?",
                ]

        # Intent 2: What to learn next
        elif any(w in q_lower for w in ("learn", "next", "start", "study", "course")):
            if missing_req:
                first_skill = missing_req[0]
                # Look for matching verified course
                matched_opp = None
                for o in opps:
                    if first_skill["skill_key"] in o.get("skill_keys", []):
                        matched_opp = o
                        break

                answer = (
                    f"Based on your skill gap analysis for **{role['title']}**, the most critical next competency to master is "
                    f"**{first_skill['name']}** ({first_skill.get('justification', 'Core role competency')}).\n\n"
                )
                if matched_opp:
                    answer += (
                        f"Recommended verified resource: **{matched_opp['title']}** provided by {matched_opp.get('provider_name', 'official portal')} "
                        f"({matched_opp.get('opportunity_type', 'course')})."
                    )
                    sources.append({
                        "kind": "opportunity",
                        "id": matched_opp["id"],
                        "title": matched_opp["title"],
                        "url": matched_opp.get("official_url"),
                        "verification_status": "verified_official",
                    })
                else:
                    answer += "Focus on practical exercises and official documentation to build working fundamentals."

                sources.append({
                    "kind": "skill_gap",
                    "id": first_skill["skill_key"],
                    "title": f"Skill: {first_skill['name']}",
                    "url": None,
                    "verification_status": "missing_required",
                })
                suggested_followups = [
                    "Which skill gaps should I prioritize?",
                    "What should I do this week based on my roadmap?",
                ]
            else:
                answer = (
                    f"You have already demonstrated core required competencies for **{role['title']}**. "
                    f"Consider building hands-on full-stack or architecture projects to solidify your evidence."
                )

        # Intent 3: Roadmap progress / this week
        elif any(w in q_lower for w in ("roadmap", "week", "milestone", "today", "schedule")):
            if roadmap:
                next_m = roadmap.get("next_milestone")
                if next_m:
                    answer = (
                        f"You are following a {roadmap['horizon_days']}-day roadmap for **{roadmap['role_title']}** "
                        f"with **{roadmap['completed_milestones']}/{roadmap['total_milestones']}** milestones completed "
                        f"({roadmap['progress_percentage']:.0f}% progress).\n\n"
                        f"Your current milestone for this week is Milestone #{next_m['order']}: "
                        f"**{next_m['title']}** (Action: {next_m['action_type'].upper()}). "
                        f"Focus on finishing this milestone and toggling it in your Roadmap tab when complete."
                    )
                    sources.append({
                        "kind": "roadmap_milestone",
                        "id": str(next_m["order"]),
                        "title": f"Milestone #{next_m['order']}: {next_m['title']}",
                        "url": None,
                        "verification_status": "active_milestone",
                    })
                else:
                    answer = (
                        f"You have completed all milestones in your current {roadmap['horizon_days']}-day roadmap! "
                        f"You can generate a new 60- or 90-day horizon roadmap in the Roadmap tab."
                    )
                suggested_followups = [
                    "Which catalogue opportunities are relevant to my goals?",
                    "Which skill gaps should I prioritize?",
                ]
            else:
                answer = (
                    f"You do not have a saved roadmap yet for **{role['title']}**. "
                    f"Navigate to the **Roadmap** tab to generate a personalized 30-, 60-, or 90-day learning plan."
                )
                suggested_followups = [
                    "What should I learn next for my target role?",
                ]

        # Intent 4: Opportunities / Jobs / Internships
        elif any(w in q_lower for w in ("opportunity", "job", "internship", "scheme", "catalogue", "opening")):
            if opps:
                top_opps = opps[:3]
                opp_lines = []
                for o in top_opps:
                    opp_lines.append(f"- **{o['title']}** ({o.get('provider_name')}, {o.get('opportunity_type')})")
                    sources.append({
                        "kind": "opportunity",
                        "id": o["id"],
                        "title": o["title"],
                        "url": o.get("official_url"),
                        "verification_status": "verified_official",
                    })
                answer = (
                    f"Here are {len(top_opps)} verified, active opportunities from official portals relevant to your goals:\n\n"
                    + "\n".join(opp_lines)
                    + "\n\nNote: Closed application cycles and unconfirmed search directories are excluded to ensure accuracy. "
                    "You can track any opportunity in the Application Tracker."
                )
                suggested_followups = [
                    "What should I do this week based on my roadmap?",
                ]
            else:
                answer = (
                    f"There are currently no active verified individual opportunities linked to your immediate target skills. "
                    f"You can explore the **Opportunity Explorer** directory for trusted government portals."
                )

        # Default general response
        else:
            evidenced_count = len(skills["evidenced"])
            claimed_count = len(skills["claimed"])
            answer = (
                f"As a candidate pursuing **{role['title']}**, you currently have **{evidenced_count} evidenced skills**, "
                f"**{claimed_count} claimed skills**, and **{len(missing_req)} missing required competencies**.\n\n"
                f"To advance toward your target role:\n"
                f"1. Prioritize learning missing requirements: {', '.join(m['name'] for m in missing_req[:2]) if missing_req else 'None'}.\n"
                f"2. Convert claimed skills into evidenced proficiencies by completing practical portfolio projects.\n"
                f"3. Track your target applications and milestones in the Application Tracker and Roadmap."
            )
            suggested_followups = [
                "Which skill gaps should I prioritize?",
                "What should I learn next for my target role?",
                "What should I do this week based on my roadmap?",
            ]

        final_answer = f"{note_prefix}\n\n{answer}" if note_prefix else answer

        return {
            "answer": final_answer,
            "sources": sources,
            "suggested_followups": suggested_followups,
            "generation_mode": "deterministic",
        }

    # -------------------------------------------------------------------------
    # Message Processing & Dispatch
    # -------------------------------------------------------------------------

    def send_message(
        self,
        user_id: int,
        conversation_id: int,
        content: str,
    ) -> Dict[str, Any]:
        """Processes a candidate message, checks consent, and dispatches to AI or deterministic fallback."""
        clean_content = content.strip()
        if not clean_content:
            raise ValueError("Message content cannot be empty.")
        if len(clean_content) > 1000:
            raise ValueError("Message exceeds maximum allowed length of 1000 characters.")

        # 1. Enforce conversation ownership
        conv = self.get_conversation(user_id, conversation_id)
        if not conv:
            raise ValueError("Conversation not found.")

        now = _now_iso()

        # 2. Persist user message
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO copilot_messages (
                    conversation_id, sender, content, sources_json, generation_mode, created_at
                ) VALUES (?, 'user', ?, '[]', 'deterministic', ?);
                """,
                (conversation_id, clean_content, now),
            )
            user_msg_id = cursor.lastrowid
            conn.commit()

        # 3. Assemble grounded context
        context = self.assemble_context(user_id)
        history = [
            {"sender": m["sender"], "content": m["content"]}
            for m in conv.get("messages", [])
        ]
        history.append({"sender": "user", "content": clean_content})

        # 4. Check AI consent
        has_ai_consent = context.get("consent_ai_processing", False)
        assistant_result = None

        if not has_ai_consent:
            note = (
                "*(Note: External AI consent is disabled in your Career Profile. "
                "This response is grounded using SkillPulse's deterministic rules engine.)*"
            )
            assistant_result = self.generate_deterministic_guidance(
                context=context,
                user_question=clean_content,
                note_prefix=note,
            )
        else:
            # User consented: attempt AI generation with bounded timeout
            try:
                ai_output = self.ai_service.generate_copilot_response(
                    context=context,
                    history=history,
                    user_question=clean_content,
                )
                if ai_output:
                    assistant_result = ai_output
            except Exception as exc:
                logger.warning("Copilot AI generation exception: %s", exc)

            if not assistant_result:
                note = (
                    "*(Note: External AI generation was temporarily unavailable. "
                    "This response is grounded using SkillPulse's deterministic rules engine.)*"
                )
                assistant_result = self.generate_deterministic_guidance(
                    context=context,
                    user_question=clean_content,
                    note_prefix=note,
                )

        # 5. Persist assistant message
        sources_json = json.dumps(assistant_result.get("sources", []))
        gen_mode = assistant_result.get("generation_mode", "deterministic")
        answer_text = assistant_result["answer"]

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO copilot_messages (
                    conversation_id, sender, content, sources_json, generation_mode, created_at
                ) VALUES (?, 'assistant', ?, ?, ?, ?);
                """,
                (conversation_id, answer_text, sources_json, gen_mode, now),
            )
            asst_msg_id = cursor.lastrowid

            # Update conversation timestamp
            cursor.execute(
                """
                UPDATE copilot_conversations
                SET updated_at = ?
                WHERE id = ?;
                """,
                (now, conversation_id),
            )
            conn.commit()

        return {
            "id": asst_msg_id,
            "conversation_id": conversation_id,
            "sender": "assistant",
            "content": answer_text,
            "sources": assistant_result.get("sources", []),
            "generation_mode": gen_mode,
            "created_at": now,
        }
