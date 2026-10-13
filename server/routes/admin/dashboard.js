import { Router } from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import * as sessionsRepo from '../../repositories/sessions.js';
import * as eventsRepo from '../../repositories/events.js';
import * as scoresRepo from '../../repositories/scores.js';
import * as themeRepo from '../../repositories/theme.js';
import * as webhooksRepo from '../../repositories/webhooks.js';
import { getDb } from '../../db/connection.js';

const router = Router();
router.use(adminAuth);

router.get('/dashboard', (req, res) => {
  const db = getDb();

  // Players today
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startIso = startOfDay.toISOString();
  const playersToday = db.prepare('SELECT count(*) as count FROM players WHERE last_seen_at >= ?').get(startIso).count;

  // Sessions today
  const sessionStats = sessionsRepo.getSessionStatsToday();

  // Events last hour
  const eventsLastHour = eventsRepo.getEventsCountLastHour();

  // Avg score 7d
  const avgScore = scoresRepo.getAverageScorePast7Days();

  // Webhook health
  const webhookHealth = webhooksRepo.getWebhookHealthStats();

  // Unpublished theme changes badge
  const hasThemeChanges = themeRepo.hasUnpublishedChanges();

  // Top 5 per mode
  const topScores = scoresRepo.getTopScoresAllModes(5);

  // Recent 20 events
  const recentEvents = eventsRepo.getRecentEvents(20);

  res.json({
    kpis: {
      playersToday,
      sessionsToday: sessionStats.total,
      sessionsByMode: sessionStats.byMode,
      eventsLastHour,
      avgScorePast7d: avgScore,
      hasUnpublishedThemeChanges: hasThemeChanges
    },
    topScores,
    webhookHealth,
    recentEvents
  });
});

export default router;
