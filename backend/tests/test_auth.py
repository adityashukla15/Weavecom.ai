from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient
from supabase_auth.errors import AuthApiError, AuthRetryableError

from app.core.auth import get_current_user, require_roles
from app.core.config import Settings
from app.main import create_app
from app.schemas.auth import AuthenticatedUser, UserRole

TEST_SECRET = "test-secret-key-material-with-more-than-32-characters"


def make_settings(*, supabase_enabled: bool = True) -> Settings:
    values: dict[str, Any] = {
        "secret_key": TEST_SECRET,
        "environment": "testing",
        "supabase_enabled": supabase_enabled,
    }
    if supabase_enabled:
        values.update(
            supabase_url="https://project.supabase.co",
            supabase_secret_key="test-supabase-server-key",
        )
    return Settings(_env_file=None, **values)


class FakeAuth:
    def __init__(self, response: object = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.tokens: list[str] = []

    def get_user(self, token: str) -> object:
        self.tokens.append(token)
        if self.error:
            raise self.error
        return self.response


class FakeSupabaseClient:
    def __init__(self, auth: FakeAuth) -> None:
        self.auth = auth


def make_auth_app(auth: FakeAuth | None = None) -> FastAPI:
    application = create_app(make_settings())
    if auth is not None:
        application.state.supabase_client = FakeSupabaseClient(auth)
    return application


def fake_user(
    *,
    app_metadata: dict[str, object] | None = None,
    user_metadata: dict[str, object] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id="d9428888-122b-4c28-9a3e-80f3a5b74d72",
        email="writer@example.test",
        app_metadata=app_metadata or {},
        user_metadata=user_metadata or {},
    )


def test_auth_me_rejects_missing_bearer_token() -> None:
    client = TestClient(make_auth_app())

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_auth_me_verifies_token_with_supabase_and_returns_trusted_role() -> None:
    auth = FakeAuth(
        SimpleNamespace(
            user=fake_user(
                app_metadata={"role": "writer"},
                user_metadata={"role": "reader"},
            )
        )
    )
    client = TestClient(make_auth_app(auth))

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer verified-access-token"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": "d9428888-122b-4c28-9a3e-80f3a5b74d72",
        "email": "writer@example.test",
        "role": "writer",
    }
    assert auth.tokens == ["verified-access-token"]


def test_auth_me_does_not_trust_user_metadata_role() -> None:
    auth = FakeAuth(
        SimpleNamespace(user=fake_user(user_metadata={"role": "writer"}))
    )
    client = TestClient(make_auth_app(auth))

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer verified-access-token"},
    )

    assert response.status_code == 200
    assert response.json()["role"] is None


def test_auth_me_rejects_invalid_supabase_token() -> None:
    auth = FakeAuth(error=AuthApiError("invalid token", 401, None))
    client = TestClient(make_auth_app(auth))

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid-access-token"},
    )

    assert response.status_code == 401
    assert "invalid-access-token" not in response.text
    assert "invalid token" not in response.text


def test_auth_me_reports_supabase_outage_without_leaking_details() -> None:
    auth = FakeAuth(error=AuthRetryableError("private upstream detail", 503))
    client = TestClient(make_auth_app(auth))

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer verified-access-token"},
    )

    assert response.status_code == 503
    assert "private upstream detail" not in response.text


def test_auth_is_unavailable_when_supabase_is_disabled() -> None:
    client = TestClient(create_app(make_settings(supabase_enabled=False)))

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer any-token"},
    )

    assert response.status_code == 503
    assert "any-token" not in response.text


def role_test_app(user: AuthenticatedUser) -> FastAPI:
    application = FastAPI()
    application.dependency_overrides[get_current_user] = lambda: user
    router = APIRouter()

    @router.get("/writer")
    async def writer_only(
        _user: AuthenticatedUser = Depends(require_roles(UserRole.WRITER)),
    ) -> dict[str, str]:
        return {"result": "writer access"}

    application.include_router(router)
    return application


def test_reader_cannot_access_writer_only_resource() -> None:
    client = TestClient(
        role_test_app(
            AuthenticatedUser(id="reader-id", role=UserRole.READER)
        )
    )

    response = client.get("/writer")

    assert response.status_code == 403


def test_writer_can_access_writer_only_resource() -> None:
    client = TestClient(
        role_test_app(
            AuthenticatedUser(id="writer-id", role=UserRole.WRITER)
        )
    )

    response = client.get("/writer")

    assert response.status_code == 200
    assert response.json() == {"result": "writer access"}


def test_user_without_server_assigned_role_is_forbidden() -> None:
    client = TestClient(
        role_test_app(AuthenticatedUser(id="unassigned-id"))
    )

    response = client.get("/writer")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_supabase_client_is_created_lazily_and_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import auth as auth_module

    created: list[FakeSupabaseClient] = []
    auth = FakeAuth(SimpleNamespace(user=fake_user(app_metadata={"role": "reader"})))
    fake_client = FakeSupabaseClient(auth)

    def create_client(_settings: Settings) -> FakeSupabaseClient:
        created.append(fake_client)
        return fake_client

    monkeypatch.setattr(auth_module, "create_supabase_client", create_client)
    client = TestClient(make_auth_app())

    first = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer token-one"},
    )
    second = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer token-two"},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert len(created) == 1
    assert auth.tokens == ["token-one", "token-two"]
