# Milestone 6 changed files

Compared with swappy-auth-sessions.zip. Paths are relative to swappy/.

## Added

- `backend/app/api/v1/notifications.py`
- `backend/app/modules/notifications/__init__.py`
- `backend/app/modules/notifications/events.py`
- `backend/app/modules/notifications/models.py`
- `backend/app/modules/notifications/schemas.py`
- `backend/app/modules/notifications/service.py`
- `backend/migrations/versions/0006_notifications.py`
- `backend/tests/api/test_notifications.py`
- `backend/tests/unit/test_notifications.py`
- `docs/notifications.md`
- `docs/milestone-6-changes.md`

## Updated

- `README.md`
- `backend/app/api/v1/router.py`
- `backend/app/db/models.py`
- `backend/app/jobs/purge_verification_documents.py`
- `backend/app/modules/auth/service.py`
- `backend/app/modules/books/service.py`
- `backend/app/modules/colleges/service.py`
- `backend/app/modules/exchanges/queries.py`
- `backend/app/modules/exchanges/service.py`
- `backend/app/modules/moderation/queries.py`
- `backend/app/modules/moderation/service.py`
- `backend/app/modules/users/queries.py`
- `backend/app/modules/users/service.py`
- `docs/auth-sessions.md`
- `docs/scope.md`

## Why these files changed

- notifications module: typed event catalog, fixed privacy-safe templates,
  persistent model, response contracts, transactional deduplication, inbox/read APIs.
- notifications router: feed with unread count, cursor pagination, and read controls.
- migration 0006: notifications table and recipient/event/unread indexes.
- exchange services and closure queries: proposal, transition, issue, resolution,
  expiration, and system-invalidation events.
- membership service and proof cleanup job: review notifications and expiration
  notifications, with per-submission rechecking under locks.
- moderation services: reviewer queue events, reporter outcome, affected-account
  enforcement and restoration events. Personal blocks are not disclosed.
- auth/books/users/membership user locks: FOR NO KEY UPDATE permits notification
  foreign-key checks while still serializing mutations. Auth protocol is unchanged.
- model/router registration: register the new database table and endpoints.
- tests: notification privacy, unread/cursor contracts, rollback, deduplication,
  lifecycle/cleanup events, and cross-recipient concurrency.
- README/scope/latest guides: roadmap, upgrade instructions, and validation limits.

Copy these added/updated files into the existing project. Keep your own .env,
credentials, database volume, and virtual environment. Migrations 0001–0005 are
unchanged. Upgrade to revision 0006 before starting the updated API.
No new dependencies, environment values, notification scheduler, or broker are
required for the persistent inbox. No historical event backfill is performed.
