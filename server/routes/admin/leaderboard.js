import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../../middleware/adminAuth.js';
import * as scoresRepo from '../../repositories/scores.js';
import * as auditRepo from '../../repositories/auditLog.js';
import * as eventService from '../../services/eventService.js';

const router = Router();
router.use(adminAuth);

const leaderboardQuerySchema = z.object({
  mode: z.enum(['classic', 'arcade', 'zen']),
  period: z.enum(['all', 'weekly', 'daily']).default('all'),
  limit: z.coerce.number().min(1).max(100).default(50),
  verifiedOnly: z.string().or(z.boolean()).transform(v => v === true || v === 'true').default(false)
});

router.get('/leaderboard', (req, res, next) => {
  try {
    const query = leaderboardQuerySchema.parse(req.query);
    const result = scoresRepo.getLeaderboard({
      ...query,
      includeRemoved: true
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const removeScoreSchema = z.object({
  reason: z.string().min(1, 'Reason is required')
});

router.delete('/scores/:id', (req, res, next) => {
  try {
    const { reason } = removeScoreSchema.parse(req.body);
    const score = scoresRepo.findById(req.params.id);
    if (!score) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Score not found',
          requestId: req.id || null
        }
      });
    }

    scoresRepo.softDelete(req.params.id, reason);

    eventService.emit('score.removed', {
      data: {
        scoreId: req.params.id,
        reason
      }
    });

    auditRepo.log({
      action: 'score_remove',
      target: req.params.id,
      details: { reason, previousScore: score.score, mode: score.mode },
      ip: req.ip
    });

    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
});

const resetBoardSchema = z.object({
  mode: z.enum(['classic', 'arcade', 'zen']),
  period: z.enum(['all', 'weekly', 'daily'])
});

router.post('/leaderboard/reset', (req, res, next) => {
  try {
    const { mode, period } = resetBoardSchema.parse(req.body);
    const now = new Date().toISOString();

    scoresRepo.setResetWatermark(mode, period, now);

    eventService.emit('leaderboard.reset', {
      data: { mode, period }
    });

    auditRepo.log({
      action: 'leaderboard_reset',
      target: `${mode}:${period}`,
      details: { resetAt: now },
      ip: req.ip
    });

    res.json({ ok: true, mode, period, resetAt: now });
  } catch (err) {
    next(err);
  }
});

export default router;
