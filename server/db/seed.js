import fs from 'node:fs';
import path from 'node:path';

export function seed(db) {
  const now = new Date().toISOString();

  // 1. Settings seeding
  const existingSettings = db.prepare('SELECT key FROM settings WHERE key = ?').get('gameplay');
  if (!existingSettings) {
    const defaultGameplay = {
      modes: {
        classic: { enabled: true, lives: 3, lifeRecoveryEvery: 100 },
        arcade: { enabled: true, durationSec: 60, bombPenalty: 10, specialChance: 0.06, criticalChance: 0.02 },
        zen: { enabled: true, durationSec: 90 }
      },
      physics: {
        gravity: 1400,
        minBladeSpeed: 900,
        trailLength: 12,
        bombProbabilityCap: 0.18
      },
      scoring: {
        comboMin: 3,
        comboBonusPerFruit: 1
      },
      difficulty: [
        { untilSec: 15, waveInterval: 1.6, minObjects: 1, maxObjects: 2, bombChance: 0.05 },
        { untilSec: 45, waveInterval: 1.3, minObjects: 1, maxObjects: 3, bombChance: 0.10 },
        { untilSec: 90, waveInterval: 1.1, minObjects: 2, maxObjects: 4, bombChance: 0.15 },
        { untilSec: 999999, waveInterval: 0.9, minObjects: 2, maxObjects: 5, bombChance: 0.18 }
      ]
    };

    const insertSetting = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
    `);

    insertSetting.run('gameplay', JSON.stringify(defaultGameplay), now);
    insertSetting.run('gameplayVersion', '1', now);
    insertSetting.run('themeVersion', '1', now);
    insertSetting.run('guestPlayEnabled', 'true', now);
  }

  // 2. Theme assets seeding
  const existingTheme = db.prepare('SELECT count(*) as count FROM theme_assets').get();
  if (existingTheme.count === 0) {
    const manifestPath = path.resolve('public/game/assets/default/manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      const insertTheme = db.prepare(`
        INSERT INTO theme_assets (status, key, kind, builtin, props_json, sort_order, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertAll = db.transaction((status) => {
        // Objects
        let order = 0;
        for (const obj of manifest.objects) {
          insertTheme.run(
            status,
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

        // UI
        insertTheme.run(status, 'ui', 'ui', 1, JSON.stringify(manifest.ui), 0, now);

        // Audio
        insertTheme.run(status, 'audio', 'audio', 1, JSON.stringify(manifest.audio), 0, now);
      });

      insertAll('published');
      insertAll('draft');
    }
  }
}
