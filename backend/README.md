# PanelVerse AI API

FastAPI backend foundation. Python 3.11+ is supported. Provider SDKs and Supabase are configured as optional dependencies. The app does not initialize Supabase at startup; the initial database schema is provided as a separately applied SQL migration.

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

## AI provider foundation

Adaption text generation uses the Responses API and validates writing-assistance JSON against Pydantic schemas. Gemini image generation uses `google-genai` with image-only response modalities. Both clients use bounded retries for transient errors and return sanitized provider errors; they never log API keys or provider response bodies.

The configured Adaption model is checked against the account's model catalogue at setup. Gemini image model names are configurable with `GEMINI_IMAGE_MODEL`; the source default is `gemini-3.1-flash-image`. The local `.env` is not overwritten by updates to `.env.example`, so update its model value explicitly if it still names an unsupported model.

AI provider services are not exposed as public routes yet. Route integration is deferred until authentication and authorization are in place, to prevent unauthenticated callers from consuming provider quota.

## Authentication checkpoint

The versioned `GET /api/v1/auth/me` endpoint verifies a bearer access token with Supabase Auth using the Supabase Python SDK's `auth.get_user(token)` method. The client is created lazily on the first authenticated request and cached for the FastAPI app process. Missing/invalid credentials return 401; disabled/unavailable Supabase Auth returns a sanitized service error.

The frontend uses Supabase Auth directly for email/password signup, sign-in, session restoration, and sign-out; FastAPI exposes the verified profile at `GET /api/v1/auth/me`, not separate password endpoints. The optional `role` returned by that endpoint is read only from trusted Supabase `app_metadata`, never client-editable `user_metadata`. The current frontend and content APIs do not require a role.

Do not add a user-controlled role assignment. Content access is based on the verified Supabase user ID and project ownership; unauthenticated requests remain rejected.

## Database schema and row-level security

The initial M3 schema is in `supabase/migrations/20261116000000_m3_project_content.sql`. It creates:

- `profiles`, linked to `auth.users`.
- `projects`, owned by a Writer and draft or published.
- `stories` and `chapters`, owned transitively through their project.
- `characters`, owned transitively through their project.

The Character Studio extension is in `supabase/migrations/20261116010000_m4_character_studio.sql`. It adds description, personality, appearance, background, and a constrained protagonist/antagonist/supporting role to the existing `characters` table without replacing its existing fields or RLS policies.

The initial M3-M6 migrations contain the original role-based RLS policies. After applying them in order, also apply `supabase/migrations/20261117000000_user_based_auth.sql`. This additive migration removes role checks from content policies without changing tables or grants: authenticated users can read and modify their own projects and associated content; any authenticated user can read published projects and their published content. Project creation and updates require `owner_id = auth.uid()`, so clients cannot assign or transfer ownership. All policies remain enabled, and database access continues through the caller-token Supabase client.

For a database that already has M3-M6 applied, review and run the additive migration in the Supabase Dashboard SQL Editor against the intended development project. Do not apply it to production before reviewing and backing up the project. It assumes the existing M3-M6 policy names and does not apply the earlier schema migrations.

