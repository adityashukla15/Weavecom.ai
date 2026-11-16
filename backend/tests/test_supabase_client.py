from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.core.config import Settings
from app.integrations.supabase import client as supabase_client

TEST_SECRET = "test-secret-key-material-with-more-than-32-characters"


def make_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "secret_key": TEST_SECRET,
        "environment": "testing",
        "supabase_enabled": True,
        "supabase_url": "https://project.supabase.co",
        "supabase_publishable_key": "test-publishable-key",
        "supabase_secret_key": "test-service-key",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_user_scoped_client_uses_publishable_key_and_caller_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, str]] = []
    authorized: list[str] = []
    fake_client = SimpleNamespace(
        postgrest=SimpleNamespace(auth=authorized.append),
    )

    def fake_create_client(url: str, key: str) -> SimpleNamespace:
        calls.append((url, key))
        return fake_client

    monkeypatch.setattr(supabase_client, "create_client", fake_create_client)

    result = supabase_client.create_user_scoped_supabase_client(
        make_settings(),
        "caller-access-token",
    )

    assert result is fake_client
    assert calls == [("https://project.supabase.co", "test-publishable-key")]
    assert authorized == ["caller-access-token"]


def test_user_scoped_client_never_falls_back_to_service_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unexpected_create_client(_url: str, _key: str) -> None:
        pytest.fail("A user-scoped client must not be created without a publishable key.")

    monkeypatch.setattr(supabase_client, "create_client", unexpected_create_client)

    with pytest.raises(RuntimeError, match="publishable credentials"):
        supabase_client.create_user_scoped_supabase_client(
            make_settings(supabase_publishable_key=None),
            "caller-access-token",
        )
