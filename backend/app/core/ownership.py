from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from fastapi import HTTPException, status

from app.schemas.auth import AuthenticatedUser, UserRole

ProjectStatus = Literal["draft", "published"]


@dataclass(frozen=True)
class ProjectAccess:
    id: str
    owner_id: str
    status: ProjectStatus


def require_project_read_access(
    user: AuthenticatedUser,
    project: ProjectAccess,
) -> None:
    if user.role == UserRole.WRITER and project.owner_id == user.id:
        return
    if user.role == UserRole.READER and project.status == "published":
        return
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="The requested project was not found.",
    )


def require_project_write_access(
    user: AuthenticatedUser,
    project: ProjectAccess,
) -> None:
    if user.role != UserRole.WRITER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account does not have permission to modify this project.",
        )
    if project.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested project was not found.",
        )


def require_project_owner_id(user: AuthenticatedUser, owner_id: str) -> None:
    if user.role != UserRole.WRITER or owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project ownership must match the authenticated Writer.",
        )
