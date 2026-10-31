# Milestone 3: proposals, reservations, handover, and completion

This milestone builds on book listings. It adds backend APIs and a scheduler
entry point, not frontend screens or chat. For later packages, follow the newest
upgrade guide (currently moderation.md); the 0003 steps below describe this
milestone's original handoff.

## Apply the update (PowerShell)

Stop the API. Keep your existing .env, virtual environment, compose passwords,
and PostgreSQL volume. Back up the database before applying the schema change.

Copy the added/changed files listed in milestone-3-changes.md into your existing
project. Migration 0003 must be present alongside your existing 0001 and 0002.
Do not generate a new initial migration, delete old migrations, stamp past the
upgrade, or recreate the database.

From backend, with your virtual environment active:

```powershell
python -m pip install -r requirements-dev.lock
python -m pip install -e .
python -m alembic heads
python -m alembic upgrade head
python -m alembic current
python -m alembic check
python -m uvicorn app.main:app --reload
```

Both heads and current should report 0003 after upgrading. No new environment
variables or dependencies are required beyond the listing milestone.
If heads still reports 0001/0002, the migration files have not been copied into
the backend directory Alembic is using. Resolve that before starting the API.
If your own migration IDs differ, inspect the existing history rather than
editing down_revision or stamping blindly.

The upgrade creates one physical book per existing listing, preserving listing
IDs, owners, photos, and ImageKit URLs. Existing listing IDs double as the initial
physical book IDs in the new table only. Upgrade atomicity uses PostgreSQL's
transactional DDL. The populated-database upgrade test is provided but has not
been executed here.

Do not downgrade after real handovers: the downgrade removes exchange/ownership
history. Restore an appropriate database backup if a deployed rollout must be
reversed.

## API walkthrough

Use two approved, active students from the same campus, each with a live listing.

1. Requester: POST /api/v1/exchanges
   {"requested_listing_id":"OWNER_LISTING_UUID",
    "offered_listing_id":"REQUESTER_LISTING_UUID"}
2. Requester: GET /api/v1/exchanges/sent.
   Owner: GET /api/v1/exchanges/received.
3. Owner: POST /api/v1/exchanges/{id}/accept.
4. Both students arrange the handover independently; chat is a later milestone.
5. Each student, only AFTER receiving the other book:
   POST /api/v1/exchanges/{id}/confirm.
6. First confirmation returns WAITING_CONFIRMATION.
   Second returns COMPLETED, transfers both physical books, archives both original
   listings, and removes both reservations.
7. GET /api/v1/books/collection returns the caller's current physical books.
   To offer a received book, POST /api/v1/books with normal listing fields plus
   its physical_book_id. Omit physical_book_id only when adding a new copy.
   Relisting starts with no photos; upload new ones normally.

GET /api/v1/books/me remains the history of listings you originally published,
including archived ones. It is not the current physical collection.
Listings retain their original owner_id. Their physical_book_id identifies the
copy whose current owner can change. Book responses now include is_reserved.
Exchange snapshots capture listing/participant details at proposal time and do
not change with later profile edits, relisting, or ownership transfers.

Additional actions:
- Owner: POST /api/v1/exchanges/{id}/reject, PENDING only.
- Requester: POST /api/v1/exchanges/{id}/cancel, PENDING.
- Either participant: /cancel while ACCEPTED, before either receipt confirmation.
- Participants: GET /api/v1/exchanges/{id}, even after membership expiry or campus
  change. Private exchange history is never exposed through other-campus browsing.

## Enforced rules

- Both students must have active, verified, unexpired memberships in the listing
  campus when proposing and when accepting.
- Different participants, different physical books, and correct current ownership
  are required. Archived or reserved listings cannot be proposed or accepted.
- Pending proposals do not reserve books; the same book can have multiple offers.
- Duplicate active pairs are rejected, including reversed requester/owner pairs.
- Acceptance reserves both physical copies and rejects every conflicting pending
  proposal in one transaction.
- Each physical copy has at most one reservation (database primary key) and one
  live listing (partial unique index). A second partial unique index protects
  active proposal pairs.
- Editing a listing, adding a photo, or archiving a listing invalidates its pending
  proposals as REJECTED. This prevents accepting an offer with stale condition or
  photo information.
