"""Authentication service for SkillPulse LMIS.

Implements secure password hashing with bcrypt, session token generation,
email normalization, session expiration, and credential validation.
"""

import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt

from app.db import get_db, init_db

# Dummy hash used to mitigate timing attacks when user does not exist
DUMMY_HASH = bcrypt.hashpw(b"dummy_timing_protection_value", bcrypt.gensalt()).decode("utf-8")
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class AuthError(Exception):
    """Custom exception for authentication domain errors."""
    pass


class DuplicateEmailError(AuthError):
    """Raised when an email is already registered."""
    pass


class InvalidCredentialsError(AuthError):
    """Raised when credentials do not match."""
    pass


class ValidationError(AuthError):
    """Raised when field validations fail."""
    pass


def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt with salt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Safely verifies a password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def normalize_email(email: str) -> str:
    """Trims whitespace and lowercases email address."""
    return email.strip().lower()


def validate_registration_inputs(email: str, full_name: str, password: str, confirm_password: Optional[str] = None) -> None:
    """Validates user registration fields for length and security constraints."""
    if not full_name or len(full_name.strip()) < 2:
        raise ValidationError("Full name must be at least 2 characters long.")
    if len(full_name.strip()) > 100:
        raise ValidationError("Full name cannot exceed 100 characters.")

    norm_email = normalize_email(email)
    if not norm_email or len(norm_email) > 255 or not EMAIL_REGEX.match(norm_email):
        raise ValidationError("Please provide a valid email address.")

    if not password or len(password) < 8:
        raise ValidationError("Password must be at least 8 characters long.")
    if len(password) > 128:
        raise ValidationError("Password cannot exceed 128 characters.")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        raise ValidationError("Password must contain at least one letter and one number.")

    if confirm_password is not None and password != confirm_password:
        raise ValidationError("Password and confirmation password do not match.")


class AuthService:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path
        init_db(self.db_path)

    def register_user(self, email: str, full_name: str, password: str, confirm_password: Optional[str] = None) -> Dict[str, Any]:
        """Registers a new user account with hashed password and normalized email."""
        validate_registration_inputs(email, full_name, password, confirm_password)
        norm_email = normalize_email(email)
        clean_name = full_name.strip()
        pw_hash = hash_password(password)
        now_iso = datetime.now(timezone.utc).isoformat()

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            # Check for existing email
            cursor.execute("SELECT id FROM users WHERE email = ?", (norm_email,))
            if cursor.fetchone():
                raise DuplicateEmailError("An account with this email address already exists.")

            cursor.execute(
                "INSERT INTO users (email, full_name, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (norm_email, clean_name, pw_hash, now_iso)
            )
            user_id = cursor.lastrowid
            conn.commit()

        return {
            "id": user_id,
            "email": norm_email,
            "full_name": clean_name,
            "created_at": now_iso
        }

    def authenticate_user(self, email: str, password: str) -> Dict[str, Any]:
        """Authenticates user with generic error message to prevent email enumeration."""
        if not email or not password:
            raise InvalidCredentialsError("Invalid email or password.")

        norm_email = normalize_email(email)

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, email, full_name, password_hash, created_at FROM users WHERE email = ?", (norm_email,))
            row = cursor.fetchone()

        if not row:
            # Perform dummy verification to mitigate timing attacks
            verify_password(password, DUMMY_HASH)
            raise InvalidCredentialsError("Invalid email or password.")

        if not verify_password(password, row["password_hash"]):
            raise InvalidCredentialsError("Invalid email or password.")

        return {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
            "created_at": row["created_at"]
        }

    def create_session(self, user_id: int, remember_me: bool = False) -> Dict[str, Any]:
        """Creates a cryptographically unpredictable session token persisted in SQLite."""
        session_id = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        duration_days = 30 if remember_me else 1
        expires_at = now + timedelta(days=duration_days)
        now_iso = now.isoformat()
        expires_iso = expires_at.isoformat()

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (session_id, user_id, now_iso, expires_iso)
            )
            conn.commit()

        return {
            "session_id": session_id,
            "expires_at": expires_iso,
            "max_age": duration_days * 86400
        }

    def get_user_by_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Restores user from valid unexpired session."""
        if not session_id:
            return None

        now_iso = datetime.now(timezone.utc).isoformat()

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT u.id, u.email, u.full_name, u.created_at, s.expires_at
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.session_id = ?
                """,
                (session_id,)
            )
            row = cursor.fetchone()

            if not row:
                return None

            # Check expiration
            if row["expires_at"] < now_iso:
                # Expired session; prune it
                cursor.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
                conn.commit()
                return None

            return {
                "id": row["id"],
                "email": row["email"],
                "full_name": row["full_name"],
                "created_at": row["created_at"]
            }

    def delete_session(self, session_id: str) -> bool:
        """Invalidates a session on logout."""
        if not session_id:
            return False

        with get_db(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            return deleted
