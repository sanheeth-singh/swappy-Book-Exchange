# Milestone 3 file changes

Compared with swappy-book-listings.zip. Paths are relative to swappy/.

## Added

- `backend/app/api/v1/exchanges.py`
- `backend/app/jobs/expire_exchanges.py`
- `backend/app/modules/exchanges/__init__.py`
- `backend/app/modules/exchanges/models.py`
- `backend/app/modules/exchanges/policies.py`
- `backend/app/modules/exchanges/presenters.py`
- `backend/app/modules/exchanges/queries.py`
- `backend/app/modules/exchanges/schemas.py`
- `backend/app/modules/exchanges/service.py`
- `backend/migrations/versions/0003_exchange_lifecycle.py`
- `backend/tests/api/test_exchanges.py`
- `backend/tests/integration/test_exchange_migration.py`
- `backend/tests/unit/test_exchange_policies.py`
- `docs/exchanges.md`
- `docs/milestone-3-changes.md`

## Changed

- `README.md`
- `backend/app/api/v1/books.py`
- `backend/app/api/v1/router.py`
- `backend/app/db/models.py`
- `backend/app/modules/books/models.py`
- `backend/app/modules/books/schemas.py`
- `backend/app/modules/books/service.py`
- `backend/app/modules/users/service.py`
- `backend/migrations/env.py`
- `backend/tests/conftest.py`
- `docs/scope.md`

## Purpose

- exchanges module: persistent state, API contracts, policies, queries, immutable
  snapshots, and transaction services.
- exchanges router: proposal actions, participant history, issues, administrator
  review and resolution.
- expiry job: scheduler entry point using the same transaction services.
- book models/schemas/services/router: physical ownership, explicit relisting,
  current collection, reservation visibility, and mutation guards.
- user service: block campus changes during unresolved handovers and invalidate
  pending proposals on campus changes.
- migration 0003: backfill physical copies, add exchange/reservation/issue tables,
  and enforce unique active pairs and live listings.
- migrations/env.py: permit migration tests to use an existing isolated connection.
- db/models.py and api/v1/router.py: register new models and endpoints.
- tests: API/concurrency/rollback scenarios, populated database migration test,
  exchange policies, and physical-book fixtures.
- README/scope/exchanges docs: current scope, upgrade instructions, and limitations.

No environment values, compose passwords, ImageKit credentials, or dependencies
change in this milestone. Existing migration files 0001 and 0002 are unchanged.
