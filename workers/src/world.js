/**
 * World event handler — public read endpoints
 */
import { json, getActiveCharacter } from './utils.js';

export async function handleWorldEvents(request, env, account, path) {
  // GET /api/world/events — list active world events
  if (path === '/api/world/events' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT id, type, title, description, affected_region, started_at, ends_at, data_json
       FROM world_events WHERE resolved = 0
       ORDER BY started_at DESC LIMIT 50`
    ).all();
    return json({ events: results }, 200, request);
  }

  // GET /api/world/history — recent resolved events
  if (path === '/api/world/history' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT id, type, title, description, started_at, ends_at, outcome
       FROM world_events WHERE resolved = 1
       ORDER BY ends_at DESC LIMIT 30`
    ).all();
    return json({ history: results }, 200, request);
  }

  // POST /api/world/events/:id/participate — join an event
  const participateMatch = path.match(/^\/api\/world\/events\/([^/]+)\/participate$/);
  if (participateMatch && request.method === 'POST') {
    return participateInEvent(request, env, account, participateMatch[1]);
  }

  return json({ error: 'Not found' }, 404, request);
}

async function participateInEvent(request, env, account, eventId) {
  const character = await getActiveCharacter(request, env, account);
  if (!character) return json({ error: 'No active character' }, 400, request);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const { factionSide } = body;

  const event = await env.DB.prepare(
    `SELECT * FROM world_events WHERE id = ?1 AND resolved = 0`
  ).bind(eventId).first();

  if (!event) return json({ error: 'Event not found or already resolved' }, 404, request);

  await env.DB.prepare(
    `INSERT INTO event_participation (event_id, character_id, faction_side, contribution)
     VALUES (?1, ?2, ?3, 1)
     ON CONFLICT(event_id, character_id) DO UPDATE SET
       contribution = contribution + 1,
       faction_side = COALESCE(?3, faction_side)`
  ).bind(eventId, character.id, factionSide ?? null).run();

  return json({ ok: true, message: 'Participation recorded.' }, 200, request);
}
