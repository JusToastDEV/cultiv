/**
 * Game handlers — characters, state, actions, zones
 */

import {
  json, generateUUID, auditLog,
  getActiveCharacter, getCharacterState, saveCharacterState,
  getCooldownRemaining, setCooldown, clearCooldown
} from './utils.js';

// ── Travel times per terrain type (ms) ──────────────────────
const TRAVEL_TIMES = {
  'C': 20 * 1000,  // City  — 20s
  'R': 25 * 1000,  // Road  — 25s
  '.': 40 * 1000,  // Open  — 40s
  'V': 40 * 1000,  // Vein  — 40s
  'H': 50 * 1000,  // Herb  — 50s
  'F': 55 * 1000,  // Forest — 55s
  'W': 60 * 1000,  // Wild  — 60s
  'B': 65 * 1000,  // Lair  — 65s
  'K': 70 * 1000,  // Cave  — 70s
  'X': 75 * 1000,  // Ruin  — 75s
};

// ── Action cooldowns (milliseconds) ──────────────────────────
const EXCLUSIVE_ACTIONS = ['meditate', 'trainBody', 'trainSoul'];
const COOLDOWNS = {
  meditate:      15 * 60 * 1000,  // 15 min
  trainBody:     20 * 60 * 1000,  // 20 min
  trainSoul:     20 * 60 * 1000,  // 20 min
  exploreNode:    8 * 60 * 1000,  // 8 min per-node
  cityAction:     5 * 60 * 1000,  // 5 min
  battleAction:   2 * 60 * 1000,  // 2 min between fights
  craft:         20 * 60 * 1000,  // 20 min manual craft check
};

const FIELD_ACTION_LABELS = {
  herbs: 'Forage',
  ores: 'Mine',
  mobs: 'Hunt',
  relic: 'Scavenge',
  spirit: 'Resonate'
};

const FIELD_ACTION_BASE_MS = {
  herbs: 7 * 60 * 1000,
  ores: 9 * 60 * 1000,
  mobs: 10 * 60 * 1000,
  relic: 11 * 60 * 1000,
  spirit: 8 * 60 * 1000
};

// ── Character management ──────────────────────────────────────

export async function handleCharacters(request, env, account, path) {
  const method = request.method;

  // GET /api/characters — list all characters for this account
  if (path === '/api/characters' && method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT id, slot, name, origin, path, realm_index, stage_index, created_at, last_active
       FROM characters WHERE account_id = ?1 AND is_deleted = 0
       ORDER BY slot ASC`
    ).bind(account.id).all();
    return json({ characters: rows.results }, 200, request);
  }

  // POST /api/characters — create a new character
  if (path === '/api/characters' && method === 'POST') {
    return createCharacter(request, env, account);
  }

  // DELETE /api/characters/:slot — soft-delete a character
  const deleteMatch = path.match(/^\/api\/characters\/(\d)$/);
  if (deleteMatch && method === 'DELETE') {
    return deleteCharacter(request, env, account, parseInt(deleteMatch[1]));
  }

  return json({ error: 'Not found' }, 404, request);
}

async function createCharacter(request, env, account) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, request); }

  const { name, origin, path: charPath, slot } = body;

  if (!name || !origin || !charPath || !slot) {
    return json({ error: 'name, origin, path, and slot are required' }, 400, request);
  }
  if (!/^[a-zA-Z\s'-]{2,24}$/.test(name)) {
    return json({ error: 'Name must be 2–24 letters, spaces, apostrophes, or hyphens' }, 400, request);
  }
  if (![1, 2, 3].includes(Number(slot))) {
    return json({ error: 'Slot must be 1, 2, or 3' }, 400, request);
  }

  // Check slot is free
  const existing = await env.DB.prepare(
    `SELECT id FROM characters WHERE account_id = ?1 AND slot = ?2 AND is_deleted = 0`
  ).bind(account.id, slot).first();
  if (existing) {
    return json({ error: `Slot ${slot} is already occupied` }, 409, request);
  }

  const charId = generateUUID();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO characters (id, account_id, slot, name, origin, path, realm_index, stage_index, created_at, last_active)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7, ?7)`
  ).bind(charId, account.id, slot, name, origin, charPath, now).run();

  // Initialize state
  const initialState = buildInitialState(name, origin, charPath);
  await env.DB.prepare(
    `INSERT INTO character_state (character_id, state_json, updated_at) VALUES (?1, ?2, ?3)`
  ).bind(charId, JSON.stringify(initialState), now).run();

  await auditLog(env, { accountId: account.id, characterId: charId, action: 'create_character', data: { name, origin, path: charPath, slot } });

  return json({ ok: true, characterId: charId, name, slot }, 201, request);
}

