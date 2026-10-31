# Stage 1.1 — Public experience refinement

Scope: implement the agreed UI improvements on the existing foundation. No backend changes, auth rollout or additional backend integrations.

- Dedicated Explore remains the only public catalog; homepage contains no book API fetch or duplicated preview.
- Landing feature owns the compact hero, illustrative giving/receiving summary, process strip, verification explanation, FAQ and final Explore action.
- Reuse slider models N two-way exchanges as 2N handovers. It is illustrative, permits repeat copies, and makes no trees/water/carbon claims.
- Explore uses horizontal cards and a reusable scroll row with visible scrollbar, overflow hint and directional controls. Main results remain a grid, not a hidden carousel. The unfiltered query supplies stable backend genre labels while the filtered query changes; TanStack Query deduplicates identical query keys.
- Help is a separate server-rendered route with a contents list, native keyboard-operable disclosures, seven exchange statuses, membership labels, suggested condition meanings, all twenty genres, chat/reviews, issues/reports and administrator labels.
- Shared BookCover handles absent/failed photos; condition labels are centralized and Poor is labelled honestly rather than softened to Well loved.
- Default API URL and environment example use 127.0.0.1:8000. Use 127.0.0.1:3000 in the browser; retain the existing .env.local and update it manually if necessary.

Backend sources consulted: modules/exchanges/service.py and policies.py, modules/colleges/service.py and policies.py/models.py, modules/chat/service.py, modules/reviews/service.py/policies.py, and the supplied contract. Handover is a real-world step, not an invented enum. Waiting exchanges do not auto-expire via the accepted-only rule. Completion transfers physical books and archives the old listings.

Account and member screens remain Stage 2. Public links point only to implemented routes. Help describes supported backend capabilities with an explicit note about frontend rollout.
