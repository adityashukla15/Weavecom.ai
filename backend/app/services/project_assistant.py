from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from postgrest.exceptions import APIError
from starlette.concurrency import run_in_threadpool

from app.schemas.assistant import ProjectAssistantSource

MAX_STORIES = 20
MAX_CHARACTERS = 20
MAX_COMICS = 10
MAX_PANELS = 30
MAX_BUBBLES = 60
MAX_SOURCES = 6
MAX_CONTEXT_CHARS = 6000
MAX_RECORD_CHARS = 2500
WORD_PATTERN = re.compile(r"[a-z0-9]{3,}", re.IGNORECASE)
STOP_WORDS = {
    "about", "after", "and", "are", "does", "for", "from", "how", "into",
    "its", "that", "the", "their", "them", "there", "this", "what", "when",
    "where", "which", "who", "why", "with",
}


@dataclass(frozen=True)
class RetrievedProjectContext:
    text: str
    sources: list[ProjectAssistantSource]


def _words(text: str) -> set[str]:
    return {
        match.lower()
        for match in WORD_PATTERN.findall(text)
        if match.lower() not in STOP_WORDS
    }


def _ranked(question: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    query_words = _words(question)
    if not query_words:
        return []
    ranked = []
    for candidate in candidates:
        terms = _words(candidate["text"])
        overlap = query_words & terms
        if overlap:
            ranked.append((len(overlap), candidate))
    ranked.sort(key=lambda item: (-item[0], item[1]["title"].casefold()))
    return [candidate for _, candidate in ranked[:MAX_SOURCES]]


async def retrieve_project_context(
    client: Any,
    *,
    project_id: UUID,
    published_only: bool,
    question: str,
) -> RetrievedProjectContext:
    stories_query = (
        client.table("stories")
        .select("id,title,description,genre,synopsis,main_plot,status")
        .eq("project_id", str(project_id))
        .order("updated_at", desc=True)
        .limit(MAX_STORIES)
    )
    if published_only:
        stories_query = stories_query.eq("status", "published")
    stories = (await execute_query(stories_query)).data
    story_ids = [row["id"] for row in stories]

    characters_query = (
        client.table("characters")
        .select("id,name,role_description,personality,appearance,background,character_role")
        .eq("project_id", str(project_id))
        .order("updated_at", desc=True)
        .limit(MAX_CHARACTERS)
    )
    characters = (await execute_query(characters_query)).data

    comics: list[dict[str, Any]] = []
    panels: list[dict[str, Any]] = []
    bubbles: list[dict[str, Any]] = []
    if story_ids:
        comic_result = await execute_query(
            client.table("comics")
            .select("id,story_id,title,description,status")
            .in_("story_id", story_ids)
            .eq("status", "completed")
            .order("updated_at", desc=True)
            .limit(MAX_COMICS)
        )
        comics = comic_result.data
        comic_ids = [row["id"] for row in comics]
        if comic_ids:
            panels = (
                await execute_query(
                    client.table("comic_panels")
                    .select("id,comic_id,panel_number,description,image_url")
                    .in_("comic_id", comic_ids)
                    .order("panel_number")
                    .limit(MAX_PANELS)
                )
            ).data
            panel_ids = [row["id"] for row in panels]
            if panel_ids:
                bubbles = (
                    await execute_query(
                        client.table("comic_speech_bubbles")
                        .select("panel_id,text,bubble_type")
                        .in_("panel_id", panel_ids)
                        .limit(MAX_BUBBLES)
                    )
                ).data

    story_titles = {row["id"]: row["title"] for row in stories}
    bubbles_by_panel: dict[str, list[str]] = {}
    for bubble in bubbles:
        bubbles_by_panel.setdefault(bubble["panel_id"], []).append(bubble["text"])
    panels_by_comic: dict[str, list[dict[str, Any]]] = {}
    for panel in panels:
        panels_by_comic.setdefault(panel["comic_id"], []).append(panel)

    candidates: list[dict[str, Any]] = []
    for story in stories:
        text = (
            f"Title: {story['title']} Description: {story.get('description') or ''} "
            f"Genre: {story.get('genre') or ''} Synopsis: {story.get('synopsis') or ''} "
            f"Main plot: {story.get('main_plot') or ''}"
        )[:MAX_RECORD_CHARS]
        candidates.append({
            "content_type": "story",
            "id": story["id"],
            "title": story["title"],
            "text": text,
            "context": f"Story: {story['title']}\n{text}",
        })
    for character in characters:
        text = (
            f"Name: {character['name']} Role: "
            f"{character.get('character_role') or ''} "
            f"{character.get('role_description') or ''} "
            f"Personality: {character.get('personality') or ''} "
            f"Appearance: {character.get('appearance') or ''} "
            f"Background: {character.get('background') or ''}"
        )[:MAX_RECORD_CHARS]
        title = character["name"]
        candidates.append({
            "content_type": "character",
            "id": character["id"],
            "title": title,
            "text": text,
            "context": f"Character: {title}\n{text}",
        })
    for comic in comics:
        comic_panels = panels_by_comic.get(comic["id"], [])
        panel_text = []
        for panel in comic_panels:
            dialogue = " ".join(bubbles_by_panel.get(panel["id"], []))
            panel_text.append(
                f"Panel {panel['panel_number']}: {panel.get('description') or ''}. "
                f"Dialogue: {dialogue}"
            )
        text = " ".join([
            str(comic.get("title") or ""),
            str(comic.get("description") or ""),
            story_titles.get(comic["story_id"], ""),
            *panel_text,
        ])[:MAX_RECORD_CHARS]
        title = comic["title"]
        candidates.append({
            "content_type": "comic",
            "id": comic["id"],
            "title": title,
            "text": text,
            "context": f"Completed comic: {title} (story: {story_titles.get(comic['story_id'], '')})\n{text}",
        })

    selected = _ranked(question, candidates)
    context_parts: list[str] = []
    sources: list[ProjectAssistantSource] = []
    remaining = MAX_CONTEXT_CHARS
    for candidate in selected:
        block = candidate["context"][:remaining].strip()
        if not block:
            break
        context_parts.append(block)
        sources.append(ProjectAssistantSource(
            content_type=candidate["content_type"],
            id=candidate["id"],
            title=candidate["title"],
        ))
        remaining -= len(block)
        if remaining <= 0:
            break

    return RetrievedProjectContext(text="\n\n".join(context_parts), sources=sources)


async def execute_query(query: Any) -> Any:
    try:
        return await run_in_threadpool(query.execute)
    except APIError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Project content is temporarily unavailable.",
        ) from error
