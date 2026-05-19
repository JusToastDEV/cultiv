/**
 * app.js — Sealed Heavens API-connected frontend
 * Handles auth, character select, game state polling, and all server-side features.
 * Runs AFTER main.js; bridges the existing game engine with the live backend.
 */

const LIVE_WORKER_ORIGIN = 'https://cultiv.davidmergenthaler02.workers.dev';
const GUEST_MODE_STORAGE_KEY = 'sh_guest_mode';

const API = (() => {
  const BASE = ''; // same-origin
  const GUEST_MODE_HINT = 'Live auth is unavailable here. Use the deployed site for account play, or continue as a guest in this browser.';

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
          error: isFileMode ? GUEST_MODE_HINT : 'Network error. Please try again.'
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
let _activeAction = null; // { type, remaining } — current exclusive training action
let _afkStatus = null;
let _pollTimer = null;
let _guestSyncTimer = null;
let _cdAnimFrames = {};
let _guestMode = false;

// Realm names for display
const REALM_NAMES = [
  'Qi Condensation', 'Foundation Establishment', 'Core Formation',
  'Nascent Soul', 'Soul Formation', 'Void Refinement',
  'Body Integration', 'Mahayana', 'Tribulation Transcendence'
];
const STAGE_NAMES = [
  'Early Stage', 'Mid Stage', 'Late Stage', 'Peak Stage'
];

const LIVE_CHARACTER_ORIGINS = [
  { value: 'outlander', label: 'Wandering Outlander' },
  { value: 'ashen-cultivator', label: 'Ashen Cultivator' },
  { value: 'verdant-herbalist', label: 'Verdant Herbalist' },
  { value: 'void-walker', label: 'Void Walker' },
  { value: 'heaven-exile', label: 'Heaven Exile' },
  { value: 'ancient-remnant', label: 'Ancient Remnant' }
];

const LIVE_CHARACTER_PATHS = [
  { value: 'balanced', label: 'Balanced Path' },
  { value: 'body-tempering', label: 'Body Tempering' },
  { value: 'soul-attunement', label: 'Soul Attunement' }
];

// ── Bootstrap ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setupAuthUI();
  setupNavigation();
  setupSidebarToggle();
  setupTopbarActions();
  setupCultivatePanel();
  setupAdminPanel();
  setupExplorePanel();

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

  // Guest mode link
  document.getElementById('play-guest-link')?.addEventListener('click', e => {
    e.preventDefault();
    enterGuestMode();
  });

  // Logout buttons
  document.getElementById('char-select-logout')?.addEventListener('click', signOut);
  document.getElementById('topbar-logout')?.addEventListener('click', signOut);
  document.getElementById('btn-account-logout')?.addEventListener('click', signOut);
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
    return `This page is not running on the live worker origin. Use ${LIVE_WORKER_ORIGIN} for account play, or continue as a guest here.`;
  }
  if (response?.status === 404) {
    return 'Live API is unavailable on this deployment right now. Refresh in a moment or continue as a guest.';
  }
  if (response?.status === 0) {
    return response?.data?.error || fallback;
  }
  if (response?.status) {
    return `${fallback} (HTTP ${response.status})`;
  }
  return fallback;
}

