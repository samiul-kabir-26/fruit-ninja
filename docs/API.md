# API Specification — Blade Fruit `/api/v1`

- Base path: `/api/v1`. JSON in/out (`Content-Type: application/json`), UTF-8.
- Timestamps: ISO-8601 UTC strings. IDs: ULIDs (26 chars) unless noted.
- Every response carries `X-Request-Id`.
- Request bodies validated with zod; unknown fields rejected.

## 1. Authentication Schemes

| Scheme | Used by | How |
|---|---|---|
| **None** | Public config/theme/leaderboard | — |
| **Player bearer** | Game client | `Authorization: Bearer <playerSession JWT>` from `/players/identify` or `/players/guest` |
| **API key** | Host backend (integration) | `Authorization: Bearer bf_live_<32 chars>`; keys stored as SHA-256 hashes |
| **Admin cookie** | Admin panel | `bf_admin` httpOnly, Secure, SameSite=Strict cookie (JWT, `ADMIN_SESSION_TTL_HOURS`). State-changing admin requests also require header `X-CSRF-Token` matching the `bf_csrf` cookie (double-submit). |

## 2. Error Format

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "mode must be one of classic, arcade, zen",
             "details": [{ "path": "mode", "issue": "invalid_enum_value" }], "requestId": "01J…" } }
```

| HTTP | `code` examples |
|---|---|
| 400 | `VALIDATION_FAILED`, `BAD_SEQUENCE` |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_TOKEN` |
| 403 | `FORBIDDEN`, `GUEST_PLAY_DISABLED`, `CSRF_MISMATCH` |
| 404 | `NOT_FOUND` |
| 409 | `SESSION_CLOSED`, `CONFLICT` |
| 410 | `CURSOR_EXPIRED` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 422 | `SCORE_REJECTED` |
| 429 | `RATE_LIMITED` (with `Retry-After`) |
| 500 | `INTERNAL` |

## 3. Public Endpoints

### `GET /config`
Gameplay settings for the client.
```json
{ "settingsVersion": 7, "guestPlayEnabled": true,
  "modes": { "classic": { "enabled": true, "lives": 3, "lifeRecoveryEvery": 100 },
             "arcade":  { "enabled": true, "durationSec": 60, "bombPenalty": 10, "specialChance": 0.06, "criticalChance": 0.02 },
             "zen":     { "enabled": true, "durationSec": 90 } },
  "physics": { "gravity": 1400, "minBladeSpeed": 900, "trailLength": 12 },
  "scoring": { "comboMin": 3, "comboBonusPerFruit": 1 },
  "difficulty": [ { "untilSec": 15, "waveInterval": 1.6, "minObjects": 1, "maxObjects": 2, "bombChance": 0.05 } ] }
```

### `GET /theme`
Published theme manifest. Supports `If-None-Match` → 304.
```json
{ "themeVersion": 12,
  "objects": [ { "key": "fruit.apple", "kind": "fruit", "label": "Apple", "enabled": true,
                 "image": "/media/3f9c…webp", "halfLeft": "/media/…webp", "halfRight": "/media/…webp",
                 "radius": 42, "points": 1, "spawnWeight": 10, "juiceColor": "#e8f5a0" } ],
  "ui": { "logo": "/media/…png", "background": "/media/…webp", "bladeColor": "#ffffff", "bladeGlow": "#7dd3fc",
          "fontFamily": "system-ui", "primaryColor": "#f59e0b", "title": "Blade Fruit" },
  "audio": { "sfx.slice": "/media/…mp3", "sfx.explosion": "/media/…mp3" } }
```

### `GET /leaderboard`
Query: `mode` (`classic|arcade|zen`, required), `period` (`all|weekly|daily`, default `all`),
`limit` (1–100, default 50), `verifiedOnly` (bool, default `false`), `playerId` (optional — include that player's
row even if outside top N).
```json
{ "mode": "classic", "period": "weekly", "periodStart": "2026-10-12T00:00:00Z",
  "entries": [ { "rank": 1, "playerId": "01J…", "displayName": "Aiko", "score": 412, "verified": true,
                 "achievedAt": "2026-10-13T08:12:44Z" } ],
  "me": { "rank": 57, "score": 120 } }
```
Ranking: best score per player in the period; ties broken by earlier `achievedAt`. Weekly periods start Monday
00:00 UTC.

