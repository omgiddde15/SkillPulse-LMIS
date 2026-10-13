"""Scenario management service for SkillPulse LMIS.

Enforces strict user ownership of saved Seat Simulator scenarios.
Prevents unauthenticated or cross-tenant access to private policy simulation records.
"""

import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from app.db import get_db, init_db


class ScenarioService:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path
        init_db(self.db_path)

    def save_scenario(self, user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Saves a simulation scenario for the authenticated user."""
        title = (payload.get("title") or "").strip()
        if not title:
            raise ValueError("Scenario title is required.")
        if len(title) > 150:
            raise ValueError("Scenario title cannot exceed 150 characters.")

        notes = (payload.get("notes") or "").strip()
        period = payload.get("period", "2026-09")
        district_id = payload.get("district_id", "")
        district_name = payload.get("district_name", "")
        state_code = payload.get("state_code", "")
        occupation_id = payload.get("occupation_id", "")
        occupation_title = payload.get("occupation_title", "")
        horizon_months = int(payload.get("horizon_months", 3))
        proposed_seats = int(payload.get("proposed_seats_per_cohort", 100))
        k_mult = float(payload.get("posting_to_opening_multiplier", 1.0))
        alpha = float(payload.get("local_availability_factor", 1.0))

        inputs_json = json.dumps(payload.get("inputs") or {
            "period": period,
            "district_id": district_id,
            "occupation_id": occupation_id,
            "horizon_months": horizon_months,
            "proposed_seats_per_cohort": proposed_seats,
            "posting_to_opening_multiplier": k_mult,
            "local_availability_factor": alpha
        })

        results_json = json.dumps(payload.get("results") or {})
        disclaimer = "Simulated Scenario — Policy Planning Projection (Synthetic Demonstration Model)"
        now_iso = datetime.now(timezone.utc).isoformat()

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO saved_scenarios (
                    user_id, title, notes, period, district_id, district_name, state_code,
                    occupation_id, occupation_title, horizon_months, proposed_seats_per_cohort,
                    posting_to_opening_multiplier, local_availability_factor, inputs_json,
                    results_json, disclaimer, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id, title, notes, period, district_id, district_name, state_code,
                    occupation_id, occupation_title, horizon_months, proposed_seats,
                    k_mult, alpha, inputs_json, results_json, disclaimer, now_iso
                )
            )
            scenario_id = cursor.lastrowid
            conn.commit()

        return {
            "id": scenario_id,
            "user_id": user_id,
            "title": title,
            "notes": notes,
            "period": period,
            "district_id": district_id,
            "district_name": district_name,
            "state_code": state_code,
            "occupation_id": occupation_id,
            "occupation_title": occupation_title,
            "horizon_months": horizon_months,
            "proposed_seats_per_cohort": proposed_seats,
            "posting_to_opening_multiplier": k_mult,
            "local_availability_factor": alpha,
            "inputs": json.loads(inputs_json),
            "results": json.loads(results_json),
            "disclaimer": disclaimer,
            "created_at": now_iso
        }

    def list_scenarios(self, user_id: int) -> List[Dict[str, Any]]:
        """Lists all saved scenarios belonging to the given user."""
        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, title, notes, period, district_id, district_name, state_code,
                       occupation_id, occupation_title, horizon_months, proposed_seats_per_cohort,
                       posting_to_opening_multiplier, local_availability_factor, inputs_json,
                       results_json, disclaimer, created_at
                FROM saved_scenarios
                WHERE user_id = ?
                ORDER BY id DESC
                """,
                (user_id,)
            )
            rows = cursor.fetchall()

        scenarios = []
        for r in rows:
            scenarios.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "title": r["title"],
                "notes": r["notes"],
                "period": r["period"],
                "district_id": r["district_id"],
                "district_name": r["district_name"],
                "state_code": r["state_code"],
                "occupation_id": r["occupation_id"],
                "occupation_title": r["occupation_title"],
                "horizon_months": r["horizon_months"],
                "proposed_seats_per_cohort": r["proposed_seats_per_cohort"],
                "posting_to_opening_multiplier": r["posting_to_opening_multiplier"],
                "local_availability_factor": r["local_availability_factor"],
                "inputs": json.loads(r["inputs_json"]) if r["inputs_json"] else {},
                "results": json.loads(r["results_json"]) if r["results_json"] else {},
                "disclaimer": r["disclaimer"],
                "created_at": r["created_at"]
            })
        return scenarios

    def get_scenario(self, scenario_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves a single scenario, strictly enforcing ownership."""
        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, title, notes, period, district_id, district_name, state_code,
                       occupation_id, occupation_title, horizon_months, proposed_seats_per_cohort,
                       posting_to_opening_multiplier, local_availability_factor, inputs_json,
                       results_json, disclaimer, created_at
                FROM saved_scenarios
                WHERE id = ? AND user_id = ?
                """,
                (scenario_id, user_id)
            )
            r = cursor.fetchone()

        if not r:
            return None

        return {
            "id": r["id"],
            "user_id": r["user_id"],
            "title": r["title"],
            "notes": r["notes"],
            "period": r["period"],
            "district_id": r["district_id"],
            "district_name": r["district_name"],
            "state_code": r["state_code"],
            "occupation_id": r["occupation_id"],
            "occupation_title": r["occupation_title"],
            "horizon_months": r["horizon_months"],
            "proposed_seats_per_cohort": r["proposed_seats_per_cohort"],
            "posting_to_opening_multiplier": r["posting_to_opening_multiplier"],
            "local_availability_factor": r["local_availability_factor"],
            "inputs": json.loads(r["inputs_json"]) if r["inputs_json"] else {},
            "results": json.loads(r["results_json"]) if r["results_json"] else {},
            "disclaimer": r["disclaimer"],
            "created_at": r["created_at"]
        }

    def delete_scenario(self, scenario_id: int, user_id: int) -> bool:
        """Deletes a scenario, strictly enforcing user ownership."""
        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM saved_scenarios WHERE id = ? AND user_id = ?",
                (scenario_id, user_id)
            )
            deleted = cursor.rowcount > 0
            conn.commit()
            return deleted
