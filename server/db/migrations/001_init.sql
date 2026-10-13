CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT NULL,
  meta_json TEXT NULL,
  banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_source_external_id ON players(source, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  seed INTEGER NOT NULL,
  settings_version INTEGER NOT NULL,
  theme_version INTEGER NOT NULL,
  settings_json TEXT NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  client_score INTEGER NULL,
  final_score INTEGER NULL,
  end_reason TEXT NULL,
  validation_json TEXT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NULL,
  last_event_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON game_sessions(player_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON game_sessions(status, last_event_at);

CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  version INTEGER NOT NULL,
  source TEXT NOT NULL,
  session_id TEXT NULL REFERENCES game_sessions(id),
  player_id TEXT NULL REFERENCES players(id),
  client_seq INTEGER NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_type_seq ON events(type, seq);
CREATE INDEX IF NOT EXISTS idx_events_player_seq ON events(player_id, seq);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_session_client_seq ON events(session_id, client_seq) WHERE session_id IS NOT NULL AND client_seq IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at);

CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES game_sessions(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  mode TEXT NOT NULL,
  score INTEGER NOT NULL,
  verified INTEGER NOT NULL,
  achieved_at TEXT NOT NULL,
  removed_at TEXT NULL,
  removed_reason TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_mode_score ON scores(mode, score DESC, achieved_at);
CREATE INDEX IF NOT EXISTS idx_scores_mode_achieved ON scores(mode, achieved_at);
CREATE INDEX IF NOT EXISTS idx_scores_player_mode ON scores(player_id, mode, score DESC);

CREATE TABLE IF NOT EXISTS leaderboard_resets (
  mode TEXT NOT NULL,
  period TEXT NOT NULL,
  reset_at TEXT NOT NULL,
  PRIMARY KEY(mode, period)
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  file_name TEXT NOT NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  bytes INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS theme_assets (
  status TEXT NOT NULL,
  key TEXT NOT NULL,
  kind TEXT NOT NULL,
  builtin INTEGER NOT NULL DEFAULT 0,
  props_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(status, key)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT NULL,
  revoked_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  event_types_json TEXT NOT NULL,
  secret_enc TEXT NOT NULL,
  prev_secret_enc TEXT NULL,
  prev_secret_expires_at TEXT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_seq INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  disabled_reason TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id),
  first_seq INTEGER NOT NULL,
  last_seq INTEGER NOT NULL,
  event_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NULL,
  last_status_code INTEGER NULL,
  last_error TEXT NULL,
  last_response_snippet TEXT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON webhook_deliveries(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target TEXT NULL,
  details_json TEXT NULL,
  ip TEXT NULL,
  created_at TEXT NOT NULL
);
