from __future__ import annotations

from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors as genai_errors
from pydantic import SecretStr

from app.ai.errors import AIProviderError
from app.ai.providers.adaption import (
    AdaptionProviderConfig,
    AdaptionResponsesClient,
    AdaptionTextResult,
)
from app.ai.providers.gemini import GeminiImageClient, GeminiProviderConfig
from app.schemas.ai import WritingAssistanceRequest
from app.services.ai_service import AIService


def adaption_config(api_key: str | None = "test-adaption-key") -> AdaptionProviderConfig:
    return AdaptionProviderConfig(
        api_key=SecretStr(api_key) if api_key else None,
        base_url="https://api.example.test/api/v1",
        model="deepseek-v4-flash",
    )


def gemini_config(api_key: str | None = "test-gemini-key") -> GeminiProviderConfig:
    return GeminiProviderConfig(
        api_key=SecretStr(api_key) if api_key else None,
        image_model="gemini-3.1-flash-image",
    )


@pytest.mark.asyncio
async def test_adaption_responses_client_sends_documented_request_and_extracts_text() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "id": "response-id",
                "model": "deepseek-v4-flash",
                "status": "completed",
                "output_text": "A useful suggestion.",
            },
        )

    client = AdaptionResponsesClient(
        adaption_config(),
        transport=httpx.MockTransport(handler),
    )

    result = await client.generate_text(
        "Review this scene.",
        instructions="Return concise suggestions.",
        max_output_tokens=500,
    )

    assert result.text == "A useful suggestion."
    assert result.model == "deepseek-v4-flash"
    assert result.response_id == "response-id"
    assert len(requests) == 1
    assert requests[0].method == "POST"
    assert str(requests[0].url) == "https://api.example.test/api/v1/responses"
    assert requests[0].headers["Authorization"] == "Bearer test-adaption-key"
    assert requests[0].read() == (
        b'{"model":"deepseek-v4-flash","input":"Review this scene.",'
        b'"max_output_tokens":500,"instructions":"Return concise suggestions."}'
    )


@pytest.mark.asyncio
async def test_adaption_responses_client_reads_nested_output_text() -> None:
    client = AdaptionResponsesClient(
        adaption_config(),
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(
                200,
                json={
                    "output": [
                        {
                            "type": "message",
                            "content": [{"type": "output_text", "text": "Nested result."}],
                        }
                    ]
                },
            )
        ),
    )

    result = await client.generate_text("Prompt")

    assert result.text == "Nested result."


@pytest.mark.asyncio
async def test_adaption_responses_client_retries_transient_status() -> None:
    statuses = iter([503, 200])
    requests = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        status = next(statuses)
        return httpx.Response(
            status,
            json={"output_text": "Recovered."} if status == 200 else {"error": "unavailable"},
        )

    client = AdaptionResponsesClient(
        adaption_config(),
        transport=httpx.MockTransport(handler),
        base_delay=0,
    )

    result = await client.generate_text("Prompt")

    assert result.text == "Recovered."
    assert requests == 2


@pytest.mark.asyncio
async def test_adaption_responses_client_does_not_retry_client_errors() -> None:
    requests = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(400, json={"error": "invalid"})

    client = AdaptionResponsesClient(
        adaption_config(),
        transport=httpx.MockTransport(handler),
        base_delay=0,
    )

    with pytest.raises(AIProviderError) as error:
        await client.generate_text("Prompt")

    assert error.value.status_code == 400
    assert not error.value.retryable
    assert requests == 1


@pytest.mark.asyncio
async def test_adaption_responses_client_requires_configured_key() -> None:
    client = AdaptionResponsesClient(adaption_config(api_key=None))

    with pytest.raises(AIProviderError, match="missing_api_key"):
        await client.generate_text("Prompt")


