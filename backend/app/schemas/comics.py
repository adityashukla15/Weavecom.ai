from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class ComicStatus(StrEnum):
    DRAFT = "draft"
    COMPLETED = "completed"


class BubbleType(StrEnum):
    SPEECH = "speech"
    THOUGHT = "thought"
    NARRATION = "narration"


class ComicCreate(BaseModel):
    story_id: UUID
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=1000)
    status: ComicStatus = ComicStatus.DRAFT


class ComicUpdate(BaseModel):
    story_id: UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    status: ComicStatus | None = None

    @model_validator(mode="after")
    def reject_nulls_for_fields(self) -> ComicUpdate:
        if not self.model_fields_set or any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Provide at least one non-null comic field.")
        return self


class ComicPanelCreate(BaseModel):
    description: str = Field(default="", max_length=2000)
    image_url: HttpUrl | None = None
    layout: dict[str, Any] = Field(default_factory=dict)


class ComicPanelUpdate(BaseModel):
    description: str | None = Field(default=None, max_length=2000)
    image_url: HttpUrl | None = None
    layout: dict[str, Any] | None = None

    @model_validator(mode="after")
    def require_changes(self) -> ComicPanelUpdate:
        if not self.model_fields_set or any(
            getattr(self, field) is None
            for field in self.model_fields_set
            if field != "image_url"
        ):
            raise ValueError("Provide at least one non-null panel field.")
        return self


class ComicPanelReorder(BaseModel):
    panel_ids: list[UUID] = Field(min_length=1, max_length=100)


class BubbleCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    bubble_type: BubbleType = BubbleType.SPEECH
    position_x: float = Field(default=50, ge=0, le=100)
    position_y: float = Field(default=20, ge=0, le=100)


class BubbleUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=2000)
    bubble_type: BubbleType | None = None
    position_x: float | None = Field(default=None, ge=0, le=100)
    position_y: float | None = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def require_changes(self) -> BubbleUpdate:
        if not self.model_fields_set or any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Provide at least one non-null bubble field.")
        return self


class SpeechBubbleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    panel_id: UUID
    text: str
    bubble_type: BubbleType
    position_x: float
    position_y: float
    created_at: datetime
    updated_at: datetime


class ComicPanelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    comic_id: UUID
    panel_number: int
    description: str
    image_url: str | None
    layout: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    bubbles: list[SpeechBubbleResponse] = Field(default_factory=list)


class ComicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    story_id: UUID
    title: str
    description: str
    status: ComicStatus
    created_at: datetime
    updated_at: datetime
    panels: list[ComicPanelResponse] = Field(default_factory=list)


class ComicSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    story_id: UUID
    title: str
    description: str
    status: ComicStatus
    created_at: datetime
    updated_at: datetime
    story_title: str
