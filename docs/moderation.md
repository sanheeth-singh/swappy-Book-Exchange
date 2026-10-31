# Milestone 4: reports, blocking, and reversible moderation

This backend milestone adds general listing/user reports and personal blocking.
For later packages, follow the latest upgrade guide (currently auth-sessions.md).
Exchange handover issues remain a separate workflow with their own administrator
resolution endpoints.

## Upgrade (PowerShell)

Stop the API and back up the database. Copy only the added/changed files in
milestone-4-changes.md into your existing project. Keep your .env, compose
passwords, PostgreSQL volume, virtual environment, and ImageKit settings.

No dependencies or environment variables were added. From backend with the
virtual environment activated:

```powershell
python -m alembic heads
python -m alembic upgrade head
python -m alembic current
python -m alembic check
python -m uvicorn app.main:app --reload
```

The revision should be 0004. All existing migration files 0001–0003 must remain.
Do not regenerate initial migrations, stamp past the change, or recreate the
database. If heads reports 0003, check that the new migration is in the directory
Alembic is actually using. If your own migration history differs, reconcile it
before upgrading.

Migration 0004 adds user_blocks, reports, moderation_actions, users'
is_participation_restricted, and book_listings' is_hidden. Existing accounts and
listings receive false moderation flags. IDs, ownership, reservations, images,
and exchange history are preserved.

Downgrading removes moderation history and restrictions; it is not an undo
mechanism for individual review decisions. Use the restore endpoints for that.

## Reporting

Any authenticated active account can report a known user ID without completing a
profile or proving student membership. This does not provide a user directory,
email addresses, or other-campus profile discovery.

POST /api/v1/reports:
```json
{
  "target_type": "USER",
  "target_user_id": "USER_UUID",
  "reason": "HARASSMENT",
  "details": "Describe the behavior you want reviewed."
}
```

To report a listing, provide target_type LISTING and listing_id instead of
target_user_id. The backend derives the reported publisher from the listing;
the caller cannot nominate an unrelated owner.

An unverified student with a selected campus can report that campus's live
listings, including hidden/blocked ones known to them. Cross-campus and archived
listing reports require the reporter to have participated in an exchange
involving that listing. Self-reports are rejected.

Reasons: SPAM, HARASSMENT, INAPPROPRIATE_CONTENT, MISLEADING_LISTING, OTHER.
Details are optional except OTHER, which requires at least ten characters.
Only one OPEN report per reporter/target is allowed, enforced by partial unique
indexes and service checks. A later incident can be reported after review.

GET /api/v1/reports/me and GET /api/v1/reports/{id} show only the caller's own
reports. They include status and the review summary, but omit reporter identity,
reviewer identity, and the administrator-only target snapshot. Reported users
cannot read reports submitted about them. Reporting alone changes no eligibility,
listing visibility, ownership, or reservation.

Report states: OPEN -> RESOLVED or DISMISSED. Submitted targets and evidence
snapshots are not edited after submission.

## Blocking

- POST /api/v1/blocks/{user_id}
- POST /api/v1/blocks/{user_id}/unblock
- GET /api/v1/blocks?limit=20&offset=0

No student verification or completed profile is required. Blocking oneself is
rejected. Block and unblock operations are idempotent. The list exposes only
the caller's outgoing blocks; no incoming-block list exists.

A block in either direction:
- Hides the pair's listings from each other in browsing, search, and direct-ID
  listing endpoints.
- Rejects all pending proposals between the pair in the same transaction.
- Prevents new proposals and acceptance between them.
- Does not change ownership, cancel an accepted exchange, or release reservations.

Existing private exchange history, receipt confirmations, cancellation where
already permitted, and handover issue/support endpoints remain accessible.
Normal completion remains possible after a block. General reporting also
remains available. Personal blocks do not obstruct administrators acting in
their moderation role.

Each user's direction is stored separately. Unblocking does not remove the
other user's block or revive rejected proposals. Third-party campus browsing
and the caller's own /books/me and /books/collection are unaffected.

Previously shared public ImageKit URLs are not revoked by a personal block or
listing-hide action. This is application access control, not private image
delivery. Future chat must integrate the pair guard before sending new messages;
chat is not implemented by this package.

