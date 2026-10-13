/**
 * Canonical event types and versions for Blade Fruit.
 * Shared between client and server (pure ESM, zero dependencies).
 */

export const EVENT_VERSIONS = {
  // Session lifecycle
  'session.started': 1,
  'session.ended': 1,
  'session.abandoned': 1,
  'score.submitted': 1,
  'leaderboard.new_high_score': 1,
  'player.first_game': 1,

  // Gameplay (client-reported)
  'fruit.sliced': 1,
  'combo.achieved': 1,
  'special.activated': 1,
  'fruit.missed': 1,
  'life.lost': 1,
  'life.gained': 1,
  'bomb.hit': 1,

  // Admin / system
  'theme.published': 1,
  'settings.updated': 1,
  'score.removed': 1,
  'leaderboard.reset': 1,
  'webhook.test': 1
};

export const CLIENT_EVENT_TYPES = new Set([
  'fruit.sliced',
  'combo.achieved',
  'special.activated',
  'fruit.missed',
  'life.lost',
  'life.gained',
  'bomb.hit'
]);

export const SERVER_EVENT_TYPES = new Set([
  'session.started',
  'session.ended',
  'session.abandoned',
  'score.submitted',
  'leaderboard.new_high_score',
  'player.first_game',
  'theme.published',
  'settings.updated',
  'score.removed',
  'leaderboard.reset',
  'webhook.test'
]);

export const DEFAULT_WEBHOOK_EVENT_TYPES = [
  'session.ended',
  'score.submitted',
  'leaderboard.new_high_score',
  'player.first_game'
];

export function isKnownEventType(type) {
  return Object.prototype.hasOwnProperty.call(EVENT_VERSIONS, type);
}

export function isClientEventType(type) {
  return CLIENT_EVENT_TYPES.has(type);
}
