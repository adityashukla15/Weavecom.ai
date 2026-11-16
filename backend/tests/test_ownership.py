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

OWNER = AuthenticatedUser(id="writer-id")
OTHER_USER = AuthenticatedUser(id="reader-id")
LEGACY_READER = AuthenticatedUser(id="writer-id", role=UserRole.READER)
OWN_DRAFT = ProjectAccess(id="project-1", owner_id="writer-id", status="draft")
OTHER_DRAFT = ProjectAccess(id="project-2", owner_id="another-writer", status="draft")
PUBLISHED = ProjectAccess(id="project-3", owner_id="another-writer", status="published")


def test_authenticated_user_without_role_can_access_and_modify_own_project() -> None:
    require_project_read_access(OWNER, OWN_DRAFT)
    require_project_write_access(OWNER, OWN_DRAFT)


def test_user_cannot_access_another_users_private_project() -> None:
    with pytest.raises(HTTPException) as error:
        require_project_read_access(OWNER, OTHER_DRAFT)

    assert error.value.status_code == 404


def test_authenticated_user_can_access_published_project() -> None:
    require_project_read_access(OTHER_USER, PUBLISHED)


def test_user_cannot_access_another_users_unpublished_project() -> None:
    with pytest.raises(HTTPException) as error:
        require_project_read_access(OTHER_USER, OTHER_DRAFT)

    assert error.value.status_code == 404


def test_non_owner_cannot_modify_published_content() -> None:
    with pytest.raises(HTTPException) as error:
        require_project_write_access(OTHER_USER, PUBLISHED)

    assert error.value.status_code == 404


def test_project_owner_must_match_authenticated_user() -> None:
    require_project_owner_id(OWNER, OWNER.id)

    with pytest.raises(HTTPException) as error:
        require_project_owner_id(OWNER, "another-writer")

    assert error.value.status_code == 403


def test_legacy_role_does_not_prevent_owner_access() -> None:
    require_project_write_access(LEGACY_READER, OWN_DRAFT)
