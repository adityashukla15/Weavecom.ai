from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StoryStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


class StoryCreate(BaseModel):
    project_id: UUID
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=500)
    genre: str = Field(default="", max_length=80)
    synopsis: str = Field(default="", max_length=5000)
    main_plot: str = Field(default="", max_length=30000)
    status: StoryStatus = StoryStatus.DRAFT


class StoryUpdate(BaseModel):
    project_id: UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    genre: str | None = Field(default=None, max_length=80)
    synopsis: str | None = Field(default=None, max_length=5000)
    main_plot: str | None = Field(default=None, max_length=30000)
    status: StoryStatus | None = None

    @model_validator(mode="after")
    def reject_nulls_for_required_fields(self) -> StoryUpdate:
        invalid = [
            field
            for field in self.model_fields_set
            if getattr(self, field) is None
        ]
        if invalid:
            raise ValueError(f"These fields cannot be null: {', '.join(sorted(invalid))}.")
        if not self.model_fields_set:
            raise ValueError("At least one story field must be provided.")
        return self


class StoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    description: str
    genre: str
    synopsis: str
    main_plot: str
    status: StoryStatus
    sort_order: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_database(cls, row: dict[str, Any]) -> StoryResponse:
        return cls.model_validate(row)