async function deleteCharacter(request, env, account, slot) {
  const character = await env.DB.prepare(
    `SELECT id, name FROM characters WHERE account_id = ?1 AND slot = ?2 AND is_deleted = 0`
  ).bind(account.id, slot).first();

  if (!character) return json({ error: 'Character not found' }, 404, request);

  const now = Date.now();
  await env.DB.prepare(
    `UPDATE characters SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2`
  ).bind(now, character.id).run();

  await auditLog(env, { accountId: account.id, characterId: character.id, action: 'delete_character', data: { name: character.name, slot } });

  return json({ ok: true, message: `Character "${character.name}" will be permanently deleted in 72 hours.` }, 200, request);
}

// ── Game state ────────────────────────────────────────────────

export async function handleGameState(request, env, account) {
  const character = await getActiveCharacter(request, env, account);
  if (!character) return json({ error: 'No active character. Send X-Character-Id header.' }, 400, request);

  let state = await getCharacterState(env, character.id);
  if (!state) return json({ error: 'Character state not found' }, 404, request);

  // Resolve any completed crafts
  const craftResult = await resolveCompletedCrafts(env, character.id, state);
  if (craftResult) {
    state = craftResult.state;
    await saveCharacterState(env, character.id, state);
  }

  // Attach cooldowns
  const cooldowns = {};
  await Promise.all(Object.keys(COOLDOWNS).map(async k => {
    cooldowns[k] = await getCooldownRemaining(env, character.id, k);
  }));

  // Travel cooldown
  const travelCooldown = await getCooldownRemaining(env, character.id, 'travel');

  // Derive active exclusive action (first exclusive action with remaining cooldown)
  let activeAction = null;
  for (const a of EXCLUSIVE_ACTIONS) {
    if (cooldowns[a] > 0) { activeAction = { type: a, remaining: cooldowns[a] }; break; }
  }

  // Update last_active
  env.DB.prepare('UPDATE characters SET last_active = ?1 WHERE id = ?2')
    .bind(Date.now(), character.id).run().catch(() => {});

  const visiblePlayers = await getVisiblePlayersForTile(
    env,
    character.id,
    state.regionId ?? 'ashen-frontier',
    state.tileX ?? 9,
    state.tileY ?? 6
  );

  return json({
    ok: true,
    state: { ...state, visiblePlayers },
    cooldowns,
    travelCooldown,
    activeAction,
    craftRewards: craftResult?.rewards ?? null,
    character: {
      id: character.id,
      name: character.name,
      origin: character.origin,
      path: character.path,
      realm_index: character.realm_index,
      stage_index: character.stage_index
    }
  }, 200, request);
}

