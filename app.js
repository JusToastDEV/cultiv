/**
 * app.js — Sealed Heavens API-connected frontend
 * Handles auth, character select, game state polling, and all server-side features.
 * Runs AFTER main.js; bridges the existing game engine with the live backend.
 */

const LIVE_WORKER_ORIGIN = 'https://cultiv.davidmergenthaler02.workers.dev';
const OFFLINE_QUERY_PARAM = 'offline';

const API = (() => {
  const BASE = ''; // same-origin
  const OFFLINE_HINT = 'Live auth is unavailable here. Use the deployed site for account play, or use offline mode from this page.';

  async function call(method, path, body) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    if (window._activeCharId) opts.headers['X-Character-Id'] = window._activeCharId;
    try {
      const res = await fetch(BASE + path, opts);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (error) {
      const isFileMode = window.location.protocol === 'file:';
      return {
        ok: false,
        status: 0,
        data: {
          error: isFileMode ? OFFLINE_HINT : 'Network error. Please try again.'
        },
        networkError: error
      };
    }
  }

  return {
    get:    (p)    => call('GET', p),
    post:   (p, b) => call('POST', p, b),
    delete: (p)    => call('DELETE', p)
  };
})();

// ── State ──────────────────────────────────────────────────────
let _account = null;
let _character = null;
let _gameState = null;
let _cooldowns = {};
let _afkStatus = null;
let _pollTimer = null;
let _offlineSyncTimer = null;
let _cdAnimFrames = {};
let _offlineMode = false;

// Realm names for display
const REALM_NAMES = [
  'Qi Condensation', 'Foundation Establishment', 'Core Formation',
  'Nascent Soul', 'Soul Formation', 'Void Refinement',
  'Body Integration', 'Mahayana', 'Tribulation Transcendence'
];
const STAGE_NAMES = [
  'Early Stage', 'Mid Stage', 'Late Stage', 'Peak Stage'
];

// ── Bootstrap ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setupAuthUI();
  setupNavigation();
  setupSidebarToggle();
  setupTopbarActions();
  setupCultivatePanel();
  setupAFKPanel();
  setupAdminPanel();
  setupExplorePanel();

  if (shouldBootOfflineMode()) {
    enterOfflineMode();
    return;
  }

  // Check for existing session
  tryAutoLogin();
});

// ── Auth UI ────────────────────────────────────────────────────
function setupAuthUI() {
  // Tab switching
  document.getElementById('auth-tab-login').addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('auth-tab-register').addEventListener('click', () => switchAuthTab('register'));

  // Login form
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;
    setAuthError('login', '');
    const r = await API.post('/api/auth/login', { identifier, password });
    if (r.ok) {
      _account = r.data;
      await enterGame();
    } else {
      setAuthError('login', getAuthFailureMessage(r, 'Login failed'));
    }
  });

  // Register form
  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    setAuthError('register', '');
    const r = await API.post('/api/auth/register', { username, email, password });
    if (r.ok) {
      _account = r.data;
      await enterGame();
    } else {
      setAuthError('register', getAuthFailureMessage(r, 'Registration failed'));
    }
  });

  // Offline play link
  document.getElementById('play-offline-link').addEventListener('click', e => {
    e.preventDefault();
    const offlineUrl = new URL(window.location.href);
    offlineUrl.searchParams.set(OFFLINE_QUERY_PARAM, '1');
    window.history.replaceState({}, '', offlineUrl.toString());
    enterOfflineMode();
  });

  // Logout buttons
  document.getElementById('char-select-logout').addEventListener('click', signOut);
  document.getElementById('topbar-logout').addEventListener('click', signOut);
}

