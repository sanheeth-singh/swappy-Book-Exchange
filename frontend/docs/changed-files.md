# Stage 5 file changes

Compared with swappy-stage-4.zip: **30 added**, **25 updated**, no source files removed. Backend files are unchanged.

New route groups/folders are created by the added files below. New generated API models are unnecessary because the existing contract already defines these operations.

## Added

- `docs/stage-5.md`
- `src/app/(account)/layout.tsx`
- `src/app/(account)/notifications/page.tsx`
- `src/app/(member)/readers/[userId]/page.tsx`
- `src/app/(member)/safety/page.tsx`
- `src/app/(member)/safety/report/page.tsx`
- `src/app/(member)/safety/reports/[reportId]/page.tsx`
- `src/components/cards/book-gallery.tsx`
- `src/components/layout/account-shell.tsx`
- `src/components/ui/image-picker.tsx`
- `src/components/ui/photo-remove-button.tsx`
- `src/components/ui/protected-image-preview.tsx`
- `src/features/blocking/api.ts`
- `src/features/blocking/components/safety-actions.tsx`
- `src/features/chat/api.ts`
- `src/features/chat/components/chat-panel.tsx`
- `src/features/notifications/api.ts`
- `src/features/notifications/components/notification-link.tsx`
- `src/features/notifications/screens/notifications-screen.tsx`
- `src/features/reports/api.ts`
- `src/features/reports/screens/report-detail-screen.tsx`
- `src/features/reports/screens/report-form-screen.tsx`
- `src/features/reports/screens/safety-screen.tsx`
- `src/features/reviews/api.ts`
- `src/features/reviews/components/exchange-review-panel.tsx`
- `src/features/reviews/screens/reader-screen.tsx`
- `src/lib/utils/image-selection.ts`
- `tests/stage5-api.test.ts`
- `tests/stage5-images-dom.test.ts`
- `tests/stage5-policies.test.ts`

## Updated

- `README.md`
- `contracts/api-coverage.json`
- `docs/api-coverage.md`
- `docs/architecture.md`
- `docs/changed-files.md`
- `docs/design-system.md`
- `docs/development-plan.md`
- `docs/validation.md`
- `scripts/smoke.mjs`
- `src/components/layout/header.tsx`
- `src/features/administration/screens/membership-review-screen.tsx`
- `src/features/blocking/README.md`
- `src/features/books/components/listing-card.tsx`
- `src/features/books/components/photo-upload.tsx`
- `src/features/books/screens/book-detail-screen.tsx`
- `src/features/books/screens/book-editor-screen.tsx`
- `src/features/chat/README.md`
- `src/features/exchanges/screens/exchange-detail-screen.tsx`
- `src/features/membership/screens/membership-screen.tsx`
- `src/features/notifications/README.md`
- `src/features/profile/screens/profile-screen.tsx`
- `src/features/reports/README.md`
- `src/features/reviews/README.md`
- `src/styles/globals.css`
- `tests/photo-preview-dom.test.ts`

## Archive root

- `INSTALL-STAGE-5.md` — installation instructions.

The automatic `next-env.d.ts` update reflects Next production type generation. Dependencies and their lockfile are unchanged.
