# Stage 3 — Books and separate administration

## Install order (required)

1. Stop the frontend dev server and back up your current frontend.
2. Apply the backend response change before using this frontend: add `is_admin: bool` to `UserResponse` in backend/app/modules/users/schemas.py. The exact updated file is included under backend/ in this package; merge that one file, not the entire backend directory. If you changed that schema locally, merge only the new field.
3. No migration or database reset is needed: User.is_admin already exists. Restart FastAPI. GET /api/v1/users/me should now include is_admin for both administrators and students. Existing admin accounts keep their current flag; this package does not create/promote an administrator.
4. Replace the frontend source and preserve your .env.local. Set NEXT_PUBLIC_API_URL=/api/v1 and API_ORIGIN=http://127.0.0.1:8000 in it. Remove/replace the old absolute NEXT_PUBLIC_API_URL setting.
5. Run npm ci, then npm run dev. Open http://localhost:3000. Backend stays at http://127.0.0.1:8000. Sign in again after switching to the proxy.

## Why the proxy

localhost and 127.0.0.1 are different browser sites. Direct cross-site requests may authenticate with a returned access token while refresh-cookie restoration fails. Next rewrites the relative /api/v1 path to FastAPI. Browser cookies now belong to the frontend host and remain same-site, HttpOnly, and path scoped. Origin is preserved, so the backend must continue trusting http://localhost:3000 (its supplied default already does). No wildcard CORS or SameSite security weakening is needed. In deployment set API_ORIGIN to the reachable backend origin and configure trusted frontend origins/HTTPS accordingly.

## Roles

Current user data is fetched from the authenticated backend and must include a boolean is_admin. Unknown/missing role fails with an explicit backend-update error. Roles are not inferred from email, token decoding, localStorage, or a failed permission probe. Backend permissions still enforce every administrator operation.

Login sends administrators directly to /admin, even with no display name, campus or student verification. Student routes redirect administrators to their workspace; admin routes redirect students to /books or /profile. The admin layout has its own navigation and no student enrollment gate.

## Student routes

- /books: campus search, genres, pagination and server recommendations.
- /books/[bookId]: details, condition notes and photo gallery.
- /my-books: listing management, including archived/reserved records.
- /my-books/new: create a physical copy and listing or relist an owned collection copy.
- /my-books/[bookId]/edit: edit, add up to three photos, archive and manage public-preview consent.
- /collection: physical copies currently owned, with relist links.

Browse requires a completed name/campus. Publication eligibility is checked before showing create/edit controls and the server rechecks mutations. Archive and public-preview withdrawal remain available where the backend permits them after verification expiry. Reserved/hidden/archived records are not offered normal edit controls. Management resolves owned records via the paginated My Books operation because the discovery detail endpoint excludes hidden/archived records; no undocumented private-detail endpoint is invented.

Photos are separate multipart POSTs after creation, so an upload failure does not create a second listing. Static JPEG/PNG/WebP up to 5 MiB; backend checks dimensions/animation and limits to three. No photo-delete endpoint exists, so no removal action is fabricated. Backend ImageKit credentials stay on the backend.

Public /explore remains separate. Student exchange proposals are Stage 4, so details explain that rather than exposing a nonfunctional request button.

## Administrator routes

- /admin: real queue snapshots, explicitly labelled as bounded returned lists rather than global statistics.
- /admin/memberships: up to 100 pending proofs, authorized document download, approve with future timezone-aware expiry, reject with a reason, backend/self-review restrictions.
- /admin/directory: paginated colleges/campuses, creation/editing with reasons, impact inspection, password-confirmed activation/deactivation and paginated audit history. College IDs are displayed so a new campus can be linked to an existing college on any directory page.
- /admin/issues: paginated open handover issues, administrator exchange details and complete/cancel resolution with a reason and ownership-effect acknowledgment. Self-resolution is blocked in the UI and by the backend.

General report moderation, review moderation and account/session administration remain the later administration-hardening milestone. They are not claimed as implemented here. Dashboard links point only to working routes.

## Acceptance checks

- Sign in as an existing administrator without setting a student campus: arrive at /admin. Try /profile and /membership: redirect to /admin. Sign in as a student and try /admin: redirect to the student area, without fetching admin queues.
- Reload a signed-in page on localhost:3000 and verify the proxy refresh cookie restores the session. In network tools calls should go to localhost:3000/api/v1, not direct cross-site 127.0.0.1 URLs.
- As a verified student create a listing, upload a photo, edit, toggle preview, archive and relist a collection copy. Test reserved and expired-verification errors.
- Use two students to check same-campus catalog filtering. Verify /explore only shows owner-consented eligible public listings.
- Review a submitted proof from the administrator queue and refresh the student membership screen.
- Create/edit a test directory entry, review impact, confirm a status change with password and inspect the audit record. Test duplicate labels and bad passwords.
- Resolve a disposable open exchange issue and verify the expected reservation/ownership outcome. Completing an exchange transfers books; cancellation does not.

## Next stage

Stage 4: student exchange proposals, offered-book selection, sent/received views, accept/reject/cancel, reservation/expiry feedback, handover receipt confirmations and issue creation. Follow with chat/notifications/reviews and the remaining moderation/account endpoints.
