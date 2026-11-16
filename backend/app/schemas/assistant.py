from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ProjectAssistantQuestion(BaseModel):
    project_id: UUID
    question: str = Field(min_length=3, max_length=2000)

    @field_validator("question")
    @classmethod
    def strip_question(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("Question must contain at least three non-space characters.")
        return normalized


class ProjectAssistantSource(BaseModel):
    content_type: Literal["story", "character", "comic"]
    id: UUID
    title: str


class ProjectAssistantAnswer(BaseModel):
    answer: str
    sources: list[ProjectAssistantSource] = Field(max_length=6)


class AssistantProject(BaseModel):
    id: UUID
    title: str
    status: str
