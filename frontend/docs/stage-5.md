# Stage 5 — communication, trust and shared UI refinements

## Installation

Use the complete frontend source in this archive. Stop the development server, back up your current frontend, and merge/replace source files. Preserve `.env.local`; do not copy `.next` or `node_modules`. Run `npm ci` and `npm run dev`. Keep the Stage 4 backend and its applied 0013 migration/cleanup worker. No backend changes are included or required in this stage. Backend: `http://127.0.0.1:8000`; frontend: `http://localhost:3000` through the existing same-origin API rewrite.

## Implemented behavior

- Book editor accepts up to the remaining three-photo capacity in one selection, previews each file and submits the batch with one action. The existing backend endpoint is called sequentially. Successful files are removed; a failed file and unsubmitted files remain selected for retry. There is no bulk endpoint or all-or-nothing transaction.
- Existing photo deletion uses a shared X overlay, red hover/focus and Delete tooltip, with confirmation. Selected but unuploaded images can be removed locally.
- Book detail presents one active photo with stacked backplates, previous/next controls and thumbnails. Empty/missing images keep the existing cover fallback.
- Enrollment form previews selected proof before submission. Administrator queue fetches proof securely and displays it inline; temporary blob URLs are revoked on close/unmount. Optional download remains available.
- Shared secondary/ghost action buttons have surfaces, borders and shadows from global tokens. Listing-card View book/Manage actions and detail navigation use ButtonLink.
- Exchange chat loads cursor-paginated history, polls during active exchanges, displays read receipts and offers explicit Mark conversation read. Sending is controlled by the server's can_send flag. Uncertain retries preserve the same message ID/body; chat history remains read only after closure.
- Notifications provide paginated history, unread count, mark-one and watermark-based mark-all. Students and administrators keep separate shells and supported destinations. Unimplemented moderation destinations do not create dead links.
- Completed exchanges offer one immutable review within the server's review window (normally 14 days). Publication is delayed until both reviews arrive or backend window processing runs. Reader profiles show public reviews and actual reputation; absent trust scores are not fabricated.
- Reader/exchange controls offer blocking and contextual reports. Safety provides paginated blocks, unblock actions, own report history and report detail. Blocking preserves accepted reservations and handover responsibilities.

## Manual acceptance in VS Code

1. With 0 listing photos, select three files at once; inspect previews; remove one; select again and submit. Check all three persist. With two saved photos, verify only one additional selection is allowed. Simulate a failed upload and retry without resending successful files.
2. Delete a saved photo using its X; verify red hover/keyboard focus, Delete tooltip, confirmation and restored capacity. Open a book with three photos and switch between all images.
3. Submit proof after inspecting its preview. Sign in as an administrator, preview the pending ID inside the queue and record a decision. Close/reopen the preview and verify errors after a proof expires are understandable.
4. With two student sessions, accept an exchange and open its conversation. Send, refresh, retry after a network interruption, load earlier history, and mark read. Confirm no duplicate send on retry and read receipt update. Close the exchange and verify history is read only.
5. Trigger exchange/membership notifications. Open the inbox as student and administrator; test individual read and mark current notifications read. A new notification arriving after the submitted watermark must remain unread.
6. Complete an exchange and submit reviews from both participants. Verify publication and reputation changes. Check a reader without enough history shows no invented trust score.
7. Block a reader; verify pending proposals/new interactions follow backend rules while accepted exchanges remain accessible. Unblock from Safety. Report a reader/listing and check own report detail; Other needs at least ten characters.
8. Check 320/360/390/768/1280px widths, keyboard focus, labels, scrolling and mobile dock clearance. No browser layout/live backend acceptance was executed in this environment.

## Following stage

Stage 6: account password/session management/deactivation, extended profile features, report moderation, restrictions/restoration, review moderation and audit history. The API inventory remains the source of truth for remaining operations. Stage 7 handles full browser/accessibility/production readiness.