async function getVisiblePlayersForTile(env, characterId, regionId, tileX, tileY) {
  const activeAfter = Date.now() - (5 * 60 * 1000);
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.realm_index, c.stage_index,
            json_extract(cs.state_json, '$.regionId') AS regionId,
            CAST(json_extract(cs.state_json, '$.tileX') AS INTEGER) AS tileX,
            CAST(json_extract(cs.state_json, '$.tileY') AS INTEGER) AS tileY
     FROM characters c
     JOIN character_state cs ON cs.character_id = c.id
     WHERE c.is_deleted = 0
       AND c.id <> ?1
       AND c.last_active >= ?2
       AND json_extract(cs.state_json, '$.regionId') = ?3
       AND ABS(CAST(json_extract(cs.state_json, '$.tileX') AS INTEGER) - ?4) <= 2
       AND ABS(CAST(json_extract(cs.state_json, '$.tileY') AS INTEGER) - ?5) <= 2
     ORDER BY c.last_active DESC
     LIMIT 12`
  ).bind(characterId, activeAfter, regionId, tileX, tileY).all();

  return (results || []).map(player => ({
    id: player.id,
    name: player.name,
    realm_index: player.realm_index,
    stage_index: player.stage_index,
    regionId: player.regionId,
    tileX: Number(player.tileX),
    tileY: Number(player.tileY)
  }));
}

// ── Game actions ──────────────────────────────────────────────

export async function handleGameAction(request, env, account) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);

  const character = await getActiveCharacter(request, env, account);
  if (!character) return json({ error: 'No active character. Send X-Character-Id header.' }, 400, request);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, request); }

  const { action, options } = body;
  if (!action) return json({ error: 'action is required' }, 400, request);

  // Check cooldown for this specific action
  if (COOLDOWNS[action] !== undefined) {
    const remaining = await getCooldownRemaining(env, character.id, action);
    if (remaining > 0) {
      return json({ error: 'Action on cooldown', cooldown_ms: remaining, ready_at: Date.now() + remaining }, 429, request);
    }
  }

  // Exclusive action mutex — prevent simultaneous training actions
  if (EXCLUSIVE_ACTIONS.includes(action)) {
    for (const a of EXCLUSIVE_ACTIONS) {
      if (a === action) continue;
      const rem = await getCooldownRemaining(env, character.id, a);
      if (rem > 0) {
        return json({
          error: 'You are already in training. Complete or cancel your current session first.',
          active_action: a,
          cooldown_ms: rem
        }, 429, request);
      }
    }
  }

  let state = await getCharacterState(env, character.id);
  if (!state) return json({ error: 'Character state not found' }, 404, request);

  // Cancel active training action
  if (action === 'cancelAction') {
    const cancelled = [];
    for (const a of EXCLUSIVE_ACTIONS) {
      const rem = await getCooldownRemaining(env, character.id, a);
      if (rem > 0) {
        await clearCooldown(env, character.id, a);
        cancelled.push(a);
      }
    }
    const name = { meditate: 'Meditation', trainBody: 'Body training', trainSoul: 'Soul training' }[cancelled[0]] ?? 'Training';
    const visiblePlayers = await getVisiblePlayersForTile(
      env,
      character.id,
      state.regionId ?? 'ashen-frontier',
      state.tileX ?? 9,
      state.tileY ?? 6
    );
    return json({ ok: true, result: [`${name} cancelled. Training was interrupted.`], state: { ...state, visiblePlayers } }, 200, request);
  }

  // Travel cooldown gate for moveToTile
  if (action === 'moveToTile') {
    const travelRem = await getCooldownRemaining(env, character.id, 'travel');
    if (travelRem > 0) {
      return json({ error: 'Still traveling...', cooldown_ms: travelRem }, 429, request);
    }
  }

  if (action === 'fieldAction') {
    const mode = options?.mode;
    const regionId = state.regionId ?? 'ashen-frontier';
    const tileX = state.tileX ?? 9;
    const tileY = state.tileY ?? 6;
    const fieldCooldownKey = `field:${mode}:${regionId}:${tileX}:${tileY}`;
    const fieldRem = await getCooldownRemaining(env, character.id, fieldCooldownKey);
    if (fieldRem > 0) {
      return json({
        error: `This tile needs ${Math.ceil(fieldRem / 60000)} more minutes to recover.`,
        cooldown_ms: fieldRem
      }, 429, request);
    }
  }

  let result;
  switch (action) {
    case 'meditate':      result = actionMeditate(state, character, options);     break;
    case 'trainBody':     result = actionTrainBody(state, character, options);    break;
    case 'trainSoul':     result = actionTrainSoul(state, character, options);    break;
    case 'exploreNode':   result = await actionExploreNode(state, character, options, env); break;
    case 'fieldAction':   result = await actionFieldAction(state, character, options, env); break;
    case 'moveToTile':    result = actionMoveToTile(state, character, options);    break;
    case 'cityAction':    result = actionCityAction(state, character, options);   break;
    case 'battleAction':  result = actionBattle(state, character, options);       break;

    default:
      return json({ error: `Unknown action: ${action}` }, 400, request);
  }

  if (result.error) return json({ error: result.error }, 400, request);

  await saveCharacterState(env, character.id, result.state);

  if (result.state.realmIndex !== character.realm_index ||
      result.state.stageIndex !== character.stage_index) {
    await env.DB.prepare(
      'UPDATE characters SET realm_index = ?1, stage_index = ?2, last_active = ?3 WHERE id = ?4'
    ).bind(result.state.realmIndex ?? 0, result.state.stageIndex ?? 0, Date.now(), character.id).run();
  }

  if (COOLDOWNS[action]) {
    await setCooldown(env, character.id, action, COOLDOWNS[action]);
  }

  // Set travel cooldown on successful tile move
  let travelCooldown = 0;
  if (action === 'moveToTile') {
    const tType = options?.terrainType ?? '.';
    let travelMs = TRAVEL_TIMES[tType] ?? 45000;
    if (account.admin_level > 0) {
      travelMs = Math.max(1000, Math.round(travelMs / 10));
    }
    await setCooldown(env, character.id, 'travel', travelMs);
    travelCooldown = travelMs;
  }
  if (action === 'fieldAction' && result.cooldownKey && result.cooldownMs) {
    await setCooldown(env, character.id, result.cooldownKey, result.cooldownMs);
  }

  // Return updated cooldowns so client can update immediately
  const cooldowns = {};
  await Promise.all(Object.keys(COOLDOWNS).map(async k => {
    cooldowns[k] = await getCooldownRemaining(env, character.id, k);
  }));
  let activeAction = null;
  for (const a of EXCLUSIVE_ACTIONS) {
    if (cooldowns[a] > 0) { activeAction = { type: a, remaining: cooldowns[a] }; break; }
  }

  const visiblePlayers = await getVisiblePlayersForTile(
    env,
    character.id,
    result.state.regionId ?? 'ashen-frontier',
    result.state.tileX ?? 9,
    result.state.tileY ?? 6
  );

  return json({ ok: true, result: result.log, state: { ...result.state, visiblePlayers }, cooldowns, travelCooldown, activeAction }, 200, request);
}

// ── Zone routes ───────────────────────────────────────────────

export async function handleZones(request, env, account, path) {
  const character = await getActiveCharacter(request, env, account);

  // GET /api/zones — list all zones accessible to this character's realm
  if (path === '/api/zones' && request.method === 'GET') {
    const realmIndex = character?.realm_index ?? 0;
    const { results } = await env.DB.prepare(
      `SELECT id, region_id, name, description, min_realm, danger_level, zone_type
       FROM zones WHERE min_realm <= ?1
       ORDER BY min_realm, danger_level`
    ).bind(realmIndex).all();
    return json({ zones: results }, 200, request);
  }

  // GET /api/zones/:zoneId — zone details + node list
  const zoneMatch = path.match(/^\/api\/zones\/([^/]+)$/);
  if (zoneMatch && request.method === 'GET') {
    const zoneId = zoneMatch[1];
    const zone = await env.DB.prepare('SELECT * FROM zones WHERE id = ?1').bind(zoneId).first();
    if (!zone) return json({ error: 'Zone not found' }, 404, request);

    const { results: nodes } = await env.DB.prepare(
      `SELECT zn.id, zn.name, zn.node_type, zn.realm_req, zn.respawn_hours,
              czp.last_looted, czp.times_visited, czp.discovered
       FROM zone_nodes zn
       LEFT JOIN character_zone_progress czp
         ON czp.node_id = zn.id AND czp.character_id = ?2
       WHERE zn.zone_id = ?1`
    ).bind(zoneId, character?.id ?? '').all();

    return json({ zone, nodes: nodes.results ?? nodes }, 200, request);
  }

  return json({ error: 'Not found' }, 404, request);
}

// ── Inventory routes ──────────────────────────────────────────

export async function handleInventory(request, env, account, path) {
  const character = await getActiveCharacter(request, env, account);
  if (!character) return json({ error: 'No active character' }, 400, request);

  if (path === '/api/inventory' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT ci.id, ci.template_id, ci.quantity, ci.equipped_slot,
              ci.enhancement, ci.custom_name, ci.obtained_at,
              it.name, it.item_type, it.rarity, it.base_stats
       FROM character_inventory ci
       JOIN item_templates it ON it.id = ci.template_id
       WHERE ci.character_id = ?1
       ORDER BY it.item_type, it.rarity`
    ).bind(character.id).all();
    return json({ inventory: results }, 200, request);
  }

  return json({ error: 'Not found' }, 404, request);
}

