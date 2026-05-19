/**
 * NPC World Tick — runs every 6 hours via Cloudflare Cron trigger
 * Advances NPC cultivation, evaluates ambitions, triggers world events
 */

export async function runWorldTick(env) {
  const tickStart = Date.now();
  console.log(`[world_tick] Starting tick at ${new Date(tickStart).toISOString()}`);

  try {
    await tickNPCs(env);
    await cleanupExpiredEvents(env);
    await incrementGlobalTick(env);
    await cleanupDeletedCharacters(env);

    const elapsed = Date.now() - tickStart;
    console.log(`[world_tick] Completed in ${elapsed}ms`);
  } catch (err) {
    console.error('[world_tick] Error during tick:', err);
  }
}

// ── NPC advancement ───────────────────────────────────────────

async function tickNPCs(env) {
  const { results: npcs } = await env.DB.prepare(
    'SELECT * FROM npc_state'
  ).all();

  for (const npc of npcs) {
    const updated = advanceNPC(npc);
    const triggeredEvent = checkNPCAmbition(updated);

    await env.DB.prepare(
      `UPDATE npc_state
       SET realm_index = ?1, stage_index = ?2, ambition_stage = ?3, memory_json = ?4, last_tick = ?5
       WHERE npc_id = ?6`
    ).bind(
      updated.realm_index,
      updated.stage_index,
      updated.ambition_stage,
      updated.memory_json ?? npc.memory_json,
      Date.now(),
      npc.npc_id
    ).run();

    if (triggeredEvent) {
      await spawnWorldEvent(env, triggeredEvent);
    }
  }
}

function advanceNPC(npc) {
  // Cultivation takes REAL time. Ticks fire every 6h (4/day, ~120/month).
  // Base rate is per-stage. Higher realms get an additional slowdown multiplier
  // so early stages feel active but endgame is truly long-term.
  //
  // Target pacing (for rivals — the fastest-advancing NPCs):
  //   Qi Condensation (0): ~3 weeks per stage
  //   Foundation (1):      ~5 weeks per stage
  //   Core Formation (2):  ~8 weeks per stage
  //   Nascent Soul (3):    ~4 months per stage
  //   Soul Formation (4):  ~8 months per stage
  //   Void Refinement (5): ~18 months per stage
  //   Dao Sovereign (8):   effectively frozen
  //
  // NPC cultivation uses an ACCUMULATOR stored in memory_json.cultivationPts
  // Each tick adds a small float. When it hits 1.0, stage advances and resets.
  // This avoids pure RNG bursts and gives smooth, predictable world pacing.

  let { realm_index, stage_index } = npc;
  const MAX_REALM = 9;
  const STAGES_PER_REALM = 3;
  if (realm_index >= MAX_REALM && stage_index >= STAGES_PER_REALM - 1) {
    return { ...npc }; // already at cap
  }

  // Parse memory_json for accumulator
  let memory = {};
  try { memory = JSON.parse(npc.memory_json ?? '{}'); } catch {}
  let pts = memory.cultivationPts ?? 0;

  // Points earned per tick — base rate × realm penalty
  const baseRate = getNPCBaseRate(npc.template_id);
  const realmPenalty = Math.pow(0.55, realm_index); // each realm ~45% slower than previous
  const gained = baseRate * realmPenalty;
  pts += gained;

  let advanced = false;
  if (pts >= 1.0) {
    pts -= 1.0;
    stage_index++;
    if (stage_index >= STAGES_PER_REALM) {
      stage_index = 0;
      realm_index = Math.min(MAX_REALM, realm_index + 1);
    }
    advanced = true;
  }

  memory.cultivationPts = pts;
  return {
    ...npc,
    realm_index,
    stage_index,
    memory_json: JSON.stringify(memory),
    _advanced: advanced
  };
}

