# API integration handoff

The frontend retains demo data for areas without backend routes. Authentication, Dashboard project creation, Character Studio, Story Studio, Comic Editor, and Project Assistant use the API services described below. Endpoint values must be same-host paths beginning with `/`; `VITE_API_BASE_URL` supplies the host.

## Configuration and authentication

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. The Supabase JavaScript client persists and restores the user session. Backend requests attach the current access token in the `Authorization` header; a 401 clears the local session and protected routes return to sign-in. A 403 remains a permission failure and does not sign the user out.

The frontend Supabase key must be the publishable/anon key. Never put `SUPABASE_SECRET_KEY`, a service-role key, provider credentials, or database credentials in Vite variables. RLS-protected direct Supabase queries must use the authenticated user session; never use a privileged client for ordinary user data access.

Signup sends only email and password; it cannot assign a trusted role. `/api/v1/auth/me` supplies the role from backend-verified `app_metadata`. New accounts without an assigned `writer` or `reader` role are routed to Access Pending. An administrator must assign roles through a trusted Supabase administrative workflow.

`ApiError` exposes a safe user-facing message, status, and code. Response payload details are retained for application-level diagnostics; do not render them directly to users. Consumers can use `getErrorMessage` to display a safe message.

## Service boundaries

The Dashboard creates and lists Writer-owned projects through `POST/GET /api/v1/projects`. Character Studio uses `/api/v1/characters` and `/api/v1/characters/projects`. Story Studio uses `GET/POST /api/v1/stories` and `GET/PATCH/DELETE /api/v1/stories/{id}` for Writer-owned project content. The Comic Editor uses `/api/v1/comics` for comic CRUD, child panel endpoints for panel and order changes, and child bubble endpoints for dialogue. Project Assistant uses `GET /api/v1/assistant/projects` and `POST /api/v1/assistant/ask` for authenticated Writers and Readers; the backend scopes retrieval to projects and content visible to the caller. Other universe, community, and marketplace operations continue using their existing demo/local behavior until corresponding backend routes are implemented.

The M5 migration (`backend/supabase/migrations/20261116020000_m5_story_studio.sql`) adds story descriptions, synopsis, main plot, and draft/published state. Readers can query only published stories in published projects through RLS. Story-character associations and AI writing suggestions are not implemented.

The M6 migration (`backend/supabase/migrations/20261116030000_m6_comic_editor.sql`) adds comics, panels, JSON layout, optional image URLs, and speech/thought/narration bubbles. Readers can only select completed comics associated with published stories in published projects. The app does not upload images or generate panel art; panel image URLs must already be accessible to the viewer.

Project Assistant uses bounded keyword matching against saved project records and the existing Adaption text provider. It does not use embeddings or retain chat history. Source references identify the records used for the answer. No matching records produces an explicit insufficient-context answer without calling AI.

## Other demo-only data contracts

The following areas remain demo-only and have not yet been wired to backend routes:

- **User/profile:** `id`, `displayName`, `avatarUrl`, `bio`.
- **Project:** `id`, `title`, `genre`, `status`, `pageCount`, `pageTarget`, `updatedAt`.
- **Story/chapter:** `id`, `projectId`, `title`, `body`, `wordCount`; analysis results should contain typed findings with a severity, title, and explanation.
- **Character:** `id`, `projectId`, `name`, `role`, `traits`, `abilities`, `imageUrl`.
- **Relationship:** `id`, `sourceCharacterId`, `targetCharacterId`, `label`, `strength`.
- **Comic/page:** `id`, `projectId`, `pageNumber`, `width`, `height`, and serializable editor nodes. Asset uploads should return a stable asset ID/URL.
- **Community post:** `id`, `creator`, `title`, `genre`, `coverUrl`, `likeCount`, `isFollowing`.
- **Marketplace listing/application:** listing role, description, budget, status, experience level; application references a listing and applicant.

Use explicit request/response schemas, pagination, and validation rules in the backend contract. Map backend responses to page view models in services or data hooks rather than coupling UI components to transport payloads.

## CORS handoff

The FastAPI backend configures explicit CORS origins, including the local Vite origins, and allows `Authorization` and `Content-Type`. Credentials remain disabled; never use wildcard origins with credentials.