// ── Action handlers ───────────────────────────────────────────

function actionMeditate(state, character, options) {
  const qi = state.qi ?? 0;
  const qiMax = state.qiMax ?? 100;
  const cultivationXp = state.cultivationXp ?? 0;
  // Spirit vein bonus tracked in state
  const locationBonus = state.atSpiritVein ? 2 : 1;
  const xpGain = Math.floor((10 + Math.floor(Math.random() * 6)) * locationBonus);
  const qiRestore = Math.floor(Math.min(qiMax - qi, Math.floor(qiMax * 0.25) * locationBonus));
  const log = [`You enter deep meditation.`];
  if (qiRestore > 0) log.push(`Qi restored: +${qiRestore}.`);
  log.push(`Cultivation XP: +${xpGain}${locationBonus > 1 ? ' (Spirit Vein bonus!)' : ''}.`);
  return {
    state: { ...state, qi: qi + qiRestore, cultivationXp: cultivationXp + xpGain },
    log
  };
}

function actionTrainBody(state, character, options) {
  const bodyXp = state.bodyXp ?? 0;
  const xpGain = 8 + Math.floor(Math.random() * 8);
  const hp = state.hp ?? 100;
  const hpMax = state.hpMax ?? 100;
  return {
    state: { ...state, bodyXp: bodyXp + xpGain, hp: Math.min(hpMax, hp + Math.floor(hpMax * 0.05)) },
    log: [`Body refinement complete. Body XP +${xpGain}. HP partially restored.`]
  };
}

function actionTrainSoul(state, character, options) {
  const soulXp = state.soulXp ?? 0;
  const xpGain = 8 + Math.floor(Math.random() * 8);
  const battleQi = state.battleQi ?? 0;
  const battleQiMax = state.battleQiMax ?? 50;
  return {
    state: { ...state, soulXp: soulXp + xpGain, battleQi: Math.min(battleQiMax, battleQi + 10) },
    log: [`Soul cultivation complete. Soul XP +${xpGain}.`]
  };
}

