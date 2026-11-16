from __future__ import annotations

import logging
from collections.abc import Mapping

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.schemas.system import HealthResponse
from app.utils.logging import configure_logging

logger = logging.getLogger(__name__)

HTTP_ERROR_MESSAGES: Mapping[int, tuple[str, str]] = {
    400: ("BAD_REQUEST", "The request could not be processed."),
    401: ("UNAUTHORIZED", "Authentication is required."),
    403: ("FORBIDDEN", "You do not have permission to perform this action."),
    404: ("NOT_FOUND", "The requested resource was not found."),
    405: ("METHOD_NOT_ALLOWED", "This method is not allowed for the requested resource."),
    409: ("CONFLICT", "The request conflicts with the current resource state."),
    429: ("RATE_LIMITED", "Too many requests. Please try again later."),
}


def create_app(settings: Settings | None = None) -> FastAPI:
    application_settings = settings or get_settings()
    configure_logging(application_settings)
    application = FastAPI(
        title="PanelVerse AI API",
        version="1.0.0",
        description="PanelVerse AI backend foundation.",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=application_settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Accept", "Authorization", "Content-Type", "Origin", "X-Requested-With"],
    )

    @application.exception_handler(HTTPException)
    async def handle_http_error(_request: Request, exception: HTTPException) -> JSONResponse:
        code, message = HTTP_ERROR_MESSAGES.get(
            exception.status_code,
            ("HTTP_ERROR", "The request could not be completed."),
        )
        return JSONResponse(
            status_code=exception.status_code,
            content={"error": {"code": code, "message": message}},
            headers=exception.headers,
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request,
        _exception: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error": {"code": "VALIDATION_ERROR", "message": "Request validation failed."}},
        )

    @application.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, exception: Exception) -> JSONResponse:
        logger.error("Unhandled application error (%s)", type(exception).__name__)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An internal server error occurred."}},
        )

    @application.get("/", tags=["system"])
    async def root() -> dict[str, str]:
        return {"service": "PanelVerse AI API", "version": application.version}

    @application.get("/health", response_model=HealthResponse, tags=["system"])
    async def health() -> HealthResponse:
        return HealthResponse(status="healthy", service="PanelVerse AI API")

    application.include_router(api_router, prefix="/api/v1")
    return application


app = create_app()
