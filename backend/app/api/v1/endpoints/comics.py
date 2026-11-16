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
from app.schemas.comics import (
    BubbleCreate,
    BubbleUpdate,
    ComicCreate,
    ComicPanelCreate,
    ComicPanelReorder,
    ComicPanelUpdate,
    ComicResponse,
    ComicSummary,
    ComicUpdate,
    SpeechBubbleResponse,
    ComicPanelResponse,
)

router = APIRouter(prefix="/comics", tags=["comics"])


async def owned_story(context: CharacterContext, story_id: UUID) -> dict[str, Any]:
    result = await execute_query(
        context.client.table("stories")
        .select("id,project_id,title")
        .eq("id", str(story_id))
        .limit(1)
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="The requested story was not found.")
    await require_owned_project(context, UUID(result.data[0]["project_id"]))
    return result.data[0]


async def owned_comic(context: CharacterContext, comic_id: UUID) -> dict[str, Any]:
    result = await execute_query(
        context.client.table("comics")
        .select("*")
        .eq("id", str(comic_id))
        .limit(1)
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="The requested comic was not found.")
    await owned_story(context, UUID(result.data[0]["story_id"]))
    return result.data[0]


async def owned_panel(
    context: CharacterContext,
    comic_id: UUID,
    panel_id: UUID,
) -> dict[str, Any]:
    await owned_comic(context, comic_id)
    result = await execute_query(
        context.client.table("comic_panels")
        .select("*")
        .eq("id", str(panel_id))
        .eq("comic_id", str(comic_id))
        .limit(1)
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="The requested panel was not found.")
    return result.data[0]


async def comic_detail(context: CharacterContext, comic: dict[str, Any]) -> ComicResponse:
    panel_result = await execute_query(
        context.client.table("comic_panels")
        .select("*")
        .eq("comic_id", comic["id"])
        .order("panel_number")
    )
    panels = []
    for panel in panel_result.data:
        bubble_result = await execute_query(
            context.client.table("comic_speech_bubbles")
            .select("*")
            .eq("panel_id", panel["id"])
            .order("created_at")
        )
        panel["bubbles"] = [
            SpeechBubbleResponse.model_validate(row) for row in bubble_result.data
        ]
        panels.append(ComicPanelResponse.model_validate(panel))
    return ComicResponse.model_validate({**comic, "panels": panels})


