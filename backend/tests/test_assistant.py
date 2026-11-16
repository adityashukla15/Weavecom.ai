from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.ai.errors import AIProviderError
from app.core.auth import get_current_user
from app.core.config import Settings
from app.main import create_app
from app.schemas.auth import AuthenticatedUser, UserRole
from app.services.project_assistant import retrieve_project_context

WRITER_ID = "d9428888-122b-4c28-9a3e-80f3a5b74d72"
PROJECT_ID = "4dbfba1c-4c6a-4a1f-84de-866a8f4a8f60"
OTHER_PROJECT_ID = "cab9bc37-a856-4261-89b7-d761329f7d15"
PUBLISHED_STORY_ID = "d5be71c1-b3a1-44db-b221-fd77cd626a31"
DRAFT_STORY_ID = "f84f23b2-8b9b-4a7c-8f52-ef638da33592"
OTHER_STORY_ID = "74a2f13f-491d-4ed0-b5d0-f07ef29f7bb1"
CHARACTER_ID = "5e8e91f6-328b-4e31-9a50-16e6ea6f2e65"
OTHER_CHARACTER_ID = "0bdb05e4-5c0c-42d2-bdd5-4e76e3d1eff0"
COMIC_ID = "134ef152-186b-4beb-aeb0-c2d8d5617cd6"
OTHER_COMIC_ID = "a60be038-3218-4136-9a9b-0c55e6839a29"
PANEL_ID = "0beee662-2292-45c4-86b2-e5763584c476"


class FakeQuery:
    def __init__(self, database: FakeDatabase, table: str) -> None:
        self.database = database
        self.table_name = table
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

    def execute(self) -> SimpleNamespace:
        rows = self.database.tables[self.table_name]
        selected = [
            row for row in rows
            if all(
                row.get(column) == value if operation == "eq"
                else row.get(column) in value
                for operation, column, value in self.filters
            )
        ]
        if self.limit_count is not None:
            selected = selected[:self.limit_count]
        return SimpleNamespace(data=selected)


class FakeDatabase:
    def __init__(self) -> None:
        now = datetime.now(UTC).isoformat()
        self.tables: dict[str, list[dict[str, Any]]] = {
            "projects": [
                {"id": PROJECT_ID, "owner_id": WRITER_ID, "title": "Project One", "status": "published", "updated_at": now},
                {"id": OTHER_PROJECT_ID, "owner_id": "other-writer", "title": "Project Two", "status": "draft", "updated_at": now},
            ],
            "stories": [
                {"id": PUBLISHED_STORY_ID, "project_id": PROJECT_ID, "title": "The Ember Hero", "description": "A hero guards the city.", "genre": "Fantasy", "synopsis": "Mira protects the city.", "main_plot": "The city is threatened by a dragon.", "status": "published", "updated_at": now},
                {"id": DRAFT_STORY_ID, "project_id": PROJECT_ID, "title": "Secret Dragon Plan", "description": "", "genre": "", "synopsis": "", "main_plot": "The hidden dragon plan.", "status": "draft", "updated_at": now},
                {"id": OTHER_STORY_ID, "project_id": OTHER_PROJECT_ID, "title": "Other project hero", "description": "Secret hero details.", "genre": "", "synopsis": "", "main_plot": "secret dragon", "status": "published", "updated_at": now},
            ],
            "characters": [
                {"id": CHARACTER_ID, "project_id": PROJECT_ID, "name": "Mira", "role_description": "Hero", "personality": "Brave and curious", "appearance": "Silver cloak", "background": "Raised in the city", "character_role": "protagonist", "updated_at": now},
                {"id": OTHER_CHARACTER_ID, "project_id": OTHER_PROJECT_ID, "name": "Other Mira", "role_description": "Other", "personality": "private", "appearance": "", "background": "", "character_role": "supporting", "updated_at": now},
            ],
            "comics": [
                {"id": COMIC_ID, "story_id": PUBLISHED_STORY_ID, "title": "Dragon Encounter", "description": "Mira meets the dragon.", "status": "completed", "updated_at": now},
                {"id": str(uuid4()), "story_id": PUBLISHED_STORY_ID, "title": "Unfinished comic", "description": "dragon", "status": "draft", "updated_at": now},
                {"id": OTHER_COMIC_ID, "story_id": OTHER_STORY_ID, "title": "Other project comic", "description": "secret dragon", "status": "completed", "updated_at": now},
            ],
            "comic_panels": [
                {"id": PANEL_ID, "comic_id": COMIC_ID, "panel_number": 1, "description": "Mira faces the dragon.", "image_url": None},
            ],
            "comic_speech_bubbles": [
                {"panel_id": PANEL_ID, "text": "I will protect the city!", "bubble_type": "speech"},
            ],
        }

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)


class FakeProvider:
    def __init__(self, answer: str = "Mira protects the city.", error: bool = False) -> None:
        self.answer = answer
        self.error = error
        self.calls: list[tuple[str, str | None, int]] = []

    async def generate_text(
        self,
        prompt: str,
        *,
        instructions: str | None = None,
        max_output_tokens: int = 2048,
    ) -> SimpleNamespace:
        self.calls.append((prompt, instructions, max_output_tokens))
        if self.error:
            raise AIProviderError("Adaption", "http_error", status_code=503)
        return SimpleNamespace(text=self.answer)


