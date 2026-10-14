"""Application Tracker Service for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Provides persistent user tracking of curated catalogue opportunities and manual external applications.
Enforces strict user data ownership and links authoritative catalogue metadata.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from app.db import get_db
from app.services.opportunity_service import OpportunityService

logger = logging.getLogger(__name__)

VALID_TRACKER_STAGES = {
    "saved",
    "planning",
    "applied",
    "assessment",
    "interview",
    "offer",
    "rejected",
    "withdrawn",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TrackerService:
    def __init__(self, opportunity_service: Optional[OpportunityService] = None):
        self.opportunity_service = opportunity_service or OpportunityService()

    def get_tracked_items(
        self,
        user_id: int,
        stage: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieves all tracked opportunities for the authenticated user, optionally filtered by stage."""
        with get_db() as conn:
            cursor = conn.cursor()
            if stage:
                clean_stage = stage.strip().lower()
                cursor.execute(
                    """
                    SELECT id, user_id, opportunity_id, custom_title, custom_organization,
                           stage, date_saved, date_applied, notes, created_at, updated_at
                    FROM application_tracker
                    WHERE user_id = ? AND stage = ?
                    ORDER BY updated_at DESC;
                    """,
                    (user_id, clean_stage),
                )
            else:
                cursor.execute(
                    """
                    SELECT id, user_id, opportunity_id, custom_title, custom_organization,
                           stage, date_saved, date_applied, notes, created_at, updated_at
                    FROM application_tracker
                    WHERE user_id = ?
                    ORDER BY updated_at DESC;
                    """,
                    (user_id,),
                )
            rows = cursor.fetchall()

        items = []
        for r in rows:
            item = dict(r)
            opp_id = item.get("opportunity_id")
            if opp_id:
                item["linked_opportunity"] = self.opportunity_service.get_opportunity_by_id(opp_id)
            else:
                item["linked_opportunity"] = None
            items.append(item)

        return items

    def get_tracked_item(
        self,
        user_id: int,
        tracker_id: int,
    ) -> Optional[Dict[str, Any]]:
        """Retrieves a single tracked item enforcing user ownership."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, opportunity_id, custom_title, custom_organization,
                       stage, date_saved, date_applied, notes, created_at, updated_at
                FROM application_tracker
                WHERE id = ? AND user_id = ?;
                """,
                (tracker_id, user_id),
            )
            row = cursor.fetchone()

        if not row:
            return None

        item = dict(row)
        opp_id = item.get("opportunity_id")
        if opp_id:
            item["linked_opportunity"] = self.opportunity_service.get_opportunity_by_id(opp_id)
        else:
            item["linked_opportunity"] = None

        return item

    def create_tracked_item(
        self,
        user_id: int,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Creates a new application tracker entry for either a catalogue opportunity or external role."""
        opp_id = data.get("opportunity_id")
        custom_title = (data.get("custom_title") or "").strip() or None
        custom_org = (data.get("custom_organization") or "").strip() or None
        raw_stage = (data.get("stage") or "saved").strip().lower()

        if raw_stage not in VALID_TRACKER_STAGES:
            raise ValueError(f"Invalid stage '{raw_stage}'. Must be one of: {', '.join(sorted(VALID_TRACKER_STAGES))}")

        # Validate linked catalogue item if provided
        if opp_id:
            opp = self.opportunity_service.get_opportunity_by_id(opp_id)
            if not opp:
                raise ValueError(f"Opportunity ID '{opp_id}' does not exist in the official catalogue.")
        elif not custom_title:
            raise ValueError("Either an opportunity_id from the catalogue or a custom_title must be specified.")

        now = _now_iso()
        raw_date = (data.get("date_applied") or "").strip() or None
        date_applied = None
        if raw_date:
            try:
                date_applied = datetime.strptime(raw_date, "%Y-%m-%d").date().isoformat()
            except ValueError:
                raise ValueError(f"Invalid date format for date_applied: '{raw_date}'. Expected YYYY-MM-DD.")
        notes = (data.get("notes") or "").strip() or None

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO application_tracker (
                    user_id, opportunity_id, custom_title, custom_organization,
                    stage, date_saved, date_applied, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    user_id,
                    opp_id,
                    custom_title,
                    custom_org,
                    raw_stage,
                    now,
                    date_applied,
                    notes,
                    now,
                    now,
                ),
            )
            item_id = cursor.lastrowid
            conn.commit()

        return self.get_tracked_item(user_id, item_id)

    def update_tracked_item(
        self,
        user_id: int,
        tracker_id: int,
        data: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Updates stage, dates, or notes of an existing tracked item. Enforces user ownership."""
        existing = self.get_tracked_item(user_id, tracker_id)
        if not existing:
            return None

        updates = []
        params = []

        if "stage" in data and data["stage"] is not None:
            raw_stage = data["stage"].strip().lower()
            if raw_stage not in VALID_TRACKER_STAGES:
                raise ValueError(f"Invalid stage '{raw_stage}'. Must be one of: {', '.join(sorted(VALID_TRACKER_STAGES))}")
            updates.append("stage = ?")
            params.append(raw_stage)

        if "date_applied" in data:
            raw_date = (data["date_applied"] or "").strip() or None
            val = None
            if raw_date:
                try:
                    val = datetime.strptime(raw_date, "%Y-%m-%d").date().isoformat()
                except ValueError:
                    raise ValueError(f"Invalid date format for date_applied: '{raw_date}'. Expected YYYY-MM-DD.")
            updates.append("date_applied = ?")
            params.append(val)

        if "notes" in data:
            val = (data["notes"] or "").strip() or None
            updates.append("notes = ?")
            params.append(val)

        if "custom_title" in data:
            val = (data["custom_title"] or "").strip() or None
            if not val and not existing.get("opportunity_id"):
                raise ValueError("A title is required for manual external opportunities.")
            updates.append("custom_title = ?")
            params.append(val)

        if "custom_organization" in data:
            val = (data["custom_organization"] or "").strip() or None
            updates.append("custom_organization = ?")
            params.append(val)

        now = _now_iso()
        updates.append("updated_at = ?")
        params.append(now)

        params.extend([tracker_id, user_id])

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE application_tracker
                SET {', '.join(updates)}
                WHERE id = ? AND user_id = ?;
                """,
                tuple(params),
            )
            conn.commit()

        return self.get_tracked_item(user_id, tracker_id)

    def delete_tracked_item(
        self,
        user_id: int,
        tracker_id: int,
    ) -> bool:
        """Deletes a tracked application entry. Enforces user ownership."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM application_tracker
                WHERE id = ? AND user_id = ?;
                """,
                (tracker_id, user_id),
            )
            conn.commit()
            return cursor.rowcount > 0
