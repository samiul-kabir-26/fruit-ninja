# Testing Strategy

| Layer | Tool | Location | Runs in CI |
|---|---|---|---|
| Unit | vitest | `tests/unit/` | every push |
| API / integration | vitest + supertest (in-memory SQLite via `DATABASE_PATH=:memory:`) | `tests/api/` | every push |
| E2E | Playwright (Chromium, WebKit, Firefox; mobile emulation) | `tests/e2e/` | PRs to main |
| Load | k6 | `tests/load/` | before release |

## 1. Unit

- `collision`: segment–circle hits/misses, tangent cases, zero-length segments, speed threshold.
- `prng` / `spawner`: same seed + settings ⇒ identical sequence; difficulty table boundaries; no bombs in first 3 s;
  bombs ≤ fruit per wave; Zen never spawns bombs.
- `scoringRules`: base points, combos (2 vs 3 vs 5 fruit), double-score multiplier, Arcade bomb floor at 0,
  criticals, pomegranate.
- `scoringService` plausibility checks: each rule has a passing and failing fixture (gaps in seq, impossible
  objectId, double slice, slice rate > 15/s, duration out of bounds, combo mismatch, score above theoretical max).
- `leaderboardService`: best-per-player, ties, period boundaries (Monday UTC), reset watermark, banned/removed excluded.
- Webhook signing/verification round-trip; retry schedule calculation; SSRF guard (private IPs rejected).
- Env validation: missing/short/placeholder secrets fail boot.

## 2. API

- Auth matrix: every route × {none, player, API key, admin, admin without CSRF} → expected status.
- Session flow happy path → events in DB in order, `score.submitted` emitted, rank returned.
- Idempotent event batch retry (same seq) → no duplicates.
- Tampering: modified `clientScore` → server score wins; forged events → 422 `SCORE_REJECTED`.
- Pull API cursor: concurrent inserts while paging → no gaps/duplicates; `types` wildcard; 410 on expired cursor.
- Uploads: PNG/WebP/JPEG accepted and re-encoded; SVG, GIF, renamed `.exe`, oversize → rejected.
- Theme draft vs published isolation; publish bumps version and ETag.
- Admin login rate limit → 429 after 5 failures.

## 3. E2E (Playwright)

1. **Guest Classic round:** open `/play`, enter nickname, start Classic, simulate swipes across spawned fruit using
   a test hook (`window.__bf.test.objects()` exposed only when `NODE_ENV=test`), slice a bomb → game over shows
   score and rank.
2. **Host token:** open `/play?token=…` → no nickname prompt, leaderboard shows host name; `bf:session-ended` posted
   to parent (test harness page).
3. **Admin re-skin:** log in, upload `bird.png` to `fruit.apple`, publish, open `/play` in new context → apple
   sprite URL equals uploaded media; slicing it emits `fruit.sliced` with `objectKey: fruit.apple`.
4. **Admin events explorer:** filter by the session from (1) → all events listed; export NDJSON matches API.
5. **Webhook:** register endpoint pointing at a test server, play a round → receiver gets signed `session.ended`
   and `score.submitted`.
6. Mobile viewport (iPhone 14, Pixel 7): touch swipe slices fruit; HUD not clipped; no horizontal scroll.

## 4. Performance

- Playwright trace on Pixel 7 emulation with 4× CPU throttle: average frame time < 18 ms during Frenzy.
- k6: 200 VUs each doing create session → 30 event batches → end; p95 < 100 ms, 0 errors.

## 5. Manual QA Checklist (per release)

- [ ] Feel: slicing responsive, trail smooth, halves fly naturally, juice colors correct per fruit
- [ ] Sound plays after first tap on iOS Safari; mute persists
- [ ] Pause on tab switch; resume works
- [ ] Reduced-motion disables shake
- [ ] Custom object with no halves auto-splits cleanly
- [ ] Theme reset restores defaults
- [ ] Webhook auto-disable after repeated failures shows dashboard alert
- [ ] Iframe embedding blocked on non-allowlisted origin
