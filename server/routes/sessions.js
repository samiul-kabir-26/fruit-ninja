import { Router } from 'express';
import { z } from 'zod';
import { playerAuth } from '../middleware/playerAuth.js';
import { sessionCreateLimiter, sessionEventsLimiter } from '../middleware/rateLimits.js';
import * as sessionService from '../services/sessionService.js';

const router = Router();

const createSessionSchema = z.object({
  mode: z.enum(['classic', 'arcade', 'zen'])
});

router.post('/', playerAuth, sessionCreateLimiter, (req, res, next) => {
  try {
    const { mode } = createSessionSchema.parse(req.body);
    const result = sessionService.createSession(req.player.id, mode);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const ingestEventsSchema = z.object({
  events: z.array(z.object({
    seq: z.number().int().positive(),
    t: z.number().nonnegative(),
    type: z.string(),
    data: z.record(z.any()).default({})
  })).max(100)
});

router.post('/:id/events', playerAuth, sessionEventsLimiter, (req, res, next) => {
  try {
    const { events } = ingestEventsSchema.parse(req.body);
    const result = sessionService.ingestEvents(req.params.id, req.player.id, events);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

const endSessionSchema = z.object({
  lastSeq: z.number().int().nonnegative().optional(),
  clientScore: z.number().int().nonnegative().optional(),
  reason: z.enum(['bomb', 'strikes', 'timer', 'quit']).default('quit'),
  stats: z.object({
    durationMs: z.number().nonnegative().optional(),
    sliced: z.number().int().nonnegative().optional(),
    missed: z.number().int().nonnegative().optional(),
    bestCombo: z.number().int().nonnegative().optional()
  }).optional()
});

router.post('/:id/end', playerAuth, (req, res, next) => {
  try {
    const payload = endSessionSchema.parse(req.body);
    const result = sessionService.endSession(req.params.id, req.player.id, payload);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
