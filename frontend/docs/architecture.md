# Architecture

Next.js App Router, React, TypeScript strict and Tailwind v4. Pages compose feature screens. Shared components own repeated visual behavior; features own domain-specific screens, forms and API adapters. Backend types are generated from contracts/openapi.json. Frontend view types and form schemas stay in their feature.

TanStack Query owns server data. URL parameters own shareable discovery filters and pagination. React Hook Form/Zod are installed for Stage 2 forms. Zustand owns only overlays and ephemeral notifications. Do not copy API responses into global stores.

Axios has one browser API client, credentials enabled, a timeout, and normalized domain/FastAPI errors. Public requests use lib/api/client.ts. Stage 2 private requests use features/auth/session.ts with one CSRF-aware session transport and retry orchestration. AuthProvider holds readiness state; TanStack Query owns the current-user response. Client guards do not replace backend authorization. See docs/stage-2.md.

Source audit: backend/app/api/v1/auth.py, dependencies/csrf.py, modules/auth/cookies.py, core/config.py and main.py confirm form login, bearer access tokens, HttpOnly rotating refresh cookie, CSRF header and trusted Origin checks. Default local cookie is SameSite=Lax, path /api/v1/auth. Stage 3 defaults browser requests to same-origin /api/v1. Next rewrites them to server-only API_ORIGIN (127.0.0.1:8000 locally), so localhost:3000 can keep same-site refresh cookies. This replaces earlier direct-API environment guidance; see docs/stage-3.md.

Avoid localStorage/sessionStorage for access and refresh tokens. Stage 2 bootstraps CSRF then rotates refresh, retains access in memory, deduplicates refresh requests and clears cached private data on identity change. Web Locks coordinate cookie mutations across tabs because backend refresh tokens rotate.

HTTP chat operations are present. No WebSocket route was found in the supplied router files. Do not invent a transport.

The supplied OpenAPI contract was compared to decorated backend HTTP routes: 90 operations match. Permission details still require endpoint/service inspection as each feature is implemented. Schema updates must be re-exported after backend changes.

Stage 3 requires the server-controlled is_admin field on UserResponse, with separate guarded student and admin layouts. Administrator navigation never depends on student campus enrollment. The frontend fails closed if role information is missing. Role UI routing is not a replacement for backend AdminUser dependencies.

Stage 4 adds centralized exchange types/policies/API adapters, participant views and photo previews. Photo removal has a durable database cleanup queue (0013) and retry worker; owned-book exclusion is performed before catalog pagination in the backend. The API contract was refreshed from the actual FastAPI source.

Stage 5 adds HTTP chat, role-aware notifications, completed-exchange reviews, reader reputation, blocking and own reports. Shared ImagePicker owns transient File/object-URL state and releases previews after success/removal/unmount. ProtectedImagePreview fetches private proof through bearer transport and does not put protected blobs into the query cache. The account route group selects the existing role-specific shell for notifications; student-only routes retain their role guard. Chat send attempts retain the same client UUID/body on uncertain retries. Notification read-all sends the newest visible ID as a watermark.
