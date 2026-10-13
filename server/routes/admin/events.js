import { Router } from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import * as eventsRepo from '../../repositories/events.js';
import * as sessionsRepo from '../../repositories/sessions.js';
import { formatEnvelope, subscribeSSE } from '../../services/eventService.js';

const router = Router();
router.use(adminAuth);

router.get('/events', (req, res) => {
  const types = req.query.types ? req.query.types.split(',').map(s => s.trim()) : null;
  const playerId = req.query.playerId || null;
  const sessionId = req.query.sessionId || null;
  const from = req.query.from || null;
  const to = req.query.to || null;
  const q = req.query.q || null;
  const cursorSeq = req.query.cursor ? Number(req.query.cursor) : null;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

  const rows = eventsRepo.findAdminEvents({
    types,
    playerId,
    sessionId,
    from,
    to,
    q,
    cursorSeq,
    limit: limit + 1
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const events = items.map(formatEnvelope);
  const nextCursor = items.length > 0 ? items[items.length - 1].seq : null;

  res.json({
    events,
    nextCursor,
    hasMore
  });
});

router.get('/events/export', (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'ndjson';
  const types = req.query.types ? req.query.types.split(',').map(s => s.trim()) : null;
  const playerId = req.query.playerId || null;
  const sessionId = req.query.sessionId || null;

  const rows = eventsRepo.findAdminEvents({
    types,
    playerId,
    sessionId,
    limit: 1000
  });

  const events = rows.map(formatEnvelope);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="events.csv"');
    res.write('id,seq,type,version,occurredAt,source,sessionId,playerId,displayName\n');
    for (const ev of events) {
      const line = [
        ev.id,
        ev.seq,
        ev.type,
        ev.version,
        ev.occurredAt,
        ev.source,
        ev.sessionId || '',
        ev.player?.id || '',
        `"${(ev.player?.displayName || '').replace(/"/g, '""')}"`
      ].join(',');
      res.write(line + '\n');
    }
    return res.end();
  }

  // ndjson
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Content-Disposition', 'attachment; filename="events.ndjson"');
  for (const ev of events) {
    res.write(JSON.stringify(ev) + '\n');
  }
  res.end();
});

router.get('/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write('retry: 3000\n\n');

  const unsubscribe = subscribeSSE((envelope) => {
    res.write(`data: ${JSON.stringify(envelope)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});

router.get('/sessions/:id', (req, res) => {
  const session = sessionsRepo.findById(req.params.id);
  if (!session) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Session not found',
        requestId: req.id || null
      }
    });
  }

  const rawEvents = eventsRepo.findBySessionId(session.id);
  const events = rawEvents.map(formatEnvelope);

  let validation = null;
  if (session.validation_json) {
    try {
      validation = JSON.parse(session.validation_json);
    } catch {
      validation = null;
    }
  }

  res.json({
    session,
    validation,
    events
  });
});

export default router;
