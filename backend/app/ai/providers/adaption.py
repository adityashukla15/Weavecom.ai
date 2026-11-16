from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import httpx
from pydantic import SecretStr

from app.ai.errors import AIProviderError
from app.ai.retry import retry_provider_call

from app.core.config import Settings


@dataclass(frozen=True)
class AdaptionProviderConfig:
    api_key: SecretStr | None
    base_url: str
    model: str

    @classmethod
    def from_settings(cls, settings: Settings) -> AdaptionProviderConfig:
        return cls(
            api_key=settings.adaption_api_key,
            base_url=settings.adaption_base_url,
            model=settings.adaption_model,
        )


@dataclass(frozen=True)
class AdaptionTextResult:
    model: str
    text: str
    response_id: str | None = None


class AdaptionResponsesClient:
    def __init__(
        self,
        config: AdaptionProviderConfig,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        attempts: int = 3,
        base_delay: float = 0.25,
    ) -> None:
        self._config = config
        self._transport = transport
        self._attempts = attempts
        self._base_delay = base_delay

    async def generate_text(
        self,
        prompt: str,
        *,
        instructions: str | None = None,
        max_output_tokens: int = 2048,
    ) -> AdaptionTextResult:
        if not self._config.api_key:
            raise AIProviderError("Adaption", "missing_api_key")

        payload: dict[str, Any] = {
            "model": self._config.model,
            "input": prompt,
            "max_output_tokens": max_output_tokens,
        }
        if instructions:
            payload["instructions"] = instructions

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(45.0, connect=10.0),
            transport=self._transport,
        ) as client:
            async def send_request() -> AdaptionTextResult:
                try:
                    response = await client.post(
                        f"{self._config.base_url.rstrip('/')}/responses",
                        headers={
                            "Authorization": f"Bearer {self._config.api_key.get_secret_value()}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                except httpx.TimeoutException as error:
                    raise AIProviderError("Adaption", "timeout", retryable=True) from error
                except httpx.TransportError as error:
                    raise AIProviderError("Adaption", "connection_error", retryable=True) from error

                if response.status_code >= 400:
                    status_code = response.status_code
                    raise AIProviderError(
                        "Adaption",
                        "http_error",
                        status_code=status_code,
                        retryable=status_code == 429 or status_code >= 500,
                    )

                try:
                    response_data = response.json()
                    text = _extract_response_text(response_data)
                except (ValueError, TypeError) as error:
                    raise AIProviderError("Adaption", "invalid_response") from error

                if not text.strip():
                    raise AIProviderError("Adaption", "empty_response")

                return AdaptionTextResult(
                    model=str(response_data.get("model") or self._config.model),
                    text=text,
                    response_id=response_data.get("id"),
                )

            return await retry_provider_call(
                send_request,
                attempts=self._attempts,
                base_delay=self._base_delay,
            )


def _extract_response_text(response_data: object) -> str:
    if not isinstance(response_data, Mapping):
        raise TypeError("The provider response must be an object.")

    output_text = response_data.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    text_parts: list[str] = []
    output = response_data.get("output", [])
    if not isinstance(output, list):
        raise TypeError("The provider response output must be a list.")

    for item in output:
        if not isinstance(item, Mapping):
            continue
        content = item.get("content", [])
        if not isinstance(content, list):
            continue
        for part in content:
            if not isinstance(part, Mapping):
                continue
            text = part.get("text")
            if part.get("type") == "output_text" and isinstance(text, str):
                text_parts.append(text)

    return "".join(text_parts)
