import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { signAdminSession, safeCompare } from '../../services/tokenService.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { adminLoginLimiter } from '../../middleware/rateLimits.js';
import * as auditRepo from '../../repositories/auditLog.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

router.post('/login', adminLoginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Username and password required',
        requestId: req.id || null
      }
    });
  }

  const { username, password } = parsed.data;
  const usernameMatch = safeCompare(username, env.ADMIN_USERNAME);

  let passwordMatch = false;
  if (env.ADMIN_PASSWORD.startsWith('$2')) {
    passwordMatch = bcrypt.compareSync(password, env.ADMIN_PASSWORD);
  } else {
    passwordMatch = safeCompare(password, env.ADMIN_PASSWORD);
  }

  const ip = req.ip || req.socket?.remoteAddress;

  if (!usernameMatch || !passwordMatch) {
    auditRepo.log({
      action: 'login_failure',
      target: username,
      details: { ip },
      ip
    });

    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Invalid username or password',
        requestId: req.id || null
      }
    });
  }

  auditRepo.log({
    action: 'login_success',
    target: username,
    details: { ip },
    ip
  });

  const token = signAdminSession(username);
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const maxAgeMs = env.ADMIN_SESSION_TTL_HOURS * 3600000;
  const isSecure = env.NODE_ENV === 'production';

  res.cookie('bf_admin', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/api/v1/admin',
    maxAge: maxAgeMs
  });

  res.cookie('bf_csrf', csrfToken, {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs
  });

  res.json({
    username,
    csrfToken,
    expiresAt: new Date(Date.now() + maxAgeMs).toISOString()
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('bf_admin', { path: '/api/v1/admin' });
  res.clearCookie('bf_csrf', { path: '/' });
  res.json({ ok: true });
});

router.get('/me', adminAuth, (req, res) => {
  res.json({
    username: req.admin.username
  });
});

export default router;
