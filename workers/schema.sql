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
  ('monetization',        'Monetization (Jade Seals, Season Pass)', 'not-started', 0, 'low', 'p3', NULL, 0),
  ('zone-exploration',    'Zone & Node Exploration System',   'not-started',  0, 'high',     'p1', NULL, 0),
  ('guild-system',        'Guild / Sect System',              'not-started',  0, 'high',     'p1', NULL, 0),
  ('player-housing',      'Player Housing & Placement',       'not-started',  0, 'medium',   'p2', NULL, 0),
  ('crafting-alchemy',    'Crafting & Alchemy System',        'not-started',  0, 'high',     'p1', NULL, 0),
  ('afk-system',          'AFK Action Queue & Rewards',       'not-started',  0, 'high',     'p1', 'Core retention hook', 0),
  ('weapon-system',       'Weapon Types & Technique Mastery', 'not-started',  0, 'high',     'p1', NULL, 0),
  ('item-drop-system',    'Enemy Part Drops & Item Templates','not-started',  0, 'high',     'p1', NULL, 0),
  ('npc-interact',        'NPC Dialogue & Zone Encounters',   'not-started',  0, 'high',     'p1', NULL, 0),
  ('dynamic-story',       'Dynamic Story & World Memory',     'not-started',  0, 'medium',   'p2', NULL, 0);

