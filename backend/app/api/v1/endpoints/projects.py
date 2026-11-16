from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.v1.endpoints.characters import (
    CharacterContext,
    execute_query,
    get_character_context,
)
from app.schemas.projects import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_writer_projects(
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> list[ProjectResponse]:
    result = await execute_query(
        context.client.table("projects")
        .select("*")
        .eq("owner_id", context.user.id)
        .order("updated_at", desc=True)
        .limit(100)
    )
    return [ProjectResponse.from_database(row) for row in result.data]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> ProjectResponse:
    row = payload.model_dump(mode="json")
    row["owner_id"] = context.user.id
    result = await execute_query(
        context.client.table("projects").insert(row).select("*")
    )
    return ProjectResponse.from_database(result.data[0])
