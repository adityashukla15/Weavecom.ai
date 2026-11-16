# PanelVerse AI API

FastAPI backend foundation. Python 3.11+ is supported. Provider SDKs and Supabase are configured as optional dependencies; this milestone does not issue AI requests, initialize Supabase at startup, or create database tables.

## Local setup

From `backend/`:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Generate a private development key before starting the application. Do not copy the placeholder from `.env.example`:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Set the generated value as `SECRET_KEY` in the ignored local `.env`. Leave provider credentials blank and `SUPABASE_ENABLED=false` until valid credentials are available.

Start the API with `uvicorn app.main:app --reload`. Health checks are available at `/health` and `/api/v1/health`; the versioned router is mounted at `/api/v1`.

Run tests with `python -m pytest`.

## Configuration

`app.core.config.Settings` reads `backend/.env` and process environment variables. Provider API keys, Supabase credentials, and the database URL are optional when their integrations are disabled. Secret values use Pydantic `SecretStr`, and are never logged by the application.

`CORS_ORIGINS` is a comma-separated list. Development defaults allow the Vite origins `http://localhost:5173` and `http://127.0.0.1:5173`. Production requires explicit HTTPS origins and rejects wildcard origins. Credentials are disabled; the allowed methods and headers support the frontend's JSON and bearer-token requests.

Set production `ENVIRONMENT=production`, `CORS_ORIGINS` to the deployed frontend origin(s), and provide a newly generated `SECRET_KEY` through the deployment secret manager. Never place backend provider or Supabase secret keys in frontend `VITE_` variables.
