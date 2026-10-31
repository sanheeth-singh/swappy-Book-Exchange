# Milestone 9 changes (from reviews/reputation milestone 8)

Paths are relative to `swappy/`.

## Added

| Path | Purpose |
|---|---|
| `backend/app/api/v1/profiles.py` | Profile/catalog/books and account setting routes |
| `backend/app/modules/users/profile_schemas.py` | Public/private profile editing, metrics, password/deactivation contracts |
| `backend/app/modules/users/profiles.py` | Combined header, badge, visible book pagination and independent details editing |
| `backend/app/modules/users/account.py` | Password reauthentication/change, unsettled-exchange gate, atomic deactivation |
| `backend/app/modules/users/avatars.py` | Stable 15-choice avatar catalog |
| `backend/app/assets/avatars/reader_01.svg` through `reader_15.svg` | Built-in static vector assets |
| `backend/migrations/versions/0009_profiles_accounts.py` | Additive profile columns, default avatar/interests, allowlist constraints |
| `backend/tests/unit/test_profiles.py` | Input/privacy/badge/asset/CORS/account-guard cases |
| `backend/tests/api/test_profiles.py` | PostgreSQL combined profile, visibility, history, session and race scenarios |
| `docs/profiles-accounts.md` | Setup, contracts, lifecycle and frontend integration guide |
| `docs/milestone-9-changes.md` | This manifest |

## Updated

| Path | Purpose |
|---|---|
| `backend/app/api/v1/router.py` | Register profiles router |
| `backend/app/main.py` | Serve static avatars and permit PATCH in CORS |
| `backend/app/modules/users/models.py` | Bio, interests, avatar and deactivated_at fields/constraints |
| `backend/app/modules/users/schemas.py` | Extend private UserResponse with saved public details |
| `backend/app/modules/users/service.py` | Recheck active state before legacy campus/profile mutation |
| `backend/pyproject.toml` | Include avatar SVGs in package builds; no dependency changes |
| `README.md`, `docs/scope.md` | Current milestone and next-stage status |

All previous migrations, exchange ownership/reservation rules, chat, review/trust formula and auth token/cookie protocol remain unchanged. Existing session models are reused for password/deactivation revocation. No deletion, automatic reactivation, upload dependency, general report change or background scheduler is introduced.
