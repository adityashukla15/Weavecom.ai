import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "secret_key": "test-secret-key-material-with-more-than-32-characters",
        "environment": "testing",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_health_endpoint_returns_service_status() -> None:
    client = TestClient(create_app(make_settings()))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "PanelVerse AI API"}


def test_versioned_health_endpoint_returns_service_status() -> None:
    client = TestClient(create_app(make_settings()))

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "PanelVerse AI API"}


def test_allowed_origin_receives_cors_headers() -> None:
    client = TestClient(create_app(make_settings()))

    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-credentials" not in response.headers


def test_disallowed_origin_is_not_allowed() -> None:
    client = TestClient(create_app(make_settings()))

    response = client.get("/health", headers={"Origin": "https://untrusted.example"})

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_preflight_allows_authorization_and_content_type() -> None:
    client = TestClient(create_app(make_settings()))

    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    assert "authorization" in response.headers["access-control-allow-headers"].lower()
    assert "content-type" in response.headers["access-control-allow-headers"].lower()


def test_configuration_does_not_require_optional_provider_keys() -> None:
    settings = make_settings()

    assert settings.adaption_api_key is None
    assert settings.gemini_api_key is None
    assert settings.supabase_enabled is False


def test_gemini_image_model_default_is_account_supported_image_model() -> None:
    settings = make_settings()

    assert settings.gemini_image_model == "gemini-3.1-flash-image"


def test_enabled_supabase_configuration_does_not_require_publishable_key() -> None:
    settings = make_settings(
        supabase_enabled=True,
        supabase_url="https://project.supabase.co",
        supabase_secret_key="server-secret",
    )

    assert settings.supabase_enabled is True
    assert settings.supabase_publishable_key is None
    assert settings.supabase_secret_key is not None


@pytest.mark.parametrize("missing_credential", ["supabase_url", "supabase_secret_key"])
def test_enabled_supabase_configuration_requires_url_and_secret(
    missing_credential: str,
) -> None:
    values: dict[str, object] = {
        "supabase_enabled": True,
        "supabase_url": "https://project.supabase.co",
        "supabase_secret_key": "server-secret",
    }
    values[missing_credential] = None

    with pytest.raises(ValueError, match="SUPABASE_ENABLED requires SUPABASE_URL and SUPABASE_SECRET_KEY"):
        make_settings(**values)


def test_secrets_are_redacted_from_settings_representation() -> None:
    settings = make_settings(
        adaption_api_key="adaption-test-secret",
        gemini_api_key="gemini-test-secret",
        supabase_secret_key="supabase-test-secret",
    )

    rendered = repr(settings)

    assert "adaption-test-secret" not in rendered
    assert "gemini-test-secret" not in rendered
    assert "supabase-test-secret" not in rendered


def test_production_requires_explicit_https_cors_origins() -> None:
    try:
        make_settings(environment="production")
    except ValueError as error:
        assert "CORS_ORIGINS" in str(error)
    else:
        raise AssertionError("Production settings must require explicit CORS origins.")