function switchAuthTab(tab) {
  document.getElementById('auth-tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('auth-tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

function setAuthError(form, msg) {
  document.getElementById(`${form}-error`).textContent = msg;
}

function getAuthFailureMessage(response, fallback) {
  if (response?.data?.error) {
    return response.data.error;
  }
  if (response?.status === 404 && !isLiveWorkerOrigin()) {
    return `This page is not running on the live worker origin. Use ${LIVE_WORKER_ORIGIN} for account play, or use offline mode here.`;
  }
  if (response?.status === 404) {
    return 'Live API is unavailable on this deployment right now. Refresh in a moment or use offline mode.';
  }
  if (response?.status === 0) {
    return response?.data?.error || fallback;
  }
  if (response?.status) {
    return `${fallback} (HTTP ${response.status})`;
  }
  return fallback;
}

function shouldBootOfflineMode() {
  const url = new URL(window.location.href);
  return url.searchParams.get(OFFLINE_QUERY_PARAM) === '1';
}

function isLiveWorkerOrigin() {
  return window.location.origin === LIVE_WORKER_ORIGIN;
}

function enterOfflineMode() {
  _offlineMode = true;
  _account = { username: 'Guest' };
  _afkStatus = null;
  window._activeCharId = null;
  stopPolling();
  startOfflineSync();
  setAuthError('login', '');
  setAuthError('register', '');
  showScreen('game');
  activatePanel('cultivate');
  updateTopbarLogoutLabel();
  showToast('Guest mode active. Progress stays in this browser until you sign into a live account.', 'warn');

  const url = new URL(window.location.href);
  if (url.searchParams.get(OFFLINE_QUERY_PARAM) === '1') {
    url.searchParams.delete(OFFLINE_QUERY_PARAM);
    window.history.replaceState({}, '', url.toString());
  }
}

function startOfflineSync() {
  stopOfflineSync();
  syncOfflineBridge();
  _offlineSyncTimer = setInterval(syncOfflineBridge, 500);
}

function stopOfflineSync() {
  if (_offlineSyncTimer) {
    clearInterval(_offlineSyncTimer);
    _offlineSyncTimer = null;
  }
}

function syncOfflineBridge() {
  const localState = window.state;
  if (!localState) return false;

  const realmIndex = Number(localState.realmIndex ?? 0);
  const stageIndex = Number(localState.stageIndex ?? 0);
  const xpThreshold = 100 + realmIndex * 50 + stageIndex * 20;

  _character = {
    name: getOfflineCharacterName(localState),
    realm_index: realmIndex,
    stage_index: stageIndex,
    origin: 'Guest Mode'
  };
  _gameState = {
    hp: Number(localState.hp ?? 0),
    hpMax: Math.max(1, Number(localState.hpMax ?? 1)),
    qi: Number(localState.qi ?? 0),
    qiMax: Math.max(1, Number(localState.qiMax ?? 1)),
    battleQi: Number(localState.battleQi ?? 0),
    battleQiMax: Math.max(1, Number(localState.battleQiMax ?? 1)),
    silver: Number(localState.wallet ?? 0),
    cultivationXp: Math.min(xpThreshold, Number(localState.turn ?? 0)),
    afkActive: false
  };
  _cooldowns = {};

  renderAll();

  const breakthroughDesc = document.getElementById('breakthrough-desc');
  if (breakthroughDesc) {
    breakthroughDesc.textContent = 'Guest mode uses your local prototype save. Actions here stay on this browser and do not hit the live service.';
  }

  const activeActionNote = document.getElementById('active-action-note');
  if (activeActionNote) {
    activeActionNote.textContent = 'Guest mode active. Use this to test flows without a live account.';
  }

  return true;
}

function getOfflineCharacterName(localState) {
  const name = typeof localState?.playerName === 'string' ? localState.playerName.trim() : '';
  return name || 'Guest Disciple';
}

function updateTopbarLogoutLabel() {
  const logoutBtn = document.getElementById('topbar-logout');
  if (logoutBtn) logoutBtn.textContent = _offlineMode ? 'Exit Guest' : 'Logout';
}

async function tryAutoLogin() {
  if (window.location.protocol === 'file:') {
    showScreen('auth');
    setAuthError('login', 'Local file mode only supports offline play. Use the link below to test the game without the API.');
    return;
  }

  const r = await API.get('/api/auth/session');
  if (r.ok && r.data.authenticated) {
    _account = r.data;
    await enterGame();
  } else {
    if (r.status === 404) {
      setAuthError('login', getAuthFailureMessage(r, 'Live API is not responding on this deployment yet. The game needs a fresh worker deploy.'));
    }
    showScreen('auth');
  }
}

// ── Enter game flow ────────────────────────────────────────────
async function enterGame() {
  // Load characters
  const r = await API.get('/api/characters');
  if (!r.ok) {
    showScreen('auth');
    return;
  }
  const chars = r.data.characters || [];
  showCharacterSelect(chars);
}

function showCharacterSelect(chars) {
  showScreen('charSelect');
  const container = document.getElementById('char-select-slots');
  container.innerHTML = '';

  const slots = [1, 2, 3];
  slots.forEach(slot => {
    const existing = chars.find(c => c.slot === slot);
    const card = document.createElement('div');
    card.className = 'char-slot-card';

    if (existing) {
      const realm = REALM_NAMES[existing.realm_index] ?? 'Unknown Realm';
      card.innerHTML = `
        <div class="char-slot-info">
          <strong>${escHtml(existing.name)}</strong>
          <span class="char-slot-realm">${realm}</span>
          <span class="char-slot-origin">${escHtml(existing.origin || '')}</span>
        </div>
        <button class="btn-primary" data-char-id="${existing.id}" data-slot="${slot}">Enter</button>
        <button class="btn-ghost btn-sm char-delete-btn" data-char-id="${existing.id}" data-slot="${slot}">Delete</button>
      `;
    } else {
      card.innerHTML = `
        <div class="char-slot-info">
          <span class="char-slot-empty">— Empty Slot ${slot} —</span>
        </div>
        <button class="btn-ghost btn-create" data-slot="${slot}">Create Character</button>
      `;
    }

    container.appendChild(card);
  });

  // Enter character
  container.querySelectorAll('[data-char-id]').forEach(btn => {
    if (!btn.classList.contains('char-delete-btn')) {
      btn.addEventListener('click', () => selectCharacter(btn.dataset.charId));
    }
  });

  // Delete character
  container.querySelectorAll('.char-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this character? It will be removed in 72 hours.')) return;
      const r = await API.delete(`/api/characters/${btn.dataset.slot}`);
      if (r.ok) enterGame();
    });
  });

  // Create new character — delegates to main.js character creation overlay
  container.querySelectorAll('.btn-create').forEach(btn => {
    btn.addEventListener('click', () => {
      window._pendingCharSlot = btn.dataset.slot;
      // main.js handles the creation overlay; after creation, we refresh
      const overlay = document.getElementById('character-creation-overlay');
      if (overlay) {
        overlay.classList.remove('hidden');
        if (typeof initCreationFlow === 'function') initCreationFlow();
      } else {
        alert('Character creation UI not loaded yet.');
      }
    });
  });
}

