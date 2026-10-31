# Stage 5 validation

Executed successfully:

- 34 frontend tests: existing auth, exchange policy and API tests plus batch photo partial-success retry, preview URL cleanup, gallery navigation, authenticated-document preview lifecycle, chat ordering/deduplication, retry request identity, notification role destinations/read watermark and report target validation.
- Strict TypeScript and ESLint with no source errors/warnings.
- Production build including the new account, reader and safety routes. An interrupted local build left an invalid generated Turbopack cache; deleting only `.next` and rebuilding produced a working production output. Build caches are excluded from the archive.
- Production HTTP smoke checks: 23 routes including public pages, protected loading guards, all new routes and the expected 404.
- Same-origin proxy fixture: auth path, Origin and Cookie forwarded; HttpOnly Set-Cookie preserved. This is a fixture, not a real sign-in.
- API inventory: 90 operations accounted for — 69 integrated, 19 planned, 1 operational and 1 intentionally unused. No backend routes/schema changed in this stage.

Limits:

- No visual browser, keyboard/screen-reader, multi-user live chat, real upload/storage, notification delivery or review-publication acceptance was executed here. Unit/DOM/HTTP checks do not replace these. Use `docs/stage-5.md` with your running backend.
- Backend code and database are unchanged. Backend tests were not rerun for this frontend-only stage; the user's successful Stage 4 backend acceptance is the baseline.
- Existing ESLint 9 deprecation is unchanged. The existing compatible lockfile is retained; no forced dependency upgrade or unsupported peer tree is introduced.
- Chat uses HTTP polling, not WebSockets. Review publication and cleanup/expiry notifications depend on the backend's existing scheduled processing.