`SUPABASE_ENABLED=true` continues to require `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, but does not require `DATABASE_URL`; direct PostgreSQL connectivity is not used. Configure `SUPABASE_PUBLISHABLE_KEY` when a backend data route needs to query PostgREST. The server-key client is reserved for Auth token verification. Database requests must use `create_user_scoped_supabase_client(...)`, which uses the publishable key and caller's bearer token so Postgres evaluates the RLS policies. Never use a service-role key for project/content queries, and never expose server keys to the frontend.

Automated ownership tests exercise backend authorization guards with mocks. They do not execute PostgreSQL policies. Apply the additive migration to a non-production Supabase project and verify that users can write only their own content while authenticated users can read published content.

## Character Studio API

After applying M3, M4, and the user-based authorization migration, authenticated users can use `GET /api/v1/characters/projects` to select their own projects and `GET/POST /api/v1/characters`, `GET/PATCH/DELETE /api/v1/characters/{id}` to manage their characters. Every request is verified with Supabase Auth and uses the caller's access token against PostgREST so RLS remains active. Project IDs are checked against the authenticated user; owner IDs are never accepted as character fields.

The frontend Character Studio uses these routes and persists data in Supabase. It requires a project owned by the authenticated user; see the Project API below for project creation.

## Project API

Authenticated users can create projects with `POST /api/v1/projects` and list their saved projects with `GET /api/v1/projects`. The API assigns `owner_id` from the verified caller and uses the caller-token Supabase client, so project RLS remains active. This API backs the frontend Dashboard and does not permit client-selected owners.

## Story Studio API

Apply `supabase/migrations/20261116020000_m5_story_studio.sql` after the M3 schema migration. It extends the existing `stories` table with description, synopsis, main plot, and draft/published status. Apply the user-based authorization migration afterward to let owners access their stories and chapters and to keep published-content reads available to other authenticated users.

Authenticated users can use `GET/POST /api/v1/stories` and `GET/PATCH/DELETE /api/v1/stories/{id}` for their own projects. Create and update operations verify project ownership; the API does not accept a user or owner ID. Requests use the authenticated caller's token and publishable-key Supabase client, so RLS remains active. A story's position is assigned from the next available `sort_order` within its project to respect the existing uniqueness constraint.

The Story Studio frontend supports project selection and persisted story CRUD. Story-character associations are not supported by the current schema, and AI synopsis/plot suggestions are not wired into this milestone. Tests use a mocked PostgREST client; they do not prove live RLS behavior or database persistence.

## Comic Editor API

Apply `supabase/migrations/20261116030000_m6_comic_editor.sql` after the M3, M4, and M5 migrations. It adds `comics`, `comic_panels`, and `comic_speech_bubbles`, with cascade deletion from story to comic to panels to dialogue. `layout` is JSONB for page layout settings; panel image URLs are optional.

Authenticated users can create/list/read/update/delete comics at `/api/v1/comics`, manage panels at `/api/v1/comics/{comic_id}/panels`, reorder panels at `/api/v1/comics/{comic_id}/panels/reorder`, and manage dialogue at `/api/v1/comics/{comic_id}/panels/{panel_id}/bubbles` for their own stories/projects. Every operation verifies ownership and uses the caller's token so RLS stays in force. Other authenticated users may select completed comics for published stories in published projects.

The Comic Editor persists comic metadata, panels, layout/order, image URLs, and bubble text/type/position. No upload/storage integration exists yet, so provide externally managed image URLs only. AI generation is intentionally not present. Automated API tests mock PostgREST and do not verify live database policies or persistence.

## Project Assistant API

`GET /api/v1/assistant/projects` lists projects owned by the user and published projects. `POST /api/v1/assistant/ask` accepts `project_id` and a question, verifies project access using the caller-token Supabase client, then performs bounded keyword retrieval over saved stories, characters, and completed comics/panels/dialogue in that project. Owners can retrieve their draft content; other users only receive content permitted by the published-content RLS policies. The question endpoint returns an answer and up to six source references. If no relevant records match, it returns an explicit insufficient-context response without calling the provider.

The answer uses the existing Adaption Responses client and prompts it to answer only from the retrieved records. Provider errors are returned through the existing sanitized service-error handler. Non-owners see only published stories and completed comics; project RLS and the existing content RLS policies remain authoritative. Tests mock both Supabase PostgREST and the provider; they do not verify live data access or make real AI calls.

Provider documentation:

- [Adaption Responses API](https://docs.adaptionlabs.ai/api/resources/responses)
- [Adaption model catalogue](https://docs.adaptionlabs.ai/api/resources/models)
- [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)

## Configuration

`app.core.config.Settings` reads `backend/.env` and process environment variables. Provider API keys, Supabase credentials, and the database URL are optional when their integrations are disabled. Secret values use Pydantic `SecretStr`, and are never logged by the application.

`CORS_ORIGINS` is a comma-separated list. Development defaults allow the Vite origins `http://localhost:5173` and `http://127.0.0.1:5173`. Production requires explicit HTTPS origins and rejects wildcard origins. Credentials are disabled; the allowed methods and headers support the frontend's JSON and bearer-token requests.

Set production `ENVIRONMENT=production`, `CORS_ORIGINS` to the deployed frontend origin(s), and provide a newly generated `SECRET_KEY` through the deployment secret manager. Never place backend provider or Supabase secret keys in frontend `VITE_` variables.
