/**
 * Deterministic wave and object spawner.
 * Shared between client and server (pure ESM, zero dependencies).
 */

import { createPRNG } from './prng.js';

export const DEFAULT_DIFFICULTY_TABLE = [
  { untilSec: 15, waveInterval: 1.6, minObjects: 1, maxObjects: 2, bombChance: 0.05 },
  { untilSec: 45, waveInterval: 1.3, minObjects: 1, maxObjects: 3, bombChance: 0.10 },
  { untilSec: 90, waveInterval: 1.1, minObjects: 2, maxObjects: 4, bombChance: 0.15 },
  { untilSec: Infinity, waveInterval: 0.9, minObjects: 2, maxObjects: 5, bombChance: 0.18 }
];

export const DEFAULT_FRUITS = [
  { key: 'fruit.apple', kind: 'fruit', radius: 42, points: 1, spawnWeight: 10, juiceColor: '#e8f5a0' },
  { key: 'fruit.orange', kind: 'fruit', radius: 44, points: 1, spawnWeight: 10, juiceColor: '#ffa726' },
  { key: 'fruit.watermelon', kind: 'fruit', radius: 60, points: 1, spawnWeight: 6, juiceColor: '#ff4f6d' },
  { key: 'fruit.banana', kind: 'fruit', radius: 46, points: 1, spawnWeight: 8, juiceColor: '#fff59d' },
  { key: 'fruit.pineapple', kind: 'fruit', radius: 55, points: 1, spawnWeight: 5, juiceColor: '#ffe082' },
  { key: 'fruit.strawberry', kind: 'fruit', radius: 32, points: 1, spawnWeight: 9, juiceColor: '#ff1744' },
  { key: 'fruit.coconut', kind: 'fruit', radius: 45, points: 1, spawnWeight: 5, juiceColor: '#f5f5f5' },
  { key: 'fruit.kiwi', kind: 'fruit', radius: 34, points: 1, spawnWeight: 7, juiceColor: '#9ccc65' }
];

export const DEFAULT_SPECIALS = [
  { key: 'special.freeze', kind: 'special', specialType: 'freeze', radius: 44, points: 1, juiceColor: '#81d4fa' },
  { key: 'special.frenzy', kind: 'special', specialType: 'frenzy', radius: 44, points: 1, juiceColor: '#ff8a65' },
  { key: 'special.double', kind: 'special', specialType: 'double', radius: 44, points: 1, juiceColor: '#ffd54f' }
];

export const DEFAULT_BOMB = {
  key: 'bomb',
  kind: 'bomb',
  radius: 40,
  points: 0,
  juiceColor: '#ffffff'
};

export const LOGICAL_WIDTH = 1920;
export const LOGICAL_HEIGHT = 1080;

/**
 * Creates a deterministic spawner instance from a seed and configuration.
 */