function shouldResumeGuestMode() {
  try {
    return window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberGuestMode() {
  try {
    window.localStorage.setItem(GUEST_MODE_STORAGE_KEY, '1');
  } catch {
    // Ignore storage failures and keep guest mode in-memory only.
  }
}

function forgetGuestMode() {
  try {
    window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function isLiveWorkerOrigin() {
  return window.location.origin === LIVE_WORKER_ORIGIN;
}

function enterGuestMode() {
  rememberGuestMode();
  _guestMode = true;
  _account = { username: 'Guest' };
  _afkStatus = null;
  window._activeCharId = null;
  stopPolling();
  startGuestSync();
  setAuthError('login', '');
  setAuthError('register', '');
  showScreen('game');
  activatePanel('cultivate');
  updateTopbarLogoutLabel();
  showToast('Guest mode active. Progress stays in this browser until you sign into a live account.', 'warn');
}

function startGuestSync() {
  stopGuestSync();
  syncGuestBridge();
  _guestSyncTimer = setInterval(syncGuestBridge, 500);
}

function stopGuestSync() {
  if (_guestSyncTimer) {
    clearInterval(_guestSyncTimer);
    _guestSyncTimer = null;
  }
}

function syncGuestBridge() {
  const localState = window.state;
  if (!localState) return false;

  const realmIndex = Number(localState.realmIndex ?? 0);
  const stageIndex = Number(localState.stageIndex ?? 0);
  const xpThreshold = 100 + realmIndex * 50 + stageIndex * 20;

  _character = {
    name: getGuestCharacterName(localState),
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

function getGuestCharacterName(localState) {
  const name = typeof localState?.playerName === 'string' ? localState.playerName.trim() : '';
  return name || 'Guest Disciple';
}

function updateTopbarLogoutLabel() {
  const logoutBtn = document.getElementById('topbar-logout');
  if (logoutBtn) logoutBtn.textContent = _guestMode ? 'Exit Guest' : 'Logout';
}

async function tryAutoLogin() {
  if (window.location.protocol === 'file:') {
    if (shouldResumeGuestMode()) {
      enterGuestMode();
      return;
    }
    showScreen('auth');
    setAuthError('login', 'Local file mode does not support live auth. Use guest mode below if you want a browser-only save.');
    return;
  }

  const r = await API.get('/api/auth/session');
  if (r.ok && r.data.authenticated) {
    forgetGuestMode();
    _account = r.data;
    await enterGame();
  } else {
    if (shouldResumeGuestMode()) {
      enterGuestMode();
      return;
    }
    if (r.status === 404) {
      setAuthError('login', getAuthFailureMessage(r, 'Live API is not responding on this deployment yet. The game needs a fresh worker deploy.'));
    } else if (r.status === 0) {
      setAuthError('login', getAuthFailureMessage(r, 'Live auth is currently unreachable.'));
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
    setAuthError('login', getAuthFailureMessage(r, 'Could not load your character list.'));
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

    if (existing) {
      card.className = 'char-slot-card';
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
      card.className = 'char-slot-card char-slot-empty-card';
      const originOptions = LIVE_CHARACTER_ORIGINS.map(origin => `
        <option value="${origin.value}">${origin.label}</option>
      `).join('');
      const pathOptions = LIVE_CHARACTER_PATHS.map(path => `
        <option value="${path.value}">${path.label}</option>
      `).join('');
      card.innerHTML = `
        <div class="char-slot-info">
          <span class="char-slot-empty">— Empty Slot ${slot} —</span>
          <p class="char-slot-help">Create a live character here, then enter the game immediately.</p>
          <div class="char-create-form hidden" data-create-form="${slot}">
            <label class="char-create-field">
              <span>Name</span>
              <input type="text" data-create-name="${slot}" maxlength="24" autocomplete="off" placeholder="Cultivator name" />
            </label>
            <label class="char-create-field">
              <span>Origin</span>
              <select data-create-origin="${slot}">
                ${originOptions}
              </select>
            </label>
            <label class="char-create-field">
              <span>Path</span>
              <select data-create-path="${slot}">
                ${pathOptions}
              </select>
            </label>
            <p class="char-create-error" data-create-error="${slot}"></p>
            <div class="char-create-actions">
              <button class="btn-primary btn-create-submit" type="button" data-slot="${slot}">Begin Cultivation</button>
              <button class="btn-ghost btn-create-cancel" type="button" data-slot="${slot}">Cancel</button>
            </div>
          </div>
        </div>
        <button class="btn-ghost btn-create-toggle" type="button" data-slot="${slot}">Create Character</button>
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

  // Create new character directly against the live API
  container.querySelectorAll('.btn-create-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = btn.dataset.slot;
      const form = container.querySelector(`[data-create-form="${slot}"]`);
      form?.classList.remove('hidden');
      btn.classList.add('hidden');
      container.querySelector(`[data-create-name="${slot}"]`)?.focus();
    });
  });

  container.querySelectorAll('.btn-create-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = btn.dataset.slot;
      const form = container.querySelector(`[data-create-form="${slot}"]`);
      const toggle = container.querySelector(`.btn-create-toggle[data-slot="${slot}"]`);
      const error = container.querySelector(`[data-create-error="${slot}"]`);
      if (error) error.textContent = '';
      form?.classList.add('hidden');
      toggle?.classList.remove('hidden');
    });
  });

  container.querySelectorAll('.btn-create-submit').forEach(btn => {
    btn.addEventListener('click', () => createLiveCharacter(btn.dataset.slot, container));
  });
}

async function createLiveCharacter(slot, container) {
  const nameInput = container.querySelector(`[data-create-name="${slot}"]`);
  const originInput = container.querySelector(`[data-create-origin="${slot}"]`);
  const pathInput = container.querySelector(`[data-create-path="${slot}"]`);
  const error = container.querySelector(`[data-create-error="${slot}"]`);
  const submit = container.querySelector(`.btn-create-submit[data-slot="${slot}"]`);

  const name = nameInput?.value.trim() || '';
  const origin = originInput?.value || 'outlander';
  const charPath = pathInput?.value || 'balanced';

  if (error) error.textContent = '';

  if (!/^[a-zA-Z\s'-]{2,24}$/.test(name)) {
    if (error) error.textContent = 'Name must be 2-24 letters, spaces, apostrophes, or hyphens.';
    nameInput?.focus();
    return;
  }

  if (submit) submit.disabled = true;
  const r = await API.post('/api/characters', {
    name,
    origin,
    path: charPath,
    slot: Number(slot)
  });
  if (submit) submit.disabled = false;

  if (!r.ok) {
    if (error) error.textContent = r.data.error || 'Could not create character.';
    return;
  }

  showToast('Character created.', 'ok');
  await selectCharacter(r.data.characterId);
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
  _activeAction = r.data.activeAction ?? null;

  if (r.data.craftRewards?.length) showCraftRewards(r.data.craftRewards);

  showScreen('game');
  activatePanel('cultivate');
  updateTopbarLogoutLabel();
  renderAll();
  startPolling();
  checkAdminAccess();
}

async function signOut() {
  if (_guestMode) {
    _guestMode = false;
    forgetGuestMode();
    stopGuestSync();
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
  stopGuestSync();
  updateTopbarLogoutLabel();
  showScreen('auth');
}

// ── Screen management ──────────────────────────────────────────
function showScreen(screen) {
  document.getElementById('auth-overlay')?.classList.toggle('hidden', screen !== 'auth');
  document.getElementById('char-select-overlay')?.classList.toggle('hidden', screen !== 'charSelect');
  document.getElementById('game-shell')?.classList.toggle('hidden', screen !== 'game');
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
  if (panelId === 'explore' && _character) { renderAtlasMap(); loadZones(); }
  if (panelId === 'inventory') loadInventory();
  if (panelId === 'admin') loadAdminFeatures();
  if (panelId === 'account') loadAccountInfo();
}

function setupSidebarToggle() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
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
  if (!window._activeCharId || _guestMode) return;
  const r = await API.get('/api/game/state');
  if (!r.ok) return;
  _gameState    = r.data.state;
  _character    = r.data.character;
  _cooldowns    = r.data.cooldowns || {};
  _activeAction = r.data.activeAction ?? null;
  renderAll();
  updateCooldownBars();
}

// ── Render ─────────────────────────────────────────────────────
function renderAll() {
  if (!_gameState || !_character) return;
  renderTopBar();
  renderCultivatePanel();
}

function renderTopBar() {
  const s = _gameState;
  const c = _character;
  const realmName = REALM_NAMES[c.realm_index] ?? `Realm ${c.realm_index}`;
  const charName = document.getElementById('tb-char-name');
  const realm = document.getElementById('tb-realm');
  const hp = document.getElementById('tb-hp');
  const qi = document.getElementById('tb-qi');
  const bqi = document.getElementById('tb-bqi');
  const silver = document.getElementById('tb-silver');

  if (charName) charName.textContent = c.name;
  if (realm) realm.textContent = realmName;

  setBar('tb-hp-fill', s.hp, s.hpMax);
  setBar('tb-qi-fill', s.qi, s.qiMax);
  setBar('tb-bqi-fill', s.battleQi, s.battleQiMax);
  if (hp) hp.textContent = `${s.hp}/${s.hpMax}`;
  if (qi) qi.textContent = `${s.qi}/${s.qiMax}`;
  if (bqi) bqi.textContent = `${s.battleQi}/${s.battleQiMax}`;
  if (silver) silver.textContent = `${s.silver ?? 0} silver`;
}

function renderCultivatePanel() {
  const s = _gameState;
  const c = _character;
  const realmName  = REALM_NAMES[c.realm_index]  ?? `Realm ${c.realm_index}`;
  const stageName  = STAGE_NAMES[c.stage_index]  ?? `Stage ${c.stage_index}`;
  const cultRealm = document.getElementById('cult-realm-label');
  const profileRealm = document.getElementById('profile-realm-label');
  const profileName = document.getElementById('profile-name');
  const cultXpVal = document.getElementById('cult-xp-val');
  const cultXpFill = document.getElementById('cult-xp-fill');

  if (cultRealm) cultRealm.textContent = `${realmName} · ${stageName}`;
  if (profileRealm) profileRealm.textContent = `${realmName} · ${stageName}`;
  if (profileName) profileName.textContent = c.name;

  // Profile panel stats
  const profileRealmStat  = document.getElementById('profile-realm');
  const profileLongevity  = document.getElementById('profile-longevity');
  const profileTurn       = document.getElementById('profile-turn');
  const profileWallet     = document.getElementById('profile-wallet');
  const profileBody       = document.getElementById('profile-body');
  const profileSoul       = document.getElementById('profile-soul');
  if (profileRealmStat) profileRealmStat.textContent = `${realmName} · ${stageName}`;
  if (profileLongevity)  profileLongevity.textContent = `${s.longevity ?? 18} / ${s.longevityMax ?? 80} yrs`;
  if (profileTurn)       profileTurn.textContent = s.cultivationXp ?? 0;
  if (profileWallet)     profileWallet.textContent = `${s.silver ?? 0} silver`;
  if (profileBody)       profileBody.textContent = s.bodyXp ?? 0;
  if (profileSoul)       profileSoul.textContent = s.soulXp ?? 0;

  // XP bar
  const xpThreshold = 100 + c.realm_index * 50 + c.stage_index * 20;
  const xp = s.cultivationXp ?? 0;
  if (cultXpVal) cultXpVal.textContent = `${xp} / ${xpThreshold}`;
  if (cultXpFill) cultXpFill.style.width = `${Math.min(100, (xp / xpThreshold) * 100).toFixed(1)}%`;
  if (cultRealm) cultRealm.textContent = `${realmName} · ${stageName}`;

  updateCooldownBars();
}

function updateCooldownBars() {
  const EXCLUSIVE = ['meditate', 'trainBody', 'trainSoul'];
  const maxMs = { meditate: 15 * 60000, trainBody: 20 * 60000, trainSoul: 20 * 60000 };
  const ACTION_LABELS = { meditate: 'Meditate', trainBody: 'Train Body', trainSoul: 'Train Soul' };

  // Find the active exclusive action (if any)
  let activeKey = null;
  let activeRemaining = 0;
  for (const a of EXCLUSIVE) {
    const rem = _cooldowns[a] ?? 0;
    if (rem > 0) { activeKey = a; activeRemaining = rem; break; }
  }

  for (const action of EXCLUSIVE) {
    const remaining = _cooldowns[action] ?? 0;
    const max = maxMs[action];
    const pct = remaining > 0 ? Math.min(100, (remaining / max) * 100) : 0;
    const bar = document.getElementById(`cd-${action}`);
    const btn = document.getElementById(`btn-${action}`);
    if (bar) bar.style.width = `${100 - pct}%`;
    if (btn) {
      // Disable ALL action buttons if any exclusive is active (mutex)
      const blocked = activeKey !== null && activeKey !== action;
      btn.disabled = remaining > 0 || blocked;
      if (remaining > 0) {
        btn.textContent = `${ACTION_LABELS[action]} (${msToMin(remaining)})`;
      } else if (blocked) {
        btn.textContent = ACTION_LABELS[action];
      } else {
        btn.textContent = ACTION_LABELS[action];
      }
    }
    if (remaining > 0) startCdCountdown(action, remaining);
  }

  // Active action note + cancel button
  const note = document.getElementById('active-action-note');
  const stopBtn = document.getElementById('btn-stop-action');
  const ribbon = document.getElementById('action-ribbon');
  const ribbonText = document.getElementById('action-ribbon-text');

  if (activeKey) {
    const label = ACTION_LABELS[activeKey] ?? activeKey;
    const noteText = `${label} in progress — ${msToMin(activeRemaining)} remaining.`;
    if (note) note.textContent = noteText;
    if (stopBtn) stopBtn.style.display = '';
    if (ribbon) ribbon.classList.remove('hidden');
    if (ribbonText) ribbonText.textContent = noteText;
  } else {
    if (note) note.textContent = 'No active action.';
    if (stopBtn) stopBtn.style.display = 'none';
    if (ribbon) ribbon.classList.add('hidden');
  }
}

function startCdCountdown(action, remaining) {
  if (_cdAnimFrames[action]) cancelAnimationFrame(_cdAnimFrames[action]);
  const deadline = Date.now() + remaining;
  const maxMs = { meditate: 15 * 60000, trainBody: 20 * 60000, trainSoul: 20 * 60000 }[action] ?? 60000;
  const ACTION_LABELS = { meditate: 'Meditate', trainBody: 'Train Body', trainSoul: 'Train Soul' };
  const EXCLUSIVE = ['meditate', 'trainBody', 'trainSoul'];

  function tick() {
    const left = Math.max(0, deadline - Date.now());
    const pct = (left / maxMs) * 100;
    const bar = document.getElementById(`cd-${action}`);
    const btn = document.getElementById(`btn-${action}`);
    if (bar) bar.style.width = `${100 - pct}%`;
    if (btn) {
      btn.disabled = left > 0;
      btn.textContent = left > 0
        ? `${ACTION_LABELS[action]} (${msToMin(left)})`
        : ACTION_LABELS[action];
    }

    // Keep other exclusive buttons disabled while this action is active
    if (left > 0) {
      for (const a of EXCLUSIVE) {
        if (a === action) continue;
        const otherBtn = document.getElementById(`btn-${a}`);
        if (otherBtn && !(_cooldowns[a] > 0)) otherBtn.disabled = true;
      }
    }

    // Update active action note
    const note = document.getElementById('active-action-note');
    const ribbon = document.getElementById('action-ribbon');
    const ribbonText = document.getElementById('action-ribbon-text');
    const stopBtn = document.getElementById('btn-stop-action');
    if (left > 0) {
      const noteText = `${ACTION_LABELS[action]} in progress — ${msToMin(left)} remaining.`;
      if (note) note.textContent = noteText;
      if (ribbonText) ribbonText.textContent = noteText;
      if (ribbon) ribbon.classList.remove('hidden');
      if (stopBtn) stopBtn.style.display = '';
      _cdAnimFrames[action] = requestAnimationFrame(tick);
    } else {
      delete _cdAnimFrames[action];
      // Re-enable other buttons
      for (const a of EXCLUSIVE) {
        if (_cooldowns[a] > 0) continue;
        const otherBtn = document.getElementById(`btn-${a}`);
        if (otherBtn) otherBtn.disabled = false;
      }
      if (note) note.textContent = 'No active action.';
      if (ribbon) ribbon.classList.add('hidden');
      if (stopBtn) stopBtn.style.display = 'none';
      pollState();
    }
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

  // Cancel action buttons
  document.getElementById('btn-stop-action')?.addEventListener('click', () => doAction('cancelAction'));
  document.getElementById('action-ribbon-cancel')?.addEventListener('click', () => doAction('cancelAction'));

  // Legacy buttons in other panels
  document.querySelectorAll('[data-action="meditate"]').forEach(b => b.addEventListener('click', () => doAction('meditate')));
  document.querySelectorAll('[data-action="trainBody"]').forEach(b => b.addEventListener('click', () => doAction('trainBody')));
  document.querySelectorAll('[data-action="trainSoul"]').forEach(b => b.addEventListener('click', () => doAction('trainSoul')));
}

async function doAction(action, options = {}) {
  if (_guestMode || !window._activeCharId) return;

  const EXCLUSIVE = ['meditate', 'trainBody', 'trainSoul'];
  const ACTION_LABELS = { meditate: 'Meditate', trainBody: 'Train Body', trainSoul: 'Train Soul' };

  // Optimistic UI — disable action buttons instantly and show "starting" state
  const clickedBtn = document.getElementById(`btn-${action}`);
  if (clickedBtn) { clickedBtn.disabled = true; clickedBtn.textContent = 'Starting…'; }
  if (EXCLUSIVE.includes(action)) {
    for (const a of EXCLUSIVE) {
      const b = document.getElementById(`btn-${a}`);
      if (b) b.disabled = true;
    }
  }

  const r = await API.post('/api/game/action', { action, options });

  // Revert optimistic disable if something went wrong
  if (!r.ok) {
    if (clickedBtn) { clickedBtn.disabled = false; clickedBtn.textContent = ACTION_LABELS[action] ?? action; }
    if (EXCLUSIVE.includes(action)) {
      for (const a of EXCLUSIVE) {
        if (!(_cooldowns[a] > 0)) {
          const b = document.getElementById(`btn-${a}`);
          if (b) { b.disabled = false; b.textContent = ACTION_LABELS[a] ?? a; }
        }
      }
    }
    if (r.status === 429) {
      const msg = r.data.active_action
        ? `You are already training (${ACTION_LABELS[r.data.active_action] ?? r.data.active_action}).`
        : `On cooldown — ${msToMin(r.data.cooldown_ms || 0)} remaining.`;
      showToast(msg, 'warn');
    } else {
      showToast(r.data.error || 'Action failed.', 'error');
    }
    return;
  }

  _gameState    = r.data.state;
  _cooldowns    = r.data.cooldowns ?? _cooldowns;
  _activeAction = r.data.activeAction ?? null;

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

// Static world data for atlas rendering (mirrors server GAME_CONSTANTS)
const WORLD_DATA = {
  regions: [
    { id: 'ashen-frontier',   name: 'Ashen Frontier',    world: 'Ashen World',    danger: 'Low',         resources: 'Herbs, low-tier ores',        neighbors: ['jade-delta','iron-wilds'] },
    { id: 'jade-delta',       name: 'Jade Delta',         world: 'Verdant World',  danger: 'Low-Mid',     resources: 'Spirit herbs, alchemy reagents',neighbors: ['ashen-frontier','void-rift'] },
    { id: 'iron-wilds',       name: 'Iron Wilds',         world: 'Ashen World',    danger: 'Mid',         resources: 'Beast cores, blood jade',       neighbors: ['ashen-frontier','void-rift'] },
    { id: 'void-rift',        name: 'Void Rift March',    world: 'Mirror World',   danger: 'High',        resources: 'Array ore, rare relic fragments',neighbors: ['jade-delta','iron-wilds','celestial-plateau'] },
    { id: 'celestial-plateau',name: 'Celestial Plateau',  world: 'Upper Heaven',   danger: 'Extreme',     resources: 'Void lotuses, saint bone, star-metal', neighbors: ['void-rift','sovereign-wastes'] },
    { id: 'sovereign-wastes', name: 'Sovereign Wastes',   world: 'Ancient Heaven', danger: 'Cataclysmic', resources: 'Dao crystals, immortal dew, sovereign relics', neighbors: ['celestial-plateau'] }
  ],
  cities: [
    { id:'ember',       name:'Ember Court',         regionId:'ashen-frontier' },
    { id:'cinder',      name:'Cinder Bastion',       regionId:'ashen-frontier' },
    { id:'ashgate',     name:'Ashgate Borough',      regionId:'ashen-frontier' },
    { id:'char-haven',  name:'Char Haven',           regionId:'ashen-frontier' },
    { id:'sable-forge', name:'Sable Forge',          regionId:'ashen-frontier' },
    { id:'grim-terrace',name:'Grim Terrace',         regionId:'ashen-frontier' },
    { id:'jade',        name:'Jade Harbor',          regionId:'jade-delta' },
    { id:'lotus',       name:'Lotus Archive',        regionId:'jade-delta' },
    { id:'rain-wharf',  name:'Rainwharf Quay',       regionId:'jade-delta' },
    { id:'bamboo-rise', name:'Bamboo Rise',          regionId:'jade-delta' },
    { id:'mist-pier',   name:'Mist Pier',            regionId:'jade-delta' },
    { id:'green-vault', name:'Green Vault District', regionId:'jade-delta' },
    { id:'iron',        name:'Iron Howl Keep',       regionId:'iron-wilds' },
    { id:'fang-cross',  name:'Fang Cross',           regionId:'iron-wilds' },
    { id:'red-cliff',   name:'Red Cliff Yard',       regionId:'iron-wilds' },
    { id:'bone-spear',  name:'Bone Spear Ward',      regionId:'iron-wilds' },
    { id:'steel-marsh', name:'Steel Marsh',          regionId:'iron-wilds' },
    { id:'war-drum',    name:'War Drum City',        regionId:'iron-wilds' },
    { id:'void',        name:'Void Lantern Capital', regionId:'void-rift' },
    { id:'night-shard', name:'Night Shard Port',     regionId:'void-rift' },
    { id:'mirror-step', name:'Mirrorstep Enclave',   regionId:'void-rift' },
    { id:'riftwatch',   name:'Riftwatch Bastion',    regionId:'void-rift' },
    { id:'hollow-sun',  name:'Hollow Sun Bastille',  regionId:'void-rift' },
    { id:'echo-prism',  name:'Echo Prism Court',     regionId:'void-rift' },
    { id:'starfall',    name:'Starfall Terrace',     regionId:'celestial-plateau' },
    { id:'saint-vigil', name:'Saint Vigil City',     regionId:'celestial-plateau' },
    { id:'auric-steps', name:'Auric Steps',          regionId:'celestial-plateau' },
    { id:'dao-furnace', name:'Dao Furnace Capital',  regionId:'sovereign-wastes' },
    { id:'crown-void',  name:'Crown Void Citadel',   regionId:'sovereign-wastes' },
    { id:'ashen-throne',name:'Ashen Throne Gate',    regionId:'sovereign-wastes' }
  ],
  areas: [
    { id:'cinder-steppe',        name:'Cinder Steppe',          short:'Steppe',    regionId:'ashen-frontier',    danger:1 },
    { id:'burnt-shrines',        name:'Burnt Shrines',           short:'Shrines',   regionId:'ashen-frontier',    danger:2 },
    { id:'smoke-pits',           name:'Smoke Pits',              short:'Pits',      regionId:'ashen-frontier',    danger:2 },
    { id:'jade-marsh',           name:'Jade Marsh',              short:'Marsh',     regionId:'jade-delta',        danger:1 },
    { id:'lotus-fissure',        name:'Lotus Fissure',           short:'Fissure',   regionId:'jade-delta',        danger:2 },
    { id:'bamboo-veil',          name:'Bamboo Veil',             short:'Veil',      regionId:'jade-delta',        danger:1 },
    { id:'red-fang-range',       name:'Red Fang Range',          short:'Fang',      regionId:'iron-wilds',        danger:2 },
    { id:'bone-hollows',         name:'Bone Hollows',            short:'Hollows',   regionId:'iron-wilds',        danger:3 },
    { id:'war-scar-vale',        name:'War Scar Vale',           short:'Vale',      regionId:'iron-wilds',        danger:3 },
    { id:'fracture-coast',       name:'Fracture Coast',          short:'Coast',     regionId:'void-rift',         danger:3 },
    { id:'prism-chasm',          name:'Prism Chasm',             short:'Chasm',     regionId:'void-rift',         danger:4 },
    { id:'hushed-mirror',        name:'Hushed Mirror Expanse',   short:'Mirror',    regionId:'void-rift',         danger:4 },
    { id:'star-shear-rim',       name:'Star Shear Rim',          short:'Shear',     regionId:'celestial-plateau', danger:5 },
    { id:'lotus-of-absence',     name:'Lotus of Absence',        short:'Absence',   regionId:'celestial-plateau', danger:5 },
    { id:'seraph-spine',         name:'Seraph Spine',            short:'Spine',     regionId:'celestial-plateau', danger:6 },
    { id:'dao-bone-desert',      name:'Dao Bone Desert',         short:'Dao Bone',  regionId:'sovereign-wastes',  danger:6 },
    { id:'immortal-furnace-sea', name:'Immortal Furnace Sea',    short:'Furnace',   regionId:'sovereign-wastes',  danger:7 },
    { id:'thronefall-necropolis',name:'Thronefall Necropolis',   short:'Necropolis',regionId:'sovereign-wastes',  danger:7 },
    { id:'myriad-spirit-mausoleum',name:'Myriad Spirit Mausoleum',short:'Mausoleum',regionId:'sovereign-wastes', danger:8 }
  ]
};

const REGION_POSITIONS = {
  'ashen-frontier':    { x: 300, y: 420 },
  'jade-delta':        { x: 820, y: 310 },
  'iron-wilds':        { x: 760, y: 690 },
  'void-rift':         { x: 1200, y: 500 },
  'celestial-plateau': { x: 1360, y: 220 },
  'sovereign-wastes':  { x: 1450, y: 760 }
};

function atlasRegionPos(regionId) {
  return REGION_POSITIONS[regionId] || { x: 540, y: 420 };
}

function atlasCityPos(city) {
  const regional = WORLD_DATA.cities.filter(c => c.regionId === city.regionId);
  const index = Math.max(0, regional.findIndex(c => c.id === city.id));
  const count = Math.max(1, regional.length);
  const anchor = atlasRegionPos(city.regionId);
  const angle = (Math.PI * 2 * index) / count;
  const ring = 88 + (index % 3) * 30;
  return { x: anchor.x + Math.cos(angle) * ring, y: anchor.y + Math.sin(angle) * ring };
}

function atlasAreaPos(area) {
  const regional = WORLD_DATA.areas.filter(a => a.regionId === area.regionId);
  const index = Math.max(0, regional.findIndex(a => a.id === area.id));
  const count = Math.max(1, regional.length);
  const anchor = atlasRegionPos(area.regionId);
  const angle = (Math.PI * 2 * index) / count + Math.PI / 6;
  const ring = 145 + (index % 3) * 24;
  return { x: anchor.x + Math.cos(angle) * ring, y: anchor.y + Math.sin(angle) * ring };
}

let _atlasSelection = null;

function renderAtlasMap() {
  const canvas = document.getElementById('atlas-canvas');
  const info   = document.getElementById('atlas-info');
  if (!canvas) return;
  canvas.innerHTML = '';

  const currentRegionId = _gameState?.regionId ?? 'ashen-frontier';
  const currentCityId   = _gameState?.cityId   ?? 'ashgate';

  const seenLines = new Set();
  const drawLine = (key, from, to, cls = '') => {
    if (seenLines.has(key)) return;
    seenLines.add(key);
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist  = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const line  = document.createElement('div');
    line.className = `atlas-line ${cls}`.trim();
    line.style.left      = `${from.x}px`;
    line.style.top       = `${from.y}px`;
    line.style.width     = `${dist}px`;
    line.style.transform = `rotate(${angle}deg)`;
    canvas.appendChild(line);
  };

  // Region → region connections
  WORLD_DATA.regions.forEach(region => {
    const from = atlasRegionPos(region.id);
    region.neighbors.forEach(nId => {
      const key = [region.id, nId].sort().join('|');
      drawLine(key, from, atlasRegionPos(nId));
    });
  });

  // Region → city spokes
  WORLD_DATA.cities.forEach(city => {
    drawLine(`rc:${city.id}`, atlasRegionPos(city.regionId), atlasCityPos(city), 'subline');
  });

  // Region → area spokes (current region only to reduce clutter)
  WORLD_DATA.areas
    .filter(a => a.regionId === currentRegionId)
    .forEach(area => {
      const cities = WORLD_DATA.cities.filter(c => c.regionId === area.regionId);
      const aPos = atlasAreaPos(area);
      const closest = cities.reduce((best, c) => {
        if (!best) return c;
        const bp = atlasCityPos(best), cp = atlasCityPos(c);
        const bd = (bp.x - aPos.x) ** 2 + (bp.y - aPos.y) ** 2;
        const cd = (cp.x - aPos.x) ** 2 + (cp.y - aPos.y) ** 2;
        return cd < bd ? c : best;
      }, cities[0]);
      if (closest) drawLine(`ca:${area.id}`, atlasCityPos(closest), aPos, 'subline faint');
    });

  // Region nodes
  WORLD_DATA.regions.forEach(region => {
    const pos  = atlasRegionPos(region.id);
    const isCurrent  = region.id === currentRegionId;
    const isSelected = _atlasSelection?.type === 'region' && _atlasSelection.id === region.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `atlas-node region${isCurrent ? ' current' : ''}${isSelected ? ' selected' : ''}`;
    btn.style.left = `${pos.x - 18}px`;
    btn.style.top  = `${pos.y - 18}px`;
    btn.innerHTML  = `<span class="node-icon">RG</span><span>${region.name}</span>`;
    btn.addEventListener('click', () => { _atlasSelection = { type:'region', id:region.id }; renderAtlasMap(); });
    canvas.appendChild(btn);
  });

  // City nodes
  WORLD_DATA.cities.forEach(city => {
    const pos  = atlasCityPos(city);
    const isCurrent  = city.id === currentCityId;
    const isSelected = _atlasSelection?.type === 'city' && _atlasSelection.id === city.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `atlas-node city${isCurrent ? ' current' : ''}${isSelected ? ' selected' : ''}`;
    btn.style.left = `${pos.x}px`;
    btn.style.top  = `${pos.y}px`;
    btn.innerHTML  = `<span class="node-icon">CT</span><span>${city.name}</span>`;
    btn.addEventListener('click', () => { _atlasSelection = { type:'city', id:city.id }; renderAtlasMap(); });
    canvas.appendChild(btn);
  });

  // Area nodes (current region only)
  WORLD_DATA.areas
    .filter(a => a.regionId === currentRegionId)
    .forEach(area => {
      const pos  = atlasAreaPos(area);
      const isSelected = _atlasSelection?.type === 'area' && _atlasSelection.id === area.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `atlas-node area${isSelected ? ' selected' : ''}`;
      btn.style.left = `${pos.x}px`;
      btn.style.top  = `${pos.y}px`;
      btn.innerHTML  = `<span class="node-icon">AR</span><span class="node-label">${area.short || area.name}</span>`;
      btn.addEventListener('click', () => { _atlasSelection = { type:'area', id:area.id }; renderAtlasMap(); });
      canvas.appendChild(btn);
    });

  // Info panel
  if (!info) return;
  const sel = _atlasSelection;
  if (!sel) { info.textContent = 'Select a region, city, or area on the map.'; return; }

  if (sel.type === 'region') {
    const r = WORLD_DATA.regions.find(x => x.id === sel.id);
    if (!r) return;
    info.innerHTML = `<strong>${escHtml(r.name)}</strong> · World: ${escHtml(r.world)} · Danger: ${escHtml(r.danger)}<br><span class="text-muted">Resources: ${escHtml(r.resources)}</span>`;
    return;
  }
  if (sel.type === 'city') {
    const c = WORLD_DATA.cities.find(x => x.id === sel.id);
    if (!c) return;
    const inCurrentRegion = c.regionId === currentRegionId;
    info.innerHTML = `<strong>${escHtml(c.name)}</strong>${inCurrentRegion ? ' <span class="text-good">(accessible)</span>' : ' <span class="text-muted">(different region)</span>'}`;
    return;
  }
  if (sel.type === 'area') {
    const a = WORLD_DATA.areas.find(x => x.id === sel.id);
    if (!a) return;
    const dangerLabel = a.danger >= 7 ? 'Extreme' : a.danger >= 5 ? 'High' : a.danger >= 3 ? 'Mid' : 'Low';
    info.innerHTML = `<strong>${escHtml(a.name)}</strong> · Danger ${a.danger} (${dangerLabel}) · Region: ${escHtml(WORLD_DATA.regions.find(r => r.id === a.regionId)?.name ?? a.regionId)}`;
  }
}

function setupExplorePanel() {
  // Atlas drag-to-pan
  const viewport = document.getElementById('atlas-viewport');
  const canvas   = document.getElementById('atlas-canvas');
  if (!viewport || !canvas) return;

  let dragging = false, startX = 0, startY = 0, tx = 0, ty = 0, cx = 0, cy = 0;

  viewport.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragging = true; startX = e.clientX; startY = e.clientY; cx = tx; cy = ty;
    viewport.classList.add('dragging');
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    tx = cx + (e.clientX - startX);
    ty = cy + (e.clientY - startY);
    canvas.style.transform = `translate3d(${tx}px,${ty}px,0)`;
  });
  window.addEventListener('mouseup', () => { dragging = false; viewport.classList.remove('dragging'); });

  // Touch support
  viewport.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    dragging = true; startX = e.touches[0].clientX; startY = e.touches[0].clientY; cx = tx; cy = ty;
  }, { passive: true });
  viewport.addEventListener('touchmove', e => {
    if (!dragging || e.touches.length !== 1) return;
    tx = cx + (e.touches[0].clientX - startX);
    ty = cy + (e.touches[0].clientY - startY);
    canvas.style.transform = `translate3d(${tx}px,${ty}px,0)`;
  }, { passive: true });
  viewport.addEventListener('touchend', () => { dragging = false; });
}

async function loadZones() {
  if (_guestMode || !_character) return;
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
  if (_guestMode || !_character) return;
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
  if (_guestMode || !_character) return;
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

// ── Account Panel ──────────────────────────────────────────────
async function loadAccountInfo() {
  if (_guestMode) {
    document.getElementById('acct-loading')?.classList.add('hidden');
    const err = document.getElementById('acct-error');
    if (err) { err.textContent = 'Account info is not available in guest mode.'; err.classList.remove('hidden'); }
    return;
  }

  const loading = document.getElementById('acct-loading');
  const errorEl = document.getElementById('acct-error');
  const content = document.getElementById('acct-content');
  if (loading) loading.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (content) content.classList.add('hidden');

  const r = await API.get('/api/account');
  if (loading) loading.classList.add('hidden');

  if (!r.ok) {
    if (errorEl) { errorEl.textContent = r.data?.error ?? 'Failed to load account info.'; errorEl.classList.remove('hidden'); }
    return;
  }

  const d = r.data;
  const fmt = ms => ms ? new Date(ms).toLocaleString() : '—';
  const RANK_LABELS = { 0: 'Cultivator', 1: 'Moderator', 2: 'Administrator', 3: 'Sovereign' };

  setText('acct-username', d.username ?? '—');
  setText('acct-email', d.email ?? '—');
  setText('acct-created', fmt(d.createdAt));
  setText('acct-last-login', fmt(d.lastLogin));
  setText('acct-rank', RANK_LABELS[d.adminLevel] ?? 'Cultivator');
  setText('acct-id', d.id ?? '—');
  setText('acct-session-start', fmt(d.sessionCreatedAt));
  setText('acct-session-expires', fmt(d.sessionExpiresAt));

  const badge = document.getElementById('acct-admin-badge');
  if (badge) badge.classList.toggle('hidden', (d.adminLevel ?? 0) < 1);

  if (content) content.classList.remove('hidden');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Admin Panel ────────────────────────────────────────────────
function checkAdminAccess() {
  const adminLevel = _account?.adminLevel ?? _account?.admin_level ?? 0;
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
      if (!_guestMode && window._activeCharId && window.state) {
        API.post('/api/game/sync', { state: window.state }).catch(() => {});
      }
    };
  }
})();
