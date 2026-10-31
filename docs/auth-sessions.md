# Milestone 5: refresh rotation, logout, and revocable login sessions

For later packages, follow the latest upgrade guide (currently notifications.md).

Login still uses the OAuth2 form (username=email, password). It now creates a
database login session and returns an access JWT plus a CSRF token. Refresh
credentials are opaque secrets in an HttpOnly cookie, not JSON response fields.

## Upgrade without replacing your configuration

Stop the API and back up the database. Copy the files listed in
milestone-5-changes.md into your existing project. Keep your real .env, compose
passwords, database volume, ImageKit credentials, and virtual environment.
No new Python dependencies are required. Migrations 0001–0004 are unchanged.

From backend with your environment activated:
```powershell
python -m alembic upgrade head
python -m alembic current
python -m alembic check
python -m uvicorn app.main:app --reload
```

The revision should be 0005. Stop and check the migration directory/history if
heads still reports 0004; do not regenerate initial migrations or stamp past the
upgrade. Session tables begin empty, preserving business data.

IMPORTANT: everyone must sign in again after deployment. Pre-milestone access
tokens lack the new sid/type/jti claims and are deliberately rejected. There is
no conversion of old bearer tokens into persistent sessions.

## Local settings: match the browser's exact API origin

Merge these settings into your existing backend/.env; do not overwrite secrets:
```dotenv
API_ORIGIN=http://localhost:8000
CORS_ORIGINS=["http://localhost:3000"]
ACCESS_TOKEN_MINUTES=15
REFRESH_SESSION_DAYS=14
REFRESH_COOKIE_SECURE=false
REFRESH_COOKIE_SAMESITE=lax
```

If you open Swagger at http://127.0.0.1:8000/docs, use
API_ORIGIN=http://127.0.0.1:8000 instead. Use one hostname consistently for the
future frontend and API (both localhost or both 127.0.0.1). Different ports are
fine. Browser cookie policy treats localhost and 127.0.0.1 as different sites.

Existing ACCESS_TOKEN_MINUTES values remain effective; changing the code default
to 15 does not override an explicit 30 in your .env. Session lifetime is absolute:
rotations never extend the original 14-day deadline.

HTTPS production settings require REFRESH_COOKIE_SECURE=true. Secure mode uses a
host-only __Host-swappy_refresh cookie with Path=/, Secure, and HttpOnly. Local
HTTP mode uses swappy_refresh with Path=/api/v1/auth and HttpOnly. Neither sets
a Domain attribute. The server accepts only the cookie name for the configured
mode. Do not toggle secure mode on an active deployment as a logout mechanism;
revoke sessions explicitly.

SameSite=None requires Secure=true. An explicitly allowed frontend origin,
credentialed CORS, and CSRF protection are still required. Prefer a same-site
deployment (e.g. app.example.com and api.example.com) or a frontend proxy. Separate
Vercel/Render sites may encounter browser third-party cookie blocking even with
SameSite=None; test the actual mobile browsers when deploying.

Wildcard CORS origins and origins with paths are rejected. API_ORIGIN is an
origin, not /docs or /api/v1. HTTPS API_ORIGIN with an insecure refresh cookie
also fails configuration validation.

## Swagger walkthrough

1. Sign in with Authorize as before. This supplies bearer authorization for
   protected endpoints and stores the refresh cookie in the browser.
2. GET /api/v1/auth/csrf. Copy csrf_token from the response. This does not require
   a valid access token, but it does require the current refresh cookie.
3. POST /api/v1/auth/refresh with that value in the X-CSRF-Token header field.
   The browser sends the HttpOnly cookie automatically.
4. The response contains access_token, token_type, expires_in, csrf_token,
   session_id, and refresh_expires_at. The replacement refresh token is set only
   as a cookie.
5. Swagger does not automatically replace its existing bearer token after this
   call. Use the returned access token for subsequent manual tests, or sign in
   through Authorize again. Authorize again creates a separate login session.
6. POST /api/v1/auth/logout with X-CSRF-Token. Cookie and bearer credentials for
   that login session stop working on subsequent authenticated requests.
7. Sign in again to continue tests.

If login/refresh returns origin_denied, check API_ORIGIN against the Swagger URL.
Browser Origin or Referer is validated; same-origin Fetch Metadata is also
accepted. CLI/Thunder Client/curl requests to protected session endpoints should
explicitly send Origin matching API_ORIGIN. Origin checks are CSRF defenses,
not authentication for non-browser clients.

To test with Thunder Client, enable its cookie jar, POST the normal login form,
and retain the returned CSRF token. Send Origin and X-CSRF-Token when refreshing
or logging out. Do not put refresh credentials in query parameters or logs.

## Endpoints