async function actionExploreNode(state, character, options, env) {
  const { nodeId } = options ?? {};
  if (!nodeId) return { error: 'nodeId required in options' };

  const node = await env.DB.prepare(
    'SELECT * FROM zone_nodes WHERE id = ?1'
  ).bind(nodeId).first();
  if (!node) return { error: 'Node not found' };

  // Realm gate check
  if ((character.realm_index ?? 0) < node.realm_req) {
    return { error: `You need to reach realm ${node.realm_req} to explore this area.` };
  }

  // Per-node cooldown (respawn based)
  const nodeCooldownKey = `node:${nodeId}`;
  const nodeRespawnMs = node.respawn_hours * 60 * 60 * 1000;
  const nodeCooldown = await getCooldownRemaining(env, character.id, nodeCooldownKey);
  if (nodeCooldown > 0) {
    const readyIn = Math.ceil(nodeCooldown / 60000);
    return { error: `This area needs ${readyIn} more minutes to respawn.` };
  }

  // Roll loot from node's loot table
  let lootTable = [];
  try { lootTable = JSON.parse(node.loot_table); } catch {}

  const drops = [];
  const log = [`You explore ${node.name}.`];

  for (const entry of lootTable) {
    if (Math.random() < entry.chance) {
      const qty = entry.qty[0] + Math.floor(Math.random() * (entry.qty[1] - entry.qty[0] + 1));
      drops.push({ id: entry.id, qty });
      // Add to inventory
      await grantItem(env, character.id, entry.id, qty);
      log.push(`Found: ${qty}x ${entry.id}.`);
    }
  }

  if (drops.length === 0) log.push(`Nothing notable found this time.`);

  // Update zone progress
  await env.DB.prepare(
    `INSERT INTO character_zone_progress (character_id, node_id, last_visited, last_looted, times_visited, discovered)
     VALUES (?1, ?2, ?3, ?3, 1, 1)
     ON CONFLICT(character_id, node_id) DO UPDATE SET
       last_visited = ?3,
       last_looted = CASE WHEN ?4 > 0 THEN ?3 ELSE last_looted END,
       times_visited = times_visited + 1,
       discovered = 1`
  ).bind(character.id, nodeId, Date.now(), drops.length).run();

  // Set node respawn cooldown
  await setCooldown(env, character.id, nodeCooldownKey, nodeRespawnMs);

  // Small silver + XP gain
  const silverGain = 2 + Math.floor(Math.random() * (8 + character.realm_index * 3));
  log.push(`+${silverGain} silver.`);

  return {
    state: { ...state, silver: (state.silver ?? 0) + silverGain },
    log,
    drops
  };
}

async function actionFieldAction(state, character, options, env) {
  const { mode, regionId, x, y, terrainType = '.', hazard = 0, spiritDensity = 0 } = options ?? {};
  if (!mode || !FIELD_ACTION_LABELS[mode]) return { error: 'Unknown field action mode.' };

  const currentRegion = state.regionId ?? 'ashen-frontier';
  const currentX = state.tileX ?? 9;
  const currentY = state.tileY ?? 6;
  if ((regionId ?? currentRegion) !== currentRegion || x !== currentX || y !== currentY) {
    return { error: 'You must stand on a tile to work it.' };
  }

  const terrainMap = {
    herbs: ['H', 'F', 'W', 'V', '.'],
    ores: ['K', 'X', 'W'],
    mobs: ['B', 'W', 'F', 'X'],
    relic: ['X', 'K', 'V', '.'],
    spirit: ['V', 'H', 'C', '.']
  };
  if (!terrainMap[mode].includes(terrainType)) {
    return { error: `This tile is not suited for ${FIELD_ACTION_LABELS[mode].toLowerCase()}.` };
  }

  const realmGate = Math.max(0, Math.min(4, Number(hazard || 0) - 2));
  if ((character.realm_index ?? 0) < realmGate) {
    return { error: `This tile pressure is too intense. Reach realm ${realmGate} before working it directly.` };
  }

  const lootTable = getFieldLootTable(mode, terrainType, Number(hazard || 0), Number(spiritDensity || 0));
  const log = [`You ${FIELD_ACTION_LABELS[mode].toLowerCase()} the tile at ${currentX},${currentY}.`];
  const drops = [];

  for (const entry of lootTable) {
    if (Math.random() < entry.chance) {
      const qty = entry.qty[0] + Math.floor(Math.random() * (entry.qty[1] - entry.qty[0] + 1));
      drops.push({ id: entry.id, qty });
      await grantItem(env, character.id, entry.id, qty);
      log.push(`Recovered ${qty}x ${entry.id}.`);
    }
  }

  if (!drops.length) log.push('The run comes up light this cycle.');

  const silverGain = mode === 'mobs'
    ? 4 + Math.floor(Math.random() * (6 + Number(hazard || 0)))
    : 2 + Math.floor(Math.random() * (4 + Number(spiritDensity || 0)));

  const newState = {
    ...state,
    silver: (state.silver ?? 0) + silverGain,
    cultivationXp: (state.cultivationXp ?? 0) + (mode === 'spirit' ? 3 + Number(spiritDensity || 0) : mode === 'herbs' ? 2 : 0),
    bodyXp: (state.bodyXp ?? 0) + (mode === 'ores' ? 2 + Number(hazard || 0) : mode === 'mobs' ? 1 + Number(hazard || 0) : 0),
    battleQi: Math.min(state.battleQiMax ?? state.battleQi ?? 0, (state.battleQi ?? 0) + (mode === 'mobs' ? 4 : 1))
  };

  const worldEventHistory = Array.isArray(state.worldEventHistory) ? [...state.worldEventHistory] : [];
  worldEventHistory.push(`${FIELD_ACTION_LABELS[mode]} run at ${currentX},${currentY}: ${drops.length ? drops.map(drop => `${drop.qty}x ${drop.id}`).join(', ') : 'no material haul'}.`);
  newState.worldEventHistory = worldEventHistory.slice(-12);

  log.push(`+${silverGain} silver.`);

  const cooldownKey = `field:${mode}:${currentRegion}:${currentX}:${currentY}`;
  const cooldownMs = FIELD_ACTION_BASE_MS[mode] + Number(hazard || 0) * 60000;
  return { state: newState, log, drops, cooldownKey, cooldownMs };
}

