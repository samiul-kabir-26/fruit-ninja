import express from 'express';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestIdMiddleware, frameAncestorsMiddleware, corsMiddleware } from './middleware/security.js';
import { errorHandler } from './middleware/errors.js';

// Route imports
import healthRouter from './routes/health.js';
import publicRouter from './routes/public.js';
import playersRouter from './routes/players.js';
import sessionsRouter from './routes/sessions.js';
import integrationRouter from './routes/integration.js';

// Admin route imports
import adminAuthRouter from './routes/admin/auth.js';
import adminDashboardRouter from './routes/admin/dashboard.js';
import adminThemeRouter from './routes/admin/theme.js';
import adminSettingsRouter from './routes/admin/settings.js';
import adminEventsRouter from './routes/admin/events.js';
import adminPlayersRouter from './routes/admin/players.js';
import adminLeaderboardRouter from './routes/admin/leaderboard.js';
import adminWebhooksRouter from './routes/admin/webhooks.js';
import adminApiKeysRouter from './routes/admin/apiKeys.js';
import adminAuditRouter from './routes/admin/audit.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);

  // Core middlewares
  app.use(requestIdMiddleware);
  app.use(frameAncestorsMiddleware);
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: true, limit: '64kb' }));

  // Root redirect
  app.get('/', (req, res) => {
    res.redirect('/play');
  });

  // Static Assets
  app.use('/shared', express.static(path.resolve('server/shared'), {
    setHeaders: (res) => {
      res.setHeader('Content-Type', 'text/javascript');
    }
  }));

  app.use('/css', express.static(path.resolve('public/css')));
  app.use('/assets', express.static(path.resolve('public/game/assets')));

  app.use('/media', express.static(path.resolve(env.UPLOAD_DIR), {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
    }
  }));

  app.use('/play', express.static(path.resolve('public/game')));
  app.use('/admin', express.static(path.resolve('public/admin')));

  // Health check routes
  app.use(healthRouter);

  // Admin API v1 (must be mounted before wildcard integrationRouter)
  app.use('/api/v1/admin', adminAuthRouter);
  app.use('/api/v1/admin', adminDashboardRouter);
  app.use('/api/v1/admin', adminThemeRouter);
  app.use('/api/v1/admin', adminSettingsRouter);
  app.use('/api/v1/admin', adminEventsRouter);
  app.use('/api/v1/admin', adminPlayersRouter);
  app.use('/api/v1/admin', adminLeaderboardRouter);
  app.use('/api/v1/admin', adminWebhooksRouter);
  app.use('/api/v1/admin', adminApiKeysRouter);
  app.use('/api/v1/admin', adminAuditRouter);

  // REST API v1
  app.use('/api/v1/players', playersRouter);
  app.use('/api/v1/sessions', sessionsRouter);
  app.use('/api/v1', publicRouter);

  // Integration API (uses API key auth)
  app.use('/api/v1', integrationRouter);

  // Error handler
  app.use(errorHandler);

  return app;
}