@pytest.mark.asyncio
async def test_ai_service_validates_structured_suggestions() -> None:
    class TextProvider:
        async def generate_text(
            self,
            *_args: object,
            **_kwargs: object,
        ) -> AdaptionTextResult:
            return AdaptionTextResult(
                model="test-model",
                text=(
                    '{"suggestions":[{"category":"plot","excerpt":"The door opened.",'
                    '"suggestion":"Foreshadow who opened it.","rationale":"This clarifies the scene."}]}'
                ),
            )

    service = AIService(TextProvider())

    result = await service.suggest_writing(
        WritingAssistanceRequest(task="plot", content="The door opened.")
    )

    assert result.suggestions[0].category == "plot"
    assert result.suggestions[0].suggestion == "Foreshadow who opened it."


@pytest.mark.asyncio
async def test_ai_service_rejects_malformed_structured_suggestions() -> None:
    class TextProvider:
        async def generate_text(
            self,
            *_args: object,
            **_kwargs: object,
        ) -> AdaptionTextResult:
            return AdaptionTextResult(
                model="test-model",
                text='{"suggestions":[{"category":"unknown"}]}',
            )

    service = AIService(TextProvider())

    with pytest.raises(AIProviderError, match="invalid_structured_response"):
        await service.suggest_writing(
            WritingAssistanceRequest(task="improve", content="A scene.")
        )


def fake_image_response(data: bytes = b"image-bytes", mime_type: str = "image/png") -> SimpleNamespace:
    return SimpleNamespace(
        candidates=[
            SimpleNamespace(
                content=SimpleNamespace(
                    parts=[
                        SimpleNamespace(
                            inline_data=SimpleNamespace(data=data, mime_type=mime_type)
                        )
                    ]
                )
            )
        ]
    )


@pytest.mark.asyncio
async def test_gemini_image_client_requests_image_and_returns_image_bytes() -> None:
    calls: list[dict[str, object]] = []
    closed = False

    class FakeModels:
        def generate_content(self, **kwargs: object) -> SimpleNamespace:
            calls.append(kwargs)
            return fake_image_response()

    class FakeClient:
        models = FakeModels()

        def close(self) -> None:
            nonlocal closed
            closed = True

    client = GeminiImageClient(gemini_config(), client_factory=lambda _key: FakeClient())

    image = await client.generate_image("A comic-book hero portrait.")

    assert image.data == b"image-bytes"
    assert image.mime_type == "image/png"
    assert calls[0]["model"] == "gemini-3.1-flash-image"
    assert calls[0]["contents"] == "A comic-book hero portrait."
    assert calls[0]["config"].response_modalities == ["IMAGE"]
    assert closed


@pytest.mark.asyncio
async def test_gemini_image_client_retries_transient_provider_errors() -> None:
    attempts = 0

    class FakeModels:
        def generate_content(self, **_kwargs: object) -> SimpleNamespace:
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise genai_errors.ServerError(503, {})
            return fake_image_response()

    class FakeClient:
        models = FakeModels()

        def close(self) -> None:
            pass

    client = GeminiImageClient(
        gemini_config(),
        client_factory=lambda _key: FakeClient(),
        base_delay=0,
    )

    image = await client.generate_image("A comic-book scene.")

    assert image.data == b"image-bytes"
    assert attempts == 2


@pytest.mark.asyncio
async def test_gemini_image_client_requires_configured_key() -> None:
    client = GeminiImageClient(gemini_config(api_key=None))

    with pytest.raises(AIProviderError, match="missing_api_key"):
        await client.generate_image("A comic-book scene.")


@pytest.mark.asyncio
async def test_gemini_image_client_rejects_response_without_image() -> None:
    class FakeModels:
        def generate_content(self, **_kwargs: object) -> SimpleNamespace:
            return SimpleNamespace(candidates=[])

    class FakeClient:
        models = FakeModels()

        def close(self) -> None:
            pass

    client = GeminiImageClient(gemini_config(), client_factory=lambda _key: FakeClient())

    with pytest.raises(AIProviderError, match="image_missing_from_response"):
        await client.generate_image("A comic-book scene.")
