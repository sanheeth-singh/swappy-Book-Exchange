# Milestone 10 changes (from profiles/accounts milestone 9)

All paths are relative to `swappy/`.

## Added

| Path | Purpose |
|---|---|
| `backend/app/modules/books/genres.py` | Stable 20-genre catalog and explicit interest matching |
| `backend/app/modules/books/recommendations.py` | Bounded preference-history query, eligibility filters and top-five ranking |
| `backend/migrations/versions/0010_genre_recommendations.py` | Nullable legacy genre columns, allowlist constraints and two indexes |
| `backend/tests/unit/test_recommendations.py` | Required genres, legacy compatibility, source selection, read-only responses and SQL checks |
| `backend/tests/api/test_recommendations.py` | PostgreSQL ranking, cap, cold start, visibility, history and transfer scenarios |
| `docs/genre-recommendations.md` | Upgrade, catalog, algorithm, edge cases and integration guide |
| `docs/milestone-10-changes.md` | This manifest |

## Updated

| Path | Purpose |
|---|---|
| `backend/app/modules/books/models.py` | Physical/listing genre fields, constraints and query indexes |
| `backend/app/modules/books/schemas.py` | Required input genre, legacy-safe output genre, catalog and recommendation contracts |
| `backend/app/modules/books/service.py` | Synchronize physical metadata on create/edit/relist |
| `backend/app/api/v1/books.py` | Genre catalog, recommendations and optional browse genre filter; static routes before book UUID |
| `backend/tests/api/test_books.py` | Shared valid book payload now includes genre |
| `backend/tests/unit/test_book_images.py` | Existing validation fixture now includes genre |
| `backend/tests/integration/test_exchange_migration.py` | Old classifications remain unknown through upgrade |
| `README.md`, `docs/scope.md` | Current milestone and next stage |

No earlier migration, auth, user/profile fields, scoring formula, exchange transfer/reservation service, notifications, avatar assets, dependency or environment changes. Old proposal snapshots are not rewritten; new snapshots automatically include genre through the existing book response presenter.
