from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.assistant import router as assistant_router
from app.api.v1.endpoints.characters import router as characters_router
from app.api.v1.endpoints.comics import router as comics_router
from app.api.v1.endpoints.projects import router as projects_router
from app.api.v1.endpoints.system import router as system_router
from app.api.v1.endpoints.stories import router as stories_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(assistant_router)
api_router.include_router(characters_router)
api_router.include_router(stories_router)
api_router.include_router(comics_router)
api_router.include_router(projects_router)
api_router.include_router(system_router)
