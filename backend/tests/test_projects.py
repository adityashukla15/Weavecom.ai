from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.config import Settings
from app.main import create_app
from app.schemas.auth import AuthenticatedUser, UserRole

WRITER_ID = "d9428888-122b-4c28-9a3e-80f3a5b74d72"


class FakeQuery:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.filters: list[tuple[str, Any]] = []
        self.inserted: dict[str, Any] | None = None

    def select(self, _columns: str) -> FakeQuery:
        return self

    def eq(self, column: str, value: Any) -> FakeQuery:
        self.filters.append((column, value))
        return self

    def order(self, _column: str, desc: bool = False) -> FakeQuery:
        return self

    def limit(self, _count: int) -> FakeQuery:
        return self

    def insert(self, payload: dict[str, Any]) -> FakeQuery:
        self.inserted = payload
        return self

    def execute(self) -> SimpleNamespace:
        if self.inserted is not None:
            row = {
                "id": str(uuid4()),
                "created_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
                "page_count": 0,
                **self.inserted,
            }
            self.rows.append(row)
            return SimpleNamespace(data=[row])
        selected = [
            row for row in self.rows
            if all(row.get(column) == value for column, value in self.filters)
        ]
        return SimpleNamespace(data=selected)


class FakeDatabase:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def table(self, _name: str) -> FakeQuery:
        return FakeQuery(self.rows)


def make_client(role: UserRole | None = UserRole.WRITER) -> tuple[TestClient, FakeDatabase, pytest.MonkeyPatch]:
    from app.api.v1.endpoints import characters as character_endpoint

    database = FakeDatabase()
    app = create_app(Settings(
        _env_file=None,
        secret_key="test-secret-key-material-with-more-than-32-characters",
        environment="testing",
        supabase_enabled=True,
        supabase_url="https://project.supabase.co",
        supabase_secret_key="test-secret-key",
        supabase_publishable_key="test-publishable-key",
    ))
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=WRITER_ID,
        role=role,
    )
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        character_endpoint,
        "create_user_scoped_supabase_client",
        lambda _settings, _token: database,
    )
    return TestClient(app), database, monkeypatch


def test_authenticated_user_creates_project_with_server_derived_owner_and_lists_it() -> None:
    client, database, monkeypatch = make_client()
    headers = {"Authorization": "Bearer mocked-access-token"}
    try:
        created = client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "title": "My Project",
                "description": "A saved project.",
                "genre": "Fantasy",
                "owner_id": "attacker-controlled",
            },
        )
        assert created.status_code == 201
        assert created.json()["owner_id"] == WRITER_ID
        assert database.rows[0]["owner_id"] == WRITER_ID

        listed = client.get("/api/v1/projects", headers=headers)
        assert listed.status_code == 200
        assert [row["id"] for row in listed.json()] == [created.json()["id"]]
    finally:
        monkeypatch.undo()
        client.close()


def test_authenticated_user_without_role_can_create_owned_project() -> None:
    client, database, monkeypatch = make_client(None)
    try:
        response = client.post(
            "/api/v1/projects",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"title": "My project"},
        )
        assert response.status_code == 201
        assert response.json()["owner_id"] == WRITER_ID
        assert database.rows[0]["owner_id"] == WRITER_ID
    finally:
        monkeypatch.undo()
        client.close()
