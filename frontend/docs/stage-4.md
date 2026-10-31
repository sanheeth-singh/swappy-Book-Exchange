# Stage 4 — Exchange workflows and book-photo refinements

## Install

Start from your working Stage 3 project. Back up source and merge only the listed backend patch files into the existing backend. Do not replace the whole backend folder or discard existing migrations. Activate the existing backend virtual environment, then run:

```powershell
python -m alembic upgrade head
```

Revision 0013 adds the photo_deletion_tasks cleanup queue. It does not reset existing book/user data. Restart FastAPI after migration. Replace/update frontend source while preserving .env.local, run npm ci and npm run dev. Keep the Stage 3 proxy settings:

```env
NEXT_PUBLIC_API_URL=/api/v1
API_ORIGIN=http://127.0.0.1:8000
```

Frontend remains http://localhost:3000; backend remains http://127.0.0.1:8000.

## Delivered

- /books/[bookId] offers an eligible, available own listing for the requested campus book. Selector pagination uses the existing My Books API. Backend rechecks ownership, same-campus membership, availability and duplicate proposals.
- /exchanges displays sent/received proposal pages with participant-relative You give / You receive summaries and status labels.
- /exchanges/[exchangeId] supports accept/reject/cancel, physical receipt confirmation, issue creation/history and current reservation/deadline feedback. Destructive/receipt actions use the shared confirmation dialog.
- Waiting for confirmation cannot be normally cancelled; a participant who already confirmed cannot confirm again. Open issues block ordinary confirmation; the server remains authoritative. Terminal states expose no mutation controls.
- Existing handover pages deliberately do not require current verification just to view/confirm. Acceptance and new proposals are rechecked by the backend; membership expiry must not block an existing handover unnecessarily.
- Exchange mutations refresh books/collection, exchanges, preview and administration caches. Backend responses determine status; the browser does not invent EXPIRED when a deadline passes. Details refresh periodically and have a manual refresh action. Run the existing expire_exchanges job as in the backend's prior setup.
- Signed-in students get Discover links, visitors get Explore and administrators get Administration. Header, homepage actions and footer use the central discovery decision. The mobile dock is Discover / My Books / Exchanges / Profile; Collection remains accessible from My Books.
- Catalog owner exclusion occurs before backend pagination. Same-campus restrictions remain in place. Recommendations already excluded owned copies; frontend defenses apply to catalog and recommendations too. My Books still shows owned listings.
- Selected photos render a local blob preview before upload, can be cleared, retain selection on upload failure and revoke temporary URLs after replacement/unmount. Uploaded listing photos have a confirmed delete action when editable/eligible.

## Photo removal contract

DELETE /api/v1/books/{book_id}/photos/{photo_id} returns 204 after the listing photo has been removed. Only the verified owner of an editable, unreserved listing can remove its photo. Photo/book mismatches return 404; foreign owners and locked listings cannot bypass checks. Pending proposals are invalidated just as with editing/adding photos.

Database photo removal and a cleanup task commit in one transaction. Normal ImageKit cleanup is attempted immediately with a bounded timeout. If storage or the process fails, the queue retains the file identifier for retry; an already-deleted remote file is treated as success. No ImageKit private keys enter the frontend.

Run periodically using your existing backend job runner:

```powershell
python -m app.jobs.cleanup_book_photos
```

It processes a bounded batch; run again/schedule periodically for larger backlogs. This release supplies the worker but does not configure a scheduler on your computer. Revision 0013 refuses downgrade while cleanup tasks remain, preventing loss of retry metadata.

## ESLint warning

ESLint 9 reached EOL according to https://eslint.org/version-support/. ESLint 10 was tested, but the current eslint-config-next dependency tree contains React, import and accessibility plugins whose peer ranges stop at 9. It was reverted rather than using --force, legacy-peer-deps or discarding checks. npm ci, lint and build pass with the compatible v9 lockfile. The deprecation warning remains a tracked developer-tool limitation; it is not an application runtime failure.

## Verification and local acceptance

Passed here: 27 frontend tests, TypeScript/lint, build, guarded route HTTP checks and proxy fixture checks; 172 backend unit tests and Ruff. The new backend API and PostgreSQL migration tests are included but were not executed against PostgreSQL in this environment. No live ImageKit asset was deleted here.

Use two verified students on one campus and a third on another campus:
1. Discover must show peer-campus books, never your own or the third campus's books. Your own books remain in My Books.
2. Choose a JPEG/PNG/WebP, inspect the local preview, clear/replace it and upload. Delete an uploaded photo; check that a new photo can use the released slot. Try a reserved listing and a foreign photo ID: the backend must deny changes.
3. Propose one own book for the other student's listing. The recipient accepts. Both copies become reserved and competing proposals close.
4. Confirm receipt as one participant: status becomes waiting. Confirm as the other: completed; physical ownership transfers and original listings archive.
5. Raise an issue on an unresolved accepted exchange. Ordinary confirmations must stop until resolution; use the existing admin issue desk to resolve it.
6. Check rejection, requester withdrawal and accepted cancellation before any receipt confirmation. Check that expired/completed states have no action buttons.

Fast backend checks:

```powershell
python -m pytest -q tests/unit/test_photo_removal.py tests/unit/test_migration_history.py
```

With the existing dedicated TEST_DATABASE_URL configured, run the targeted PostgreSQL checks:

```powershell
python -m pytest -q tests/api/test_discovery_ownership.py tests/api/test_book_photo_deletion.py --require-postgres --migrated-schema
```

## Next stage

Stage 5: accepted-exchange chat using the backend's HTTP chat API, read/unread behavior, notifications, post-completion reviews/reputation and safety interactions. Remaining account/moderation operations stay inventoried for the final administration/readiness milestone.
