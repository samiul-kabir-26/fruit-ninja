import { getDb } from '../db/connection.js';

export function insert({ id, type, version, source, sessionId = null, playerId = null, clientSeq = null, occurredAt, receivedAt, dataJson }) {
  const db = getDb();

  const info = db.prepare(`
    INSERT INTO events (
      id, type, version, source, session_id, player_id, client_seq,
      occurred_at, received_at, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, version, source, sessionId, playerId, clientSeq, occurredAt, receivedAt, dataJson);

  return info.lastInsertRowid;
}

export function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id) || null;
}

export function findBySessionId(sessionId) {
  const db = getDb();
  return db.prepare('SELECT * FROM events WHERE session_id = ? ORDER BY seq ASC').all(sessionId);
}

export function findByCursor({ cursorSeq = 0, limit = 100, types = null, playerExternalId = null }) {
  const db = getDb();
  const conditions = ['seq > ?'];
  const params = [cursorSeq];

  if (types && types.length > 0) {
    const typeClauses = [];
    for (const t of types) {
      if (t.endsWith('*')) {
        const prefix = t.slice(0, -1);
        typeClauses.push('type LIKE ?');
        params.push(`${prefix}%`);
      } else {
        typeClauses.push('type = ?');
        params.push(t);
      }
    }
    conditions.push(`(${typeClauses.join(' OR ')})`);
  }

  if (playerExternalId) {
    conditions.push(`player_id IN (SELECT id FROM players WHERE source = 'host' AND external_id = ?)`);
    params.push(playerExternalId);
  }

  const query = `
    SELECT e.*,
           p.external_id as p_external_id, p.display_name as p_display_name,
           p.source as p_source, p.meta_json as p_meta_json, s.mode as s_mode
    FROM events e
    LEFT JOIN players p ON e.player_id = p.id
    LEFT JOIN game_sessions s ON e.session_id = s.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.seq ASC
    LIMIT ?
  `;
  params.push(Math.min(500, Math.max(1, limit)));

  return db.prepare(query).all(...params);
}

export function findAdminEvents({ types = null, playerId = null, sessionId = null, from = null, to = null, q = null, cursorSeq = null, limit = 50 }) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (cursorSeq !== null && cursorSeq !== undefined) {
    conditions.push('e.seq < ?');
    params.push(cursorSeq);
  }
  if (playerId) {
    conditions.push('e.player_id = ?');
    params.push(playerId);
  }
  if (sessionId) {
    conditions.push('e.session_id = ?');
    params.push(sessionId);
  }
  if (from) {
    conditions.push('e.occurred_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('e.occurred_at <= ?');
    params.push(to);
  }
  if (types && types.length > 0) {
    const clauses = [];
    for (const t of types) {
      if (t.endsWith('*')) {
        clauses.push('e.type LIKE ?');
        params.push(`${t.slice(0, -1)}%`);
      } else {
        clauses.push('e.type = ?');
        params.push(t);
      }
    }
    conditions.push(`(${clauses.join(' OR ')})`);
  }
  if (q) {
    conditions.push('e.data_json LIKE ?');
    params.push(`%${q}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT e.*,
           p.external_id as p_external_id, p.display_name as p_display_name,
           p.source as p_source, p.meta_json as p_meta_json, s.mode as s_mode
    FROM events e
    LEFT JOIN players p ON e.player_id = p.id
    LEFT JOIN game_sessions s ON e.session_id = s.id
    ${where}
    ORDER BY e.seq DESC
    LIMIT ?
  `;
  params.push(Math.min(100, Math.max(1, limit)));

  return db.prepare(query).all(...params);
}

export function getEventsCountLastHour() {
  const db = getDb();
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  return db.prepare('SELECT count(*) as count FROM events WHERE occurred_at >= ?').get(oneHourAgo).count;
}

export function getRecentEvents(limit = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT e.*, p.display_name as p_display_name, s.mode as s_mode
    FROM events e
    LEFT JOIN players p ON e.player_id = p.id
    LEFT JOIN game_sessions s ON e.session_id = s.id
    ORDER BY e.seq DESC LIMIT ?
  `).all(limit);
}

export function deleteOldEvents(retentionDays = 90) {
  const db = getDb();
  const threshold = new Date(Date.now() - retentionDays * 86400000).toISOString();
  const info = db.prepare(`
    DELETE FROM events
    WHERE occurred_at < ?
      AND type NOT LIKE 'score.%'
      AND type NOT LIKE 'leaderboard.%'
  `).run(threshold);
  return info.changes;
}
