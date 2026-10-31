# Milestone 11: visitor book preview

## Upgrade from milestone 10

Copy the files listed in milestone-11-changes.md into your project, preserving `.env` and your database. From `swappy/backend`:

```powershell
python -m alembic upgrade head
python -m alembic current
```

Expected revision: `0011`. Restart the API. No dependency, secret, environment or new scheduled job is required. The additive migration adds `book_listings.allow_public_preview`, default false, plus a partial index. All existing listings remain private. An empty visitor preview immediately after upgrade is expected until eligible owners opt in; never display fabricated inventory to fill it.

Previous migrations, ownership/reservation rules, memberships, recommendations, private browsing, profiles, chat and reviews remain unchanged. Downgrading removes the stored preview permissions and index; a later upgrade starts private again.

## Public endpoint and response

GET `/api/v1/public/books` needs no account, bearer token or refresh cookie. It is a separate read-only endpoint, not optional authentication on the normal book API.

Query parameters:

| Parameter | Rule |
|---|---|
| limit | 1–20; default 20 |
| offset | 0–100; default 0 |
| q | Optional title/author substring, at most 200 characters; trimmed and case-insensitive |
| genre | Optional existing catalog ID, e.g. FANTASY |

Search treats characters such as `%` and `_` literally, not as database wildcards. Whitespace-only search means no search. There is no visitor-controlled campus, owner, ordering or detail lookup. Additional unsupported query parameters do not expand the pool.

Example response:

```json
{
  "items": [
    {
      "id": "<listing UUID>",
      "title": "A Campus Adventure",
      "author": "Example Author",
      "genre": "FANTASY",
      "condition": "GOOD",
      "cover_url": "https://<public image delivery URL>"
    }
  ],
  "total": 1,
  "next_offset": null,
  "preview_limit": 100,
  "genres": [{"id":"FANTASY","name":"Fantasy"}],
  "registration_message": "Register to explore books in your selected campus."
}
```

The actual genres array contains all 20 generic catalog options, allowing the visitor filter UI to work without accessing the authenticated genre endpoint. A missing cover or legacy genre is null. The cover is the first photo by created_at/id; no photo IDs, file IDs or additional photos are returned. Listing UUID permits card deduplication but does not authorize access to private details.

The explicit PublicBookCard schema allows only ID, title, author, genre, condition and cover URL. It does not inherit BookResponse. It omits owner IDs/names/emails, physical-copy IDs, campus/college IDs or names, descriptions, condition notes, internal flags, proof, profiles and exchange information. Do not assume free-text titles or user-selected photos are anonymous: the publisher is explicitly choosing internet visibility for that content.

GET `/api/v1/public/books/{id}` does not exist. Normal `/books`, `/books/{id}`, recommendations, profile and exchange endpoints retain their authentication/campus/participant checks.

## Shared pool: what the 100 limit means

Each request first selects the newest **100 currently eligible opted-in listings across the platform**, ordered created_at descending then UUID descending. Only minimal preview columns and the first cover URL are fetched in one database query. Then title/author search, genre filtering and pagination run on that bounded in-memory snapshot. No caller filter is applied before the cap.

`total` is the number matching the visitor's filters **inside that pool**, never a count of the full database. next_offset is null when no more filtered cards remain. offset=100 returns an empty page. limit>20 and offset>100 return 422. A book ranked 101st cannot be discovered by searching for its exact title or genre. Every visitor sees the same candidate pool when catalog state is unchanged; no different pool is generated per search, campus, account or cookie.

This is a cap on the current preview, not a promise that an anonymous person can view only 100 distinct books for their lifetime. New listings, reservations, moderation, expiry or consent withdrawal change the pool, and another eligible book can enter it. Offset pagination can shift between requests when the underlying catalog changes; deduplicate by listing ID and refresh the first page when needed. This is not an anti-scraping identity/quota mechanism.

The preview may contain books from participating campuses other than a visitor's future selected campus. It intentionally does not disclose campus associations or promise these particular books will be available to them. Registration unlocks browsing in the selected campus; verification is still required to initiate/accept exchanges.

## Eligibility

A listing enters the public pool only when all conditions hold at query time:

- The publisher explicitly set allow_public_preview=true.
- The listing is not archived, hidden or physically reserved.
- The publisher is active and not participation-restricted.
- The publisher currently belongs to the listing's campus, which is active.
- Membership is active and VERIFIED for that same campus, with no reached expiration (using the existing nullable-expiry policy).
- The physical copy is still owned by that publisher.

These checks happen on every request and need no cleanup job/cache invalidation to remove an ineligible listing from a new response. Reservation hides a book; cancellation/expiry can make it eligible again if the listing is still live and consent remains. Completion archives the old listings. A recipient's new relisting defaults private and never inherits the previous publisher's permission.

The preview is genuinely public. A personal block cannot prevent anonymous visitors from seeing an opted-in card, even if the visitor is a blocked person using another browser. Passing a bearer token to this endpoint does not turn it into a private feed or apply personal block rules. Normal signed-in browsing/chat still enforce blocks. Publishers who need campus-only visibility should leave preview sharing off.

## Publisher control

Book creation accepts the optional strict boolean `allow_public_preview`; omission defaults false:

```json
{
  "title": "A Campus Adventure",
  "author": "Example Author",
  "description": "Study copy",
  "condition": "GOOD",
  "genre": "FANTASY",
  "allow_public_preview": true
}
```

