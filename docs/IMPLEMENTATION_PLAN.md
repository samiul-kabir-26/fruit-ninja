# Implementation Plan

Milestones are sequential; each ends with its Definition of Done (DoD). Story IDs reference [PRD §5](PRD.md#5-user-stories--acceptance-criteria).
Rough effort assumes one full-stack developer.

## M0 — Scaffold & Tooling (1–2 days)

- [ ] `package.json` (type `module`, Node ≥ 24), scripts: `dev`, `build:css`, `watch:css`, `start`, `test`,
      `test:e2e`, `lint`, `migrate`.
- [ ] Dependencies: `express`, `better-sqlite3`, `zod`, `pino`, `pino-http`, `helmet`, `express-rate-limit`,
      `cookie-parser`, `jsonwebtoken`, `ulid`, `multer`, `sharp`, `file-type`, `music-metadata`, `dotenv`.
      Dev: `tailwindcss`, `@tailwindcss/cli`, `vitest`, `supertest`, `@playwright/test`, `eslint`, `prettier`, `nodemon`.
- [ ] Tailwind config + `src/styles/game.css`, `src/styles/admin.css` → `public/css/`.
- [ ] `server/config/env.js` — zod-validated env, fail fast; `.env.example`.
- [ ] `server/app.js` factory + `server/index.js`; helmet/CSP, request ids, error middleware, `/healthz`, `/readyz`.
- [ ] DB connection (WAL pragmas), migration runner, `001_init.sql` with all tables from [DATA_MODEL](DATA_MODEL.md).
- [ ] Seed: default settings + default theme rows from `public/game/assets/default/manifest.json`.
- [ ] ESLint/Prettier, `.gitignore` (`.env`, `data/`, `public/css/`, `node_modules/`), `git init`.

**DoD:** `npm run dev` serves `/healthz` 200; migrations idempotent; CI runs lint + unit tests.

## M1 — Core Game, Offline (5–7 days) — P1, P2, P3

- [ ] Default art: original fruit/bomb/special sprites + halves (WebP), background, logo, SFX (CC0) + `ASSETS_LICENSES.md`.
- [ ] `engine/loop.js` fixed-timestep loop + interpolation; pause on visibility change.
- [ ] `engine/input.js` Pointer Events, coalesced events, multi-touch (2 trails).
- [ ] `engine/trail.js` tapered glowing ribbon; `engine/collision.js` segment–circle test + speed threshold.
- [ ] `server/shared/prng.js` (mulberry32), `spawner.js` (deterministic waves from seed + settings + difficulty table),
      `scoringRules.js`, `eventTypes.js`.
- [ ] Entities with pooling: fruit, halves (pre-rendered clipped halves when no half images), bomb, specials,
      particles, splats, popups.
- [ ] Modes: classic (strikes, life recovery, bomb ends), arcade (timer, specials, criticals, pomegranate, bomb penalty), zen.
- [ ] Audio manager (Web Audio, unlock on gesture, mute persisted).
- [ ] UI: menu (slice-to-select + accessible buttons), countdown, HUD, pause, game over (local best).
- [ ] Theme loader that reads a manifest (bundled default for now).
- [ ] Performance: DPR cap, auto quality downgrade; measure on a mid-range Android.

**DoD:** All three modes playable from `/play` with no backend calls besides static files; ≥ 55 fps on target
devices; unit tests for collision, spawner determinism, scoring.

## M2 — Identity, Sessions & Events (3–4 days) — P5, FR-4, FR-5, FR-13

- [ ] `tokenService` (host token verify, player session JWT issue/verify).
- [ ] `POST /players/identify`, `POST /players/guest`, `GET /players/me`.
- [ ] `POST /sessions`, `/sessions/:id/events` (seq idempotency, batch insert in tx), `/sessions/:id/end`.
- [ ] `eventService` — single `emit(tx, type, payload)` used everywhere (outbox insert).
- [ ] `scoringService` — replay spawner, recompute score, plausibility checks → `validation_json`.
- [ ] Abandoned-session sweeper (every 60 s).
- [ ] Client `api.js`: event buffer (2 s / 50 events), retry w/ backoff, `keepalive` flush on `pagehide`;
      `bridge.js` postMessage contract; token from URL or `bf:auth`.
- [ ] Rate limits per [API §8](API.md#8-rate-limits-defaults).

**DoD:** A played round produces the full event chain in DB; tampered `clientScore` or forged events are rejected
(API tests cover each check).

## M3 — Leaderboard (2 days) — P4, FR-6

- [ ] `leaderboardService` (best per player, periods, tie-breaks, reset watermark, banned/removed excluded, `me` row).
- [ ] `GET /leaderboard` public; game-over rank; `leaderboard.new_high_score` + `player.first_game` emission.
- [ ] In-game leaderboard screen (mode/period tabs, own row highlighted, verified-only toggle).

**DoD:** Leaderboard correct for seeded fixtures across periods (unit + API tests); UI renders on mobile.

## M4 — Admin Panel (6–8 days) — A1–A5, FR-7…FR-10

- [ ] Admin auth (env creds, cookie JWT, CSRF, login limiter, audit log).
- [ ] Shell layout, hash router, API client with 401 handling, toasts, modals (Tailwind components).
- [ ] Dashboard KPIs.
- [ ] Media upload pipeline (`mediaService`: sniff, re-encode, hash, store) + `/media` static.
- [ ] Theme editor: slot list, slot editor (image/halves/fields, hitbox overlay), custom objects, UI & audio slots,
      draft autosave, publish, reset, export/import zip; `/play?preview=draft` attract mode + live postMessage refresh.
- [ ] Game reads `/api/v1/theme` (ETag) instead of bundled manifest; falls back to defaults per missing slot.
- [ ] Gameplay settings form with range validation and `settingsVersion` bump; game reads `/api/v1/config`.
- [ ] Events explorer: filters, cursor pagination, JSON drawer, live tail (SSE), CSV/NDJSON export; session detail.
- [ ] Leaderboard moderation, players search/ban.

**DoD:** Admin can replace e.g. the apple with a bird image, publish, and a fresh game load shows the bird with
correct hitbox and halves (E2E test). All admin endpoints reject unauthenticated/CSRF-less requests (API tests).

## M5 — Integration: API Keys, Pull API, Webhooks (3–4 days) — A6, I2, I3, FR-11, FR-12, FR-17

- [ ] API keys CRUD (hash storage) + `apiKeyAuth` middleware.
- [ ] `GET /events` (cursor, type wildcard filter), `GET /events/:id`, `GET /players/:externalId/stats`,
      `DELETE /players/:externalId`.
- [ ] Webhook endpoints CRUD, encrypted secrets, rotation, SSRF guard.
- [ ] Dispatcher worker: per-endpoint sequential batches, signing, retry schedule, auto-disable, delivery log,
      redeliver, test event.
- [ ] Admin webhooks + API keys views.
- [ ] Retention job.

**DoD:** Integration test with a local receiver: kill receiver mid-stream, restart → all events delivered exactly
once per `id` after dedupe; pull API cursor never skips/duplicates under concurrent writes.

## M6 — Hardening & Release (3–4 days)

- [ ] Full test pass per [TESTING.md](TESTING.md); E2E on Chromium, WebKit (iOS emulation), Firefox.
- [ ] Security review against [SECURITY.md](SECURITY.md) checklist; CSP verified with no violations.
- [ ] Load test (k6): 200 concurrent simulated players → p95 < 100 ms.
- [ ] `Dockerfile` (multi-stage, non-root, `/data` volume, `HEALTHCHECK`), `docker-compose.yml`.
- [ ] Optional `/metrics` (prom-client).
- [ ] Docs final pass; `CHANGELOG.md`; tag `v1.0.0`.

**DoD:** `docker compose up` with a filled `.env` gives a working game, admin and integration API; all PRD Must
requirements verified.

## Traceability

| PRD item | Milestone |
|---|---|
| P1–P3 | M1 (+ M2 for event emission) |
| P4 | M3 |
| P5 | M2 |
| A1–A5 | M4 |
| A6, I2, I3 | M5 |
| I1, I4 | M2 (bridge) + M6 (guide verification) |
| NFR performance | M1, M6 |
| NFR security | M2, M4, M5, M6 |
