# Event Specification — Blade Fruit

Events are the contract between this game service and any host system (e.g. a future points/rewards engine).
They are **append-only, immutable, ordered, and versioned**.

## 1. Envelope

Every event, whether read from the pull API, a webhook, or the admin explorer, has this shape:

```json
{
  "id": "01JA8Z3M4Q6R7S8T9V0W1X2Y3Z",
  "seq": 10234,
  "type": "fruit.sliced",
  "version": 1,
  "occurredAt": "2026-10-13T08:12:44.512Z",
  "receivedAt": "2026-10-13T08:12:45.020Z",
  "source": "client",
  "sessionId": "01JA8Z2…",
  "mode": "classic",
  "player": {
    "id": "01JA8Y…",
    "externalId": "user-123",
    "displayName": "Aiko",
    "verified": true,
    "meta": { "campaign": "oct-promo" }
  },
  "data": { }
}
```

| Field | Notes |
|---|---|
| `id` | ULID, globally unique — **use for idempotency** |
| `seq` | Monotonic integer across the whole service; ordering & cursor key |
| `type` | `domain.action`, lower-case dot notation |
| `version` | Schema version of `data` for this `type` (starts at 1) |
| `occurredAt` | For client events: `session.startedAt + t` (clamped to ≤ `receivedAt`); for server events: server time |
| `source` | `client` (reported by game, validated) or `server` (produced by the service itself) |
| `player.externalId` | Host user id from token `sub`; `null` for guests |
| `player.meta` | Echo of the token's `meta` claim — lets host correlate campaigns |

> **Trust guidance for integrators:** award rewards from **server-sourced** events — primarily `score.submitted`
> (only emitted for accepted scores) and `session.ended`. Client-sourced events (`fruit.sliced`, etc.) are
> validated for shape and sequence, but are only fully cross-checked at session end. For per-action rewards, wait
> for that session's `session.ended` with `scoreAccepted: true` before granting.

## 2. Event Catalog

### Session lifecycle (server)

| Type | `data` |
|---|---|
| `session.started` | `{ "settingsVersion": 7, "themeVersion": 12, "seed": 2849120931 }` |
| `session.ended` | `{ "reason": "bomb\|strikes\|timer\|quit", "durationMs": 64000, "finalScore": 132, "clientScore": 132, "scoreAccepted": true, "rejectionReasons": [], "stats": { "sliced": 98, "missed": 3, "bombsHit": 1, "bestCombo": 5, "combos": 7, "specials": 2 } }` |
| `session.abandoned` | `{ "lastSeq": 40, "idleMs": 1800000 }` — no score recorded |
| `score.submitted` | `{ "scoreId": "01J…", "score": 132, "personalBest": true, "previousBest": 120, "rank": { "all": 57, "weekly": 9, "daily": 2 } }` |
| `leaderboard.new_high_score` | `{ "scoreId": "01J…", "score": 412, "period": "all\|weekly\|daily", "rank": 1, "previousHolderPlayerId": "01J…" }` — emitted once per period in which the player reached **rank 1–10** with a new personal best |
| `player.first_game` | `{ }` — emitted once per player on their first accepted session |

### Gameplay (client, validated)

| Type | `data` |
|---|---|
| `fruit.sliced` | `{ "objectId": 17, "objectKey": "fruit.apple", "swipeId": 3, "points": 1, "critical": false, "multiplier": 1 }` |
| `combo.achieved` | `{ "swipeId": 3, "count": 4, "bonus": 4, "objectIds": [17,18,19,20] }` |
| `special.activated` | `{ "objectId": 31, "special": "freeze\|frenzy\|double", "durationMs": 5000 }` (Arcade) |
| `fruit.missed` | `{ "objectId": 22, "objectKey": "fruit.kiwi" }` |
| `life.lost` | `{ "livesRemaining": 2, "cause": "missed" }` (Classic) |
| `life.gained` | `{ "livesRemaining": 3, "atScore": 100 }` (Classic) |
| `bomb.hit` | `{ "objectId": 9, "penalty": 10, "endsGame": false }` |

