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

TEST_SECRET = "test-secret-key-material-with-more-than-32-characters"
WRITER_ID = "d9428888-122b-4c28-9a3e-80f3a5b74d72"
PROJECT_ID = "4dbfba1c-4c6a-4a1f-84de-866a8f4a8f60"
OTHER_PROJECT_ID = "cab9bc37-a856-4261-89b7-d761329f7d15"


class FakeQuery:
    def __init__(self, database: FakeDatabase, table: str) -> None:
        self.database = database
        self.table_name = table
        self.action = "select"
        self.payload: dict[str, Any] | None = None
        self.filters: list[tuple[str, str, Any]] = []
        self.limit_count: int | None = None

    def select(self, _columns: str) -> FakeQuery:
        return self

    def eq(self, column: str, value: Any) -> FakeQuery:
        self.filters.append(("eq", column, value))
        return self

    def in_(self, column: str, values: list[Any]) -> FakeQuery:
        self.filters.append(("in", column, values))
        return self

    def order(self, _column: str, desc: bool = False) -> FakeQuery:
        return self

    def limit(self, count: int) -> FakeQuery:
        self.limit_count = count
        return self

    def insert(self, payload: dict[str, Any]) -> FakeQuery:
        self.action = "insert"
        self.payload = payload
        return self

    def update(self, payload: dict[str, Any]) -> FakeQuery:
        self.action = "update"
        self.payload = payload
        return self

    def delete(self) -> FakeQuery:
        self.action = "delete"
        return self

    def execute(self) -> SimpleNamespace:
        rows = self.database.tables[self.table_name]

        def matches(row: dict[str, Any]) -> bool:
            for operation, column, value in self.filters:
                if operation == "eq" and row.get(column) != value:
                    return False
                if operation == "in" and row.get(column) not in value:
                    return False
            return True

        selected = [row for row in rows if matches(row)]
        if self.limit_count is not None:
            selected = selected[:self.limit_count]

        if self.action == "insert":
            row = {
                "id": str(uuid4()),
                "created_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
                "role_description": "",
                "traits": [],
                "abilities": [],
                "image_url": None,
                **(self.payload or {}),
            }
            rows.append(row)
            selected = [row]
        elif self.action == "update":
            for row in selected:
                row.update(self.payload or {})
                row["updated_at"] = datetime.now(UTC).isoformat()
        elif self.action == "delete":
            self.database.tables[self.table_name] = [
                row for row in rows if not matches(row)
            ]
            selected = []
        return SimpleNamespace(data=selected)


class FakeDatabase:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict[str, Any]]] = {
            "projects": [
                {"id": PROJECT_ID, "owner_id": WRITER_ID, "title": "My Project", "updated_at": ""},
                {"id": OTHER_PROJECT_ID, "owner_id": "other-writer", "title": "Other Project", "updated_at": ""},
            ],
            "characters": [],
        }

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)


def make_client(role: UserRole | None = UserRole.WRITER) -> tuple[TestClient, FakeDatabase]:
    from app.api.v1.endpoints import characters as character_endpoints

    database = FakeDatabase()
    application = create_app(
        Settings(
            _env_file=None,
            secret_key=TEST_SECRET,
            environment="testing",
            supabase_enabled=True,
            supabase_url="https://project.supabase.co",
            supabase_secret_key="test-server-key",
            supabase_publishable_key="test-publishable-key",
        )
    )
    application.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=WRITER_ID,
        role=role,
    )
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        character_endpoints,
        "create_user_scoped_supabase_client",
        lambda _settings, _token: database,
    )
    client = TestClient(application)
    client.__dict__["_m4_monkeypatch"] = monkeypatch
    return client, database


def close_client(client: TestClient) -> None:
    client.__dict__["_m4_monkeypatch"].undo()
    client.close()


def test_writer_character_create_list_detail_update_delete_flow() -> None:
    client, database = make_client()
    headers = {"Authorization": "Bearer mocked-access-token"}
    try:
        projects = client.get("/api/v1/characters/projects", headers=headers)
        assert projects.status_code == 200
        assert [project["id"] for project in projects.json()] == [PROJECT_ID]

        created = client.post(
            "/api/v1/characters",
            headers=headers,
            json={
                "project_id": PROJECT_ID,
                "name": "Kaito",
                "role": "protagonist",
                "personality": "Fierce but loyal",
                "owner_id": "attacker-controlled",
            },
        )
        assert created.status_code == 201
        character = created.json()
        assert character["name"] == "Kaito"
        assert character["role"] == "protagonist"
        assert "owner_id" not in character
        assert database.tables["characters"][0]["project_id"] == PROJECT_ID

        listed = client.get("/api/v1/characters", headers=headers)
        assert listed.status_code == 200
        assert len(listed.json()) == 1

        detail = client.get(f"/api/v1/characters/{character['id']}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["id"] == character["id"]

        updated = client.patch(
            f"/api/v1/characters/{character['id']}",
            headers=headers,
            json={"name": "Kaito Ardent", "background": "Raised in the Ember March."},
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Kaito Ardent"

        deleted = client.delete(
            f"/api/v1/characters/{character['id']}",
            headers=headers,
        )
        assert deleted.status_code == 204
        assert database.tables["characters"] == []
    finally:
        close_client(client)


def test_writer_cannot_associate_character_with_another_writers_project() -> None:
    client, _database = make_client()
    try:
        response = client.post(
            "/api/v1/characters",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"project_id": OTHER_PROJECT_ID, "name": "Intruder"},
        )

        assert response.status_code == 404
    finally:
        close_client(client)


def test_authenticated_user_without_role_can_use_owned_character_routes() -> None:
    client, database = make_client(None)
    try:
        response = client.get(
            "/api/v1/characters",
            headers={"Authorization": "Bearer mocked-access-token"},
        )

        assert response.status_code == 200
        assert database.tables["characters"] == []
    finally:
        close_client(client)


def test_character_input_is_validated() -> None:
    client, _database = make_client()
    try:
        response = client.post(
            "/api/v1/characters",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"project_id": PROJECT_ID, "name": "", "role": "admin"},
        )

        assert response.status_code == 422
    finally:
        close_client(client)
