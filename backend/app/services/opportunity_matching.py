"""Personalized Opportunity Matching Engine for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Deterministically compares candidate profile, evidenced competencies, and
target role skill gaps against the verified opportunity catalogue.
"""

import re
from typing import Dict, Any, List, Optional
from app.services.career_service import CareerService
from app.services.skill_gap_service import SkillGapService
from app.services.role_catalogue import normalize_skill_key, get_role_by_id, get_supported_roles
from app.services.opportunity_service import OpportunityService


class OpportunityMatchingEngine:
    def __init__(
        self,
        career_service: Optional[CareerService] = None,
        skill_gap_service: Optional[SkillGapService] = None,
        opportunity_service: Optional[OpportunityService] = None,
    ):
        self.career_service = career_service or CareerService()
        self.skill_gap_service = skill_gap_service or SkillGapService(self.career_service)
        self.opportunity_service = opportunity_service or OpportunityService()

    def get_recommendations_for_user(
        self,
        user_id: int,
        target_role_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Calculates deterministic personalized recommendations for an authenticated user.
        
        Evaluates candidate's evidenced skills, missing skill gaps, and preferences
        against courses, schemes, and official opportunity directories.
        """
        # 1. Load user profile
        profile = self.career_service.get_profile(user_id) or {}
        user_skills = self.career_service.get_user_skills(user_id)

        # Build candidate's demonstrated skill set (evidenced and claimed)
        evidenced_skill_keys = set()
        claimed_skill_keys = set()
        for s in user_skills:
            k = normalize_skill_key(s["skill_key"])
            if not k:
                continue
            if s["evidence_status"] == "evidenced":
                evidenced_skill_keys.add(k)
            else:
                claimed_skill_keys.add(k)

        all_user_skill_keys = evidenced_skill_keys.union(claimed_skill_keys)

        # 2. Determine target role ID
        selected_role_id = target_role_id
        is_custom_role = False
        target_role_title = profile.get("target_role_title", "")

        if not selected_role_id:
            # Try to match benchmark role
            target_occ = profile.get("target_occupation_id")
            if target_occ:
                for r in get_supported_roles():
                    if r.get("benchmark_occupation_id") == target_occ:
                        selected_role_id = r["role_id"]
                        break
            if not selected_role_id and target_role_title:
                norm_user_title = re.sub(r"[^a-z0-9]", "", target_role_title.lower())
                # Match title against starter roles
                for r in get_supported_roles():
                    norm_r_title = re.sub(r"[^a-z0-9]", "", r["title"].lower())
                    if norm_r_title == norm_user_title or norm_user_title in norm_r_title or norm_r_title in norm_user_title:
                        selected_role_id = r["role_id"]
                        break
                if not selected_role_id:
                    # User has a custom unmapped role!
                    is_custom_role = True

        # If user has no custom role and no selected role, default to ROLE_PY_BACKEND
        if not selected_role_id and not is_custom_role:
            selected_role_id = "ROLE_PY_BACKEND"

        # 3. Compute skill gaps if supported role is identified
        gap_analysis = None
        missing_required_keys = set()
        missing_preferred_keys = set()

        if selected_role_id and not is_custom_role:
            gap_analysis = self.skill_gap_service.analyze_gap_for_user(
                user_id=user_id,
                role_id=selected_role_id,
            )
            if gap_analysis:
                for req in gap_analysis.get("required_skills", []):
                    if req["status"] in ("missing", "unconfirmed", "claimed"):
                        missing_required_keys.add(normalize_skill_key(req["skill_key"]))
                for pref in gap_analysis.get("preferred_skills", []):
                    if pref["status"] in ("missing", "unconfirmed", "claimed"):
                        missing_preferred_keys.add(normalize_skill_key(pref["skill_key"]))

        # 4. Load full catalogue items
        catalogue_res = self.opportunity_service.get_opportunities(limit=200)
        catalogue_items = catalogue_res.get("items", [])

        # Candidate preferences
        user_state = (profile.get("current_state") or "").strip().upper()
        preferred_locs = [l.strip().upper() for l in (profile.get("preferred_locations") or [])]
        user_sector = (profile.get("target_sector") or "").strip().lower()

        recommended_courses = []
        recommended_opportunities = []
        portal_directories = []

        for item in catalogue_items:
            # Separate portal directory records
            if item["record_kind"] == "portal_directory":
                portal_directories.append(item)
                continue

            item_type = item["opportunity_type"]
            item_roles = [r.upper() for r in item.get("role_ids", [])]
            item_skills = [normalize_skill_key(k) for k in item.get("skill_keys", []) if normalize_skill_key(k)]

            # A. COURSE MATCHING
            if item_type == "course":
                match_res = self._score_course(
                    course=item,
                    item_roles=item_roles,
                    item_skills=item_skills,
                    missing_required_keys=missing_required_keys,
                    missing_preferred_keys=missing_preferred_keys,
                    selected_role_id=selected_role_id,
                    is_custom_role=is_custom_role,
                )
                if match_res["match_score"] > 0:
                    recommended_courses.append(match_res)

            # B. JOB / INTERNSHIP / APPRENTICESHIP / SCHEME MATCHING
            else:
                match_res = self._score_opportunity(
                    opp=item,
                    item_roles=item_roles,
                    item_skills=item_skills,
                    evidenced_skill_keys=evidenced_skill_keys,
                    all_user_skill_keys=all_user_skill_keys,
                    selected_role_id=selected_role_id,
                    user_state=user_state,
                    preferred_locs=preferred_locs,
                    user_sector=user_sector,
                    is_custom_role=is_custom_role,
                )
                if match_res["match_score"] > 0:
                    recommended_opportunities.append(match_res)

        # Sort recommendations by match_score descending
        recommended_courses.sort(key=lambda x: x["match_score"], reverse=True)
        recommended_opportunities.sort(key=lambda x: x["match_score"], reverse=True)

        gaps_addressed_count = sum(len(c.get("addressed_gaps", [])) for c in recommended_courses)

        role_summary_title = None
        if selected_role_id:
            role_meta = get_role_by_id(selected_role_id)
            if role_meta:
                role_summary_title = role_meta.get("title")

        return {
            "recommended_courses": recommended_courses,
            "recommended_opportunities": recommended_opportunities,
            "portal_directories": portal_directories,
            "user_target_role_id": selected_role_id if not is_custom_role else None,
            "user_target_role_title": role_summary_title or target_role_title,
            "user_gaps_addressed_count": gaps_addressed_count,
            "disclaimer": "Deterministic qualification matching score based on user-supplied profile documentation. Not an employability prediction, probability of being hired, or guarantee of selection.",
        }

    def _score_course(
        self,
        course: Dict[str, Any],
        item_roles: List[str],
        item_skills: List[str],
        missing_required_keys: set,
        missing_preferred_keys: set,
        selected_role_id: Optional[str],
        is_custom_role: bool,
    ) -> Dict[str, Any]:
        """Calculates deterministic matching score and reasons for a learning course."""
        score_breakdown = {
            "gap_skill_points": 0.0,
            "role_alignment_points": 0.0,
            "preferred_skill_points": 0.0,
            "accessibility_points": 0.0,
        }
        reasons = []
        addressed_gaps = []
        matching_skills = []

        # 1. Missing required skill gap match (highest weight: up to 50 pts)
        if not is_custom_role and missing_required_keys:
            overlapping_gaps = [sk for sk in item_skills if sk in missing_required_keys]
            if overlapping_gaps:
                points = min(len(overlapping_gaps) * 25.0, 50.0)
                score_breakdown["gap_skill_points"] = points
                addressed_gaps.extend(overlapping_gaps)
                for g in overlapping_gaps:
                    reasons.append({
                        "code": "GAP_REQUIRED_SKILL",
                        "message": f"Directly addresses required role competency gap: '{g.replace('_', ' ').title()}'.",
                    })

        # 2. Target role alignment (up to 25 pts)
        if not is_custom_role and selected_role_id and selected_role_id in item_roles:
            score_breakdown["role_alignment_points"] = 25.0
            reasons.append({
                "code": "ROLE_RELEVANCE",
                "message": "Curriculum specifically aligned with target career role profile.",
            })

        # 3. Preferred skill match (up to 15 pts)
        if not is_custom_role and missing_preferred_keys:
            overlapping_pref = [sk for sk in item_skills if sk in missing_preferred_keys]
            if overlapping_pref:
                score_breakdown["preferred_skill_points"] = min(len(overlapping_pref) * 15.0, 15.0)
                matching_skills.extend(overlapping_pref)
                reasons.append({
                    "code": "PREFERRED_COMPETENCY",
                    "message": f"Strengthens secondary/preferred skill: '{overlapping_pref[0].replace('_', ' ').title()}'.",
                })

        # 4. Zero-cost government/public accessibility (10 pts)
        # Note: Accessibility bonus only applies if there is substantive curriculum relevance
        has_substantive_relevance = (
            score_breakdown["gap_skill_points"] > 0
            or score_breakdown["role_alignment_points"] > 0
            or score_breakdown["preferred_skill_points"] > 0
        )
        if has_substantive_relevance and course.get("fee_status") == "free":
            score_breakdown["accessibility_points"] = 10.0
            reasons.append({
                "code": "FREE_ACCESSIBLE",
                "message": "Publicly funded / zero-cost learning module.",
            })

        total_score = min(
            sum(score_breakdown.values()),
            100.0
        ) if has_substantive_relevance else 0.0

        return {
            "opportunity": course,
            "match_score": round(total_score, 1),
            "score_breakdown": score_breakdown,
            "reasons": reasons,
            "matching_skills": list(set(matching_skills)),
            "addressed_gaps": list(set(addressed_gaps)),
        }

    def _score_opportunity(
        self,
        opp: Dict[str, Any],
        item_roles: List[str],
        item_skills: List[str],
        evidenced_skill_keys: set,
        all_user_skill_keys: set,
        selected_role_id: Optional[str],
        user_state: str,
        preferred_locs: List[str],
        user_sector: str,
        is_custom_role: bool,
    ) -> Dict[str, Any]:
        """Calculates deterministic matching score and reasons for a job, internship, or scheme."""
        score_breakdown = {
            "evidenced_skill_points": 0.0,
            "role_or_sector_points": 0.0,
            "location_points": 0.0,
            "flagship_scheme_points": 0.0,
        }
        reasons = []
        matching_skills = []

        # 1. Demonstrated skills match (up to 40 pts)
        if item_skills and evidenced_skill_keys:
            evidenced_matches = [sk for sk in item_skills if sk in evidenced_skill_keys]
            if evidenced_matches:
                score_breakdown["evidenced_skill_points"] = min(len(evidenced_matches) * 20.0, 40.0)
                matching_skills.extend(evidenced_matches)
                reasons.append({
                    "code": "EVIDENCED_SKILL_MATCH",
                    "message": f"Demonstrated evidence in profile matches requirements: {', '.join([m.title() for m in evidenced_matches])}.",
                })

        # 2. Target role or sector match (up to 30 pts)
        if not is_custom_role and selected_role_id and selected_role_id in item_roles:
            score_breakdown["role_or_sector_points"] = 30.0
            reasons.append({
                "code": "ROLE_ALIGNMENT",
                "message": "Directly corresponds to your selected target occupation track.",
            })
        elif user_sector and (user_sector in opp.get("description", "").lower() or user_sector in opp.get("title", "").lower()):
            score_breakdown["role_or_sector_points"] = 15.0
            reasons.append({
                "code": "SECTOR_ALIGNMENT",
                "message": "Aligned with candidate's target industry sector.",
            })

        # Check if opportunity has substantive skill, role, or sector relevance
        has_substantive_relevance = (
            score_breakdown["evidenced_skill_points"] > 0
            or score_breakdown["role_or_sector_points"] > 0
        )

        # 3. Location compatibility (up to 15 pts) - bonus if substantively relevant
        if has_substantive_relevance:
            work_mode = opp.get("work_mode", "online")
            opp_state = (opp.get("location_state") or "").upper()
            if work_mode in ("online", "all_india"):
                score_breakdown["location_points"] = 15.0
                reasons.append({
                    "code": "LOCATION_ACCESSIBLE",
                    "message": "All-India / nationwide accessibility.",
                })
            elif opp_state and (opp_state == user_state or opp_state in preferred_locs):
                score_breakdown["location_points"] = 15.0
                reasons.append({
                    "code": "LOCATION_MATCH",
                    "message": f"Located in candidate's specified state ({opp_state}).",
                })

            # 4. Flagship Government Scheme / Portal backing (15 pts)
            if opp.get("opportunity_type") == "scheme":
                score_breakdown["flagship_scheme_points"] = 15.0
                reasons.append({
                    "code": "OFFICIAL_FLAGSHIP_SCHEME",
                    "message": "Official Government of India youth skilling and stipend initiative.",
                })

        total_score = min(
            sum(score_breakdown.values()),
            100.0
        ) if has_substantive_relevance else 0.0

        return {
            "opportunity": opp,
            "match_score": round(total_score, 1),
            "score_breakdown": score_breakdown,
            "reasons": reasons,
            "matching_skills": list(set(matching_skills)),
            "addressed_gaps": [],
        }