async function selectCharacter(charId) {
  window._activeCharId = charId;
  const r = await API.get('/api/game/state');
  if (!r.ok) {
    alert('Could not load character state: ' + (r.data.error || 'Unknown error'));
    return;
  }
  _character = r.data.character;
  _gameState  = r.data.state;
  _cooldowns  = r.data.cooldowns || {};

  // Show AFK rewards if any came back on login
  if (r.data.afkRewards) showAfkRewards(r.data.afkRewards);
  if (r.data.craftRewards?.length) showCraftRewards(r.data.craftRewards);

  showScreen('game');
  updateTopbarLogoutLabel();
  renderAll();
  startPolling();
  checkAdminAccess();
}

async function signOut() {
  if (_offlineMode) {
    _offlineMode = false;
    stopOfflineSync();
    _account = _character = _gameState = null;
    window._activeCharId = null;
    updateTopbarLogoutLabel();
    showScreen('auth');
    return;
  }

  await API.post('/api/auth/logout');
  _account = _character = _gameState = null;
  window._activeCharId = null;
  stopPolling();
  stopOfflineSync();
  updateTopbarLogoutLabel();
  showScreen('auth');
}

// ── Screen management ──────────────────────────────────────────
function showScreen(screen) {
  document.getElementById('auth-overlay').classList.toggle('hidden', screen !== 'auth');
  document.getElementById('char-select-overlay').classList.toggle('hidden', screen !== 'charSelect');
  document.getElementById('game-shell').classList.toggle('hidden', screen !== 'game');
}

// ── Navigation ─────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const panelId = item.dataset.panel;
      activatePanel(panelId);
      // Close sidebar on mobile
      if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });
}

