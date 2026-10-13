# Product Requirements Document — Blade Fruit (Fruit Ninja–style Game Microservice)

| | |
|---|---|
| **Status** | Draft v1.0 |
| **Date** | 2026-10-13 |
| **Owner** | ratul@zavisoft.com |
| **Working name** | *Blade Fruit* (placeholder — must not use the "Fruit Ninja" trademark in shipped UI) |

Related documents: [Game Design](GAME_DESIGN.md) · [Architecture](ARCHITECTURE.md) · [API](API.md) ·
[Events](EVENTS.md) · [Data Model](DATA_MODEL.md) · [Admin Panel](ADMIN_PANEL.md) ·
[Integration Guide](INTEGRATION_GUIDE.md) · [Security](SECURITY.md) ·
[Implementation Plan](IMPLEMENTATION_PLAN.md) · [Testing](TESTING.md)

---

## 1. Summary

A browser-based fruit-slicing arcade game that plays like Fruit Ninja — fruit is tossed up from the bottom of the
screen, the player swipes to slice it, avoids bombs, and chains combos — delivered as a **self-contained
microservice**. Any host product (a loyalty app, an LMS, a marketing site) can embed it with an `<iframe>` and a
signed player token.

The service ships with:

1. **The game** — HTML + Tailwind CSS + vanilla JavaScript on an HTML5 canvas.
2. **An admin panel** — protected by fixed credentials from environment variables. Admins re-skin the game (replace
   any sprite: fruits, bomb, background, blade trail, logo, e.g. swap a "bird" image for a brand mascot), tune
   gameplay, and browse every gameplay event.
3. **An event log** — every meaningful gameplay action is recorded as a structured, versioned event that a host
   system can pull via REST or receive via signed webhooks, so the host can award points/rewards (reward logic
   itself is **out of scope** for this release).
4. **A leaderboard** — per game mode, all-time / weekly / daily.

## 2. Problem & Opportunity

Host products want a lightweight, engaging mini-game to drive retention and reward users, but don't want to build
or maintain a game. They need:

- A game they can **brand** without engineering effort.
- A **trustworthy event stream** so their own points/rewards engine can react to play.
- A **drop-in integration** that uses their existing user identity.

## 3. Goals & Non-Goals

### Goals
- G1. Gameplay that feels like Fruit Ninja: arcs, swipe trail, fruit halves + juice, combos, bombs, three game modes.
- G2. Fully re-skinnable from the admin panel with no redeploy.
- G3. Every gameplay action emitted as a documented event, consumable by pull API and webhooks.
- G4. Leaderboard that is resistant to trivial score tampering.
- G5. Embeddable microservice: one container, one SQLite file, configured purely through env vars.

### Non-Goals (this release)
- Awarding points / rewards (host system will do this using events).
- Multiplayer / real-time PvP.
- Native mobile apps (mobile **browsers** are in scope).
- Multi-tenant theming (one theme per deployment; multi-tenant is an open question, §13).
- Multiple admin users / RBAC (single admin from env).
- Using any copyrighted Fruit Ninja art, audio, names or logos.

## 4. Personas

| Persona | Description | Primary needs |
|---|---|---|
| **Player** | End user of the host product, on desktop or phone | Fun, responsive slicing; see their rank |
| **Admin** | Marketing/ops person at the host company | Re-skin game, tweak difficulty, inspect events, moderate leaderboard |
| **Integrator** | Backend developer at the host company | Embed game, pass identity, consume events reliably |

## 5. User Stories & Acceptance Criteria

### Player

