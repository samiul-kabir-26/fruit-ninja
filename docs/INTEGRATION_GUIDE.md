# Integration Guide — Embedding Blade Fruit in a Host System

Time to first event: ~30 minutes. You need: the service URL (e.g. `https://game.example.com`), the
`HOST_SHARED_SECRET` configured on the service, and an API key from the admin panel.

## 1. Allow your domain to frame the game

Set on the game service:
```
ALLOWED_FRAME_ANCESTORS=https://app.your-host.com https://staging.your-host.com
```

## 2. Sign a player token (server-side, never in the browser)

HS256 JWT signed with `HOST_SHARED_SECRET`:

| Claim | Required | Notes |
|---|---|---|
| `sub` | ✓ | Your stable user id (≤128 chars). Appears as `player.externalId` in events |
| `name` | ✓ | Display name on leaderboard (≤32 chars) |
| `exp` | ✓ | ≤ 24 h ahead; 15 min recommended |
| `iat` | | |
| `avatar` | | https URL |
| `meta` | | Small JSON object (≤1 KB) echoed in every event's `player.meta` — e.g. campaign id, tenant |

```js
// Node (jsonwebtoken)
import jwt from 'jsonwebtoken';
const token = jwt.sign(
  { sub: user.id, name: user.displayName, meta: { campaign: 'oct-promo' } },
  process.env.BLADE_FRUIT_SHARED_SECRET,
  { algorithm: 'HS256', expiresIn: '15m' }
);
```

## 3. Embed

```html
<iframe
  id="blade-fruit"
  src="https://game.example.com/play?token=ENCODED_TOKEN&mode=classic&lang=en"
  allow="autoplay; fullscreen"
  style="width:100%;aspect-ratio:16/9;border:0"></iframe>
```

Query parameters:

| Param | Effect |
|---|---|
| `token` | Signed player token (removed from the URL via `history.replaceState` right after load) |
| `mode` | Pre-select `classic` / `arcade` / `zen` and skip the menu |
| `hideLeaderboard=1` | Hide in-game leaderboard button |
| `lang` | UI language (v1: `en`) |

Prefer not to put the token in the URL? Load `/play` without it and send it after `bf:ready`:

```js
const frame = document.getElementById('blade-fruit');
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://game.example.com') return;
  if (e.data?.type === 'bf:ready') {
    frame.contentWindow.postMessage({ type: 'bf:auth', token }, 'https://game.example.com');
  }
});
```

## 4. `postMessage` contract

Game → host (target origin = the first entry of `ALLOWED_FRAME_ANCESTORS` matching `document.referrer`):

| `type` | Payload |
|---|---|
| `bf:ready` | `{ version }` |
| `bf:auth-required` | `{}` — token missing/expired; send `bf:auth` |
| `bf:session-started` | `{ sessionId, mode }` |
| `bf:session-ended` | `{ sessionId, mode, finalScore, accepted, rank }` |
| `bf:resize` | `{ height }` — for auto-height containers |

Host → game (origin must be in `ALLOWED_FRAME_ANCESTORS`):

| `type` | Payload |
|---|---|
| `bf:auth` | `{ token }` |
| `bf:start` | `{ mode }` |
| `bf:pause` / `bf:resume` | `{}` |
| `bf:mute` | `{ muted: true }` |

> `postMessage` notifications are for UX only. **Never award points from them** — use events (§5/§6).

## 5. Consume events — Pull API

```bash
curl -H "Authorization: Bearer bf_live_xxx" \
  "https://game.example.com/api/v1/events?types=score.submitted,session.ended&limit=100&cursor=$CURSOR"
```

Recommended consumer loop:

```js
let cursor = await store.get('bf_cursor');           // persisted
for (;;) {
  const res = await fetch(`${BASE}/api/v1/events?limit=200${cursor ? `&cursor=${cursor}` : ''}`,
                          { headers: { Authorization: `Bearer ${API_KEY}` } });
  const { events, nextCursor, hasMore } = await res.json();
  for (const ev of events) await handleOnce(ev.id, ev);  // dedupe on ev.id
  if (nextCursor) { cursor = nextCursor; await store.set('bf_cursor', cursor); }
  if (!hasMore) await sleep(3000);
}
```

## 6. Consume events — Webhooks

1. Admin panel → Webhooks → Add endpoint (URL, event types). Copy the secret.
2. Verify `X-BF-Signature` on every request (see [EVENTS §6](EVENTS.md#6-webhooks) for code), using the **raw**
   request body.
3. Respond 2xx within 10 s; process asynchronously.
4. Dedupe on event `id` — retries resend the same events.
5. Use the pull API to backfill after outages.

## 7. Awarding points (future host feature) — recommendations

- Grant from `score.submitted` (server-validated) rather than client gameplay events.
- For per-action rewards (combos etc.), buffer the session's events and grant only after `session.ended` with
  `scoreAccepted: true`.
- Apply your own caps (per day/user) — the game doesn't limit plays per user in v1.
- Ignore events where `player.verified` is `false` (guests) if rewards must map to real users.

## 8. Player stats lookup

`GET /api/v1/players/{externalId}/stats` with your API key — returns games played, totals and best scores.

## 9. Checklist

- [ ] `ALLOWED_FRAME_ANCESTORS` includes your origins
- [ ] Token signed server-side, short expiry
- [ ] API key stored as a secret
- [ ] Webhook signature verified with raw body, timestamp tolerance 300 s
- [ ] Event processing idempotent on `id`
- [ ] Cursor persisted durably