function activatePanel(panelId) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.panel === panelId));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${panelId}`));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('hidden', p.id !== `panel-${panelId}`));
  // Lazy-load panel data
  if (panelId === 'explore' && _character) loadZones();
  if (panelId === 'inventory') loadInventory();
  if (panelId === 'afk') loadAfkStatus();
  if (panelId === 'admin') loadAdminFeatures();
}

function setupSidebarToggle() {
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

// ── Top bar actions ────────────────────────────────────────────
function setupTopbarActions() {
  // Map button in old nav
  const mapBtn = document.getElementById('open-map');
  if (mapBtn) mapBtn.addEventListener('click', () => document.getElementById('map-modal')?.classList.remove('hidden'));
  const closeMap = document.getElementById('close-map');
  if (closeMap) closeMap.addEventListener('click', () => document.getElementById('map-modal')?.classList.add('hidden'));
}

// ── Polling ────────────────────────────────────────────────────
function startPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(pollState, 30000); // every 30s
  pollState();
}

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

async function pollState() {
  if (!window._activeCharId || _offlineMode) return;
  const r = await API.get('/api/game/state');
  if (!r.ok) return;
  _gameState  = r.data.state;
  _character  = r.data.character;
  _cooldowns  = r.data.cooldowns || {};
  if (r.data.afkRewards) showAfkRewards(r.data.afkRewards);
  renderAll();
  updateCooldownBars();
}

// ── Render ─────────────────────────────────────────────────────
function renderAll() {
  if (!_gameState || !_character) return;
  renderTopBar();
  renderCultivatePanel();
  renderAfkBadge();
}

function renderTopBar() {
  const s = _gameState;
  const c = _character;
  document.getElementById('tb-char-name').textContent = c.name;
  const realmName = REALM_NAMES[c.realm_index] ?? `Realm ${c.realm_index}`;
  document.getElementById('tb-realm').textContent = realmName;

  setBar('tb-hp-fill', s.hp, s.hpMax);
  setBar('tb-qi-fill', s.qi, s.qiMax);
  setBar('tb-bqi-fill', s.battleQi, s.battleQiMax);
  document.getElementById('tb-hp').textContent  = `${s.hp}/${s.hpMax}`;
  document.getElementById('tb-qi').textContent  = `${s.qi}/${s.qiMax}`;
  document.getElementById('tb-bqi').textContent = `${s.battleQi}/${s.battleQiMax}`;
  document.getElementById('tb-silver').textContent = `💰 ${s.silver ?? 0} silver`;
}

function renderCultivatePanel() {
  const s = _gameState;
  const c = _character;
  const realmName  = REALM_NAMES[c.realm_index]  ?? `Realm ${c.realm_index}`;
  const stageName  = STAGE_NAMES[c.stage_index]  ?? `Stage ${c.stage_index}`;
  document.getElementById('cult-realm-label').textContent = `${realmName} · ${stageName}`;
  document.getElementById('profile-realm-label').textContent = `${realmName} · ${stageName}`;
  document.getElementById('profile-name').textContent = c.name;

  // XP bar
  const xpThreshold = 100 + c.realm_index * 50 + c.stage_index * 20;
  const xp = s.cultivationXp ?? 0;
  document.getElementById('cult-xp-val').textContent = `${xp} / ${xpThreshold}`;
  document.getElementById('cult-xp-fill').style.width = `${Math.min(100, (xp / xpThreshold) * 100).toFixed(1)}%`;
  document.getElementById('cult-realm-label').textContent = `${realmName} · ${stageName}`;

  updateCooldownBars();
}

function updateCooldownBars() {
  const actionMap = { meditate: 'meditate', trainBody: 'trainBody', trainSoul: 'trainSoul' };
  const maxMs = { meditate: 15 * 60000, trainBody: 20 * 60000, trainSoul: 20 * 60000 };

  for (const [action, key] of Object.entries(actionMap)) {
    const remaining = _cooldowns[key] ?? 0;
    const max = maxMs[action];
    const pct = remaining > 0 ? Math.min(100, (remaining / max) * 100) : 0;
    const bar  = document.getElementById(`cd-${action}`);
    const btn  = document.getElementById(`btn-${action}`);
    if (bar) bar.style.width = `${100 - pct}%`;
    if (btn) {
      btn.disabled = remaining > 0;
      btn.textContent = remaining > 0 ? `${action} (${msToMin(remaining)})` : action.charAt(0).toUpperCase() + action.slice(1);
    }
    // Count-down animation
    if (remaining > 0) startCdCountdown(action, remaining);
  }
}

function startCdCountdown(action, remaining) {
  if (_cdAnimFrames[action]) cancelAnimationFrame(_cdAnimFrames[action]);
  const deadline = Date.now() + remaining;
  const maxMs = { meditate: 15 * 60000, trainBody: 20 * 60000, trainSoul: 20 * 60000 }[action] ?? 60000;

  function tick() {
    const left = Math.max(0, deadline - Date.now());
    const pct = (left / maxMs) * 100;
    const bar = document.getElementById(`cd-${action}`);
    const btn = document.getElementById(`btn-${action}`);
    if (bar) bar.style.width = `${100 - pct}%`;
    if (btn) {
      btn.disabled = left > 0;
      btn.textContent = left > 0
        ? `${action.charAt(0).toUpperCase() + action.slice(1)} (${msToMin(left)})`
        : action.charAt(0).toUpperCase() + action.slice(1);
    }
    if (left > 0) _cdAnimFrames[action] = requestAnimationFrame(tick);
    else { delete _cdAnimFrames[action]; pollState(); }
  }
  _cdAnimFrames[action] = requestAnimationFrame(tick);
}

function renderAfkBadge() {
  const badge = document.getElementById('tb-afk-badge');
  const navBadge = document.getElementById('afk-nav-badge');
  const active = _gameState?.afkActive;
  badge?.classList.toggle('hidden', !active);
  navBadge?.classList.toggle('hidden', !active);
}

function setBar(id, val, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.min(100, Math.max(0, (val / max) * 100)).toFixed(1)}%`;
}

