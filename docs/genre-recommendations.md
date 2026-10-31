# Milestone 10: genre-based book recommendations

## Product decision

This is a small content-based discovery feature that fits the current backend. It gives a quick starting point without an ML service, embeddings, Redis, browsing surveillance or a new worker. A listed book is a preference hint, not proof of what its owner wants to read: people also list unwanted books. Exact catalog-matching reading interests provide an additional explicit hint. Treat improved retention as a hypothesis to evaluate with real use, not a guaranteed result.

The home screen can show up to five cards. Personalized genre matches come first; recent eligible campus listings fill remaining positions and are clearly labelled as discovery suggestions. If fewer than five eligible books exist, return fewer, including an empty list. Never pad with duplicates, another campus's books or unavailable listings.

## Upgrade from milestone 9

Copy the files listed in milestone-10-changes.md into your existing project. Preserve `.env` and your database. From `swappy/backend`:

```powershell
python -m alembic upgrade head
python -m alembic current
```

Expected revision: `0010`. Restart the API. No dependency, credential, environment or scheduler changes are required. Keep the existing jobs for exchanges, proof, sessions and review publication.

**API change:** new POST `/api/v1/books` and PUT `/api/v1/books/{book_id}` requests must include a valid `genre`. Old create/edit payloads now return 422. Archive and photo endpoints do not require a genre payload. A relisting also requires genre, even if the physical copy was previously classified.

```json
{
  "title": "A Campus Adventure",
  "author": "Example Author",
  "description": "A well-kept paperback.",
  "condition": "GOOD",
  "genre": "FANTASY",
  "condition_notes": "Small crease on the cover."
}
```

The migration adds nullable genre columns to BookListing and PhysicalBook, allowlist constraints, and recommendation/history indexes. It does not guess genres or label all old books OTHER. Old rows/collection entries return genre=null until legitimately edited or relisted. New API writes require a non-null catalog value; nullable storage preserves old data. Existing archived/reserved listings retain their edit restrictions: do not bypass those rules to backfill genre.

New edits keep physical-copy metadata in sync. Ownership transfer carries the physical genre without changing exchange logic. New proposal snapshots include genre; old snapshots are preserved exactly as recorded and remain readable without that field. Existing photo URLs, ownership, reservations and history are unchanged. Downgrading to 0009 removes genre metadata and indexes, so do not downgrade a populated deployment without a backup.

## Genre catalog

GET `/api/v1/books/genres` requires authentication but not profile completion. It returns 20 stable ID/name pairs. Use the ID in forms, not the display name. The schema also exposes these choices as an enum in Swagger.

```json
[{"id":"FANTASY","name":"Fantasy"},{"id":"SCIENCE_FICTION","name":"Science fiction"}]
```

Choices cover general fiction, fantasy, science fiction, mystery/thriller, romance, historical fiction, horror, poetry, comics/graphic novels, biography/memoir, history, science/technology, self-help, business/finance, philosophy, religion/spirituality, travel, academic/textbooks, children/young adult and OTHER. Each listing has one primary genre in this version. OTHER is a valid escape hatch; it is not treated as a personal interest match. Unknown IDs, null, missing or display-label values return 422.

Genres appear in listing responses, profile-books cards, own listings and physical collection responses. GET `/api/v1/books?genre=FANTASY` also supports an optional genre filter alongside the existing title/author query. Ordinary browsing keeps its existing visibility rules; recommendations apply stricter availability/publisher checks.

## Recommendation endpoint

GET `/api/v1/books/recommendations` requires an active authenticated user with a complete profile and active selected campus, like campus browsing. Membership verification is not required just to browse suggestions. A restricted/unverified viewer still has to satisfy the normal mutation rules before proposing an exchange.

Example response shape:

```json
{
  "items": [
    {
      "book": {
        "id": "<listing UUID>", "physical_book_id": "<copy UUID>",
        "owner_id": "<publisher UUID>", "campus_id": "<campus UUID>",
        "title": "A Campus Adventure", "author": "Example Author",
        "description": "A paperback", "condition": "GOOD",
        "condition_notes": "", "genre": "FANTASY",
        "is_hidden": false, "is_archived": false, "is_reserved": false,
        "photos": []
      },
      "reason": "GENRE_MATCH"
    }
  ],
  "preferred_genres": ["FANTASY", "HISTORY"],
  "preference_sources": ["LISTING_HISTORY", "READING_INTERESTS"],
  "strategy": "genre-recency-v1"
}
```

Items are capped at five on the server; no caller-supplied user ID, arbitrary maximum or pagination is exposed. Preferences belong to the authenticated user only. GET has no commit, reservation, notification or persisted recommendation side effect.

### Preference hints

1. Select the user's latest non-hidden listing per physical copy, then take the most recent 20 distinct copies. Archived historical listings count too, so completing exchanges does not erase all preferences. Copies may have been published in a previous campus; only the user's own genre hints carry over, never other-campus candidate books.
2. Take the known primary genres from those copies. Ignore null/OTHER. Multiple copies in one genre do not increase its weight, and repeatedly relisting one copy does not add votes. A later classification of the same copy replaces the older hint.
3. Add profile reading interests that match known genre IDs/labels after case/spacing/punctuation normalization. A small explicit alias list includes Sci-fi, mystery, thriller, biography, memoir, comics and textbooks. History and Science fiction work; arbitrary tags such as "Coffee" or "Fantasy novels" are not guessed or semantically classified. The profile's free-text tags are not changed.
4. If there are no known hints, all results are recent eligible discovery items with RECENT_AVAILABLE reasons.

