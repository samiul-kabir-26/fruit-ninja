import { getDb } from '../db/connection.js';

export function insert({ id, sessionId, playerId, mode, score, verified, achievedAt }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO scores (id, session_id, player_id, mode, score, verified, achieved_at, removed_at, removed_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
  `).run(id, sessionId, playerId, mode, score, verified ? 1 : 0, achievedAt);
}

export function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM scores WHERE id = ?').get(id) || null;
}

export function getResetWatermark(mode, period) {
  const db = getDb();
  const row = db.prepare('SELECT reset_at FROM leaderboard_resets WHERE mode = ? AND period = ?').get(mode, period);
  return row ? row.reset_at : null;
}

export function setResetWatermark(mode, period, resetAt) {
  const db = getDb();
  db.prepare(`
    INSERT INTO leaderboard_resets (mode, period, reset_at)
    VALUES (?, ?, ?)
    ON CONFLICT(mode, period) DO UPDATE SET reset_at = excluded.reset_at
  `).run(mode, period, resetAt);
}

export function getPeriodStartDate(period) {
  const now = new Date();
  if (period === 'daily') {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    return d.toISOString();
  }
  if (period === 'weekly') {
    // Monday 00:00 UTC
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday
    const diff = (day === 0 ? -6 : 1) - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString();
  }
  return '1970-01-01T00:00:00.000Z';
}

export function getLeaderboard({ mode, period = 'all', limit = 50, verifiedOnly = false, playerId = null, includeRemoved = false }) {
  const db = getDb();
  const periodStart = getPeriodStartDate(period);
  const resetAt = getResetWatermark(mode, period) || '';
  const effectiveStart = resetAt > periodStart ? resetAt : periodStart;

  const conditions = [
    's.mode = ?',
    's.achieved_at >= ?',
    'p.banned = 0'
  ];
  const params = [mode, effectiveStart];

  if (!includeRemoved) {
    conditions.push('s.removed_at IS NULL');
  }

  if (verifiedOnly) {
    conditions.push('s.verified = 1');
  }

  // To get the best score per player, with tie-break of earliest achieved_at:
  // Using window function to rank player's attempts
  const query = `
    WITH RankedPlayerScores AS (
      SELECT
        s.*,
        p.display_name,
        p.external_id,
        ROW_NUMBER() OVER (
          PARTITION BY s.player_id
          ORDER BY s.score DESC, s.achieved_at ASC
        ) as rn
      FROM scores s
      JOIN players p ON p.id = s.player_id
      WHERE ${conditions.join(' AND ')}
    ),
    BestPlayerScores AS (
      SELECT * FROM RankedPlayerScores WHERE rn = 1
    ),
    FinalRanking AS (
      SELECT
        id,
        session_id as sessionId,
        player_id as playerId,
        display_name as displayName,
        external_id as externalId,
        score,
        verified,
        achieved_at as achievedAt,
        removed_at as removedAt,
        removed_reason as removedReason,
        RANK() OVER (ORDER BY score DESC, achieved_at ASC) as rank
      FROM BestPlayerScores
    )
    SELECT * FROM FinalRanking
    ORDER BY rank ASC
  `;

  const allRows = db.prepare(query).all(...params);
  const entries = allRows.slice(0, Math.min(100, Math.max(1, limit)));

  let me = null;
  if (playerId) {
    const myRow = allRows.find(r => r.playerId === playerId);
    if (myRow) {
      me = {
        rank: myRow.rank,
        score: myRow.score
      };
    }
  }

  return {
    mode,
    period,
    periodStart: effectiveStart,
    entries: entries.map(e => ({
      rank: e.rank,
      playerId: e.playerId,
      externalId: e.externalId,
      displayName: e.displayName,
      score: e.score,
      verified: Boolean(e.verified),
      achievedAt: e.achievedAt,
      id: e.id,
      removedAt: e.removedAt,
      removedReason: e.removedReason
    })),
    me
  };
}

export function getPlayerBests(playerId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT mode, MAX(score) as best_score
    FROM scores
    WHERE player_id = ? AND removed_at IS NULL
    GROUP BY mode
  `).all(playerId);

  const bests = { classic: 0, arcade: 0, zen: 0 };
  for (const r of rows) {
    bests[r.mode] = r.best_score;
  }
  return bests;
}

export function getPlayerStats(externalId) {
  const db = getDb();
  const player = db.prepare("SELECT * FROM players WHERE source = 'host' AND external_id = ?").get(externalId);
  if (!player) return null;

  const bests = getPlayerBests(player.id);
  const gamesPlayed = db.prepare('SELECT count(*) as count FROM game_sessions WHERE player_id = ?').get(player.id).count;

  // Total fruit sliced
  const slicedRow = db.prepare(`
    SELECT count(*) as count
    FROM events
    WHERE player_id = ? AND type = 'fruit.sliced'
  `).get(player.id);

  const lastSession = db.prepare(`
    SELECT ended_at, started_at FROM game_sessions
    WHERE player_id = ? ORDER BY started_at DESC LIMIT 1
  `).get(player.id);

  return {
    playerExternalId: externalId,
    displayName: player.display_name,
    gamesPlayed,
    totalFruitSliced: slicedRow ? slicedRow.count : 0,
    best: bests,
    lastPlayedAt: lastSession ? (lastSession.ended_at || lastSession.started_at) : null
  };
}

export function softDelete(id, reason = 'cheating') {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE scores
    SET removed_at = ?, removed_reason = ?
    WHERE id = ?
  `).run(now, reason, id);
}

export function getTopScoresAllModes(limitPerMode = 5) {
  const db = getDb();
  const modes = ['classic', 'arcade', 'zen'];
  const result = {};
  for (const m of modes) {
    result[m] = getLeaderboard({ mode: m, period: 'all', limit: limitPerMode }).entries;
  }
  return result;
}

export function getAverageScorePast7Days() {
  const db = getDb();
  const threshold = new Date(Date.now() - 7 * 86400000).toISOString();
  const row = db.prepare(`
    SELECT AVG(score) as avgScore
    FROM scores
    WHERE achieved_at >= ? AND removed_at IS NULL
  `).get(threshold);
  return Math.round(row?.avgScore || 0);
}