export function createWaveSpawner(seed, mode = 'classic', config = {}, themeObjects = null) {
  const prng = createPRNG(seed);
  const gravity = Number(config.physics?.gravity ?? 1400);
  const difficultyTable = config.difficulty || DEFAULT_DIFFICULTY_TABLE;
  const bombCap = Number(config.physics?.bombProbabilityCap ?? 0.18);
  const specialChance = Number(config.modes?.arcade?.specialChance ?? 0.06);

  // Active fruit pool
  const rawFruits = (themeObjects?.filter(o => o.kind === 'fruit' && o.enabled !== false) || DEFAULT_FRUITS);
  const fruitPool = rawFruits.length > 0 ? rawFruits : DEFAULT_FRUITS;
  const fruitWeights = fruitPool.map(f => Number(f.spawnWeight ?? 1));

  let nextObjectId = 1;
  let nextWaveTimeMs = 1000; // First wave at 1.0s
  let lastSpecialTimeMs = -10000;
  let pomegranateSpawned = false;

  function getDifficultyTier(elapsedSec) {
    let effectiveElapsed = elapsedSec;
    if (mode === 'arcade') {
      const dur = config.modes?.arcade?.durationSec ?? 60;
      effectiveElapsed = elapsedSec * (90 / Math.max(10, dur));
    } else if (mode === 'zen') {
      const dur = config.modes?.zen?.durationSec ?? 90;
      effectiveElapsed = elapsedSec * (90 / Math.max(10, dur));
    }

    for (const tier of difficultyTable) {
      if (effectiveElapsed <= tier.untilSec) {
        return tier;
      }
    }
    return difficultyTable[difficultyTable.length - 1];
  }

  function createSpawnObject(def, spawnTimeMs, customProps = {}) {
    const objectId = nextObjectId++;
    const radius = Number(def.radius ?? 40);

    // Launch coordinates
    const x0 = customProps.x0 ?? prng.nextFloat(LOGICAL_WIDTH * 0.15, LOGICAL_WIDTH * 0.85);
    const y0 = customProps.y0 ?? (LOGICAL_HEIGHT + radius);

    // Apex height between 45% and 85% of height
    const h = customProps.h ?? prng.nextFloat(LOGICAL_HEIGHT * 0.45, LOGICAL_HEIGHT * 0.85);
    // vy = -sqrt(2 * g * h)
    const vy = customProps.vy ?? -Math.sqrt(2 * gravity * h);

    // Flight time to apex: tApex = -vy / g, total flight time: 2 * tApex
    const tApex = Math.abs(vy) / gravity;
    const tFlight = 2 * tApex;

    // Target x near center [30%, 70%]
    const targetX = customProps.targetX ?? prng.nextFloat(LOGICAL_WIDTH * 0.30, LOGICAL_WIDTH * 0.70);
    let vx = (targetX - x0) / Math.max(0.1, tFlight);
    vx = Math.max(-450, Math.min(450, vx));
    if (customProps.vx !== undefined) vx = customProps.vx;

    const angularVelocity = customProps.angularVelocity ?? prng.nextFloat(-4, 4);

    return {
      objectId,
      key: def.key,
      kind: def.kind,
      specialType: def.specialType,
      radius,
      points: Number(def.points ?? 1),
      juiceColor: def.juiceColor || '#ffffff',
      spawnTimeMs,
      x0,
      y0,
      vx,
      vy,
      angularVelocity,
      tFlight,
      maxAirtimeMs: Math.ceil(tFlight * 1000) + 500
    };
  }

  function spawnWave(waveTimeMs) {
    const elapsedSec = waveTimeMs / 1000;
    const tier = getDifficultyTier(elapsedSec);
    const objects = [];

    // Check Pomegranate in Arcade mode (last 3 seconds)
    if (mode === 'arcade' && !pomegranateSpawned) {
      const durSec = config.modes?.arcade?.durationSec ?? 60;
      if (elapsedSec >= durSec - 3) {
        pomegranateSpawned = true;
        const pomDef = {
          key: 'fruit.pomegranate',
          kind: 'fruit',
          radius: 52,
          points: 1,
          juiceColor: '#c2185b'
        };
        // Spawns centered, stays wobbling
        objects.push(createSpawnObject(pomDef, waveTimeMs, {
          x0: LOGICAL_WIDTH * 0.5,
          vy: -Math.sqrt(2 * gravity * LOGICAL_HEIGHT * 0.65),
          vx: 0
        }));
        nextWaveTimeMs = waveTimeMs + 5000;
        return objects;
      }
    }

    const count = prng.nextInt(tier.minObjects, tier.maxObjects);
    let bombChance = tier.bombChance;
    if (elapsedSec < 3.0 || mode === 'zen') {
      bombChance = 0;
    }
    bombChance = Math.min(bombChance, bombCap);

    let bombsCount = 0;
    const maxBombs = Math.floor(count / 2); // Bombs <= fruit

    for (let i = 0; i < count; i++) {
      const staggerMs = prng.nextFloat(0, 250);
      const spawnTime = waveTimeMs + staggerMs;

      // Check special banana in Arcade mode
      let isSpecial = false;
      if (mode === 'arcade' && (spawnTime - lastSpecialTimeMs) >= 8000) {
        if (prng.next() < specialChance) {
          isSpecial = true;
          lastSpecialTimeMs = spawnTime;
          const specialDef = prng.choice(DEFAULT_SPECIALS);
          objects.push(createSpawnObject(specialDef, spawnTime));
          continue;
        }
      }

      // Check bomb
      const canSpawnBomb = mode !== 'zen' && bombsCount < maxBombs && (prng.next() < bombChance);
      if (canSpawnBomb) {
        bombsCount++;
        objects.push(createSpawnObject(DEFAULT_BOMB, spawnTime));
      } else {
        // Fruit
        const fruitDef = prng.weightedChoice(fruitPool, fruitWeights) || fruitPool[0];
        objects.push(createSpawnObject(fruitDef, spawnTime));
      }
    }

    nextWaveTimeMs = waveTimeMs + Math.max(400, tier.waveInterval * 1000);
    return objects;
  }

  function getObjectsUpTo(timeMs) {
    const spawned = [];
    while (nextWaveTimeMs <= timeMs) {
      const wave = spawnWave(nextWaveTimeMs);
      spawned.push(...wave);
    }
    return spawned;
  }

  return {
    spawnWave,
    getObjectsUpTo,
    getNextWaveTime: () => nextWaveTimeMs
  };
}
