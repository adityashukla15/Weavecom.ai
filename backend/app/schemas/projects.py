from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=1000)
    genre: str = Field(default="", max_length=80)
    status: ProjectStatus = ProjectStatus.DRAFT
    page_target: int = Field(default=20, ge=1, le=500)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("Project title must contain at least three non-space characters.")
        return normalized


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    title: str
    description: str
    genre: str
    status: ProjectStatus
    page_count: int
    page_target: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_database(cls, row: dict[str, Any]) -> ProjectResponse:
        return cls.model_validate(row)
