# Milestone 8: exchange reviews and reputation

## Upgrade from milestone 7

Copy the files listed in milestone-8-changes.md into your existing project, preserving `.env` and the database. No dependency, secret, cookie, JWT or environment changes are required. From `swappy/backend`:

```powershell
python -m alembic upgrade head
python -m alembic current
```

Expected revision: `0008`. Restart the API. This additive migration creates `reviews` and `review_moderation_actions`; previous migrations, chat, sessions, ownership and listings are unchanged. Do not reset the database. A downgrade to `0007` deletes review and audit data, so do not downgrade a populated environment without a backup.

The review deadline is exactly `completed_at + 14 days` in UTC. Existing completed exchanges use their original completion date: recent ones can be reviewed until that deadline; older ones are not reopened by migration. Existing users have no fabricated ratings or trust scores. Ownership history is not rewritten.

## Review rules

- Only the two participants of a COMPLETED exchange may review one another. Administratively completed exchanges count too. Pending, accepted, waiting, rejected, cancelled and expired exchanges cannot be reviewed.
- Each participant has one immutable review per exchange. The server derives reviewer and recipient. Database uniqueness prevents duplicates. Required rating: integer 1–5 (no strings, booleans or fractional values). Optional comment: at most 2,000 characters, trimmed plain text; whitespace-only becomes null. Unknown input fields are rejected.
- The submission window closes at the deadline, not after it. A previously committed identical retry returns the same review, including after deadline. Different content returns 409; there is no edit/delete endpoint. A retry never creates another review or notice.
- Feedback is earned by completing the exchange: subsequent membership expiry, campus changes, blocks and participation restrictions do not remove that right. Both parties may still submit in their window. An inactive account or revoked session cannot authenticate. Blocking still prevents chat; it does not suppress completed-exchange feedback.
- Each author can read their own review immediately. The counterpart and public endpoints cannot see its rating, comment or a "counterpart submitted" flag while sealed. It contributes nothing to public counts or trust until published.
- Both reviews publish together when the second participant submits, or a lone review publishes after the deadline through the scheduled job. Publication is irreversible; admins may subsequently hide/restore visibility. GET endpoints do not mutate state or publish due reviews.

Both-participant publication reduces retaliation based on seeing a rating before submitting. It does not prevent pressure or collusion outside the application.

## Scheduled publication (required)

Run this command every five minutes through your deployment scheduler; locally it can be run manually:

```powershell
python -m app.jobs.publish_reviews
```

The job processes due windows in batches, commits each exchange independently, and can be retried. It is an entry point, not an automatically running scheduler. Keep the existing exchange expiry, proof purge and auth cleanup jobs as well. If this job is not scheduled, lone reviews remain sealed until it runs (an identical retry of the existing submission also checks due publication). Late missing reviews are rejected regardless of whether the job has run. There is no penalty for declining to review.

## Endpoints

All endpoints use existing bearer authentication. Prefix `/api/v1`:

| Method | Path | Response/use |
|---|---|---|
| POST | `/exchanges/{exchange_id}/reviews` | Submit or retry your review; 200 for both |
| GET | `/exchanges/{exchange_id}/reviews` | Participant-only deadline, eligibility, own review and visible received review |
| GET | `/users/{user_id}/reviews?limit=20&before={review_id}` | Published, non-hidden reviews with keyset pagination |
| GET | `/users/{user_id}/reputation` | Star average, review/history counts and calculated trust |
| GET | `/moderation/reviews?hidden=false&limit=20&offset=0` | Admin published-review queue; use hidden=true for hidden reviews |
| POST | `/moderation/reviews/{review_id}` | Admin HIDE/RESTORE with reason |
| GET | `/moderation/reviews/{review_id}/actions` | Admin-only audit history, limit/offset |

Submit:

```json
{"rating":5,"comment":"The book matched the listing and the handover went smoothly."}
```

The submission response includes id, exchange_id, reviewer_id, reviewed_user_id, rating, comment, created_at, published_at (null while sealed), and is_hidden. Participant status GET returns review_deadline, can_review, my_review and received_review. Before publication received_review is null. Hidden reviews are excluded from received_review; authors retain access to their own submitted content and hidden flag.

Public review responses include reviewer ID/current display name, target ID, rating, comment and timestamps, but omit exchange IDs, book snapshots, emails, moderation notes and sealed-review details. Items are ordered newest publication first by published_at/id. Limit is 1–100. Use next_cursor as before; a cursor hidden by moderation between requests returns 404: reload the first page. Render comments as plain text, never raw HTML.

Reputation/review browsing is available to the subject, administrators, same-campus users with a complete profile (no membership approval needed), and former completed-exchange counterparts if their campuses later differ. Unrelated users from another campus receive 404. Inactive targets are available only to themselves if authentication were restored, administrators or former completed-exchange counterparts. Blocking does not erase public feedback. These endpoints do not create a general public email/profile directory.

## Trust policy: distinct-reviewer-v1

This is a product policy, not a probability of a safe exchange or a guarantee of conduct. It uses published, non-hidden reviews only. Reports, pending proposals, cancellations, expired exchanges, document uploads, membership badges and raw moderation restrictions do not add or subtract score points.

The response deliberately separates:

- `average_rating`: ordinary mean of all visible reviews, rounded to two decimals (null with none).
- `review_count`: number of visible reviews.
- `distinct_reviewers`: number of different visible reviewers.
- `completed_exchanges`: all completed exchanges involving the subject, whether reviewed or not.
- `distinct_exchange_partners`: different counterpart IDs in those completed exchanges.
- `trust_score`: bounded 0–100 reputation indicator, rounded half-up to one decimal; null until three distinct reviewers.
- `trust_status`: NOT_ENOUGH_HISTORY or AVAILABLE.
- `trust_version`: distinct-reviewer-v1; `minimum_distinct_reviewers`: 3.

