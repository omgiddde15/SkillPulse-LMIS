"""Opportunity Catalogue Service for SkillPulse LMIS.

Smart India Hackathon 2026 - Problem Statement SIH26246
AI-Enabled Labour Market Intelligence and Skill Demand-Supply Forecasting Engine

Manages the verified opportunity catalogue, source registry, freshness checks,
and safe link validation across official government and higher education skilling portals.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

from app.db import get_db, get_db_path

logger = logging.getLogger(__name__)

SEEDS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "career_catalogue"
SOURCES_SEED_PATH = SEEDS_DIR / "sources.json"
OPPORTUNITIES_SEED_PATH = SEEDS_DIR / "opportunities.json"

APPROVED_SOURCE_DOMAINS = {
    "skillindiadigital.gov.in",
    "courses.skillindiadigital.gov.in",
    "swayam.gov.in",
    "swayamplus.education.gov.in",
    "ncs.gov.in",
    "apprenticeshipindia.gov.in",
    "pminternship.mca.gov.in",
    "myscheme.gov.in",
}


def is_safe_https_url(url: str, expected_domain: Optional[str] = None) -> bool:
    """Validates that a URL is a secure HTTPS link from an approved domain."""
    if not url or not isinstance(url, str):
        return False
    clean = url.strip()
    if not clean.startswith("https://"):
        return False
    try:
        parsed = urlparse(clean)
        if parsed.scheme.lower() != "https":
            return False
        hostname = (parsed.hostname or "").lower()
        if expected_domain:
            expected = expected_domain.lower()
            if hostname != expected and not hostname.endswith("." + expected):
                return False
        # General check against all approved domains
        is_approved = any(
            hostname == d or hostname.endswith("." + d)
            for d in APPROVED_SOURCE_DOMAINS
        )
        return is_approved
    except Exception:
        return False


def is_deadline_expired(deadline_str: Optional[str]) -> bool:
    """Checks if an ISO-formatted application deadline has passed in UTC."""
    if not deadline_str:
        return False
    try:
        clean = deadline_str.strip()
        # Support YYYY-MM-DD or full ISO
        if len(clean) == 10:
            dl_dt = datetime.fromisoformat(clean).replace(tzinfo=timezone.utc)
        else:
            dl_dt = datetime.fromisoformat(clean.replace("Z", "+00:00"))
            if dl_dt.tzinfo is None:
                dl_dt = dl_dt.replace(tzinfo=timezone.utc)
        now_dt = datetime.now(timezone.utc)
        return now_dt > dl_dt
    except Exception:
        return False


class OpportunityService:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path

    def seed_catalogue_if_empty(self) -> Dict[str, int]:
        """Idempotently populates sources and opportunities from version-controlled JSON seeds.
        
        Preserves existing user data and does not duplicate records.
        """
        sources_seeded = 0
        opportunities_seeded = 0

        if not SOURCES_SEED_PATH.exists() or not OPPORTUNITIES_SEED_PATH.exists():
            logger.warning("Opportunity catalogue seed files not found at %s", SEEDS_DIR)
            return {"sources_seeded": 0, "opportunities_seeded": 0}

        with open(SOURCES_SEED_PATH, "r", encoding="utf-8") as f:
            sources_data = json.load(f)

        with open(OPPORTUNITIES_SEED_PATH, "r", encoding="utf-8") as f:
            opportunities_data = json.load(f)

        now_str = datetime.now(timezone.utc).isoformat()

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()

            # 1. Seed Sources
            for s in sources_data:
                # Validate URL
                if not is_safe_https_url(s["home_url"], s.get("approved_domain")):
                    logger.warning("Skipping source %s due to invalid/unsafe URL", s.get("source_id"))
                    continue

                cursor.execute("""
                    INSERT INTO opportunity_sources (
                        source_id, name, home_url, approved_domain, managing_agency,
                        category, supported_types_json, verification_status,
                        data_access_method, last_verified_at, refresh_interval,
                        provenance_notes, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(source_id) DO UPDATE SET
                        name=excluded.name,
                        home_url=excluded.home_url,
                        approved_domain=excluded.approved_domain,
                        managing_agency=excluded.managing_agency,
                        category=excluded.category,
                        supported_types_json=excluded.supported_types_json,
                        verification_status=excluded.verification_status,
                        data_access_method=excluded.data_access_method,
                        last_verified_at=excluded.last_verified_at,
                        refresh_interval=excluded.refresh_interval,
                        provenance_notes=excluded.provenance_notes,
                        updated_at=excluded.updated_at;
                """, (
                    s["source_id"],
                    s["name"],
                    s["home_url"],
                    s["approved_domain"],
                    s["managing_agency"],
                    s["category"],
                    json.dumps(s.get("supported_types", [])),
                    s.get("verification_status", "verified_official"),
                    s.get("data_access_method", "public_directory_link"),
                    s.get("last_verified_at", "2026-10-14"),
                    s.get("refresh_interval", "monthly"),
                    s.get("provenance_notes"),
                    now_str,
                    now_str,
                ))
                sources_seeded += 1

            # 2. Seed Opportunities
            for opp in opportunities_data:
                # Validate URL
                if not is_safe_https_url(opp["official_url"]):
                    logger.warning("Skipping opportunity %s due to invalid/unsafe URL", opp.get("id"))
                    continue

                cursor.execute("""
                    INSERT INTO opportunity_catalogue (
                        id, record_kind, title, description, opportunity_type,
                        provider_name, source_id, official_url, role_ids_json,
                        skill_keys_json, eligibility_json, eligibility_status,
                        location_state, location_district, work_mode, fee_status,
                        fee_amount, fee_currency, stipend_min, stipend_max,
                        stipend_period, application_deadline, published_at,
                        published_contact_name, published_contact_email,
                        published_contact_phone, listing_status, verification_status,
                        verified_at, source_last_updated_at, provenance_notes,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )
                    ON CONFLICT(id) DO UPDATE SET
                        record_kind=excluded.record_kind,
                        title=excluded.title,
                        description=excluded.description,
                        opportunity_type=excluded.opportunity_type,
                        provider_name=excluded.provider_name,
                        source_id=excluded.source_id,
                        official_url=excluded.official_url,
                        role_ids_json=excluded.role_ids_json,
                        skill_keys_json=excluded.skill_keys_json,
                        eligibility_json=excluded.eligibility_json,
                        eligibility_status=excluded.eligibility_status,
                        location_state=excluded.location_state,
                        location_district=excluded.location_district,
                        work_mode=excluded.work_mode,
                        fee_status=excluded.fee_status,
                        fee_amount=excluded.fee_amount,
                        fee_currency=excluded.fee_currency,
                        stipend_min=excluded.stipend_min,
                        stipend_max=excluded.stipend_max,
                        stipend_period=excluded.stipend_period,
                        application_deadline=excluded.application_deadline,
                        published_at=excluded.published_at,
                        published_contact_name=excluded.published_contact_name,
                        published_contact_email=excluded.published_contact_email,
                        published_contact_phone=excluded.published_contact_phone,
                        listing_status=excluded.listing_status,
                        verification_status=excluded.verification_status,
                        verified_at=excluded.verified_at,
                        source_last_updated_at=excluded.source_last_updated_at,
                        provenance_notes=excluded.provenance_notes,
                        updated_at=excluded.updated_at;
                """, (
                    opp["id"],
                    opp["record_kind"],
                    opp["title"],
                    opp["description"],
                    opp["opportunity_type"],
                    opp["provider_name"],
                    opp["source_id"],
                    opp["official_url"],
                    json.dumps(opp.get("role_ids", [])),
                    json.dumps(opp.get("skill_keys", [])),
                    json.dumps(opp.get("eligibility", {})),
                    opp.get("eligibility_status", "not_specified"),
                    opp.get("location_state"),
                    opp.get("location_district"),
                    opp.get("work_mode", "online"),
                    opp.get("fee_status", "unknown"),
                    opp.get("fee_amount"),
                    opp.get("fee_currency", "INR"),
                    opp.get("stipend_min"),
                    opp.get("stipend_max"),
                    opp.get("stipend_period"),
                    opp.get("application_deadline"),
                    opp.get("published_at"),
                    opp.get("published_contact_name"),
                    opp.get("published_contact_email"),
                    opp.get("published_contact_phone"),
                    opp.get("listing_status", "source_listed"),
                    opp.get("verification_status", "verified_official"),
                    opp.get("verified_at", "2026-10-14"),
                    opp.get("source_last_updated_at"),
                    opp.get("provenance_notes"),
                    now_str,
                    now_str,
                ))
                opportunities_seeded += 1

            conn.commit()

        return {
            "sources_seeded": sources_seeded,
            "opportunities_seeded": opportunities_seeded,
        }

    def get_sources(self) -> List[Dict[str, Any]]:
        """Retrieves all registered trusted source directories."""
        self._ensure_seeded()
        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT source_id, name, home_url, approved_domain, managing_agency,
                       category, supported_types_json, verification_status,
                       data_access_method, last_verified_at, refresh_interval,
                       provenance_notes
                FROM opportunity_sources
                ORDER BY name ASC;
            """)
            rows = cursor.fetchall()
            result = []
            for r in rows:
                result.append({
                    "source_id": r["source_id"],
                    "name": r["name"],
                    "home_url": r["home_url"],
                    "approved_domain": r["approved_domain"],
                    "managing_agency": r["managing_agency"],
                    "category": r["category"],
                    "supported_types": json.loads(r["supported_types_json"] or "[]"),
                    "verification_status": r["verification_status"],
                    "data_access_method": r["data_access_method"],
                    "last_verified_at": r["last_verified_at"],
                    "refresh_interval": r["refresh_interval"],
                    "provenance_notes": r["provenance_notes"],
                })
            return result

    def get_opportunities(
        self,
        opportunity_type: Optional[str] = None,
        record_kind: Optional[str] = None,
        search: Optional[str] = None,
        role_id: Optional[str] = None,
        skill_key: Optional[str] = None,
        location_state: Optional[str] = None,
        work_mode: Optional[str] = None,
        fee_status: Optional[str] = None,
        listing_status: Optional[str] = None,
        verification_status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Queries and filters opportunity catalogue with pagination and freshness checks."""
        self._ensure_seeded()
        conditions = []
        params = []

        if opportunity_type:
            conditions.append("o.opportunity_type = ?")
            params.append(opportunity_type.strip().lower())

        if record_kind:
            conditions.append("o.record_kind = ?")
            params.append(record_kind.strip().lower())

        if fee_status:
            conditions.append("o.fee_status = ?")
            params.append(fee_status.strip().lower())

        if work_mode:
            conditions.append("o.work_mode = ?")
            params.append(work_mode.strip().lower())

        if location_state:
            conditions.append("(o.location_state = ? OR o.location_state IS NULL OR o.work_mode = 'all_india' OR o.work_mode = 'online')")
            params.append(location_state.strip().upper())

        if listing_status:
            conditions.append("o.listing_status = ?")
            params.append(listing_status.strip().lower())

        if verification_status:
            conditions.append("o.verification_status = ?")
            params.append(verification_status.strip().lower())

        if search:
            search_pattern = f"%{search.strip().lower()}%"
            conditions.append("(LOWER(o.title) LIKE ? OR LOWER(o.description) LIKE ? OR LOWER(o.provider_name) LIKE ?)")
            params.extend([search_pattern, search_pattern, search_pattern])

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()

            # Count total matching query
            count_query = f"""
                SELECT COUNT(*) as total
                FROM opportunity_catalogue o
                {where_clause};
            """
            cursor.execute(count_query, params)
            total = cursor.fetchone()["total"]

            # Fetch rows with source name joined
            select_query = f"""
                SELECT o.*, s.name as source_name
                FROM opportunity_catalogue o
                LEFT JOIN opportunity_sources s ON o.source_id = s.source_id
                {where_clause}
                ORDER BY
                    CASE WHEN o.record_kind = 'portal_directory' THEN 1 ELSE 0 END ASC,
                    o.verified_at DESC,
                    o.title ASC
                LIMIT ? OFFSET ?;
            """
            cursor.execute(select_query, params + [max(1, limit), max(0, offset)])
            rows = cursor.fetchall()

            items = []
            for r in rows:
                item = self._format_opportunity_row(r)

                # Post-filter on role_id or skill_key if requested
                if role_id:
                    role_id_clean = role_id.strip().upper()
                    if role_id_clean not in item["role_ids"]:
                        continue
                if skill_key:
                    skill_key_clean = skill_key.strip().lower()
                    if skill_key_clean not in item["skill_keys"]:
                        continue

                items.append(item)

            return {
                "total": total,
                "count": len(items),
                "limit": limit,
                "offset": offset,
                "items": items,
            }

    def get_opportunity_by_id(self, opportunity_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single opportunity item by ID."""
        self._ensure_seeded()
        if not opportunity_id:
            return None

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT o.*, s.name as source_name
                FROM opportunity_catalogue o
                LEFT JOIN opportunity_sources s ON o.source_id = s.source_id
                WHERE o.id = ?;
            """, (opportunity_id.strip(),))
            row = cursor.fetchone()
            if not row:
                return None
            return self._format_opportunity_row(row)

    def _format_opportunity_row(self, r: Any) -> Dict[str, Any]:
        """Maps a SQLite Row to a typed Opportunity item with freshness evaluation."""
        deadline_str = r["application_deadline"]
        is_expired = is_deadline_expired(deadline_str)

        # Freshness adjustment: if deadline passed and status was open, show as closed
        effective_listing_status = r["listing_status"]
        if is_expired and effective_listing_status == "open":
            effective_listing_status = "closed"

        return {
            "id": r["id"],
            "record_kind": r["record_kind"],
            "title": r["title"],
            "description": r["description"],
            "opportunity_type": r["opportunity_type"],
            "provider_name": r["provider_name"],
            "source_id": r["source_id"],
            "source_name": r["source_name"] or r["source_id"],
            "official_url": r["official_url"],
            "role_ids": json.loads(r["role_ids_json"] or "[]"),
            "skill_keys": json.loads(r["skill_keys_json"] or "[]"),
            "eligibility": json.loads(r["eligibility_json"] or "{}"),
            "eligibility_status": r["eligibility_status"] or "not_specified",
            "location_state": r["location_state"],
            "location_district": r["location_district"],
            "work_mode": r["work_mode"],
            "fee_status": r["fee_status"],
            "fee_amount": r["fee_amount"],
            "fee_currency": r["fee_currency"] or "INR",
            "stipend_min": r["stipend_min"],
            "stipend_max": r["stipend_max"],
            "stipend_period": r["stipend_period"],
            "application_deadline": deadline_str,
            "published_at": r["published_at"],
            "published_contact_name": r["published_contact_name"],
            "published_contact_email": r["published_contact_email"],
            "published_contact_phone": r["published_contact_phone"],
            "listing_status": effective_listing_status,
            "verification_status": r["verification_status"],
            "verified_at": r["verified_at"],
            "source_last_updated_at": r["source_last_updated_at"],
            "provenance_notes": r["provenance_notes"],
            "is_deadline_passed": is_expired,
        }

    def _ensure_seeded(self) -> None:
        """Helper to ensure seed data exists if database table is empty."""
        try:
            with get_db(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) as cnt FROM opportunity_sources;")
                if cursor.fetchone()["cnt"] == 0:
                    self.seed_catalogue_if_empty()
        except Exception as exc:
            logger.warning("Could not check/seed catalogue automatically: %s", exc)
