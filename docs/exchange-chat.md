# Milestone 7: exchange chat

## Upgrade

Copy the files listed in milestone-7-changes.md into your existing project. Preserve your `.env` and database. No dependency/configuration changes are required. From `swappy/backend`:

```powershell
python -m alembic upgrade head
python -m alembic current
```

Expected revision: `0007`. Restart the API. This adds `chat_messages` and `chat_read_positions`; existing exchanges and auth sessions remain intact. Previously accepted exchanges can use chat immediately. There is no historical chat to backfill. Downgrading to `0006` deletes chat and receipts, so do not downgrade a populated deployment without a backup.

## Rules

Only the exchange's requester and owner may access chat, even if another user is an administrator. Pending/rejected proposals never open chat. Sending requires ACCEPTED or WAITING_CONFIRMATION, active accounts, active verified membership in the exchange campus, no participation restrictions on either account, and no block in either direction. Either participant blocking the other stops both from sending, including already accepted exchanges. Unblocking allows sending again only if all other checks still pass.

Completion, cancellation, expiry, and administrative resolution make chat read-only. History and receipt updates remain available to authenticated participants after closure, membership expiry, restrictions or blocking. An inactive account/revoked session cannot authenticate. Blocks do not prevent handover confirmation, cancellation where permitted, or raising support issues. Open handover issues do not themselves close chat; moderation restrictions/blocks still apply.

A due ACCEPTED deadline prevents sending even before the expiry job runs. A send attempt transitions a due exchange to EXPIRED and commits its release/notifications, then returns 409. WAITING_CONFIRMATION does not auto-expire. Continue scheduling the existing exchange-expiry job.

## API

All endpoints require the existing bearer access token. Base: `/api/v1/exchanges/{exchange_id}/chat`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/messages?limit=30&before=101` | Newest first, exclusive sequence cursor, maximum 100; omit before for latest |
| POST | `/messages` | Create a text message, or return a previous identical submission; both return 200 |
| POST | `/read` | Advance your read position through a known message in this exchange |

Send body:

```json
{"client_message_id":"ae746a40-5eef-45a2-8389-1254192836d2","body":"Meet at the library at noon?"}
```

Generate a fresh UUID per logical message and retain it on retries. Reusing it with different normalized text returns 409. Retrying an already committed identical message returns that existing row, including after blocking/closure; it never delivers new content or creates another notification. A new message ID is subject to every current permission check. Sender/recipient IDs and timestamps are server-owned. Unknown extra fields return 422. Text is trimmed, 1–2000 characters, no NUL/other ASCII controls except newline/tab. Treat body as plain text in the frontend; do not render raw HTML. No attachments/edit/delete endpoints in this milestone.

Messages return id, exchange_id, sender_id, client_message_id, sequence, body and UTC created_at. Sequence is positive, increasing within an exchange and assigned under its lock; use it to order and deduplicate. UUIDs are identifiers, not chronology.

GET returns items, next_before, unread_count, my_read, other_read, can_send, unavailable_code. Read positions contain sequence (0 initially) and read_at (null initially). Fetching messages has no read side effect. can_send is an informational snapshot; POST always revalidates under locks. Polling responses can reflect concurrent updates between queries; refresh on the next poll. Reverse returned items for chronological display; request earlier pages using next_before.

Receipt body:

```json
{"through_message_id":"<id of last message actually viewed>"}
```

Receipts are monotonic: a stale/older receipt cannot move backwards, and retries preserve read_at. They cover all messages up to that sequence. Unread counts include only incoming messages above your position, not your outgoing messages. The other participant has read a sent message when other_read.sequence is at least its sequence. Never advance receipts just because a background poll fetched messages. Messages belonging to another exchange return 404. No read-receipt notifications are generated.

## Notifications and delivery

Each newly stored message creates one CHAT_MESSAGE notification for the counterpart in the same database transaction. Notification previews contain fixed generic text, never message bodies. Receipt updates do not mark notification inbox entries read: those are separate explicit actions. The frontend should mark applicable notices as read when appropriate using the existing notification API.

This milestone implements persisted HTTP chat. Use polling while a chat is open, pause when hidden, refresh auth through the existing single-flight flow, and merge by message ID. No WebSocket server, presence, typing indicators, email/push delivery, message rate limiter or attachments are included. Public deployment should have request rate limits and a retention policy. Real-time transport can later use these same services, with connection authentication/revalidation and shared fan-out for multiple workers.

## Manual verification

1. Use two verified users and one unrelated user. Propose: chat returns 409. Accept: both participants can message; unrelated users/admins receive 404.
2. Send the same UUID/body twice: one message and one counterpart notification. Change body with same UUID: 409. Check whitespace/length and forged sender fields.
3. Send two messages; recipient GET reports 2 unread. Mark the second read, then mark the first: position stays at second and unread becomes 0. Sender sees other_read advance. GET alone never reads messages.
4. Block either direction: new sends from both accounts fail; history remains available. Unblock and send again if exchange remains eligible.
5. First confirmation: chat still writable. Second confirmation: read-only; ownership transfer remains unchanged. Also test cancellation and admin COMPLETE/CANCEL resolution.
6. Set an ACCEPTED deadline in the past: sending returns 409 and expires/releases once. WAITING_CONFIRMATION remains open after deadline.
7. Restrict a participant or expire membership: sending fails, history remains. Restore eligibility and retry with a fresh UUID. Logout/revoke: old access token fails.
8. Exercise parallel send retries and block/completion races against PostgreSQL. Operations serialize: once block/closure commits, subsequent new sends must fail; an earlier committed message remains historical.

## Automated validation

71 tests passed; 76 PostgreSQL-dependent cases skipped because TEST_DATABASE_URL was not configured in the build environment. Ten new PostgreSQL chat cases cover access, idempotency, receipts, pagination, blocks, closure, expiry, restrictions, revoked sessions, concurrent retries and rollback. Eleven new database-free checks cover input validation and state/deadline rules. PostgreSQL concurrency/migration execution still require your database or CI.

From backend, use a dedicated PostgreSQL test database (tests create isolated schemas):

```powershell
$env:TEST_DATABASE_URL = "postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest tests -q
```

Lint/format, OpenAPI generation, Python compilation and offline PostgreSQL upgrade/downgrade SQL were checked. These are not substitutes for executing migrations on PostgreSQL.

## Next milestone

Exchange reviews and reputation: completed-exchange participant reviews, one review per participant per exchange, public rating summaries with sample counts, centralized review notifications, and a documented bounded trust policy. Numeric scoring and abuse resistance should be settled before implementing the score.
