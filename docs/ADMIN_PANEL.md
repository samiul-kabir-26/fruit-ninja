# Admin Panel Specification

URL: `/admin` · Tech: HTML + Tailwind + vanilla ES modules, hash router (`#/theme`, `#/events`, …).
Talks only to `/api/v1/admin/*` ([API §6](API.md)).

## 1. Authentication

- Single admin defined by env: `ADMIN_USERNAME`, `ADMIN_PASSWORD` (plaintext **or** a bcrypt hash if the value
  starts with `$2`). No sign-up, no password reset — change env and restart.
- Login form → `POST /admin/login` → httpOnly `bf_admin` cookie (JWT signed with `ADMIN_JWT_SECRET`, TTL
  `ADMIN_SESSION_TTL_HOURS`, default 8) + readable `bf_csrf` cookie sent back as `X-CSRF-Token`.
- 5 failed attempts / 15 min / IP → locked with countdown message.
- Any 401 from the API redirects to `#/login`. Logout button in the top bar.
- Every mutating action is written to `admin_audit_log`.

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [logo] Blade Fruit Admin                 env: production   [Logout] │
├───────────────┬──────────────────────────────────────────────────────┤
│ Dashboard     │                                                      │
│ Theme         │                 view content                         │
│ Gameplay      │                                                      │
│ Events        │                                                      │
│ Leaderboard   │                                                      │
│ Players       │                                                      │
│ Webhooks      │                                                      │
│ API Keys      │                                                      │
│ Audit Log     │                                                      │
└───────────────┴──────────────────────────────────────────────────────┘
```
Responsive: sidebar collapses to a top drawer < 768 px. Dark/light via `prefers-color-scheme`.

## 3. Dashboard

KPI cards: players today, sessions today (by mode), events last hour, avg score (7 d), webhook health
(green/amber/red per endpoint), unpublished theme changes badge. Top 5 per mode. Recent 20 events (live).

## 4. Theme Editor

Three panes: **slot list** · **slot editor** · **live preview**.

### Slots

| Group | Slots |
|---|---|
| Fruit (built-in) | apple, orange, watermelon, banana, pineapple, strawberry, coconut, kiwi, pomegranate — each: `image`, `halfLeft`, `halfRight`, label, radius, points, spawn weight, juice color, enabled |
| Custom objects | "+ Add object" — any image (e.g. a **bird**, a product, a mascot) behaving as a fruit, with all fields above |
| Hazards | bomb: `image`, fuse particle color |
| Specials (Arcade) | freeze, frenzy, double: `image`, halves, juice color |
| UI | `logo`, `background`, `menuBackground`, title text, primary/accent colors, font (system / Google Font name from allowlist), blade color, blade glow color, strike icon |
| Audio | slice, splat, combo, bomb fuse, explosion, throw, game over, menu music |

### Upload rules
- Images: PNG, WebP, JPEG ≤ `MAX_UPLOAD_BYTES` (1 MB). **SVG rejected.** Server sniffs magic bytes, re-encodes
  with `sharp` to WebP (alpha preserved), max 512×512 for objects, 2560×1440 for backgrounds.
- Audio: MP3 / OGG ≤ 1 MB, ≤ 10 s for SFX, ≤ 3 min for music.
- Halves optional: if missing, the preview shows the auto-clipped halves the engine will generate.
- Uploading shows a circle overlay of the object's `radius` (the hitbox) so the admin can align the image.

### Live preview
An embedded `<iframe src="/play?preview=draft">` (admin cookie authorizes draft theme) running an **attract mode**
that continuously tosses every enabled object so the admin can see sprites, halves and juice colors in motion.
Changes post to the iframe via `postMessage` for instant refresh without reload.

### Publish workflow
- All edits save to **draft** immediately (autosave, toast "Saved to draft").
- "Unpublished changes" banner with **Publish** and **Discard draft**.
- Publish → confirmation modal listing changed slots → `POST /admin/theme/publish`.
- Per-slot "Reset to default", global "Reset entire theme".
- Export / import theme as `.zip` (manifest.json + media) to move themes between environments.

## 5. Gameplay Settings

Form grouped by section with validated ranges and inline help; "Restore defaults" per section.

| Setting | Range | Default |
|---|---|---|
| Modes enabled | toggles | all on |
| Classic lives | 1–5 | 3 |
| Classic life recovery every N points | 0 (off)–1000 | 100 |
| Arcade duration (s) | 30–180 | 60 |
| Zen duration (s) | 30–300 | 90 |
| Gravity | 800–2400 | 1400 |
| Min blade speed | 300–2000 | 900 |
| Bomb probability cap | 0–0.4 | 0.18 |
| Arcade bomb penalty | 0–50 | 10 |
| Special chance / critical chance | 0–0.3 / 0–0.2 | 0.06 / 0.02 |
| Combo min / bonus per fruit | 2–6 / 0–5 | 3 / 1 |
| Difficulty table | editable rows (untilSec, waveInterval, min/max objects, bombChance) | see GAME_DESIGN §5 |
| Guest play allowed | toggle | on |

Saving bumps `settingsVersion`; new sessions use it, running sessions keep their snapshot.

## 6. Events Explorer

- Table: time, type (colored chip), player (name + externalId), session (link), mode, summary of `data`.
- Filters: type multi-select (with group toggles `session.*`, `fruit.*`…), player search, session id,
  date range, free-text search within `data_json`.
- Pagination: cursor-based infinite scroll, newest first.
- Row click → side drawer with pretty JSON envelope (exactly what integrators receive) + "Copy".
- **Live tail** toggle (SSE `GET /admin/events/stream`).
- Export filtered results as CSV or NDJSON (streamed).
- Session detail page: timeline of all events, validation result (each check pass/fail), final vs client score.

## 7. Leaderboard

- Tabs per mode × period; toggle "verified only".
- Row actions: **Remove score** (reason required, soft delete), view player, view session.
- "Reset board" for weekly/daily/all (confirmation typing the mode name). Historical rows are kept; a reset
  watermark hides older scores.

## 8. Players

Search by name / externalId. Detail: profile, bests, recent sessions, events link, **Ban/Unban**.

## 9. Webhooks

- List endpoints with status, success rate (24 h), last delivery.
- Create: URL (https required unless `NODE_ENV=development`), event-type checkboxes, active toggle. Secret shown
  **once** with copy button.
- Actions: Send test, Rotate secret, Disable/Enable, Delete.
- Delivery log: status, attempts, response code, response snippet, next retry; **Redeliver** button.

## 10. API Keys

Create (name) → plaintext `bf_live_…` shown once. List shows prefix, created, last used. Revoke with confirm.

## 11. Audit Log

Read-only table of admin actions (login success/failure, theme publish, settings change, score removal, key
creation/revocation, webhook changes) with IP and timestamp.