## 4. Player Endpoints

### `POST /players/identify`
Body: `{ "token": "<host-signed JWT>" }` — HS256 with `HOST_SHARED_SECRET`; claims `sub` (host user id, ≤128
chars), `name` (≤32), `exp` (required, ≤ 24 h ahead), optional `avatar` (https URL), `meta` (object ≤1 KB, echoed in
events). Upserts player keyed by `(source='host', external_id=sub)`.
→ `200 { "player": { "id": "01J…", "displayName": "Aiko", "verified": true }, "playerSession": "<JWT>", "expiresAt": "…" }`

### `POST /players/guest`
Body: `{ "nickname": "Ninja42" }` (3–16 chars, `[A-Za-z0-9 _-]`, profanity-filtered).
403 `GUEST_PLAY_DISABLED` if disabled. Returns same shape with `verified: false`.

### `POST /sessions` — *Player bearer*
Body: `{ "mode": "classic" }` → `201 { "sessionId": "01J…", "seed": 2849120931, "settingsVersion": 7, "themeVersion": 12, "startedAt": "…" }`
Emits `session.started`. Rate limit: 30/min per player. Only one `active` session per player — starting a new one
abandons the previous.

### `POST /sessions/:id/events` — *Player bearer*
Batch of gameplay events (≤ 100 per request, ≤ 64 KB).
```json
{ "events": [
  { "seq": 1, "t": 1234, "type": "fruit.sliced", "data": { "objectId": 17, "objectKey": "fruit.apple", "swipeId": 3, "points": 1, "critical": false } },
  { "seq": 2, "t": 1240, "type": "combo.achieved", "data": { "swipeId": 3, "count": 3, "bonus": 3 } } ] }
```
- `seq` strictly increasing per session starting at 1; duplicates (same seq) are ignored → idempotent retries.
- `t` = ms since session start (monotonic, ≤ now − startedAt + 2 s skew).
- Allowed client types: `fruit.sliced`, `combo.achieved`, `special.activated`, `fruit.missed`, `life.lost`,
  `life.gained`, `bomb.hit`.
→ `202 { "acceptedThroughSeq": 2 }`. 409 if session is not `active`.

