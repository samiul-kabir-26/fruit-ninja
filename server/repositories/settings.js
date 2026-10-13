import { getDb } from '../db/connection.js';

export function get(key) {
  const db = getDb();
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value_json) : null;
}

export function set(key, value) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), now);
}

export function getGameplaySettings() {
  const db = getDb();
  const settingsRow = db.prepare("SELECT value_json FROM settings WHERE key = 'gameplay'").get();
  const verRow = db.prepare("SELECT value_json FROM settings WHERE key = 'gameplayVersion'").get();
  const guestRow = db.prepare("SELECT value_json FROM settings WHERE key = 'guestPlayEnabled'").get();

  const settings = settingsRow ? JSON.parse(settingsRow.value_json) : {};
  const settingsVersion = verRow ? Number(JSON.parse(verRow.value_json)) : 1;
  const guestPlayEnabled = guestRow ? Boolean(JSON.parse(guestRow.value_json)) : true;

  return {
    settingsVersion,
    guestPlayEnabled,
    ...settings
  };
}

export function updateGameplaySettings(newSettings) {
  const db = getDb();
  const now = new Date().toISOString();

  const runTx = db.transaction(() => {
    const verRow = db.prepare("SELECT value_json FROM settings WHERE key = 'gameplayVersion'").get();
    const curVer = verRow ? Number(JSON.parse(verRow.value_json)) : 1;
    const nextVer = curVer + 1;

    // Separate guestPlayEnabled if present
    if (newSettings.guestPlayEnabled !== undefined) {
      db.prepare("UPDATE settings SET value_json = ?, updated_at = ? WHERE key = 'guestPlayEnabled'")
        .run(JSON.stringify(Boolean(newSettings.guestPlayEnabled)), now);
    }

    const { settingsVersion, guestPlayEnabled, ...gameplayConfig } = newSettings;

    db.prepare("UPDATE settings SET value_json = ?, updated_at = ? WHERE key = 'gameplay'")
      .run(JSON.stringify(gameplayConfig), now);
    db.prepare("UPDATE settings SET value_json = ?, updated_at = ? WHERE key = 'gameplayVersion'")
      .run(JSON.stringify(nextVer), now);

    return nextVer;
  });

  return runTx();
}
