"""Authentication and security dependencies for FastAPI routes."""

from fastapi import Request, HTTPException, status
from app.services.auth_service import AuthService

auth_service = AuthService()


def get_current_user_optional(request: Request):
    """Retrieves current user if session cookie is valid, or returns None."""
    session_id = request.cookies.get("sp_session")
    if not session_id:
        # Also check Authorization header Bearer token as fallback for programmatic clients/tests
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_id = auth_header.split(" ", 1)[1].strip()

    if not session_id:
        return None

    return auth_service.get_user_by_session(session_id)


def get_current_user(request: Request):
    """Dependency that requires an authenticated user; raises 401 if unauthenticated."""
    user = get_current_user_optional(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access this workspace resource.",
        )
    return user
