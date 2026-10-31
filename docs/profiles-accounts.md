# Milestone 9: profiles, avatars and account settings

## Upgrade

Copy the files in milestone-9-changes.md into your existing project, including all 15 `backend/app/assets/avatars/*.svg` files. Preserve `.env` and the database. From `swappy/backend`:

```powershell
python -m alembic upgrade head
python -m alembic current
```

Expected revision: `0009`. Restart the API. No new dependency, credential or environment setting is needed. If you install/build a wheel, reinstall/rebuild the package so the new avatar assets are included. `pyproject.toml` now includes these assets as package data.

The migration adds avatar_id (default reader_01), optional bio, reading_interests (default empty array), and optional deactivated_at to users. Existing accounts, sessions, reviews, ownership, listings and exchange history are preserved. There is no database reset. Downgrading removes these four columns but does not reactivate accounts, restore listings or un-revoke sessions: those are committed account-state changes, not migration data.

## Public profile in one HTTP request

All profile/catalog endpoints require the existing bearer access token. "Public" means safe to show eligible students, not anonymously accessible on the internet.

| Method | Path under `/api/v1` | Use |
|---|---|---|
| GET | `/users/me/profile` | Your combined profile, even before campus setup |
| GET | `/users/{user_id}/profile` | Another eligible user's combined profile |
| PATCH | `/users/me/profile` | Edit public details independently of campus/membership |
| GET | `/users/{user_id}/books?limit=20&before={listing_id}` | Paginated visible profile books |
| GET | `/users/avatars` | The 15 allowed avatar choices |
| GET | `/users/me/deactivation` | Informational unsettled-exchange counts |
| POST | `/users/me/password` | Reauthenticated password change and global sign-out |
| POST | `/users/me/deactivate` | Reauthenticated account deactivation |

Example combined profile:

```json
{
  "id": "<user UUID>",
  "display_name": "Ben",
  "avatar_id": "reader_04",
  "avatar_url": "/assets/avatars/reader_04.svg",
  "bio": "Books, tea and campus conversations.",
  "reading_interests": ["History", "Science fiction"],
  "campus": {"id": "<campus UUID>", "name": "Main campus", "college_name": "Example College", "city": "Pune"},
  "membership_verified": true,
  "is_self": false,
  "metrics": {
    "active_listings": 1,
    "completed_exchanges": 0,
    "distinct_exchange_partners": 0,
    "review_count": 0,
    "average_rating": null,
    "distinct_reviewers": 0,
    "trust_score": null,
    "trust_status": "NOT_ENOUGH_HISTORY",
    "trust_version": "distinct-reviewer-v1",
    "minimum_distinct_reviewers": 3
  }
}
```

The profile omits email, password/hash, admin/restriction flags, session data, proof, submission/rejection reasons and sealed-review content. A new user may have null name/campus. GET `/users/me` remains the private account response; it now also includes avatar_id, bio and reading_interests.

The badge is calculated on each request: active account, active selected campus, active VERIFIED membership matching that campus, and no reached expiration. A badge proves current membership status only. It does not override blocks, participation restrictions, reservations or listing rules. No membership pending/rejected reason is public.

Metrics reuse the existing reputation service and its published/non-hidden review policy and versioned trust formula. `active_listings` counts the listings visible to this viewer, in the viewer's selected campus, excluding archived/hidden listings and inactive/restricted publishers. It includes reserved but still published listings (their cards expose is_reserved); it is not an available-book count, lifetime upload count or current physical-collection count. `/books/me` and `/books/collection` remain private inventory views with their existing behavior.

This endpoint reduces frontend requests, not necessarily the number of SQL queries to one. Counts are calculated on demand. Concurrent mutations between queries can affect individual values; refresh after edits/exchange actions. No persistent User counters were introduced.

## Profile access and tabs

The subject, administrators, same-campus viewers with a complete profile, and former completed-exchange counterparts can access an active profile. Former counterparts may still view basic profiles after a campus change, but the Books tab/count never exposes another campus's listings. Either-direction blocks make the profile and profile-books endpoints return 404. Inactive users' profiles return 404. Historical exchanges, attribution and existing review/reputation access policies remain intact; blocking/deactivation does not erase historical feedback.

