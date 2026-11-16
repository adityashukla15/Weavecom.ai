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

SECRET = "test-secret-key-material-with-more-than-32-characters"
WRITER_ID = "d9428888-122b-4c28-9a3e-80f3a5b74d72"
PROJECT_ID = "4dbfba1c-4c6a-4a1f-84de-866a8f4a8f60"
STORY_ID = "d5be71c1-b3a1-44db-b221-fd77cd626a31"
OTHER_STORY_ID = "f84f23b2-8b9b-4a7c-8f52-ef638da33592"
OTHER_PROJECT_ID = "cab9bc37-a856-4261-89b7-d761329f7d15"


class FakeQuery:
    def __init__(self, database: FakeDatabase, table: str) -> None:
        self.database = database
        self.table_name = table
        self.action = "select"
        self.filters: list[tuple[str, str, Any]] = []
        self.payload: dict[str, Any] | None = None
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
            return all(
                row.get(column) == value if operation == "eq"
                else row.get(column) in value
                for operation, column, value in self.filters
            )

        selected = [row for row in rows if matches(row)]
        if hasattr(self, "order_column"):
            selected.sort(key=lambda row: row[self.order_column], reverse=self.desc)
        if self.limit_count is not None:
            selected = selected[:self.limit_count]

        if self.action == "insert":
            row = {
                "id": str(uuid4()),
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
            if self.table_name == "comics":
                deleted_ids = {row["id"] for row in rows if matches(row)}
                panel_ids = {
                    row["id"]
                    for row in self.database.tables["comic_panels"]
                    if row["comic_id"] in deleted_ids
                }
                self.database.tables["comic_panels"] = [
                    row for row in self.database.tables["comic_panels"]
                    if row["comic_id"] not in deleted_ids
                ]
                self.database.tables["comic_speech_bubbles"] = [
                    row for row in self.database.tables["comic_speech_bubbles"]
                    if row["panel_id"] not in panel_ids
                ]
            elif self.table_name == "comic_panels":
                deleted_ids = {row["id"] for row in rows if matches(row)}
                self.database.tables["comic_speech_bubbles"] = [
                    row for row in self.database.tables["comic_speech_bubbles"]
                    if row["panel_id"] not in deleted_ids
                ]
            selected = []
        return SimpleNamespace(data=selected)


class FakeDatabase:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict[str, Any]]] = {
            "projects": [{"id": PROJECT_ID, "owner_id": WRITER_ID}],
            "stories": [
                {"id": STORY_ID, "project_id": PROJECT_ID, "title": "The Story"},
                {"id": OTHER_STORY_ID, "project_id": OTHER_PROJECT_ID, "title": "Private"},
            ],
            "comics": [],
            "comic_panels": [],
            "comic_speech_bubbles": [],
        }

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)


def make_client(
    role: UserRole | None = UserRole.WRITER,
) -> tuple[TestClient, FakeDatabase, pytest.MonkeyPatch]:
    from app.api.v1.endpoints import characters as character_endpoints

    database = FakeDatabase()
    app = create_app(Settings(
        _env_file=None,
        secret_key=SECRET,
        environment="testing",
        supabase_enabled=True,
        supabase_url="https://project.supabase.co",
        supabase_secret_key="test-server-key",
        supabase_publishable_key="test-publishable-key",
    ))
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=WRITER_ID,
        role=role,
    )
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        character_endpoints,
        "create_user_scoped_supabase_client",
        lambda _settings, _token: database,
    )
    return TestClient(app), database, monkeypatch


def test_comic_panels_and_dialogue_persist_and_retrieve() -> None:
    client, database, monkeypatch = make_client()
    headers = {"Authorization": "Bearer mocked-access-token"}
    try:
        created = client.post(
            "/api/v1/comics",
            headers=headers,
            json={"story_id": STORY_ID, "title": "Issue One"},
        )
        assert created.status_code == 201
        comic_id = created.json()["id"]

        first = client.post(
            f"/api/v1/comics/{comic_id}/panels",
            headers=headers,
            json={"description": "A hero enters the city.", "layout": {"width": 3, "height": 2}},
        )
        second = client.post(
            f"/api/v1/comics/{comic_id}/panels",
            headers=headers,
            json={"description": "A storm begins."},
        )
        assert first.status_code == second.status_code == 201
        panel_id = first.json()["id"]
        bubble = client.post(
            f"/api/v1/comics/{comic_id}/panels/{panel_id}/bubbles",
            headers=headers,
            json={"text": "We made it!", "bubble_type": "speech", "position_x": 42, "position_y": 18},
        )
        assert bubble.status_code == 201

        saved = client.get(f"/api/v1/comics/{comic_id}", headers=headers).json()
        assert [panel["panel_number"] for panel in saved["panels"]] == [1, 2]
        assert saved["panels"][0]["bubbles"][0]["text"] == "We made it!"

        bubble_id = bubble.json()["id"]
        changed = client.patch(
            f"/api/v1/comics/{comic_id}/panels/{panel_id}/bubbles/{bubble_id}",
            headers=headers,
            json={"text": "We are home."},
        )
        assert changed.status_code == 200
        reordered = client.patch(
            f"/api/v1/comics/{comic_id}/panels/reorder",
            headers=headers,
            json={"panel_ids": [second.json()["id"], panel_id]},
        )
        assert reordered.status_code == 200
        assert reordered.json()["panels"][0]["id"] == second.json()["id"]
        assert len(database.tables["comic_speech_bubbles"]) == 1

        deleted = client.delete(f"/api/v1/comics/{comic_id}", headers=headers)
        assert deleted.status_code == 204
        assert database.tables["comics"] == []
        assert database.tables["comic_panels"] == []
        assert database.tables["comic_speech_bubbles"] == []
    finally:
        monkeypatch.undo()
        client.close()


def test_writer_cannot_create_comic_from_another_writers_story() -> None:
    client, database, monkeypatch = make_client()
    try:
        response = client.post(
            "/api/v1/comics",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"story_id": OTHER_STORY_ID, "title": "Not mine"},
        )

        assert response.status_code == 404
        assert database.tables["comics"] == []
    finally:
        monkeypatch.undo()
        client.close()


def test_authenticated_user_without_role_can_create_comics_for_owned_stories() -> None:
    client, database, monkeypatch = make_client(None)
    try:
        response = client.post(
            "/api/v1/comics",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"story_id": STORY_ID, "title": "Reader attempt"},
        )

        assert response.status_code == 201
        assert database.tables["comics"][0]["story_id"] == STORY_ID
    finally:
        monkeypatch.undo()
        client.close()