function msToMin(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Cultivate panel actions ────────────────────────────────────
function setupCultivatePanel() {
  ['meditate', 'trainBody', 'trainSoul'].forEach(action => {
    document.getElementById(`btn-${action}`)?.addEventListener('click', () => doAction(action));
  });
  document.getElementById('btn-breakthrough')?.addEventListener('click', () => doAction('breakthrough'));

  // Legacy buttons in other panels
  document.querySelectorAll('[data-action="meditate"]').forEach(b => b.addEventListener('click', () => doAction('meditate')));
  document.querySelectorAll('[data-action="trainBody"]').forEach(b => b.addEventListener('click', () => doAction('trainBody')));
  document.querySelectorAll('[data-action="trainSoul"]').forEach(b => b.addEventListener('click', () => doAction('trainSoul')));
}

async function doAction(action, options = {}) {
  if (_offlineMode || !window._activeCharId) return;

  const r = await API.post('/api/game/action', { action, options });
  if (!r.ok) {
    if (r.status === 429) {
      const secs = Math.ceil((r.data.cooldown_ms || 0) / 1000);
      showToast(`On cooldown — ${msToMin(r.data.cooldown_ms || 0)} remaining.`, 'warn');
    } else {
      showToast(r.data.error || 'Action failed.', 'error');
    }
    return;
  }

  _gameState  = r.data.state;
  _cooldowns  = r.data.cooldowns ?? _cooldowns;

  // Update cooldown for this specific action
  if (r.data.cooldown_ms !== undefined) _cooldowns[action] = r.data.cooldown_ms;

  renderAll();
  appendToLog((r.data.result || []).join(' '));
  showToast((r.data.result || ['Done.']).join(' '), 'ok');

  // Also update the legacy event log if it exists
  const legacyLog = document.getElementById('event-log');
  if (legacyLog) {
    const li = document.createElement('li');
    li.textContent = (r.data.result || []).join(' ');
    legacyLog.prepend(li);
    while (legacyLog.children.length > 20) legacyLog.lastElementChild.remove();
  }
}

function appendToLog(text) {
  const log = document.getElementById('event-log');
  if (!log) return;
  const li = document.createElement('li');
  li.textContent = text;
  log.prepend(li);
  while (log.children.length > 30) log.lastElementChild.remove();
}

// ── Zone Explore panel ─────────────────────────────────────────
function setupExplorePanel() {
  // Node exploration happens dynamically via loadZones → renderZoneDetail → click
}

async function loadZones() {
  if (_offlineMode || !_character) return;
  const r = await API.get('/api/zones');
  if (!r.ok) return;

  const list = document.getElementById('zone-list');
  if (!list) return;
  list.innerHTML = '';

  const realmLabel = document.getElementById('explore-realm-label');
  if (realmLabel) {
    const realmName = REALM_NAMES[_character.realm_index] ?? 'Unknown';
    realmLabel.textContent = `${realmName} — ${(r.data.zones || []).length} zones accessible`;
  }

  (r.data.zones || []).forEach(zone => {
    const card = document.createElement('div');
    card.className = 'zone-card';
    const dangerClass = zone.danger_level >= 7 ? 'danger-high' : zone.danger_level >= 4 ? 'danger-mid' : 'danger-low';
    card.innerHTML = `
      <div class="zone-card-name">${escHtml(zone.name)}</div>
      <div class="zone-card-meta">
        <span class="zone-type">${escHtml(zone.zone_type || '')}</span>
        <span class="zone-danger ${dangerClass}">⚠ Danger ${zone.danger_level}</span>
      </div>
      <div class="zone-card-desc text-muted">${escHtml(zone.description || '')}</div>
    `;
    card.addEventListener('click', () => loadZoneDetail(zone));
    list.appendChild(card);
  });
}

async function loadZoneDetail(zone) {
  const r = await API.get(`/api/zones/${zone.id}`);
  const card = document.getElementById('zone-detail-card');
  if (!card) return;

  if (!r.ok) { card.innerHTML = `<p class="text-muted">Could not load zone details.</p>`; return; }

  const nodes = r.data.nodes || [];
  card.innerHTML = `
    <h3>${escHtml(zone.name)}</h3>
    <p class="text-muted">${escHtml(zone.description || '')}</p>
    <p><strong>${nodes.length}</strong> Points of Interest</p>
    <div class="node-list" id="node-list-${zone.id}"></div>
  `;

  const nodeContainer = document.getElementById(`node-list-${zone.id}`);
  nodes.forEach(node => {
    const discovered = node.discovered;
    const lastLooted = node.last_looted;
    const respawnMs = (node.respawn_hours || 4) * 3600000;
    const onCooldown = lastLooted && (Date.now() - lastLooted < respawnMs);
    const remaining  = onCooldown ? respawnMs - (Date.now() - lastLooted) : 0;

    const el = document.createElement('div');
    el.className = `node-card ${onCooldown ? 'node-cd' : ''}`;
    el.innerHTML = `
      <div class="node-name">${discovered ? escHtml(node.name) : '??? Unknown'}</div>
      <div class="node-meta">
        <span class="node-type">${escHtml(node.node_type || '')}</span>
        <span class="node-realm">Realm ${node.realm_req}+</span>
      </div>
      ${onCooldown
        ? `<div class="node-cd-label">Respawning in ${msToMin(remaining)}</div>`
        : `<button class="btn-sm btn-primary node-explore-btn" data-node-id="${node.id}">Explore</button>`
      }
    `;

    if (!onCooldown) {
      el.querySelector('.node-explore-btn')?.addEventListener('click', () => exploreNode(node.id, zone.id));
    }
    nodeContainer.appendChild(el);
  });
}

async function exploreNode(nodeId, zoneId) {
  const r = await API.post('/api/game/action', { action: 'exploreNode', options: { nodeId, zoneId } });
  if (!r.ok) {
    showToast(r.data.error || 'Exploration failed.', 'error');
    return;
  }
  _gameState = r.data.state;
  renderAll();
  const drops = (r.data.result || []).join('\n');
  showToast(drops || 'Explored!', 'ok');
  // Refresh zone detail
  loadZones();
}

// ── Inventory ──────────────────────────────────────────────────
async function loadInventory() {
  if (_offlineMode || !_character) return;
  const r = await API.get('/api/inventory');
  if (!r.ok) return;

  const grid = document.getElementById('inventory-grid');
  const count = document.getElementById('inv-count');
  if (!grid) return;

  const items = r.data.inventory || [];
  if (count) count.textContent = `${items.length} items`;

  grid.innerHTML = '';
  if (items.length === 0) {
    grid.innerHTML = '<p class="text-muted">No items in inventory.</p>';
    return;
  }

  items.forEach(item => {
    const slot = document.createElement('div');
    slot.className = `inv-item rarity-${item.rarity || 'common'}`;
    slot.title = item.name;
    slot.innerHTML = `
      <div class="inv-item-name">${escHtml(item.name)}</div>
      <div class="inv-item-qty">×${item.quantity}</div>
    `;
    slot.addEventListener('click', () => showItemDetail(item));
    grid.appendChild(slot);
  });
}

function showItemDetail(item) {
  const detail = document.getElementById('inventory-detail-popover');
  if (!detail) return;
  detail.innerHTML = `
    <h4>${escHtml(item.name)} <span class="rarity-badge rarity-${item.rarity}">${item.rarity}</span></h4>
    <p class="text-muted">${escHtml(item.item_type || '')}</p>
    <p>Quantity: <strong>${item.quantity}</strong></p>
    ${item.base_stats ? `<p>Stats: ${escHtml(JSON.stringify(item.base_stats))}</p>` : ''}
    ${item.enhancement ? `<p>Enhancement: +${item.enhancement}</p>` : ''}
  `;
}

// ── AFK Panel ──────────────────────────────────────────────────
function setupAFKPanel() {
  document.getElementById('btn-start-afk')?.addEventListener('click', startAfk);
  document.getElementById('btn-cancel-afk')?.addEventListener('click', cancelAfk);
}

async function loadAfkStatus() {
  if (_offlineMode || !_character) return;
  const r = await API.get('/api/afk');
  if (!r.ok) return;
  _afkStatus = r.data;
  renderAfkPanel();
}

function renderAfkPanel() {
  const display = document.getElementById('afk-status-display');
  const cancelBtn = document.getElementById('btn-cancel-afk');
  const pickerCard = document.getElementById('afk-picker-card');
  if (!display) return;

  if (_afkStatus?.active) {
    const elapsed = _afkStatus.elapsed_ms || 0;
    const remaining = _afkStatus.remaining_ms || 0;
    display.innerHTML = `
      <div class="afk-active-info">
        <strong>${escHtml(_afkStatus.action_type)}</strong>
        <br>Running for <strong>${msToMin(elapsed)}</strong>
        <br>Remaining: <strong>${remaining > 0 ? msToMin(remaining) : 'Capped — collect on next login'}</strong>
      </div>
    `;
    display.className = 'afk-status-active';
    if (cancelBtn) cancelBtn.style.display = '';
    if (pickerCard) pickerCard.classList.add('hidden');
  } else {
    display.textContent = 'No active offline task.';
    display.className = 'afk-status-idle';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (pickerCard) pickerCard.classList.remove('hidden');
  }

  // Update cap note
  const capNote = document.getElementById('afk-cap-note');
  if (capNote && _character) {
    const caps = [4, 6, 8, 10, 12, 16, 20];
    const capHours = caps[Math.min(_character.realm_index, caps.length - 1)];
    capNote.textContent = `Your realm allows up to ${capHours}h of offline rewards.`;
  }
}

async function startAfk() {
  const typeEl = document.querySelector('input[name="afk-type"]:checked');
  if (!typeEl) return;
  const actionType = typeEl.value;

  const r = await API.post('/api/game/action', { action: 'setAfk', options: { actionType } });
  if (!r.ok) {
    showToast(r.data.error || 'Could not start AFK.', 'error');
    return;
  }
  _gameState = r.data.state;
  showToast((r.data.result || ['AFK started.']).join(' '), 'ok');
  renderAll();
  loadAfkStatus();
}

async function cancelAfk() {
  const r = await API.post('/api/game/action', { action: 'cancelAfk' });
  if (!r.ok) { showToast('Could not cancel.', 'error'); return; }
  _gameState = r.data.state;
  _afkStatus = { active: false };
  showToast('AFK cancelled.', 'ok');
  renderAll();
  renderAfkPanel();
}

function showAfkRewards(rewards) {
  const display = document.getElementById('afk-rewards-display');
  const toast = document.getElementById('afk-toast');
  const lines = rewards.summary || [];
  const itemDrops = rewards.itemDrops || [];

  let html = `<ul class="afk-reward-lines">`;
  lines.forEach(l => { html += `<li>${escHtml(l)}</li>`; });
  itemDrops.forEach(d => { html += `<li>+${d.qty}× ${escHtml(d.id)}</li>`; });
  html += `</ul>`;

  if (display) display.innerHTML = html;

  if (toast) {
    toast.innerHTML = `<strong>AFK Rewards Collected!</strong><br>${lines.slice(0, 3).map(escHtml).join('<br>')}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 6000);
  }
}

function showCraftRewards(rewards) {
  rewards.forEach(r => showToast(`Crafting complete: ${r.qty}× ${r.item}`, 'ok'));
}

// ── Admin Panel ────────────────────────────────────────────────
function checkAdminAccess() {
  const adminLevel = _account?.admin_level ?? 0;
  document.getElementById('nav-admin-li')?.classList.toggle('hidden', adminLevel < 1);
}

function setupAdminPanel() {
  // Tab switching
  ['features', 'players', 'npcs', 'events', 'audit', 'stats'].forEach(tab => {
    document.getElementById(`admin-tab-${tab}`)?.addEventListener('click', () => switchAdminTab(tab));
  });

  // Features save
  document.getElementById('admin-feature-save')?.addEventListener('click', saveAdminFeature);

  // Player lookup
  document.getElementById('admin-player-lookup')?.addEventListener('click', lookupPlayer);

  // NPC refresh
  document.getElementById('admin-npc-refresh')?.addEventListener('click', loadAdminNpcs);

  // Event spawn
  document.getElementById('admin-event-spawn')?.addEventListener('click', spawnEvent);

  // Audit + stats refresh
  document.getElementById('admin-audit-refresh')?.addEventListener('click', loadAdminAudit);
  document.getElementById('admin-stats-refresh')?.addEventListener('click', loadAdminStats);
}

function switchAdminTab(tab) {
  ['features', 'players', 'npcs', 'events', 'audit', 'stats'].forEach(t => {
    document.getElementById(`admin-tab-${t}`)?.classList.toggle('active', t === tab);
    document.getElementById(`admin-${t}-panel`)?.classList.toggle('hidden', t !== tab);
  });
  if (tab === 'npcs') loadAdminNpcs();
  if (tab === 'audit') loadAdminAudit();
  if (tab === 'stats') loadAdminStats();
  if (tab === 'events') loadAdminEvents();
}

async function loadAdminFeatures() {
  const r = await API.get('/api/admin/features');
  if (!r.ok) return;
  const list = document.getElementById('admin-feature-list');
  if (!list) return;
  list.innerHTML = '';
  (r.data.features || []).forEach(f => {
    const row = document.createElement('div');
    row.className = `feature-row status-${f.status}`;
    row.innerHTML = `
      <span class="feature-id">${escHtml(f.feature_id)}</span>
      <span class="feature-status-badge">${escHtml(f.status)}</span>
      <span class="feature-notes text-muted">${escHtml(f.notes || '')}</span>
    `;
    list.appendChild(row);
  });
}

async function saveAdminFeature() {
  const featureId = document.getElementById('admin-feature-id').value.trim();
  const status = document.getElementById('admin-feature-status').value;
  const notes = document.getElementById('admin-feature-notes').value.trim();
  if (!featureId) { showToast('Feature ID required', 'error'); return; }
  const r = await API.post('/api/admin/features', { feature_id: featureId, status, notes });
  if (r.ok) { showToast('Feature updated.', 'ok'); loadAdminFeatures(); }
  else showToast(r.data.error || 'Error.', 'error');
}

async function lookupPlayer() {
  const query = document.getElementById('admin-player-search').value.trim();
  if (!query) return;
  const r = await API.get(`/api/admin/players?search=${encodeURIComponent(query)}`);
  const result = document.getElementById('admin-player-result');
  if (!result) return;
  if (!r.ok) { result.innerHTML = `<p class="text-muted">${escHtml(r.data.error || 'Not found')}</p>`; return; }
  const players = r.data.players || [r.data.player].filter(Boolean);
  result.innerHTML = `<table class="admin-table"><tr><th>Username</th><th>Email</th><th>Admin</th><th>Banned</th><th>Actions</th></tr>` +
    players.map(p => `<tr>
      <td>${escHtml(p.username)}</td>
      <td>${escHtml(p.email || '')}</td>
      <td>${p.admin_level ?? 0}</td>
      <td>${p.is_banned ? '⚠ Yes' : 'No'}</td>
      <td><button class="btn-sm btn-ghost" onclick="window._adminBan('${p.id}','${escHtml(p.username)}')">Ban</button></td>
    </tr>`).join('') + `</table>`;
}

async function loadAdminNpcs() {
  const r = await API.get('/api/admin/npcs');
  const list = document.getElementById('admin-npc-list');
  if (!list || !r.ok) return;
  const npcs = r.data.npcs || [];
  list.innerHTML = npcs.slice(0, 20).map(n => `
    <div class="npc-row">
      <span class="npc-id">${escHtml(n.template_id)}</span>
      <span>Realm ${n.realm_index} · Stage ${n.stage_index}</span>
      <span class="text-muted">${escHtml(n.npc_type || '')}</span>
    </div>
  `).join('');
}

async function loadAdminEvents() {
  const r = await API.get('/api/world/events');
  const list = document.getElementById('admin-event-list');
  if (!list || !r.ok) return;
  const events = r.data.events || [];
  list.innerHTML = events.map(e => `
    <div class="feature-row">
      <span class="feature-id">${escHtml(e.title)}</span>
      <span class="feature-status-badge">${escHtml(e.status || 'active')}</span>
      <span class="text-muted">${escHtml(e.description || '')}</span>
      <button class="btn-sm btn-ghost" onclick="window._adminDeleteEvent('${e.id}')">Delete</button>
    </div>
  `).join('') || '<p class="text-muted">No active events.</p>';
}

async function spawnEvent() {
  const title    = document.getElementById('admin-event-title').value.trim();
  const desc     = document.getElementById('admin-event-desc').value.trim();
  const duration = parseInt(document.getElementById('admin-event-duration').value, 10) || 24;
  if (!title) { showToast('Title required', 'error'); return; }
  const r = await API.post('/api/admin/events', { title, description: desc, duration_hours: duration });
  if (r.ok) { showToast('Event spawned.', 'ok'); loadAdminEvents(); }
  else showToast(r.data.error || 'Error.', 'error');
}

async function loadAdminAudit() {
  const r = await API.get('/api/admin/audit');
  const list = document.getElementById('admin-audit-list');
  if (!list || !r.ok) return;
  const entries = r.data.entries || [];
  list.innerHTML = entries.slice(0, 50).map(e => `
    <div class="audit-row">
      <span class="audit-time">${new Date(e.created_at).toLocaleString()}</span>
      <span class="audit-action">${escHtml(e.action)}</span>
      <span class="text-muted">${escHtml(e.data_json ? JSON.stringify(JSON.parse(e.data_json)) : '')}</span>
    </div>
  `).join('') || '<p class="text-muted">No log entries.</p>';
}

async function loadAdminStats() {
  const r = await API.get('/api/admin/stats');
  const display = document.getElementById('admin-stats-display');
  if (!display || !r.ok) return;
  const s = r.data.stats || r.data;
  display.innerHTML = `<table class="info-table">` +
    Object.entries(s).map(([k, v]) => `<tr><td>${escHtml(k)}</td><td><strong>${escHtml(String(v))}</strong></td></tr>`).join('') +
    `</table>`;
}

// ── Inline admin helpers ───────────────────────────────────────
window._adminBan = async (playerId, username) => {
  const reason = prompt(`Ban reason for ${username}:`);
  if (reason === null) return;
  const r = await API.post('/api/admin/players/ban', { account_id: playerId, reason, duration_days: 365 });
  showToast(r.ok ? 'Player banned.' : (r.data.error || 'Error'), r.ok ? 'ok' : 'error');
};

window._adminDeleteEvent = async (eventId) => {
  const r = await API.delete(`/api/admin/events/${eventId}`);
  showToast(r.ok ? 'Event deleted.' : (r.data.error || 'Error'), r.ok ? 'ok' : 'error');
  if (r.ok) loadAdminEvents();
};

// ── Toast notifications ────────────────────────────────────────
function showToast(msg, type = 'ok') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `app-toast toast-${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 4000);
}

// ── Helpers ────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Intercept main.js character creation to also create on the server
// When main.js calls its local save, we sync to the API
(function patchMainJsSync() {
  const orig = window.saveState;
  if (orig) {
    window.saveState = function(...args) {
      orig.apply(this, args);
      // If connected, sync state to server (fire and forget)
      if (!_offlineMode && window._activeCharId && window.state) {
        API.post('/api/game/sync', { state: window.state }).catch(() => {});
      }
    };
  }
})();
