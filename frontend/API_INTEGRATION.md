# API integration handoff

The current frontend remains demo-data driven. API services are a transport-ready boundary only; they do not assume that any backend route exists. Each service receives the endpoint path selected with the backend team, for example `projectService.list('/<agreed-project-list-route>')`. Endpoint values must be same-host paths beginning with `/`; `VITE_API_BASE_URL` supplies the host.

## Configuration and authentication

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the API origin. The API client validates HTTP(S) URLs, sends JSON by default, uses a 15-second timeout, omits cookies, and never persists tokens. When a future authentication flow supplies a short-lived access token, pass it with `setAccessToken`; call `clearAccessToken` on sign-out. Do not put private keys, Supabase service-role credentials, or other server secrets in Vite environment variables.

`ApiError` exposes a safe user-facing message, status, and code. Response payload details are retained for application-level diagnostics; do not render them directly to users. Consumers can use `getErrorMessage` to display a safe message.

## Service boundaries

The service modules cover auth/profile, projects, stories and character extraction, universe data and canon checks, comic save/export/uploads/generation, community interactions, and marketplace listings/applications. They accept endpoint paths rather than inventing backend routes. UI pages continue to use local demo data until a backend contract is implemented.

## Suggested data contracts

Finalize these schemas and route paths alongside the FastAPI models before wiring services. Example payloads below describe frontend needs, not existing backend behavior:

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

The repository's `backend/` directory is currently empty. No FastAPI application, settings, middleware, or test suite was found, so no backend files were created or modified. When the actual backend is added to this workspace, configure `CORSMiddleware` from environment-sourced explicit origins (including the local Vite origins) and add allowed methods/headers including `Authorization` and `Content-Type`. Keep credentials disabled unless the chosen authentication flow requires cookies; never use wildcard origins with credentials.
