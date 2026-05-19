-- ============================================================
-- Sealed Heavens — D1 Schema Migration
-- Run: wrangler d1 execute sealed-heavens-db --file=schema.sql
-- ============================================================

-- ── Accounts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT PRIMARY KEY,           -- uuid v4
  username     TEXT UNIQUE NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,             -- scrypt via Web Crypto API
  created_at   INTEGER NOT NULL,           -- unix ms
  last_login   INTEGER,
  is_banned    INTEGER NOT NULL DEFAULT 0,
  ban_reason   TEXT,
  admin_level  INTEGER NOT NULL DEFAULT 0  -- 0=player 1=mod 2=admin 3=superadmin
);

CREATE INDEX IF NOT EXISTS idx_accounts_email    ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);

-- ── Characters (up to 3 per account) ─────────────────────────
CREATE TABLE IF NOT EXISTS characters (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slot         INTEGER NOT NULL CHECK(slot IN (1,2,3)),
  name         TEXT NOT NULL,
  origin       TEXT NOT NULL DEFAULT 'outlander',  -- origin world key
  path         TEXT NOT NULL DEFAULT 'sword-sovereign', -- class/path key
  realm_index  INTEGER NOT NULL DEFAULT 0,
  stage_index  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  last_active  INTEGER,
  is_deleted   INTEGER NOT NULL DEFAULT 0,
  deleted_at   INTEGER,                    -- soft delete timestamp for 72h grace
  UNIQUE(account_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_characters_account ON characters(account_id);

-- ── Character state (full serialized game state per character) ─
CREATE TABLE IF NOT EXISTS character_state (
  character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  state_json   TEXT NOT NULL DEFAULT '{}',
  updated_at   INTEGER NOT NULL
);

-- ── Session tokens ────────────────────────────────────────────
-- Stored in KV (SESSIONS namespace) for fast reads.
-- This table is an audit record only; KV is the live source.
CREATE TABLE IF NOT EXISTS sessions (
  token_id     TEXT PRIMARY KEY,           -- uuid stored in httpOnly cookie
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  ip_address   TEXT,
  user_agent   TEXT
);

-- ── World state ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_state (
  key          TEXT PRIMARY KEY,
  value_json   TEXT NOT NULL DEFAULT '{}',
  updated_at   INTEGER NOT NULL
);

-- Seed initial world state rows
INSERT OR IGNORE INTO world_state (key, value_json, updated_at) VALUES
  ('global_tick',       '{"tick": 0, "era": "First Era"}',     0),
  ('sealed_heaven',     '{"active": false, "fragments_found": 0}', 0),
  ('planar_bleed',      '{"active": false, "affected_regions": []}', 0),
  ('great_fracture',    '{"triggered": false}',                 0);

-- ── NPC state ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS npc_state (
  npc_id            TEXT PRIMARY KEY,
  template_id       TEXT NOT NULL,
  realm_index       INTEGER NOT NULL DEFAULT 0,
  stage_index       INTEGER NOT NULL DEFAULT 0,
  ambition_stage    INTEGER NOT NULL DEFAULT 0,
  faction_id        TEXT,
  relationship_json TEXT NOT NULL DEFAULT '{}',  -- { accountId: score }
  memory_json       TEXT NOT NULL DEFAULT '{}',  -- { event_key: true }
  last_tick         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_npc_template ON npc_state(template_id);

-- ── World events ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  affected_region TEXT,
  started_at   INTEGER NOT NULL,
  ends_at      INTEGER,
  resolved     INTEGER NOT NULL DEFAULT 0,
  outcome      TEXT,
  data_json    TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_events_active ON world_events(resolved, ends_at);

-- ── Event participation (tracks player contribution) ──────────
CREATE TABLE IF NOT EXISTS event_participation (
  event_id     TEXT NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  faction_side TEXT,
  contribution INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, character_id)
);

-- ── Rival assignments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rival_assignments (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  npc_id       TEXT NOT NULL REFERENCES npc_state(npc_id),
  assigned_at  INTEGER NOT NULL,
  defeated_count INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active', -- active | defeated | converted | escaped
  PRIMARY KEY (character_id, npc_id)
);

-- ── Admin feature tracker ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_tracker (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_key  TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'not-started',
  -- not-started | in-progress | needs-work | complete | broken | deprecated
  completion   INTEGER NOT NULL DEFAULT 0,   -- 0-100
  severity     TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  priority     TEXT NOT NULL DEFAULT 'p2',   -- p0 | p1 | p2 | p3
  notes        TEXT,
  blockers_json TEXT NOT NULL DEFAULT '[]',
  depends_on_json TEXT NOT NULL DEFAULT '[]',
  updated_at   INTEGER NOT NULL
);

-- Seed initial features
INSERT OR IGNORE INTO feature_tracker
  (feature_key, title, status, completion, severity, priority, notes, updated_at)
VALUES
  ('infra-cloudflare',    'Cloudflare Workers + D1 Setup',    'in-progress', 40, 'critical', 'p0', 'wrangler.toml and schema created, not yet deployed', 0),
  ('auth-system',         'Account Auth (register/login/JWT)','not-started',  0, 'critical', 'p0', NULL, 0),
  ('character-select',    'Character Selection Screen',       'not-started',  0, 'high',     'p0', NULL, 0),
  ('server-side-state',   'Server-Side Character State API',  'not-started',  0, 'critical', 'p0', NULL, 0),
  ('class-origin-system', 'Class & Origin System',            'not-started',  0, 'high',     'p1', 'Design complete in VISION_V2.md', 0),
  ('combat-overhaul',     'Combat V2 (technique clash, status effects)', 'not-started', 0, 'high', 'p1', NULL, 0),
  ('quest-system',        'Quest Tree & Narrative System',    'not-started',  0, 'high',     'p1', NULL, 0),
  ('npc-tick-system',     'NPC Living World Tick (cron)',     'not-started',  0, 'medium',   'p1', NULL, 0),
  ('companion-system',    'Companion System',                 'not-started',  0, 'medium',   'p2', NULL, 0),
  ('world-events',        'World Events System',              'not-started',  0, 'medium',   'p2', NULL, 0),
  ('pvp-system',          'PvP Arena & Challenge',            'not-started',  0, 'medium',   'p2', NULL, 0),
  ('multiverse-system',   'Multiversal Crossover System',     'not-started',  0, 'low',      'p3', 'Design complete in VISION_V2.md', 0),
  ('mobile-ui',           'Mobile-First UI Rework',           'not-started',  0, 'high',     'p1', NULL, 0),
  ('admin-dashboard',     'Admin Dashboard & Dev Tracker',    'not-started',  0, 'medium',   'p2', NULL, 0),
  ('pwa-manifest',        'PWA Manifest + Service Worker',    'not-started',  0, 'low',      'p3', NULL, 0),
  ('drop-overhaul',       'Drop System Overhaul (tiered)',    'not-started',  0, 'medium',   'p2', NULL, 0),
  ('monetization',        'Monetization (Jade Seals, Season Pass)', 'not-started', 0, 'low', 'p3', NULL, 0);

-- ── Audit log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   TEXT,
  character_id TEXT,
  admin_id     TEXT,
  action       TEXT NOT NULL,
  data_json    TEXT NOT NULL DEFAULT '{}',
  ip_address   TEXT,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_account   ON audit_log(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_log(created_at DESC);
