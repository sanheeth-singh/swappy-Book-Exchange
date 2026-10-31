# Milestone 12: college and campus administration

## Model and rules

A College is the parent institution; each Campus has its own UUID, name and city. One college may have campuses in different cities. Add five colleges/campuses through repeated calls to the same endpoints—there is no five-campus limit and no ID renumbering. Existing user, membership, listing and exchange campus IDs remain unchanged.

Admins can add colleges/campuses, correct names/cities, inspect impact counts and change availability. There are no DELETE, merge or campus-reparenting endpoints. Correcting a display label does not reset membership. A genuinely different institution/campus should receive a new entry, not repurpose an existing UUID.

Effective campus availability is `college.is_active AND campus.is_active`. College shutdown does not overwrite child-campus flags. Restoring a college leaves separately disabled campuses closed. Activating a campus or creating one under an inactive college returns 409; activate its parent first. Inactive entries remain in admin lists and keep their IDs.

## Upgrade and duplicate preflight

Copy the files in milestone-12-changes.md, preserve `.env` and the database, then run from `swappy/backend`:

```powershell
python -m alembic upgrade head
python -m alembic current
```

Expected revision: `0012`. Restart the API. No dependency, credential, environment or new scheduled-job change is required. The migration adds College.is_active (default true), normalized unique indexes and directory_actions. Existing college/campus IDs and child active flags are preserved.

Names/cities are trimmed and repeated whitespace is collapsed on API/CLI input. Database uniqueness uses PostgreSQL lowercase and whitespace normalization. College names are unique across the directory. A campus name/city combination is unique within its college; the same name in another city/college is allowed. Inactive records still reserve their normalized identity. This is exact normalized matching, not fuzzy institution detection.

**If existing normalized duplicates are present, migration 0012 stops before making changes.** It does not merge, rename or delete referenced IDs. The previous CLI could create duplicate campuses, so check your local data if you ran it repeatedly. Diagnostic read-only SQL:

```sql
SELECT lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AS normalized_name,
       array_agg(id) AS ids, count(*)
FROM colleges GROUP BY normalized_name HAVING count(*) > 1;

SELECT college_id,
       lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AS normalized_name,
       lower(regexp_replace(btrim(city), '[[:space:]]+', ' ', 'g')) AS normalized_city,
       array_agg(id) AS ids, count(*)
FROM campuses GROUP BY college_id, normalized_name, normalized_city HAVING count(*) > 1;
```

Review these records before retrying the upgrade. Distinct real institutions/campuses need accurate distinguishing labels. Truly duplicate referenced entries need a separately planned, backed-up data migration; do not drop a row or reset the database to make the error disappear. Failed preflight leaves the migration at 0011.

Downgrading deletes directory audit records and DIRECTORY_AVAILABILITY_CHANGED notifications. Before removing the college flag, it sets children of inactive colleges inactive so rollback does not silently reopen them. It does not undo metadata changes or restore previous child flags. A later upgrade defaults colleges active again but those children remain closed. Do not downgrade a populated deployment without a backup and a state-restoration plan.

## Endpoints

All admin routes use existing AdminUser authorization. Non-admins receive 403. Mutating admin routes also require a trusted Origin/Referer, like sensitive auth routes; CLI HTTP clients must set Origin to API_ORIGIN. An explicit bearer access token is still required. No role selection/promotion is exposed through these APIs.

| Method | Path under `/api/v1` | Purpose |
|---|---|---|
| GET | `/admin/colleges` | List active and inactive colleges |
| POST | `/admin/colleges` | Create college; 201 |
| PATCH | `/admin/colleges/{id}` | Correct its name |
| POST | `/admin/colleges/{id}/status` | Password-confirmed activation/deactivation |
| GET | `/admin/colleges/{id}/impact` | Scope/record counts across child campuses |
| GET | `/admin/campuses?college_id={id}` | List all campuses, including inactive ones |
| POST | `/admin/campuses` | Create campus under an active college; 201 |
| PATCH | `/admin/campuses/{id}` | Correct name and/or city; cannot change college_id |
| POST | `/admin/campuses/{id}/status` | Password-confirmed activation/deactivation |
| GET | `/admin/campuses/{id}/impact` | Scope/record counts for one campus |
| GET | `/admin/directory/actions?college_id={id}&campus_id={id}` | Audit history; filters optional |

Admin list/audit routes accept limit 1–100 (default 20) and offset >=0. Lists include inactive records; there is no hidden automatic deletion. Campus responses distinguish is_active, college_is_active and effective_is_active. Impact values are an informational read snapshot, not a promise that counts cannot change before confirmation.

