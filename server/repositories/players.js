import { ulid } from 'ulid';
import { getDb } from '../db/connection.js';

export function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM players WHERE id = ?').get(id) || null;
}

export function findByExternalId(externalId) {
  const db = getDb();
  return db.prepare('SELECT * FROM players WHERE source = ? AND external_id = ?').get('host', externalId) || null;
}

export function upsertHostPlayer({ externalId, displayName, avatarUrl = null, meta = null }) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = findByExternalId(externalId);

  if (existing) {
    db.prepare(`
      UPDATE players
      SET display_name = ?, avatar_url = ?, meta_json = ?, last_seen_at = ?
      WHERE id = ?
    `).run(displayName, avatarUrl, meta ? JSON.stringify(meta) : null, now, existing.id);
    return findById(existing.id);
  }

  const id = ulid();
  db.prepare(`
    INSERT INTO players (id, source, external_id, display_name, avatar_url, meta_json, banned, created_at, last_seen_at)
    VALUES (?, 'host', ?, ?, ?, ?, 0, ?, ?)
  `).run(id, externalId, displayName, avatarUrl, meta ? JSON.stringify(meta) : null, now, now);

  return findById(id);
}

export function createGuestPlayer({ displayName }) {
  const db = getDb();
  const id = ulid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO players (id, source, external_id, display_name, avatar_url, meta_json, banned, created_at, last_seen_at)
    VALUES (?, 'guest', NULL, ?, NULL, NULL, 0, ?, ?)
  `).run(id, displayName, now, now);

  return findById(id);
}

export function updateLastSeen(id) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').run(now, id);
}

export function setBanned(id, banned) {
  const db = getDb();
  db.prepare('UPDATE players SET banned = ? WHERE id = ?').run(banned ? 1 : 0, id);
  return findById(id);
}

export function anonymize(externalId) {
  const db = getDb();
  const player = findByExternalId(externalId);
  if (!player) return false;

  db.prepare(`
    UPDATE players
    SET display_name = 'Deleted player', external_id = NULL, avatar_url = NULL, meta_json = NULL
    WHERE id = ?
  `).run(player.id);

  return true;
}

export function search(query = '', limit = 50) {
  const db = getDb();
  if (!query) {
    return db.prepare('SELECT * FROM players ORDER BY last_seen_at DESC LIMIT ?').all(limit);
  }
  const like = `%${query}%`;
  return db.prepare(`
    SELECT * FROM players
    WHERE display_name LIKE ? OR external_id LIKE ? OR id LIKE ?
    ORDER BY last_seen_at DESC LIMIT ?
  `).all(like, like, like, limit);
}
