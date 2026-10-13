# Security & Anti-Cheat

## 1. Threat Model

| Asset | Threat | Actor |
|---|---|---|
| Leaderboard & future rewards | Forged/inflated scores, replayed sessions | Player with devtools / scripts |
| Admin panel | Credential stuffing, CSRF, XSS via uploaded theme | External attacker |
| Event stream | Spoofed webhooks to host; unauthorized reading of player data | External attacker |
| Host users | Clickjacking via framing on unapproved sites | Malicious site |
| Secrets | Leakage via logs/repo | Insider/mistake |

## 2. Identity

- Host tokens: HS256 only (reject `alg: none` and others), `exp` required and ≤ 24 h, 30 s clock skew.
  `HOST_SHARED_SECRET` ≥ 32 random bytes; service refuses to boot with a shorter secret.
- Player session JWT (`PLAYER_JWT_SECRET`, 4 h TTL) contains `playerId`, `verified`; checked on every gameplay call.
- Banned players → 403 on session creation.
- Guest play can be disabled (`guestPlayEnabled` setting); guest scores are `verified: false`.

## 3. Score Integrity

The client is untrusted. The server never accepts `clientScore` as truth.

1. **Server sessions:** a score can only be attached to a server-created session, once (`scores.session_id UNIQUE`).
2. **Deterministic spawns:** session `seed` + frozen settings → the server regenerates the spawn sequence
   (`server/shared/spawner.js`, shared with the client) and verifies every `objectId` in events exists, has the
   claimed `objectKey`, and that its event `t` falls inside the object's possible on-screen window (spawn time to
   spawn + max airtime).
3. **Recompute score** from accepted events using `server/shared/scoringRules.js`. Final score = server value.
   `|clientScore − serverScore| > 0` is logged and flagged.
4. **Plausibility checks** (each recorded in `validation_json`):
   - Event `seq` contiguous 1..lastSeq; `t` non-decreasing; `t` ≤ wall-clock elapsed + 2 s.
   - Duration within mode bounds (Arcade/Zen ±3 s of configured duration; Classic ≥ 3 s).
   - Slices per second ≤ 15 sustained over any 2 s window.
   - Each object sliced at most once (pomegranate: ≤ 40 hits).
   - Combo counts match the number of `fruit.sliced` events sharing that `swipeId`.
   - Classic: game must end on bomb/strikes and life arithmetic must be consistent.
   - Score ≤ theoretical max for duration (sum of points of all spawned objects + max combos/bonuses).
5. Fail ⇒ session `rejected`, no `scores` row, `session.ended` with `scoreAccepted: false` and `rejectionReasons`.
6. Rate limits on session creation stop brute-force replays.

Known limitation: a bot that perfectly simulates human input within limits can't be fully distinguished. Hosts
should cap rewards (see [INTEGRATION_GUIDE §7](INTEGRATION_GUIDE.md)).

## 4. Admin Panel

- Credentials only from env; password compared with `crypto.timingSafeEqual` (or bcrypt if hash supplied).
- Login rate limit 5 / 15 min / IP; generic error message.
- Cookie: `httpOnly; Secure; SameSite=Strict; Path=/api/v1/admin`. CSRF double-submit token on mutating requests.
- Admin served with `frame-ancestors 'none'`.
- All mutating actions audited.

## 5. Uploads

- Accept only PNG / JPEG / WebP images and MP3 / OGG audio; **no SVG, no GIF**.
- Validate by magic bytes (`file-type`), not extension or client MIME.
- Images re-encoded with `sharp` (strips metadata, normalizes dimensions); audio size/duration-checked
  (`music-metadata`).
- Stored under content-hash names in `UPLOAD_DIR`, outside `public/`; served from `/media` with
  `X-Content-Type-Options: nosniff`, correct `Content-Type`, `Content-Disposition: inline`.
- Size limit `MAX_UPLOAD_BYTES` enforced by multer before processing.

## 6. HTTP Hardening

- `helmet` defaults + CSP:
  `default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; frame-ancestors <ALLOWED_FRAME_ANCESTORS>`
  (no inline scripts → Tailwind must be compiled, not CDN).
- `/play` `frame-ancestors` from env allowlist; `/admin` `'none'`.
- Body size limits: 64 KB JSON default, multer for uploads.
- `trust proxy` configurable (`TRUST_PROXY`) so rate limits use the real client IP behind a load balancer.
- CORS: deny by default; allow `CORS_ORIGINS` for integration endpoints only.

## 7. Webhooks & API Keys

- Per-endpoint secrets, encrypted at rest with AES-256-GCM using `DATA_ENCRYPTION_KEY`.
- HMAC-SHA256 signatures with timestamp; rotation keeps old secret valid 24 h.
- SSRF protection: webhook URLs must be `https`, and the dispatcher resolves DNS and refuses private/loopback/
  link-local ranges unless `WEBHOOK_ALLOW_PRIVATE=true` (dev only).
- API keys: random 32 bytes base62, stored as SHA-256 hash, shown once, revocable, `last_used_at` tracked.

## 8. Secrets & Logging

- All secrets via env; `.env` gitignored; `.env.example` contains placeholders only.
- Boot fails if any required secret is missing or still a placeholder value (`change-me…`).
- pino redaction for `authorization`, `cookie`, `token`, `password`, `secret` paths.

## 9. Privacy

- Stored PII: display name, host external id, optional avatar URL, IP (only in rate-limit memory and admin audit log).
- Player data deletion: `DELETE /api/v1/players/:externalId` (API key) anonymizes the player (name → "Deleted",
  external id nulled), keeps aggregate scores — supports host-side GDPR requests.
