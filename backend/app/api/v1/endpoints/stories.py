from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.v1.endpoints.characters import (
    CharacterContext,
    execute_query,
    get_character_context,
    require_owned_project,
)
from app.schemas.stories import StoryCreate, StoryResponse, StoryUpdate

router = APIRouter(prefix="/stories", tags=["stories"])


def writer_context(
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> CharacterContext:
    return context


async def get_owned_story(context: CharacterContext, story_id: UUID) -> dict[str, Any]:
    result = await execute_query(
        context.client.table("stories")
        .select("*")
        .eq("id", str(story_id))
        .limit(1)
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested story was not found.",
        )
    story = result.data[0]
    await require_owned_project(context, UUID(story["project_id"]))
    return story


@router.get("", response_model=list[StoryResponse])
async def list_stories(
    context: Annotated[CharacterContext, Depends(writer_context)],
) -> list[StoryResponse]:
    project_result = await execute_query(
        context.client.table("projects")
        .select("id")
        .eq("owner_id", context.user.id)
    )
    project_ids = [row["id"] for row in project_result.data]
    if not project_ids:
        return []

    result = await execute_query(
        context.client.table("stories")
        .select("*")
        .in_("project_id", project_ids)
        .order("updated_at", desc=True)
    )
    return [StoryResponse.from_database(row) for row in result.data]


@router.post("", response_model=StoryResponse, status_code=status.HTTP_201_CREATED)
async def create_story(
    payload: StoryCreate,
    context: Annotated[CharacterContext, Depends(writer_context)],
) -> StoryResponse:
    await require_owned_project(context, payload.project_id)
    existing = await execute_query(
        context.client.table("stories")
        .select("sort_order")
        .eq("project_id", str(payload.project_id))
        .order("sort_order", desc=True)
        .limit(1)
    )
    row = payload.model_dump(mode="json")
    row["sort_order"] = existing.data[0]["sort_order"] + 1 if existing.data else 0
    result = await execute_query(
        context.client.table("stories").insert(row).select("*")
    )
    return StoryResponse.from_database(result.data[0])


@router.get("/{story_id}", response_model=StoryResponse)
async def get_story(
    story_id: UUID,
    context: Annotated[CharacterContext, Depends(writer_context)],
) -> StoryResponse:
    return StoryResponse.from_database(await get_owned_story(context, story_id))


@router.patch("/{story_id}", response_model=StoryResponse)
async def update_story(
    story_id: UUID,
    payload: StoryUpdate,
    context: Annotated[CharacterContext, Depends(writer_context)],
) -> StoryResponse:
    current = await get_owned_story(context, story_id)
    updates = payload.model_dump(mode="json", exclude_unset=True)
    if "project_id" in updates:
        target_project_id = UUID(updates["project_id"])
        await require_owned_project(context, target_project_id)
        if str(target_project_id) != current["project_id"]:
            existing = await execute_query(
                context.client.table("stories")
                .select("sort_order")
                .eq("project_id", str(target_project_id))
            )
            updates["sort_order"] = max(
                (row["sort_order"] for row in existing.data),
                default=-1,
            ) + 1
        updates["project_id"] = str(target_project_id)

    result = await execute_query(
        context.client.table("stories")
        .update(updates)
        .eq("id", str(story_id))
        .select("*")
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested story was not found.",
        )
    return StoryResponse.from_database(result.data[0] or current)


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story_id: UUID,
    context: Annotated[CharacterContext, Depends(writer_context)],
) -> Response:
    await get_owned_story(context, story_id)
    await execute_query(
        context.client.table("stories")
        .delete()
        .eq("id", str(story_id))
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
