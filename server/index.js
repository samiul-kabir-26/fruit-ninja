import { env } from './config/env.js';
import { migrate } from './db/migrate.js';
import { closeDb } from './db/connection.js';
import { createApp } from './app.js';
import { startWebhookWorker, stopWebhookWorker } from './services/webhookService.js';
import { sweepAbandonedSessions } from './services/sessionService.js';
import * as eventsRepo from './repositories/events.js';
import * as webhooksRepo from './repositories/webhooks.js';
import * as mediaRepo from './repositories/media.js';

// 1. Run migrations & seeding
migrate();

// 2. Initialize application
const app = createApp();

// 3. Start background services
startWebhookWorker();

// Sweeper for abandoned sessions every 60s
const sweeperInterval = setInterval(() => {
  sweepAbandonedSessions();
}, 60000);

// Daily retention cleanup (runs once every 24h)
const retentionInterval = setInterval(() => {
  eventsRepo.deleteOldEvents(env.EVENT_RETENTION_DAYS);
  webhooksRepo.deleteOldDeliveries(30);
  mediaRepo.garbageCollect(7);
}, 24 * 3600000);

// 4. Start HTTP Server
const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🗡️  Blade Fruit game service running on http://localhost:${env.PORT}`);
  // eslint-disable-next-line no-console
  console.log(`🎮 Game:  http://localhost:${env.PORT}/play`);
  // eslint-disable-next-line no-console
  console.log(`🛡️  Admin: http://localhost:${env.PORT}/admin`);
});

function gracefulShutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n[${signal}] Shutting down gracefully...`);
  clearInterval(sweeperInterval);
  clearInterval(retentionInterval);
  stopWebhookWorker();
  server.close(() => {
    closeDb();
    // eslint-disable-next-line no-console
    console.log('Server and database closed. Bye!');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
