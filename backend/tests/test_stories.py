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

    def order(self, column: str, desc: bool = False) -> FakeQuery:
        self.order_column = column
        self.desc = desc
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
        if hasattr(self, "order_column"):
            selected.sort(key=lambda row: row[self.order_column], reverse=self.desc)
        if self.limit_count is not None:
            selected = selected[:self.limit_count]

        if self.action == "insert":
            row = {
                "id": str(uuid4()),
                "sort_order": 0,
                "created_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
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
            "stories": [],
        }

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)


def make_client(role: UserRole = UserRole.WRITER) -> tuple[TestClient, FakeDatabase, pytest.MonkeyPatch]:
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
    return TestClient(application), database, monkeypatch


def test_writer_can_create_list_get_update_and_delete_story() -> None:
    client, database, monkeypatch = make_client()
    headers = {"Authorization": "Bearer mocked-access-token"}
    try:
        created = client.post(
            "/api/v1/stories",
            headers=headers,
            json={
                "project_id": PROJECT_ID,
                "title": "The Ember March",
                "description": "A rebellion begins.",
                "genre": "Fantasy",
                "synopsis": "A young hero returns home.",
                "main_plot": "The city is under siege.",
                "status": "draft",
                "owner_id": "attacker-controlled",
            },
        )
        assert created.status_code == 201
        story = created.json()
        assert story["title"] == "The Ember March"
        assert "owner_id" not in story
        assert database.tables["stories"][0]["project_id"] == PROJECT_ID

        listed = client.get("/api/v1/stories", headers=headers)
        assert listed.status_code == 200
        assert [item["id"] for item in listed.json()] == [story["id"]]

        detail = client.get(f"/api/v1/stories/{story['id']}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["synopsis"] == "A young hero returns home."

        updated = client.patch(
            f"/api/v1/stories/{story['id']}",
            headers=headers,
            json={"title": "The Ember March: Rebellion", "status": "published"},
        )
        assert updated.status_code == 200
        assert updated.json()["status"] == "published"

        deleted = client.delete(f"/api/v1/stories/{story['id']}", headers=headers)
        assert deleted.status_code == 204
        assert database.tables["stories"] == []
    finally:
        monkeypatch.undo()
        client.close()


def test_writer_cannot_create_story_in_another_writers_project() -> None:
    client, _database, monkeypatch = make_client()
    try:
        response = client.post(
            "/api/v1/stories",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"project_id": OTHER_PROJECT_ID, "title": "Unauthorized"},
        )

        assert response.status_code == 404
    finally:
        monkeypatch.undo()
        client.close()


def test_writer_cannot_read_or_change_another_writers_story() -> None:
    client, database, monkeypatch = make_client()
    story_id = str(uuid4())
    database.tables["stories"].append(
        {
            "id": story_id,
            "project_id": OTHER_PROJECT_ID,
            "title": "Private story",
            "description": "",
            "genre": "",
            "synopsis": "",
            "main_plot": "",
            "status": "draft",
            "sort_order": 0,
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
        }
    )
    headers = {"Authorization": "Bearer mocked-access-token"}
    try:
        assert client.get(f"/api/v1/stories/{story_id}", headers=headers).status_code == 404
        assert client.patch(
            f"/api/v1/stories/{story_id}",
            headers=headers,
            json={"title": "Attempted change", "project_id": PROJECT_ID},
        ).status_code == 404
        assert client.delete(
            f"/api/v1/stories/{story_id}",
            headers=headers,
        ).status_code == 404
        assert database.tables["stories"][0]["title"] == "Private story"
    finally:
        monkeypatch.undo()
        client.close()


def test_multiple_stories_in_a_project_get_distinct_sort_order() -> None:
    client, database, monkeypatch = make_client()
    headers = {"Authorization": "Bearer mocked-access-token"}
    try:
        first = client.post(
            "/api/v1/stories",
            headers=headers,
            json={"project_id": PROJECT_ID, "title": "First"},
        )
        second = client.post(
            "/api/v1/stories",
            headers=headers,
            json={"project_id": PROJECT_ID, "title": "Second"},
        )

        assert first.status_code == 201
        assert second.status_code == 201
        assert [story["sort_order"] for story in database.tables["stories"]] == [0, 1]
    finally:
        monkeypatch.undo()
        client.close()


def test_reader_cannot_use_story_management_routes() -> None:
    client, database, monkeypatch = make_client(UserRole.READER)
    try:
        response = client.get(
            "/api/v1/stories",
            headers={"Authorization": "Bearer mocked-access-token"},
        )

        assert response.status_code == 403
        assert database.tables["stories"] == []
    finally:
        monkeypatch.undo()
        client.close()


def test_story_input_is_validated() -> None:
    client, _database, monkeypatch = make_client()
    try:
        response = client.post(
            "/api/v1/stories",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"project_id": PROJECT_ID, "title": "", "status": "private"},
        )

        assert response.status_code == 422
    finally:
        monkeypatch.undo()
        client.close()
