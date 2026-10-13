/**
 * Mulberry32 32-bit PRNG.
 * Pure ESM, zero dependencies. Shared between server and client.
 */

export function createPRNG(seed = 1) {
  // Ensure seed is a 32-bit unsigned integer
  let s = Math.floor(Math.abs(seed)) >>> 0;
  if (s === 0) s = 1;

  function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextFloat(min = 0, max = 1) {
    return min + next() * (max - min);
  }

  function nextInt(min, max) {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(nextFloat(low, high + 1));
  }

  function choice(arr) {
    if (!arr || arr.length === 0) return null;
    const index = Math.floor(next() * arr.length);
    return arr[index];
  }

  function weightedChoice(items, weights) {
    if (!items || items.length === 0) return null;
    let totalWeight = 0;
    for (let i = 0; i < weights.length; i++) {
      totalWeight += Math.max(0, weights[i] || 0);
    }
    if (totalWeight <= 0) return items[0];

    const r = next() * totalWeight;
    let accumulated = 0;
    for (let i = 0; i < items.length; i++) {
      accumulated += Math.max(0, weights[i] || 0);
      if (r <= accumulated) {
        return items[i];
      }
    }
    return items[items.length - 1];
  }

  return {
    next,
    nextFloat,
    nextInt,
    choice,
    weightedChoice,
    getSeed: () => seed
  };
}
