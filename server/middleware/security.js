import helmet from 'helmet';
import cors from 'cors';
import { ulid } from 'ulid';
import { env } from '../config/env.js';

export function requestIdMiddleware(req, res, next) {
  const reqId = req.headers['x-request-id'] || ulid();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

export function frameAncestorsMiddleware(req, res, next) {
  if (req.path.startsWith('/admin')) {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  } else if (req.path.startsWith('/play')) {
    const ancestors = env.ALLOWED_FRAME_ANCESTORS || "'self'";
    res.setHeader('Content-Security-Policy', `frame-ancestors ${ancestors}`);
  }
  next();
}

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      frameAncestors: env.ALLOWED_FRAME_ANCESTORS ? env.ALLOWED_FRAME_ANCESTORS.split(' ') : ["'self'"],
      // Plain-HTTP LAN access in dev would otherwise have assets rewritten to https
      upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
});

export const corsMiddleware = (req, res, next) => {
  if (req.path.startsWith('/api/v1/admin') || req.path.startsWith('/api/v1/sessions') || req.path.startsWith('/api/v1/players')) {
    return next();
  }

  const allowed = env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length === 0) {
    return next();
  }

  return cors({
    origin: (origin, callback) => {
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true
  })(req, res, next);
};
