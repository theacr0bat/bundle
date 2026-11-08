# ARALIK — Managed content edition

Daily numeric interval game, TR/EN, React/Vinext + Cloudflare Worker + D1. Owner dashboard lives at `/admin`.

## Owner workflow

- Sign in with the ChatGPT account that owns this Site. The game footer shows “Yönetim” only to an authorized owner.
- General status: choose up to 90 days; inspect unique players, started/completed first runs, mean completed score, daily completion, per-question hit rate/score/width and up to 100 recent anonymous range samples. Practice/replay are excluded. CSV results export is capped at 10,000 runs per request; shorten the date window if needed. Pseudonymous player IDs are truncated in exports.
- Question bank: current 75 questions seed idempotently into D1; create/edit a question with fixed bounds, answer, units, category, difficulty, reveal explanation and optional internal source. English fields are optional. Preview uses the real point formula and reveal sweep without writing player results. Statuses: draft, ready, archived. Archived items remain editable and can be restored.
- Bulk import: download the UTF-8 CSV template. Excel/Sheets can edit it and export CSV UTF-8; native XLSX is not accepted. Comma and semicolon delimiters, quoted fields, multiline text and BOM work. Up to 100 rows / 500 KB. Validate/preview first; explicit import writes all rows atomically as drafts. Duplicate questions cause a rollback, not a partial import. Numeric fields are integers without grouping separators. Exported strings escape spreadsheet formulas.
- Calendar: select tomorrow through 365 days ahead. Pick one question per category, with 2 easy, 2 medium, 1 hard. Save copies the selected questions into a day snapshot. Existing snapshots do not follow later question edits; save the future day again to refresh it. Future manual days can return to automatic mode. Today/past days are locked, including a database clock guard against midnight races.

## Data and compatibility

Tables: `runs` (retained unchanged), `questions`, `day_rounds`, `admin_settings`, `admin_audit`. SQL migrations are schema-only; the initial bank seeds outside migrations. Local preview and production databases are separate.

Before **2026-11-08 00:00 UTC / 03:00 Türkiye**, exact legacy day assignments remain in source. From that date, automatic selection reads ready questions from D1, rotates difficulty assignments across categories and prioritizes least recently used questions with deterministic day-specific tie breaking. It accounts for the last 90 stored rounds and pre-panel history. Manual future plans override suggestions. The first game request for a day atomically persists the full question/answer/explanation/bounds snapshot and scoring version. API answer/replay/crowd all use it. Public question payloads redact answers, explanations and sources. Replay only opens after daily completion.

Scoring v3: hit = `round(200 * (1 - selectedWidth/domainWidth)^2)`, miss = 0, no precision bonus. Maximum 200/question, 1000/round. Before 2026-11-04, version 2 is retained. Historic scores are never recalculated; statistics warn when a selected range crosses scoring eras. Game-day reset: 00:00 UTC.

## Authorization

Configure secret runtime `ADMIN_OWNER_EMAIL` in Sites. Only platform-authenticated headers are trusted. Missing identity is denied; on first authorized mutation, the verified owner email binds the Site-specific stable user ID in `admin_settings.owner_id`. Subsequent access requires that exact ID, even if the email changes. Ownership transfer requires an explicit operator migration; no first-visitor takeover. Every admin API action checks ownership. Mutations also require a same-origin Origin. Errors never return SQL or secrets. Cache-Control is private/no-store.

D1 and server secrets never enter the client. Preserve `.openai/hosting.json` Site identity and audience. Deploy through Sites, which applies generated migrations before the Worker. Never publish local `.dev.vars`, `.sites-runtime` state or fixture data.

## Checks and preview

`node --import ./tests/register.mjs --test tests/*.test.mjs`

The Node test runner alone replaces `cloudflare:workers` with a fixture module. Integration tests run the actual route handlers and SQL migrations against an in-memory SQLite adapter: ownership, CSRF, duplicate import rollback, edit conflicts, immutable day snapshots, redaction, retry-safe scoring, analytics and CSV export. Production uses the real Cloudflare bindings.

Run TypeScript and the Sites build helper. Apply pending local SQL with the starter's Wrangler local D1 command. Browser QA uses the supported Sites preview.

Optional local admin browser fixture: create ignored `.sites-runtime/admin-preview.json` with a fictional `preview-...` ID and `...@sites.test` email, and set matching `ADMIN_OWNER_EMAIL` in ignored `.dev.vars`. The opt-in Vite `configureServer` middleware exists only for serve, never runs during builds and is not bundled into the production Worker. It only recognizes loopback/internal preview hosts. Local fixtures are never production seed data. Without it, local authenticated API testing can use the test runner; hosted sign-in is dispatch-owned.

Preserved designs remain in `design-archive`. Physical iPhone audio remains a device check. Font requests go to Google Fonts as disclosed in privacy text.