function getFieldLootTable(mode, terrainType, hazard, spiritDensity) {
  switch (mode) {
    case 'herbs':
      return [
        { id: 'qi-grass', qty: [1, 2 + Math.min(2, spiritDensity)], chance: 0.88 },
        { id: 'dustbloom', qty: [1, 2], chance: 0.45 },
        { id: 'charbloom', qty: [1, 2], chance: terrainType === 'H' || hazard >= 1 ? 0.35 : 0.12 },
        { id: spiritDensity >= 2 ? 'jade-root' : 'cinder-root', qty: [1, 1], chance: 0.22 + Math.min(0.18, spiritDensity * 0.04) },
        { id: 'misty-cap', qty: [1, 1], chance: terrainType === 'F' || terrainType === 'W' ? 0.18 : 0.08 },
        { id: 'heaven-grass', qty: [1, 1], chance: spiritDensity >= 4 ? 0.07 : 0.01 }
      ];
    case 'ores':
      return [
        { id: 'cracked-spirit-stone', qty: [1, 3 + Math.min(2, hazard)], chance: 0.86 },
        { id: 'refined-iron-plate', qty: [1, 2], chance: terrainType === 'K' ? 0.42 : 0.18 },
        { id: 'broken-rune-shard', qty: [1, 1], chance: terrainType === 'X' ? 0.3 : 0.16 },
        { id: 'mid-spirit-stone', qty: [1, 1], chance: hazard >= 2 ? 0.08 : 0.03 }
      ];
    case 'mobs':
      return [
        { id: 'dustrat-fur', qty: [1, 2], chance: 0.78 },
        { id: 'beast-blood-vial', qty: [1, 1], chance: 0.46 },
        { id: terrainType === 'B' || hazard >= 2 ? 'fire-lizard-scale' : 'marshclaw-hide', qty: [1, 2], chance: 0.28 },
        { id: terrainType === 'B' || hazard >= 3 ? 'croc-tooth' : 'marshclaw-hide', qty: [1, 1], chance: 0.16 },
        { id: 'flame-core', qty: [1, 1], chance: hazard >= 3 ? 0.05 : 0.01 },
        { id: 'blazing-blood', qty: [1, 1], chance: hazard >= 4 ? 0.03 : 0.0 }
      ];
    case 'relic':
      return [
        { id: 'low-spirit-stone', qty: [1, 2 + Math.min(2, hazard)], chance: 0.9 },
        { id: 'cracked-spirit-stone', qty: [1, 2], chance: 0.52 },
        { id: 'rusted-talisman', qty: [1, 1], chance: 0.16 },
        { id: 'broken-rune-shard', qty: [1, 1], chance: 0.24 },
        { id: 'ancient-blueprint', qty: [1, 1], chance: hazard >= 2 ? 0.05 : 0.02 },
        { id: 'golem-core', qty: [1, 1], chance: hazard >= 4 ? 0.015 : 0.0 }
      ];
    case 'spirit':
      return [
        { id: 'low-spirit-stone', qty: [1, 1 + Math.min(2, spiritDensity)], chance: 0.82 },
        { id: 'cracked-spirit-stone', qty: [1, 2], chance: 0.38 },
        { id: 'mid-spirit-stone', qty: [1, 1], chance: spiritDensity >= 3 ? 0.12 : 0.04 },
        { id: 'heaven-grass', qty: [1, 1], chance: spiritDensity >= 4 ? 0.06 : 0.0 }
      ];
    default:
      return [];
  }
}

