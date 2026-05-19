/**
 * Game handlers — characters, state, actions, zones, AFK
 */

import {
  json, generateUUID, auditLog,
  getActiveCharacter, getCharacterState, saveCharacterState,
  getCooldownRemaining, setCooldown
} from './utils.js';

// ── Action cooldowns (milliseconds) ──────────────────────────
const COOLDOWNS = {
  meditate:      15 * 60 * 1000,  // 15 min
  trainBody:     20 * 60 * 1000,  // 20 min
  trainSoul:     20 * 60 * 1000,  // 20 min
  exploreNode:    8 * 60 * 1000,  // 8 min per-node
  cityAction:     5 * 60 * 1000,  // 5 min
  battleAction:   2 * 60 * 1000,  // 2 min between fights
  craft:         20 * 60 * 1000,  // 20 min manual craft check
};

// AFK caps per realm (ms). Players can queue up to this long offline.
const AFK_CAPS_MS = [
   4 * 60 * 60 * 1000,  // 0 Qi Condensation — 4h
   6 * 60 * 60 * 1000,  // 1 Foundation — 6h
   8 * 60 * 60 * 1000,  // 2 Core Formation — 8h
  10 * 60 * 60 * 1000,  // 3 Nascent Soul — 10h
  12 * 60 * 60 * 1000,  // 4 Soul Formation — 12h
  16 * 60 * 60 * 1000,  // 5 Void Refinement — 16h
  20 * 60 * 60 * 1000,  // 6+ — 20h
];

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

  // Resolve any pending AFK rewards before sending state to client
  const afkResult = await resolveAfkIfDue(env, character, state);
  if (afkResult) {
    state = afkResult.state;
    await saveCharacterState(env, character.id, state);
  }

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

  // Update last_active
  env.DB.prepare('UPDATE characters SET last_active = ?1 WHERE id = ?2')
    .bind(Date.now(), character.id).run().catch(() => {});

  return json({
    ok: true,
    state,
    cooldowns,
    afkRewards: afkResult?.rewards ?? null,
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

// ── Game actions ──────────────────────────────────────────────

export async function handleGameAction(request, env, account) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);

  const character = await getActiveCharacter(request, env, account);
  if (!character) return json({ error: 'No active character. Send X-Character-Id header.' }, 400, request);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, request); }

  const { action, options } = body;
  if (!action) return json({ error: 'action is required' }, 400, request);

  // Check cooldown
  if (COOLDOWNS[action] !== undefined) {
    const remaining = await getCooldownRemaining(env, character.id, action);
    if (remaining > 0) {
      return json({ error: 'Action on cooldown', cooldown_ms: remaining, ready_at: Date.now() + remaining }, 429, request);
    }
  }

  let state = await getCharacterState(env, character.id);
  if (!state) return json({ error: 'Character state not found' }, 404, request);

  let result;
  switch (action) {
    case 'meditate':      result = actionMeditate(state, character, options);     break;
    case 'trainBody':     result = actionTrainBody(state, character, options);    break;
    case 'trainSoul':     result = actionTrainSoul(state, character, options);    break;
    case 'exploreNode':   result = await actionExploreNode(state, character, options, env); break;
    case 'cityAction':    result = actionCityAction(state, character, options);   break;
    case 'battleAction':  result = actionBattle(state, character, options);       break;
    case 'setAfk':        result = await actionSetAfk(state, character, options, env); break;
    case 'cancelAfk':     result = await actionCancelAfk(state, character, env); break;
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

  return json({ ok: true, result: result.log, state: result.state }, 200, request);
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

// ── AFK routes ────────────────────────────────────────────────

export async function handleAfk(request, env, account, path) {
  const character = await getActiveCharacter(request, env, account);
  if (!character) return json({ error: 'No active character' }, 400, request);

  if (path === '/api/afk' && request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT * FROM afk_queue WHERE character_id = ?1'
    ).bind(character.id).first();
    if (!row) return json({ active: false }, 200, request);
    const elapsed = Date.now() - row.started_at;
    const remaining = Math.max(0, row.max_duration - elapsed);
    return json({ active: true, action_type: row.action_type, zone_id: row.zone_id, elapsed_ms: elapsed, remaining_ms: remaining }, 200, request);
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

function actionCityAction(state, character, options) {
  const { service } = options ?? {};
  if (!service) return { error: 'service required in options' };
  return { state, log: [`City service "${service}" — full implementation pending.`] };
}

function actionBattle(state, character, options) {
  const { action: battleAct, enemyId } = options ?? {};
  if (!battleAct) return { error: 'action required in options for battle' };
  // Full battle engine will be ported from main.js in the next phase
  return { state, log: [`Battle action "${battleAct}" against ${enemyId} — full engine pending.`] };
}

async function actionSetAfk(state, character, options, env) {
  const { actionType, zoneId } = options ?? {};
  const VALID_AFK = ['meditate', 'patrol-zone', 'herb-gather', 'spirit-stone-mine', 'alchemy-study', 'guard-post'];
  if (!VALID_AFK.includes(actionType)) {
    return { error: `Invalid AFK action. Valid: ${VALID_AFK.join(', ')}` };
  }
  if (actionType === 'patrol-zone' && !zoneId) {
    return { error: 'zoneId required for patrol-zone AFK' };
  }

  const realmIndex = character.realm_index ?? 0;
  const capMs = AFK_CAPS_MS[Math.min(realmIndex, AFK_CAPS_MS.length - 1)];

  await env.DB.prepare(
    `INSERT INTO afk_queue (character_id, action_type, zone_id, started_at, max_duration, data_json)
     VALUES (?1, ?2, ?3, ?4, ?5, '{}')
     ON CONFLICT(character_id) DO UPDATE SET
       action_type = ?2, zone_id = ?3, started_at = ?4, max_duration = ?5`
  ).bind(character.id, actionType, zoneId ?? null, Date.now(), capMs).run();

  const capHours = Math.floor(capMs / 3600000);
  return {
    state: { ...state, afkActive: true, afkType: actionType },
    log: [`AFK mode set: ${actionType}. You'll earn rewards for up to ${capHours} hours while offline.`]
  };
}

async function actionCancelAfk(state, character, env) {
  await env.DB.prepare('DELETE FROM afk_queue WHERE character_id = ?1').bind(character.id).run();
  return {
    state: { ...state, afkActive: false, afkType: null },
    log: ['AFK mode cancelled.']
  };
}

// ── AFK reward resolution (called on login) ───────────────────

async function resolveAfkIfDue(env, character, state) {
  const row = await env.DB.prepare(
    'SELECT * FROM afk_queue WHERE character_id = ?1'
  ).bind(character.id).first();

  if (!row) return null;

  const now = Date.now();
  const elapsed = Math.min(now - row.started_at, row.max_duration);
  if (elapsed < 60000) return null; // less than 1 min — don't bother

  const hours = elapsed / 3600000;
  const realmMult = 1 + (character.realm_index ?? 0) * 0.3;
  const rewards = computeAfkRewards(row.action_type, hours, realmMult);

  // Apply rewards to state
  let newState = { ...state };
  for (const [key, val] of Object.entries(rewards.statDeltas)) {
    newState[key] = (newState[key] ?? 0) + val;
  }

  // Grant item drops
  for (const drop of rewards.itemDrops) {
    await grantItem(env, character.id, drop.id, drop.qty);
  }

  // Clear or reset AFK queue
  await env.DB.prepare('DELETE FROM afk_queue WHERE character_id = ?1').bind(character.id).run();
  newState.afkActive = false;
  newState.afkType = null;

  return { state: newState, rewards };
}

function computeAfkRewards(actionType, hours, realmMult) {
  const base = {
    statDeltas: {},
    itemDrops: [],
    summary: []
  };

  switch (actionType) {
    case 'meditate': {
      const xp = Math.floor(hours * 20 * realmMult);
      const qi = Math.floor(hours * 15 * realmMult);
      base.statDeltas = { cultivationXp: xp, qi };
      base.summary.push(`Meditation: +${xp} Cultivation XP, +${qi} Qi.`);
      break;
    }
    case 'herb-gather': {
      const numHerbs = Math.floor(hours * 3 * realmMult);
      if (numHerbs > 0) {
        base.itemDrops.push({ id: 'qi-grass', qty: numHerbs });
        // Small chance at rarer herbs
        if (Math.random() < hours * 0.05) base.itemDrops.push({ id: 'dustbloom', qty: 1 });
      }
      base.summary.push(`Herb gathering: found ${numHerbs}x Qi Grass.`);
      break;
    }
    case 'spirit-stone-mine': {
      const stones = Math.floor(hours * 2 * realmMult);
      const silver = Math.floor(hours * 5 * realmMult);
      base.itemDrops.push({ id: 'cracked-spirit-stone', qty: Math.max(1, stones) });
      base.statDeltas = { silver };
      base.summary.push(`Mining: +${stones} Spirit Stones, +${silver} silver.`);
      break;
    }
    case 'alchemy-study': {
      const xp = Math.floor(hours * 15 * realmMult);
      base.statDeltas = { alchemyXp: xp };
      base.summary.push(`Alchemy study: +${xp} Alchemy XP.`);
      break;
    }
    case 'patrol-zone': {
      const silver = Math.floor(hours * 8 * realmMult);
      const bodyXp = Math.floor(hours * 6 * realmMult);
      base.statDeltas = { silver, bodyXp };
      // Small chance at beast drops
      if (Math.random() < hours * 0.1) base.itemDrops.push({ id: 'dustrat-fur', qty: 1 });
      base.summary.push(`Patrol: +${silver} silver, +${bodyXp} Body XP.`);
      break;
    }
    case 'guard-post': {
      const silver = Math.floor(hours * 12 * realmMult);
      base.statDeltas = { silver };
      base.summary.push(`Guard duty: +${silver} silver.`);
      break;
    }
  }
  return base;
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
    longevity: 80,
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