| Endpoint | Authorization | Behavior |
| --- | --- | --- |
| POST /auth/token | Credentials + trusted source origin | Create an independent login session |
| GET /auth/csrf | Current refresh cookie + trusted source | Read-only CSRF bootstrap after reload |
| POST /auth/refresh | Refresh cookie + CSRF + trusted source | Consume old refresh credential and issue replacement |
| POST /auth/logout | Refresh cookie + CSRF + trusted source | Revoke that session; valid access JWT not required |
| POST /auth/logout-all | Bearer + trusted source | Revoke all of the caller's sessions |
| GET /auth/sessions | Bearer | Paginated list of the caller's active sessions |
| POST /auth/sessions/{id}/revoke | Bearer + trusted source | Revoke one of the caller's sessions |

All paths above begin /api/v1. Session listing accepts limit (1–100) and offset.
It includes timestamps, current-session flag, and the supplied user-agent label,
but no refresh secret or digest. User-agent text is untrusted display data, not
device identity. No IP address is stored by this feature.

Logout-all and session revocation use explicit bearer authorization, so they do
not additionally require the session CSRF header. Cookie-authenticated refresh
and logout do. Missing/invalid CSRF or an untrusted source returns 403 without
consuming tokens or clearing the legitimate cookie.

Unknown/expired/revoked refresh credentials return 401 and clear the unusable
refresh cookie. A missing/already-invalid cookie on logout returns 204. Repeating
logout with a recognized cookie still requires its CSRF token. After self-session
revocation, that bearer no longer authorizes a repeat call; revoke it again using
another active session if needed.

A restricted student can still log in, refresh, view their account, report,
block, and resolve accepted handovers. New exchange/listing permissions remain
enforced by existing business services.

## Rotation, replay, revocation, and transactions

Each login is a separate session family. A refresh credential contains a UUID
selector plus 32 random secret bytes. Only a SHA-256 digest is stored; random
high-entropy tokens do not use password hashing. The selector alone cannot
authorize or revoke anything: the full credential digest must match first.

Refresh locks the user, login session, then credential in that order. It marks
the old credential consumed, explicitly flushes that update, inserts the next
credential, and commits. A partial unique index permits at most one unconsumed
credential per family. Old consumed records remain available for replay checks.

Reusing a consumed credential with valid CSRF revokes the family and its access
tokens, including the newest replacement. Revocation is committed before the
401 error is raised. Other devices' families remain active. Incorrect secrets
for a known selector do not revoke the legitimate family.

Strict reuse detection intentionally has no retry grace period. Two simultaneous
refresh requests using the same old token produce one rotation followed by a
family revocation. A lost successful response followed by an old-token retry
also requires signing in again.

Frontend integration must:
- Keep access JWT and CSRF token in memory.
- Use credentials: "include" or Axios withCredentials: true for cookie endpoints.
- Bootstrap with GET /auth/csrf, then POST /auth/refresh after a page reload.
- Serialize refresh requests, including coordination between browser tabs.
- Never blindly retry a refresh after a network failure.
- Clear client authentication state after logout or a terminal refresh failure.

Every authenticated request now checks the access JWT's session ID and user in
PostgreSQL. A signed token for a missing/revoked/expired family is rejected.
Logout revokes subsequent authenticated requests immediately; operations already
authenticated and in flight may finish. Roles, activity, and participation
restrictions remain database-backed.

Login/session mutations share the existing user-first lock convention, so
refresh cannot revive a family revoked by concurrent logout. Password changes
and recovery flows are not implemented here; they will need session revocation
when added. This app uses an OAuth2-compatible login form, not a general-purpose
OAuth authorization server.

## Cleanup

Run daily from backend using the deployment scheduler:
```powershell
python -m app.jobs.purge_auth_sessions
```

The command removes expired/revoked families after a seven-day retention window,
with database cascade deletion of their refresh history. It does not delete
users, books, exchanges, or moderation records. The command is provided; this
package does not install or activate a scheduler.

Continue to configure authentication/request rate limits and HTTPS before a
public pilot. Refresh rotation is not a substitute for those deployment controls.

## Verification status

Executed here:
- 52 tests passed, including unit tests and database-free HTTP protocol checks.
- Ruff lint and formatting checks passed.
- OpenAPI generated; refresh credentials are absent from response schemas.
- Alembic upgrade/downgrade compiled to PostgreSQL SQL.

Not executed here: 53 PostgreSQL API/integration tests (the prior 36 plus 17
session scenarios). The runtime has no PostgreSQL server. Actual migration,
schema comparison, rotation concurrency, replay revocation, and database
rollback behavior remain unverified until the suite passes locally or in CI.

From a dedicated PostgreSQL test database:
```powershell
$env:TEST_DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest -q
```

The account needs permission to create/drop isolated schemas. Tests cover hashes,
rotation and absolute expiry, replay, wrong-secret protection, CSRF/origin
failure, logout, ownership of sessions, concurrent refresh, logout races,
rollback, deactivated/restricted accounts, cleanup, and legacy-token rejection.

Design references:
- [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html): refresh rotation and replay detection.
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Suggested commit:
feat(auth): add rotating refresh sessions and logout revocation
