# Development stages

1. Foundation (this package): src/app structure, semantic light Claysoft theme, reusable primitives, accessible dialog, responsive toast, public shell, member shell preparation, generated API types, complete route inventory, live public preview.
2. Authentication and membership (implemented in Stage 2; live acceptance still required): form login, memory-only access token, CSRF bootstrap, rotating refresh cookie, deduplicated refresh in one tab, cross-tab refresh coordination, logout and query-cache clearing, profile and membership verification. Add real member routes and guards before mounting member navigation.
3. Books and core administrator workspace (implemented; local acceptance required): campus catalog, details, genres, recommendations, personal collection, listing creation/edit/archive/public-preview consent, multipart photos.
4. Exchanges (implemented in Stage 4; live acceptance required): proposal, acceptance, reservation, confirmation, expiry and issues from actual backend contracts. Include participant-specific controls and stale-state recovery.
5. Communication and support (implemented in Stage 5; live acceptance required): HTTP chat/read positions, notifications, blocking, reports, reviews and reputation.
6. Account and administration: password, sessions/revocation, deactivation, membership review, colleges/campuses, impact checks, status confirmation, moderation and audit history.
7. Readiness: API coverage audit, browser workflows, keyboard/accessibility and mobile checks, production build, deployment configuration.

Update contracts/api-coverage.json after each implemented operation. Planned status means inventoried, not functional. Tests and review evidence must accompany an integrated status.
