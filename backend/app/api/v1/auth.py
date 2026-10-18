"""Authentication API endpoints for SkillPulse LMIS.

Provides:
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- GET /api/v1/auth/me
- POST /api/v1/auth/logout
"""

import os
from typing import Optional
from fastapi import APIRouter, Response, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.services.auth_service import (
    AuthService,
    DuplicateEmailError,
    InvalidCredentialsError,
    ValidationError,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
auth_service = AuthService()

# Determine cookie Secure flag: true only if PRODUCTION environment variable is explicitly set
IS_PRODUCTION = os.environ.get("ENVIRONMENT", "").lower() == "production"


def _is_https_request(request: Request) -> bool:
    """Detects whether incoming request was received or forwarded via HTTPS."""
    proto = request.headers.get("x-forwarded-proto", "").lower()
    return request.url.scheme == "https" or proto == "https" or IS_PRODUCTION


def _get_cookie_attributes(request: Request) -> dict:
    """Returns cookie security attributes tailored for deployment topology.

    On HTTPS / production (e.g. Render with Vercel frontend), uses SameSite=None and Secure=True
    to permit credentialed cross-origin API calls.
    On local HTTP development, uses SameSite=Lax and Secure=False to avoid rejection over HTTP.
    """
    is_https = _is_https_request(request)
    return {
        "httponly": True,
        "samesite": "none" if is_https else "lax",
        "secure": is_https,
        "path": "/",
    }


class RegisterRequest(BaseModel):
    email: str = Field(..., max_length=255)
    full_name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: Optional[str] = None


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=128)
    remember_me: bool = False


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, response: Response):
    """Registers a new user account, creates session, and sets HttpOnly cookie."""
    try:
        user = auth_service.register_user(
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            confirm_password=payload.confirm_password,
        )
    except DuplicateEmailError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # Automatically sign in the user
    session = auth_service.create_session(user["id"], remember_me=False)
    cookie_attrs = _get_cookie_attributes(request)

    response.set_cookie(
        key="sp_session",
        value=session["session_id"],
        max_age=session["max_age"],
        **cookie_attrs,
    )

    return {
        "status": "success",
        "message": "User registered successfully.",
        "user": user,
        "token": session["session_id"],
        "session_id": session["session_id"],
    }


@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response):
    """Authenticates credentials, creates session, and sets HttpOnly cookie."""
    try:
        user = auth_service.authenticate_user(payload.email, payload.password)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    session = auth_service.create_session(user["id"], remember_me=payload.remember_me)
    cookie_attrs = _get_cookie_attributes(request)

    response.set_cookie(
        key="sp_session",
        value=session["session_id"],
        max_age=session["max_age"],
        **cookie_attrs,
    )

    return {
        "status": "success",
        "message": "Signed in successfully.",
        "user": user,
        "token": session["session_id"],
        "session_id": session["session_id"],
    }


@router.get("/me")
def get_current_user_profile(request: Request):
    """Restores session state and returns current user, or unauthenticated status."""
    session_id = request.cookies.get("sp_session")
    if not session_id:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_id = auth_header.split(" ", 1)[1].strip()

    if not session_id:
        return {"authenticated": False, "user": None}

    user = auth_service.get_user_by_session(session_id)
    if not user:
        return {"authenticated": False, "user": None}

    return {
        "authenticated": True,
        "user": user,
    }


@router.post("/logout")
def logout(request: Request, response: Response):
    """Invalidates the server-side session and clears the session cookie."""
    session_id = request.cookies.get("sp_session")
    if not session_id:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_id = auth_header.split(" ", 1)[1].strip()

    if session_id:
        auth_service.delete_session(session_id)

    cookie_attrs = _get_cookie_attributes(request)
    response.delete_cookie(
        key="sp_session",
        path="/",
        samesite=cookie_attrs["samesite"],
        secure=cookie_attrs["secure"],
    )

    return {
        "status": "success",
        "message": "Logged out successfully.",
    }