This is not a learned preference model. Posting a book does not establish a definitive reading preference, and genre-only matching does not understand plot, language, age suitability or book quality. A future explicit preferred-genres setting could allow finer control. No such additional setting or inferred user field is introduced here.

### Eligible candidates

Candidates must pass the existing discoverable-listings policy and additional recommendation checks:

- Same selected campus; live, non-hidden listing.
- Publisher active and not participation-restricted.
- Publisher currently belongs to this campus and has active VERIFIED, matching, unexpired membership (using the existing policy's nullable-expiry semantics).
- Physical copy is still owned by the publisher and is not reserved.
- Neither the listing nor physical copy belongs to the viewer.
- No block in either direction.
- No active PENDING/ACCEPTED/WAITING_CONFIRMATION exchange involving this viewer and this listing. Avoid suggesting the book they already requested.
- Not a physical copy the viewer has previously listed, even if another user now owns/relisted it. This avoids recommending their own giveaway back; ordinary browsing can still find it.

Physical-copy identity is used, not title. Two different copies with the same title may both be eligible; this version does not collapse titles, limit each publisher to one result, or promise genre diversity.

### Ranking

Sort all eligible candidates by:

1. Matching any preferred genre first.
2. Listing created_at descending within matches and within fallback items.
3. Listing UUID descending to resolve timestamp ties deterministically.

Then LIMIT 5 in PostgreSQL, eagerly loading photos for the returned cards. Matching items receive GENRE_MATCH; others RECENT_AVAILABLE. Legacy null-genre and OTHER books may appear as recent fallback, but never as genre matches. There are no scores presented as probabilities or unexplained confidence percentages.

Fetching again with unchanged data yields the same order. New listings or state changes can alter it. Eligibility is a read snapshot: proposal creation still rechecks current membership, blocks, ownership and reservations under transaction locks. Another student may reserve a recommended copy before the viewer acts. Refresh after actions; do not reserve books merely because they were recommended.

## Frontend use

Load the genre catalog for the listing form and require selection. For legacy editing, show a selection prompt when genre is null. Prefill relisting from collection metadata when known but still send the required genre.

Load recommendations once for the home/Browse starting section. Use returned book objects/photos directly instead of one detail request per card. "Based on your genres" is appropriate for GENRE_MATCH; "Recently available on campus" is appropriate for RECENT_AVAILABLE. With no hints, label the section "Explore campus books". Hide the section or show a browse empty state if items is empty. All-match supply returns five matches; sparse supply can return mixed matches/discovery or fewer than five. Do not claim all cards match the user's tastes.

No frontend, ML model, click tracking, email/push, recommendation notifications, user feedback buttons or cache is included. Measure useful discovery and successful proposals before considering more elaborate ranking.

## Manual verification

1. Create/edit without genre: 422; invalid/null genre: 422. Use a catalog ID: saved in listing and physical metadata. Verify browse filtering and genre in new proposal snapshots.
2. Give the viewer an ACADEMIC listing, create older ACADEMIC candidates and newer ROMANCE candidates: matches appear first; newest matches lead. More than five eligible candidates still returns at most five.
3. Use an account with no listings. Add reading interest History or Sci-fi: corresponding genre matches lead. Unknown tags do not produce false matches. Remove all known hints: recent-campus fallback.
4. Archive a preference-source listing: history still contributes. Relist the same copy with another genre: only its latest classification contributes. Old null genres do not break responses. Completing an exchange does not rewrite its old snapshot.
5. Reserve, hide, archive, block, restrict or deactivate a candidate's publisher; expire/revoke membership or change campus: affected candidates disappear. Existing pending requests should not be suggested again.
6. Complete an exchange and have the recipient relist the viewer's old physical copy: it is not recommended back to that viewer. Another eligible viewer can still discover it.
7. Empty/sparse campus: fewer than five or empty is valid; no other-campus leakage or duplicate padding. Expired/revoked viewer auth fails normally; incomplete profile cannot access recommendations.
8. Exercise simultaneous reservation/block/membership changes on PostgreSQL; recommendation reads do not replace proposal-time checks.

## Validation

136 tests passed; 126 PostgreSQL-dependent tests skipped because TEST_DATABASE_URL was not configured. This milestone adds 15 database-free and 19 PostgreSQL API cases. Existing book input fixtures now supply the required genre; the historical migration test also asserts old listing/physical genres remain null. Query compilation, lint, format, OpenAPI generation (67 paths), Python compilation and offline migration upgrade/downgrade SQL were checked. Actual PostgreSQL migration/query execution, metadata drift, query plans and database concurrency still require PostgreSQL/CI.

From backend, use a dedicated test database:

```powershell
$env:TEST_DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest tests -q
```

## Next stage

Backend readiness: full PostgreSQL suite and migrations, permission/failure paths, scheduled jobs, deployment configuration and stable frontend API contracts. Recommendations are complete as a genre/recency MVP; more ranking signals should follow real usage rather than delay the frontend indefinitely.
