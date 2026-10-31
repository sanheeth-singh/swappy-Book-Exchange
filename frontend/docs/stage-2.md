# Stage 2 — Access, profile setup and verification

## Delivered

- /register: validated email/password form, backend registration, explicit sign-in after creation.
- /login: OAuth2 form encoding (username=email), memory-only bearer access, HttpOnly refresh cookie owned by backend.
- Session restoration: CSRF bootstrap then rotating refresh, credentials enabled, shared refresh promise, early refresh before expiry, one retry after an unauthorized bearer request. Mutations are never retried after generic network/server failures.
- Web Locks coordinate login, refresh and logout cookie operations across tabs on the same frontend origin. BroadcastChannel clears other tabs' cached identity after login/logout; reload or sign in to recover the shared cookie session in those tabs. A late refresh cannot reinstate a locally cleared session.
- Backend remains the authorization authority. The client guard prevents rendering private screens until /users/me resolves; no private user data is rendered into static HTML.
- /profile: name/campus setup, active campus search with pagination and stable selection, confirmation before changing a campus. Backend rejects changes with unresolved accepted exchanges and resets verification/archives listings when campus changes.
- /membership: current status/review reason/expiry, manual refresh, server eligibility check, JPEG/PNG multipart proof upload, 5 MiB client size/type checks. Backend independently validates file contents and dimensions. PDFs are not supported by this backend.
- Header login/profile/logout actions and mobile navigation to implemented routes only. Catalog/exchanges entries will replace the temporary member navigation in Stage 3/4.
- Slider fix: onInput updates while dragging, onChange compatibility, independent increase/decrease buttons, bounded responsive input. Rendered DOM test verifies both the slider event and buttons change visible metrics.

## API inventory

12 operations integrated including the existing public preview. The /colleges endpoint is intentionally unused because /campuses already includes college names; it remains inventoried. 75 operations remain planned and /health remains operational. Session listing/revocation/logout-all, extended profile editing/avatars and administration are later-stage workflows, not claimed here.

## Environment

Use http://127.0.0.1:3000 and NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1. The backend must allow that frontend origin and credentials. Do not mix localhost and 127.0.0.1. Modern secure-context Web Locks are required for session cookie coordination; unsupported browsers receive a clear session error. In deployment use HTTPS and configure cookie/CORS policy deliberately.

Tokens and proof images are never persisted in browser storage. Query caches are cleared on identity changes. The backend's secure cookies and CSRF headers are used rather than exposing refresh credentials to JavaScript.

## Local acceptance walkthrough

1. Visit /register, create an account and sign in at /login. Invalid credentials should remain in the form with an error.
2. At /profile save a name and an active campus; then go to /membership.
3. Upload a JPEG/PNG enrollment image. Check pending state and the backend review workflow. Refresh status after approval or rejection.
4. Reload the page: the session should restore via the refresh cookie. Sign out and confirm private screens redirect to login. Offline logout should display an error rather than claim success.
5. Open two tabs. Verify rotating refresh requests do not race. Signing out in one clears the other's UI; an identity change in one clears stale private data in the other.
6. Drag the homepage slider and use its plus/minus buttons. The displayed handover count must be twice the exchange count.

## Next stage

Stage 3: campus catalog, book details, genres/recommendations, My Books and physical collection, create/edit/archive listings, public-preview consent and photo uploads. Replace Explore in member navigation with the private campus Discover route while keeping public /explore intact.