@router.get("", response_model=list[ComicSummary])
async def list_comics(
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> list[ComicSummary]:
    project_result = await execute_query(
        context.client.table("projects")
        .select("id")
        .eq("owner_id", context.user.id)
    )
    project_ids = [row["id"] for row in project_result.data]
    if not project_ids:
        return []
    stories_result = await execute_query(
        context.client.table("stories")
        .select("id,title")
        .in_("project_id", project_ids)
    )
    story_titles = {row["id"]: row["title"] for row in stories_result.data}
    story_ids = list(story_titles)
    if not story_ids:
        return []
    result = await execute_query(
        context.client.table("comics")
        .select("*")
        .in_("story_id", story_ids)
        .order("updated_at", desc=True)
    )
    return [
        ComicSummary.model_validate({**row, "story_title": story_titles[row["story_id"]]})
        for row in result.data
    ]


@router.post("", response_model=ComicResponse, status_code=status.HTTP_201_CREATED)
async def create_comic(
    payload: ComicCreate,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> ComicResponse:
    await owned_story(context, payload.story_id)
    result = await execute_query(
        context.client.table("comics")
        .insert(payload.model_dump(mode="json"))
        .select("*")
    )
    return await comic_detail(context, result.data[0])


@router.get("/{comic_id}", response_model=ComicResponse)
async def get_comic(
    comic_id: UUID,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> ComicResponse:
    return await comic_detail(context, await owned_comic(context, comic_id))


@router.patch("/{comic_id}", response_model=ComicResponse)
async def update_comic(
    comic_id: UUID,
    payload: ComicUpdate,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> ComicResponse:
    current = await owned_comic(context, comic_id)
    updates = payload.model_dump(mode="json", exclude_unset=True)
    if "story_id" in updates:
        await owned_story(context, UUID(updates["story_id"]))
    result = await execute_query(
        context.client.table("comics")
        .update(updates)
        .eq("id", str(comic_id))
        .select("*")
    )
    return await comic_detail(context, result.data[0] if result.data else current)


@router.delete("/{comic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comic(
    comic_id: UUID,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> Response:
    await owned_comic(context, comic_id)
    await execute_query(context.client.table("comics").delete().eq("id", str(comic_id)))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{comic_id}/panels", response_model=ComicPanelResponse, status_code=status.HTTP_201_CREATED)
async def create_panel(
    comic_id: UUID,
    payload: ComicPanelCreate,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> ComicPanelResponse:
    await owned_comic(context, comic_id)
    result = await execute_query(
        context.client.table("comic_panels")
        .select("panel_number")
        .eq("comic_id", str(comic_id))
        .order("panel_number", desc=True)
        .limit(1)
    )
    row = payload.model_dump(mode="json")
    row.update({
        "comic_id": str(comic_id),
        "panel_number": result.data[0]["panel_number"] + 1 if result.data else 1,
    })
    inserted = await execute_query(
        context.client.table("comic_panels").insert(row).select("*")
    )
    return ComicPanelResponse.model_validate({**inserted.data[0], "bubbles": []})


@router.patch("/{comic_id}/panels/reorder", response_model=ComicResponse)
async def reorder_panels(
    comic_id: UUID,
    payload: ComicPanelReorder,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> ComicResponse:
    comic = await owned_comic(context, comic_id)
    result = await execute_query(
        context.client.table("comic_panels")
        .select("id")
        .eq("comic_id", str(comic_id))
    )
    existing_ids = {row["id"] for row in result.data}
    requested_ids = [str(panel_id) for panel_id in payload.panel_ids]
    if len(requested_ids) != len(existing_ids) or set(requested_ids) != existing_ids:
        raise HTTPException(status_code=422, detail="Panel order must include each comic panel exactly once.")
    offset = len(requested_ids) + 1
    for index, panel_id in enumerate(requested_ids, start=1):
        await execute_query(
            context.client.table("comic_panels")
            .update({"panel_number": offset + index})
            .eq("id", panel_id)
            .eq("comic_id", str(comic_id))
        )
    for number, panel_id in enumerate(requested_ids, start=1):
        await execute_query(
            context.client.table("comic_panels")
            .update({"panel_number": number})
            .eq("id", panel_id)
            .eq("comic_id", str(comic_id))
        )
    return await comic_detail(context, comic)


@router.patch("/{comic_id}/panels/{panel_id}", response_model=ComicPanelResponse)
async def update_panel(
    comic_id: UUID,
    panel_id: UUID,
    payload: ComicPanelUpdate,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> ComicPanelResponse:
    await owned_panel(context, comic_id, panel_id)
    result = await execute_query(
        context.client.table("comic_panels")
        .update(payload.model_dump(mode="json", exclude_unset=True))
        .eq("id", str(panel_id))
        .eq("comic_id", str(comic_id))
        .select("*")
    )
    return ComicPanelResponse.model_validate({**result.data[0], "bubbles": []})


@router.delete("/{comic_id}/panels/{panel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_panel(
    comic_id: UUID,
    panel_id: UUID,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> Response:
    await owned_panel(context, comic_id, panel_id)
    await execute_query(
        context.client.table("comic_panels")
        .delete()
        .eq("id", str(panel_id))
        .eq("comic_id", str(comic_id))
    )
    remaining = await execute_query(
        context.client.table("comic_panels")
        .select("id,panel_number")
        .eq("comic_id", str(comic_id))
        .order("panel_number")
    )
    offset = len(remaining.data) + 1
    for index, panel in enumerate(remaining.data, start=1):
        await execute_query(
            context.client.table("comic_panels")
            .update({"panel_number": offset + index})
            .eq("id", panel["id"])
        )
    for number, panel in enumerate(remaining.data, start=1):
        await execute_query(
            context.client.table("comic_panels")
            .update({"panel_number": number})
            .eq("id", panel["id"])
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{comic_id}/panels/{panel_id}/bubbles", response_model=SpeechBubbleResponse, status_code=status.HTTP_201_CREATED)
async def create_bubble(
    comic_id: UUID,
    panel_id: UUID,
    payload: BubbleCreate,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> SpeechBubbleResponse:
    await owned_panel(context, comic_id, panel_id)
    row = payload.model_dump(mode="json")
    row["panel_id"] = str(panel_id)
    result = await execute_query(
        context.client.table("comic_speech_bubbles").insert(row).select("*")
    )
    return SpeechBubbleResponse.model_validate(result.data[0])


@router.patch("/{comic_id}/panels/{panel_id}/bubbles/{bubble_id}", response_model=SpeechBubbleResponse)
async def update_bubble(
    comic_id: UUID,
    panel_id: UUID,
    bubble_id: UUID,
    payload: BubbleUpdate,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> SpeechBubbleResponse:
    await owned_panel(context, comic_id, panel_id)
    result = await execute_query(
        context.client.table("comic_speech_bubbles")
        .update(payload.model_dump(mode="json", exclude_unset=True))
        .eq("id", str(bubble_id))
        .eq("panel_id", str(panel_id))
        .select("*")
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="The requested speech bubble was not found.")
    return SpeechBubbleResponse.model_validate(result.data[0])


@router.delete("/{comic_id}/panels/{panel_id}/bubbles/{bubble_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bubble(
    comic_id: UUID,
    panel_id: UUID,
    bubble_id: UUID,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> Response:
    await owned_panel(context, comic_id, panel_id)
    result = await execute_query(
        context.client.table("comic_speech_bubbles")
        .select("id")
        .eq("id", str(bubble_id))
        .eq("panel_id", str(panel_id))
        .limit(1)
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="The requested speech bubble was not found.")
    await execute_query(
        context.client.table("comic_speech_bubbles")
        .delete()
        .eq("id", str(bubble_id))
        .eq("panel_id", str(panel_id))
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