def build_client(
    role: UserRole = UserRole.WRITER,
    *,
    provider: FakeProvider | None = None,
) -> tuple[TestClient, FakeDatabase, pytest.MonkeyPatch, FakeProvider]:
    from app.api.v1.endpoints import assistant as assistant_endpoint
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
    fake_provider = provider or FakeProvider()
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        character_endpoint,
        "create_user_scoped_supabase_client",
        lambda _settings, _token: database,
    )
    monkeypatch.setattr(
        assistant_endpoint,
        "create_user_scoped_supabase_client",
        lambda _settings, _token: database,
    )
    monkeypatch.setattr(
        assistant_endpoint,
        "create_adaption_client",
        lambda _settings: fake_provider,
    )
    return TestClient(app), database, monkeypatch, fake_provider


def test_retrieval_is_keyword_relevant_bounded_and_project_scoped() -> None:
    database = FakeDatabase()

    result = asyncio.run(
        retrieve_project_context(
            database,
            project_id=UUID(PROJECT_ID),
            is_reader=False,
            question="What is Mira's personality and dragon encounter?",
        )
    )

    assert result.sources
    assert {source.content_type for source in result.sources} == {"character", "comic", "story"}
    assert all(source.id != UUID(OTHER_STORY_ID) for source in result.sources)
    assert all(source.id != UUID(OTHER_CHARACTER_ID) for source in result.sources)
    assert all(source.id != UUID(OTHER_COMIC_ID) for source in result.sources)
    assert "Brave and curious" in result.text
    assert "I will protect the city!" in result.text


def test_writer_can_ask_using_project_content_and_get_source_references() -> None:
    client, _database, monkeypatch, provider = build_client()
    try:
        response = client.post(
            "/api/v1/assistant/ask",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"project_id": PROJECT_ID, "question": "What is Mira's personality?"},
        )

        assert response.status_code == 200
        assert response.json()["answer"] == "Mira protects the city."
        assert response.json()["sources"][0]["content_type"] == "character"
        assert provider.calls
        assert "Brave and curious" in provider.calls[0][0]
        assert "other project" not in provider.calls[0][0].lower()
        assert "only the supplied project records" in provider.calls[0][1].lower()
    finally:
        monkeypatch.undo()
        client.close()


def test_reader_sees_only_published_project_content() -> None:
    client, _database, monkeypatch, provider = build_client(UserRole.READER)
    try:
        response = client.post(
            "/api/v1/assistant/ask",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"project_id": PROJECT_ID, "question": "Tell me about the dragon."},
        )

        assert response.status_code == 200
        prompt = provider.calls[0][0]
        assert "The Ember Hero" in prompt
        assert "Secret Dragon Plan" not in prompt
        assert "Dragon Encounter" in prompt
        assert "Unfinished comic" not in prompt
    finally:
        monkeypatch.undo()
        client.close()


def test_reader_cannot_ask_about_unpublished_project() -> None:
    client, _database, monkeypatch, provider = build_client(UserRole.READER)
    try:
        response = client.post(
            "/api/v1/assistant/ask",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"project_id": OTHER_PROJECT_ID, "question": "What happens?"},
        )

        assert response.status_code == 404
        assert not provider.calls
    finally:
        monkeypatch.undo()
        client.close()


def test_writer_can_retrieve_unpublished_story_in_owned_project() -> None:
    client, _database, monkeypatch, provider = build_client()
    try:
        response = client.post(
            "/api/v1/assistant/ask",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"project_id": PROJECT_ID, "question": "Tell me about the secret dragon plan."},
        )

        assert response.status_code == 200
        assert any(
            source["id"] == DRAFT_STORY_ID
            for source in response.json()["sources"]
        )
        assert "Secret Dragon Plan" in provider.calls[0][0]
    finally:
        monkeypatch.undo()
        client.close()


def test_insufficient_context_returns_honest_answer_without_ai_call() -> None:
    client, _database, monkeypatch, provider = build_client()
    try:
        response = client.post(
            "/api/v1/assistant/ask",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"project_id": PROJECT_ID, "question": "What is the spaceship model?"},
        )

        assert response.status_code == 200
        assert "couldn't find relevant information" in response.json()["answer"].lower()
        assert response.json()["sources"] == []
        assert not provider.calls
    finally:
        monkeypatch.undo()
        client.close()


def test_provider_failure_returns_sanitized_service_error() -> None:
    client, _database, monkeypatch, _provider = build_client(provider=FakeProvider(error=True))
    try:
        response = client.post(
            "/api/v1/assistant/ask",
            headers={"Authorization": "Bearer mocked-access-token"},
            json={"project_id": PROJECT_ID, "question": "What is Mira's personality?"},
        )

        assert response.status_code == 503
        assert response.json()["error"]["message"] == "The request could not be completed."
        assert "Adaption" not in response.text
    finally:
        monkeypatch.undo()
        client.close()


def test_unauthenticated_request_is_rejected() -> None:
    app = create_app(Settings(
        _env_file=None,
        secret_key="test-secret-key-material-with-more-than-32-characters",
        environment="testing",
        supabase_enabled=False,
    ))
    client = TestClient(app)
    try:
        response = client.get("/api/v1/assistant/projects")
        assert response.status_code == 401
    finally:
        client.close()
