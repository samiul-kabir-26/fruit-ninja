import { hashApiKey } from '../services/tokenService.js';
import * as apiKeysRepo from '../repositories/apiKeys.js';

export function apiKeyAuth(req, res, next) {
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

  const keyPlaintext = authHeader.slice(7).trim();
  if (!keyPlaintext.startsWith('bf_live_')) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid API key format',
        requestId: req.id || null
      }
    });
  }

  const keyHash = hashApiKey(keyPlaintext);
  const keyRecord = apiKeysRepo.findByHash(keyHash);

  if (!keyRecord || keyRecord.revoked_at) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Invalid or revoked API key',
        requestId: req.id || null
      }
    });
  }

  apiKeysRepo.touchLastUsed(keyRecord.id);
  req.apiKey = keyRecord;

  next();
}
