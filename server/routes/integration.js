import { Router } from 'express';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { integrationLimiter } from '../middleware/rateLimits.js';
import * as eventsRepo from '../repositories/events.js';
import * as playersRepo from '../repositories/players.js';
import * as scoresRepo from '../repositories/scores.js';
import { formatEnvelope } from '../services/eventService.js';

const router = Router();

router.use(apiKeyAuth);
router.use(integrationLimiter);

function decodeCursor(cursorStr) {
  if (!cursorStr) return 0;
  try {
    const json = Buffer.from(cursorStr, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return Number(parsed.seq) || 0;
  } catch {
    return 0;
  }
}

function encodeCursor(seq) {
  return Buffer.from(JSON.stringify({ seq })).toString('base64');
}

router.get('/events', (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    let cursorSeq = 0;

    if (req.query.from === 'latest') {
      const recent = eventsRepo.getRecentEvents(1);
      cursorSeq = recent.length > 0 ? recent[0].seq : 0;
    } else if (req.query.cursor) {
      cursorSeq = decodeCursor(req.query.cursor);
    }

    const types = req.query.types ? req.query.types.split(',').map(s => s.trim()) : null;
    const playerExternalId = req.query.playerExternalId || null;

    // Fetch limit + 1 to know if there's hasMore
    const rows = eventsRepo.findByCursor({
      cursorSeq,
      limit: limit + 1,
      types,
      playerExternalId
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const events = items.map(formatEnvelope);

    const nextSeq = items.length > 0 ? items[items.length - 1].seq : cursorSeq;
    const nextCursor = items.length > 0 ? encodeCursor(nextSeq) : null;

    res.json({
      events,
      nextCursor,
      hasMore
    });
  } catch (err) {
    next(err);
  }
});

router.get('/events/:id', (req, res) => {
  const row = eventsRepo.findById(req.params.id);
  if (!row) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Event not found',
        requestId: req.id || null
      }
    });
  }
  res.json(formatEnvelope(row));
});

router.get('/players/:externalId/stats', (req, res) => {
  const stats = scoresRepo.getPlayerStats(req.params.externalId);
  if (!stats) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Player not found',
        requestId: req.id || null
      }
    });
  }
  res.json(stats);
});

router.delete('/players/:externalId', (req, res) => {
  const success = playersRepo.anonymize(req.params.externalId);
  if (!success) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Player not found',
        requestId: req.id || null
      }
    });
  }
  res.status(204).end();
});

const leaderboardSchema = z.object({
  mode: z.enum(['classic', 'arcade', 'zen']),
  period: z.enum(['all', 'weekly', 'daily']).default('all'),
  limit: z.coerce.number().min(1).max(100).default(50),
  verifiedOnly: z.string().or(z.boolean()).transform(v => v === true || v === 'true').default(false)
});

router.get('/leaderboard', (req, res, next) => {
  try {
    const query = leaderboardSchema.parse(req.query);
    const result = scoresRepo.getLeaderboard(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
