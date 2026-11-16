from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from postgrest.exceptions import APIError
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.core.auth import bearer_scheme, get_current_user
from app.integrations.supabase.client import create_user_scoped_supabase_client
from app.schemas.auth import AuthenticatedUser
from app.schemas.characters import (
    CharacterCreate,
    CharacterProject,
    CharacterResponse,
    CharacterUpdate,
)

router = APIRouter(prefix="/characters", tags=["characters"])


@dataclass(frozen=True)
class CharacterContext:
    client: Client
    user: AuthenticatedUser


def get_character_context(
    request: Request,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> CharacterContext:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        client = create_user_scoped_supabase_client(
            request.app.state.settings,
            credentials.credentials,
        )
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Character storage is not configured.",
        ) from error
    return CharacterContext(client=client, user=user)


async def execute_query(query: Any) -> Any:
    try:
        return await run_in_threadpool(query.execute)
    except APIError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Character storage is temporarily unavailable.",
        ) from error


async def require_owned_project(context: CharacterContext, project_id: UUID) -> None:
    result = await execute_query(
        context.client.table("projects")
        .select("id")
        .eq("id", str(project_id))
        .eq("owner_id", context.user.id)
        .limit(1)
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested project was not found.",
        )


async def get_owned_character(context: CharacterContext, character_id: UUID) -> dict[str, Any]:
    result = await execute_query(
        context.client.table("characters")
        .select("*")
        .eq("id", str(character_id))
        .limit(1)
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested character was not found.",
        )
    return result.data[0]


@router.get("/projects", response_model=list[CharacterProject])
async def list_writer_projects(
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> list[CharacterProject]:
    result = await execute_query(
        context.client.table("projects")
        .select("id,title")
        .eq("owner_id", context.user.id)
        .order("updated_at", desc=True)
    )
    return [CharacterProject.model_validate(row) for row in result.data]


@router.post("", response_model=CharacterResponse, status_code=status.HTTP_201_CREATED)
async def create_character(
    payload: CharacterCreate,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> CharacterResponse:
    await require_owned_project(context, payload.project_id)
    row = payload.model_dump(mode="json", exclude={"role"})
    row["character_role"] = payload.role.value
    result = await execute_query(
        context.client.table("characters").insert(row).select("*")
    )
    return CharacterResponse.from_database(result.data[0])


@router.get("", response_model=list[CharacterResponse])
async def list_characters(
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> list[CharacterResponse]:
    project_result = await execute_query(
        context.client.table("projects")
        .select("id")
        .eq("owner_id", context.user.id)
    )
    project_ids = [row["id"] for row in project_result.data]
    if not project_ids:
        return []

    result = await execute_query(
        context.client.table("characters")
        .select("*")
        .in_("project_id", project_ids)
        .order("updated_at", desc=True)
    )
    return [CharacterResponse.from_database(row) for row in result.data]


@router.get("/{character_id}", response_model=CharacterResponse)
async def get_character(
    character_id: UUID,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> CharacterResponse:
    row = await get_owned_character(context, character_id)
    await require_owned_project(context, UUID(row["project_id"]))
    return CharacterResponse.from_database(row)


@router.patch("/{character_id}", response_model=CharacterResponse)
async def update_character(
    character_id: UUID,
    payload: CharacterUpdate,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> CharacterResponse:
    current = await get_owned_character(context, character_id)
    await require_owned_project(context, UUID(current["project_id"]))

    updates = payload.model_dump(mode="json", exclude_unset=True)
    if "project_id" in updates:
        await require_owned_project(context, UUID(updates["project_id"]))
        updates["project_id"] = str(updates["project_id"])
    if "role" in updates:
        updates["character_role"] = updates.pop("role")

    result = await execute_query(
        context.client.table("characters")
        .update(updates)
        .eq("id", str(character_id))
        .select("*")
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested character was not found.",
        )
    return CharacterResponse.from_database(result.data[0])


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(
    character_id: UUID,
    context: Annotated[CharacterContext, Depends(get_character_context)],
) -> Response:
    row = await get_owned_character(context, character_id)
    await require_owned_project(context, UUID(row["project_id"]))
    await execute_query(
        context.client.table("characters")
        .delete()
        .eq("id", str(character_id))
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