Frontend composition:

1. Load `/users/{id}/profile` for header, badge, bio/interests and all metrics.
2. Load `/users/{id}/books` when the Books tab opens; use next_cursor for older results. Limits are 1–100, ordered newest created_at/id first. A cursor that becomes hidden/archived/inaccessible returns 404; reload page one.
3. Load existing `/users/{id}/reviews` when the Reviews tab opens. Review summaries are already in the header.
4. Render About from the same profile response; no extra request is necessary.
5. Show Edit and Settings for is_self. The backend enforces ownership independently; UI visibility is not authorization.

## Editing name, bio, interests and avatar

PATCH example (all fields optional, but at least one required):

```json
{
  "display_name": "Ben",
  "bio": "Always happy to talk about books.",
  "reading_interests": ["Science fiction", "History"],
  "avatar_id": "reader_07"
}
```

Name: 1–80 trimmed characters, no control characters. Bio: optional, at most 300 characters; blank or null clears it. Interests: up to eight free-text tags, each 1–40 trimmed characters; duplicates are removed case-insensitively while retaining the first spelling. Empty array clears interests; null is invalid. Avatar: an allowlisted ID; URLs, paths and unknown IDs are rejected. Name/avatar cannot be null. Omitted fields remain unchanged; unknown fields (including campus_id/is_active/email) are rejected.

PATCH returns the private UserResponse after saving. It never changes campus or membership and can be used while an exchange is accepted. The existing **PUT** `/users/me/profile` is retained for name + campus setup/change; changing campus still enforces accepted-exchange locks, archives prior-campus listings and resets membership. Frontend public-detail editing must use PATCH rather than sending a campus change.

## Avatar assets

GET `/users/avatars` returns id, name and URL for 15 built-in vector book avatars. Each SVG is served at `/assets/avatars/{id}.svg` on the API origin; the files themselves are public/static and contain no user data or external content. Resolve returned root-relative URLs against your configured **API origin**, not the Next.js origin. No ImageKit key or upload is involved.

The backend stores only the chosen ID. Existing/new users default to reader_01. A database constraint also rejects unknown IDs. Adding choices in a later release requires updating the catalog, adding assets and migrating the allowlist; keep existing IDs stable. CORS now permits PATCH. SVG package inclusion was verified by building a wheel and inspecting all 15 assets. Serve your complete package or ensure the asset directory is included in deployment.

## Password changes

POST `/users/me/password`:

```json
{"current_password":"<current password>","new_password":"<different password, 12–128 characters>"}
```

Requires bearer authorization and a trusted Origin/Referer, like the existing sensitive auth endpoints (CLI clients should set `Origin` to API_ORIGIN). It verifies the current password under the user lock, hashes the replacement with existing Argon2 handling, revokes all live login sessions and clears the refresh cookie. Success: 204. The frontend must clear its access token/CSRF state and send the user to login; the new password works, old password/tokens do not. A wrong current password returns 403 without changing credentials or signing out other sessions. Reusing the same password returns 422.

This is authenticated password change, not forgotten-password recovery. Email change, recovery and email verification remain separate pre-public-launch work. Requests authenticated before a password change/deactivation may already be in flight; subsequent authentication fails on revoked sessions. User-mutating profile/account services also recheck active state under the user lock.

## Deactivation policy

Deactivation preserves the user row and foreign keys. It does not delete or anonymize historical data, transfer physical ownership, resolve disputes or automatically reactivate on login. Retained email remains reserved, so signup with the same email is not an alternative account-reactivation route. No self-service reactivation endpoint is provided in this stage; returning-user recovery/reactivation needs a separately defined process. Removing a moderation restriction does not reactivate an account.

GET `/users/me/deactivation` returns:

```json
{"can_deactivate":false,"pending":1,"accepted":0,"waiting_confirmation":0}
```

