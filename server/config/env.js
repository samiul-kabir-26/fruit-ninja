import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(8080),
  PUBLIC_BASE_URL: z.string().default('http://localhost:8080'),
  TRUST_PROXY: z.coerce.number().default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  ADMIN_USERNAME: z.string().min(1).default('admin'),
  ADMIN_PASSWORD: z.string().min(1).refine(v => v !== 'change-me', {
    message: 'ADMIN_PASSWORD must not be "change-me"'
  }),
  ADMIN_JWT_SECRET: z.string().min(32).refine(v => !v.includes('change-me'), {
    message: 'ADMIN_JWT_SECRET must be at least 32 characters and not contain "change-me"'
  }),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().default(8),

  HOST_SHARED_SECRET: z.string().min(32).refine(v => !v.includes('change-me'), {
    message: 'HOST_SHARED_SECRET must be at least 32 characters and not contain "change-me"'
  }),
  PLAYER_JWT_SECRET: z.string().min(32).refine(v => !v.includes('change-me'), {
    message: 'PLAYER_JWT_SECRET must be at least 32 characters and not contain "change-me"'
  }),
  GUEST_PLAY_ENABLED: z.string().or(z.boolean()).transform(v => v === true || v === 'true').default(true),

  DATABASE_PATH: z.string().default('./data/blade-fruit.db'),
  UPLOAD_DIR: z.string().default('./data/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().default(1048576),
  EVENT_RETENTION_DAYS: z.coerce.number().default(90),

  DATA_ENCRYPTION_KEY: z.string().min(32).refine(v => !v.includes('change-me'), {
    message: 'DATA_ENCRYPTION_KEY must be at least 32 characters and not contain "change-me"'
  }),
  WEBHOOK_ALLOW_PRIVATE: z.string().or(z.boolean()).transform(v => v === true || v === 'true').default(false),

  ALLOWED_FRAME_ANCESTORS: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
