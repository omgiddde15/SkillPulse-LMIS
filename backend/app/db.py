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


def get_db_path() -> str:
    """Returns the database path, allowing override via SKILLPULSE_DB_PATH."""
    override = os.environ.get("SKILLPULSE_DB_PATH")
    if override:
        return override
    # Ensure data directory exists
    DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return str(DEFAULT_DB_PATH)


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

        # Indexes for fast lookup and integrity
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON saved_scenarios(user_id);")
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
