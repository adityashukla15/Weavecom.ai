from __future__ import annotations

import json
from typing import Protocol

from pydantic import BaseModel, ValidationError

from app.ai.errors import AIProviderError
from app.ai.providers.adaption import AdaptionTextResult
from app.schemas.ai import WritingAssistanceRequest, WritingSuggestions


class TextGenerationProvider(Protocol):
    async def generate_text(
        self,
        prompt: str,
        *,
        instructions: str | None = None,
        max_output_tokens: int = 2048,
    ) -> AdaptionTextResult: ...


class AIService:
    def __init__(self, text_provider: TextGenerationProvider) -> None:
        self._text_provider = text_provider

    async def suggest_writing(
        self,
        request: WritingAssistanceRequest,
    ) -> WritingSuggestions:
        schema = WritingSuggestions.model_json_schema()
        instructions = (
            "Return only a JSON object matching this schema. Suggestions are advisory and must "
            "not replace or rewrite the writer's original content. Do not invent facts absent "
            "from the supplied context.\n"
            f"JSON schema: {json.dumps(schema, separators=(',', ':'))}"
        )
        prompt = (
            f"Task: {request.task}\n"
            f"Context:\n{request.context or '(none provided)'}\n\n"
            f"Writer content:\n{request.content}"
        )
        result = await self._text_provider.generate_text(
            prompt,
            instructions=instructions,
            max_output_tokens=2048,
        )
        try:
            return WritingSuggestions.model_validate_json(result.text)
        except ValidationError as error:
            raise AIProviderError("Adaption", "invalid_structured_response") from error
