/**
 * Game handlers — characters, state, actions
 */

import {
  json, corsHeaders, generateUUID, auditLog,
  getActiveCharacter, getCharacterState, saveCharacterState,
  getCooldownRemaining, setCooldown
} from './utils.js';

// ── Action cooldowns (milliseconds) ──────────────────────────
const COOLDOWNS = {
  meditate:   15 * 60 * 1000,  // 15 min
  trainBody:  20 * 60 * 1000,  // 20 min
  trainSoul:  20 * 60 * 1000,  // 20 min
  explore:    10 * 60 * 1000,  // 10 min
  craft:      20 * 60 * 1000,  // 20 min
  cityAction:  5 * 60 * 1000,  // 5 min
  battle:      2 * 60 * 1000,  // 2 min (between battles)
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

  const state = await getCharacterState(env, character.id);
  if (!state) return json({ error: 'Character state not found' }, 404, request);

  // Attach cooldown info
  const cooldownKeys = Object.keys(COOLDOWNS);
  const cooldowns = {};
  await Promise.all(cooldownKeys.map(async k => {
    cooldowns[k] = await getCooldownRemaining(env, character.id, k);
  }));

  // Update last_active
  env.DB.prepare('UPDATE characters SET last_active = ?1 WHERE id = ?2')
    .bind(Date.now(), character.id).run().catch(() => {});

  return json({ ok: true, state, cooldowns, character: {
    id: character.id,
    name: character.name,
    origin: character.origin,
    path: character.path,
    realm_index: character.realm_index,
    stage_index: character.stage_index
  }}, 200, request);
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
      return json({
        error: 'Action on cooldown',
        cooldown_ms: remaining,
        ready_at: Date.now() + remaining
      }, 429, request);
    }
  }

  // Load state
  const state = await getCharacterState(env, character.id);
  if (!state) return json({ error: 'Character state not found' }, 404, request);

  // Dispatch action
  let result;
  switch (action) {
    case 'meditate':    result = actionMeditate(state, options);   break;
    case 'trainBody':   result = actionTrainBody(state, options);  break;
    case 'trainSoul':   result = actionTrainSoul(state, options);  break;
    case 'explore':     result = actionExplore(state, options);    break;
    case 'cityAction':  result = actionCityAction(state, options); break;
    case 'battleAction': result = actionBattle(state, options);    break;
    default:
      return json({ error: `Unknown action: ${action}` }, 400, request);
  }

  if (result.error) return json({ error: result.error }, 400, request);

  // Save updated state
  await saveCharacterState(env, character.id, result.state);

  // Update realm/stage on characters table if changed
  if (result.state.realmIndex !== character.realm_index ||
      result.state.stageIndex !== character.stage_index) {
    await env.DB.prepare(
      'UPDATE characters SET realm_index = ?1, stage_index = ?2, last_active = ?3 WHERE id = ?4'
    ).bind(result.state.realmIndex ?? 0, result.state.stageIndex ?? 0, Date.now(), character.id).run();
  }

  // Set cooldown if action has one
  if (COOLDOWNS[action]) {
    await setCooldown(env, character.id, action, COOLDOWNS[action]);
  }

  return json({ ok: true, result: result.log, state: result.state }, 200, request);
}

// ── Action handlers (server-authoritative game logic) ─────────

function actionMeditate(state, options) {
  const qi = state.qi ?? 0;
  const qiMax = state.qiMax ?? 100;
  const cultivationXp = state.cultivationXp ?? 0;
  const xpGain = 10 + Math.floor(Math.random() * 6); // 10–15 base
  return {
    state: { ...state, qi: Math.min(qiMax, qi + 20), cultivationXp: cultivationXp + xpGain },
    log: [`You meditate deeply. Qi replenished. Cultivation XP +${xpGain}.`]
  };
}

function actionTrainBody(state, options) {
  const bodyXp = state.bodyXp ?? 0;
  const xpGain = 8 + Math.floor(Math.random() * 8);
  const hp = state.hp ?? 100;
  const hpMax = state.hpMax ?? 100;
  return {
    state: { ...state, bodyXp: bodyXp + xpGain, hp: Math.min(hpMax, hp + 5) },
    log: [`Body refinement session complete. Body XP +${xpGain}.`]
  };
}

function actionTrainSoul(state, options) {
  const soulXp = state.soulXp ?? 0;
  const xpGain = 8 + Math.floor(Math.random() * 8);
  const battleQi = state.battleQi ?? 0;
  const battleQiMax = state.battleQiMax ?? 50;
  return {
    state: { ...state, soulXp: soulXp + xpGain, battleQi: Math.min(battleQiMax, battleQi + 10) },
    log: [`Soul cultivation session complete. Soul XP +${xpGain}.`]
  };
}

function actionExplore(state, options) {
  // Server-side basic explore — full logic will expand with area events system
  const { areaId } = options ?? {};
  if (!areaId) return { error: 'areaId required in options' };

  const silver = state.silver ?? 0;
  const silverGain = 5 + Math.floor(Math.random() * 20);
  const log = [`You explore ${areaId}. Gained ${silverGain} silver.`];

  return {
    state: { ...state, silver: silver + silverGain },
    log
  };
}

function actionCityAction(state, options) {
  const { service } = options ?? {};
  if (!service) return { error: 'service required in options' };

  // Stub — full city service logic will be ported from main.js
  return {
    state,
    log: [`City service "${service}" — full implementation pending.`]
  };
}

function actionBattle(state, options) {
  const { action: battleAct, enemyId } = options ?? {};
  if (!battleAct) return { error: 'action required in options for battle' };

  // Stub — full battle engine will be ported from main.js
  return {
    state,
    log: [`Battle action "${battleAct}" against ${enemyId} — full battle engine pending.`]
  };
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