-- ── Zones & exploration nodes ─────────────────────────────────
-- Zones are the explorable areas. Each has a min/max realm requirement.
-- zone_nodes are individual points of interest within a zone.
CREATE TABLE IF NOT EXISTS zones (
  id            TEXT PRIMARY KEY,          -- e.g. 'ashen-frontier-wastes'
  region_id     TEXT NOT NULL,             -- parent region
  name          TEXT NOT NULL,
  description   TEXT,
  min_realm     INTEGER NOT NULL DEFAULT 0,
  max_realm     INTEGER,                   -- NULL = no cap
  danger_level  INTEGER NOT NULL DEFAULT 1, -- 1–10
  zone_type     TEXT NOT NULL DEFAULT 'wilderness',
  -- wilderness | dungeon | ruin | spirit-vein | sect-territory | city-outskirts
  data_json     TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS zone_nodes (
  id            TEXT PRIMARY KEY,
  zone_id       TEXT NOT NULL REFERENCES zones(id),
  name          TEXT NOT NULL,
  node_type     TEXT NOT NULL,
  -- spirit-herb | beast-lair | ruin-cache | hidden-cave | npc-camp | boss-lair | sect-gate
  realm_req     INTEGER NOT NULL DEFAULT 0,
  respawn_hours INTEGER NOT NULL DEFAULT 6,
  loot_table    TEXT NOT NULL DEFAULT '[]', -- JSON array of item drop rules
  npc_ids       TEXT NOT NULL DEFAULT '[]', -- JSON array of NPC ids that spawn here
  data_json     TEXT NOT NULL DEFAULT '{}'
);

-- Tracks which nodes a character has visited / last looted
CREATE TABLE IF NOT EXISTS character_zone_progress (
  character_id  TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  node_id       TEXT NOT NULL REFERENCES zone_nodes(id),
  last_visited  INTEGER,
  last_looted   INTEGER,
  times_visited INTEGER NOT NULL DEFAULT 0,
  discovered    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (character_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_czp_character ON character_zone_progress(character_id);

-- ── Guilds / Sects ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guilds (
  id            TEXT PRIMARY KEY,
  name          TEXT UNIQUE NOT NULL,
  tag           TEXT NOT NULL,             -- short 2-5 char display tag
  description   TEXT,
  leader_id     TEXT REFERENCES characters(id),
  guild_type    TEXT NOT NULL DEFAULT 'sect',
  -- sect | rogue-band | merchant-house | assassin-guild | ancient-order
  realm_index   INTEGER NOT NULL DEFAULT 0, -- guild's collective power tier
  level         INTEGER NOT NULL DEFAULT 1,
  xp            INTEGER NOT NULL DEFAULT 0,
  treasury      INTEGER NOT NULL DEFAULT 0, -- silver
  jade_seals    INTEGER NOT NULL DEFAULT 0, -- premium currency pool
  territory     TEXT NOT NULL DEFAULT '[]', -- JSON array of zone_ids controlled
  created_at    INTEGER NOT NULL,
  disbanded_at  INTEGER,
  data_json     TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id      TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  character_id  TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  rank          TEXT NOT NULL DEFAULT 'disciple',
  -- founder | elder | inner-disciple | outer-disciple | disciple | guest
  contribution  INTEGER NOT NULL DEFAULT 0,
  joined_at     INTEGER NOT NULL,
  PRIMARY KEY (guild_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_members_char ON guild_members(character_id);

-- Guild raid / war log
CREATE TABLE IF NOT EXISTS guild_wars (
  id            TEXT PRIMARY KEY,
  attacker_guild TEXT NOT NULL REFERENCES guilds(id),
  defender_guild TEXT NOT NULL REFERENCES guilds(id),
  zone_id       TEXT,                      -- contested zone (nullable = open war)
  status        TEXT NOT NULL DEFAULT 'active', -- active | resolved | surrendered
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER,
  outcome       TEXT,                      -- attacker-win | defender-win | draw
  data_json     TEXT NOT NULL DEFAULT '{}'
);

-- ── Player housing ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_homes (
  id            TEXT PRIMARY KEY,
  character_id  TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  city_id       TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT 'My Dwelling',
  tier          TEXT NOT NULL DEFAULT 'common',
  -- common | refined | spirit-touched | dao-inscribed | heavenly
  size          INTEGER NOT NULL DEFAULT 1,  -- 1–5 (determines item slots)
  purchased_at  INTEGER NOT NULL,
  rent_due_at   INTEGER,                   -- NULL if owned outright
  data_json     TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS home_items (
  id            TEXT PRIMARY KEY,
  home_id       TEXT NOT NULL REFERENCES player_homes(id) ON DELETE CASCADE,
  item_id       TEXT NOT NULL,             -- references item_templates.id
  placed_at     INTEGER NOT NULL,
  grid_x        INTEGER,
  grid_y        INTEGER,
  data_json     TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_homes_character ON player_homes(character_id);

-- ── Items & inventory ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_templates (
  id            TEXT PRIMARY KEY,          -- e.g. 'blazefang-scale'
  name          TEXT NOT NULL,
  description   TEXT,
  item_type     TEXT NOT NULL,
  -- weapon | armor | consumable | crafting-mat | pill | spirit-beast-part |
  -- talisman | spirit-stone | seed | blueprint | furniture | rune
  rarity        TEXT NOT NULL DEFAULT 'common',
  -- common | uncommon | rare | epic | legendary | mythic | transcendent
  realm_req     INTEGER NOT NULL DEFAULT 0,
  path_affinity TEXT,                      -- path key or NULL (any path can use)
  stack_max     INTEGER NOT NULL DEFAULT 1,
  is_tradeable  INTEGER NOT NULL DEFAULT 1,
  base_stats    TEXT NOT NULL DEFAULT '{}', -- JSON: { atk, def, qi_bonus, etc. }
  crafting_ingredients TEXT NOT NULL DEFAULT '[]', -- JSON array of {id, qty}
  data_json     TEXT NOT NULL DEFAULT '{}'
);

-- Characters' inventory items (instances of item_templates)
CREATE TABLE IF NOT EXISTS character_inventory (
  id            TEXT PRIMARY KEY,
  character_id  TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  template_id   TEXT NOT NULL REFERENCES item_templates(id),
  quantity      INTEGER NOT NULL DEFAULT 1,
  equipped_slot TEXT,                      -- 'weapon' | 'armor' | 'accessory1/2' | NULL
  enhancement   INTEGER NOT NULL DEFAULT 0, -- refinement level 0–10
  custom_name   TEXT,
  obtained_at   INTEGER NOT NULL,
  data_json     TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_inventory_character ON character_inventory(character_id);
CREATE INDEX IF NOT EXISTS idx_inventory_equipped  ON character_inventory(character_id, equipped_slot);

-- ── Crafting & Alchemy queues ─────────────────────────────────
-- Crafting is async (takes real time). A craft job is queued and checked on next action.
CREATE TABLE IF NOT EXISTS craft_queue (
  id            TEXT PRIMARY KEY,
  character_id  TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  recipe_id     TEXT NOT NULL,
  craft_type    TEXT NOT NULL DEFAULT 'blacksmith', -- blacksmith | alchemy | formation | tailoring
  started_at    INTEGER NOT NULL,
  completes_at  INTEGER NOT NULL,
  result_item   TEXT NOT NULL,             -- item_template id
  result_qty    INTEGER NOT NULL DEFAULT 1,
  collected     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_craft_character ON craft_queue(character_id, collected);

-- ── Weapon & technique upgrades ───────────────────────────────
CREATE TABLE IF NOT EXISTS character_techniques (
  id            TEXT PRIMARY KEY,
  character_id  TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  technique_id  TEXT NOT NULL,             -- references technique_templates
  rank          INTEGER NOT NULL DEFAULT 1, -- 1–10 mastery
  xp            INTEGER NOT NULL DEFAULT 0,
  obtained_at   INTEGER NOT NULL,
  source        TEXT                        -- 'drop' | 'quest' | 'npc-teach' | 'store'
);

CREATE INDEX IF NOT EXISTS idx_techniques_character ON character_techniques(character_id);

-- ── AFK actions (passive income while offline) ────────────────
-- Player queues an AFK action before logging off.
-- On next login, elapsed time is calculated and rewards applied.
CREATE TABLE IF NOT EXISTS afk_queue (
  character_id  TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  action_type   TEXT NOT NULL,
  -- meditate | patrol-zone | herb-gather | spirit-stone-mine |
  -- alchemy-study | guard-post | city-patrol
  zone_id       TEXT,
  started_at    INTEGER NOT NULL,
  max_duration  INTEGER NOT NULL,          -- ms cap (based on realm + bonuses)
  data_json     TEXT NOT NULL DEFAULT '{}'
);

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

-- ── Seed Zones ────────────────────────────────────────────────
INSERT OR IGNORE INTO zones (id, region_id, name, description, min_realm, max_realm, danger_level, zone_type) VALUES
  ('ashgate-outskirts',   'ashen-frontier', 'Ashgate Outskirts',        'Crumbling roads outside the city. Low danger, good for beginners.', 0, 2, 1, 'wilderness'),
  ('scorched-basin',      'ashen-frontier', 'Scorched Basin',           'A sunken valley scorched by an ancient battle. Spirit beasts roam freely.', 1, 4, 3, 'wilderness'),
  ('cinderwall-ruins',    'ashen-frontier', 'Cinderwall Ruins',         'Ruins of a sect destroyed in the First Fracture. Treasures lie buried.', 2, 5, 5, 'ruin'),
  ('iron-thorn-ridge',    'ashen-frontier', 'Iron Thorn Ridge',         'A jagged mountain ridge rich in iron-spirit ore. Guarded by Ironback Boars.', 1, 3, 3, 'wilderness'),
  ('voidrift-entrance',   'void-rift',      'Void Rift: Outer Rim',     'The outermost ring of the Void Rift. Reality flickers here.', 4, 6, 7, 'wilderness'),
  ('jade-marshes',        'jade-delta',     'Jade Marshes',             'Foggy wetlands dense with spirit herbs. Treacherous footing.', 0, 3, 2, 'wilderness'),
  ('jade-pharmacy-ruins', 'jade-delta',     'Ruined Apothecary Sect',   'The collapsed hall of a once-great Alchemy sect. Ghost echoes linger.', 2, 5, 5, 'ruin'),
  ('heavens-shelf',       'celestial-plateau','Heaven''s Shelf',        'A floating plateau accessible only to Foundation-stage cultivators.', 1, 4, 4, 'spirit-vein'),
  ('sovereign-tomb',      'sovereign-wastes','Sovereign''s Tomb',       'The sealed tomb of an ancient Dao Sovereign. Almost certainly a bad idea.', 6, 9, 9, 'dungeon'),
  ('ashen-spirit-vein',   'ashen-frontier', 'Ashen Spirit Vein',        'A cracked spirit vein leaking qi into the air. Meditation is twice as effective here.', 0, null, 2, 'spirit-vein');

-- Seed zone nodes for starter zones
INSERT OR IGNORE INTO zone_nodes (id, zone_id, name, node_type, realm_req, respawn_hours, loot_table) VALUES
  ('ash-herb-patch',    'ashgate-outskirts', 'Wild Qi Grass Patch',     'spirit-herb',  0, 4,  '[{"id":"qi-grass","qty":[1,3],"chance":0.8},{"id":"dustbloom","qty":[1,1],"chance":0.2}]'),
  ('ash-dustrat-den',   'ashgate-outskirts', 'Dustrat Den',             'beast-lair',   0, 6,  '[{"id":"dustrat-fur","qty":[1,2],"chance":0.7},{"id":"beast-blood-vial","qty":[1,1],"chance":0.3}]'),
  ('ash-old-shrine',    'ashgate-outskirts', 'Forgotten Shrine',        'ruin-cache',   0, 12, '[{"id":"low-spirit-stone","qty":[1,2],"chance":0.5},{"id":"rusted-talisman","qty":[1,1],"chance":0.2}]'),
  ('basin-fire-lizard', 'scorched-basin',    'Fire Lizard Nesting Grounds','beast-lair',1, 8,  '[{"id":"fire-lizard-scale","qty":[1,3],"chance":0.75},{"id":"flame-core","qty":[1,1],"chance":0.15},{"id":"blazing-blood","qty":[1,1],"chance":0.1}]'),
  ('basin-herb-groove', 'scorched-basin',    'Char-Bloom Grove',        'spirit-herb',  1, 6,  '[{"id":"charbloom","qty":[1,2],"chance":0.6},{"id":"cinder-root","qty":[1,1],"chance":0.35}]'),
  ('basin-collapsed-gate','scorched-basin',  'Collapsed Sect Gate',     'ruin-cache',   1, 24, '[{"id":"cracked-spirit-stone","qty":[2,5],"chance":0.7},{"id":"broken-rune-shard","qty":[1,2],"chance":0.4}]'),
  ('cinder-treasury',   'cinderwall-ruins',  'Buried Treasury Room',    'ruin-cache',   2, 48, '[{"id":"mid-spirit-stone","qty":[1,3],"chance":0.6},{"id":"ancient-blueprint","qty":[1,1],"chance":0.1}]'),
  ('cinder-golem-post', 'cinderwall-ruins',  'Guardian Golem Post',     'boss-lair',    2, 24, '[{"id":"golem-core","qty":[1,1],"chance":0.4},{"id":"refined-iron-plate","qty":[1,2],"chance":0.6}]'),
  ('jade-root-cluster', 'jade-marshes',      'Deeproot Cluster',        'spirit-herb',  0, 5,  '[{"id":"jade-root","qty":[1,3],"chance":0.8},{"id":"misty-cap","qty":[1,1],"chance":0.3}]'),
  ('jade-marsh-croc',   'jade-marshes',      'Marshclaw Croc Territory','beast-lair',   0, 8,  '[{"id":"marshclaw-hide","qty":[1,2],"chance":0.7},{"id":"croc-tooth","qty":[1,3],"chance":0.5}]'),
  ('heaven-shelf-vein', 'heavens-shelf',     'Heaven Shelf Qi Wellspring','spirit-herb', 1, 3, '[{"id":"heaven-grass","qty":[1,2],"chance":0.9},{"id":"sky-lotus","qty":[1,1],"chance":0.1}]'),
  ('void-rift-shard',   'voidrift-entrance', 'Void Crystal Deposit',    'ruin-cache',   4, 24, '[{"id":"void-crystal-shard","qty":[1,2],"chance":0.5},{"id":"unstable-void-core","qty":[1,1],"chance":0.05}]');

-- Seed starter item templates
INSERT OR IGNORE INTO item_templates (id, name, description, item_type, rarity, realm_req, stack_max, is_tradeable, base_stats) VALUES
  -- Herbs
  ('qi-grass',            'Qi Condensation Grass', 'A common herb that, when brewed, slightly replenishes qi.', 'crafting-mat', 'common', 0, 99, 1, '{}'),
  ('dustbloom',           'Dustbloom Flower',      'An ash-grey flower with faint qi. Ingredient in low-grade pills.', 'crafting-mat', 'common', 0, 99, 1, '{}'),
  ('charbloom',           'Charbloom',             'A heat-resistant herb. Effective in fire-attribute pills.', 'crafting-mat', 'uncommon', 1, 99, 1, '{}'),
  ('cinder-root',         'Cinder Root',           'Roots baked hard by underground heat. Forging ingredient.', 'crafting-mat', 'uncommon', 1, 50, 1, '{}'),
  ('jade-root',           'Jade Root',             'Smooth, green root packed with wood-qi. Foundation for healing pills.', 'crafting-mat', 'common', 0, 99, 1, '{}'),
  ('misty-cap',           'Misty Cap Mushroom',    'Releases qi fog when crushed. Used in confusion and sleep pills.', 'crafting-mat', 'uncommon', 0, 50, 1, '{}'),
  ('heaven-grass',        'Heaven Shelf Qi Grass', 'Grows only at elevation. Amplifies qi absorption for 2 hours.', 'crafting-mat', 'rare', 1, 30, 1, '{}'),
  ('sky-lotus',           'Sky Lotus',             'A legendary herb that blooms once every 10 ticks. Priceless.', 'crafting-mat', 'legendary', 1, 5, 1, '{}'),
  -- Beast parts
  ('dustrat-fur',         'Dustrat Fur',           'Rough grey fur. Used in low-tier armor padding.', 'crafting-mat', 'common', 0, 99, 1, '{}'),
  ('beast-blood-vial',    'Beast Blood Vial',      'Collected beast blood. Base ingredient for blood-cultivator pills.', 'crafting-mat', 'common', 0, 50, 1, '{}'),
  ('fire-lizard-scale',   'Fire Lizard Scale',     'Heat-resistant scale. Excellent armor material for fire cultivators.', 'crafting-mat', 'uncommon', 1, 50, 1, '{}'),
  ('flame-core',          'Flame Core',            'A burning crystalline core from a Fire Lizard. Weapon forging material.', 'crafting-mat', 'rare', 1, 10, 1, '{}'),
  ('blazing-blood',       'Blazing Blood',         'Blood that stays hot hours after extraction. Alchemic catalyst.', 'crafting-mat', 'rare', 1, 10, 1, '{}'),
  ('marshclaw-hide',      'Marshclaw Hide',        'Thick, water-resistant hide. Good for defensive gear.', 'crafting-mat', 'common', 0, 50, 1, '{}'),
  ('croc-tooth',          'Marshclaw Tooth',       'Dense fang that can be carved into a weapon tip.', 'crafting-mat', 'uncommon', 0, 30, 1, '{}'),
  ('golem-core',          'Guardian Golem Core',   'The power source of a destroyed sect guardian. Rare formation material.', 'crafting-mat', 'epic', 2, 5, 1, '{}'),
  ('void-crystal-shard',  'Void Crystal Shard',    'A fragment of solidified void energy. Dangerous to handle without training.', 'crafting-mat', 'rare', 4, 10, 1, '{}'),
  ('unstable-void-core',  'Unstable Void Core',    'An extremely dangerous void energy core. Handle with extreme care.', 'crafting-mat', 'legendary', 4, 3, 0, '{}'),
  -- Spirit stones (currency / crafting)
  ('low-spirit-stone',    'Low-Grade Spirit Stone','The most common form of cultivator currency and qi fuel.', 'spirit-stone', 'common', 0, 999, 1, '{"qi_restore": 10}'),
  ('cracked-spirit-stone','Cracked Spirit Stone',  'A damaged spirit stone. Still usable, half the energy.', 'spirit-stone', 'common', 0, 999, 1, '{"qi_restore": 5}'),
  ('mid-spirit-stone',    'Mid-Grade Spirit Stone','A purer spirit stone worth 10 low-grade stones.', 'spirit-stone', 'uncommon', 1, 999, 1, '{"qi_restore": 100}'),
  -- Weapons (base templates; player instances can have enhancements)
  ('iron-sword',          'Iron Sword',            'A simple forged sword. Reliable and affordable.', 'weapon', 'common', 0, 1, 1, '{"atk": 12, "atk_type": "slash", "affinity": null}'),
  ('blazefang-blade',     'Blazefang Blade',       'Forged from fire lizard scales and flame core. Burns on contact.', 'weapon', 'rare', 1, 1, 1, '{"atk": 28, "atk_type": "slash", "affinity": "fire", "burn_chance": 0.2}'),
  ('marsh-fang-dagger',   'Marsh Fang Dagger',     'Carved from Marshclaw teeth. Serrated edge causes bleeding.', 'weapon', 'uncommon', 0, 1, 1, '{"atk": 18, "atk_type": "pierce", "affinity": null, "bleed_chance": 0.15}'),
  ('broken-rune-shard',   'Broken Rune Shard',     'A fragment of an ancient formation. Can be reforged.', 'crafting-mat', 'uncommon', 2, 10, 1, '{}'),
  ('rusted-talisman',     'Rusted Talisman',       'An old protective talisman. Barely functional.', 'talisman', 'common', 0, 5, 1, '{"def_bonus": 2, "uses": 1}'),
  ('refined-iron-plate',  'Refined Iron Plate',    'A slab of refined iron. Used in heavy armor forging.', 'crafting-mat', 'uncommon', 1, 20, 1, '{}'),
  ('ancient-blueprint',   'Ancient Technique Blueprint', 'A partially destroyed cultivation technique scroll. Can yield rare techniques.', 'blueprint', 'rare', 2, 1, 0, '{}');