- Reserved listings cannot be edited, archived, or given additional photos.
- Self-service campus changes are blocked during ACCEPTED/WAITING_CONFIRMATION.
  Other campus changes archive old listings and invalidate pending proposals.
- Receipt confirmation is repeatable without a second ownership transfer.
- Expired membership does not block withdrawals, reporting an existing handover
  issue, or confirming an already accepted handover. Disabled accounts require
  administrator assistance.

Services lock participant user rows in UUID order, listing rows in UUID order,
then physical book rows in UUID order, then the exchange. Profile and membership
services use the same participant user lock. Services commit; query helpers do
not. Locking makes conflicting actions serialize; database constraints provide
an additional integrity boundary. PostgreSQL concurrency tests remain required.

## Six-day expiry

Run this command every five minutes with your deployment scheduler or Windows
Task Scheduler, using the backend working directory and its Python environment:

```powershell
python -m app.jobs.expire_exchanges
```

Only ACCEPTED exchanges with zero confirmations expire after six days. The job
rechecks each exchange under the same locks as the API, releases reservations,
and marks EXPIRED. WAITING_CONFIRMATION never automatically expires.
The command exists; no scheduler is installed or activated by this package.

GET requests do not mutate statuses. A due exchange may display ACCEPTED until
the next scheduled run. An otherwise permitted mutation checks the deadline
under lock and may return EXPIRED instead of performing the requested action.
Clients must inspect the returned status. Listings may remain reserved until
that transition or the next scheduled job. Rejected competing proposals are not
automatically revived after cancellation or expiry.

## Handover issues and administrator resolution

A participant can POST /api/v1/exchanges/{id}/issues with:
{"explanation":"Describe the unresolved handover issue."}

Issues are available immediately on ACCEPTED or WAITING_CONFIRMATION, with one
open issue per participant/exchange. An open issue freezes further receipt
confirmation. It does not automatically cancel the exchange or transfer books.
Cancellation and deadline expiry still apply before any confirmation.

Participants can GET /api/v1/exchanges/{id}/issues.
Administrators use:
- GET /api/v1/exchanges/admin/issues
- GET /api/v1/exchanges/admin/{id}
- POST /api/v1/exchanges/{id}/resolve with
  {"decision":"CANCEL","reason":"Both books have been returned to their original owners."}
  or {"decision":"COMPLETE","reason":"Both students confirmed receipt to support."}

CANCEL releases reservations without changing physical ownership. Use it only
after resolving real-world possession. COMPLETE performs the same atomic transfer
and archival as mutual confirmation; confirmation flags are finalized as part
of the administrator decision. resolved_by, resolved_at, and resolution_reason
make the override explicit. Participants who are administrators cannot resolve
their own exchanges. Terminal transitions resolve associated open issues.

This is a minimal handover support mechanism, not general listing/user reporting,
blocking, notifications, or a full moderation dashboard. General reporting and
blocking remain planned before a real student pilot, alongside refresh-token
rotation/logout before frontend integration.

## Validation and remaining checks

Executed here:
- 30 unit tests passed.
- Ruff lint and formatting checks passed.
- OpenAPI generated successfully.
- Alembic upgrade/downgrade compiled to PostgreSQL SQL.

Not executed here:
- 21 PostgreSQL tests (the prior 8 plus 12 exchange API tests and 1 migration
  integration test). No PostgreSQL server is available in this runtime.
- Actual PostgreSQL migration/backfill, Alembic schema comparison, and concurrency
  behavior remain unverified until that suite passes. CI is already configured
  with PostgreSQL and discovers the new tests.
- No new live ImageKit calls were made.

Run on a dedicated PostgreSQL test database whose account can create/drop schemas:

```powershell
$env:TEST_DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest -q
```

The suite creates isolated schemas. It checks competing acceptances, simultaneous
confirmations, acceptance versus archive, rollback after injected completion
failure, role/campus/membership guards, duplicate pairs, expiry, explicit
relisting, issue resolution, and upgrading a populated 0002 database. ImageKit
uses a fake in upload tests. Never point destructive/manual tests at your real
student data.

Suggested commit:
feat(exchanges): add proposals, reservations and mutual completion
