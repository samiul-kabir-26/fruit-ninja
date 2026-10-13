# Changelog

All notable changes to the Blade Fruit microservice are documented in this file.

## [1.0.0] - 2026-10-13

### Added
- **Core Game Engine (`/play`)**:
  - HTML5 Canvas 2D engine operating at logical resolution 1920x1080 with DPR capped at 2.0.
  - 120Hz fixed-timestep physics loop with variable rendering.
  - Multi-touch and pointer trail slicing with speed threshold (900 px/s).
  - Segment-circle collision detection and cut plane vector calculations.
  - 3 game modes: Classic (3 strikes), Arcade (60s timer, specials & combo blitz), and Zen (90s peaceful slice).
  - Special Arcade bananas: Freeze (time dilation), Frenzy (rapid fruit wave spawns), Double Points.
  - Dynamic Web Audio sound synthesis (blade swoosh, fruit cuts, bomb sizzle & detonation, combo chimes).
  - Host iframe `postMessage` protocol with bidirectional communication, ready handshake, pause/resume, and event relaying.
- **Microservice Backend (`/api/v1`)**:
  - Node 24 + Express 5 with SQLite (`better-sqlite3`, WAL mode).
  - Deterministic Mulberry32 PRNG spawner with replay verification and anti-cheat sanity checks.
  - Outbox pattern for events streaming and HMAC-SHA256 signed webhook dispatch with exponential backoff and SSRF protection.
  - Player authentication via host HMAC tokens or guest nicknames with profanity filtering.
  - Server-side score validation, ranking calculation, and personal best tracking.
  - Comprehensive rate limiting, CORS configuration, and security headers (CSP `frame-ancestors`).
- **Admin Panel (`/admin`)**:
  - Tailwind CSS dark-themed SPA with hash routing.
  - Fixed-credential session authentication (`bf_admin` cookie) with CSRF double-submit protection (`bf_csrf`).
  - Real-time Dashboard with KPI metrics, session counters, top scores, and activity stream.
  - Interactive Theme Editor with live attract mode preview iframe, custom sprite uploading, radius hitbox editor, and import/export ZIP.
  - Live Gameplay Settings editor for gravity, blade thresholds, mode durations, and difficulty ramp curves.
  - Events Explorer with real-time SSE stream tail, JSON payload inspector, and CSV/NDJSON export.
  - Leaderboard moderation with score soft-deletion and period reset watermarks.
  - Player management with search and instant banning.
  - Webhook endpoint manager with delivery logs, signature verification secrets, and test/redelivery actions.
  - Integration API Keys management (shown-once plaintext creation and revocation).
  - Immutable Audit Log viewer recording all administrative actions.
- **DevOps & Packaging**:
  - Multi-stage `Dockerfile` with non-root execution (`node` user), `/data` persistent volume, and native `HEALTHCHECK`.
  - `docker-compose.yml` for single-command deployment.
