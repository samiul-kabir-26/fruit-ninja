# Blade Fruit — Embeddable Fruit-Slicing Game Service

A Fruit Ninja–style browser game delivered as a microservice: slice fruit, dodge bombs, chain combos, and climb the
leaderboard. Hosts embed it with an iframe and a signed player token, re-skin it from an admin panel, and consume
every gameplay event (pull API or signed webhooks) to award points in their own systems.

> Status: **design phase** — the documents below define the implementation. Code follows
> [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).
>
> "Fruit Ninja" is a trademark of Halfbrick Studios. This project uses only original or openly licensed assets and
> its own name.

## Stack

- **Game & admin UI:** HTML, Tailwind CSS (compiled), vanilla JavaScript ES modules, Canvas 2D, Web Audio
- **Service:** Node.js 24, Express, SQLite (`better-sqlite3`)
- **Packaging:** single Docker image, state in `/data`

## Documentation

| Doc | What's in it |
|---|---|
| [PRD](docs/PRD.md) | Goals, personas, user stories with acceptance criteria, requirements, milestones, risks |
| [Game Design](docs/GAME_DESIGN.md) | Modes, physics, slicing, scoring, FX, difficulty, screens |
| [Architecture](docs/ARCHITECTURE.md) | Components, folder layout, request flows, scaling path |
| [API](docs/API.md) | Every endpoint, auth schemes, errors, rate limits |
| [Events](docs/EVENTS.md) | Event envelope & catalog, pull API semantics, webhook signing & retries |
| [Data Model](docs/DATA_MODEL.md) | SQLite schema, indexes, retention |
| [Admin Panel](docs/ADMIN_PANEL.md) | Screens: theme editor, settings, events explorer, leaderboard, webhooks, API keys |
| [Integration Guide](docs/INTEGRATION_GUIDE.md) | How a host embeds the game and consumes events |
| [Security](docs/SECURITY.md) | Threat model, anti-cheat, upload safety, hardening |
| [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) | Milestones M0–M6 with task checklists and DoD |
| [Testing](docs/TESTING.md) | Unit / API / E2E / load strategy and QA checklist |

## Quick start (once implemented)

```bash
cp .env.example .env          # fill in secrets (openssl rand -hex 32)
npm install
npm run build:css
npm run dev                   # http://localhost:8080/play  and  /admin
```

Docker:

```bash
docker compose up --build
```

## URLs

| Path | Purpose |
|---|---|
| `/play` | The game (embed this) |
| `/admin` | Admin panel (credentials from `.env`) |
| `/api/v1` | REST API |
| `/healthz`, `/readyz` | Health checks |
