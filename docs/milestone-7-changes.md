# Milestone 7 file changes (from notification milestone 6)

All paths below are relative to `swappy/`.

## Added

- `backend/app/modules/chat/__init__.py`
- `backend/app/modules/chat/models.py`: persisted messages, uniqueness, per-exchange sequences, read positions.
- `backend/app/modules/chat/schemas.py`: validated text, paginated history, receipt contracts.
- `backend/app/modules/chat/service.py`: participant/eligibility/block guards, locked sending, retries, history, monotonic receipts and atomic notifications.
- `backend/app/api/v1/chat.py`: three authenticated HTTP endpoints.
- `backend/migrations/versions/0007_exchange_chat.py`: additive schema migration; downgrade removes chat data.
- `backend/tests/api/test_chat.py`: ten PostgreSQL scenarios (including parameterized closure cases).
- `backend/tests/unit/test_chat.py`: eleven database-free validation/state cases.
- `docs/exchange-chat.md`: setup, contracts, permissions and verification.
- `docs/milestone-7-changes.md`: this manifest.

## Updated

- `backend/app/api/v1/router.py`: register chat routes.
- `backend/app/db/models.py`: register chat tables in metadata.
- `backend/app/modules/notifications/events.py`: CHAT_MESSAGE and generic private preview template.
- `README.md`: latest milestone/guide.
- `docs/scope.md`: chat status and next milestone.

No earlier migration, environment template, dependency, auth protocol, exchange lifecycle service, block service or handover rules changed.
