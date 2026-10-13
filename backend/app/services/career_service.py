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
            "target_role_title": row["target_role_title"],
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
        target_role = (payload.get("target_role_title") or "").strip()
        if not target_role or len(target_role) < 2:
            raise ValueError("Target role title is required and must be at least 2 characters.")

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
