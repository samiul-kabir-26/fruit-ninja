/**
 * Scoring rules and score recomputation logic.
 * Shared between client and server (pure ESM, zero dependencies).
 */

export const DEFAULT_SCORING_CONFIG = {
  comboMin: 3,
  comboBonusPerFruit: 1,
  arcadeBombPenalty: 10,
  criticalBonus: 10
};

/**
 * Calculate combo bonus given the number of fruit sliced in a single swipe.
 */
export function calculateComboBonus(count, config = DEFAULT_SCORING_CONFIG) {
  const min = config.comboMin ?? 3;
  const bonusPer = config.comboBonusPerFruit ?? 1;
  if (count < min) return 0;
  return count * bonusPer;
}

/**
 * Recompute score from a sequence of events.
 * Used by server to validate client score and by client for consistency.
 */
export function recomputeScoreFromEvents(events, mode = 'classic', scoringConfig = DEFAULT_SCORING_CONFIG) {
  let score = 0;
  let doubleScoreUntil = -1;
  let slicesCount = 0;
  let combosCount = 0;
  let bombsCount = 0;
  let specialsCount = 0;
  let maxCombo = 0;

  // Ensure events are processed in chronological order
  const sorted = [...events].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));

  for (const ev of sorted) {
    const t = ev.t ?? 0;
    const isDoubleActive = mode === 'arcade' && t <= doubleScoreUntil;
    const multiplier = isDoubleActive ? 2 : 1;

    switch (ev.type) {
      case 'fruit.sliced': {
        slicesCount++;
        const basePoints = Number(ev.data?.points ?? 1);
        let pts = basePoints * multiplier;

        if (mode === 'arcade' && ev.data?.critical) {
          pts += (scoringConfig.criticalBonus ?? 10) * multiplier;
        }

        score += pts;
        break;
      }

      case 'combo.achieved': {
        const count = Number(ev.data?.count ?? 0);
        if (count > maxCombo) maxCombo = count;
        if (count >= (scoringConfig.comboMin ?? 3)) {
          combosCount++;
          const bonus = calculateComboBonus(count, scoringConfig) * multiplier;
          score += bonus;
        }
        break;
      }

      case 'special.activated': {
        specialsCount++;
        if (ev.data?.special === 'double') {
          const duration = Number(ev.data?.durationMs ?? 7000);
          doubleScoreUntil = Math.max(doubleScoreUntil, t + duration);
        }
        break;
      }

      case 'bomb.hit': {
        bombsCount++;
        if (mode === 'arcade') {
          const penalty = Number(ev.data?.penalty ?? scoringConfig.arcadeBombPenalty ?? 10);
          score = Math.max(0, score - penalty);
        }
        break;
      }

      default:
        break;
    }
  }

  return {
    finalScore: Math.max(0, Math.floor(score)),
    stats: {
      sliced: slicesCount,
      combos: combosCount,
      bestCombo: maxCombo,
      bombsHit: bombsCount,
      specials: specialsCount
    }
  };
}
