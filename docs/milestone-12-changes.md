# Milestone 12 changes (from visitor preview milestone 11)

Paths are relative to `swappy/`.

## Added

| Path | Purpose |
|---|---|
| `backend/app/api/v1/directory_admin.py` | Admin create/edit/status/impact/audit endpoints |
| `backend/app/modules/colleges/admin_schemas.py` | Validated labels, reasons, secret password and response contracts |
| `backend/app/modules/colleges/admin_service.py` | Audited directory mutations, duplicate checks, impact and CLI bootstrap |
| `backend/app/modules/colleges/directory.py` | Effective-availability guard, normalization and transaction barrier |
| `backend/migrations/versions/0012_directory_administration.py` | Parent active flag, unique indexes, duplicate preflight, audit table |
| `backend/tests/unit/test_directory_admin.py` | Validation, authorization, barrier, badge and notification contracts |
| `backend/tests/api/test_directory_admin.py` | PostgreSQL directory/lifecycle/handovers/rollback/bootstrap scenarios |
| `backend/tests/integration/test_directory_migration.py` | Legacy duplicate preflight preserves UUIDs |
| `docs/directory-administration.md` | Upgrade, API, lifecycle, lock order and verification guide |
| `docs/milestone-12-changes.md` | This manifest |

## Updated

| Path | Purpose |
|---|---|
| `backend/app/modules/colleges/{models,schemas,service}.py` | Parent state/audit model, selector labels and guarded membership operations |
| `backend/app/api/v1/colleges.py` | Paginated active college/campus choices and search/filter |
| `backend/app/api/v1/router.py`, `backend/app/db/models.py` | Register routes/model |
| `backend/app/cli.py` | Validated, idempotent and audited campus bootstrap |
| `backend/app/api/dependencies/membership.py` | Active parent + campus browsing eligibility |
| `backend/app/modules/books/{queries,service,preview}.py` | Effective discovery/preview availability and shared mutation barrier |
| `backend/app/modules/exchanges/service.py` | Parent-aware eligibility; existing completion/reservation rules unchanged |
| `backend/app/modules/users/{queries,service,profiles,profile_schemas}.py` | Barrier before user writes, active campus selection, effective profile badge/state |
| `backend/app/modules/notifications/{events,service}.py` | Generic availability event and transactional bulk account notices |
| `backend/tests/integration/test_exchange_migration.py` | Existing college IDs survive with active=true default |
| `README.md`, `docs/scope.md`, `docs/visitor-preview.md` | Current milestone and directory-guide pointer |

No prior migration, dependency, environment, authentication token/cookie format, trust formula, avatar or scheduler change. Availability is a directory flag, not a user restriction or automatic exchange cancellation. No IDs are merged/reassigned and no deletion API is added.
