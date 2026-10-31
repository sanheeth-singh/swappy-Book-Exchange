# Backend readiness — milestone 13

Status: **local non-database checks pass; PostgreSQL acceptance remains pending**.
Do not interpret a green unit test run with database skips as backend acceptance.
Feature implementation can be complete while integration and operational readiness remain unfinished.

## Evidence from this delivery

- Python 3.12; lint and formatting checked.
- Unit/HTTP tests cover existing policies plus browser CORS preflight, no-store/nosniff headers and rejection of malformed bearer tokens before queries.
- PostgreSQL tests could not run here: PostgreSQL/Docker are absent and the environment cannot switch to the non-root user needed to start a downloaded PostgreSQL server.
- Offline migration generation checks SQL rendering only, not execution, data preservation, index behavior or concurrency.
- No live ImageKit upload or deployed HTTPS/browser session was retested in this delivery. Previous user verification remains useful but is separate evidence.

## Acceptance command (Windows PowerShell)

Use Docker Desktop with Linux containers. From the project root:

```powershell
docker compose -p swappy-readiness -f compose.test.yaml up -d --wait
cd backend
python -m pip install -r requirements-dev.lock
$env:TEST_DATABASE_URL = "postgresql+asyncpg://swappy_test:local-readiness-only@localhost:55432/swappy_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:JWT_SECRET = "readiness-test-only-secret-with-more-than-32-characters"
python -m ruff check .
python -m ruff format --check .
python -m pytest -q --require-postgres --migrated-schema --junitxml=test-results.xml
```

Run inside a disposable terminal, or restore your development environment variables afterward. These test credentials are local-only and must never be deployed. The separate Compose project uses port 55432 and temporary storage, independent of the development database on 5432. If that port is occupied, change both the test Compose port and test URL.

For bash, use `export TEST_DATABASE_URL='...'`, `export DATABASE_URL="$TEST_DATABASE_URL"`, and `export JWT_SECRET='...'` with the same values, followed by the same Python commands.

After recording results, from the project root:

```powershell
docker compose -p swappy-readiness -f compose.test.yaml down
```

This removes the temporary test database. Never substitute a development or production database URL. Tests create and delete random schemas; the role needs schema creation permission. Setup failure also cleans up its schema. Interrupted test processes may leave `test_<uuid>` schemas in the disposable database; removing the test container clears them.

## What the gate checks

`--require-postgres` rejects a missing/non-asyncpg PostgreSQL URL and makes skipped tests a failing run. An unreachable database produces test errors, not skips. `--migrated-schema` constructs each isolated test schema using all Alembic migrations instead of ORM `create_all`, so the API suite exercises the actual migration-produced schema. These switches are both required for acceptance.

Existing cases cover authentication/refresh replay and CSRF, campus membership, image validation, publication and ownership, exchange conflicts/concurrent acceptance, handover/support, block/moderation, chat retries/read receipts, review publication/trust, profiles/deactivation, recommendations, public consent, and directory shutdown/reactivation guards. They are evidence only after the PostgreSQL gate passes.

Migration cases additionally check:

- populated revision 0002 upgrades with original book/photo IDs and conservative legacy defaults;
- duplicate directory data stops revision 0012 without merging or losing records;
- fresh base-to-head schema matches the ORM through Alembic's drift check;
- empty head-to-base-to-head downgrade/upgrade succeeds;
- college shutdown rollback preserves campus IDs and does not reopen children.

A round trip on an empty test database does **not** establish that production downgrades preserve data. Downgrades intentionally delete feature data. Do not run `downgrade base` on a populated database. Before a real rollout, restore a sanitized backup into a disposable database, rehearse `upgrade head`, compare record counts/IDs and exercise representative handovers and settings. Keep the backup and recovery plan separate from the test database.

CI uses PostgreSQL 18, pinned requirements, strict migrated-schema tests, drift checks and empty-database downgrade/upgrade. It can be manually started through `workflow_dispatch`. JUnit output is retained as `backend-test-results`, including when tests fail. Hosted CI was not triggered from this delivery.

## Decisions before frontend integration

Proceed to frontend integration after the PostgreSQL gate has zero failures, errors and skips, migration rehearsal succeeds, and API contracts are reviewed. Record the exact commit/archive, PostgreSQL/Python versions, command, result and date. Send the JUnit report or first failing traceback if fixes are required. No new database revision is introduced by this milestone: head remains `0012`.

`/health` is process liveness only; it does not prove database availability. Include a real authenticated database-backed request in deployment smoke checks. Chat currently uses HTTP polling, not WebSockets. Notifications are an in-app persistent inbox, not push/email delivery.

## Requirements before public launch

| Area | Required evidence / action |
| --- | --- |
| HTTPS and sessions | Explicit production origins, Secure refresh cookie, CSRF/Origin behavior and refresh single-flight tested in an actual browser; logout/session revocation smoke test |
| Abuse controls | Configure and verify shared edge/proxy limits for login/register/refresh, anonymous preview, chat and uploads; total body size and timeouts; measure acceptable thresholds |
| Account access | Email ownership verification and account recovery are not implemented; decide and implement them before public launch |
| Jobs | Schedule `python -m app.jobs.expire_exchanges` and `python -m app.jobs.publish_reviews` every five minutes; proof/session purge daily; monitor failure and backlog, avoid overlapping executions |
| Database | Backup retention, encryption/access policy, real restore rehearsal, migration lock/time limits, query plans and load measurements for preview/recommendations/inbox/chat |
| Sensitive evidence | Restrict proof access, storage and backup retention; verify cleanup and reviewer procedure |
| ImageKit | Real upload/access/cleanup smoke test with deployment secrets kept out of frontend/logs; reconcile failed remote cleanup |
| Operations | Central error logs without tokens/passwords/proof/chat bodies, health monitoring, incident owner, database pool sizing and deployment worker coordination |

These are launch gates, not claims of implemented features. Load testing, penetration testing, backup restoration and deployed infrastructure checks were not performed here. Campus availability coordination requires all deployed writers to use the current shared/exclusive directory barrier; drain old workers before using shutdown controls.
