# Milestone 8 changed files (from exchange chat milestone 7)

Paths are relative to `swappy/`.

## Added

| Path | Purpose |
|---|---|
| `backend/app/modules/reviews/__init__.py` | Reviews module |
| `backend/app/modules/reviews/models.py` | Reviews, constraints, indexes, moderation audit |
| `backend/app/modules/reviews/schemas.py` | Validated submission, own/public responses, reputation, moderation contracts |
| `backend/app/modules/reviews/policies.py` | 14-day window, versioned distinct-reviewer trust formula |
| `backend/app/modules/reviews/service.py` | Submission rights, delayed publication, lists, reputation, audited visibility changes |
| `backend/app/api/v1/reviews.py` | Seven review/reputation/moderation endpoints |
| `backend/app/jobs/publish_reviews.py` | Scheduled due-publication entry point |
| `backend/migrations/versions/0008_reviews_reputation.py` | Two additive tables; previous migrations unchanged |
| `backend/tests/unit/test_reviews.py` | Strict input, formula, publication boundary and failure checks |
| `backend/tests/api/test_reviews.py` | PostgreSQL permission, privacy, retry, job, moderation, scoring and concurrency scenarios |
| `docs/reviews-reputation.md` | Upgrade, API, scoring policy, scheduling and validation guide |
| `docs/milestone-8-changes.md` | This manifest |

## Updated

| Path | Purpose |
|---|---|
| `backend/app/api/v1/router.py` | Register review routes |
| `backend/app/db/models.py` | Register review tables for metadata/Alembic |
| `backend/app/modules/notifications/events.py` | REVIEW_PUBLISHED and REVIEW_MODERATED fixed templates |
| `README.md` | Latest milestone and guide |
| `docs/scope.md` | Reviews/reputation completion and next stage |

No dependency, environment, auth protocol, chat, exchange lifecycle, ownership transfer or existing report/block implementation changes. Trust is calculated on demand rather than stored on User. Review moderation has a separate audit table; existing general report actions remain unchanged.
