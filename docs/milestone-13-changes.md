# Milestone 13 — backend readiness gate

This update strengthens acceptance testing; application endpoints and business rules are unchanged. Read `backend-readiness.md` for the exact acceptance commands, evidence limits and launch requirements.

| Path | Change |
| --- | --- |
| `compose.test.yaml` | Separate disposable PostgreSQL 18 test service on localhost:55432 |
| `backend/tests/conftest.py` | Strict PostgreSQL/no-skips switch, Alembic-built schema mode, cleanup after schema initialization failure |
| `backend/tests/integration/test_exchange_migration.py` | Clear test-only version table before old-revision rehearsal |
| `backend/tests/integration/test_directory_migration.py` | Same migration-test isolation adjustment |
| `backend/tests/integration/test_readiness_migrations.py` | Fresh schema drift check, full empty round trip, shutdown rollback preservation |
| `backend/tests/unit/test_readiness_http.py` | Browser preflight, security/cache headers and invalid-token-before-query checks |
| `.github/workflows/ci.yml` | Strict migrated-schema gate, manual execution, timeout, read-only permissions, retained JUnit report |
| `README.md` | Link readiness guide and qualify acceptance status |
| `docs/backend-readiness.md` | Local/CI procedure and frontend/public-launch acceptance distinction |
| `docs/milestone-13-changes.md` | This change manifest |

No application schema, API routes, environment configuration or dependency locks changed. Alembic head remains `0012`. Existing milestones remain included in the complete archive.