function getNPCBaseRate(templateId) {
  // Base pts per tick at realm 0. Higher realms apply realmPenalty on top.
  // ~3 weeks per stage at realm 0 = 84 ticks → rate = 1/84 ≈ 0.012
  if (templateId.startsWith('rival'))        return 0.012;  // fastest — ~3 weeks/stage at realm 0
  if (templateId.startsWith('city-elder'))   return 0.006;  // ~6 weeks/stage
  if (templateId.startsWith('sect-master'))  return 0.004;  // ~10 weeks/stage
  if (templateId.startsWith('world-figure')) return 0.001;  // essentially static, story-driven only
  return 0.008; // generic NPCs ~5 weeks/stage
}

function checkNPCAmbition(npc) {
  const { ambition_stage, realm_index, npc_id, template_id } = npc;

  // Example: if a rival reaches Core Formation (realm 3), trigger a sect raid event
  if (template_id.startsWith('rival') && realm_index >= 3 && ambition_stage === 0) {
    return {
      type: 'rival-advancement',
      title: 'A Rival Rises',
      description: 'Your rival has reached a new threshold of power and is making moves in the region.',
      npcId: npc_id,
      advanceAmbitionTo: 1
    };
  }

  // If a sect master reaches Soul Formation (realm 5), trigger a sect war
  if (template_id.startsWith('sect-master') && realm_index >= 5 && ambition_stage === 0) {
    return {
      type: 'sect-war',
      title: 'Sect War Declaration',
      description: 'A powerful sect leader has declared war on a rival sect.',
      npcId: npc_id,
      advanceAmbitionTo: 1
    };
  }

  return null;
}

// ── World event spawning ──────────────────────────────────────

async function spawnWorldEvent(env, eventDef) {
  const { createId } = await import('./utils.js').catch(() => ({ createId: () => crypto.randomUUID() }));

  const eventId = crypto.randomUUID();
  const now = Date.now();
  const DURATION_MAP = {
    'rival-advancement': 24 * 60 * 60 * 1000,  // 24h
    'sect-war':          7 * 24 * 60 * 60 * 1000, // 7 days
    'treasure-emergence': 6 * 60 * 60 * 1000,   // 6h
    'planar-bleed':      48 * 60 * 60 * 1000,   // 48h
  };

  const duration = DURATION_MAP[eventDef.type] ?? 24 * 60 * 60 * 1000;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO world_events
     (id, type, title, description, started_at, ends_at, resolved, data_json)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)`
  ).bind(
    eventId,
    eventDef.type,
    eventDef.title,
    eventDef.description,
    now,
    now + duration,
    JSON.stringify({ npcId: eventDef.npcId ?? null })
  ).run();

  console.log(`[world_tick] Spawned event: ${eventDef.type} — "${eventDef.title}"`);
}

// ── Event cleanup ─────────────────────────────────────────────

async function cleanupExpiredEvents(env) {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE world_events SET resolved = 1, outcome = 'expired'
     WHERE resolved = 0 AND ends_at IS NOT NULL AND ends_at < ?1`
  ).bind(now).run();
}

// ── Soft-deleted character cleanup (72h grace period) ─────────

async function cleanupDeletedCharacters(env) {
  const graceMs = 72 * 60 * 60 * 1000;
  const cutoff = Date.now() - graceMs;

  // Get characters past grace period
  const { results } = await env.DB.prepare(
    `SELECT id FROM characters WHERE is_deleted = 1 AND deleted_at < ?1`
  ).bind(cutoff).all();

  for (const char of results) {
    // character_state has ON DELETE CASCADE, so this cleans up state too
    await env.DB.prepare('DELETE FROM characters WHERE id = ?1').bind(char.id).run();
    console.log(`[world_tick] Permanently deleted character ${char.id}`);
  }
}

// ── Global tick counter ───────────────────────────────────────

async function incrementGlobalTick(env) {
  const current = await env.DB.prepare(
    `SELECT value_json FROM world_state WHERE key = 'global_tick'`
  ).first();

  const data = current ? JSON.parse(current.value_json) : { tick: 0, era: 'First Era' };
  data.tick++;

  await env.DB.prepare(
    `UPDATE world_state SET value_json = ?1, updated_at = ?2 WHERE key = 'global_tick'`
  ).bind(JSON.stringify(data), Date.now()).run();
}
