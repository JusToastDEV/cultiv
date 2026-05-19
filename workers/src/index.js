/**
 * Sealed Heavens API — Main Router
 *
 * Routes:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   POST /api/auth/logout
 *   GET  /api/auth/session
 *   GET  /api/account
 *   GET  /api/characters
 *   POST /api/characters
 *   DELETE /api/characters/:slot
 *   GET  /api/game/state
 *   POST /api/game/action
 *   GET  /api/zones
 *   GET  /api/zones/:id
 *   GET  /api/inventory
 *   GET  /api/world/events
 *   GET  /api/world/history
 *   POST /api/world/events/:id/participate
 *   GET  /api/admin/*  (admin_level >= 1 required)
 */

import { handleAuth, handleAccountInfo } from './auth.js';
import { handleCharacters, handleGameState, handleGameAction, handleZones, handleInventory } from './game.js';
import { handleWorldEvents } from './world.js';
import { handleAdmin } from './admin.js';
import { getSessionAccount, corsHeaders } from './utils.js';

export default {
  // Main fetch handler
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    try {
      // ── Auth routes (no session required) ──────────────────
      if (path.startsWith('/api/auth/')) {
        return await handleAuth(request, env, path);
      }

      // ── Account info (session required, handled separately) ─
      if (path === '/api/account' && request.method === 'GET') {
        return await handleAccountInfo(request, env);
      }

      // ── Static assets — serve directly, no auth required ───
      if (!path.startsWith('/api/')) {
        if (env.ASSETS) {
          const assetResp = await env.ASSETS.fetch(request);
          if (assetResp.status !== 404) return assetResp;
          const isAssetLikePath = path.startsWith('/.') || /\/[^/]+\.[^/]+$/.test(path);
          if (isAssetLikePath) {
            return json({ error: 'Not found' }, 404, request);
          }
          return env.ASSETS.fetch(new URL('/', request.url).toString());
        }
        return json({ error: 'Not found' }, 404, request);
      }

      // ── All other API routes require a valid session ────────
      const account = await getSessionAccount(request, env);
      if (!account) {
        return json({ error: 'Unauthorized' }, 401, request);
      }
      if (account.is_banned) {
        return json({ error: 'Account suspended', reason: account.ban_reason }, 403, request);
      }

      // ── Character management ────────────────────────────────
      if (path.startsWith('/api/characters')) {
        return await handleCharacters(request, env, account, path);
      }

      // ── Game state + actions ────────────────────────────────
      if (path === '/api/game/state') {
        return await handleGameState(request, env, account);
      }
      if (path === '/api/game/action') {
        return await handleGameAction(request, env, account);
      }

      // ── Zone exploration ────────────────────────────────────
      if (path.startsWith('/api/zones')) {
        return await handleZones(request, env, account, path);
      }

      // ── Inventory ───────────────────────────────────────────
      if (path.startsWith('/api/inventory')) {
        return await handleInventory(request, env, account, path);
      }

      // ── World events ────────────────────────────────────────
      if (path.startsWith('/api/world/')) {
        return await handleWorldEvents(request, env, account, path);
      }

      // ── Admin routes (admin_level >= 1) ─────────────────────
      if (path.startsWith('/api/admin/')) {
        if (account.admin_level < 1) {
          return json({ error: 'Forbidden' }, 403, request);
        }
        return await handleAdmin(request, env, account, path);
      }

      // Unrecognized API route
      return json({ error: 'Not found' }, 404, request);
    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'Internal server error' }, 500, request);
    }
  },

  // Cron handler — NPC world tick
  async scheduled(event, env, ctx) {
    const { runWorldTick } = await import('./world_tick.js');
    ctx.waitUntil(runWorldTick(env));
  }
};

function json(data, status = 200, request = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(request ? corsHeaders(request) : {})
  };
  return new Response(JSON.stringify(data), { status, headers });
}
