import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../server/app.js';
import { env } from '../../server/config/env.js';
import { migrate } from '../../server/db/migrate.js';
import { createWaveSpawner } from '../../server/shared/spawner.js';

let app;

beforeAll(() => {
  migrate();
  app = createApp();
});

describe('Health Endpoints', () => {
  it('GET /healthz returns 200 ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /readyz returns 200 ready', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
});

describe('Public Endpoints', () => {
  it('GET /api/v1/config returns gameplay settings', async () => {
    const res = await request(app).get('/api/v1/config');
    expect(res.status).toBe(200);
    expect(res.body.settingsVersion).toBeGreaterThanOrEqual(1);
    expect(res.body.modes.classic.lives).toBe(3);
  });

  it('GET /api/v1/theme returns theme manifest with ETag support', async () => {
    const res = await request(app).get('/api/v1/theme');
    expect(res.status).toBe(200);
    expect(res.headers.etag).toBeDefined();
    expect(res.body.objects.length).toBeGreaterThan(0);

    const etag = res.headers.etag;
    const res304 = await request(app).get('/api/v1/theme').set('If-None-Match', etag);
    expect(res304.status).toBe(304);
  });

  it('GET /api/v1/leaderboard returns list', async () => {
    const res = await request(app).get('/api/v1/leaderboard?mode=classic');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('classic');
    expect(Array.isArray(res.body.entries)).toBe(true);
  });
});

describe('Player Identity & Gameplay Session Flow', () => {
  let playerSessionToken;
  let playerId;

  it('POST /api/v1/players/guest creates guest player session', async () => {
    const res = await request(app)
      .post('/api/v1/players/guest')
      .send({ nickname: 'BladeHero' });

    expect(res.status).toBe(200);
    expect(res.body.player.displayName).toBe('BladeHero');
    expect(res.body.player.verified).toBe(false);
    expect(res.body.playerSession).toBeDefined();

    playerSessionToken = res.body.playerSession;
    playerId = res.body.player.id;
  });

  it('POST /api/v1/players/identify verifies host signed JWT', async () => {
    const hostToken = jwt.sign(
      { sub: 'host-user-99', name: 'NinjaHost' },
      env.HOST_SHARED_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    const res = await request(app)
      .post('/api/v1/players/identify')
      .send({ token: hostToken });

    expect(res.status).toBe(200);
    expect(res.body.player.displayName).toBe('NinjaHost');
    expect(res.body.player.verified).toBe(true);
  });

  it('Complete gameplay session flow: start -> events -> end', async () => {
    // 1. Start session
    const startRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${playerSessionToken}`)
      .send({ mode: 'classic' });

    expect(startRes.status).toBe(201);
    const { sessionId, seed } = startRes.body;
    expect(sessionId).toBeDefined();
    expect(seed).toBeDefined();

    // Replay spawner to get actual object
    const spawner = createWaveSpawner(seed, 'classic');
    const wave = spawner.spawnWave(1000);
    const target = wave[0];

    // 2. Ingest events (batch 1)
    const eventsBatch = [
      {
        seq: 1,
        t: Math.round(target.spawnTimeMs + 50),
        type: 'fruit.sliced',
        data: { objectId: target.objectId, objectKey: target.key, swipeId: 1, points: target.points }
      },
      {
        seq: 2,
        t: Math.round(target.spawnTimeMs + 200),
        type: 'bomb.hit',
        data: { objectId: 999, endsGame: true }
      }
    ];

    const eventsRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${playerSessionToken}`)
      .send({ events: eventsBatch });

    expect(eventsRes.status).toBe(202);
    expect(eventsRes.body.acceptedThroughSeq).toBe(2);

    // 3. Retry same batch (idempotency test)
    const retryRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${playerSessionToken}`)
      .send({ events: eventsBatch });

    expect(retryRes.status).toBe(202);

    // 4. End session
    const endRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${playerSessionToken}`)
      .send({
        lastSeq: 2,
        clientScore: target.points,
        reason: 'bomb',
        stats: { durationMs: 2000, sliced: 1, missed: 0, bestCombo: 0 }
      });

    expect(endRes.status).toBe(200);
    expect(endRes.body.accepted).toBe(true);
    expect(endRes.body.finalScore).toBe(target.points);
    expect(endRes.body.rank).toBeDefined();
  });
});

describe('Admin Panel API & Auth', () => {
  let adminCookies;
  let csrfToken;

  it('POST /api/v1/admin/login fails with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/admin/login')
      .send({ username: 'admin', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('POST /api/v1/admin/login succeeds and sets cookies', async () => {
    const res = await request(app)
      .post('/api/v1/admin/login')
      .send({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeDefined();
    csrfToken = res.body.csrfToken;
    adminCookies = res.headers['set-cookie'];
    expect(adminCookies).toBeDefined();
  });

  it('GET /api/v1/admin/dashboard returns metrics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.kpis).toBeDefined();
    expect(res.body.topScores).toBeDefined();
  });

  it('Mutating admin request without CSRF is rejected with 403', async () => {
    const res = await request(app)
      .post('/api/v1/admin/theme/publish')
      .set('Cookie', adminCookies); // No X-CSRF-Token

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_MISMATCH');
  });

  it('Mutating admin request with CSRF succeeds', async () => {
    const res = await request(app)
      .post('/api/v1/admin/theme/publish')
      .set('Cookie', adminCookies)
      .set('X-CSRF-Token', csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.themeVersion).toBeGreaterThan(1);
  });
});
