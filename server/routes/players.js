import { Router } from 'express';
import { z } from 'zod';
import * as playersRepo from '../repositories/players.js';
import * as scoresRepo from '../repositories/scores.js';
import * as settingsRepo from '../repositories/settings.js';
import { verifyHostToken, signPlayerSession } from '../services/tokenService.js';
import { playerAuth } from '../middleware/playerAuth.js';
import { playersLimiter } from '../middleware/rateLimits.js';

const router = Router();

// Basic list of vulgarities to block on guest nicknames
const PROFANITY_REGEX = /\b(fuck|shit|bitch|asshole|cunt|dick|penis|vagina|nigger|faggot|whore|slut)\b/i;

const identifySchema = z.object({
  token: z.string().min(1)
});

router.post('/identify', playersLimiter, (req, res) => {
  const parsed = identifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Token is required',
        requestId: req.id || null
      }
    });
  }

  const claims = verifyHostToken(parsed.data.token);
  if (!claims) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Host token verification failed or expired',
        requestId: req.id || null
      }
    });
  }

  const player = playersRepo.upsertHostPlayer({
    externalId: claims.sub,
    displayName: claims.name,
    avatarUrl: claims.avatar || null,
    meta: claims.meta || null
  });

  if (player.banned) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Player account is banned',
        requestId: req.id || null
      }
    });
  }

  const sessionJwt = signPlayerSession(player.id, true);
  const expiresAt = new Date(Date.now() + 4 * 3600000).toISOString();

  res.json({
    player: {
      id: player.id,
      displayName: player.display_name,
      verified: true
    },
    playerSession: sessionJwt,
    expiresAt
  });
});

const guestSchema = z.object({
  nickname: z.string()
    .min(3, 'Nickname must be at least 3 characters')
    .max(16, 'Nickname cannot exceed 16 characters')
    .regex(/^[A-Za-z0-9 _-]+$/, 'Nickname can only contain letters, numbers, spaces, underscores and hyphens')
    .refine(val => !PROFANITY_REGEX.test(val), { message: 'Nickname contains disallowed words' })
});

router.post('/guest', playersLimiter, (req, res, next) => {
  try {
    const gameplay = settingsRepo.getGameplaySettings();
    if (!gameplay.guestPlayEnabled) {
      return res.status(403).json({
        error: {
          code: 'GUEST_PLAY_DISABLED',
          message: 'Guest play is currently disabled by administrator',
          requestId: req.id || null
        }
      });
    }

    const body = guestSchema.parse(req.body);
    const player = playersRepo.createGuestPlayer({
      displayName: body.nickname.trim()
    });

    const sessionJwt = signPlayerSession(player.id, false);
    const expiresAt = new Date(Date.now() + 4 * 3600000).toISOString();

    res.json({
      player: {
        id: player.id,
        displayName: player.display_name,
        verified: false
      },
      playerSession: sessionJwt,
      expiresAt
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', playerAuth, (req, res) => {
  const player = playersRepo.findById(req.player.id);
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

  res.json({
    id: player.id,
    externalId: player.external_id,
    displayName: player.display_name,
    avatarUrl: player.avatar_url,
    verified: player.source === 'host',
    bests
  });
});

export default router;
