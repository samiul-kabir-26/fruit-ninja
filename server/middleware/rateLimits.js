import rateLimit from 'express-rate-limit';

const rateLimitHandler = (message = 'Too many requests, please try again later.') => (req, res) => {
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message,
      requestId: req.id || null
    }
  });
};

export const playersLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: rateLimitHandler('Too many player requests')
});

export const sessionCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.player?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: rateLimitHandler('Session creation rate limit exceeded')
});

export const sessionEventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.params.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: rateLimitHandler('Event batch rate limit exceeded')
});

export const leaderboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: rateLimitHandler('Leaderboard rate limit exceeded')
});

export const integrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  keyGenerator: (req) => req.apiKey?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: rateLimitHandler('Integration API rate limit exceeded')
});

export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: rateLimitHandler('Too many failed admin login attempts. Please wait 15 minutes.')
});

export const adminApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: (req) => req.admin?.username || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: rateLimitHandler('Admin API rate limit exceeded')
});
