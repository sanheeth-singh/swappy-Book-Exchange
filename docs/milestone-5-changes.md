# Milestone 5 file changes

Compared with swappy-reports-blocking.zip. Paths are relative to swappy/.

## Added

- `backend/app/api/dependencies/csrf.py`
- `backend/app/jobs/purge_auth_sessions.py`
- `backend/app/modules/auth/__init__.py`
- `backend/app/modules/auth/cookies.py`
- `backend/app/modules/auth/errors.py`
- `backend/app/modules/auth/models.py`
- `backend/app/modules/auth/schemas.py`
- `backend/app/modules/auth/service.py`
- `backend/app/modules/auth/tokens.py`
- `backend/migrations/versions/0005_auth_sessions.py`
- `backend/tests/api/test_auth_sessions.py`
- `backend/tests/unit/test_auth_sessions.py`
- `docs/auth-sessions.md`
- `docs/milestone-5-changes.md`

## Updated

- `README.md`
- `backend/.env.example`
- `backend/app/api/dependencies/authentication.py`
- `backend/app/api/v1/auth.py`
- `backend/app/core/config.py`
- `backend/app/core/security.py`
- `backend/app/db/models.py`
- `backend/app/main.py`
- `backend/app/modules/users/schemas.py`
- `backend/tests/conftest.py`
- `backend/tests/unit/test_security.py`
- `docs/moderation.md`
- `docs/scope.md`

## Purpose and application

- auth module: persistent login sessions, hashed refresh credentials, CSRF token
  binding, cookie policy, protocol schemas, session errors, and transaction services.
- auth router: login plus refresh, CSRF bootstrap, logout, logout-all, session list,
  and individual revocation.
- authentication dependency: access JWT plus live database session/user validation.
- csrf dependency: trusted Origin/Referer/Fetch Metadata checks for session endpoints.
- security.py: typed access claims, sid/type/jti, and session-capped JWT expiry.
- config.py and backend/.env.example: explicit origins and cookie/session settings.
- main.py: credentialed CORS, CSRF header allowance, and failed-session cookie cleanup.
- users/schemas.py: token response moved into auth/schemas.py; user schemas remain here.
- db/models.py: register new auth models for migration metadata.
- migration 0005: login_sessions and refresh_credentials with single-current-token
  constraint and cascade cleanup; no business tables are rewritten.
- cleanup job: daily expired/revoked-family retention command.
- tests: unit/HTTP protocol checks and PostgreSQL rotation/replay/concurrency cases.
- README/docs: current scope, upgrade steps, browser/CLI walkthrough, and limitations.

Copy the added/updated source and documentation. Merge the new example settings
into your own environment file; never overwrite database credentials, JWT_SECRET,
or ImageKit keys. No new dependencies are required. Keep migrations 0001–0004.
Run alembic upgrade head, check revision 0005, restart the API, and sign in again.
The new session-bound token format deliberately rejects pre-milestone bearer tokens.
