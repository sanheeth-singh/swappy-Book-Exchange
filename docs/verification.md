# Verification record

Run in the supplied development runtime:

- 20 policy/security/document tests passed.
- Five PostgreSQL API tests were collected but skipped because a runnable PostgreSQL service is unavailable in this runtime.
- Ruff lint and formatting checks passed.
- Alembic initial upgrade compiled successfully to PostgreSQL SQL offline.
- Python source compilation passed.

Offline migration generation does not verify migration execution or database consistency. PostgreSQL startup was blocked by the runtime's inability to switch to an unprivileged database process. API/database tests and migration round trips remain unverified until the included CI or local PostgreSQL setup executes them.

The PostgreSQL API tests cover account authentication/duplicate emails; profile gating; campus list/detail isolation; proof upload remaining pending; non-reviewer denial; reviewer approval; private document access; campus change invalidating approval; stale review rejection; mass-assignment rejection; invalid proof rejection; and response-field filtering. These are defined tests, not claimed passing checks.
