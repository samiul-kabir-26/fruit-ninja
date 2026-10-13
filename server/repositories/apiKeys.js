import { getDb } from '../db/connection.js';

export function create({ id, name, prefix, keyHash }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO api_keys (id, name, prefix, key_hash, created_at, last_used_at, revoked_at)
    VALUES (?, ?, ?, ?, ?, NULL, NULL)
  `).run(id, name, prefix, keyHash, now);
}

export function findByHash(keyHash) {
  const db = getDb();
  return db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL').get(keyHash) || null;
}

export function list() {
  const db = getDb();
  return db.prepare('SELECT id, name, prefix, created_at, last_used_at, revoked_at FROM api_keys ORDER BY created_at DESC').all();
}

export function revoke(id) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?').run(now, id);
}

export function touchLastUsed(id) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now, id);
}
