# Milestone 6: centralized, persistent notifications

## First, verify the auth distinction

POST /api/v1/auth/token is login. It creates a new session_id and a new session
deadline. POST /api/v1/auth/refresh rotates the current credential using its
cookie and X-CSRF-Token. On refresh, session_id and refresh_expires_at stay the
same, while the access JWT and refresh cookie change. The CSRF token is bound to
the family, so it can stay the same. The raw refresh secret is in an HttpOnly
cookie, not the JSON response; refresh_expires_at is just a deadline.

A later deadline after calling /token proves another login, not refresh rotation.
The existing test_auth_sessions.py checks this distinction. No auth protocol
change is introduced by this notification milestone.

## Implementation order for the remaining features

| Stage | Scope | Reason for order |
| --- | --- | --- |
| 6, this package | Persistent notifications, unread state, common event producer | Shared foundation for existing workflows, chat, and reviews |
| 7, next | Exchange chat persistence and authenticated transport | Needed to arrange the actual campus handover |
| 8 | Completed-exchange reviews and a defined trust indicator | Depends on stable completion and moderation rules |
| Frontend integration | Mobile routes, global notification/toast provider, session client, end-to-end journeys | Uses stable backend contracts; can begin incrementally while later features develop |

These features were planned/deferred, not deliberately excluded from the product.
They are not all implemented in this package. Backend scope is not complete
merely because individual routes work: concurrency, cross-user authorization,
migration, browser-session, and end-to-end checks still matter.

Chat plan: only exchange participants can send while ACCEPTED or
WAITING_CONFIRMATION. Completion/cancellation/expiry closes sending; participants
retain read-only history. Enforce blocks and active login sessions, and preserve
the issue/support path when direct communication is blocked. Start with durable
messages and authorization tests, then attach the transport (WebSocket for live
delivery). Do not rely on socket authentication only at connection time.
Multiple application workers require shared delivery infrastructure, not only an
in-memory connection manager.

Reviews plan: one review from each participant per COMPLETED exchange, with
rating 1–5 and optional comment. Derive the reviewed user from the exchange,
not a client-supplied user ID. Prevent self/duplicate/nonparticipant reviews with
service checks and database constraints.

Trust plan: initially expose average rating, review count, completed exchanges,
and new-member status. A bounded, versioned score must show its contributing
factors and account for sample size and repeat-counterparty farming. Do not add
unlimited points for every review, assign a misleading zero to an unreviewed
student, or subtract points merely because someone filed a report. Moderation
restrictions remain an authorization decision, separate from reputation. Agree
the scoring policy in the reviews stage before presenting a numeric safety claim.

## Backend notifications versus frontend toasts

Backend owns durable event records, recipient selection, deduplication, privacy,
unread counts, and read state. Frontend owns the notification bell/list, visual
severity, navigation, responsive toasts, and local loading/validation/network
feedback. A toast is not a database notification.

Example: sending a proposal gives the caller immediate HTTP success feedback.
The receiving student gets a persistent EXCHANGE_PROPOSED notification. The
frontend's single notification provider will poll the feed initially, deduplicate
IDs, update relevant caches, and optionally display new events as toasts.
Initial unread history should not all replay as toasts on every reload. Avoid
showing both an HTTP success toast and an event toast for the same local action.

No frontend, email, push, SSE, or WebSocket delivery is created here. A future
external delivery channel should use an outbox/delivery worker with retry and
idempotency, rather than sending before a business transaction commits.

## Apply the update

Stop the API and back up the database. Copy the added/updated files in
milestone-6-changes.md. Keep your own environment, compose passwords, database
volume, JWT secret, and ImageKit credentials. No dependencies or new environment
variables are required.

From backend with the environment activated:
```powershell
python -m alembic upgrade head
python -m alembic current
python -m alembic check
python -m uvicorn app.main:app --reload
```

Current revision should be 0006. Keep migrations 0001–0005. Do not regenerate an
initial schema or stamp past missing migrations. This migration only adds the
notifications table and its indexes; it does not rewrite business history.
Old actions are not backfilled. To test, create a fresh proposal using live
listings, sign in as its recipient, and GET /api/v1/notifications. Mark the
returned item read, then check /unread-count. Existing archived listings must be
explicitly relisted before they can be used in a new proposal.

Existing session-bound tokens remain valid. Only the user-row locking mode
changes inside auth; cookie format, CSRF, and token endpoints remain as in
milestone 5.

## Notification API

All routes require an active signed-in account, but not a complete profile,
verified membership, or unrestricted participation.

