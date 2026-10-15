"""Database management module for SkillPulse LMIS.

Provides SQLite connection management, table schemas, and indexing for:
- Users & Authentication
- Server-side Sessions
- User Saved Scenarios (Seat Simulator Projections)
"""

import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "skillpulse.db"
DEFAULT_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "resumes"


def get_db_path() -> str:
    """Returns the database path, allowing override via SKILLPULSE_DB_PATH."""
    override = os.environ.get("SKILLPULSE_DB_PATH")
    if override:
        return override
    # Ensure data directory exists
    DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return str(DEFAULT_DB_PATH)


def get_upload_dir() -> Path:
    """Returns the private upload directory, allowing override via SKILLPULSE_UPLOAD_DIR."""
    override = os.environ.get("SKILLPULSE_UPLOAD_DIR")
    if override:
        path = Path(override)
    else:
        path = DEFAULT_UPLOAD_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def init_db(db_path: str = None) -> None:
    """Initializes tables and indexes in SQLite."""
    target_path = db_path or get_db_path()
    if target_path != ":memory:":
        Path(target_path).parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(target_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        cursor = conn.cursor()

        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                full_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """)

        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        # Saved Scenarios table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS saved_scenarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                notes TEXT,
                period TEXT NOT NULL,
                district_id TEXT NOT NULL,
                district_name TEXT,
                state_code TEXT,
                occupation_id TEXT NOT NULL,
                occupation_title TEXT,
                horizon_months INTEGER NOT NULL,
                proposed_seats_per_cohort INTEGER NOT NULL,
                posting_to_opening_multiplier REAL NOT NULL,
                local_availability_factor REAL NOT NULL,
                inputs_json TEXT NOT NULL,
                results_json TEXT NOT NULL,
                disclaimer TEXT NOT NULL DEFAULT 'Simulated Scenario — Policy Planning Projection',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        # Career Profiles table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS career_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                target_role_title TEXT NOT NULL DEFAULT '',
                target_occupation_id TEXT,
                target_sector TEXT,
                current_education_level TEXT,
                institution_name TEXT,
                graduation_year INTEGER,
                years_experience REAL NOT NULL DEFAULT 0.0,
                current_state TEXT,
                current_district TEXT,
                preferred_locations_json TEXT NOT NULL DEFAULT '[]',
                consent_ai_processing INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        # User Resumes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_resumes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                original_filename TEXT NOT NULL,
                storage_key TEXT NOT NULL UNIQUE,
                file_size_bytes INTEGER NOT NULL,
                parsed_data_json TEXT NOT NULL,
                is_reviewed INTEGER NOT NULL DEFAULT 0,
                uploaded_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        # User Skills table (Phase 2)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                skill_key TEXT NOT NULL,
                skill_name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'technical',
                evidence_status TEXT NOT NULL DEFAULT 'unconfirmed',
                source_type TEXT NOT NULL DEFAULT 'self_reported',
                source_context TEXT,
                confidence_score REAL DEFAULT 1.0,
                verified_by_user INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, skill_key)
            );
        """)

        # Opportunity Sources Registry (Phase 3)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS opportunity_sources (
                source_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                home_url TEXT NOT NULL,
                approved_domain TEXT NOT NULL,
                managing_agency TEXT NOT NULL,
                category TEXT NOT NULL,
                supported_types_json TEXT NOT NULL DEFAULT '[]',
                verification_status TEXT NOT NULL DEFAULT 'verified_official',
                data_access_method TEXT NOT NULL DEFAULT 'public_directory_link',
                last_verified_at TEXT NOT NULL,
                refresh_interval TEXT NOT NULL DEFAULT 'monthly',
                provenance_notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # Opportunity Catalogue (Phase 3)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS opportunity_catalogue (
                id TEXT PRIMARY KEY,
                record_kind TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                opportunity_type TEXT NOT NULL,
                provider_name TEXT NOT NULL,
                source_id TEXT NOT NULL,
                official_url TEXT NOT NULL,
                role_ids_json TEXT NOT NULL DEFAULT '[]',
                skill_keys_json TEXT NOT NULL DEFAULT '[]',
                eligibility_json TEXT NOT NULL DEFAULT '{}',
                eligibility_status TEXT NOT NULL DEFAULT 'not_specified',
                location_state TEXT,
                location_district TEXT,
                work_mode TEXT NOT NULL DEFAULT 'online',
                fee_status TEXT NOT NULL DEFAULT 'unknown',
                fee_amount REAL,
                fee_currency TEXT NOT NULL DEFAULT 'INR',
                stipend_min REAL,
                stipend_max REAL,
                stipend_period TEXT,
                application_deadline TEXT,
                published_at TEXT,
                published_contact_name TEXT,
                published_contact_email TEXT,
                published_contact_phone TEXT,
                listing_status TEXT NOT NULL DEFAULT 'source_listed',
                verification_status TEXT NOT NULL DEFAULT 'verified_official',
                verified_at TEXT NOT NULL,
                source_last_updated_at TEXT,
                provenance_notes TEXT,
                employer_name TEXT,
                industry TEXT,
                employment_type TEXT,
                official_company_website TEXT,
                location_city TEXT,
                workplace_address TEXT,
                work_arrangement TEXT,
                working_hours TEXT,
                weekly_working_days TEXT,
                salary_min REAL,
                salary_max REAL,
                salary_currency TEXT DEFAULT 'INR',
                salary_period TEXT DEFAULT 'month',
                experience_years_min REAL,
                experience_years_max REAL,
                education_requirements TEXT,
                preferred_skills_json TEXT DEFAULT '[]',
                application_instructions TEXT,
                required_documents_json TEXT DEFAULT '[]',
                selection_stages_json TEXT DEFAULT '[]',
                recruitment_contact_email TEXT,
                recruitment_contact_phone TEXT,
                vacancy_url TEXT,
                source_portal_reachable INTEGER DEFAULT 0,
                exact_listing_retrieved INTEGER DEFAULT 0,
                vacancy_status_checked INTEGER DEFAULT 0,
                individual_fields_verified INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES opportunity_sources (source_id) ON DELETE CASCADE
            );
        """)

        # Dynamic schema migration for existing SQLite databases
        cursor.execute("PRAGMA table_info(opportunity_catalogue);")
        existing_opp_cols = {row[1] for row in cursor.fetchall()}
        hiring_columns = [
            ("employer_name", "TEXT"),
            ("industry", "TEXT"),
            ("employment_type", "TEXT"),
            ("official_company_website", "TEXT"),
            ("location_city", "TEXT"),
            ("workplace_address", "TEXT"),
            ("work_arrangement", "TEXT"),
            ("working_hours", "TEXT"),
            ("weekly_working_days", "TEXT"),
            ("salary_min", "REAL"),
            ("salary_max", "REAL"),
            ("salary_currency", "TEXT DEFAULT 'INR'"),
            ("salary_period", "TEXT DEFAULT 'month'"),
            ("experience_years_min", "REAL"),
            ("experience_years_max", "REAL"),
            ("education_requirements", "TEXT"),
            ("preferred_skills_json", "TEXT DEFAULT '[]'"),
            ("application_instructions", "TEXT"),
            ("required_documents_json", "TEXT DEFAULT '[]'"),
            ("selection_stages_json", "TEXT DEFAULT '[]'"),
            ("recruitment_contact_email", "TEXT"),
            ("recruitment_contact_phone", "TEXT"),
            ("vacancy_url", "TEXT"),
            ("source_portal_reachable", "INTEGER DEFAULT 0"),
            ("exact_listing_retrieved", "INTEGER DEFAULT 0"),
            ("vacancy_status_checked", "INTEGER DEFAULT 0"),
            ("individual_fields_verified", "INTEGER DEFAULT 0"),
        ]
        for col_name, col_def in hiring_columns:
            if col_name not in existing_opp_cols:
                cursor.execute(f"ALTER TABLE opportunity_catalogue ADD COLUMN {col_name} {col_def};")

        # Career Roadmaps table (Phase 4)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS career_roadmaps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                target_role_id TEXT NOT NULL,
                role_title TEXT NOT NULL,
                horizon_days INTEGER NOT NULL,
                summary TEXT NOT NULL,
                generation_mode TEXT NOT NULL,
                methodology_note TEXT NOT NULL,
                client_request_token TEXT,
                generated_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        # Roadmap Milestones table (Phase 4)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS roadmap_milestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                roadmap_id INTEGER NOT NULL,
                milestone_order INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                target_skill_keys_json TEXT NOT NULL DEFAULT '[]',
                action_type TEXT NOT NULL,
                suggested_duration_days INTEGER NOT NULL DEFAULT 7,
                linked_opportunity_id TEXT,
                is_completed INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (roadmap_id) REFERENCES career_roadmaps (id) ON DELETE CASCADE
            );
        """)

        # Copilot Conversations table (Phase 5)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS copilot_conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT 'Career Guidance',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        # Copilot Messages table (Phase 5)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS copilot_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                sender TEXT NOT NULL CHECK(sender IN ('user', 'assistant')),
                content TEXT NOT NULL,
                sources_json TEXT NOT NULL DEFAULT '[]',
                generation_mode TEXT NOT NULL DEFAULT 'deterministic',
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES copilot_conversations (id) ON DELETE CASCADE
            );
        """)

        # Application Tracker table (Phase 5)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS application_tracker (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                opportunity_id TEXT,
                custom_title TEXT,
                custom_organization TEXT,
                stage TEXT NOT NULL DEFAULT 'saved' CHECK(stage IN ('saved', 'planning', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn')),
                date_saved TEXT NOT NULL,
                date_applied TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (opportunity_id) REFERENCES opportunity_catalogue (id) ON DELETE SET NULL
            );
        """)

        # Indexes for fast lookup and integrity
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON saved_scenarios(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_career_profiles_user_id ON career_profiles(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_resumes_user_id ON user_resumes(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_resumes_storage_key ON user_resumes(storage_key);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_skills_user_skill ON user_skills(user_id, skill_key);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_opp_record_kind ON opportunity_catalogue(record_kind);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_opp_type ON opportunity_catalogue(opportunity_type);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_opp_source_id ON opportunity_catalogue(source_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_opp_listing_status ON opportunity_catalogue(listing_status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_opp_fee_status ON opportunity_catalogue(fee_status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_opp_location ON opportunity_catalogue(location_state, location_district);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_opp_employer ON opportunity_catalogue(employer_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_opp_work_arrangement ON opportunity_catalogue(work_arrangement);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_opp_industry ON opportunity_catalogue(industry);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_roadmaps_user_id ON career_roadmaps(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_roadmaps_target_role ON career_roadmaps(target_role_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_roadmaps_token ON career_roadmaps(client_request_token);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_milestones_roadmap_id ON roadmap_milestones(roadmap_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_copilot_conv_user ON copilot_conversations(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_copilot_msg_conv ON copilot_messages(conversation_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracker_user ON application_tracker(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracker_stage ON application_tracker(user_id, stage);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracker_opp ON application_tracker(opportunity_id);")
        conn.commit()


@contextmanager
def get_db(db_path: str = None):
    """Context manager yielding a SQLite connection with foreign keys enabled."""
    target_path = db_path or get_db_path()
    conn = sqlite3.connect(target_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
