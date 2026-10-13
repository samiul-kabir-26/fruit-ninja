import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/connection.js';

function getBundledManifest() {
  const manifestPath = path.resolve('public/game/assets/default/manifest.json');
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  return { objects: [], ui: {}, audio: {} };
}

export function getTheme(status = 'published') {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM theme_assets WHERE status = ? ORDER BY sort_order ASC').all(status);
  const bundled = getBundledManifest();

  // If table is empty, return bundled
  if (rows.length === 0) {
    return {
      themeVersion: 1,
      objects: bundled.objects,
      ui: bundled.ui,
      audio: bundled.audio
    };
  }

  const objects = [];
  let ui = { ...bundled.ui };
  let audio = { ...bundled.audio };

  const getMediaUrl = (mediaId) => {
    if (!mediaId) return null;
    const media = db.prepare('SELECT file_name FROM media WHERE id = ?').get(mediaId);
    return media ? `/media/${media.file_name}` : null;
  };

  for (const row of rows) {
    const props = JSON.parse(row.props_json);

    if (row.key === 'ui') {
      ui = { ...ui, ...props };
      if (props.logoMediaId) ui.logo = getMediaUrl(props.logoMediaId) || ui.logo;
      if (props.backgroundMediaId) ui.background = getMediaUrl(props.backgroundMediaId) || ui.background;
      if (props.menuBackgroundMediaId) ui.menuBackground = getMediaUrl(props.menuBackgroundMediaId) || ui.menuBackground;
      continue;
    }

    if (row.key === 'audio') {
      audio = { ...audio, ...props };
      for (const [k, v] of Object.entries(props)) {
        if (v && typeof v === 'object' && v.mediaId) {
          audio[k] = getMediaUrl(v.mediaId) || null;
        }
      }
      continue;
    }

    // Object (fruit, bomb, special)
    const bundledObj = bundled.objects.find(b => b.key === row.key) || {};
    const imgUrl = getMediaUrl(props.imageMediaId) || bundledObj.image || null;
    const halfLeftUrl = getMediaUrl(props.halfLeftMediaId) || bundledObj.halfLeft || null;
    const halfRightUrl = getMediaUrl(props.halfRightMediaId) || bundledObj.halfRight || null;

    objects.push({
      key: row.key,
      kind: row.kind,
      label: props.label || bundledObj.label || row.key,
      enabled: props.enabled !== false,
      builtin: Boolean(row.builtin),
      radius: Number(props.radius ?? bundledObj.radius ?? 40),
      points: Number(props.points ?? bundledObj.points ?? 1),
      spawnWeight: Number(props.spawnWeight ?? bundledObj.spawnWeight ?? 5),
      juiceColor: props.juiceColor || bundledObj.juiceColor || '#ffffff',
      specialType: props.specialType || bundledObj.specialType,
      image: imgUrl,
      halfLeft: halfLeftUrl,
      halfRight: halfRightUrl,
      imageMediaId: props.imageMediaId || null,
      halfLeftMediaId: props.halfLeftMediaId || null,
      halfRightMediaId: props.halfRightMediaId || null
    });
  }

  const verRow = db.prepare("SELECT value_json FROM settings WHERE key = 'themeVersion'").get();
  const themeVersion = verRow ? Number(JSON.parse(verRow.value_json)) : 1;

  return {
    themeVersion,
    objects,
    ui,
    audio
  };
}

export function getThemeAsset(status, key) {
  const db = getDb();
  return db.prepare('SELECT * FROM theme_assets WHERE status = ? AND key = ?').get(status, key) || null;
}

export function upsertThemeAsset(status, key, kind, builtin, props, sortOrder = 0) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO theme_assets (status, key, kind, builtin, props_json, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(status, key) DO UPDATE SET
      kind = excluded.kind,
      props_json = excluded.props_json,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `).run(status, key, kind, builtin ? 1 : 0, JSON.stringify(props), sortOrder, now);
}

export function deleteThemeAsset(status, key) {
  const db = getDb();
  db.prepare("DELETE FROM theme_assets WHERE status = ? AND key = ? AND builtin = 0").run(status, key);
}

export function copyDraftToPublished() {
  const db = getDb();
  const now = new Date().toISOString();

  const runTx = db.transaction(() => {
    db.prepare("DELETE FROM theme_assets WHERE status = 'published'").run();
    db.prepare(`
      INSERT INTO theme_assets (status, key, kind, builtin, props_json, sort_order, updated_at)
      SELECT 'published', key, kind, builtin, props_json, sort_order, ?
      FROM theme_assets WHERE status = 'draft'
    `).run(now);

    // Bump themeVersion
    const verRow = db.prepare("SELECT value_json FROM settings WHERE key = 'themeVersion'").get();
    const curVer = verRow ? Number(JSON.parse(verRow.value_json)) : 1;
    const nextVer = curVer + 1;
    db.prepare("UPDATE settings SET value_json = ?, updated_at = ? WHERE key = 'themeVersion'").run(JSON.stringify(nextVer), now);
    return nextVer;
  });

  return runTx();
}

export function resetDraftToDefault() {
  const db = getDb();
  const manifest = getBundledManifest();
  const now = new Date().toISOString();

  const runTx = db.transaction(() => {
    db.prepare("DELETE FROM theme_assets WHERE status = 'draft'").run();

    let order = 0;
    const insert = db.prepare(`
      INSERT INTO theme_assets (status, key, kind, builtin, props_json, sort_order, updated_at)
      VALUES ('draft', ?, ?, ?, ?, ?, ?)
    `);

    for (const obj of manifest.objects) {
      insert.run(
        obj.key,
        obj.kind,
        1,
        JSON.stringify({
          label: obj.label,
          radius: obj.radius,
          points: obj.points,
          spawnWeight: obj.spawnWeight,
          juiceColor: obj.juiceColor,
          enabled: obj.enabled !== false,
          imageMediaId: null,
          halfLeftMediaId: null,
          halfRightMediaId: null
        }),
        order++,
        now
      );
    }
    insert.run('ui', 'ui', 1, JSON.stringify(manifest.ui), 0, now);
    insert.run('audio', 'audio', 1, JSON.stringify(manifest.audio), 0, now);
  });

  runTx();
}

export function hasUnpublishedChanges() {
  const db = getDb();
  const draftRows = db.prepare("SELECT key, props_json FROM theme_assets WHERE status = 'draft' ORDER BY key").all();
  const pubRows = db.prepare("SELECT key, props_json FROM theme_assets WHERE status = 'published' ORDER BY key").all();

  if (draftRows.length !== pubRows.length) return true;
  for (let i = 0; i < draftRows.length; i++) {
    if (draftRows[i].key !== pubRows[i].key || draftRows[i].props_json !== pubRows[i].props_json) {
      return true;
    }
  }
  return false;
}
