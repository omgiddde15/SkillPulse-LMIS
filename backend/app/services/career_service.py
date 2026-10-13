"""Career profile and resume management service for SkillPulse.

Enforces strict single-tenant user ownership for career profiles and private resume files.
Manages disk storage in the secure private upload directory and synchronizes SQLite metadata.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List

from app.db import get_db, init_db, get_upload_dir
from app.services.role_catalogue import (
    normalize_skill_key,
    get_skill_category,
    get_skill_display_name,
)


class CareerServiceError(Exception):
    """Domain exception for career service failures."""
    pass


class CareerService:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path
        init_db(self.db_path)

    # -------------------------------------------------------------------------
    # Career Profile Operations
    # -------------------------------------------------------------------------

    def get_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves career profile for the authenticated user, or None if not yet created."""
        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, target_role_title, target_occupation_id, target_sector,
                       current_education_level, institution_name, graduation_year,
                       years_experience, current_state, current_district,
                       preferred_locations_json, consent_ai_processing, created_at, updated_at
                FROM career_profiles
                WHERE user_id = ?
                """,
                (user_id,)
            )
            row = cursor.fetchone()

        if not row:
            return None

        pref_locs = []
        try:
            pref_locs = json.loads(row["preferred_locations_json"] or "[]")
        except Exception:
            pref_locs = []

        return {
            "id": row["id"],
            "user_id": row["user_id"],
            "target_role_title": row["target_role_title"] if row["target_role_title"] else None,
            "target_occupation_id": row["target_occupation_id"],
            "target_sector": row["target_sector"],
            "current_education_level": row["current_education_level"],
            "institution_name": row["institution_name"],
            "graduation_year": row["graduation_year"],
            "years_experience": float(row["years_experience"]),
            "current_state": row["current_state"],
            "current_district": row["current_district"],
            "preferred_locations": pref_locs,
            "consent_ai_processing": bool(row["consent_ai_processing"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def save_or_update_profile(self, user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Creates or updates a user's career profile."""
        raw_role = payload.get("target_role_title")
        target_role = raw_role.strip() if raw_role else ""
        if target_role and len(target_role) < 2:
            raise ValueError("Target role title must be at least 2 characters if provided.")

        target_occ_id = payload.get("target_occupation_id")
        if target_occ_id:
            target_occ_id = str(target_occ_id).strip() or None

        target_sector = payload.get("target_sector")
        edu_level = payload.get("current_education_level")
        institution = payload.get("institution_name")
        grad_year = payload.get("graduation_year")
        years_exp = float(payload.get("years_experience", 0.0))
        current_state = payload.get("current_state")
        current_district = payload.get("current_district")
        pref_locs = payload.get("preferred_locations") or []
        pref_locs_json = json.dumps(pref_locs)
        consent_ai = 1 if payload.get("consent_ai_processing") else 0

        now_iso = datetime.now(timezone.utc).isoformat()

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            # Upsert into career_profiles
            cursor.execute(
                """
                INSERT INTO career_profiles (
                    user_id, target_role_title, target_occupation_id, target_sector,
                    current_education_level, institution_name, graduation_year,
                    years_experience, current_state, current_district,
                    preferred_locations_json, consent_ai_processing, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    target_role_title = excluded.target_role_title,
                    target_occupation_id = excluded.target_occupation_id,
                    target_sector = excluded.target_sector,
                    current_education_level = excluded.current_education_level,
                    institution_name = excluded.institution_name,
                    graduation_year = excluded.graduation_year,
                    years_experience = excluded.years_experience,
                    current_state = excluded.current_state,
                    current_district = excluded.current_district,
                    preferred_locations_json = excluded.preferred_locations_json,
                    consent_ai_processing = excluded.consent_ai_processing,
                    updated_at = excluded.updated_at
                """,
                (
                    user_id, target_role, target_occ_id, target_sector,
                    edu_level, institution, grad_year, years_exp,
                    current_state, current_district, pref_locs_json,
                    consent_ai, now_iso, now_iso
                )
            )
            conn.commit()

        # Fetch and return the updated record
        updated = self.get_profile(user_id)
        if not updated:
            raise CareerServiceError("Failed to persist career profile.")
        return updated

    # -------------------------------------------------------------------------
    # Resume Storage & Review Operations
    # -------------------------------------------------------------------------

    def save_resume(
        self,
        user_id: int,
        original_filename: str,
        file_bytes: bytes,
        parsed_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Saves uploaded PDF bytes to the private upload directory and records metadata."""
        upload_dir = get_upload_dir()
        # Generate unpredictable storage key
        storage_key = f"res_{uuid.uuid4().hex}.pdf"
        target_file_path = upload_dir / storage_key

        file_size = len(file_bytes)
        clean_filename = Path(original_filename).name[:150] or "resume.pdf"
        parsed_data_json = json.dumps(parsed_data)
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Write file to private disk location
        try:
            with open(target_file_path, "wb") as f:
                f.write(file_bytes)
        except Exception as exc:
            raise CareerServiceError(f"Failed to write private resume file: {exc}")

        # 2. Persist record to database
        try:
            with get_db(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO user_resumes (
                        user_id, original_filename, storage_key, file_size_bytes,
                        parsed_data_json, is_reviewed, uploaded_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                    """,
                    (
                        user_id, clean_filename, storage_key, file_size,
                        parsed_data_json, now_iso, now_iso
                    )
                )
                resume_id = cursor.lastrowid
                conn.commit()
        except Exception as exc:
            # Cleanup orphaned file if DB insertion failed
            if target_file_path.exists():
                try:
                    target_file_path.unlink()
                except Exception:
                    pass
            raise CareerServiceError(f"Database error during resume registration: {exc}")

        # Sync initial extracted skills as unconfirmed
        try:
            self.sync_extracted_skills(user_id, parsed_data.get("detected_skills", []), clean_filename)
        except Exception:
            pass

        return {
            "id": resume_id,
            "user_id": user_id,
            "original_filename": clean_filename,
            "file_size_bytes": file_size,
            "parsed_data": parsed_data,
            "is_reviewed": False,
            "uploaded_at": now_iso,
            "updated_at": now_iso,
        }

    def get_latest_resume(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves metadata and parsed data for the user's latest resume."""
        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, original_filename, file_size_bytes,
                       parsed_data_json, is_reviewed, uploaded_at, updated_at
                FROM user_resumes
                WHERE user_id = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (user_id,)
            )
            row = cursor.fetchone()

        if not row:
            return None

        parsed_data = {}
        try:
            parsed_data = json.loads(row["parsed_data_json"] or "{}")
        except Exception:
            parsed_data = {}

        return {
            "id": row["id"],
            "user_id": row["user_id"],
            "original_filename": row["original_filename"],
            "file_size_bytes": row["file_size_bytes"],
            "parsed_data": parsed_data,
            "is_reviewed": bool(row["is_reviewed"]),
            "uploaded_at": row["uploaded_at"],
            "updated_at": row["updated_at"],
        }

    def review_resume(
        self,
        user_id: int,
        resume_id: int,
        reviewed_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Saves user-reviewed parsed data and marks resume as reviewed."""
        now_iso = datetime.now(timezone.utc).isoformat()
        reviewed_json = json.dumps(reviewed_data)

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE user_resumes
                SET parsed_data_json = ?, is_reviewed = 1, updated_at = ?
                WHERE id = ? AND user_id = ?
                """,
                (reviewed_json, now_iso, resume_id, user_id)
            )
            if cursor.rowcount == 0:
                return None
            conn.commit()

            cursor.execute(
                """
                SELECT id, user_id, original_filename, file_size_bytes,
                       parsed_data_json, is_reviewed, uploaded_at, updated_at
                FROM user_resumes
                WHERE id = ? AND user_id = ?
                """,
                (resume_id, user_id)
            )
            row = cursor.fetchone()

        if not row:
            return None

        # Synchronize reviewed skills into user_skills
        try:
            supporting_context = (
                reviewed_data.get("projects_summary") or reviewed_data.get("experience_summary")
            )
            self.sync_reviewed_skills(
                user_id=user_id,
                confirmed_skills=reviewed_data.get("detected_skills", []),
                supporting_context=supporting_context,
            )
        except Exception:
            pass

        return {
            "id": row["id"],
            "user_id": row["user_id"],
            "original_filename": row["original_filename"],
            "file_size_bytes": row["file_size_bytes"],
            "parsed_data": reviewed_data,
            "is_reviewed": True,
            "uploaded_at": row["uploaded_at"],
            "updated_at": row["updated_at"],
        }

    def delete_resume(self, user_id: int, resume_id: int) -> bool:
        """Deletes the resume from disk and removes the database record."""
        upload_dir = get_upload_dir()

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT storage_key FROM user_resumes WHERE id = ? AND user_id = ?",
                (resume_id, user_id)
            )
            row = cursor.fetchone()
            if not row:
                return False

            storage_key = row["storage_key"]

            # Remove file from disk
            file_path = upload_dir / storage_key
            if file_path.exists():
                try:
                    file_path.unlink()
                except Exception as exc:
                    raise CareerServiceError(f"Could not remove private resume file: {exc}")

            # Remove record from database
            cursor.execute(
                "DELETE FROM user_resumes WHERE id = ? AND user_id = ?",
                (resume_id, user_id)
            )
            deleted = cursor.rowcount > 0
            conn.commit()

        return deleted

    # -------------------------------------------------------------------------
    # Phase 2: User Skill Evidence Management
    # -------------------------------------------------------------------------

    def sync_extracted_skills(self, user_id: int, detected_skills: List[str], filename: str) -> None:
        """Records initial resume-extracted skills with 'unconfirmed' status.
        
        Preserves existing user claims and evidence (never downgrades an already claimed/evidenced skill).
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            for skill_raw in detected_skills:
                skill_key = normalize_skill_key(skill_raw)
                if not skill_key:
                    continue
                display_name = get_skill_display_name(skill_key)
                category = get_skill_category(skill_key)

                cursor.execute(
                    "SELECT id, evidence_status FROM user_skills WHERE user_id = ? AND skill_key = ?",
                    (user_id, skill_key)
                )
                existing = cursor.fetchone()
                if existing:
                    # Do not overwrite if already claimed or evidenced
                    continue
                else:
                    cursor.execute(
                        """
                        INSERT INTO user_skills (
                            user_id, skill_key, skill_name, category, evidence_status,
                            source_type, source_context, confidence_score,
                            verified_by_user, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, 'unconfirmed', 'resume_extracted', ?, 0.85, 0, ?, ?)
                        """,
                        (user_id, skill_key, display_name, category, f"Extracted from {filename}", now_iso, now_iso)
                    )
            conn.commit()

    def sync_reviewed_skills(
        self,
        user_id: int,
        confirmed_skills: List[str],
        supporting_context: Optional[str] = None
    ) -> None:
        """Synchronizes user-confirmed skills when resume review is confirmed.
        
        - Confirmed skills transition from 'unconfirmed' to 'claimed' (or 'evidenced' if context exists).
        - Unconfirmed extracted skills omitted from the confirmed list are removed so rejected suggestions don't linger.
        - Existing 'claimed' or 'evidenced' skills are preserved.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        confirmed_keys = set()
        for s in confirmed_skills:
            k = normalize_skill_key(s)
            if k:
                confirmed_keys.add((k, s))

        confirmed_key_set = {k for k, _ in confirmed_keys}

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()

            # 1. Promote or insert confirmed skills
            for skill_key, original_name in confirmed_keys:
                display_name = get_skill_display_name(skill_key) or original_name
                category = get_skill_category(skill_key)

                cursor.execute(
                    "SELECT id, evidence_status, source_context FROM user_skills WHERE user_id = ? AND skill_key = ?",
                    (user_id, skill_key)
                )
                existing = cursor.fetchone()

                if existing:
                    # If it was unconfirmed, promote it to claimed or evidenced
                    if existing["evidence_status"] == "unconfirmed":
                        new_status = "evidenced" if supporting_context else "claimed"
                        new_context = supporting_context[:400] if supporting_context else existing["source_context"]
                        cursor.execute(
                            """
                            UPDATE user_skills
                            SET evidence_status = ?, source_context = ?, verified_by_user = 1, updated_at = ?
                            WHERE id = ?
                            """,
                            (new_status, new_context, now_iso, existing["id"])
                        )
                else:
                    # Newly added by user in review card
                    new_status = "evidenced" if supporting_context else "claimed"
                    cursor.execute(
                        """
                        INSERT INTO user_skills (
                            user_id, skill_key, skill_name, category, evidence_status,
                            source_type, source_context, confidence_score,
                            verified_by_user, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, 'resume_extracted', ?, 1.0, 1, ?, ?)
                        """,
                        (user_id, skill_key, display_name, category, new_status, supporting_context[:400] if supporting_context else None, now_iso, now_iso)
                    )

            # 2. Remove unconfirmed resume-extracted skills that were rejected/removed by the user
            cursor.execute(
                """
                SELECT id, skill_key FROM user_skills
                WHERE user_id = ? AND evidence_status = 'unconfirmed' AND source_type = 'resume_extracted'
                """,
                (user_id,)
            )
            unconfirmed_rows = cursor.fetchall()
            for row in unconfirmed_rows:
                if row["skill_key"] not in confirmed_key_set:
                    cursor.execute("DELETE FROM user_skills WHERE id = ?", (row["id"],))

            conn.commit()

    def get_user_skills(self, user_id: int) -> List[Dict[str, Any]]:
        """Retrieves all registered skills for the user ordered by status and category."""
        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, skill_key, skill_name, category, evidence_status,
                       source_type, source_context, confidence_score, verified_by_user,
                       created_at, updated_at
                FROM user_skills
                WHERE user_id = ?
                ORDER BY
                    CASE evidence_status
                        WHEN 'evidenced' THEN 1
                        WHEN 'claimed' THEN 2
                        WHEN 'unconfirmed' THEN 3
                        ELSE 4
                    END,
                    skill_name ASC
                """,
                (user_id,)
            )
            rows = cursor.fetchall()

        skills = []
        for r in rows:
            skills.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "skill_key": r["skill_key"],
                "skill_name": r["skill_name"],
                "category": r["category"],
                "evidence_status": r["evidence_status"],
                "source_type": r["source_type"],
                "source_context": r["source_context"],
                "confidence_score": float(r["confidence_score"] if r["confidence_score"] is not None else 1.0),
                "verified_by_user": bool(r["verified_by_user"]),
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            })
        return skills

    def get_user_skill_by_id(self, user_id: int, skill_id: int) -> Optional[Dict[str, Any]]:
        """Fetches a single user skill, verifying user ownership."""
        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, skill_key, skill_name, category, evidence_status,
                       source_type, source_context, confidence_score, verified_by_user,
                       created_at, updated_at
                FROM user_skills
                WHERE id = ? AND user_id = ?
                """,
                (skill_id, user_id)
            )
            r = cursor.fetchone()

        if not r:
            return None

        return {
            "id": r["id"],
            "user_id": r["user_id"],
            "skill_key": r["skill_key"],
            "skill_name": r["skill_name"],
            "category": r["category"],
            "evidence_status": r["evidence_status"],
            "source_type": r["source_type"],
            "source_context": r["source_context"],
            "confidence_score": float(r["confidence_score"] if r["confidence_score"] is not None else 1.0),
            "verified_by_user": bool(r["verified_by_user"]),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }

    def add_user_skill(self, user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Creates or updates a user skill claim with optional supporting evidence."""
        raw_name = payload["skill_name"].strip()
        skill_key = normalize_skill_key(raw_name)
        if not skill_key:
            raise ValueError("Invalid skill name.")

        display_name = raw_name
        category = payload.get("category") or get_skill_category(skill_key)
        evidence_status = payload.get("evidence_status", "claimed")
        source_type = payload.get("source_type", "self_reported")
        source_context = payload.get("source_context")
        confidence = float(payload.get("confidence_score", 1.0))
        verified = 1 if payload.get("verified_by_user", True) else 0
        now_iso = datetime.now(timezone.utc).isoformat()

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO user_skills (
                    user_id, skill_key, skill_name, category, evidence_status,
                    source_type, source_context, confidence_score,
                    verified_by_user, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, skill_key) DO UPDATE SET
                    skill_name = excluded.skill_name,
                    category = excluded.category,
                    evidence_status = excluded.evidence_status,
                    source_type = excluded.source_type,
                    source_context = excluded.source_context,
                    confidence_score = excluded.confidence_score,
                    verified_by_user = excluded.verified_by_user,
                    updated_at = excluded.updated_at
                """,
                (
                    user_id, skill_key, display_name, category, evidence_status,
                    source_type, source_context, confidence, verified, now_iso, now_iso
                )
            )
            conn.commit()

            cursor.execute(
                "SELECT id FROM user_skills WHERE user_id = ? AND skill_key = ?",
                (user_id, skill_key)
            )
            row = cursor.fetchone()
            skill_id = row["id"]

        result = self.get_user_skill_by_id(user_id, skill_id)
        if not result:
            raise CareerServiceError("Failed to persist user skill.")
        return result

    def update_user_skill(self, user_id: int, skill_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Updates an existing user skill, returning None if not found or unauthorized."""
        existing = self.get_user_skill_by_id(user_id, skill_id)
        if not existing:
            return None

        now_iso = datetime.now(timezone.utc).isoformat()
        skill_name = payload.get("skill_name") or existing["skill_name"]
        category = payload.get("category") or existing["category"]
        evidence_status = payload.get("evidence_status") or existing["evidence_status"]
        source_type = payload.get("source_type") or existing["source_type"]
        source_context = payload.get("source_context") if "source_context" in payload else existing["source_context"]
        confidence = float(payload.get("confidence_score")) if payload.get("confidence_score") is not None else existing["confidence_score"]
        verified = (1 if payload.get("verified_by_user") else 0) if "verified_by_user" in payload and payload["verified_by_user"] is not None else (1 if existing["verified_by_user"] else 0)

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE user_skills
                SET skill_name = ?, category = ?, evidence_status = ?,
                    source_type = ?, source_context = ?, confidence_score = ?,
                    verified_by_user = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
                """,
                (
                    skill_name, category, evidence_status,
                    source_type, source_context, confidence,
                    verified, now_iso, skill_id, user_id
                )
            )
            if cursor.rowcount == 0:
                return None
            conn.commit()

        return self.get_user_skill_by_id(user_id, skill_id)

    def delete_user_skill(self, user_id: int, skill_id: int) -> bool:
        """Deletes a user skill, returning False if not found or unauthorized."""
        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM user_skills WHERE id = ? AND user_id = ?",
                (skill_id, user_id)
            )
            deleted = cursor.rowcount > 0
            conn.commit()
        return deleted

