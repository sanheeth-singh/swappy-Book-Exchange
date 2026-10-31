# Agreed MVP and next milestones

## Product rules

- Open signup, then basic profile setup: display name and a controlled campus selection. College and city derive from the campus directory. Do not collect residential details without a purpose.
- Basic profile completion permits browsing only the selected campus, even without student proof. This is a discovery filter; it does not establish that every viewer belongs to that campus.
- Publishing, new proposals, and acceptance require active, verified, unexpired membership in the same campus. Existing handovers retain controlled completion/withdrawal/support paths after membership expires. Uploading proof alone grants no eligibility.
- Manual approval for a one-campus pilot; schema supports additional campuses. One membership context per user initially.
- Student documents remain private; membership approval and profile completion are separate.
- Campus changes require new verification. Self-service campus changes are blocked while an exchange is ACCEPTED or WAITING_CONFIRMATION.
- Mobile-first web frontend using Next.js and strict TypeScript.
- Book images use ImageKit; include condition and condition notes.
- Basic reports and blocking are in MVP scope. Reporting/blocking must not require verification.
- Pickup spots, Redis, and elaborate dashboards are deferred. Basic genre/recency recommendations are implemented. Persisted chat and completed-exchange reviews build on the notification foundation.

## Exchange rules

Pending proposals do not reserve books. Prevent duplicate active proposals for the same pair, including reversed proposals. Either book may appear in multiple pending proposals. Acceptance locks both books in a deterministic order and revalidates ownership, memberships, campus, blocking, participation restrictions, and availability. Acceptance rejects all conflicting pending proposals in the same transaction.

Either participant may cancel before the first completion confirmation. Accepted exchanges expire after six days without the first confirmation. After the first confirmation, do not automatically release reservations: a physical handover may have happened. Provide an operator-assisted issue-resolution path. Both confirmations transfer ownership exactly once. Received books are not automatically relisted. Archive old listings and preserve historical book/participant context.

Blocking prevents new interactions and proposals but cannot silently cancel accepted exchanges or release books. Reporting does not automatically punish a user. A block in either direction stops new chat messages in accepted exchanges too; history and support remain available.

## Implementation boundaries

Milestones 1–12 implement onboarding, listing uploads, the exchange lifecycle,
general reporting, directional blocking, reversible administrator moderation,
rotating refresh sessions with revocation, transactionally created notifications, persisted text chat with unread counts/read positions, and delayed-publication reviews with a bounded distinct-reviewer trust score, plus combined profiles, avatars, account settings genre-based book discovery, opt-in visitor previews, and audited admin directory management.
See directory-administration.md for the current upgrade path and validation status. PostgreSQL
integration and concurrency tests are supplied but could not run in the creation
runtime. Backend readiness and mobile UI remain upcoming work. Real-time chat transport is deferred. General reports
and exchange handover issues have separate resolution paths.

Completed-exchange review rights survive blocks and eligibility expiry. Reviews have a 14-day immutable submission window, publication after both submissions or deadline, and audited admin hide/restore. Published non-hidden ratings drive versioned trust; reports do not directly change scores. See reviews-reputation.md for the exact formula and required publication job.

Public profiles aggregate membership badges and viewer-visible metrics. Optional bio/interests and a 15-choice avatar catalog are implemented. Password changes revoke all sessions. Deactivation requires no PENDING/ACCEPTED/WAITING_CONFIRMATION exchanges, archives listings and preserves historical ownership/activity without automatic reactivation. See profiles-accounts.md for exact account lifecycle rules.

Book create/edit now requires one primary catalog genre. Up to five recommendations rank matching genres before recent eligible campus fallback, using the user's recent distinct-copy listing history and recognized reading interests. Archived history may contribute; reserved/hidden/blocked/ineligible candidates and the user's previous physical copies do not. See genre-recommendations.md for the versioned algorithm and legacy null-genre policy.

Anonymous visitors can search a shared current pool of up to 100 opted-in eligible listings, with a minimal book-only response and registration CTA. Filters apply after the pool cap; no owner/campus details or private detail endpoint is exposed. Public cards cannot enforce personal blocks for anonymous viewers. Campus administration APIs are now implemented; backend readiness is next.

Colleges and campuses have independent active flags; effective availability requires both. Admin changes preserve UUIDs, validate normalized duplicates, record audit reasons and require current-password confirmation for activation/deactivation. Directory shutdown stops new eligibility while retaining existing handover/support paths. See directory-administration.md for concurrency, migration preflight and restoration rules.
