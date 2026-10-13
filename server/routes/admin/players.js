import { Router } from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import * as playersRepo from '../../repositories/players.js';
import * as scoresRepo from '../../repositories/scores.js';
import * as sessionsRepo from '../../repositories/sessions.js';
import * as auditRepo from '../../repositories/auditLog.js';

const router = Router();
router.use(adminAuth);

router.get('/players', (req, res) => {
  const query = req.query.q || '';
  const players = playersRepo.search(query, 50);
  res.json({ players });
});

router.get('/players/:id', (req, res) => {
  const player = playersRepo.findById(req.params.id);
  if (!player) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Player not found',
        requestId: req.id || null
      }
    });
  }

  const bests = scoresRepo.getPlayerBests(player.id);
  const recentSessions = sessionsRepo.getRecentByPlayerId(player.id, 10);

  res.json({
    player,
    bests,
    recentSessions
  });
});

router.patch('/players/:id', (req, res) => {
  const { banned } = req.body;
  if (banned === undefined) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Field "banned" is required',
        requestId: req.id || null
      }
    });
  }

  const updated = playersRepo.setBanned(req.params.id, Boolean(banned));
  if (!updated) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Player not found',
        requestId: req.id || null
      }
    });
  }

  auditRepo.log({
    action: banned ? 'player_ban' : 'player_unban',
    target: req.params.id,
    ip: req.ip
  });

  res.json({ ok: true, player: updated });
});

export default router;