### Create a college, then a campus

POST `/admin/colleges`:

```json
{"name":"Example Institute","reason":"Approved institution for our campus pilot."}
```

POST `/admin/campuses` using its returned ID:

```json
{"college_id":"<college UUID>","name":"Main Campus","city":"Pune","reason":"Approved campus location for our pilot."}
```

New entries start active. Repeat these calls for additional colleges/campuses; IDs are generated on the server. Duplicate creates return 409; use the existing directory entry instead of creating another spelling of it. Case/whitespace variants are checked in services and protected by unique indexes.

### Correct labels

PATCH `/admin/campuses/{id}`:

```json
{"name":"Central Campus","city":"Pune","reason":"Corrected official campus display details."}
```

A college edit takes name and reason. A campus edit takes at least one of name/city plus reason. Label lengths: college/campus name 1–200, city 1–120; no control characters. Reasons: 10–1,000 characters. Unknown fields, client-assigned IDs, null edit labels, is_active on metadata edits and college_id on campus edits are rejected. Exact unchanged values are no-ops and create no audit event.

### Change availability

First GET the impact endpoint. It returns college_id/campus_id, campus_count, selected_users, live_listings and counts of pending/accepted/waiting-confirmation exchanges. Counts include retained records: selected_users includes inactive users; live_listings means not archived, including hidden/reserved listings. No identities or individual proof are returned by impact.

Then POST the relevant `/status` route:

```json
{"is_active":false,"current_password":"<admin's current password>","reason":"Campus participation paused after administrative review."}
```

Use true to restore. Both directions require the current password. The service rechecks the admin's live role/active state under its user lock and verifies the password. Wrong password returns 403 without changes. Strict booleans are required; the password is a write-only, masked field, never a response/audit field. Password whitespace is preserved. Correct repeated requests for the already stored state create no duplicate audit/notifications, but still require password verification. Password confirmation supplements administrator authorization rather than replacing it.

## Effect of shutdown and restoration

While a campus or its parent college is inactive:

- It disappears from active student directory choices. New profile selection, proof submission/approval, listings, proposals and acceptance are denied.
- Its listings disappear from campus discovery, profile Books tabs/counts, recommendations and visitor preview. Existing opt-in and moderation/archive flags are retained; no broad content deletion or permanent archive is performed.
- Public profile campus.is_active and membership_verified reflect effective availability. Stored membership/me may still show VERIFIED/active because enrollment history was not rewritten; use the profile/eligibility endpoint for current availability.
- Login, account settings, account deactivation subject to its own exchange gate, reports, blocking, historical exchanges/reviews, notification inbox and support remain available.
- Existing accepted/waiting exchanges retain their reservations. Receipt confirmation, permitted cancellation, support issues and admin resolution continue normally. Completion still transfers ownership once. Existing expiry deadlines are not paused or extended.
- Existing chat history/read receipts remain available, but sending becomes unavailable because chat requires current campus eligibility. Handover support is still available.
- Pending proposals remain recorded and can be rejected/withdrawn. Shutdown does not silently reject or cancel them; deactivation of a user still requires settling their active proposals.

Restoration permits new activity only when all ordinary guards also pass. It does not remove user restrictions, restore membership that actually expired/revoked, unarchive listings or remove moderation flags. Previously live listings and still-pending proposals can become usable again if their existing permissions/eligibility remain valid. Restoring a college does not activate individually disabled children. Optional completed-exchange review rights and trust scores are not penalized by a directory closure.

## Student directory and profiles

Existing GET `/campuses` still returns a list and now filters both active flags, includes college_name, and supports limit (default 100), offset, college_id and optional q across college/campus/city. GET `/colleges` lists active colleges with limit (default 20)/offset. Both require authentication, not verified membership. The underlying exchange boundary remains **campus UUID**, not college name or city; two campuses of the same college cannot exchange with one another merely because they share a parent.

Profile campus summaries now include effective is_active. The existing membership badge also checks the college flag. Own profile editing can still update public bio/interests/avatar/name independently; campus-changing PUT enforces active directory selection and its existing unresolved-handover rules.

## Audit, notifications and transaction coordination

Every actual API create/edit/status change writes a directory_actions row with actor UUID, ADMIN source, target IDs, action, reason, before/after snapshots and UTC time. Reasons/snapshots are admin-only and never contain passwords, user proof or participant details. No audit edit/delete endpoint exists. These are application audit records, not a claim of tamper-proof storage against a database operator.

