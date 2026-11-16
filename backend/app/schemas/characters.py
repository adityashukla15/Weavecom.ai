from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, model_validator


class CharacterRole(StrEnum):
    PROTAGONIST = "protagonist"
    ANTAGONIST = "antagonist"
    SUPPORTING = "supporting"


class CharacterCreate(BaseModel):
    project_id: UUID
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    personality: str = Field(default="", max_length=2000)
    appearance: str = Field(default="", max_length=2000)
    background: str = Field(default="", max_length=5000)
    role: CharacterRole = CharacterRole.SUPPORTING
    image_url: AnyHttpUrl | None = None


class CharacterUpdate(BaseModel):
    project_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    personality: str | None = Field(default=None, max_length=2000)
    appearance: str | None = Field(default=None, max_length=2000)
    background: str | None = Field(default=None, max_length=5000)
    role: CharacterRole | None = None
    image_url: AnyHttpUrl | None = None

    @model_validator(mode="after")
    def reject_nulls_for_required_fields(self) -> CharacterUpdate:
        nullable_fields = {"image_url"}
        invalid = [
            field
            for field in self.model_fields_set - nullable_fields
            if getattr(self, field) is None
        ]
        if invalid:
            raise ValueError(f"These fields cannot be null: {', '.join(sorted(invalid))}.")
        if not self.model_fields_set:
            raise ValueError("At least one character field must be provided.")
        return self


class CharacterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    description: str
    personality: str
    appearance: str
    background: str
    role: CharacterRole
    image_url: AnyHttpUrl | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_database(cls, row: dict[str, Any]) -> CharacterResponse:
        values = {**row, "role": row.get("character_role", "supporting")}
        return cls.model_validate(values)


class CharacterProject(BaseModel):
    id: UUID
    title: str
