/**
 * Admin handler — feature tracker, NPC viewer, world control, player management
 * Requires account.admin_level >= 1 (checked in index.js before reaching here)
 */
import { json, auditLog } from './utils.js';

export async function handleAdmin(request, env, account, path) {
  const method = request.method;

  // ── Feature tracker ─────────────────────────────────────────
  if (path === '/api/admin/features' && method === 'GET') {
    return getFeatures(env, request);
  }
  if (path === '/api/admin/features' && method === 'POST') {
    return upsertFeature(request, env, account);
  }

  // ── Player / character management (admin_level >= 2) ─────────
  if (path.startsWith('/api/admin/players')) {
    if (account.admin_level < 2) return json({ error: 'Forbidden' }, 403, request);
    return handlePlayerAdmin(request, env, account, path);
  }

  // ── World event control (admin_level >= 2) ───────────────────
  if (path.startsWith('/api/admin/events')) {
    if (account.admin_level < 2) return json({ error: 'Forbidden' }, 403, request);
    return handleEventAdmin(request, env, account, path);
  }

  // ── Content tooling (admin_level >= 2) ──────────────────────
  if (path.startsWith('/api/admin/content')) {
    if (account.admin_level < 2) return json({ error: 'Forbidden' }, 403, request);
    return handleContentAdmin(request, env, account, path);
  }

  // ── NPC state viewer ─────────────────────────────────────────
  if (path === '/api/admin/npcs' && method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT npc_id, template_id, realm_index, stage_index, ambition_stage, faction_id, last_tick
       FROM npc_state ORDER BY realm_index DESC, stage_index DESC LIMIT 100`
    ).all();
    return json({ npcs: results }, 200, request);
  }

  // ── Audit log ─────────────────────────────────────────────────
  if (path === '/api/admin/audit' && method === 'GET') {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') ?? '0');
    const { results } = await env.DB.prepare(
      `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?1 OFFSET ?2`
    ).bind(limit, offset).all();
    return json({ log: results }, 200, request);
  }

  // ── Stats overview ────────────────────────────────────────────
  if (path === '/api/admin/stats' && method === 'GET') {
    return getDashboardStats(env, request);
  }

  return json({ error: 'Not found' }, 404, request);
}

// ── Feature tracker ───────────────────────────────────────────

async function getFeatures(env, request) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM feature_tracker ORDER BY
       CASE priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
       CASE status WHEN 'broken' THEN 0 WHEN 'needs-work' THEN 1 WHEN 'in-progress' THEN 2
                   WHEN 'not-started' THEN 3 WHEN 'complete' THEN 4 ELSE 5 END`
  ).all();
  return json({ features: results }, 200, request);
}

async function upsertFeature(request, env, account) {
  if (account.admin_level < 2) return json({ error: 'Forbidden' }, 403, request);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, request); }

  const { feature_key, title, status, completion, severity, priority, notes, blockers, depends_on } = body;
  if (!feature_key || !title) return json({ error: 'feature_key and title required' }, 400, request);

  await env.DB.prepare(
    `INSERT INTO feature_tracker
       (feature_key, title, status, completion, severity, priority, notes, blockers_json, depends_on_json, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT(feature_key) DO UPDATE SET
       title = ?2, status = ?3, completion = ?4, severity = ?5,
       priority = ?6, notes = ?7, blockers_json = ?8, depends_on_json = ?9, updated_at = ?10`
  ).bind(
    feature_key, title,
    status ?? 'not-started',
    completion ?? 0,
    severity ?? 'medium',
    priority ?? 'p2',
    notes ?? null,
    JSON.stringify(blockers ?? []),
    JSON.stringify(depends_on ?? []),
    Date.now()
  ).run();

  await auditLog(env, { adminId: account.id, action: 'upsert_feature', data: { feature_key, status, completion } });

  return json({ ok: true }, 200, request);
}

// ── Player admin ──────────────────────────────────────────────