**P1 — Play a game**
As a player I can choose Classic, Arcade or Zen mode and slice fruit by swiping.
- AC1: Mouse, touch and pen input all produce a visible blade trail.
- AC2: A fruit intersected by the trail at ≥ minimum blade speed splits into two halves with a juice splash.
- AC3: Game runs at ≥ 55 fps on a mid-range 2022 Android phone and a 2020 laptop.
- AC4: Game ends according to mode rules in [GAME_DESIGN §2](GAME_DESIGN.md#2-game-modes).

**P2 — Combos & specials**
- AC1: Slicing ≥ 3 fruit in a single swipe shows "N FRUIT COMBO +N" and adds the bonus.
- AC2: In Arcade, Freeze / Frenzy / Double-Score specials appear and apply their effects.

**P3 — Bombs**
- AC1: Classic: slicing a bomb ends the game with an explosion animation.
- AC2: Arcade: slicing a bomb deducts 10 points (floor 0) and flashes the screen.

**P4 — See my result and rank**
- AC1: Game-over screen shows score, best score, fruits sliced, best combo, and leaderboard position.
- AC2: Leaderboard shows top 100 for the selected mode and period, with the player's own row highlighted.

**P5 — Identity**
- AC1: When launched with a valid host token, the player's name comes from the token; no name prompt.
- AC2: Without a token (and guest play enabled) the player enters a nickname; their scores are marked
  `verified: false` and are hidden from the "verified only" leaderboard filter.

### Admin

**A1 — Log in**
- AC1: Credentials are `ADMIN_USERNAME` / `ADMIN_PASSWORD` from env; no sign-up.
- AC2: 5 failed attempts per IP per 15 min → HTTP 429.
- AC3: Session expires after `ADMIN_SESSION_TTL_HOURS`.

**A2 — Re-skin the game**
- AC1: Admin can replace any sprite slot (every fruit, bomb, specials, background, blade texture, logo, splash colors).
- AC2: Admin can add a custom "fruit" type (image, points, radius, spawn weight) and disable built-in ones.
- AC3: Changes are previewed live in the panel and go live for new game loads after "Publish".
- AC4: "Reset to default" restores the bundled theme per slot or wholesale.

**A3 — Tune gameplay**
- AC1: Gravity, spawn rate curve, bomb probability, mode durations, combo bonus and lives are editable within
  validated ranges.

**A4 — Inspect events**
- AC1: Events explorer lists events newest-first with filters (type, player, session, date range) and JSON detail view.
- AC2: Admin can export the filtered set as CSV/NDJSON.

**A5 — Moderate leaderboard**
- AC1: Admin can remove a score (soft delete, audited) and reset a leaderboard period.

**A6 — Manage integrations**
- AC1: Admin can create/revoke API keys (shown once) for the pull API.
- AC2: Admin can add webhook endpoints, choose event types, send a test event, and view delivery attempts.

### Integrator

**I1 — Embed** — AC: Following [INTEGRATION_GUIDE](INTEGRATION_GUIDE.md), an iframe + signed token works in < 30 min.

**I2 — Pull events** — AC: `GET /api/v1/events?cursor=…` returns events in strict insertion order; resuming with the
returned cursor never skips or duplicates.

**I3 — Webhooks** — AC: Deliveries are signed (`X-BF-Signature`), retried with backoff for 24 h, and each event
carries a stable `id` for idempotent processing.

**I4 — Lifecycle messages** — AC: Iframe posts `bf:ready`, `bf:session-started`, `bf:session-ended` to the parent window.

## 6. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Canvas game with Classic, Arcade, Zen modes | Must |
| FR-2 | Swipe trail, slicing geometry, fruit halves, juice FX, combo detection | Must |
| FR-3 | Bombs and Arcade specials (freeze, frenzy, double) | Must |
| FR-4 | Server-issued game sessions; client sends batched gameplay events | Must |
| FR-5 | Server-side score validation before leaderboard insertion | Must |
| FR-6 | Leaderboard per mode × period (all-time, weekly, daily), best score per player | Must |
| FR-7 | Admin login from env creds; httpOnly cookie session | Must |
| FR-8 | Theme editor with sprite upload, live preview, publish, reset | Must |
| FR-9 | Gameplay settings editor | Must |
| FR-10 | Events explorer with filters and export | Must |
| FR-11 | Pull API for events with API keys | Must |
| FR-12 | Outbound webhooks with signing, retries, delivery log | Must |
| FR-13 | Host-token identity, guest fallback (toggle) | Must |
| FR-14 | Sound effects with mute toggle; admin-replaceable audio | Should |
| FR-15 | `postMessage` lifecycle contract for host page | Should |
| FR-16 | Health (`/healthz`) and readiness (`/readyz`) endpoints | Must |
| FR-17 | Player stats endpoint for host (`/players/:id/stats`) | Should |
| FR-18 | Localization-ready UI strings (EN shipped) | Could |

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | ≥ 55 fps on target devices; initial game load ≤ 1.5 MB (default theme) and TTI ≤ 2.5 s on 4G |
| API latency | p95 < 100 ms for gameplay endpoints at 200 concurrent players on 1 vCPU |
| Reliability | Events are written transactionally with the session state (outbox); no event lost on crash after HTTP 2xx |
| Security | See [SECURITY.md](SECURITY.md): CSP, frame-ancestors allowlist, rate limits, upload sanitization, signed tokens |
| Portability | Single Docker image; all config via env; data in one volume (`/data`) |
| Accessibility | Menus keyboard-navigable, WCAG AA contrast on UI chrome, reduced-motion option disables screen shake |
| Observability | Structured JSON logs (pino), request IDs, `/metrics` (Prometheus) optional |
| Browser support | Last 2 versions of Chrome, Edge, Firefox, Safari; iOS Safari 16+, Android Chrome |

## 8. Success Metrics

- Median session length ≥ 60 s; ≥ 40 % of players play ≥ 2 rounds.
- Webhook delivery success ≥ 99.5 % within 5 min.
- 0 leaderboard entries that fail server validation.
- Integrator time-to-first-event < 30 min.

## 9. Release Scope & Milestones

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for task-level breakdown.

| Milestone | Outcome |
|---|---|
| M0 | Repo scaffold, tooling, Tailwind build, Express skeleton, migrations |
| M1 | Playable offline game (all three modes) with default theme |
| M2 | Sessions, event ingestion, score validation |
| M3 | Leaderboard API + UI |
| M4 | Admin panel: auth, theme editor, settings, events explorer, moderation |
| M5 | Pull API, API keys, webhooks |
| M6 | Hardening, tests, Docker, docs final pass → **v1.0** |

## 10. Constraints

- Frontend must be HTML + Tailwind CSS + vanilla JS (no React/Vue). Tailwind compiled via CLI.
- Backend: Node.js 24 + Express + SQLite (`better-sqlite3`).
- Art & audio must be original or permissively licensed (CC0/CC-BY with attribution in `ASSETS_LICENSES.md`).
- "Fruit Ninja" is a Halfbrick trademark: the shipped product name, logo and assets must differ.

## 11. Assumptions

- One deployment = one theme = one host product.
- Host can sign HS256 JWTs with a shared secret.
- Traffic in v1 is modest (≤ 200 concurrent players per instance), so SQLite in WAL mode suffices.

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Score tampering via devtools | Unfair leaderboard, fraudulent rewards | Server sessions, event-based score recomputation, plausibility limits ([SECURITY §3](SECURITY.md)) |
| Low fps on old phones | Poor UX | Object pooling, capped particles, DPR cap at 2, quality auto-downgrade |
| Malicious uploads | XSS / malware | No SVG, MIME sniff, re-encode via `sharp`, served from `/media` with `nosniff` |
| SQLite write contention | Latency spikes | WAL, batched event inserts, single writer; repository layer for Postgres migration |
| Webhook receiver down | Missed rewards | 24 h retry schedule + pull API as source of truth |

## 13. Open Questions

1. Multi-tenant theming (one service, many host brands) — needed in v2?
2. Should Zen mode scores be on the leaderboard?
3. Event retention period beyond 90 days for reward audits?
4. Will the host need per-campaign leaderboards (date-bounded tournaments)?
5. Daily play limits per player (to bound reward costs)?
