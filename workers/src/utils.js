/**
 * Shared utilities for all Workers handlers
 */

export function generateUUID() {
  // Use crypto.randomUUID() — available in Workers runtime
  return crypto.randomUUID();
}

export function corsHeaders(request) {
  const origin = request?.headers?.get('Origin') ?? '*';
  // In production, restrict to your actual Pages domain
  // e.g. 'https://sealed-heavens.pages.dev'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie'
  };
}

export function json(data, status = 200, request = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request)
    }
  });
}

/**
 * Reads the sh_session cookie, validates it against KV,
 * and returns the full account row or null.
 */
export async function getSessionAccount(request, env) {
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(/sh_session=([^;]+)/);
  if (!match) return null;

  const tokenId = match[1];
  const sessionData = await env.SESSIONS.get(`session:${tokenId}`, { type: 'json' });
  if (!sessionData || Date.now() > sessionData.expires_at) return null;

  const account = await env.DB.prepare(
    'SELECT id, username, email, admin_level, is_banned, ban_reason FROM accounts WHERE id = ?1'
  ).bind(sessionData.account_id).first();

  return account ?? null;
}

/**
 * Gets the active character for an account from request header or query param.
 * Clients send X-Character-Id header or ?characterId= query param.
 */
export async function getActiveCharacter(request, env, account) {
  const url = new URL(request.url);
  const characterId =
    request.headers.get('X-Character-Id') ??
    url.searchParams.get('characterId');

  if (!characterId) return null;

  const character = await env.DB.prepare(
    `SELECT * FROM characters WHERE id = ?1 AND account_id = ?2 AND is_deleted = 0`
  ).bind(characterId, account.id).first();

  return character ?? null;
}

/**
 * Gets or initializes a character's game state JSON.
 */
export async function getCharacterState(env, characterId) {
  const row = await env.DB.prepare(
    'SELECT state_json FROM character_state WHERE character_id = ?1'
  ).bind(characterId).first();

  if (!row) return null;
  try { return JSON.parse(row.state_json); } catch { return {}; }
}

/**
 * Saves a character's game state JSON.
 */
export async function saveCharacterState(env, characterId, state) {
  await env.DB.prepare(
    `INSERT INTO character_state (character_id, state_json, updated_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(character_id) DO UPDATE SET state_json = ?2, updated_at = ?3`
  ).bind(characterId, JSON.stringify(state), Date.now()).run();
}

/**
 * Checks an action cooldown in KV. Returns ms remaining, or 0 if not on cooldown.
 */
export async function getCooldownRemaining(env, characterId, actionKey) {
  const key = `cd:${characterId}:${actionKey}`;
  const data = await env.COOLDOWNS.get(key, { type: 'json' });
  if (!data) return 0;
  const remaining = data.ready_at - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Sets an action cooldown in KV.
 * durationMs: how long the cooldown lasts
 */
export async function setCooldown(env, characterId, actionKey, durationMs) {
  const key = `cd:${characterId}:${actionKey}`;
  const readyAt = Date.now() + durationMs;
  await env.COOLDOWNS.put(key, JSON.stringify({ ready_at: readyAt }), {
    expirationTtl: Math.ceil(durationMs / 1000) + 60
  });
}

/**
 * Non-blocking audit log insert.
 */
export async function auditLog(env, { accountId, characterId, adminId, action, data, ip }) {
  env.DB.prepare(
    `INSERT INTO audit_log (account_id, character_id, admin_id, action, data_json, ip_address, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(
    accountId ?? null,
    characterId ?? null,
    adminId ?? null,
    action,
    JSON.stringify(data ?? {}),
    ip ?? 'unknown',
    Date.now()
  ).run().catch(err => console.error('audit log error:', err));
}
