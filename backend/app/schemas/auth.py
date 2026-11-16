from enum import StrEnum

from pydantic import BaseModel


class UserRole(StrEnum):
    WRITER = "writer"
    READER = "reader"


class AuthenticatedUser(BaseModel):
    id: str
    email: str | None = None
    role: UserRole | None = None