function actionCityAction(state, character, options) {
  const { service } = options ?? {};
  if (!service) return { error: 'service required in options' };
  
  // Service handling for city interactions
  // All city services are now routed through this central handler
  // UI logic determines which action to show based on tile and service
  
  const log = [];
  let stateUpdate = { ...state };
  
  // Parse service name (could be cityId or service name)
  const serviceName = String(service).toLowerCase();
  
  if (serviceName.includes('bank') || serviceName.includes('vault')) {
    log.push('Banking services are now available from the Settlement Dock. Deposits and withdrawals route through the standard vault UI.');
  } else if (serviceName.includes('technique') || serviceName.includes('archive')) {
    log.push('Technique archives are now accessible from the Settlement Dock. Browse and purchase scrolls through the archive interface.');
  } else if (serviceName.includes('patron')) {
    log.push('The patron hall is now accessible from the Settlement Dock. Review faction reputations and active missions.');
  } else {
    // General city affairs
    const cityName = serviceName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    log.push(`Docked at ${cityName}. City services (bank, techniques, patron) are accessible from the Settlement Dock on this tile.`);
    log.push('Local tile exploration is also available—navigate the city mini-map and visit specific quarters for immersive trading and cultural encounters.');
  }
  
  return { state: stateUpdate, log };
}


function actionBattle(state, character, options) {
  const { action: battleAct, enemyId } = options ?? {};
  if (!battleAct) return { error: 'action required in options for battle' };
  // Full battle engine will be ported from main.js in the next phase
  return { state, log: [`Battle action "${battleAct}" against ${enemyId} — full engine pending.`] };
}

// ── Crafting resolution ───────────────────────────────────────

async function resolveCompletedCrafts(env, characterId, state) {
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT * FROM craft_queue WHERE character_id = ?1 AND collected = 0 AND completes_at <= ?2`
  ).bind(characterId, now).all();

  if (!results || results.length === 0) return null;

  const rewards = [];
  for (const craft of results) {
    await grantItem(env, characterId, craft.result_item, craft.result_qty);
    await env.DB.prepare('UPDATE craft_queue SET collected = 1 WHERE id = ?1').bind(craft.id).run();
    rewards.push({ item: craft.result_item, qty: craft.result_qty });
  }

  return { state, rewards };
}

// ── Item grant helper ─────────────────────────────────────────

async function grantItem(env, characterId, templateId, quantity) {
  // Verify template exists
  const template = await env.DB.prepare(
    'SELECT id, stack_max FROM item_templates WHERE id = ?1'
  ).bind(templateId).first();
  if (!template) return; // unknown item — silently skip

  // Try to stack onto existing slot
  const existing = await env.DB.prepare(
    `SELECT id, quantity FROM character_inventory
     WHERE character_id = ?1 AND template_id = ?2 AND equipped_slot IS NULL
     ORDER BY quantity DESC LIMIT 1`
  ).bind(characterId, templateId).first();

  if (existing && existing.quantity < template.stack_max) {
    const newQty = Math.min(template.stack_max, existing.quantity + quantity);
    const overflow = existing.quantity + quantity - template.stack_max;
    await env.DB.prepare('UPDATE character_inventory SET quantity = ?1 WHERE id = ?2')
      .bind(newQty, existing.id).run();
    if (overflow > 0) {
      await env.DB.prepare(
        `INSERT INTO character_inventory (id, character_id, template_id, quantity, obtained_at)
         VALUES (?1, ?2, ?3, ?4, ?5)`
      ).bind(generateUUID(), characterId, templateId, overflow, Date.now()).run();
    }
  } else {
    await env.DB.prepare(
      `INSERT INTO character_inventory (id, character_id, template_id, quantity, obtained_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    ).bind(generateUUID(), characterId, templateId, quantity, Date.now()).run();
  }
}

// ── Initial state builder ─────────────────────────────────────

function buildInitialState(name, origin, path) {
  const originBonuses = {
    'ashen-cultivator': { hpMax: 120, qiMax: 80, bodyXp: 5, soulXp: 0 },
    'verdant-herbalist': { hpMax: 90, qiMax: 100, bodyXp: 0, soulXp: 5 },
    'void-walker':       { hpMax: 85, qiMax: 110, bodyXp: 0, soulXp: 10 },
    'heaven-exile':      { hpMax: 100, qiMax: 120, bodyXp: 0, soulXp: 0 },
    'ancient-remnant':   { hpMax: 110, qiMax: 90, bodyXp: 0, soulXp: 0 },
    'outlander':         { hpMax: 100, qiMax: 100, bodyXp: 0, soulXp: 0 }
  };

  const bonuses = originBonuses[origin] ?? originBonuses['outlander'];

  return {
    name,
    origin,
    path,
    realmIndex: 0,
    stageIndex: 0,
    hp: bonuses.hpMax,
    hpMax: bonuses.hpMax,
    qi: bonuses.qiMax,
    qiMax: bonuses.qiMax,
    battleQi: 30,
    battleQiMax: 30,
    silver: 100,
    longevity: 18,
    longevityMax: 80,
    cultivationXp: bonuses.soulXp,
    bodyXp: bonuses.bodyXp,
    soulXp: bonuses.soulXp,
    fortune: 1,
    soulSense: 1,
    inventory: [],
    techniques: [],
    spirits: { bondedId: null, unlocked: {} },
    companions: [],
    questLog: [],
    discoveredLore: [],
    faction: null,
    sect: null,
    regionId: getStartingRegion(origin),
    cityId: getStartingCity(origin),
    tileX: getStartingTileX(origin),
    tileY: getStartingTileY(origin),
    visitedTiles: buildStartingVisited(getStartingRegion(origin), getStartingTileX(origin), getStartingTileY(origin)),
    goldenFinger: rollGoldenFinger(),
    goldenFingerRevealed: false,
    rivalNpcs: [],
    worldEventHistory: []
  };
}