async function handlePlayerAdmin(request, env, account, path) {
  const method = request.method;

  // GET /api/admin/players?q=username
  if (path === '/api/admin/players' && method === 'GET') {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const { results } = await env.DB.prepare(
      `SELECT id, username, email, admin_level, is_banned, created_at, last_login
       FROM accounts WHERE username LIKE ?1 OR email LIKE ?1 LIMIT 20`
    ).bind(`%${q}%`).all();
    return json({ players: results }, 200, request);
  }

  // POST /api/admin/players/ban
  if (path === '/api/admin/players/ban' && method === 'POST') {
    if (account.admin_level < 3) return json({ error: 'Superadmin required to ban accounts' }, 403, request);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, request); }
    const { accountId, reason } = body;
    if (!accountId) return json({ error: 'accountId required' }, 400, request);

    await env.DB.prepare(
      'UPDATE accounts SET is_banned = 1, ban_reason = ?1 WHERE id = ?2'
    ).bind(reason ?? 'Suspended by admin', accountId).run();

    await auditLog(env, { adminId: account.id, accountId, action: 'ban_account', data: { reason } });
    return json({ ok: true }, 200, request);
  }

  return json({ error: 'Not found' }, 404, request);
}

// ── World event admin ─────────────────────────────────────────

async function handleEventAdmin(request, env, account, path) {
  const method = request.method;

  // POST /api/admin/events — create a manual world event
  if (path === '/api/admin/events' && method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, request); }

    const { type, title, description, duration_hours, affected_region } = body;
    if (!type || !title || !description) {
      return json({ error: 'type, title, and description required' }, 400, request);
    }

    const now = Date.now();
    const endsAt = duration_hours ? now + duration_hours * 3600000 : null;
    const eventId = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO world_events (id, type, title, description, affected_region, started_at, ends_at, resolved, data_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, '{}')`
    ).bind(eventId, type, title, description, affected_region ?? null, now, endsAt).run();

    await auditLog(env, { adminId: account.id, action: 'create_world_event', data: { type, title, eventId } });
    return json({ ok: true, eventId }, 201, request);
  }

  // DELETE /api/admin/events/:id — resolve/end an event early
  const resolveMatch = path.match(/^\/api\/admin\/events\/([^/]+)$/);
  if (resolveMatch && method === 'DELETE') {
    const eventId = resolveMatch[1];
    await env.DB.prepare(
      `UPDATE world_events SET resolved = 1, outcome = 'admin-ended', ends_at = ?1 WHERE id = ?2`
    ).bind(Date.now(), eventId).run();
    await auditLog(env, { adminId: account.id, action: 'end_world_event', data: { eventId } });
    return json({ ok: true }, 200, request);
  }

  return json({ error: 'Not found' }, 404, request);
}

// ── Content admin ────────────────────────────────────────────

async function handleContentAdmin(request, env, account, path) {
  const method = request.method;

  if (path === '/api/admin/content/items' && method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT id, name, item_type, rarity, realm_req, stack_max, is_tradeable, base_stats, data_json
       FROM item_templates
       ORDER BY name ASC
       LIMIT 150`
    ).all();
    return json({ items: results || [] }, 200, request);
  }

  if (path === '/api/admin/content/items' && method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, request); }

    const id = String(body.id || '').trim();
    const name = String(body.name || '').trim();
    const itemType = String(body.item_type || body.itemType || '').trim();
    if (!id || !name || !itemType) {
      return json({ error: 'id, name, and item_type are required' }, 400, request);
    }

    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO item_templates
         (id, name, description, item_type, rarity, realm_req, path_affinity, stack_max, is_tradeable, base_stats, crafting_ingredients, data_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         item_type = excluded.item_type,
         rarity = excluded.rarity,
         realm_req = excluded.realm_req,
         path_affinity = excluded.path_affinity,
         stack_max = excluded.stack_max,
         is_tradeable = excluded.is_tradeable,
         base_stats = excluded.base_stats,
         crafting_ingredients = excluded.crafting_ingredients,
         data_json = excluded.data_json`
    ).bind(
      id,
      name,
      body.description ?? null,
      itemType,
      body.rarity ?? 'common',
      Number(body.realm_req ?? 0),
      body.path_affinity ?? null,
      Math.max(1, Number(body.stack_max ?? 1)),
      Number(body.is_tradeable ?? 1) ? 1 : 0,
      safeJsonString(body.base_stats, {}),
      safeJsonString(body.crafting_ingredients, []),
      safeJsonString({ ...(body.data_json || {}), updated_at: now }, {})
    ).run();

    await auditLog(env, { adminId: account.id, action: 'upsert_item_template', data: { id, name, itemType } });
    return json({ ok: true, id }, 200, request);
  }

  const deleteItemMatch = path.match(/^\/api\/admin\/content\/items\/([^/]+)$/);
  if (deleteItemMatch && method === 'DELETE') {
    const id = decodeURIComponent(deleteItemMatch[1]);
    await env.DB.prepare('DELETE FROM item_templates WHERE id = ?1').bind(id).run();
    await auditLog(env, { adminId: account.id, action: 'delete_item_template', data: { id } });
    return json({ ok: true }, 200, request);
  }

  if (path === '/api/admin/content/nodes' && method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT zn.id, zn.zone_id, z.name AS zone_name, zn.name, zn.node_type, zn.realm_req, zn.respawn_hours, zn.loot_table, zn.data_json
       FROM zone_nodes zn
       LEFT JOIN zones z ON z.id = zn.zone_id
       ORDER BY z.name ASC, zn.name ASC
       LIMIT 180`
    ).all();
    return json({ nodes: results || [] }, 200, request);
  }

  if (path === '/api/admin/content/nodes' && method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, request); }

    const id = String(body.id || '').trim();
    const zoneId = String(body.zone_id || body.zoneId || '').trim();
    const name = String(body.name || '').trim();
    const nodeType = String(body.node_type || body.nodeType || '').trim();
    if (!id || !zoneId || !name || !nodeType) {
      return json({ error: 'id, zone_id, name, and node_type are required' }, 400, request);
    }

    await env.DB.prepare(
      `INSERT INTO zone_nodes
         (id, zone_id, name, node_type, realm_req, respawn_hours, loot_table, npc_ids, data_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(id) DO UPDATE SET
         zone_id = excluded.zone_id,
         name = excluded.name,
         node_type = excluded.node_type,
         realm_req = excluded.realm_req,
         respawn_hours = excluded.respawn_hours,
         loot_table = excluded.loot_table,
         npc_ids = excluded.npc_ids,
         data_json = excluded.data_json`
    ).bind(
      id,
      zoneId,
      name,
      nodeType,
      Number(body.realm_req ?? 0),
      Math.max(1, Number(body.respawn_hours ?? 6)),
      safeJsonString(body.loot_table, []),
      safeJsonString(body.npc_ids, []),
      safeJsonString(body.data_json, {})
    ).run();

    await auditLog(env, { adminId: account.id, action: 'upsert_zone_node', data: { id, zoneId, nodeType } });
    return json({ ok: true, id }, 200, request);
  }

  const deleteNodeMatch = path.match(/^\/api\/admin\/content\/nodes\/([^/]+)$/);
  if (deleteNodeMatch && method === 'DELETE') {
    const id = decodeURIComponent(deleteNodeMatch[1]);
    await env.DB.prepare('DELETE FROM zone_nodes WHERE id = ?1').bind(id).run();
    await auditLog(env, { adminId: account.id, action: 'delete_zone_node', data: { id } });
    return json({ ok: true }, 200, request);
  }

  return json({ error: 'Not found' }, 404, request);
}

function safeJsonString(value, fallback) {
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(fallback);
    }
  }
  if (value == null) return JSON.stringify(fallback);
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(fallback);
  }
}

// ── Dashboard stats ───────────────────────────────────────────

async function getDashboardStats(env, request) {
  const [accountCount, charCount, activeEvents, featureSummary] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as n FROM accounts WHERE is_banned = 0').first(),
    env.DB.prepare('SELECT COUNT(*) as n FROM characters WHERE is_deleted = 0').first(),
    env.DB.prepare('SELECT COUNT(*) as n FROM world_events WHERE resolved = 0').first(),
    env.DB.prepare(
      `SELECT status, COUNT(*) as n FROM feature_tracker GROUP BY status`
    ).all()
  ]);

  return json({
    accounts: accountCount?.n ?? 0,
    characters: charCount?.n ?? 0,
    active_events: activeEvents?.n ?? 0,
    features: featureSummary.results
  }, 200, request);
}
