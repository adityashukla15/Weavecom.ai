from __future__ import annotations

from collections.abc import Callable, Mapping
from threading import Lock
from typing import Annotated, Any

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.concurrency import run_in_threadpool
from supabase import Client
from supabase_auth.errors import AuthApiError, AuthRetryableError

from app.integrations.supabase.client import create_supabase_client
from app.schemas.auth import AuthenticatedUser, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def get_supabase_client(request: Request) -> Client:
    settings = request.app.state.settings
    if not settings.supabase_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured.",
        )

    client = request.app.state.supabase_client
    if client is not None:
        return client

    with request.app.state.supabase_client_lock:
        client = request.app.state.supabase_client
        if client is None:
            try:
                client = create_supabase_client(settings)
            except RuntimeError as error:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authentication service is not configured.",
                ) from error
            request.app.state.supabase_client = client
    return client


async def get_current_user(
    request: Request,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    client = get_supabase_client(request)
    try:
        response = await run_in_threadpool(
            client.auth.get_user,
            credentials.credentials,
        )
    except AuthApiError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The access token is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    except (AuthRetryableError, httpx.HTTPError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable.",
        ) from error

    user = getattr(response, "user", None)
    user_id = getattr(user, "id", None)
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The access token is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    app_metadata = getattr(user, "app_metadata", None)
    raw_role = app_metadata.get("role") if isinstance(app_metadata, Mapping) else None
    try:
        role = UserRole(raw_role)
    except (TypeError, ValueError):
        role = None

    email = getattr(user, "email", None)
    return AuthenticatedUser(
        id=user_id,
        email=email if isinstance(email, str) else None,
        role=role,
    )


def require_roles(*allowed_roles: UserRole) -> Callable[..., Any]:
    allowed = frozenset(allowed_roles)

    async def enforce_role(
        current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    ) -> AuthenticatedUser:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account does not have permission to perform this action.",
            )
        return current_user

    return enforce_role
