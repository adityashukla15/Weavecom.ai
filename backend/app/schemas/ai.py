from typing import Literal

from pydantic import BaseModel, Field


class WritingAssistanceRequest(BaseModel):
    task: Literal["improve", "dialogue", "consistency", "plot", "grammar", "alternatives"]
    content: str = Field(min_length=1, max_length=30_000)
    context: str | None = Field(default=None, max_length=20_000)


class WritingSuggestion(BaseModel):
    category: Literal["story", "dialogue", "consistency", "plot", "grammar", "alternatives"]
    excerpt: str | None = Field(default=None, max_length=2_000)
    suggestion: str = Field(min_length=1, max_length=4_000)
    rationale: str = Field(min_length=1, max_length=4_000)


class WritingSuggestions(BaseModel):
    suggestions: list[WritingSuggestion] = Field(min_length=1, max_length=20)
