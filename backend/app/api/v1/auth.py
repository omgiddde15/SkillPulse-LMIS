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
def register(payload: RegisterRequest, response: Response):
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

    response.set_cookie(
        key="sp_session",
        value=session["session_id"],
        max_age=session["max_age"],
        httponly=True,
        samesite="lax",
        secure=IS_PRODUCTION,
        path="/",
    )

    return {
        "status": "success",
        "message": "User registered successfully.",
        "user": user,
    }


@router.post("/login")
def login(payload: LoginRequest, response: Response):
    """Authenticates credentials, creates session, and sets HttpOnly cookie."""
    try:
        user = auth_service.authenticate_user(payload.email, payload.password)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    session = auth_service.create_session(user["id"], remember_me=payload.remember_me)

    response.set_cookie(
        key="sp_session",
        value=session["session_id"],
        max_age=session["max_age"],
        httponly=True,
        samesite="lax",
        secure=IS_PRODUCTION,
        path="/",
    )

    return {
        "status": "success",
        "message": "Signed in successfully.",
        "user": user,
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

    response.delete_cookie(key="sp_session", path="/")

    return {
        "status": "success",
        "message": "Logged out successfully.",
    }
