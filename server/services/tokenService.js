import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Derive 32-byte key buffer for AES-256-GCM
function getEncryptionKey() {
  if (/^[0-9a-fA-F]{64}$/.test(env.DATA_ENCRYPTION_KEY)) {
    return Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex');
  }
  return crypto.createHash('sha256').update(env.DATA_ENCRYPTION_KEY).digest();
}

/**
 * Encrypt a string using AES-256-GCM.
 */
export function encryptSecret(plainText) {
  if (!plainText) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string using AES-256-GCM.
 */
export function decryptSecret(encryptedPayload) {
  if (!encryptedPayload) return null;
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Verify host-signed player JWT (HS256).
 */
export function verifyHostToken(token) {
  try {
    const decoded = jwt.verify(token, env.HOST_SHARED_SECRET, {
      algorithms: ['HS256'],
      clockTolerance: 30
    });
    if (!decoded.sub || !decoded.name) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Issue player session JWT (4 hours TTL).
 */
export function signPlayerSession(playerId, verified = false) {
  return jwt.sign(
    { playerId, verified },
    env.PLAYER_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '4h' }
  );
}

/**
 * Verify player session JWT.
 */
export function verifyPlayerSession(token) {
  try {
    return jwt.verify(token, env.PLAYER_JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

/**
 * Issue admin session JWT.
 */
export function signAdminSession(username) {
  return jwt.sign(
    { username },
    env.ADMIN_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: `${env.ADMIN_SESSION_TTL_HOURS}h` }
  );
}

/**
 * Verify admin session JWT.
 */
export function verifyAdminSession(token) {
  try {
    return jwt.verify(token, env.ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

/**
 * Generate a random API key (returns plaintext and sha256 hash).
 */
export function generateApiKey() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomStr = '';
  const bytes = crypto.randomBytes(32);
  for (let i = 0; i < 32; i++) {
    randomStr += chars[bytes[i] % chars.length];
  }
  const plaintext = `bf_live_${randomStr}`;
  const prefix = plaintext.slice(0, 16);
  const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, prefix, hash };
}

/**
 * Hash an API key.
 */
export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Safe timing-resistant string comparison.
 */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
