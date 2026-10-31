# Swappy — campus book exchange

FastAPI backend for verified campus book exchanges. Milestones 1–12 cover onboarding, listings and ImageKit photos, exchanges, moderation, revocable login sessions, persistent notifications, exchange chat, exchange reviews/reputation, profiles with avatar/account settings, genre-based recommendations, opt-in visitor previews, and audited college/campus administration. The mobile frontend is not included yet.

## Run locally

Requires Python 3.12+, Docker Compose, and Git. Run the commands from the project root unless a step changes directory.

1. Copy `.env.example` to `.env` and set a local database password.
2. Run `docker compose up -d db`.
3. Open `backend/`, create a virtual environment, and activate it:

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.lock
Copy-Item .env.example .env
```

On Linux/macOS use `python3 -m venv .venv`, `source .venv/bin/activate`, and `cp .env.example .env`.

4. Edit `backend/.env`: match `DATABASE_URL` to your Docker password. URL-encode special characters in the URL password. Generate `JWT_SECRET` with `python -c "import secrets; print(secrets.token_urlsafe(48))"` and replace the example value. Do not commit either `.env` file.
5. Apply migrations and start the API:

```sh
alembic upgrade head
python -m app.cli add-campus --college "Your College" --campus "Main Campus" --city "Your City"
uvicorn app.main:create_app --factory --reload
```

Open http://localhost:8000/docs. Register an account, then use **Authorize** with email in the username field. Complete the profile using a campus ID returned by `GET /api/v1/campuses`.

To grant a separately registered reviewer access, run this trusted operator command from `backend/`:

```sh
python -m app.cli promote-reviewer --email reviewer@example.com
```

There is no public role-selection or admin-promotion endpoint. Reviewers cannot approve their own submissions. To review proof: list submissions, download the document through the reviewer-only endpoint, and submit a decision. Approval requires an explicit future enrollment-expiration timestamp. Rejection requires a reason.

## Implemented access rules

| State | Campus browsing | Exchange eligibility |
| --- | --- | --- |
| Signed in, profile incomplete | Denied | Denied |
| Profile complete, proof absent/pending/rejected | Selected campus only | Denied |
| Active approved membership, unexpired | Selected campus only | Eligible subject to listing/exchange policies |
| Campus changed | New selected campus | Requires fresh approval |

`GET /api/v1/membership/eligibility` reports membership eligibility, not a complete authorization decision. Listing/exchange services additionally check participation restrictions, blocks, ownership, availability, and campus under transaction locks.

Verified students can publish books with ImageKit photos and exchange them within their campus. See the milestone guides for lifecycle rules and upgrade instructions.

## Project layout

- `backend/app/api/`: versioned routers and request dependencies.
- `backend/app/modules/`: feature models, input/output schemas, policies, and services.
- `backend/app/core/`: configuration, credential handling, and domain errors.
- `backend/app/db/`: metadata and async session factory.
- `backend/app/jobs/`: scheduled entry points calling services.
- `backend/migrations/`: explicit Alembic migrations.
- `backend/tests/`: policy/security tests and PostgreSQL-backed API tests.
- `docs/`: frozen requirements, architecture notes, and verification results.

Directory-dependent mutations acquire the shared directory transaction barrier before user/entity locks; admin directory writes acquire it exclusively first. Services control commits. Dependencies close sessions, rolling back uncommitted work. Query helpers never commit. Services reuse the transaction already started by authentication queries. Membership/profile writes lock the user first, then the membership, and recheck current state. Approval targets a submission UUID, preventing an outdated review from verifying a replacement submission.

Response schemas explicitly allow public fields. A separate presenter is unnecessary for these simple responses; add one when mapping becomes complex. Verification-document columns are deferred and never part of public response schemas.

## Tests

From `backend/`:

```sh
ruff check .
ruff format --check .
pytest tests/unit -q
```

API tests require a **dedicated PostgreSQL test database**. They create and delete randomly named test schemas; do not use production credentials. Create the database once, then set the URL:

```powershell
# Run from the root (or adjust compose path):
docker compose exec db createdb -U swappy swappy_test
# From backend/:
$env:TEST_DATABASE_URL="postgresql+asyncpg://swappy:YOUR_PASSWORD@localhost:5432/swappy_test"
pytest -q
```

Linux/macOS: `export TEST_DATABASE_URL='postgresql+asyncpg://swappy:YOUR_PASSWORD@localhost:5432/swappy_test'`.

Without `TEST_DATABASE_URL`, PostgreSQL API/integration tests are explicitly skipped. CI supplies PostgreSQL and runs migrations, schema-drift detection, the full suite, and downgrade/upgrade checks. Its configuration is included; a hosted CI run has not happened yet.

## Student proof: development storage

This milestone accepts JPEG/PNG proof up to 5 MiB, validates image content and dimensions, and stores it in a private PostgreSQL binary column. PDF support is deferred. ImageKit will hold book photos; verification proof never uses public image delivery.

Evidence is available only through the authenticated reviewer download endpoint, with no-store and attachment headers. Evidence is deleted immediately after review or campus change. Unreviewed evidence expires after seven days. Schedule `python -m app.jobs.purge_verification_documents` daily; expired proof is unavailable even if cleanup is delayed. Retention periods are initial operational defaults, not a legal compliance assessment. Database backups also need an explicit deletion/retention policy.

Before a real student pilot: move proof to an approved private object-storage adapter if needed, set infrastructure encryption/access controls, configure the cleanup scheduler, and document the review criteria. A seven-day expiration does not itself schedule cleanup.

## Current backend milestones

1. Signup/login, campus profiles, and manually verified membership.
2. Book listings, campus browsing, and validated ImageKit photos.
3. Two-book proposals, reservations, mutual completion, six-day expiration, and
   administrator-assisted handover resolution.
4. General reports, personal blocking, and reversible administrator moderation.
5. Rotating HttpOnly refresh credentials, CSRF protection, logout, and session revocation.
6. Persistent notifications, read state, and transactional workflow events.
7. Persisted exchange chat, lifecycle/block guards, unread counts and read receipts.
8. Completed-exchange reviews, delayed publication, audited review visibility and trust scores.
9. Combined public profiles, bio/interests, built-in avatars, password changes and guarded deactivation.
10. Required listing genres and up to five eligible genre/recency book recommendations.
11. Anonymous preview of up to 100 opted-in books, with search inside that shared pool.
12. Admin college/campus directory creation, label correction and password-confirmed availability changes.

For the latest implementation, upgrade steps, and validation limits, read
[docs/directory-administration.md](docs/directory-administration.md). The latest changed-file list is
[docs/milestone-12-changes.md](docs/milestone-12-changes.md).
[docs/auth-sessions.md](docs/auth-sessions.md) covers browser sessions.
[docs/exchanges.md](docs/exchanges.md) describes the exchange lifecycle.

## Remaining work

1. Backend readiness: full PostgreSQL validation, migrations, job scheduling and API contracts.
2. Mobile-first Next.js UI, generated API types, notification/toast provider, and browser sessions.
3. Deployment and complete phone journeys. Frontend journeys can be integrated incrementally.
4. Real-time WebSocket delivery as an enhancement to persisted HTTP chat.

Before public launch, configure HTTPS, login/upload rate limits, and total request-body limits, and implement account recovery and email ownership verification. Access tokens now default to 15 minutes (existing environment overrides remain effective), refresh sessions to an absolute 14 days. See the session guide for secure-cookie settings, CSRF, and frontend refresh coordination. Older milestone bearer tokens require signing in again.

## Repository backup

No remote repository has been created or pushed by this handoff. The ZIP excludes Git history. After extracting it, initialize your own repository if necessary, connect a private remote, and back up your work. Never add credentials or student documents.

## Book listing milestone

See [docs/book-listings.md](docs/book-listings.md) for upgrade steps, ImageKit configuration, API usage, and validation limits.

Latest milestone: [directory administration](docs/directory-administration.md), [changed files](docs/milestone-12-changes.md). Existing listings stay private until owner opt-in. New book create/edit requests require a catalog genre ID. Schedule `python -m app.jobs.publish_reviews` every five minutes. Next: backend readiness before the mobile frontend.

## Backend readiness (milestone 13)

Feature development through campus administration is implemented. Acceptance remains pending until the strict PostgreSQL suite passes with no skips. Follow [the readiness guide](docs/backend-readiness.md) for a separate disposable PostgreSQL 18 database, migration-backed API tests, rollback rehearsal, CI evidence and remaining public-launch requirements. See [changed files](docs/milestone-13-changes.md). The migration head is still `0012`; this update adds acceptance infrastructure rather than a database revision.
