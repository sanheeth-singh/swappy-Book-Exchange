# Milestone 11 changes (from genre recommendations milestone 10)

Paths are relative to `swappy/`.

## Added

| Path | Purpose |
|---|---|
| `backend/app/api/v1/public_books.py` | Anonymous preview list/search API with bounded paging |
| `backend/app/modules/books/preview.py` | Shared capped pool, live eligibility, minimal projection and owner-controlled consent |
| `backend/app/modules/books/preview_schemas.py` | Public field allowlist, preview metadata and strict consent input |
| `backend/migrations/versions/0011_public_book_preview.py` | Opt-in default false and partial index |
| `backend/tests/unit/test_public_preview.py` | Cap-before-filter, privacy, strict input, anonymous ASGI and withdrawal cases |
| `backend/tests/api/test_public_preview.py` | PostgreSQL opt-in, cap, eligibility and permission scenarios |
| `docs/visitor-preview.md` | Setup, contracts, disclosure rules and verification |
| `docs/milestone-11-changes.md` | This manifest |

## Updated

| Path | Purpose |
|---|---|
| `backend/app/api/v1/router.py` | Register separate public router |
| `backend/app/api/v1/books.py` | Authenticated owner consent PATCH action |
| `backend/app/modules/books/models.py` | Publication-specific opt-in field and index |
| `backend/app/modules/books/schemas.py` | Optional create-time opt-in and authenticated response flag |
| `backend/tests/integration/test_exchange_migration.py` | Verify no existing publication is opted in by migration |
| `README.md`, `docs/scope.md` | Current milestone and next-stage status |

No campus-management, CLI, membership-policy, auth, recommendation, exchange transfer/reservation service, avatar, dependency, environment or scheduled-job changes. Normal metadata edits and preview consent are separate. Legacy snapshots remain readable; new private snapshots may include the preview flag through the existing presenter.
