from fastapi import APIRouter

from app.schemas.system import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def versioned_health() -> HealthResponse:
    return HealthResponse(status="healthy", service="PanelVerse AI API")