function getStartingRegion(origin) {
  const map = {
    'ashen-cultivator': 'ashen-frontier',
    'verdant-herbalist': 'jade-delta',
    'void-walker': 'void-rift',
    'heaven-exile': 'celestial-plateau',
    'ancient-remnant': 'sovereign-wastes',
    'outlander': 'ashen-frontier'
  };
  return map[origin] ?? 'ashen-frontier';
}

function getStartingCity(origin) {
  const map = {
    'ashen-cultivator': 'ember',
    'verdant-herbalist': 'jade',
    'void-walker': 'void',
    'heaven-exile': 'starfall',
    'ancient-remnant': 'dao-furnace',
    'outlander': 'ashgate'
  };
  return map[origin] ?? 'ashgate';
}

function getStartingTileX(origin) {
  const map = { 'ashen-cultivator': 4, 'verdant-herbalist': 9, 'void-walker': 9, 'heaven-exile': 9, 'ancient-remnant': 9, 'outlander': 9 };
  return map[origin] ?? 9;
}

function getStartingTileY(origin) {
  const map = { 'ashen-cultivator': 2, 'verdant-herbalist': 6, 'void-walker': 6, 'heaven-exile': 6, 'ancient-remnant': 6, 'outlander': 6 };
  return map[origin] ?? 6;
}

function buildStartingVisited(regionId, cx, cy) {
  const tiles = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      tiles.push(`${regionId}:${cx + dx}:${cy + dy}`);
    }
  }
  return tiles;
}

// Ashen Frontier impassable tiles: border + explicit mountains
function isTileImpassable(regionId, x, y) {
  if (regionId === 'ashen-frontier') {
    if (x <= 0 || x >= 19 || y <= 0 || y >= 14) return true;
  }
  return false;
}

function actionMoveToTile(state, character, options) {
  const { x, y, regionId } = options ?? {};
  if (x == null || y == null) return { error: 'Missing tile coordinates', state };

  const targetRegion = regionId ?? state.regionId ?? 'ashen-frontier';
  const currentX = state.tileX ?? 9;
  const currentY = state.tileY ?? 6;

  // Only same-region movement for now
  if (targetRegion !== (state.regionId ?? 'ashen-frontier')) {
    return { error: 'Cross-region movement not yet implemented', state };
  }

  // Validate adjacency (8-directional, exactly 1 step)
  const dx = Math.abs(x - currentX);
  const dy = Math.abs(y - currentY);
  if ((dx === 0 && dy === 0) || dx > 1 || dy > 1) {
    return { error: 'Can only move one tile at a time', state };
  }

  if (isTileImpassable(targetRegion, x, y)) {
    return { error: 'Impassable terrain', state };
  }

  const newState = { ...state, tileX: x, tileY: y };

  // Reveal new tile + its immediate neighbors in fog-of-war
  const visited = new Set(state.visitedTiles ?? []);
  for (let ny = y - 1; ny <= y + 1; ny++) {
    for (let nx = x - 1; nx <= x + 1; nx++) {
      visited.add(`${targetRegion}:${nx}:${ny}`);
    }
  }
  newState.visitedTiles = [...visited];

  return { state: newState, log: [] };
}

function rollGoldenFinger() {
  const fingers = [
    { id: 'spirit-root-variance', label: 'Spirit Root Variance', revealed: false },
    { id: 'heaven-defying-constitution', label: 'Heaven Defying Constitution', revealed: false },
    { id: 'void-affinity-awakening', label: 'Void Affinity Awakening', revealed: false },
    { id: 'sword-bone', label: 'Sword Bone', revealed: false },
    { id: 'alchemic-soul', label: 'Alchemic Soul', revealed: false },
    { id: 'blood-of-ancient', label: 'Blood of the Ancients', revealed: false },
    { id: 'stargazer-eye', label: 'Stargazer Eye', revealed: false },
    { id: 'void-heart', label: 'Void Heart', revealed: false }
  ];
  return fingers[Math.floor(Math.random() * fingers.length)];
}