| Endpoint | Behavior |
| --- | --- |
| GET /api/v1/notifications | Own inbox; items, next_cursor, and unread_count |
| GET /api/v1/notifications/unread-count | Lightweight own unread count |
| POST /api/v1/notifications/{id}/read | Mark own item read; repeated calls preserve read_at |
| POST /api/v1/notifications/read-all | Mark own current history through a visible item |

Inbox parameters: limit (1–100, default 20), before (the returned cursor UUID),
unread_only (default false). Ordering is created_at then UUID, descending. Pages
use keyset pagination. A cursor must belong to the current user, even when that
cursor item was already marked read.

read-all body:
```json
{"through_id": "NEWEST_ITEM_ID_FROM_THE_CURRENT_INBOX"}
```

The cutoff avoids marking newer arrivals read by mistake; only the selected
committed rows through that item are changed. Empty inboxes need no read-all
request. There is no recipient override or public notification creation endpoint.
Other users' IDs/cursors return 404.

Resource IDs are navigation hints, not authorization tokens. The destination
endpoint must enforce its normal permissions. A formerly administrative user may
retain a generic old queue notification but cannot use it to bypass role checks.

## Events connected now

| Producer | Recipients |
| --- | --- |
| New proposal | Requested-book owner |
| Acceptance/rejection/cancellation/first confirmation | Other participant |
| Completion or six-day expiration | Both participants |
| Automatic pending invalidation (edit/archive/block/conflict/restriction) | Both participants; generic closure text |
| Handover issue | Other participant and eligible administrators |
| Administrator handover resolution | Both participants |
| Student proof submission | Eligible active administrators |
| Proof approval/rejection/expiration before review | Student |
| General report submission | Eligible administrators, excluding reporter and reported user |
| Report review | Reporter |
| Listing hiding/restoration or participation restriction/restoration | Affected account |

Repeated receipt confirmation and unchanged restoration do not produce another
event. Queue notifications go to eligible administrators at event time; new
administrators must still use the authoritative review queues. An absence of a
notification does not mean there are no older tasks.

Reporting alone sends no notification to the reported account. Restriction/
hiding notices use the affected account/listing resource, never the private
report ID, allegations, reporter identity, or evidence. All templates are fixed
server text. No book/user text, chat message body, credentials, proof images, or
reviewer notes are interpolated.

Chat/review events will be added with those features. Their event producers
must use the same module rather than creating another notification subsystem.

## Transactions and extension points

events.py owns typed kinds, resource types, fixed templates, and the event shape.
service.emit inserts using PostgreSQL ON CONFLICT DO NOTHING, with a unique
(recipient_id, event_key). Event keys describe the business event, not each HTTP
attempt. It never commits; business services own the transaction.

Notifications and their business changes either commit together or roll back
together. This is durable inbox creation, not a claim of exactly-once network
delivery. Notification failure currently fails the business operation as well;
there is no best-effort drop or post-response background task.

User locks now use FOR NO KEY UPDATE, which keeps mutation serialization while
allowing notification FK key-share checks. Ordinary account mutations do not
change user IDs. Other entity locks remain unchanged. This avoids unnecessary
cross-recipient lock conflicts; a PostgreSQL concurrency regression test is
included.

Proof cleanup now rechecks each pending submission under the user/membership
locks and emits the expiration notification in that same transaction. Continue
scheduling python -m app.jobs.purge_verification_documents daily. No additional
notification scheduler or broker is required for the inbox. The existing
exchange-expiration job also emits its events.

Notifications remain stored in this milestone; no retention/deletion policy has
been silently added.

## Verification

Executed here:
- 60 tests passed, including the previous unit/protocol checks and notification
  template, schema, insertion-contract, locking-SQL, and HTTP inbox checks.
- Ruff lint and formatting passed.
- OpenAPI generated, with the combined inbox/badge contract.
- Alembic upgrade/downgrade compiled as PostgreSQL SQL.

Not executed here: 66 PostgreSQL API/integration tests (the previous 53 plus 13
notification scenarios). No PostgreSQL server is available in the creation
runtime. Actual migration/schema comparison, rollback, and concurrency results
remain unverified until the suite passes locally or in PostgreSQL CI.

```powershell
$env:TEST_DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest -q
```

Tests cover recipient isolation, read/cursor permissions, repeat confirmation,
business/notification rollback, pagination/cutoffs, concurrent deduplication,
membership/moderation privacy, block disclosure avoidance, expiry jobs,
cross-recipient locking, and revoked sessions. They use isolated schemas in a
dedicated test database.

Suggested commit:
feat(notifications): add transactional inbox and workflow events