Availability changes create generic DIRECTORY_AVAILABILITY_CHANGED account notifications for active users currently selecting affected campuses. Raw admin reasons are not exposed. The notification links to the recipient's own account/profile context, with no new resource type. Repeated unchanged status requests do not emit again. Visibility change, audit and notices share one transaction; a failure rolls all three back. The centralized notification service inserts recipient-deduplicated notices in batches without committing or contacting external services.

A PostgreSQL transaction-scoped advisory barrier coordinates directory changes with user mutations: normal mutations acquire a shared barrier **before user row locks**, while directory writes/CLI bootstrap acquire its exclusive form **before locking the administrator**. Normal shared mutations can run concurrently. This prevents directory shutdown racing past a new proposal, acceptance, campus selection or approval. Keep this ordering when adding services; never upgrade a shared barrier to exclusive after taking user/entity locks. Deploy/restart all mutation workers and CLI code before using directory shutdown; old writers cannot participate in this coordination. Advisory locks release on commit/rollback; ordinary read endpoints remain read snapshots. See PostgreSQL's [advisory lock documentation](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS) for the underlying transaction-lock behavior.

Directory updates can wait for in-flight mutation transactions (including uploads) to finish; students may have committed an action immediately before the closure. Read responses or already downloaded content cannot be recalled. The existing default READ COMMITTED database behavior is assumed. API/CLI code must use these services; direct SQL updates bypass application coordination/auditing. For a much larger platform, measure status-update/fan-out latency and consider an outbox/worker without weakening authorization ordering.

## Trusted CLI

The existing bootstrap command remains available:

```powershell
python -m app.cli add-campus --college "Example Institute" --campus "Main Campus" --city "Pune" --reason "Trusted operator initial campus setup."
```

It validates/normalizes input, takes the exclusive barrier, reuses an existing normalized college/campus, and records newly created entries with source CLI and actor_id=null (not a fabricated administrator). Repeating a command returns the existing campus ID without another audit. It does not reactivate a disabled campus or create under an inactive college. The optional reason has a bootstrap default. Console output is Campus ID. Local system access is trusted; no password argument is put in shell history. Admin promotion remains the existing separate trusted CLI command.

## Verification

1. Promote a test admin through the existing CLI. Ordinary users cannot access admin lists/mutations. Create five colleges/campuses; IDs are unique and active choices include them.
2. Try case/whitespace duplicate college and same-parent campus name/city: 409, no extra row/audit. Same name in another city is allowed. Rename a campus and verify membership/listing/exchange IDs do not change.
3. GET impact, try a wrong password, then disable/restore. Verify wrong password has no effects and unchanged repeated requests have no extra audit/notice. Check audit responses do not contain password material.
4. Disable one child, disable parent, restore parent: independently closed child stays closed. Activating a child under a closed parent fails. No hard deletion or reparenting is possible.
5. Closed directory blocks selection, publishing, proposals, acceptance and proof approval. Listings/preview vanish, profile badge/count changes. Rejection of pending proof remains possible.
6. Accepted handovers can confirm/complete or use support after closure; reservations/history are preserved. Chat sends stop but history/read receipts remain. Pending proposals remain pending until an ordinary action settles them.
7. Simulate notification failure: status/audit/notices must roll back. Concurrent duplicate creates must yield one 201 and one 409. Check the advisory barrier against PostgreSQL, not SQLite/mocks alone.
8. Upgrade a dedicated legacy schema containing duplicates: preflight must fail at 0011 while keeping both UUIDs. Resolve actual data with review before retrying. Test clean upgrade and metadata comparison too.

## Validation and next stage

163 tests passed; 159 PostgreSQL-dependent cases skipped because TEST_DATABASE_URL was not configured. This milestone adds 18 database-free cases, 11 PostgreSQL API/concurrency/bootstrap cases and two duplicate-migration cases; the existing populated upgrade test checks the new college flag defaults true. Lint/format, compilation, OpenAPI generation (79 paths) and offline PostgreSQL upgrade/downgrade SQL generation passed. Actual migration execution, functional-index behavior, lock races, notification rollback and schema comparison remain unverified without PostgreSQL.

From backend, use a dedicated test database:

```powershell
$env:TEST_DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest tests -q
```

Next: backend readiness—run the full PostgreSQL suite/migration paths, review query plans and authorization failures, configure scheduled jobs and public-route abuse controls, and finalize frontend contracts. There are no more campus-management changes required to start that validation stage.