Counts cover **both incoming and outgoing** exchanges. It is an informational snapshot; POST rechecks under the user lock shared with exchange creation/acceptance. Deactivation is denied with 409 if any exchange is PENDING, ACCEPTED or WAITING_CONFIRMATION. This includes due ACCEPTED rows until the expiry job actually settles them. Settle proposals with reject/cancel as appropriate, finish accepted handovers, or use support for unresolved handovers. Deactivation never silently cancels an exchange or bypasses book reservations.

No exchanges, or history consisting solely of COMPLETED, REJECTED, CANCELLED and EXPIRED, is allowed. Optional unsubmitted reviews and general reports/moderation records do not prevent leaving; they are not active exchanges.

POST `/users/me/deactivate`:

```json
{"current_password":"<current password>"}
```

Requires bearer authorization and trusted Origin/Referer. On success it atomically:

- Sets is_active=false and records deactivated_at.
- Archives listings published by this user, preventing browsing/new proposals.
- Disables membership participation; clears proof bytes/type/expiry. Pending proof is withdrawn (status NOT_SUBMITTED and submission_id cleared).
- Revokes all live sessions and clears the refresh cookie.

Response: 200 with deactivated_at. Clear frontend authentication and leave the signed-in area. Later login, refresh and authenticated requests fail. A retry with the now-revoked bearer returns 401; a successful earlier response need not be repeated to preserve the state.

Users cannot receive new exchange proposals because proposal/acceptance already revalidate active accounts under the same locks. Existing historical reviews, messages, notifications, reports and audit records remain stored. Background moderation/review publication may still create retained notification rows for historical events; this stage has no email/push delivery, and a deactivated user cannot sign in to retrieve notifications. Their past published review attribution is not erased.

All these changes share one transaction. If a write/session revocation fails, account state and listing archives roll back. PhysicalBook.owner_id is untouched. Future reactivation must not automatically restore listings or verification, and must respect independent moderation flags.

## Verification checklist

1. With two verified campus users, GET one combined profile: verify badge, campus, name, default avatar, count and null new-user trust. Check the response contains no email/proof/private account flags.
2. PATCH name/bio/interests/avatar while accepted: membership/campus remain unchanged. Test blank/null clearing rules, unknown IDs, overlong/duplicate tags and forged sensitive fields.
3. Open Books tab, paginate, and compare header active_listings. Hide/archive a listing or restrict its publisher: cards/count reflect visibility. Reserved published listings remain counted. Another campus and either-direction blocks must not leak books/profiles.
4. Expire/revoke membership, change selected campus or deactivate campus: badge must become false without relying on an expiry cleanup job. A restriction alone does not erase a verified-membership badge.
5. Attempt deactivation with outgoing/incoming PENDING, ACCEPTED and WAITING_CONFIRMATION: 409, still active. Completed/rejected/cancelled/expired histories allow deactivation. No exchanges also allows it.
6. Wrong password must not change account/listings/sessions. On successful password change/deactivation, check old access and refresh tokens across two sessions, cookie clearing and the login result.
7. After deactivation, check history/physical ownership still exist, publisher listings are archived, pending proof is gone, profile is hidden and a fresh proposal against a known old listing is denied.
8. Exercise simultaneous proposal/deactivation on PostgreSQL: either proposal wins and deactivation fails, or deactivation wins and proposal fails. Never leave an inactive participant with a newly created active exchange.

## Validation

121 tests passed; 107 PostgreSQL-dependent cases skipped because TEST_DATABASE_URL was not configured. This milestone adds 30 database-free cases and 18 PostgreSQL scenarios. Lint/format, Python compilation, OpenAPI generation (65 paths), offline migration upgrade/downgrade SQL and packaged/static avatar delivery were checked. Actual PostgreSQL migrations, schema-drift comparison, transaction rollback and concurrency tests still need PostgreSQL/CI.

From backend, use a dedicated database, not production credentials:

```powershell
$env:TEST_DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest tests -q
```

## Next stage

Backend readiness: run the full PostgreSQL suite/migrations, inspect permission/failure paths and scheduled jobs, finalize deployment/API configuration and document remaining launch gaps. Then build the mobile-first profile header and lazy Books/Reviews/About tabs against these contracts. WebSocket chat transport, password recovery/email verification, self-service reactivation and notification preferences remain separate work.
