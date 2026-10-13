import { describe, it, expect } from 'vitest';
import { createPRNG } from '../../server/shared/prng.js';
import { createWaveSpawner } from '../../server/shared/spawner.js';
import { calculateComboBonus, recomputeScoreFromEvents } from '../../server/shared/scoringRules.js';

describe('PRNG (Mulberry32)', () => {
  it('produces identical pseudo-random sequence for identical seeds', () => {
    const rng1 = createPRNG(12345);
    const rng2 = createPRNG(12345);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = createPRNG(12345);
    const rng2 = createPRNG(54321);
    expect(rng1.next()).not.toEqual(rng2.next());
  });
});

describe('Wave Spawner Determinism & Rules', () => {
  it('generates deterministic objects for same seed', () => {
    const spawner1 = createWaveSpawner(42, 'classic');
    const spawner2 = createWaveSpawner(42, 'classic');

    const wave1 = spawner1.spawnWave(1000);
    const wave2 = spawner2.spawnWave(1000);

    expect(wave1).toEqual(wave2);
    expect(wave1.length).toBeGreaterThan(0);
    expect(wave1[0].objectId).toBe(1);
  });

  it('does not spawn bombs in the first 3 seconds of Classic mode', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const spawner = createWaveSpawner(seed, 'classic');
      const objects = spawner.spawnWave(1000);
      const bombs = objects.filter(o => o.kind === 'bomb');
      expect(bombs.length).toBe(0);
    }
  });

  it('never spawns bombs in Zen mode', () => {
    const spawner = createWaveSpawner(99, 'zen');
    const objects = spawner.getObjectsUpTo(30000);
    const bombs = objects.filter(o => o.kind === 'bomb');
    expect(bombs.length).toBe(0);
  });
});

describe('Scoring Rules', () => {
  it('calculates combo bonuses correctly', () => {
    expect(calculateComboBonus(2)).toBe(0);
    expect(calculateComboBonus(3)).toBe(3);
    expect(calculateComboBonus(5)).toBe(5);
  });

  it('recomputes score with combos and double-score multipliers', () => {
    const events = [
      { seq: 1, t: 100, type: 'fruit.sliced', data: { points: 1 } },
      { seq: 2, t: 105, type: 'fruit.sliced', data: { points: 1 } },
      { seq: 3, t: 110, type: 'fruit.sliced', data: { points: 1 } },
      { seq: 4, t: 115, type: 'combo.achieved', data: { count: 3 } },
      // double score activated at 200ms for 5s
      { seq: 5, t: 200, type: 'special.activated', data: { special: 'double', durationMs: 5000 } },
      // slice during double score
      { seq: 6, t: 500, type: 'fruit.sliced', data: { points: 1 } }
    ];

    const result = recomputeScoreFromEvents(events, 'arcade');
    // base: 3 + combo: 3 + double slice: 2 = 8
    expect(result.finalScore).toBe(8);
    expect(result.stats.sliced).toBe(4);
    expect(result.stats.combos).toBe(1);
  });

  it('floors arcade bombs at 0', () => {
    const events = [
      { seq: 1, t: 100, type: 'bomb.hit', data: { penalty: 10 } }
    ];
    const result = recomputeScoreFromEvents(events, 'arcade');
    expect(result.finalScore).toBe(0);
  });
});