`objectId` is the index in the deterministic spawn sequence generated from `seed`; the server can regenerate the
sequence to verify an object of that key existed (see [SECURITY §3](SECURITY.md#3-score-integrity)).

### Admin / system (server, not sent to webhooks by default)

| Type | `data` |
|---|---|
| `theme.published` | `{ "themeVersion": 13 }` |
| `settings.updated` | `{ "settingsVersion": 8, "changed": ["physics.gravity"] }` |
| `score.removed` | `{ "scoreId": "01J…", "reason": "cheating" }` |
| `leaderboard.reset` | `{ "mode": "classic", "period": "weekly" }` |
| `webhook.test` | `{ "message": "Test delivery from Blade Fruit" }` |

## 3. Example: what a points engine might do (future)

| Event | Example reward rule (host-side) |
|---|---|
| `score.submitted` | 1 point per 10 game points, cap 50/day |
| `combo.achieved` with `count ≥ 5` | Badge "Combo Master" (after session accepted) |
| `leaderboard.new_high_score` `period=weekly rank=1` | 500 bonus points |
| `player.first_game` | Welcome bonus |

## 4. Pull API Semantics

`GET /api/v1/events?cursor=<c>&limit=100&types=score.*,session.ended`

- Results ordered by `seq` ascending; `nextCursor` encodes the last `seq` returned.
- Events become visible only after their transaction commits, and `seq` is assigned at commit by SQLite's single
  writer — so a reader at cursor *c* can never later see an event with `seq ≤ c` appear (no gaps filled later).
- `hasMore: false` ⇒ caught up; poll again after 1–5 s (or use webhooks).
- Retention: `EVENT_RETENTION_DAYS` (default 90). A cursor older than retention returns `410 CURSOR_EXPIRED`.

## 5. Versioning

- Additive changes (new optional field) do **not** bump `version`.
- Breaking changes create `version: 2` of that type; the service emits **both** v1 and v2 for one deprecation
  window (≥ 90 days), differentiated by `version`. Consumers filter on `(type, version)`.
- New event types may appear at any time — consumers must ignore unknown types.

## 6. Webhooks

**Request**

```
POST <endpoint url>
Content-Type: application/json
User-Agent: BladeFruit-Webhooks/1.0
X-BF-Delivery-Id: 01JA9…
X-BF-Signature: t=1760343164,v1=5f2b0c…(hex HMAC-SHA256)

{ "deliveryId": "01JA9…", "endpointId": "01J…", "events": [ { …envelope… }, … ] }
```

- Up to 50 events per delivery, in `seq` order.
- **Signature:** `v1 = HMAC_SHA256(endpointSecret, "${t}.${rawBody}")`. Receivers must verify with constant-time
  comparison and reject if `|now − t| > 300 s`. During a secret rotation, two `v1=` values are sent.
- **Success:** any 2xx within 10 s. Anything else (or timeout) = failure.
- **Retry schedule** (from first attempt): 10 s, 30 s, 2 min, 10 min, 30 min, 1 h, 3 h, 6 h, 12 h, 24 h → then the
  delivery is marked `failed`, the endpoint is auto-disabled after 3 consecutive failed deliveries, and the admin
  dashboard shows an alert. The pull API remains available to backfill.
- **Ordering:** per endpoint, deliveries are sequential — a delivery isn't sent until the previous one succeeded or
  permanently failed.
- **Idempotency:** retries resend the same `deliveryId` and event `id`s; receivers must dedupe on event `id`.
- Default subscribed types for a new endpoint: `session.ended`, `score.submitted`, `leaderboard.new_high_score`,
  `player.first_game`. Admin can subscribe to any type including `*`.

Receiver verification example (Node):

```js
import crypto from 'node:crypto';

export function verifyBladeFruit(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  return sigs.some(s => s.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
```

## 7. Source of Event Types in Code

`server/shared/eventTypes.js` exports the canonical, dependency-free list of types and versions; it is imported by
the client (so it can only emit known types) and the server. Per-type zod schemas live in
`server/services/eventSchemas.js` (server only). Adding a new type = add it there + document it here.
