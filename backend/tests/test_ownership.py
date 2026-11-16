from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.ownership import (
    ProjectAccess,
    require_project_owner_id,
    require_project_read_access,
    require_project_write_access,
)
from app.schemas.auth import AuthenticatedUser, UserRole

WRITER = AuthenticatedUser(id="writer-id", role=UserRole.WRITER)
READER = AuthenticatedUser(id="reader-id", role=UserRole.READER)
OWN_DRAFT = ProjectAccess(id="project-1", owner_id="writer-id", status="draft")
OTHER_DRAFT = ProjectAccess(id="project-2", owner_id="another-writer", status="draft")
PUBLISHED = ProjectAccess(id="project-3", owner_id="another-writer", status="published")


def test_writer_can_access_and_modify_own_project() -> None:
    require_project_read_access(WRITER, OWN_DRAFT)
    require_project_write_access(WRITER, OWN_DRAFT)


def test_writer_cannot_access_another_writers_project() -> None:
    with pytest.raises(HTTPException) as error:
        require_project_read_access(WRITER, OTHER_DRAFT)

    assert error.value.status_code == 404


def test_reader_can_access_published_project() -> None:
    require_project_read_access(READER, PUBLISHED)


def test_reader_cannot_access_unpublished_project() -> None:
    with pytest.raises(HTTPException) as error:
        require_project_read_access(READER, OTHER_DRAFT)

    assert error.value.status_code == 404


def test_reader_cannot_modify_published_content() -> None:
    with pytest.raises(HTTPException) as error:
        require_project_write_access(READER, PUBLISHED)

    assert error.value.status_code == 403


def test_project_owner_must_match_authenticated_writer() -> None:
    require_project_owner_id(WRITER, WRITER.id)

    with pytest.raises(HTTPException) as error:
        require_project_owner_id(WRITER, "another-writer")

    assert error.value.status_code == 403


def test_reader_cannot_claim_project_ownership() -> None:
    with pytest.raises(HTTPException) as error:
        require_project_owner_id(READER, READER.id)

    assert error.value.status_code == 403
