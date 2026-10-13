import { getDb } from '../db/connection.js';

export function create({ id, playerId, mode, seed, settingsVersion, themeVersion, settingsJson }) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO game_sessions (
      id, player_id, mode, status, seed, settings_version, theme_version,
      settings_json, last_seq, client_score, final_score, end_reason,
      validation_json, started_at, ended_at, last_event_at
    ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, ?, NULL, ?)
  `).run(id, playerId, mode, seed, settingsVersion, themeVersion, settingsJson, now, now);

  return findById(id);
}

export function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(id) || null;
}

export function findActiveByPlayerId(playerId) {
  const db = getDb();
  return db.prepare("SELECT * FROM game_sessions WHERE player_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1").get(playerId) || null;
}

export function updateLastEvent(id, lastSeq, lastEventAt) {
  const db = getDb();
  db.prepare(`
    UPDATE game_sessions
    SET last_seq = MAX(last_seq, ?), last_event_at = ?
    WHERE id = ?
  `).run(lastSeq, lastEventAt, id);
}

export function endSession(id, { status, clientScore = null, finalScore = null, endReason = null, validationJson = null, endedAt = null }) {
  const db = getDb();
  const now = endedAt || new Date().toISOString();
  db.prepare(`
    UPDATE game_sessions
    SET status = ?, client_score = ?, final_score = ?, end_reason = ?, validation_json = ?, ended_at = ?, last_event_at = ?
    WHERE id = ?
  `).run(status, clientScore, finalScore, endReason, validationJson, now, now, id);

  return findById(id);
}

export function findAbandoned(thresholdIso) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM game_sessions
    WHERE status = 'active' AND last_event_at < ?
  `).all(thresholdIso);
}

export function getRecentByPlayerId(playerId, limit = 10) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM game_sessions
    WHERE player_id = ?
    ORDER BY started_at DESC LIMIT ?
  `).all(playerId, limit);
}

export function getSessionStatsToday() {
  const db = getDb();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startIso = startOfDay.toISOString();

  const total = db.prepare('SELECT count(*) as count FROM game_sessions WHERE started_at >= ?').get(startIso).count;
  const byMode = db.prepare('SELECT mode, count(*) as count FROM game_sessions WHERE started_at >= ? GROUP BY mode').all(startIso);

  return { total, byMode };
}
