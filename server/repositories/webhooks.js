import { getDb } from '../db/connection.js';

export function listEndpoints() {
  const db = getDb();
  return db.prepare('SELECT * FROM webhook_endpoints ORDER BY created_at DESC').all();
}

export function getEndpoint(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM webhook_endpoints WHERE id = ?').get(id) || null;
}

export function createEndpoint({ id, url, eventTypesJson, secretEnc, active = 1 }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO webhook_endpoints (
      id, url, event_types_json, secret_enc, prev_secret_enc, prev_secret_expires_at,
      active, last_seq, consecutive_failures, disabled_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, NULL, NULL, ?, 0, 0, NULL, ?, ?)
  `).run(id, url, eventTypesJson, secretEnc, active ? 1 : 0, now, now);
  return getEndpoint(id);
}

export function updateEndpoint(id, fields) {
  const db = getDb();
  const sets = [];
  const params = [];
  const now = new Date().toISOString();

  for (const [key, val] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    params.push(val);
  }
  sets.push('updated_at = ?');
  params.push(now);
  params.push(id);

  db.prepare(`UPDATE webhook_endpoints SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getEndpoint(id);
}

export function deleteEndpoint(id) {
  const db = getDb();
  const runTx = db.transaction(() => {
    db.prepare('DELETE FROM webhook_deliveries WHERE endpoint_id = ?').run(id);
    db.prepare('DELETE FROM webhook_endpoints WHERE id = ?').run(id);
  });
  runTx();
}

export function createDelivery({ id, endpointId, firstSeq, lastSeq, eventCount, status = 'pending', nextAttemptAt = null }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO webhook_deliveries (
      id, endpoint_id, first_seq, last_seq, event_count, status, attempts,
      next_attempt_at, last_status_code, last_error, last_response_snippet, created_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, NULL, ?, NULL)
  `).run(id, endpointId, firstSeq, lastSeq, eventCount, status, nextAttemptAt, now);
}

export function updateDelivery(id, fields) {
  const db = getDb();
  const sets = [];
  const params = [];

  for (const [key, val] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    params.push(val);
  }
  params.push(id);

  db.prepare(`UPDATE webhook_deliveries SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function getDelivery(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(id) || null;
}

export function getDeliveries(endpointId, limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM webhook_deliveries
    WHERE endpoint_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(endpointId, limit);
}

export function getPendingDeliveries() {
  const db = getDb();
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT d.*, e.url, e.secret_enc, e.prev_secret_enc, e.prev_secret_expires_at, e.active as endpoint_active
    FROM webhook_deliveries d
    JOIN webhook_endpoints e ON d.endpoint_id = e.id
    WHERE d.status = 'pending' AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= ?) AND e.active = 1
    ORDER BY d.first_seq ASC
  `).all(now);
}

export function deleteOldDeliveries(retentionDays = 30) {
  const db = getDb();
  const threshold = new Date(Date.now() - retentionDays * 86400000).toISOString();
  return db.prepare('DELETE FROM webhook_deliveries WHERE created_at < ?').run(threshold).changes;
}

export function getWebhookHealthStats() {
  const db = getDb();
  const endpoints = listEndpoints();
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

  return endpoints.map(e => {
    const totalRow = db.prepare('SELECT count(*) as count FROM webhook_deliveries WHERE endpoint_id = ? AND created_at >= ?').get(e.id, oneDayAgo);
    const successRow = db.prepare("SELECT count(*) as count FROM webhook_deliveries WHERE endpoint_id = ? AND status = 'succeeded' AND created_at >= ?").get(e.id, oneDayAgo);
    const lastRow = db.prepare('SELECT * FROM webhook_deliveries WHERE endpoint_id = ? ORDER BY created_at DESC LIMIT 1').get(e.id);

    const total = totalRow.count;
    const succeeded = successRow.count;
    const rate = total > 0 ? Math.round((succeeded / total) * 100) : 100;

    let health = 'green';
    if (!e.active || e.consecutive_failures >= 3) {
      health = 'red';
    } else if (e.consecutive_failures > 0 || rate < 95) {
      health = 'amber';
    }

    return {
      id: e.id,
      url: e.url,
      active: Boolean(e.active),
      health,
      successRate24h: rate,
      total24h: total,
      consecutiveFailures: e.consecutive_failures,
      lastDelivery: lastRow || null
    };
  });
}
