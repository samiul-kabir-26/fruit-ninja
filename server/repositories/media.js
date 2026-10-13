import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/connection.js';
import { env } from '../config/env.js';

export function insert({ id, kind, mime, fileName, width = null, height = null, bytes, originalName }) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO media (id, kind, mime, file_name, width, height, bytes, original_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen = created_at
  `).run(id, kind, mime, fileName, width, height, bytes, originalName, now);

  return findById(id);
}

export function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM media WHERE id = ?').get(id) || null;
}

export function garbageCollect(daysOld = 7) {
  const db = getDb();
  const threshold = new Date(Date.now() - daysOld * 86400000).toISOString();

  // Find media not referenced by any theme_assets row
  const unused = db.prepare(`
    SELECT m.* FROM media m
    WHERE m.created_at < ?
      AND m.id NOT IN (
        SELECT json_extract(props_json, '$.imageMediaId') FROM theme_assets WHERE json_extract(props_json, '$.imageMediaId') IS NOT NULL
        UNION
        SELECT json_extract(props_json, '$.halfLeftMediaId') FROM theme_assets WHERE json_extract(props_json, '$.halfLeftMediaId') IS NOT NULL
        UNION
        SELECT json_extract(props_json, '$.halfRightMediaId') FROM theme_assets WHERE json_extract(props_json, '$.halfRightMediaId') IS NOT NULL
        UNION
        SELECT json_extract(props_json, '$.logoMediaId') FROM theme_assets WHERE key = 'ui'
        UNION
        SELECT json_extract(props_json, '$.backgroundMediaId') FROM theme_assets WHERE key = 'ui'
      )
  `).all(threshold);

  for (const item of unused) {
    const filePath = path.join(path.resolve(env.UPLOAD_DIR), item.file_name);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
    db.prepare('DELETE FROM media WHERE id = ?').run(item.id);
  }

  return unused.length;
}
