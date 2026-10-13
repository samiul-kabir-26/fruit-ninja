import { ulid } from 'ulid';
import { EVENT_VERSIONS } from '../shared/eventTypes.js';
import * as eventsRepo from '../repositories/events.js';
import * as playersRepo from '../repositories/players.js';
import * as sessionsRepo from '../repositories/sessions.js';

const sseListeners = new Set();

export function subscribeSSE(listener) {
  sseListeners.add(listener);
  return () => sseListeners.delete(listener);
}

export function broadcastSSE(eventEnvelope) {
  for (const listener of sseListeners) {
    try {
      listener(eventEnvelope);
    } catch {
      sseListeners.delete(listener);
    }
  }
}

/**
 * Emit an event into the outbox.
 */
export function emit(type, { sessionId = null, playerId = null, clientSeq = null, source = 'server', occurredAt = null, data = {} }) {
  const id = ulid();
  const version = EVENT_VERSIONS[type] || 1;
  const now = new Date().toISOString();
  const effectiveOccurredAt = occurredAt || now;

  let player = null;
  if (playerId) {
    const pRow = playersRepo.findById(playerId);
    if (pRow) {
      player = {
        id: pRow.id,
        externalId: pRow.external_id,
        displayName: pRow.display_name,
        verified: pRow.source === 'host',
        meta: pRow.meta_json ? JSON.parse(pRow.meta_json) : null
      };
    }
  }

  // Snapshot player into data_json for immutable audit
  const payload = {
    ...data,
    _player: player
  };

  const seq = eventsRepo.insert({
    id,
    type,
    version,
    source,
    sessionId,
    playerId,
    clientSeq,
    occurredAt: effectiveOccurredAt,
    receivedAt: now,
    dataJson: JSON.stringify(payload)
  });

  const session = sessionId ? sessionsRepo.findById(sessionId) : null;

  const envelope = {
    id,
    seq: Number(seq),
    type,
    version,
    occurredAt: effectiveOccurredAt,
    receivedAt: now,
    source,
    sessionId,
    mode: session ? session.mode : null,
    player,
    data
  };

  broadcastSSE(envelope);

  return envelope;
}

/**
 * Format a raw database event row into the official envelope.
 */
export function formatEnvelope(row) {
  let player = null;
  if (row.player_id) {
    player = {
      id: row.player_id,
      externalId: row.p_external_id ?? null,
      displayName: row.p_display_name ?? 'Player',
      verified: row.p_source === 'host',
      meta: row.p_meta_json ? JSON.parse(row.p_meta_json) : null
    };
  }

  let rawData = {};
  try {
    rawData = JSON.parse(row.data_json);
  } catch {
    rawData = {};
  }

  // Remove internal _player from exposed data
  const { _player, ...data } = rawData;
  if (!player && _player) {
    player = _player;
  }

  return {
    id: row.id,
    seq: Number(row.seq),
    type: row.type,
    version: row.version,
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    source: row.source,
    sessionId: row.session_id,
    mode: row.s_mode ?? null,
    player,
    data
  };
}
