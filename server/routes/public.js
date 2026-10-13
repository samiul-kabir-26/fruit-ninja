import { Router } from 'express';
import { z } from 'zod';
import * as settingsRepo from '../repositories/settings.js';
import * as themeRepo from '../repositories/theme.js';
import * as scoresRepo from '../repositories/scores.js';
import { leaderboardLimiter } from '../middleware/rateLimits.js';

const router = Router();

router.get('/config', (req, res) => {
  const config = settingsRepo.getGameplaySettings();
  res.json(config);
});

router.get('/theme', (req, res) => {
  const theme = themeRepo.getTheme('published');
  const etag = `"theme-v${theme.themeVersion}"`;

  res.setHeader('ETag', etag);
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  res.json(theme);
});

const leaderboardQuerySchema = z.object({
  mode: z.enum(['classic', 'arcade', 'zen']),
  period: z.enum(['all', 'weekly', 'daily']).default('all'),
  limit: z.coerce.number().min(1).max(100).default(50),
  verifiedOnly: z.string().or(z.boolean()).transform(v => v === true || v === 'true').default(false),
  playerId: z.string().optional()
});

router.get('/leaderboard', leaderboardLimiter, (req, res, next) => {
  try {
    const query = leaderboardQuerySchema.parse(req.query);
    const result = scoresRepo.getLeaderboard(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
