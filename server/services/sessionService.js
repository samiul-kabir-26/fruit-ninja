import crypto from 'node:crypto';
import { ulid } from 'ulid';
import * as sessionsRepo from '../repositories/sessions.js';
import * as playersRepo from '../repositories/players.js';
import * as eventsRepo from '../repositories/events.js';
import * as scoresRepo from '../repositories/scores.js';
import * as settingsRepo from '../repositories/settings.js';
import * as themeRepo from '../repositories/theme.js';
import * as eventService from './eventService.js';
import { validateAndScoreSession } from './scoringService.js';
import { isClientEventType } from '../shared/eventTypes.js';

export function createSession(playerId, mode) {
  const player = playersRepo.findById(playerId);
  if (!player || player.banned) {
    const err = new Error('Player is banned or not found');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  // Abandon any previous active session
  const activePrev = sessionsRepo.findActiveByPlayerId(playerId);
  if (activePrev) {
    sessionsRepo.endSession(activePrev.id, {
      status: 'abandoned',
      endReason: 'superseded_by_new_session'
    });
    eventService.emit('session.abandoned', {
      sessionId: activePrev.id,
      playerId,
      data: { lastSeq: activePrev.last_seq, idleMs: 0 }
    });
  }

  const id = ulid();
  // 32-bit unsigned integer seed
  const seed = crypto.randomBytes(4).readUInt32BE(0);
  const gameplaySettings = settingsRepo.getGameplaySettings();
  const theme = themeRepo.getTheme('published');

  const session = sessionsRepo.create({
    id,
    playerId,
    mode,
    seed,
    settingsVersion: gameplaySettings.settingsVersion,
    themeVersion: theme.themeVersion,
    settingsJson: JSON.stringify(gameplaySettings)
  });

  eventService.emit('session.started', {
    sessionId: id,
    playerId,
    data: {
      settingsVersion: gameplaySettings.settingsVersion,
      themeVersion: theme.themeVersion,
      seed
    }
  });

  return {
    sessionId: session.id,
    seed: session.seed,
    settingsVersion: session.settings_version,
    themeVersion: session.theme_version,
    startedAt: session.started_at
  };
}

export function ingestEvents(sessionId, playerId, clientEvents = []) {
  const session = sessionsRepo.findById(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (session.player_id !== playerId) {
    const err = new Error('Session does not belong to player');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (session.status !== 'active') {
    const err = new Error('Session is not active');
    err.status = 409;
    err.code = 'SESSION_CLOSED';
    throw err;
  }

  const startedAtMs = new Date(session.started_at).getTime();
  const existingEvents = eventsRepo.findBySessionId(sessionId);
  const existingClientSeqs = new Set(existingEvents.map(e => e.client_seq).filter(Boolean));

  let maxSeq = session.last_seq;

  // Process batch
  for (const ev of clientEvents) {
    const seq = Number(ev.seq);
    if (!seq || seq <= 0) continue;

    // Idempotent duplicate check
    if (existingClientSeqs.has(seq)) {
      continue;
    }

    if (!isClientEventType(ev.type)) {
      continue;
    }

    const t = Number(ev.t ?? 0);
    const occurredAt = new Date(startedAtMs + t).toISOString();

    eventService.emit(ev.type, {
      sessionId,
      playerId,
      clientSeq: seq,
      source: 'client',
      occurredAt,
      data: {
        t,
        ...ev.data
      }
    });

    existingClientSeqs.add(seq);
    if (seq > maxSeq) {
      maxSeq = seq;
    }
  }

  sessionsRepo.updateLastEvent(sessionId, maxSeq, new Date().toISOString());

  return { acceptedThroughSeq: maxSeq };
}

export function endSession(sessionId, playerId, payload) {
  const session = sessionsRepo.findById(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (session.player_id !== playerId) {
    const err = new Error('Forbidden');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (session.status !== 'active') {
    const err = new Error('Session is already closed');
    err.status = 409;
    err.code = 'SESSION_CLOSED';
    throw err;
  }

  const rawEvents = eventsRepo.findBySessionId(sessionId);
  const validationResult = validateAndScoreSession(session, rawEvents, payload);

  const player = playersRepo.findById(playerId);
  const isVerified = player?.source === 'host';
  const scoreId = ulid();
  const now = new Date().toISOString();

  if (!validationResult.accepted) {
    sessionsRepo.endSession(sessionId, {
      status: 'rejected',
      clientScore: payload.clientScore ?? 0,
      finalScore: validationResult.finalScore,
      endReason: payload.reason || 'rejected',
      validationJson: JSON.stringify(validationResult)
    });

    eventService.emit('session.ended', {
      sessionId,
      playerId,
      data: {
        reason: payload.reason,
        durationMs: payload.stats?.durationMs ?? 0,
        finalScore: validationResult.finalScore,
        clientScore: payload.clientScore,
        scoreAccepted: false,
        rejectionReasons: validationResult.rejectionReasons,
        stats: validationResult.stats
      }
    });

    const err = new Error('Score rejected due to validation failure');
    err.status = 422;
    err.code = 'SCORE_REJECTED';
    err.details = validationResult.rejectionReasons;
    throw err;
  }

  // Accepted!
  sessionsRepo.endSession(sessionId, {
    status: 'ended',
    clientScore: payload.clientScore ?? 0,
    finalScore: validationResult.finalScore,
    endReason: payload.reason,
    validationJson: JSON.stringify(validationResult),
    endedAt: now
  });

  // Insert score
  scoresRepo.insert({
    id: scoreId,
    sessionId,
    playerId,
    mode: session.mode,
    score: validationResult.finalScore,
    verified: isVerified,
    achievedAt: now
  });

  // Calculate previous personal best
  const currentBests = scoresRepo.getPlayerBests(playerId);
  const prevBest = currentBests[session.mode] || 0;
  const isPersonalBest = validationResult.finalScore >= prevBest;

  // Emit session.ended
  eventService.emit('session.ended', {
    sessionId,
    playerId,
    data: {
      reason: payload.reason,
      durationMs: payload.stats?.durationMs ?? 0,
      finalScore: validationResult.finalScore,
      clientScore: payload.clientScore,
      scoreAccepted: true,
      rejectionReasons: [],
      stats: validationResult.stats
    }
  });

  // Leaderboard ranks
  const boardAll = scoresRepo.getLeaderboard({ mode: session.mode, period: 'all', playerId });
  const boardWeekly = scoresRepo.getLeaderboard({ mode: session.mode, period: 'weekly', playerId });
  const boardDaily = scoresRepo.getLeaderboard({ mode: session.mode, period: 'daily', playerId });

  const ranks = {
    all: boardAll.me?.rank ?? null,
    weekly: boardWeekly.me?.rank ?? null,
    daily: boardDaily.me?.rank ?? null
  };

  // Emit score.submitted
  eventService.emit('score.submitted', {
    sessionId,
    playerId,
    data: {
      scoreId,
      score: validationResult.finalScore,
      personalBest: isPersonalBest,
      previousBest: prevBest,
      rank: ranks
    }
  });

  // Check leaderboard.new_high_score (emitted if rank 1-10 in a period with new personal best)
  if (isPersonalBest) {
    const periods = [
      { key: 'all', rank: ranks.all },
      { key: 'weekly', rank: ranks.weekly },
      { key: 'daily', rank: ranks.daily }
    ];
    for (const p of periods) {
      if (p.rank !== null && p.rank <= 10) {
        eventService.emit('leaderboard.new_high_score', {
          sessionId,
          playerId,
          data: {
            scoreId,
            score: validationResult.finalScore,
            period: p.key,
            rank: p.rank
          }
        });
      }
    }
  }

  // Check player.first_game
  const playerGameCount = scoresRepo.getPlayerStats(player?.external_id)?.gamesPlayed || 1;
  if (playerGameCount <= 1) {
    eventService.emit('player.first_game', {
      sessionId,
      playerId,
      data: {}
    });
  }

  return {
    finalScore: validationResult.finalScore,
    verified: isVerified,
    accepted: true,
    personalBest: Math.max(validationResult.finalScore, prevBest),
    rank: ranks
  };
}

export function sweepAbandonedSessions() {
  const now = Date.now();
  // Sessions idle for 35 min
  const threshold = new Date(now - 35 * 60 * 1000).toISOString();
  const abandoned = sessionsRepo.findAbandoned(threshold);

  for (const s of abandoned) {
    sessionsRepo.endSession(s.id, {
      status: 'abandoned',
      endReason: 'timed_out_sweeper'
    });
    eventService.emit('session.abandoned', {
      sessionId: s.id,
      playerId: s.player_id,
      data: {
        lastSeq: s.last_seq,
        idleMs: now - new Date(s.last_event_at).getTime()
      }
    });
  }
}
