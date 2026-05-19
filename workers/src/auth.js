/**
 * Auth handlers — register, login, logout, session check
 * Uses Web Crypto API (scrypt not available in Workers; using PBKDF2 instead)
 * Session tokens stored in KV with 30-day TTL
 */

import { corsHeaders, generateUUID, auditLog } from './utils.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LOGIN_RATE_LIMIT_MAX = 10;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function handleAuth(request, env, path) {
  const method = request.method;

  if (path === '/api/auth/register' && method === 'POST') {
    return register(request, env);
  }
  if (path === '/api/auth/login' && method === 'POST') {
    return login(request, env);
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    return logout(request, env);
  }
  if (path === '/api/auth/session' && method === 'GET') {
    return sessionCheck(request, env);
  }

  return json({ error: 'Not found' }, 404, request);
}

// ── Register ──────────────────────────────────────────────────
async function register(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, request); }

  const { username, email, password } = body;

  // Validate inputs
  if (!username || !email || !password) {
    return json({ error: 'username, email, and password are required' }, 400, request);
  }
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    return json({ error: 'Username must be 3–24 alphanumeric characters or underscores' }, 400, request);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address' }, 400, request);
  }
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters' }, 400, request);
  }

  // Check for existing username/email
  const existing = await env.DB.prepare(
    'SELECT id FROM accounts WHERE username = ?1 OR email = ?2'
  ).bind(username, email.toLowerCase()).first();

  if (existing) {
    return json({ error: 'Username or email already in use' }, 409, request);
  }

  // Hash password with PBKDF2
  const passwordHash = await hashPassword(password);
  const accountId = generateUUID();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO accounts (id, username, email, password_hash, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(accountId, username, email.toLowerCase(), passwordHash, now).run();

  await auditLog(env, { accountId, action: 'register', data: { username }, ip: getIP(request) });

  // Issue session immediately
  const token = await issueSession(env, accountId, request);
  return json({ ok: true, username, accountId }, 201, request, token);
}

// ── Login ─────────────────────────────────────────────────────
async function login(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, request); }

  const { email, password } = body;
  if (!email || !password) {
    return json({ error: 'email and password are required' }, 400, request);
  }

  // Rate limiting via KV
  const ip = getIP(request);
  const rateLimitKey = `rl:login:${ip}`;
  const rlData = await env.SESSIONS.get(rateLimitKey, { type: 'json' });
  const attempts = rlData?.attempts ?? 0;
  if (attempts >= LOGIN_RATE_LIMIT_MAX) {
    return json({ error: 'Too many login attempts. Try again in 15 minutes.' }, 429, request);
  }

  const account = await env.DB.prepare(
    'SELECT * FROM accounts WHERE email = ?1'
  ).bind(email.toLowerCase()).first();

  if (!account || !(await verifyPassword(password, account.password_hash))) {
    // Increment rate limit counter
    await env.SESSIONS.put(rateLimitKey, JSON.stringify({ attempts: attempts + 1 }), {
      expirationTtl: Math.ceil(LOGIN_RATE_LIMIT_WINDOW_MS / 1000)
    });
    return json({ error: 'Invalid email or password' }, 401, request);
  }

  // Clear rate limit on success
  await env.SESSIONS.delete(rateLimitKey);

  // Update last_login
  await env.DB.prepare('UPDATE accounts SET last_login = ?1 WHERE id = ?2')
    .bind(Date.now(), account.id).run();

  await auditLog(env, { accountId: account.id, action: 'login', ip });

  const token = await issueSession(env, account.id, request);
  return json({
    ok: true,
    username: account.username,
    accountId: account.id,
    adminLevel: account.admin_level
  }, 200, request, token);
}

// ── Logout ────────────────────────────────────────────────────
async function logout(request, env) {
  const tokenId = getTokenFromCookie(request);
  if (tokenId) {
    await env.SESSIONS.delete(`session:${tokenId}`);
  }
  const headers = {
    'Content-Type': 'application/json',
    ...corsHeaders(request),
    'Set-Cookie': `sh_session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`
  };
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

// ── Session check ─────────────────────────────────────────────
async function sessionCheck(request, env) {
  const tokenId = getTokenFromCookie(request);
  if (!tokenId) return json({ authenticated: false }, 200, request);

  const sessionData = await env.SESSIONS.get(`session:${tokenId}`, { type: 'json' });
  if (!sessionData || Date.now() > sessionData.expires_at) {
    return json({ authenticated: false }, 200, request);
  }

  const account = await env.DB.prepare(
    'SELECT id, username, admin_level, is_banned FROM accounts WHERE id = ?1'
  ).bind(sessionData.account_id).first();

  if (!account) return json({ authenticated: false }, 200, request);

  return json({
    authenticated: true,
    accountId: account.id,
    username: account.username,
    adminLevel: account.admin_level
  }, 200, request);
}

// ── Helpers ───────────────────────────────────────────────────

async function issueSession(env, accountId, request) {
  // 64-byte random token (128 hex chars) — more entropy than UUID
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  const tokenId = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = Date.now() + SESSION_TTL_MS;

  await env.SESSIONS.put(`session:${tokenId}`, JSON.stringify({
    account_id: accountId,
    expires_at: expiresAt,
    created_at: Date.now()
  }), { expirationTtl: Math.ceil(SESSION_TTL_MS / 1000) });

  // Also insert into sessions audit table (non-blocking)
  const ip = getIP(request);
  const ua = request.headers.get('User-Agent') ?? '';
  env.DB.prepare(
    `INSERT INTO sessions (token_id, account_id, created_at, expires_at, ip_address, user_agent)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(tokenId, accountId, Date.now(), expiresAt, ip, ua).run().catch(() => {});

  return tokenId;
}

function json(data, status, request, sessionToken) {
  const headers = {
    'Content-Type': 'application/json',
    ...corsHeaders(request)
  };
  if (sessionToken) {
    headers['Set-Cookie'] =
      `sh_session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Path=/`;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function getTokenFromCookie(request) {
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(/sh_session=([^;]+)/);
  return match ? match[1] : null;
}

function getIP(request) {
  return request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
}

// ── Password hashing with PBKDF2 (Web Crypto, available in Workers) ──
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 10_000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 10_000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const candidate = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  // Constant-time comparison to prevent timing attacks
  let diff = 0;
  const a = candidate, b = hashHex;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
  }
  return diff === 0;
}
