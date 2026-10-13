import { verifyPlayerSession } from '../services/tokenService.js';
import * as playersRepo from '../repositories/players.js';

export function playerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Missing or malformed Authorization header',
        requestId: req.id || null
      }
    });
  }

  const token = authHeader.slice(7).trim();
  const decoded = verifyPlayerSession(token);

  if (!decoded || !decoded.playerId) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired player session token',
        requestId: req.id || null
      }
    });
  }

  const player = playersRepo.findById(decoded.playerId);
  if (!player) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Player no longer exists',
        requestId: req.id || null
      }
    });
  }

  if (player.banned) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Player account is suspended',
        requestId: req.id || null
      }
    });
  }

  req.player = {
    id: player.id,
    externalId: player.external_id,
    displayName: player.display_name,
    verified: Boolean(decoded.verified)
  };

  next();
}