### `POST /sessions/:id/end` — *Player bearer*
Body: `{ "lastSeq": 87, "clientScore": 132, "reason": "bomb|strikes|timer|quit", "stats": { "durationMs": 64000, "sliced": 98, "missed": 3, "bestCombo": 5 } }`
Server: ensures all events through `lastSeq` received, recomputes score, runs plausibility checks
([SECURITY §3](SECURITY.md#3-score-integrity)).
→ `200 { "finalScore": 132, "verified": true, "accepted": true, "personalBest": 140, "rank": { "all": 57, "weekly": 9, "daily": 2 } }`
If checks fail → `422 SCORE_REJECTED` (session marked `rejected`, event `session.ended` with `scoreAccepted:false`).
Emits `session.ended`, `score.submitted`, and possibly `leaderboard.new_high_score`.

### `GET /players/me` — *Player bearer*
Player profile + personal bests per mode.

## 5. Integration Endpoints (API key)

### `GET /events`
Query: `cursor` (opaque string; omit to start from the beginning or use `from=latest`), `limit` (1–500, default 100),
`types` (comma list, supports `fruit.*` wildcard), `playerExternalId` (optional).
```json
{ "events": [ { "id": "01J…", "seq": 10234, "type": "session.ended", "version": 1, "occurredAt": "…", "…": "see EVENTS.md" } ],
  "nextCursor": "eyJzZXEiOjEwMjM0fQ", "hasMore": true }
```
Strict ascending `seq` order. Clients persist `nextCursor` and resume from it.

### `GET /events/:id`
Single event by id.

### `GET /players/:externalId/stats`
```json
{ "playerExternalId": "user-123", "gamesPlayed": 41, "totalFruitSliced": 3012,
  "best": { "classic": 412, "arcade": 288, "zen": 340 }, "lastPlayedAt": "…" }
```

### `GET /leaderboard`
Same as public, but also returns `externalId` per entry.

### `DELETE /players/:externalId`
Anonymizes a player for privacy requests (name → "Deleted player", external id nulled, scores kept but hidden from
boards). → `204`.

## 6. Admin Endpoints (`/admin/*`, admin cookie)

| Method & path | Purpose |
|---|---|
| `POST /admin/login` `{username, password}` | Constant-time compare against env; sets `bf_admin` + `bf_csrf` cookies. 5 attempts / 15 min / IP |
| `POST /admin/logout` | Clears cookies |
| `GET /admin/me` | `{ username, expiresAt }` |
| `GET /admin/dashboard` | KPIs: players today, sessions today, events/min, top scores, webhook health |
| `GET /admin/theme?status=draft\|published` | Full theme (draft by default) |
| `PUT /admin/theme/ui` | Update `ui` block (colors, title, font) of draft |
| `POST /admin/theme/objects` | Add custom object `{key, kind, label, radius, points, spawnWeight, juiceColor}` |
| `PATCH /admin/theme/objects/:key` | Update object fields / enable-disable |
| `DELETE /admin/theme/objects/:key` | Delete custom object (built-ins can only be disabled) |
| `POST /admin/media` (multipart `file`, `slot`) | Upload image/audio for a slot (e.g. `fruit.apple.image`, `ui.logo`, `sfx.slice`); returns `{ mediaId, url, width, height }` |
| `DELETE /admin/theme/slots/:slot` | Reset a slot to default |
| `POST /admin/theme/publish` | Draft → published, bump `themeVersion` |
| `POST /admin/theme/reset` | Reset whole draft to bundled default |
| `GET /admin/theme/export` / `POST /admin/theme/import` | Theme as zip (manifest + media) |
| `GET /admin/settings` / `PUT /admin/settings` | Gameplay settings (bumps `settingsVersion`) |
| `GET /admin/events` | Query: `types, playerId, sessionId, from, to, q, cursor, limit` (newest first) |
| `GET /admin/events/export?format=csv\|ndjson&…` | Streamed export of filtered events |
| `GET /admin/events/stream` | SSE of new events for the live tail toggle |
| `GET /admin/sessions/:id` | Session detail incl. event timeline and validation result |
| `GET /admin/players?q=` / `GET /admin/players/:id` | Player search & detail |
| `PATCH /admin/players/:id` `{banned: true}` | Ban player (their scores hidden; new sessions 403) |
| `GET /admin/leaderboard` | Same as public + hidden/removed rows |
| `DELETE /admin/scores/:id` `{reason}` | Soft-remove a score (emits nothing to host; audited) |
| `POST /admin/leaderboard/reset` `{mode, period}` | Archive & reset a board (sets `reset_at` watermark) |
| `GET/POST /admin/webhooks`, `PATCH/DELETE /admin/webhooks/:id` | Manage endpoints `{url, eventTypes[], active}`; secret generated per endpoint and shown once |
| `POST /admin/webhooks/:id/test` | Send a `webhook.test` event |
| `POST /admin/webhooks/:id/rotate-secret` | New secret (old valid 24 h) |
| `GET /admin/webhooks/:id/deliveries` | Delivery log |
| `POST /admin/webhooks/deliveries/:id/redeliver` | Manual retry |
| `GET/POST /admin/api-keys`, `DELETE /admin/api-keys/:id` | Create (plaintext shown once) / list / revoke |
| `GET /admin/audit-log` | Admin actions log |

## 7. Health

- `GET /healthz` → `200 {"status":"ok"}` (process alive).
- `GET /readyz` → `200` when DB is reachable and migrations applied; `503` otherwise.

## 8. Rate Limits (defaults)

| Scope | Limit |
|---|---|
| `/players/*` | 20/min per IP |
| `/sessions` create | 30/min per player |
| `/sessions/:id/events` | 120/min per session |
| Public `/leaderboard` | 60/min per IP |
| Integration (API key) | 600/min per key |
| `/admin/login` | 5 per 15 min per IP |
| Other `/admin/*` | 300/min per admin session |

## 9. CORS & Framing

- Gameplay endpoints are same-origin from the iframe; CORS only enabled for origins in `CORS_ORIGINS` (for hosts
  calling the integration API from browsers — discouraged; use server-to-server).
- `/play` sends `Content-Security-Policy: frame-ancestors <ALLOWED_FRAME_ANCESTORS>`; `/admin` sends
  `frame-ancestors 'none'`.