For an existing listing, PATCH `/api/v1/books/{book_id}/public-preview` with bearer authorization:

```json
{"allow_public_preview":true}
```

Use false to withdraw. Only the original listing publisher may change this permission; other users/admins acting as unrelated users receive 404. The route returns the normal authenticated BookResponse, now including allow_public_preview. Strict booleans are required: strings, null and 0/1 return 422. Existing authenticated listing responses/snapshots without the field remain readable with default false.

Enabling requires active verified participation, an active selected campus and an editable, non-reserved listing. Withdrawal requires only an active authenticated owner: it remains available after membership expiry, restrictions, campus inactivity, reservation, hiding or archiving. It does not require publishing eligibility. No listing details, ownership, reservation, pending proposal or handover state change when this permission changes.

Normal PUT book edits preserve this separately managed permission. Title, author, genre, condition and first-photo updates to a still-public eligible listing can appear in later public responses. When changing public content to something intended to be private, withdraw sharing **before** editing it. This stage does not add a PUT consent field; use the dedicated PATCH action. Relisting is a new publication and requires a fresh opt-in.

Frontend checkbox wording should clearly explain the effect, for example:

> Allow this listing's title, author, genre, condition and cover photo to appear in the public visitor preview, outside my campus.

The initial checkbox must be unchecked. Keep an obvious way to withdraw sharing. Do not silently opt existing listings in during frontend migration, account setup or administrative restoration.

Withdrawal excludes the book from subsequent eligible API results. The API uses the application's existing no-store headers and no server-side preview cache. This cannot recall already downloaded metadata/photos, screenshots or third-party copies. ImageKit book image URLs already use public delivery; withdrawing preview permission does not delete the image used by the private listing/history.

## Frontend visitor flow

Show book cards, optional title/author search and genre filtering, with pagination within the preview. When empty, accurately say there are no matching public-preview books rather than claiming there are no books on the platform. Show a persistent registration CTA and the message:

> Register to explore books in your selected campus.

No anonymous proposal, owner-contact button, profile navigation or private detail fetch should be offered. Clicking a book can open a client-side card view using the same limited fields or lead to registration. The frontend chooses its registration route; no backend redirect/registration URL is embedded. This milestone contains backend contracts, not the visitor UI.

## Verification

1. Upgrade: existing books have sharing off, visitor endpoint returns empty, private APIs remain 401 without auth.
2. Enable an eligible owner's listing: anonymous preview returns only the six public fields. Check a cover and a no-cover book; descriptions, owner/campus IDs and photo metadata must be absent.
3. Create with opt-in true and with omission; only the explicitly shared eligible publication appears. Another user cannot change the flag.
4. Seed 105 eligible opted-in books. Preview has 100 at most across five pages. Searching/filtering for the oldest excluded five must return no results, even with their exact titles/genre. Invalid page bounds return 422.
5. Hide/archive/reserve the listing, deactivate/restrict its publisher, change campus or expire/disable membership: the book disappears from new public results. Wrong physical ownership is also excluded.
6. Withdraw while reserved/hidden/archived/ineligible: it must succeed for the signed-in owner and stay withdrawn after other state is restored. Consent changes must not cancel pending proposals.
7. Test anonymous/private access separately. Blocks affect private browsing, not public opt-in cards. Public detail/profile routes must not be introduced accidentally.
8. Confirm ordinary metadata edits preserve consent and new recipient relistings do not inherit consent. Existing exchange snapshots and photo URLs remain unchanged.

## Validation and operational limits

145 tests passed; 146 PostgreSQL-dependent cases skipped because TEST_DATABASE_URL was not configured. This milestone adds nine database-free cases (including a real ASGI anonymous/validation contract) and 20 PostgreSQL API scenarios. The populated migration test now also verifies old listings remain opted out. Lint/format, Python compilation, OpenAPI generation (69 paths), PostgreSQL query compilation and offline migration upgrade/downgrade SQL were checked. Actual database migrations, metadata comparison and database eligibility/concurrency cases still need PostgreSQL/CI.

Before public deployment, backend readiness must cover request rate limits/abuse controls and query plans for this unauthenticated database-backed route. Result bounds and CORS do not replace request throttling or prevent scraping. No new limiter, Redis/cache, anonymous identity tracking, email/push channel or scheduler is included in this milestone.

From backend, run all tests against a dedicated PostgreSQL test database:

```powershell
$env:TEST_DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest tests -q
```

## Campus administration: current state and next discussion

No campus-management implementation changed in this milestone. Currently:

- GET `/api/v1/campuses` lists active campuses for signed-in users.
- Trusted local CLI `python -m app.cli add-campus --college "College name" --campus "Main campus" --city "City"` finds/creates a college, creates a campus and prints its generated UUID. Repeat for additional campuses/colleges. Existing campus IDs need not change.
- There are no admin HTTP endpoints for adding, editing, disabling or deleting colleges/campuses yet. The current CLI does not provide a full duplicate-management/audit workflow.

The next separate discussion should define admin campus/college creation, duplicate validation, stable IDs, audited changes and password-confirmed soft deactivation instead of hard deletion of referenced rows. Password confirmation supplements administrator authorization; it does not replace it. Campus shutdown also needs explicit handling of memberships, listings, new exchange actions and unresolved handovers. Then proceed to the full backend-readiness stage.
