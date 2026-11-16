from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass

import httpx
from google import genai
from google.genai import errors as genai_errors, types
from pydantic import SecretStr

from app.ai.errors import AIProviderError
from app.ai.retry import retry_provider_call
from app.core.config import Settings


@dataclass(frozen=True)
class GeminiProviderConfig:
    api_key: SecretStr | None
    image_model: str

    @classmethod
    def from_settings(cls, settings: Settings) -> GeminiProviderConfig:
        return cls(
            api_key=settings.gemini_api_key,
            image_model=settings.gemini_image_model,
        )


@dataclass(frozen=True)
class GeneratedImage:
    model: str
    data: bytes
    mime_type: str


class GeminiImageClient:
    def __init__(
        self,
        config: GeminiProviderConfig,
        *,
        client_factory: Callable[[str], genai.Client] | None = None,
        attempts: int = 3,
        base_delay: float = 0.25,
    ) -> None:
        self._config = config
        self._client_factory = client_factory or _create_client
        self._attempts = attempts
        self._base_delay = base_delay

    async def generate_image(self, prompt: str) -> GeneratedImage:
        if not self._config.api_key:
            raise AIProviderError("Gemini", "missing_api_key")

        client = self._client_factory(self._config.api_key.get_secret_value())
        try:
            async def generate() -> GeneratedImage:
                try:
                    response = await asyncio.to_thread(
                        client.models.generate_content,
                        model=self._config.image_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
                    )
                except genai_errors.APIError as error:
                    status_code = error.code
                    raise AIProviderError(
                        "Gemini",
                        "http_error",
                        status_code=status_code,
                        retryable=status_code == 429 or status_code >= 500,
                    ) from error
                except (TimeoutError, httpx.TimeoutException) as error:
                    raise AIProviderError("Gemini", "timeout", retryable=True) from error
                except httpx.TransportError as error:
                    raise AIProviderError("Gemini", "connection_error", retryable=True) from error

                for candidate in response.candidates or []:
                    content = candidate.content
                    for part in content.parts if content else []:
                        inline_data = part.inline_data
                        if inline_data and isinstance(inline_data.data, bytes):
                            mime_type = inline_data.mime_type or ""
                            if not mime_type.startswith("image/"):
                                raise AIProviderError("Gemini", "invalid_image_type")
                            return GeneratedImage(
                                model=self._config.image_model,
                                data=inline_data.data,
                                mime_type=mime_type,
                            )

                raise AIProviderError("Gemini", "image_missing_from_response")

            return await retry_provider_call(
                generate,
                attempts=self._attempts,
                base_delay=self._base_delay,
            )
        finally:
            await asyncio.to_thread(client.close)


def _create_client(api_key: str) -> genai.Client:
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=60_000),
    )