Calculation:

1. Group visible ratings by reviewer and calculate one mean per reviewer, `r_i`.
2. Let `n` be the number of distinct reviewers. If `n < 3`, return null, not 0.
3. Smooth toward a neutral three-star prior with weight five: `adjusted_rating = (sum(r_i) + 5 × 3) / (n + 5)`.
4. Convert: `trust_score = round_half_up((adjusted_rating - 1) × 25, 1)`.

| Evidence | Star average | Trust score |
|---|---:|---:|
| No reviews | null | null — Not enough history |
| Eight five-star reviews from one partner | 5.00 | null — Not enough history |
| Three distinct five-star reviewers | 5.00 | 68.8 |
| Three distinct three-star reviewers | 3.00 | 50.0 |
| Three distinct one-star reviewers | 1.00 | 31.3 |
| Ten distinct five-star reviewers | 5.00 | 83.3 |

Repeated identical ratings from one partner cannot increase their weight or the distinct-reviewer count. Different ratings from that same partner can change that partner's single mean. The raw star average can differ from the score's underlying average because it includes every visible review. More independent positive history raises confidence; negative feedback can lower the score. Completions alone do not earn unlimited points.

This reduces repeated-pair farming, not coordinated fake-account or multi-account fraud. Campus verification helps eligibility but is not identity uniqueness. Future abuse controls may need account-link analysis and reviewed enforcement. Display the distinct-reviewer sample size alongside the score and avoid presenting it as a safety certification.

All review-derived aggregates come from one grouped query snapshot. Completed-history counts are a separate query. Values are calculated on demand; no cached User score/counter can drift. Hiding/restoring a review affects subsequent calculations automatically, including returning to NOT_ENOUGH_HISTORY if fewer than three reviewers remain.

## Moderation and notifications

Admin request:

```json
{"action":"HIDE","reason":"The comment contains abusive language."}
```

Use RESTORE with a reason to reverse. Reason length: 10–1,000 characters. Authors and subjects cannot moderate their own review even if administrators. Another administrator must handle it. Moderation affects the full review, including rating: hidden reviews do not appear in public lists or contribute to score/average. The underlying content and audit are retained. Identical repeated actions do not create another audit or notification; a genuine later restore/hide records a new action. Sealed reviews are not exposed in the admin queue and cannot be moderated through these endpoints.

Two centralized notification kinds are added, both using the existing EXCHANGE resource type:

- REVIEW_PUBLISHED: one generic notice to the reviewed user when a review first publishes.
- REVIEW_MODERATED: generic notice to author and subject when visibility actually changes.

There is no notification on sealed submission, so it cannot disclose the counterpart's timing. Rating/comment/reason never enters previews. Review insertion, publication and notices share a transaction. Audit, visibility and moderation notices also share a transaction. If any notice insert fails, the entire operation rolls back.

General user reporting remains separate from exchange reviews. For now, report abusive authors through the existing USER report endpoint and include the visible review ID in details; admins can inspect the published-review queue. A dedicated REVIEW report target is not added in this migration. Do not use low ratings or unreviewed allegations to automatically restrict participants.

## Verification

1. Complete an exchange between two users; third user submission/status access gets 404. Incomplete exchanges get 409 on submission.
2. First user submits: own review visible, counterpart/public lists/counts/score reveal nothing. Submit the second: both appear and each subject gets one notice.
3. Retry identical content: same ID, no extra notice. Different content: 409. Test ratings 0/6/true/"5", long comments and forged reviewer fields (422).
4. Submit only one review. Move the completion timestamp past the deadline in a dedicated test database, run publication twice: first publishes, second does nothing. Late second review fails. GET alone does not publish.
5. Block either way or restrict membership after completion: feedback remains available until deadline. Chat stays subject to its existing rules. Revoked sessions still fail authentication.
6. Hide a published review: it disappears from lists/averages/trust but the completed-exchange count remains. Restore it: it contributes again. Repeated actions leave only one audit per actual visibility change. Involved administrators cannot self-moderate.
7. Verify repeated five-star exchanges from the same reviewer do not cross the three-reviewer threshold or add weight. Three distinct five-star reviewers should yield 68.8.
8. Exercise simultaneous identical/opposing submissions and multiple publication workers on PostgreSQL; verify two maximum reviews per exchange and one publication notice per review.
9. Test same-campus browsing, unrelated-campus denial, historical counterpart access after a campus change, keyset pagination and hidden cursor handling.

Build validation: 91 tests passed; 89 PostgreSQL-dependent tests skipped because TEST_DATABASE_URL was not configured. This milestone adds 20 database-free cases and 13 PostgreSQL API scenarios. Lint, formatting, compilation, OpenAPI generation and offline PostgreSQL migration SQL generation passed. Actual migration execution, metadata comparison and database concurrency remain to be run against PostgreSQL/CI.

From backend, with a dedicated PostgreSQL test database (tests create isolated schemas):

```powershell
$env:TEST_DATABASE_URL = "postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest tests -q
```

## Next stage

Backend readiness: run the full PostgreSQL suite and migrations, validate scheduled jobs and failure paths, review authentication/authorization and deployment configuration, finalize API contracts, and identify any remaining MVP gaps. Then begin the mobile-first frontend. Real-time WebSocket chat remains a tracked transport enhancement; this milestone does not implement it.
