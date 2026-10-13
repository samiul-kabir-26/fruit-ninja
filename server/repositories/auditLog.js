import { ulid } from 'ulid';
import { getDb } from '../db/connection.js';

export function log({ action, target = null, details = null, ip = null }) {
  const db = getDb();
  const id = ulid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO admin_audit_log (id, action, target, details_json, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, action, target, details ? JSON.stringify(details) : null, ip, now);
}

export function list(limit = 100) {
  const db = getDb();
  return db.prepare('SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ?').all(limit);
}
