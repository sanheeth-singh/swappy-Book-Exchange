# Milestone 4 changed files

Compared with swappy-exchange-lifecycle.zip. Paths are relative to swappy/.

## Added

- `backend/app/api/v1/blocks.py`
- `backend/app/api/v1/moderation.py`
- `backend/app/api/v1/reports.py`
- `backend/app/modules/moderation/__init__.py`
- `backend/app/modules/moderation/models.py`
- `backend/app/modules/moderation/policies.py`
- `backend/app/modules/moderation/queries.py`
- `backend/app/modules/moderation/schemas.py`
- `backend/app/modules/moderation/service.py`
- `backend/app/modules/users/queries.py`
- `backend/migrations/versions/0004_reports_and_blocking.py`
- `backend/tests/api/test_moderation.py`
- `backend/tests/unit/test_moderation_policies.py`
- `docs/moderation.md`
- `docs/milestone-4-changes.md`

## Updated

- `README.md`
- `backend/app/api/v1/books.py`
- `backend/app/api/v1/router.py`
- `backend/app/db/models.py`
- `backend/app/modules/books/models.py`
- `backend/app/modules/books/queries.py`
- `backend/app/modules/books/schemas.py`
- `backend/app/modules/books/service.py`
- `backend/app/modules/exchanges/service.py`
- `backend/app/modules/users/models.py`
- `backend/app/modules/users/schemas.py`
- `backend/pyproject.toml`
- `backend/tests/api/test_exchanges.py`
- `backend/tests/conftest.py`
- `backend/tests/integration/test_exchange_migration.py`
- `docs/exchanges.md`
- `docs/scope.md`

## What to copy and why

- moderation module: report/block models, validation, enforcement policies, shared
  query guards, and transaction services.
- reports/blocks/moderation routers: authenticated reporting, personal blocks,
  administrator review, restoration, and audit access.
- users/queries.py: ordered user locks shared with exchanges.
- books queries/router: exclude hidden listings, restricted/inactive publishers,
  and either-direction blocked pairs from discovery and direct listing access.
- books models/schemas/services: hidden flag, compatible responses, and protected
  editing/relisting.
- users models/schemas: participation restriction and caller-visible account state.
- exchanges service: recheck participation restriction and blocks before new
  proposals/acceptance, preserving existing handover actions.
- router.py and db/models.py: register the new routers and database models.
- migration 0004: existing moderation flags default false; adds reporting,
  blocking, and moderation audit tables.
- tests: new moderation cases; reusable students fixture moved to conftest;
  populated-database migration test extended to check moderation defaults.
- pyproject.toml: explicit function-scoped async test fixtures; no new dependencies.
- docs/README: current upgrade, behavior, and validation instructions.

Copy the added/updated files above. Keep your own environment values, compose
passwords, database volume, and virtual environment. Migrations 0001–0003 are
unchanged; do not replace their history with a new initial schema.