## Administrator review

GET /api/v1/moderation/reports?status=OPEN
GET /api/v1/moderation/reports/{report_id}

POST /api/v1/moderation/reports/{report_id}/review:
```json
{
  "action": "HIDE_LISTING",
  "summary": "Reviewed the condition description and found misleading content."
}
```

The summary is visible to the reporter. Do not include private reviewer notes
or unrelated personal information in it.

Actions:
- DISMISS: close without an enforcement action.
- RESOLVE: record a reviewed outcome without changing restrictions.
- HIDE_LISTING: hide the reported listing; LISTING reports only.
- RESTRICT_USER: prevent the reported publisher/user from publishing, editing
  listings, uploading listing photos, proposing exchanges, or accepting new ones.

Restrictions hide the account's live listings from discovery. Both HIDE_LISTING
and RESTRICT_USER invalidate affected pending proposals, but preserve accepted
and waiting handovers. They do not disable login or prevent the restricted user
from reporting, blocking, withdrawing listings, or resolving an existing handover.

Owners cannot clear moderation flags through profile/listing input. A publisher
cannot archive and relist the same known physical copy to escape a hidden listing.
After a legitimate ownership transfer, the recipient's new listing does not
inherit the former publisher's content penalty. Duplicate real-world copies
submitted under different physical IDs are not automatically detected.

Only an active administrator can review. An administrator cannot review their
own report or a report targeting them. A closed report cannot be reviewed twice.
Database changes, pending-proposal invalidation, report state, and the audit event
are committed together.

## Restoring access and visibility

POST /api/v1/moderation/users/{user_id}/restore
POST /api/v1/moderation/listings/{listing_id}/restore

Body:
```json
{"reason": "The restriction has been investigated and cleared."}
```

Restoration is idempotent and creates an audit entry only when a flag changes.
Administrators cannot restore their own participation or their own listing.
Restoring a listing does not unarchive it or revive proposals; restoring a user
does not bypass membership verification, another moderation flag, or a block.
Owners see is_hidden in /books/me and is_participation_restricted in /users/me.

GET /api/v1/moderation/actions is an administrator-only, paginated action history.
It records reviewer, target, report/listing IDs, decision, time, and explanation.
No user-facing endpoint can modify audit records.

## Transaction and compatibility notes

Blocking locks both user rows in UUID order, then invalidates pending proposals.
Exchange services now share that user-lock helper and recheck pair blocking and
participation restrictions before proposals and acceptance. Moderation locks the
target user before listings/report rows. These locks coordinate acceptance with
blocking, hiding, and restrictions; PostgreSQL concurrency verification is still
required.

Historic exchange JSON snapshots do not need rewriting. The new is_hidden
response field defaults to false when parsing an older snapshot. Current
listing visibility always comes from database state.

General reports never invoke the exchange-issue resolver. Handover disputes use
the existing /exchanges/{id}/issues and /resolve endpoints so releasing reserved
books remains an explicit, audited exchange decision.

## Verification

Executed in the creation environment:
- 38 unit tests passed.
- Ruff lint and formatting passed.
- OpenAPI generated and reporter/admin response separation checked.
- Alembic upgrade/downgrade compiled to PostgreSQL SQL.

Not executed here: 36 PostgreSQL API/integration tests, including the prior 21
and 15 new moderation scenarios. No PostgreSQL server is available in this
runtime. Migration backfill, schema comparison, and race/rollback behavior remain
unverified until that suite passes locally or in PostgreSQL CI.

From a dedicated test database account that can create/drop isolated schemas:

```powershell
$env:TEST_DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest -q
```

Tests cover report privacy, unverified access, campus-scoped listing reporting,
directional blocks, idempotence, accepted-handover preservation, moderation
restoration, self-review denial, duplicate races, acceptance races, and rollback.
The populated-database upgrade test now also checks false moderation defaults
and compares the full current schema. CI already discovers these tests.

Continue to apply the deployment authentication/request rate limits discussed
in the foundation guide before opening a real student pilot; report duplicate
constraints are not a replacement for request throttling.

Next milestone after verification: refresh-token rotation, revocation, and
logout before frontend authentication integration.

Suggested commit:
feat(moderation): add reports, blocking and reversible review actions
