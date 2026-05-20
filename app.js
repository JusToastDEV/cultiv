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
let _travelReadyAt = 0;      // epoch ms when next tile move is allowed
let _travelTimerInterval = null; // setInterval handle for travel countdown
let _worldClockTimer = null; // setInterval handle for the live clock UI
let _selectedWorldTile = null;
let _selectedTileSite = null;
let _travelRoute = null;
let _lastTileEntry = null;
let _viewMode = 'world';         // 'world' or 'local'
let _localViewTile = null;       // {x, y, regionId} - which world tile's local map we're viewing
let _localPlayerX = null;        // Player position in local mini-map
let _localPlayerY = null;
let _localMapData = null;        // {width, height, tiles: [{x, y, terrain, resources, mobs, ...}]}
let _localMapSeed = null;        // Deterministic seed for consistent map generation
let _localEntryDir = null;       // Entry direction for spawn positioning
let _worldSupportTab = 'local';

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
  activatePanel('explore');
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
  if (r.data.travelCooldown > 0 && _travelReadyAt < Date.now() + r.data.travelCooldown) {
    _travelReadyAt = Date.now() + r.data.travelCooldown;
    startTravelTimer();
  }

  showScreen('game');
  activatePanel('explore');
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
  if (panelId === 'city') panelId = 'explore';
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.panel === panelId));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${panelId}`));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('hidden', p.id !== `panel-${panelId}`));
  // Lazy-load panel data
  if (panelId === 'explore' && _character) renderTileMap();
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
  startWorldClockTimer();
}

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  stopWorldClockTimer();
}

function startWorldClockTimer() {
  if (_worldClockTimer) clearInterval(_worldClockTimer);
  const updateClock = () => {
    const clock = document.getElementById('tb-world-clock');
    if (clock) clock.textContent = getLiveClockText();
  };
  updateClock();
  _worldClockTimer = setInterval(updateClock, 10000);
}

function stopWorldClockTimer() {
  if (_worldClockTimer) { clearInterval(_worldClockTimer); _worldClockTimer = null; }
}

async function pollState() {
  if (!window._activeCharId || _guestMode) return;
  const r = await API.get('/api/game/state');
  if (!r.ok) return;
  _gameState    = r.data.state;
  _character    = r.data.character;
  _cooldowns    = r.data.cooldowns || {};
  _activeAction = r.data.activeAction ?? null;
  if (r.data.travelCooldown > 0 && _travelReadyAt < Date.now() + r.data.travelCooldown) {
    _travelReadyAt = Date.now() + r.data.travelCooldown;
    startTravelTimer();
  }
  renderAll();
  updateCooldownBars();
}

// ── Render ─────────────────────────────────────────────────────
function renderAll() {
  if (!_gameState || !_character) return;
  renderTopBar();
  renderCultivatePanel();
  if (document.getElementById('panel-explore')?.classList.contains('active')) renderTileMap();
}

function getLiveClockText() {
  const now = new Date();
  const hour = now.getHours();
  const minute = String(now.getMinutes()).padStart(2, '0');
  let phase = 'Night';
  if (hour >= 5 && hour < 8) phase = 'Dawn';
  else if (hour >= 8 && hour < 12) phase = 'Morning';
  else if (hour >= 12 && hour < 17) phase = 'Afternoon';
  else if (hour >= 17 && hour < 20) phase = 'Dusk';
  return `${String(hour).padStart(2, '0')}:${minute} ${phase}`;
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
  const worldClock = document.getElementById('tb-world-clock');
  if (worldClock) worldClock.textContent = getLiveClockText();
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

  // Dantian ring labels
  const realmShort = document.getElementById('cult-realm-short');
  const stageShort = document.getElementById('cult-stage-short');
  if (realmShort) realmShort.textContent = realmName;
  if (stageShort) stageShort.textContent = stageName.replace(' Stage', '');

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

  // XP bar + substage dots
  const xpThreshold = 100 + c.realm_index * 50 + c.stage_index * 20;
  const xp = s.cultivationXp ?? 0;
  const xpPct = Math.min(100, (xp / xpThreshold) * 100);
  if (cultXpVal) cultXpVal.textContent = `${xp} / ${xpThreshold}`;
  if (cultXpFill) cultXpFill.style.width = `${xpPct.toFixed(1)}%`;
  if (cultRealm) cultRealm.textContent = `${realmName} · ${stageName}`;

  // Substage dots: fill 1 at 33%, 2 at 66%, 3 at 100%
  for (let i = 0; i < 3; i++) {
    const dot = document.getElementById(`cult-dot-${i}`);
    if (dot) dot.classList.toggle('filled', xpPct >= (i + 1) * 33.3);
  }

  // Breakthrough button pulse when ready
  const btBtn = document.getElementById('btn-breakthrough');
  if (btBtn) btBtn.classList.toggle('ready-pulse', xp >= xpThreshold);

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
  const dantianRing = document.getElementById('cult-dantian-ring');

  // Update card active states
  const CARD_MAP = { meditate: 'cult-card-meditate', trainBody: 'cult-card-trainBody', trainSoul: 'cult-card-trainSoul' };
  for (const [action, cardId] of Object.entries(CARD_MAP)) {
    document.getElementById(cardId)?.classList.toggle('is-active', action === activeKey);
  }
  if (dantianRing) dantianRing.classList.toggle('is-active', activeKey !== null);

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
}

function appendToLog(text) {
  const log = document.getElementById('event-log');
  if (log) {
    const li = document.createElement('li');
    li.textContent = text;
    log.prepend(li);
    while (log.children.length > 30) log.lastElementChild.remove();
  }

  const compact = document.getElementById('event-log-compact');
  if (compact) {
    const li = document.createElement('li');
    li.textContent = text;
    compact.prepend(li);
    while (compact.children.length > 8) compact.lastElementChild.remove();
  }
}

// ── Tile-based World Map ───────────────────────────────────────

// Ashen Frontier tile definitions. Missing keys → open land.
// t: M=mountain R=road C=city W=wild-zone F=forest X=ruin V=spirit-vein K=cave H=herb-grove B=lair .=open
// herbs/ores/mobs/afkable: harvestable resources and encounter hints per tile
const AF_SPECIAL = new Map([
  // ════════════════════════════════════════════════════════════
  // CITIES
  // ════════════════════════════════════════════════════════════
  ['4:2',  {t:'C', name:'Ember Court',        cityId:'ember'}],
  ['14:2', {t:'C', name:'Sable Forge',         cityId:'sable-forge'}],
  ['1:7',  {t:'C', name:'Char Haven',          cityId:'char-haven'}],
  ['9:6',  {t:'C', name:'Ashgate Borough',     cityId:'ashgate'}],
  ['17:6', {t:'C', name:'Grim Terrace',        cityId:'grim-terrace'}],
  ['11:12',{t:'C', name:'Cinder Bastion',      cityId:'cinder'}],
  ['22:8', {t:'C', name:'Irongate',            cityId:'irongate'}],
  ['6:21', {t:'C', name:'Dusk Haven',          cityId:'dusk-haven'}],
  ['31:4', {t:'C', name:'Voidmarch Post',      cityId:'voidmarch'}],

  // ════════════════════════════════════════════════════════════
  // ROADS — North belt
  // ════════════════════════════════════════════════════════════
  ['5:2',{t:'R'}],['6:2',{t:'R'}],['7:2',{t:'R'}],['8:2',{t:'R'}],
  ['9:2',{t:'R'}],['9:3',{t:'R'}],['9:4',{t:'R'}],['9:5',{t:'R'}],
  ['10:2',{t:'R'}],['11:2',{t:'R'}],['12:2',{t:'R'}],['13:2',{t:'R'}],
  // Ashgate → Grim Terrace
  ['10:6',{t:'R'}],['11:6',{t:'R'}],['12:6',{t:'R'}],['13:6',{t:'R'}],
  ['14:6',{t:'R'}],['15:6',{t:'R'}],['16:6',{t:'R'}],
  // Ashgate → Char Haven
  ['8:6',{t:'R'}],['7:6',{t:'R'}],['6:6',{t:'R'}],['5:6',{t:'R'}],
  ['4:6',{t:'R'}],['3:6',{t:'R'}],['2:6',{t:'R'}],['2:7',{t:'R'}],
  // Ashgate → Cinder Bastion
  ['9:7',{t:'R'}],['9:8',{t:'R'}],['9:9',{t:'R'}],['9:10',{t:'R'}],
  ['9:11',{t:'R'}],['10:11',{t:'R'}],['10:12',{t:'R'}],
  // Sable Forge → Irongate (east trade road)
  ['15:2',{t:'R'}],['16:2',{t:'R'}],['17:2',{t:'R'}],['18:2',{t:'R'}],['19:2',{t:'R'}],['20:2',{t:'R'}],
  ['20:3',{t:'R'}],['20:4',{t:'R'}],['20:5',{t:'R'}],['20:6',{t:'R'}],['20:7',{t:'R'}],['21:7',{t:'R'}],['22:7',{t:'R'}],
  // Irongate → Grim Terrace (connector)
  ['18:6',{t:'R'}],['19:6',{t:'R'}],['20:6',{t:'R'}],['21:6',{t:'R'}],['21:7',{t:'R'}],
  // Irongate south → Cinder Bastion
  ['22:9',{t:'R'}],['22:10',{t:'R'}],['21:11',{t:'R'}],['20:11',{t:'R'}],
  ['19:11',{t:'R'}],['18:12',{t:'R'}],['17:12',{t:'R'}],['16:12',{t:'R'}],['15:12',{t:'R'}],
  ['14:12',{t:'R'}],['13:12',{t:'R'}],['12:12',{t:'R'}],
  // Cinder Bastion south → Dusk Haven
  ['11:13',{t:'R'}],['10:14',{t:'R'}],['9:15',{t:'R'}],['8:16',{t:'R'}],
  ['7:17',{t:'R'}],['7:18',{t:'R'}],['6:19',{t:'R'}],['6:20',{t:'R'}],
  // Voidmarch trade route west
  ['28:4',{t:'R'}],['29:4',{t:'R'}],['30:4',{t:'R'}],
  ['27:4',{t:'R'}],['26:4',{t:'R'}],['25:4',{t:'R'}],['24:4',{t:'R'}],['23:4',{t:'R'}],['22:4',{t:'R'}],
  ['21:4',{t:'R'}],['21:3',{t:'R'}],['21:2',{t:'R'}],

  // ════════════════════════════════════════════════════════════
  // ANCIENT RUINS & EXPLORATION ZONES
  // ════════════════════════════════════════════════════════════
  // Burnt Shrines (existing)
  ['2:3',{t:'X',name:'Burnt Shrines',       hazard:2, areaId:'burnt-shrines',   mobs:['remnant-shade','ashen-spirit']}],
  ['3:3',{t:'X',name:'Burnt Shrines',       hazard:2, areaId:'burnt-shrines',   mobs:['remnant-shade']}],
  ['2:4',{t:'X',name:'Burnt Shrines',       hazard:2, areaId:'burnt-shrines',   mobs:['ashen-spirit']}],
  ['3:4',{t:'X',name:'Burnt Shrines',       hazard:2, areaId:'burnt-shrines',   mobs:['remnant-shade']}],
  ['2:5',{t:'X',name:'Burnt Shrines',       hazard:2, areaId:'burnt-shrines',   mobs:['ashen-spirit','ember-wraith']}],
  // Hollow Spire Ruins — NE of Sable Forge
  ['17:3',{t:'X',name:'Hollow Spire Ruins', hazard:3, areaId:'hollow-spire',   mobs:['stone-puppet','ancient-golem'], drops:['scroll-fragment','rune-shard']}],
  ['18:3',{t:'X',name:'Hollow Spire Ruins', hazard:3, areaId:'hollow-spire',   mobs:['stone-puppet']}],
  ['17:4',{t:'X',name:'Hollow Spire Ruins', hazard:3, areaId:'hollow-spire',   mobs:['ancient-golem'], drops:['array-ore','rune-shard']}],
  ['18:4',{t:'X',name:'Hollow Spire Ruins', hazard:3, areaId:'hollow-spire',   mobs:['stone-puppet','skeleton-guardian']}],
  // Shattered Archive — far east
  ['25:3',{t:'X',name:'Shattered Archive',  hazard:4, areaId:'shattered-archive', mobs:['archive-guardian','knowledge-wraith'], drops:['scroll-fragment','soul-amber']}],
  ['25:4',{t:'X',name:'Shattered Archive',  hazard:4, areaId:'shattered-archive', mobs:['knowledge-wraith'], drops:['scroll-fragment']}],
  ['24:3',{t:'X',name:'Shattered Archive',  hazard:4, areaId:'shattered-archive', mobs:['archive-guardian']}],
  // Ashen Cathedral — deep south, high hazard
  ['23:18',{t:'X',name:'Ashen Cathedral',   hazard:6, areaId:'ashen-cathedral',  mobs:['cathedral-revenant','stone-bishop','fallen-paragon'], drops:['legacy-shard','soul-amber','beast-core']}],
  ['24:18',{t:'X',name:'Ashen Cathedral',   hazard:6, areaId:'ashen-cathedral',  mobs:['cathedral-revenant','fallen-paragon'], drops:['legacy-shard']}],
  ['23:19',{t:'X',name:'Ashen Cathedral',   hazard:6, areaId:'ashen-cathedral',  mobs:['stone-bishop','cathedral-revenant']}],
  ['24:19',{t:'X',name:'Ashen Cathedral',   hazard:6, areaId:'ashen-cathedral',  mobs:['stone-bishop'], drops:['soul-amber','blood-jade']}],
  // Sunken Altar — southwest
  ['5:22',{t:'X',name:'Sunken Altar',       hazard:4, areaId:'sunken-altar',    mobs:['altar-remnant','sealed-wraith'], drops:['soul-amber','spirit-herb']}],
  ['5:23',{t:'X',name:'Sunken Altar',       hazard:4, areaId:'sunken-altar',    mobs:['sealed-wraith']}],
  ['4:22',{t:'X',name:'Sunken Altar',       hazard:4, areaId:'sunken-altar',    mobs:['altar-remnant']}],

  // ════════════════════════════════════════════════════════════
  // WILDERNESS ZONES
  // ════════════════════════════════════════════════════════════
  // Cinder Steppe (existing, expanded)
  ['6:9', {t:'W',name:'Cinder Steppe',      hazard:1, areaId:'cinder-steppe', mobs:['ember-hound','ash-wolf'],           herbs:['ember-root'],      afkable:true}],
  ['7:9', {t:'W',name:'Cinder Steppe',      hazard:1, areaId:'cinder-steppe', mobs:['ember-hound'],                      herbs:['ember-root'],      afkable:true}],
  ['6:10',{t:'W',name:'Cinder Steppe',      hazard:1, areaId:'cinder-steppe', mobs:['ash-wolf','cinder-lizard'],         herbs:['ember-root','char-grass']}],
  ['7:10',{t:'W',name:'Cinder Steppe',      hazard:1, areaId:'cinder-steppe', mobs:['ember-hound','ash-wolf'],           herbs:['char-grass'],      afkable:true}],
  ['6:11',{t:'W',name:'Cinder Steppe',      hazard:1, areaId:'cinder-steppe', mobs:['cinder-lizard'],                    herbs:['ember-root']}],
  ['7:11',{t:'W',name:'Cinder Steppe',      hazard:1, areaId:'cinder-steppe', mobs:['ash-wolf','ember-hound'],           herbs:['char-grass']}],
  ['8:12',{t:'W',name:'Cinder Steppe',      hazard:1, areaId:'cinder-steppe', mobs:['ember-hound'],                      herbs:['ember-root'],      afkable:true}],
  // Smoke Pits (existing, expanded)
  ['13:9', {t:'W',name:'Smoke Pits',        hazard:2, areaId:'smoke-pits',   mobs:['pit-viper','smoke-stalker'],        herbs:['ash-lotus']}],
  ['14:9', {t:'W',name:'Smoke Pits',        hazard:2, areaId:'smoke-pits',   mobs:['smoke-stalker','shadow-crawler'],   herbs:['ash-lotus','venomweed']}],
  ['13:10',{t:'W',name:'Smoke Pits',        hazard:2, areaId:'smoke-pits',   mobs:['pit-viper'],                        herbs:['venomweed'],       afkable:true}],
  ['14:10',{t:'W',name:'Smoke Pits',        hazard:2, areaId:'smoke-pits',   mobs:['smoke-stalker'],                    herbs:['ash-lotus']}],
  ['15:10',{t:'W',name:'Smoke Pits',        hazard:2, areaId:'smoke-pits',   mobs:['shadow-crawler','pit-viper'],       herbs:['ash-lotus','venomweed']}],
  ['13:11',{t:'W',name:'Smoke Pits',        hazard:2, areaId:'smoke-pits',   mobs:['smoke-stalker'],                    herbs:['venomweed']}],
  ['15:11',{t:'W',name:'Smoke Pits',        hazard:2, areaId:'smoke-pits',   mobs:['pit-viper','shadow-crawler']}],
  // Ashfen Depths — central east
  ['18:10',{t:'W',name:'Ashfen Depths',     hazard:3, areaId:'ashfen-depths', mobs:['ashfen-beast','iron-hide-boar'],   drops:['beast-core']}],
  ['19:10',{t:'W',name:'Ashfen Depths',     hazard:3, areaId:'ashfen-depths', mobs:['ashfen-beast'],                    drops:['beast-core'],     afkable:true}],
  ['18:11',{t:'W',name:'Ashfen Depths',     hazard:3, areaId:'ashfen-depths', mobs:['iron-hide-boar','blood-hound'],    drops:['beast-core','blood-jade']}],
  ['19:11',{t:'W',name:'Ashfen Depths',     hazard:3, areaId:'ashfen-depths', mobs:['blood-hound'],                     drops:['blood-jade']}],
  ['18:12',{t:'R'}], // road overrides
  // Bone Steppes — eastern badlands
  ['28:12',{t:'W',name:'Bone Steppes',      hazard:4, areaId:'bone-steppes',  mobs:['bone-scorpion','desiccated-lion'], drops:['beast-core']}],
  ['29:12',{t:'W',name:'Bone Steppes',      hazard:4, areaId:'bone-steppes',  mobs:['desiccated-lion'],                 drops:['beast-core'],     afkable:true}],
  ['28:13',{t:'W',name:'Bone Steppes',      hazard:4, areaId:'bone-steppes',  mobs:['bone-scorpion'],                   drops:['venom-gland']}],
  ['29:13',{t:'W',name:'Bone Steppes',      hazard:4, areaId:'bone-steppes',  mobs:['desiccated-lion','bone-scorpion'], drops:['beast-core','venom-gland']}],
  ['30:12',{t:'W',name:'Bone Steppes',      hazard:4, areaId:'bone-steppes',  mobs:['bone-scorpion']}],
  // Cinder Lake Basin
  ['14:15',{t:'W',name:'Cinder Lake Basin', hazard:2, areaId:'cinder-basin',  mobs:['lava-crab','ember-newt'],          herbs:['flame-wort']}],
  ['15:15',{t:'W',name:'Cinder Lake Basin', hazard:2, areaId:'cinder-basin',  mobs:['lava-crab'],                       herbs:['flame-wort'],     afkable:true}],
  ['14:16',{t:'W',name:'Cinder Lake Basin', hazard:2, areaId:'cinder-basin',  mobs:['ember-newt','lava-crab'],          herbs:['flame-wort','ember-root']}],
  ['15:16',{t:'W',name:'Cinder Lake Basin', hazard:2, areaId:'cinder-basin',  mobs:['ember-newt']}],
  // Serpent Coil Mire — eastern marshes
  ['27:10',{t:'W',name:'Serpent Coil Mire', hazard:4, areaId:'serpent-mire',  mobs:['coil-serpent','marsh-hydra'],      drops:['venom-gland'], herbs:['marsh-lotus']}],
  ['28:10',{t:'W',name:'Serpent Coil Mire', hazard:4, areaId:'serpent-mire',  mobs:['coil-serpent'],                    drops:['venom-gland'], herbs:['marsh-lotus'], afkable:true}],
  ['27:11',{t:'W',name:'Serpent Coil Mire', hazard:4, areaId:'serpent-mire',  mobs:['marsh-hydra','coil-serpent'],      drops:['venom-gland','beast-core']}],
  ['28:11',{t:'W',name:'Serpent Coil Mire', hazard:4, areaId:'serpent-mire',  mobs:['coil-serpent']}],
  // Dusk Valley — near Dusk Haven
  ['7:20', {t:'W',name:'Dusk Valley',       hazard:2, areaId:'dusk-valley',   mobs:['dusk-wolf','shadow-deer'],         herbs:['nightbloom'],  afkable:true}],
  ['8:20', {t:'W',name:'Dusk Valley',       hazard:2, areaId:'dusk-valley',   mobs:['dusk-wolf'],                       herbs:['nightbloom','moonveil-grass']}],
  ['7:21', {t:'W',name:'Dusk Valley',       hazard:2, areaId:'dusk-valley',   mobs:['shadow-deer','dusk-wolf'],         herbs:['moonveil-grass']}],
  ['8:21', {t:'W',name:'Dusk Valley',       hazard:2, areaId:'dusk-valley',   mobs:['shadow-deer'],                     herbs:['nightbloom'],  afkable:true}],

  // ════════════════════════════════════════════════════════════
  // BEAST LAIRS
  // ════════════════════════════════════════════════════════════
  ['3:13',{t:'B',name:'Wolfpack Den',         hazard:2, areaId:'wolfpack-den',    mobs:['iron-fang-wolf','pack-leader'],     drops:['beast-core']}],
  ['3:14',{t:'B',name:'Wolfpack Den',         hazard:2, areaId:'wolfpack-den',    mobs:['iron-fang-wolf'],                   drops:['beast-core'],     afkable:true}],
  ['4:13',{t:'B',name:'Wolfpack Den',         hazard:2, areaId:'wolfpack-den',    mobs:['pack-leader','iron-fang-wolf'],     drops:['beast-core']}],
  ['26:8',{t:'B',name:'Emberclaw Roost',      hazard:3, areaId:'emberclaw-roost', mobs:['emberclaw-hawk','fire-crow'],       drops:['beast-core','embersteel-ingot']}],
  ['27:8',{t:'B',name:'Emberclaw Roost',      hazard:3, areaId:'emberclaw-roost', mobs:['emberclaw-hawk'],                   drops:['beast-core']}],
  ['26:9',{t:'B',name:'Emberclaw Roost',      hazard:3, areaId:'emberclaw-roost', mobs:['fire-crow','emberclaw-hawk'],       drops:['beast-core'],     afkable:true}],
  ['20:21',{t:'B',name:'Thundermaw Lair',     hazard:5, areaId:'thundermaw-lair', mobs:['thundermaw-beast','chaos-tiger'],   drops:['beast-core','array-ore'], herbs:['lightning-root']}],
  ['21:21',{t:'B',name:'Thundermaw Lair',     hazard:5, areaId:'thundermaw-lair', mobs:['chaos-tiger'],                     drops:['beast-core']}],
  ['20:22',{t:'B',name:'Thundermaw Lair',     hazard:5, areaId:'thundermaw-lair', mobs:['thundermaw-beast'],                drops:['beast-core','array-ore'], afkable:true}],

  // ════════════════════════════════════════════════════════════
  // CAVES & MINES
  // ════════════════════════════════════════════════════════════
  ['8:4', {t:'K',name:'Iron Gorge Cave',       hazard:2, areaId:'iron-gorge',      ores:['iron-ore','rough-crystal'],        drops:['black-iron-ore']}],
  ['8:5', {t:'K',name:'Iron Gorge Cave',       hazard:2, areaId:'iron-gorge',      ores:['iron-ore'],                        drops:['black-iron-ore'],  afkable:true}],
  ['7:4', {t:'K',name:'Iron Gorge Cave',       hazard:2, areaId:'iron-gorge',      ores:['rough-crystal','iron-ore'],        drops:['array-ore']}],
  ['25:15',{t:'K',name:'Obsidian Cavern',      hazard:4, areaId:'obsidian-cavern', ores:['obsidian-vein','dark-crystal'],    drops:['black-iron-ore','array-ore']}],
  ['26:15',{t:'K',name:'Obsidian Cavern',      hazard:4, areaId:'obsidian-cavern', ores:['obsidian-vein'],                   drops:['black-iron-ore'],  afkable:true}],
  ['25:16',{t:'K',name:'Obsidian Cavern',      hazard:4, areaId:'obsidian-cavern', ores:['dark-crystal','obsidian-vein'],    drops:['array-ore','embersteel-ingot']}],
  ['16:21',{t:'K',name:'Deep Sorrow Mines',    hazard:3, areaId:'deep-sorrow',     ores:['sorrow-coal','jade-seam'],         drops:['blood-jade','array-ore']}],
  ['16:22',{t:'K',name:'Deep Sorrow Mines',    hazard:3, areaId:'deep-sorrow',     ores:['jade-seam','sorrow-coal'],         drops:['blood-jade'],      afkable:true}],
  ['17:21',{t:'K',name:'Deep Sorrow Mines',    hazard:3, areaId:'deep-sorrow',     ores:['sorrow-coal'],                     drops:['array-ore']}],
  ['13:23',{t:'K',name:'Hollow Earth Vent',    hazard:5, areaId:'hollow-vent',     ores:['fire-crystal','embersteel-raw'],   drops:['embersteel-ingot','array-ore'], mobs:['vent-salamander']}],
  ['14:23',{t:'K',name:'Hollow Earth Vent',    hazard:5, areaId:'hollow-vent',     ores:['embersteel-raw','fire-crystal'],   drops:['embersteel-ingot'],afkable:true}],
  ['33:12',{t:'K',name:'Void Crack Mines',     hazard:6, areaId:'void-mines',      ores:['void-shard','array-ore'],          drops:['array-ore','soul-amber'], mobs:['void-crawler']}],
  ['33:13',{t:'K',name:'Void Crack Mines',     hazard:6, areaId:'void-mines',      ores:['void-shard'],                      drops:['soul-amber'],      afkable:true}],

  // ════════════════════════════════════════════════════════════
  // HERB GROVES
  // ════════════════════════════════════════════════════════════
  ['4:12',{t:'H',name:'Mistwing Hollow',       hazard:1, areaId:'mistwing',        herbs:['spirit-herb','moonveil-grass'],   afkable:true}],
  ['4:14',{t:'H',name:'Mistwing Hollow',       hazard:1, areaId:'mistwing',        herbs:['spirit-herb','char-grass']}],
  ['5:13',{t:'H',name:'Mistwing Hollow',       hazard:1, areaId:'mistwing',        herbs:['moonveil-grass','spirit-herb'],   afkable:true}],
  ['5:14',{t:'H',name:'Mistwing Hollow',       hazard:1, areaId:'mistwing',        herbs:['spirit-herb']}],
  ['18:16',{t:'H',name:'Jade Creek Herb Beds', hazard:1, areaId:'jade-creek',      herbs:['jade-petal','spirit-herb'],       afkable:true}],
  ['18:17',{t:'H',name:'Jade Creek Herb Beds', hazard:1, areaId:'jade-creek',      herbs:['jade-petal','moonveil-grass']}],
  ['19:17',{t:'H',name:'Jade Creek Herb Beds', hazard:1, areaId:'jade-creek',      herbs:['jade-petal'],                     afkable:true}],
  ['11:17',{t:'H',name:'Ember Reed Marsh',     hazard:1, areaId:'ember-marsh',     herbs:['ember-root','ash-lotus'],         afkable:true}],
  ['12:17',{t:'H',name:'Ember Reed Marsh',     hazard:1, areaId:'ember-marsh',     herbs:['ember-root','flame-wort']}],
  ['11:18',{t:'H',name:'Ember Reed Marsh',     hazard:1, areaId:'ember-marsh',     herbs:['ash-lotus','ember-root'],         afkable:true}],
  ['29:6', {t:'H',name:'Windbloom Plateau',    hazard:1, areaId:'windbloom',       herbs:['windbloom','spirit-herb'],        afkable:true}],
  ['30:6', {t:'H',name:'Windbloom Plateau',    hazard:1, areaId:'windbloom',       herbs:['windbloom']}],
  ['29:7', {t:'H',name:'Windbloom Plateau',    hazard:1, areaId:'windbloom',       herbs:['spirit-herb','windbloom'],        afkable:true}],
  ['9:23', {t:'H',name:'Moonshade Grotto',     hazard:2, areaId:'moonshade',       herbs:['moon-dew-fungus','nightbloom'],   afkable:true}],
  ['10:23',{t:'H',name:'Moonshade Grotto',     hazard:2, areaId:'moonshade',       herbs:['moon-dew-fungus'],                afkable:true}],
  ['10:24',{t:'H',name:'Moonshade Grotto',     hazard:2, areaId:'moonshade',       herbs:['nightbloom','moon-dew-fungus']}],

  // ════════════════════════════════════════════════════════════
  // SPIRIT VEINS
  // ════════════════════════════════════════════════════════════
  ['6:3',  {t:'V',name:'Ashen Spirit Vein',    spiritDensity:3, herbs:['spirit-herb']}],
  ['14:8', {t:'V',name:'Eastern Vein',          spiritDensity:2}],
  ['11:19',{t:'V',name:'Jade Vale Vein',        spiritDensity:3, herbs:['jade-petal','spirit-herb']}],
  ['12:20',{t:'V',name:'Jade Vale Vein',        spiritDensity:3, herbs:['jade-petal']}],
  ['20:15',{t:'V',name:'Deep Meridian Vein',    spiritDensity:4, herbs:['spirit-herb']}],
  ['21:15',{t:'V',name:'Deep Meridian Vein',    spiritDensity:4}],
  ['20:16',{t:'V',name:'Deep Meridian Vein',    spiritDensity:4, herbs:['spirit-herb']}],
  ['32:6', {t:'V',name:'Void Edge Seep',        spiritDensity:5, herbs:['soul-amber']}],
  ['32:7', {t:'V',name:'Void Edge Seep',        spiritDensity:5}],
  ['3:20', {t:'V',name:'Southern Spirit Pool',  spiritDensity:2, herbs:['moonveil-grass','spirit-herb']}],

  // ════════════════════════════════════════════════════════════
  // FORESTS
  // ════════════════════════════════════════════════════════════
  // Western forest cluster
  ['3:8', {t:'F',name:'Charwood Forest',       herbs:['char-grass','ember-root'],    mobs:['forest-snake','shadow-deer'],    afkable:true}],
  ['4:8', {t:'F',name:'Charwood Forest',       herbs:['char-grass'],                  mobs:['forest-snake']}],
  ['3:9', {t:'F',name:'Charwood Forest',       herbs:['ember-root','char-grass'],    mobs:['shadow-deer','ash-wolf'],        afkable:true}],
  ['4:9', {t:'F',name:'Charwood Forest',       herbs:['char-grass'],                  mobs:['ash-wolf']}],
  // Central forest patch
  ['11:8',{t:'F',name:'Ashwood Thicket',       herbs:['spirit-herb','ash-lotus'],    mobs:['spirit-fox','ash-bear'],         afkable:true}],
  ['12:8',{t:'F',name:'Ashwood Thicket',       herbs:['ash-lotus'],                   mobs:['ash-bear']}],
  ['11:9',{t:'F',name:'Ashwood Thicket',       herbs:['spirit-herb'],                 mobs:['spirit-fox','shadow-deer'],      afkable:true}],
  ['12:9',{t:'F',name:'Ashwood Thicket',       herbs:['ash-lotus','spirit-herb'],    mobs:['ash-bear','spirit-fox']}],
  // Northern pine vale
  ['16:3',{t:'F',name:'Northern Pine Vale',    herbs:['pine-resin','char-grass'],    mobs:['pine-wolf']}],
  ['16:4',{t:'F',name:'Northern Pine Vale',    herbs:['pine-resin'],                  mobs:['pine-wolf','forest-snake'],      afkable:true}],
  ['17:5',{t:'F',name:'Northern Pine Vale',    herbs:['char-grass','pine-resin'],    mobs:['pine-wolf']}],
  // Eastern canopy reach
  ['24:9',{t:'F',name:'Eastern Canopy Reach',  herbs:['rare-spore','spirit-herb'],   mobs:['canopy-gecko','wind-lynx'],      afkable:true}],
  ['24:10',{t:'F',name:'Eastern Canopy Reach', herbs:['rare-spore'],                  mobs:['wind-lynx']}],
  ['25:9',{t:'F',name:'Eastern Canopy Reach',  herbs:['spirit-herb','rare-spore'],   mobs:['canopy-gecko'],                  afkable:true}],
  ['25:10',{t:'F',name:'Eastern Canopy Reach', herbs:['rare-spore'],                  mobs:['wind-lynx','canopy-gecko']}],
  // Mosswall preserve
  ['32:13',{t:'F',name:'Mosswall Preserve',    herbs:['moon-dew-fungus','rare-spore'],mobs:['fungal-creeper']}],
  ['32:14',{t:'F',name:'Mosswall Preserve',    herbs:['moon-dew-fungus'],             mobs:['fungal-creeper'],               afkable:true}],
  // Southern bone forest
  ['8:18',{t:'F',name:'Bone Tree Grove',       herbs:['nightbloom'],                  mobs:['bone-dryad','shadow-deer']}],
  ['8:19',{t:'F',name:'Bone Tree Grove',       herbs:['nightbloom','moonveil-grass'], mobs:['bone-dryad'],                   afkable:true}],
  ['9:18',{t:'F',name:'Bone Tree Grove',       herbs:['moonveil-grass'],              mobs:['shadow-deer','bone-dryad']}],
  ['9:19',{t:'F',name:'Bone Tree Grove',       herbs:['nightbloom'],                  mobs:['bone-dryad']}],
  // Deep spirit grove
  ['22:19',{t:'F',name:'Deep Spirit Grove',    herbs:['soul-amber','spirit-herb'],   mobs:['spirit-stag','jade-serene'],     afkable:true}],
  ['23:20',{t:'F',name:'Deep Spirit Grove',    herbs:['spirit-herb','soul-amber'],   mobs:['jade-serene']}],
  ['22:20',{t:'F',name:'Deep Spirit Grove',    herbs:['soul-amber'],                  mobs:['spirit-stag'],                  afkable:true}],
]);

const AF_W = 36, AF_H = 26;
const TILE_GLYPHS = { M:'▲', R:'·', C:'⌂', W:'≋', F:'♦', X:'✦', V:'◎', K:'⛏', H:'✿', B:'⊛', '.':'·' };
const TILE_TERRAIN_NAMES = {
  M:'Mountain', R:'Road', C:'City', W:'Wilderness Zone',
  F:'Forest', X:'Ancient Ruin', V:'Spirit Vein', K:'Cave/Mine',
  H:'Herb Grove', B:'Beast Lair', '.':'Open Land'
};
const TILE_SIZE = 34;

function getAfTile(x, y) {
  if (x <= 0 || x >= AF_W - 1 || y <= 0 || y >= AF_H - 1) return { t:'M' };
  return AF_SPECIAL.get(`${x}:${y}`) ?? { t:'.' };
}

function getRegionTile(regionId, x, y) {
  if (regionId === 'ashen-frontier') return getAfTile(x, y);
  return { t:'M' }; // other regions fully fogged for now
}

function getRenderedRegionId(state = _gameState) {
  const regionId = state?.regionId ?? 'ashen-frontier';
  return regionId === 'ashen-frontier' ? regionId : 'ashen-frontier';
}

function titleizeSlug(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function slugifyWorld(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getTileIntelGroups(tile) {
  return [
    { key: 'herbs', label: 'Herb Signals', items: tile.herbs || [], chipClass: 'tag-herb' },
    { key: 'ores', label: 'Ore Veins', items: tile.ores || [], chipClass: 'tag-ore' },
    { key: 'mobs', label: 'Roaming Threats', items: tile.mobs || [], chipClass: 'tag-mob' },
    { key: 'drops', label: 'Possible Drops', items: tile.drops || [], chipClass: 'tag-drop' }
  ].filter(group => group.items.length > 0);
}

function getTileAreaProfile(tile) {
  const areaCatalog = typeof GAME_CONSTANTS !== 'undefined'
    ? (GAME_CONSTANTS.explorationAreas || [])
    : [];
  const catalogArea = tile.areaId ? areaCatalog.find(area => area.id === tile.areaId) : null;

  let inferredType = 'frontier';
  if (tile.t === 'C') inferredType = 'city';
  else if (tile.t === 'X') inferredType = 'ruins';
  else if (tile.t === 'K') inferredType = 'mine';
  else if (tile.t === 'H') inferredType = 'herb-grove';
  else if (tile.t === 'B') inferredType = 'lair';
  else if (tile.t === 'V') inferredType = 'spirit-vein';
  else if (tile.t === 'F') inferredType = 'forest';
  else if (tile.t === 'W') inferredType = 'wilderness';
  else if (tile.t === 'R') inferredType = 'road';

  let inferredFocus = 'exploration';
  if (tile.herbs?.length) inferredFocus = 'herb';
  else if (tile.ores?.length) inferredFocus = 'ore';
  else if (tile.mobs?.length) inferredFocus = 'beasts';
  else if (tile.drops?.length) inferredFocus = 'relic';
  else if (tile.spiritDensity) inferredFocus = 'spirit';
  else if (tile.cityId) inferredFocus = 'trade';

  const detailBits = [];
  if (tile.hazard) detailBits.push(`hazard ${tile.hazard}`);
  if (tile.spiritDensity) detailBits.push(`spirit density ×${tile.spiritDensity}`);
  if (tile.afkable) detailBits.push('repeatable field loop');
  if (!detailBits.length) detailBits.push('no dense node cluster mapped yet');

  const flavorBits = [];
  if (tile.herbs?.length) flavorBits.push('wild herbs are surfacing');
  if (tile.ores?.length) flavorBits.push('mineral seams are visible');
  if (tile.mobs?.length) flavorBits.push('predator trails cut through the ground');
  if (tile.drops?.length) flavorBits.push('broken relic traces remain');
  if (tile.cityId) flavorBits.push('civil traffic and services anchor the tile');
  if (tile.spiritDensity) flavorBits.push('ambient qi gathers here');

  return {
    id: tile.areaId || tile.cityId || inferredType,
    name: catalogArea?.name || tile.name || TILE_TERRAIN_NAMES[tile.t] || 'Unknown Ground',
    typeLabel: titleizeSlug(catalogArea?.type || inferredType),
    focusLabel: titleizeSlug(catalogArea?.focus || inferredFocus),
    danger: catalogArea?.danger ?? tile.hazard ?? 0,
    description: flavorBits.length
      ? `${flavorBits.join(', ')}.`
      : 'Quiet ground for now, with only light signs of recent movement.',
    summary: `Primary read: ${detailBits.join(' · ')}.`
  };
}

function countVisitedTiles(visited, regionId) {
  let count = 0;
  for (const key of visited) {
    if (key.startsWith(`${regionId}:`)) count += 1;
  }
  return count;
}

function getTileIdentity(tile, x, y) {
  return `${tile.areaId || tile.cityId || tile.t}:${x}:${y}`;
}

function getActiveTravelRoute() {
  if (!_travelRoute) return null;
  if (_travelRoute.readyAt <= Date.now()) return null;
  return _travelRoute;
}

function getTravelProgress(route = getActiveTravelRoute()) {
  if (!route) return 1;
  const total = Math.max(1, route.readyAt - route.startedAt);
  return Math.max(0, Math.min(1, (Date.now() - route.startedAt) / total));
}

function getVisualTravelPosition(route = getActiveTravelRoute()) {
  if (!route) {
    return { x: _gameState?.tileX ?? 9, y: _gameState?.tileY ?? 6 };
  }
  const progress = getTravelProgress(route);
  return {
    x: route.fromX + (route.toX - route.fromX) * progress,
    y: route.fromY + (route.toY - route.fromY) * progress
  };
}

function getTileEntryDirection(x, y) {
  const entry = _travelRoute || _lastTileEntry;
  if (!entry || entry.toX !== x || entry.toY !== y) return null;
  const dx = x - entry.fromX;
  const dy = y - entry.fromY;
  if (dx === 0 && dy === 0) return null;
  const horiz = dx === 0 ? '' : dx > 0 ? 'west' : 'east';
  const vert = dy === 0 ? '' : dy > 0 ? 'north' : 'south';
  return [vert, horiz].filter(Boolean).join('-');
}

function updateWorldViewToggle() {
  const shell = document.querySelector('.world-shell');
  const btn = document.getElementById('btn-toggle-world-view');
  if (shell) shell.classList.toggle('focus-local', _viewMode === 'local');
  if (btn) btn.textContent = _viewMode === 'local' ? 'Back to World Map' : 'Explore Local Tile';
}

function updateWorldSupportTabs() {
  document.querySelectorAll('[data-world-tab]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.worldTab === _worldSupportTab);
  });
  document.querySelectorAll('[data-world-tab-panel]').forEach(panel => {
    panel.classList.toggle('is-active', panel.dataset.worldTabPanel === _worldSupportTab);
  });
}

function setWorldSupportTab(tab) {
  _worldSupportTab = tab;
  updateWorldSupportTabs();
}

function toggleWorldView() {
  closeInteractionModal();
  if (_viewMode === 'local') {
    // Exit local view back to world
    exitLocalTileView();
  } else {
    // Enter local view (if on valid tile)
    const regionId = getRenderedRegionId(_gameState);
    const x = _gameState?.tileX ?? 9;
    const y = _gameState?.tileY ?? 6;
    const tile = getRegionTile(regionId, x, y);
    if (tile.t !== 'M') { // Can't explore mountains
      enterLocalTileView(x, y, regionId);
    } else {
      showToast('Cannot explore mountains in detail.', 'warn');
      return;
    }
  }
  setWorldSupportTab('local');
  updateWorldViewToggle();
  renderTileMap();
  renderAll();
}

// ── Procedural mini-map generation ──────────────────────────────
function getMapSizeForTile(tile) {
  // Determine mini-map size based on tile type and properties
  // Larger/denser areas = bigger maps
  const base = {
    'C': 15,  // Cities: moderate size
    'H': 12,  // Herb groves: medium
    'K': 14,  // Caves: exploration-heavy
    'X': 18,  // Ruins: large and complex
    'B': 16,  // Lairs: predator territory
    'V': 10,  // Spirit veins: concentrated
    'F': 14,  // Forests: sprawling
    'W': 16,  // Wilderness: vast
    'R': 8,   // Roads: linear/narrow
    '.': 12   // Open land: moderate
  }[tile.t] || 12;
  
  // Hazard areas = bigger maps to navigate dangers
  if (tile.hazard && tile.hazard >= 4) return Math.min(30, base + 8);
  
  // Spirit-dense = slightly bigger
  if (tile.spiritDensity && tile.spiritDensity >= 4) return Math.min(25, base + 4);
  
  return base;
}

function seededRandom(seed, offset = 0) {
  // Simple seeded PRNG for deterministic generation
  const x = Math.sin((seed + offset) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function generateLocalMap(tile, x, y, entryDir) {
  // Generate a procedural mini-map for the given world tile
  const seed = x * 73856093 ^ y * 19349663 ^ (tile.t.charCodeAt(0) * 83492791);
  const size = getMapSizeForTile(tile);
  const mid = Math.floor(size / 2);
  const tiles = [];
  
  // Base terrain pass
  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) {
      let terrain = '.'; // Default open
      let terrain_kind = 'travel';
      
      // Edges/border (depending on tile type and entry)
      const distFromEdge = Math.min(tx, ty, size - 1 - tx, size - 1 - ty);
      if (distFromEdge === 0) {
        terrain = '#'; // Border
        terrain_kind = 'border';
      } else if (distFromEdge <= 1) {
        terrain = tile.t === 'F' ? 'F' : tile.t === 'X' ? 'F' : tile.t === 'B' ? 'F' : '.';
        terrain_kind = 'fringe';
      }
      
      // Interior: apply tile-specific terrain
      if (distFromEdge >= 2) {
        if (tile.t === 'C') {
          // City: central plaza, roads, buildings
          if (tx === mid && ty === mid) terrain = 'P'; // Plaza
          else if (tx === mid || ty === mid) terrain = 'R'; // Road
          else terrain = 'C'; // Building block / civic lane
          terrain_kind = 'civic';
        } else if (tile.t === 'H') {
          terrain = 'H'; // Herb garden
          terrain_kind = 'gather';
        } else if (tile.t === 'K') {
          if (tx === mid && ty === mid) terrain = 'S'; // Seam center
          else if (Math.abs(tx - mid) <= 1 && Math.abs(ty - mid) <= 1) terrain = 'S'; // Main seam zone
          else terrain = 'M'; // Mine tunnel
          terrain_kind = 'ore';
        } else if (tile.t === 'X') {
          if (tx === mid && ty === mid) terrain = 'A'; // Altar/artifact
          else terrain = 'R'; // Ruin rubble
          terrain_kind = 'relic';
        } else if (tile.t === 'B') {
          if (tx === mid && ty === mid) terrain = 'D'; // Den center
          else terrain = 'T'; // Trail
          terrain_kind = 'mob';
        } else if (tile.t === 'V') {
          if (tx === mid && ty === mid) terrain = 'Q'; // Qi convergence
          else terrain = 'M'; // Mist
          terrain_kind = 'spirit';
        } else if (tile.t === 'F') {
          terrain = 'F'; // Forest
          terrain_kind = 'gather';
        } else if (tile.t === 'W') {
          terrain = 'W'; // Wilderness
          terrain_kind = 'travel';
        }
      }
      
      tiles.push({ x: tx, y: ty, terrain, terrain_kind, resources: [], mobs: [], hazards: [] });
    }
  }
  
  // Scatter resources based on parent tile
  const numResources = Math.max(2, Math.floor(size / 3));
  for (let i = 0; i < numResources; i++) {
    const rand = seededRandom(seed, i * 100);
    const tx = Math.floor(rand * (size - 4) + 2);
    const ty = Math.floor(seededRandom(seed, i * 100 + 1) * (size - 4) + 2);
    const tileIdx = ty * size + tx;
    if (tileIdx >= 0 && tileIdx < tiles.length) {
      if (tile.herbs?.length) tiles[tileIdx].resources.push(...tile.herbs.slice(0, 2));
      else if (tile.ores?.length) tiles[tileIdx].resources.push(...tile.ores.slice(0, 2));
      else if (tile.drops?.length) tiles[tileIdx].resources.push(tile.drops[0]);
    }
  }
  
  // Scatter mobs if present
  if (tile.mobs?.length) {
    const numMobs = Math.max(1, Math.floor(size / 4));
    for (let i = 0; i < numMobs; i++) {
      const rand = seededRandom(seed, i * 200 + 50);
      const tx = Math.floor(rand * (size - 4) + 2);
      const ty = Math.floor(seededRandom(seed, i * 200 + 51) * (size - 4) + 2);
      const tileIdx = ty * size + tx;
      if (tileIdx >= 0 && tileIdx < tiles.length) {
        tiles[tileIdx].mobs.push(tile.mobs[i % tile.mobs.length]);
      }
    }
  }
  
  // Add hazards
  if (tile.hazard && tile.hazard >= 2) {
    const numHazards = Math.ceil(tile.hazard / 2);
    for (let i = 0; i < numHazards; i++) {
      const rand = seededRandom(seed, i * 300 + 100);
      const tx = Math.floor(rand * (size - 4) + 2);
      const ty = Math.floor(seededRandom(seed, i * 300 + 101) * (size - 4) + 2);
      const tileIdx = ty * size + tx;
      if (tileIdx >= 0 && tileIdx < tiles.length) {
        tiles[tileIdx].hazards.push(`hazard-${tile.hazard}`);
      }
    }
  }

  const mapData = { width: size, height: size, tiles };
  if (tile.t === 'C') {
    decorateLocalCityMap(tile, mapData);
  }
  return mapData;
}

function getLocalMapTile(mapData, x, y) {
  if (!mapData) return null;
  if (x < 0 || y < 0 || x >= mapData.width || y >= mapData.height) return null;
  return mapData.tiles[y * mapData.width + x] || null;
}

function applyLocalMapFeature(mapData, x, y, feature) {
  const subtile = getLocalMapTile(mapData, x, y);
  if (!subtile) return;
  Object.assign(subtile, feature);
  if (feature.resources) subtile.resources = [...new Set([...(subtile.resources || []), ...feature.resources])];
  if (feature.mobs) subtile.mobs = [...new Set([...(subtile.mobs || []), ...feature.mobs])];
  if (feature.hazards) subtile.hazards = [...new Set([...(subtile.hazards || []), ...feature.hazards])];
}

function decorateLocalCityMap(tile, mapData) {
  if (tile.cityId !== 'ashgate') return;

  const mid = Math.floor(mapData.width / 2);
  const features = [
    { x: mid, y: mid, terrain: 'P', terrain_kind: 'central plaza', label: 'Ashgate Plaza', district: 'Central Plaza', npcName: 'Marshal Sen', service: 'plaza' },
    { x: mid - 2, y: mid, terrain: 'C', terrain_kind: 'guild hall', label: 'Iron Guild Hall', district: 'Guild Ward', npcName: 'Registrar Kesh', service: 'guild', questHook: 'Register with Iron Guild' },
    { x: mid + 2, y: mid, terrain: 'C', terrain_kind: 'sect court', label: 'Ashen Frontier Sect Court', district: 'Sect Court', npcName: 'Outer Disciple Ren', service: 'sect', questHook: 'Petition Ashen Frontier Sect' },
    { x: mid - 3, y: mid + 2, terrain: 'C', terrain_kind: 'vault hall', label: 'Silver Vault', district: 'Ledger Ward', npcName: 'Vault Clerk Mina', service: 'bank' },
    { x: mid + 3, y: mid - 2, terrain: 'C', terrain_kind: 'archive hall', label: 'Technique Archive', district: 'Scriptorium', npcName: 'Archivist Pei', service: 'techniques' },
    { x: mid + 1, y: mid + 3, terrain: 'C', terrain_kind: 'patron hall', label: 'Patron Hall', district: 'Broker Court', npcName: 'Broker Nuo', service: 'patron' },
    { x: mid - 3, y: mid - 1, terrain: 'C', terrain_kind: 'forge lane', label: 'Blacksmith Lane', district: 'Forge Row', npcName: 'Smith Haro', service: 'blacksmith', questHook: 'Stolen Weapon Recovered' },
    { x: mid, y: mid - 3, terrain: 'R', terrain_kind: 'duel ring', label: 'Street Duel Ring', district: 'Plaza Ring', npcName: 'Showoff Jian', service: 'duel', questHook: 'Street Duel Challenge', mobs: ['plaza-showoff'] },
    { x: mid + 3, y: mid - 4, terrain: 'R', terrain_kind: 'scout post', label: 'Fangkou Scout Post', district: 'East Gate Lane', npcName: 'Scout Ilya', service: 'rumor', questHook: 'Forgotten Fangkou Grove' }
  ];

  features.forEach(feature => applyLocalMapFeature(mapData, feature.x, feature.y, feature));
  mapData.cityRoster = features.map(({ npcName, label, service, district, questHook }) => ({ npcName, label, service, district, questHook }));
}

function getLocalMapSpawnPos(entryDir, mapWidth, mapHeight) {
  // Player spawns on opposite edge from entry direction
  let x = Math.floor(mapWidth / 2);
  let y = Math.floor(mapHeight / 2);
  
  if (!entryDir) return { x, y };
  
  if (entryDir.includes('west')) {
    x = mapWidth - 2; // Enter from west = spawn near east edge
  } else if (entryDir.includes('east')) {
    x = 1; // Enter from east = spawn near west edge
  }
  
  if (entryDir.includes('north')) {
    y = mapHeight - 2; // Enter from north = spawn near south edge
  } else if (entryDir.includes('south')) {
    y = 1; // Enter from south = spawn near north edge
  }
  
  return { x, y };
}

function enterLocalTileView(worldX, worldY, regionId) {
  // Switch to local view for a world tile
  const tile = getRegionTile(regionId, worldX, worldY);
  const entryDir = getTileEntryDirection(worldX, worldY);
  
  _viewMode = 'local';
  _localViewTile = { x: worldX, y: worldY, regionId };
  _localMapData = generateLocalMap(tile, worldX, worldY, entryDir);
  _localEntryDir = entryDir;
  
  const spawnPos = getLocalMapSpawnPos(entryDir, _localMapData.width, _localMapData.height);
  _localPlayerX = spawnPos.x;
  _localPlayerY = spawnPos.y;
  updateWorldViewToggle();
}

function exitLocalTileView() {
  // Switch back to world view
  _viewMode = 'world';
  _localViewTile = null;
  _localMapData = null;
  _localPlayerX = null;
  _localPlayerY = null;
  updateWorldViewToggle();
}

function moveLocalPlayer(tx, ty) {
  if (!_localMapData) return false;
  if (tx < 0 || tx >= _localMapData.width || ty < 0 || ty >= _localMapData.height) return false;
  if (_localPlayerX !== null && _localPlayerY !== null) {
    const distance = Math.abs(tx - _localPlayerX) + Math.abs(ty - _localPlayerY);
    if (distance > 1) return false;
  }

  if (tx < 0 || tx >= _localMapData.width || ty < 0 || ty >= _localMapData.height) return false;
  const tile = _localMapData.tiles[ty * _localMapData.width + tx];
  if (!tile || tile.terrain === '#') return false;
  
  _localPlayerX = tx;
  _localPlayerY = ty;
  return true;
}

function getLocalPlayerTile() {
  if (!_localMapData || _localPlayerX === null || _localPlayerY === null) return null;
  return _localMapData.tiles[_localPlayerY * _localMapData.width + _localPlayerX] || null;
}

function getVisiblePlayers() {
  return Array.isArray(_gameState?.visiblePlayers) ? _gameState.visiblePlayers : [];
}

function getLocalActionForSubtile(worldTile, subtile) {
  if (!subtile) return null;
  if (subtile.mobs?.length) return 'mobs';
  if (subtile.resources?.length) {
    if (worldTile.herbs?.length) return 'herbs';
    if (worldTile.ores?.length) return 'ores';
    if (worldTile.drops?.length || worldTile.t === 'X') return 'relic';
  }
  if (worldTile.spiritDensity && (subtile.terrain === 'Q' || subtile.terrain === 'M')) return 'spirit';
  return null;
}

function getAshgateQuestEntries() {
  return [
    { title: 'Register with Iron Guild', badgeLabel: 'guild', rarity: 'common', meta: 'Gain faction access, a stipend, and guild contracts.' },
    { title: 'Petition Ashen Frontier Sect', badgeLabel: 'sect', rarity: 'common', meta: 'Seek outer court affiliation and sect-backed work.' },
    { title: 'Forgotten Fangkou Grove', badgeLabel: 'common', rarity: 'common', meta: 'You discover an untouched grove radiating with spirit essence.' },
    { title: 'Street Duel Challenge', badgeLabel: 'uncommon', rarity: 'uncommon', meta: 'A plaza showoff is baiting passersby into public duels.', sense: 'Soul Sense: Their meridians flicker unevenly. The bravado is real, but the circulation underneath it is unstable and easy to bait.' },
    { title: 'Stolen Weapon Recovered', badgeLabel: 'common', rarity: 'common', meta: 'You track down a thief who robbed a blacksmith.' }
  ];
}

function getAshgateRoster() {
  return [
    { title: 'Registrar Kesh', badgeLabel: 'guild', rarity: 'common', meta: 'Iron Guild clerk handling contracts, stipends, and starter registration.' },
    { title: 'Outer Disciple Ren', badgeLabel: 'sect', rarity: 'common', meta: 'Ashen Frontier Sect representative screening recruits and errands.' },
    { title: 'Broker Nuo', badgeLabel: 'patron', rarity: 'common', meta: 'Patron Hall broker tracking requests, rumors, and quiet commissions.' },
    { title: 'Showoff Jian', badgeLabel: 'duel', rarity: 'uncommon', meta: 'Arena loudmouth drawing challengers into public tests of nerve.' }
  ];
}

function closeInteractionModal() {
  const modal = document.getElementById('interaction-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function isInteractionModalOpen() {
  const modal = document.getElementById('interaction-modal');
  return Boolean(modal && !modal.classList.contains('hidden'));
}

function showInteractionModal(config) {
  const modal = document.getElementById('interaction-modal');
  if (!modal) return;

  const titleEl = document.getElementById('interaction-title');
  const subtitleEl = document.getElementById('interaction-subtitle');
  const textEl = document.getElementById('interaction-text');
  const tagsEl = document.getElementById('interaction-tags');
  const checkEl = document.getElementById('interaction-check');
  const actionsEl = document.getElementById('interaction-actions');

  if (titleEl) titleEl.textContent = config.title || 'City Interaction';
  if (subtitleEl) subtitleEl.textContent = config.subtitle || '';
  if (textEl) textEl.textContent = config.text || '';
  if (tagsEl) {
    tagsEl.innerHTML = (config.tags || []).map(tag => `<span class="interaction-tag">${escHtml(tag)}</span>`).join('');
  }
  if (checkEl) {
    if (config.note) {
      checkEl.textContent = config.note;
      checkEl.classList.remove('hidden');
    } else {
      checkEl.textContent = '';
      checkEl.classList.add('hidden');
    }
  }
  if (actionsEl) {
    actionsEl.innerHTML = '';
    const actions = Array.isArray(config.actions) && config.actions.length
      ? config.actions
      : [{ label: 'Back to district', detail: 'Return to the field.', kind: 'ghost', run: () => {} }];

    actions.forEach(action => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `interaction-action ${action.kind === 'primary' ? 'is-primary' : action.kind === 'danger' ? 'is-danger' : 'is-ghost'}`;
      button.innerHTML = `<strong>${escHtml(action.label)}</strong>${action.detail ? `<span class="interaction-choice-note">${escHtml(action.detail)}</span>` : ''}`;
      button.addEventListener('click', () => {
        if (action.closeOnSelect !== false) closeInteractionModal();
        if (typeof action.run === 'function') action.run();
      });
      actionsEl.appendChild(button);
    });
  }

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function applyInteractionOutcome(tile, x, y, { tab = 'local', message = '', toastLabel = '', toastType = 'ok' } = {}) {
  if (tab) setWorldSupportTab(tab);
  if (message) {
    appendToLog(message);
    showTileInfo(tile, x, y, { statusMessage: message });
  }
  if (toastLabel) showToast(toastLabel, toastType);
}

function handleLocalCityAction(actionKey, x, y) {
  const regionId = getRenderedRegionId(_gameState);
  const tile = getRegionTile(regionId, x, y);
  const subtile = _viewMode === 'local' ? getLocalPlayerTile() : null;
  const district = subtile?.district || getTileAreaProfile(tile).name;
  const nearbyPlayers = getVisiblePlayers()
    .filter(player => player.regionId === regionId && player.tileX === x && player.tileY === y)
    .map(player => player.name);
  const commonTags = [district];

  if (subtile?.questHook) commonTags.push(subtile.questHook);
  if (nearbyPlayers.length) {
    commonTags.push(`${nearbyPlayers.length} cultivator${nearbyPlayers.length > 1 ? 's' : ''} nearby`);
  }

  const configs = {
    guild: {
      title: 'Registrar Kesh',
      subtitle: 'Iron Guild Hall · Guild Ward',
      text: 'Kesh lays out contract slates, stipends, and entry paperwork without wasting a word. Ashgate work now routes through this hall instead of a detached city menu.',
      tags: [...commonTags, 'Guild contracts'],
      note: 'Contract resolution is still lightweight, but the routing and presentation now live on the map surface.',
      actions: [
        {
          label: 'Review contracts',
          detail: 'Push Ashgate leads into the quest tab.',
          kind: 'primary',
          run: () => applyInteractionOutcome(tile, x, y, {
            tab: 'quests',
            message: 'Registrar Kesh marks the current Iron Guild slate and routes the active leads into your quest feed.',
            toastLabel: 'Contracts marked'
          })
        },
        { label: 'Back to district', detail: 'Stay on the local field and keep moving.', kind: 'ghost', run: () => {} }
      ]
    },
    sect: {
      title: 'Outer Disciple Ren',
      subtitle: 'Sect Court · Ashen Frontier Sect',
      text: 'Ren measures your posture, circulation, and nerve before offering court work meant to test whether you belong inside Ashgate’s sect orbit.',
      tags: [...commonTags, 'Sect errands'],
      note: 'Faction mechanics still need their deeper pass, but the sect hook is now staged from the court itself.',
      actions: [
        {
          label: 'Take sect lead',
          detail: 'Mark the current court errand in the quest tab.',
          kind: 'primary',
          run: () => applyInteractionOutcome(tile, x, y, {
            tab: 'quests',
            message: 'Outer Disciple Ren routes you toward the current court errand and marks it in your Ashgate field log.',
            toastLabel: 'Sect lead marked'
          })
        },
        { label: 'Back to district', detail: 'Keep the field view active.', kind: 'ghost', run: () => {} }
      ]
    },
    blacksmith: {
      title: 'Smith Haro',
      subtitle: 'Forge Row · Blacksmith Lane',
      text: 'Haro slams a bent blade onto the counter and points toward the alleys where the thief vanished. The whole lane smells like quenched iron and bad patience.',
      tags: [...commonTags, 'Forge row'],
      actions: [
        {
          label: 'Mark the thief trail',
          detail: 'Send the recovery hook to the quest tab.',
          kind: 'primary',
          run: () => applyInteractionOutcome(tile, x, y, {
            tab: 'quests',
            message: 'Smith Haro gives you the alley route and marks the stolen-weapon trail for follow-up.',
            toastLabel: 'Trail marked'
          })
        },
        { label: 'Back to district', detail: 'Return to the field without taking the lead yet.', kind: 'ghost', run: () => {} }
      ]
    },
    rumor: {
      title: 'Scout Ilya',
      subtitle: 'East Gate Lane · Fangkou Scout Post',
      text: 'Ilya unrolls a rough route sketch toward the Fangkou Grove and warns that the spirit scent there is starting to gather the wrong kind of attention.',
      tags: [...commonTags, 'Rumor route'],
      actions: [
        {
          label: 'Mark the grove route',
          detail: 'Push the rumor into the quest tab for later travel.',
          kind: 'primary',
          run: () => applyInteractionOutcome(tile, x, y, {
            tab: 'quests',
            message: 'Scout Ilya sketches the Fangkou route and pushes the grove rumor into your active Ashgate leads.',
            toastLabel: 'Rumor marked'
          })
        },
        { label: 'Back to district', detail: 'Keep walking Ashgate.', kind: 'ghost', run: () => {} }
      ]
    },
    duel: {
      title: 'Showoff Jian',
      subtitle: 'Plaza Ring · Street Duel Circle',
      text: 'Jian plants his feet in the dust ring and demands an audience. The crowd wants blood, embarrassment, or both, and he is clearly prepared to perform either role.',
      tags: [...commonTags, 'Public duel'],
      note: 'Live duel resolution still needs the next battle pass, but the challenge hook and presentation now anchor to the ring itself.',
      actions: [
        {
          label: 'Mark duel challenge',
          detail: 'Keep the duel in your Ashgate quest feed for now.',
          kind: 'primary',
          run: () => applyInteractionOutcome(tile, x, y, {
            tab: 'quests',
            message: 'Showoff Jian calls for a public duel and the challenge is marked for the next combat pass.',
            toastLabel: 'Duel staged',
            toastType: 'warn'
          })
        },
        { label: 'Back to district', detail: 'Ignore the ring for now.', kind: 'ghost', run: () => {} }
      ]
    },
    plaza: {
      title: 'Marshal Sen',
      subtitle: 'Central Plaza · Ashgate Borough',
      text: 'Sen keeps the square moving with clipped orders and quick eyes. Traders, rival cultivators, and rumor-runners all cut through this plaza before they reach their own corners of the borough.',
      tags: [...commonTags, 'Traffic hub'],
      actions: [
        {
          label: 'Check district traffic',
          detail: 'Flip to the presence tab and review nearby people.',
          kind: 'primary',
          run: () => applyInteractionOutcome(tile, x, y, {
            tab: 'party',
            message: 'Marshal Sen points you toward the plaza traffic and nearby signatures moving through Ashgate.',
            toastLabel: 'Presence updated'
          })
        },
        { label: 'Back to district', detail: 'Stay in local view.', kind: 'ghost', run: () => {} }
      ]
    },
    bank: {
      title: 'Vault Clerk Mina',
      subtitle: 'Silver Vault · Ledger Ward',
      text: 'Mina checks the seal on your token, unlocks the bronze register, and slides the vault ledger into place with practiced precision.',
      tags: [...commonTags, 'Silver vault'],
      note: 'Deposits and withdrawals still resolve through the live vault panel.',
      actions: [
        {
          label: 'Open Silver Vault',
          detail: 'Use the standard banking interface.',
          kind: 'primary',
          run: () => {
            document.getElementById('open-bank')?.click();
            showToast('Silver Vault', 'ok');
          }
        },
        { label: 'Back to district', detail: 'Leave the counter.', kind: 'ghost', run: () => {} }
      ]
    },
    techniques: {
      title: 'Archivist Pei',
      subtitle: 'Technique Archive · Scriptorium',
      text: 'Pei produces copied scroll indexes, sealed shelf notices, and a dry warning about touching anything with live qi in it.',
      tags: [...commonTags, 'Archive access'],
      note: 'Technique management still resolves through the archive interface.',
      actions: [
        {
          label: 'Open Technique Archive',
          detail: 'Browse cultivation and battle arts.',
          kind: 'primary',
          run: () => {
            document.getElementById('open-techniques')?.click();
            showToast('Technique Archive', 'ok');
          }
        },
        { label: 'Back to district', detail: 'Return to the local field.', kind: 'ghost', run: () => {} }
      ]
    },
    patron: {
      title: 'Broker Nuo',
      subtitle: 'Patron Hall · Broker Court',
      text: 'Nuo keeps one eye on the room and one on the commission slips. Every favor in Ashgate passes through hands like these before it becomes a real obligation.',
      tags: [...commonTags, 'Patron hall'],
      note: 'Support and commission hooks still live in the patron panel while the deeper mission pass is pending.',
      actions: [
        {
          label: 'Open Patron Hall',
          detail: 'Review support hooks and commission surfaces.',
          kind: 'primary',
          run: () => {
            document.getElementById('open-patron-hall')?.click();
            showToast('Patron Hall', 'ok');
          }
        },
        { label: 'Back to district', detail: 'Step away from the broker table.', kind: 'ghost', run: () => {} }
      ]
    }
  };

  showInteractionModal(configs[actionKey] || {
    title: subtile?.npcName || titleizeSlug(actionKey),
    subtitle: `${district} · ${tile.name || getTileAreaProfile(tile).name}`,
    text: 'This district is active, but its deeper interaction branch still needs a dedicated gameplay pass.',
    tags: commonTags,
    actions: [{ label: 'Back to district', detail: 'Return to the field.', kind: 'ghost', run: () => {} }]
  });
}

function renderLocalInspector(tile, x, y) {
  const grid = document.getElementById('world-local-grid');
  const detail = document.getElementById('world-local-site-detail');
  const summary = document.getElementById('world-site-summary');
  if (!grid || !detail) return;

  const area = getTileAreaProfile(tile);
  const isLocalActive = _viewMode === 'local'
    && _localMapData
    && _localViewTile
    && _localViewTile.x === x
    && _localViewTile.y === y;
  const isPlayerTile = x === (_gameState?.tileX ?? 9) && y === (_gameState?.tileY ?? 6);
  const canExplore = isPlayerTile && _travelReadyAt <= Date.now();

  grid.classList.add('is-inspector');

  if (isLocalActive) {
    const subtile = getLocalPlayerTile();
    const action = getLocalActionForSubtile(tile, subtile);
    const visitors = getVisiblePlayers().filter(player => player.regionId === (_localViewTile?.regionId ?? '') && player.tileX === x && player.tileY === y);
    const actionButtons = [
      '<button type="button" class="btn-sm btn-primary" onclick="toggleWorldView()">Back to World Map</button>'
    ];

    if (action) {
      actionButtons.push(`<button type="button" class="btn-sm btn-ghost" onclick="performTileFieldAction('${action}', ${x}, ${y})">Work This Node</button>`);
    }
    if (subtile?.service) {
      const label = subtile.npcName
        ? `Talk to ${subtile.npcName}`
        : subtile.service === 'bank'
          ? 'Open Silver Vault'
          : subtile.service === 'techniques'
            ? 'Open Archive'
            : subtile.service === 'patron'
              ? 'Open Patron Hall'
              : titleizeSlug(subtile.service);
      actionButtons.push(`<button type="button" class="btn-sm btn-ghost" onclick="handleLocalCityAction('${subtile.service}', ${x}, ${y})">${escHtml(label)}</button>`);
    }

    if (summary) summary.textContent = `${area.name} · ${_localMapData.width}x${_localMapData.height} field`;
    grid.innerHTML = `
      <div class="local-inspector-card compact">
        <div class="local-inspector-label">District</div>
        <div class="local-inspector-value">${escHtml(subtile?.district || titleizeSlug(subtile?.terrain_kind || 'ground'))}</div>
        <div class="local-inspector-copy">${escHtml(subtile?.label || 'Unmarked ground.')}</div>
      </div>
      <div class="local-inspector-card compact">
        <div class="local-inspector-label">Occupant</div>
        <div class="local-inspector-value">${escHtml(subtile?.npcName || (visitors[0]?.name ?? 'No marked contact'))}</div>
        <div class="local-inspector-copy">${escHtml(visitors.length ? `${visitors.map(player => player.name).join(', ')} on this tile.` : subtile?.npcName ? 'Ready for dialogue.' : 'No other player signatures on this tile.')}</div>
      </div>
      <div class="local-inspector-card compact">
        <div class="local-inspector-label">Hook</div>
        <div class="local-inspector-value">${escHtml(subtile?.questHook || (action ? `Field ${titleizeSlug(action)}` : 'Free movement'))}</div>
        <div class="local-inspector-copy">${escHtml(subtile?.mobs?.length ? subtile.mobs.map(titleizeSlug).join(', ') : subtile?.resources?.length ? subtile.resources.map(titleizeSlug).join(', ') : 'Walk the district to reach the next contact or service point.')}</div>
      </div>
    `;

    detail.innerHTML = `
      <div class="world-site-detail-head compact">
        <div>
          <div class="tile-detail-kicker">${escHtml(area.name)}</div>
          <h4 class="world-site-detail-title">${escHtml(subtile?.label || titleizeSlug(subtile?.terrain_kind || 'Ground'))}</h4>
        </div>
        <span class="world-site-detail-glyph">⊕</span>
      </div>
      <div class="world-inline-meta">
        <span class="tag-city">${escHtml(`Pos ${_localPlayerX},${_localPlayerY}`)}</span>
        ${subtile?.npcName ? `<span class="tag-city">${escHtml(subtile.npcName)}</span>` : ''}
        ${subtile?.district ? `<span class="tag-city">${escHtml(subtile.district)}</span>` : ''}
      </div>
      <div class="world-site-actions">${actionButtons.join('')}</div>
    `;
    return;
  }

  if (summary) summary.textContent = `${area.name} · Tile field profile`;
  grid.innerHTML = `
    <div class="local-inspector-card compact">
      <div class="local-inspector-label">Field Size</div>
      <div class="local-inspector-value">${getMapSizeForTile(tile)} x ${getMapSizeForTile(tile)}</div>
      <div class="local-inspector-copy">The fixed node menu is gone. This tile opens as a walkable field.</div>
    </div>
    <div class="local-inspector-card compact">
      <div class="local-inspector-label">Hooks</div>
      <div class="local-inspector-value">${escHtml(tile.cityId === 'ashgate' ? 'Guild, sect, patron, archive, vault, duel ring' : 'Resources, mobs, and terrain routes')}</div>
      <div class="local-inspector-copy">Open local view to reach districts, NPCs, and resource lanes directly.</div>
    </div>
    <div class="local-inspector-card compact">
      <div class="local-inspector-label">Traffic</div>
      <div class="local-inspector-value">${escHtml(getVisiblePlayers().length ? `${getVisiblePlayers().length} nearby cultivators` : 'Quiet right now')}</div>
      <div class="local-inspector-copy">Player nameplates and local NPCs surface on the field itself.</div>
    </div>
  `;

  detail.innerHTML = `
    <div class="world-site-detail-head compact">
      <div>
        <div class="tile-detail-kicker">Local Field Preview</div>
        <h4 class="world-site-detail-title">${escHtml(area.name)}</h4>
      </div>
      <span class="world-site-detail-glyph">${escHtml(TILE_GLYPHS[tile.t] ?? '·')}</span>
    </div>
    <div class="world-inline-meta">
      ${tile.cityId ? `<span class="tag-city">${escHtml(titleizeSlug(tile.cityId))}</span>` : `<span class="tag-city">${escHtml(area.focusLabel)}</span>`}
      ${tile.mobs?.length ? `<span class="tag-danger">${escHtml(tile.mobs.length)} threats</span>` : ''}
      ${tile.herbs?.length || tile.ores?.length ? `<span class="tag-vein">Node field active</span>` : ''}
    </div>
    <div class="world-site-actions">
      ${canExplore ? '<button type="button" class="btn-sm btn-primary" onclick="toggleWorldView()">Open Local Field</button>' : '<span class="world-empty-note">Stand on this tile and finish traveling to open its local field.</span>'}
    </div>
  `;
}

function makeLocalSite(tileKey, key, name, glyph, kind, desc, actionHint) {
  return { id: `${tileKey}:${key}`, key, name, glyph, kind, desc, actionHint };
}

function buildLocalMiniMapTiles(tile, x, y) {
  // Generate a 5x5 mini-map grid for the given world tile
  // Each subtile is positionally navigable with different terrain types
  const tileKey = getTileIdentity(tile, x, y);
  const subtiles = [];
  
  // Helper to create a subtile
  const makeSubtile = (sx, sy, terrain, icon, label, kind) => ({
    id: `${tileKey}:${sx}:${sy}`,
    x: sx, y: sy,
    terrain,    // '.' open, 'G' gather, 'O' ore, 'M' mob, 'S' spirit, 'T' travel
    icon,
    label,
    kind        // 'gather', 'ore', 'mob', 'spirit', 'hazard', 'travel', 'civic', 'vault', etc.
  });

  // Generate mini-map based on parent tile type
  // Border = travel/forest, edge positions = resource/hazard, center = main content
  
  if (tile.t === 'C') {
    // City: corners are gates, edges are markets, center is plaza
    const grid = [];
    for (let sy = 0; sy < _localGridSize; sy++) {
      for (let sx = 0; sx < _localGridSize; sx++) {
        if ((sx === 0 || sx === 4) && (sy === 0 || sy === 4)) {
          // Corners = gates
          grid.push(makeSubtile(sx, sy, 'G', '⛩', 'Gate', 'civic'));
        } else if (sx === 0 || sx === 4 || sy === 0 || sy === 4) {
          // Edges = markets/streets
          grid.push(makeSubtile(sx, sy, 'M', '¤', 'Market Street', 'trade'));
        } else if (sx === 2 && sy === 2) {
          // Center = plaza
          grid.push(makeSubtile(sx, sy, 'S', '◎', 'Spirit Plaza', 'spirit'));
        } else if ((sx === 1 || sx === 3) && (sy === 1 || sy === 3)) {
          // Inner corners = services
          const service = sx === 1 && sy === 1 ? 'Vault' : sx === 3 && sy === 1 ? 'Archive' : sx === 1 && sy === 3 ? 'Tavern' : 'Patron';
          const icon = sx === 1 && sy === 1 ? '◫' : sx === 3 && sy === 1 ? '☰' : sx === 1 && sy === 3 ? '♨' : '⊗';
          const kind = sx === 1 && sy === 1 ? 'vault' : sx === 3 && sy === 1 ? 'archive' : sx === 1 && sy === 3 ? 'rumor' : 'sect';
          grid.push(makeSubtile(sx, sy, 'B', icon, service, kind));
        } else {
          // Mid edges = civic buildings
          grid.push(makeSubtile(sx, sy, 'C', '☷', 'Civic Yard', 'civic'));
        }
      }
    }
    return grid;
  } else if (tile.t === 'H') {
    // Herb Grove: border is forest, edges are herb beds, center is spring
    const grid = [];
    for (let sy = 0; sy < _localGridSize; sy++) {
      for (let sx = 0; sx < _localGridSize; sx++) {
        if (sx === 0 || sx === 4 || sy === 0 || sy === 4) {
          // Border = forest/travel
          grid.push(makeSubtile(sx, sy, 'T', '♦', 'Forest Edge', 'travel'));
        } else if (sx === 2 && sy === 2) {
          // Center = spring
          grid.push(makeSubtile(sx, sy, 'S', '◌', 'Spirit Spring', 'spirit'));
        } else {
          // Herb beds
          grid.push(makeSubtile(sx, sy, 'G', '✿', 'Herb Bed', 'gather'));
        }
      }
    }
    return grid;
  } else if (tile.t === 'K') {
    // Cave: border is forest, edges are tunnels, center is main seam
    const grid = [];
    for (let sy = 0; sy < _localGridSize; sy++) {
      for (let sx = 0; sx < _localGridSize; sx++) {
        if (sx === 0 || sx === 4 || sy === 0 || sy === 4) {
          // Border = forest/travel
          grid.push(makeSubtile(sx, sy, 'T', '♦', 'Forest', 'travel'));
        } else if (sx === 2 && sy === 2) {
          // Center = primary seam
          grid.push(makeSubtile(sx, sy, 'O', '◈', 'Primary Seam', 'ore'));
        } else if ((sx === 1 || sx === 3) && (sy === 1 || sy === 3)) {
          // Inner corners = secondary seams / hazard
          const isHazard = (sx === 3 && sy === 3);
          grid.push(makeSubtile(sx, sy, isHazard ? 'H' : 'O', isHazard ? '⋱' : '◈', isHazard ? 'Vent Crack' : 'Side Seam', isHazard ? 'hazard' : 'ore'));
        } else {
          // Tunnels
          grid.push(makeSubtile(sx, sy, 'M', '⌬', 'Mine Tunnel', 'ore'));
        }
      }
    }
    return grid;
  } else if (tile.t === 'X') {
    // Ruins: border is forest, edges are scattered ruins, center is main dais
    const grid = [];
    for (let sy = 0; sy < _localGridSize; sy++) {
      for (let sx = 0; sx < _localGridSize; sx++) {
        if (sx === 0 || sx === 4 || sy === 0 || sy === 4) {
          // Border = forest/travel
          grid.push(makeSubtile(sx, sy, 'T', '♦', 'Forest', 'travel'));
        } else if (sx === 2 && sy === 2) {
          // Center = glyph dais
          grid.push(makeSubtile(sx, sy, 'R', '◈', 'Glyph Dais', 'relic'));
        } else if ((sx === 1 || sx === 3) && (sy === 1 || sy === 3)) {
          // Inner corners = hazards / crypt
          grid.push(makeSubtile(sx, sy, 'H', '⬖', 'Undercroft', 'hazard'));
        } else {
          // Rubble
          grid.push(makeSubtile(sx, sy, 'R', '✦', 'Ruin Pile', 'relic'));
        }
      }
    }
    return grid;
  } else if (tile.t === 'B') {
    // Beast Lair: border is forest, edges are trails, center is den
    const grid = [];
    for (let sy = 0; sy < _localGridSize; sy++) {
      for (let sx = 0; sx < _localGridSize; sx++) {
        if (sx === 0 || sx === 4 || sy === 0 || sy === 4) {
          // Border = forest/travel
          grid.push(makeSubtile(sx, sy, 'T', '♦', 'Forest Edge', 'travel'));
        } else if (sx === 2 && sy === 2) {
          // Center = den
          grid.push(makeSubtile(sx, sy, 'M', '◈', 'Beast Den', 'mob'));
        } else if ((sx === 1 || sx === 3) && (sy === 1 || sy === 3)) {
          // Inner corners = hazards / bones
          grid.push(makeSubtile(sx, sy, 'H', '☠', 'Bone Scatter', 'hazard'));
        } else {
          // Trails
          grid.push(makeSubtile(sx, sy, 'M', '⊛', 'Beast Trail', 'mob'));
        }
      }
    }
    return grid;
  } else if (tile.t === 'V') {
    // Spirit Vein: border is forest, edges are qi mist, center is convergence
    const grid = [];
    for (let sy = 0; sy < _localGridSize; sy++) {
      for (let sx = 0; sx < _localGridSize; sx++) {
        if (sx === 0 || sx === 4 || sy === 0 || sy === 4) {
          // Border = forest/travel
          grid.push(makeSubtile(sx, sy, 'T', '♦', 'Forest Edge', 'travel'));
        } else if (sx === 2 && sy === 2) {
          // Center = convergence heart
          grid.push(makeSubtile(sx, sy, 'S', '✺', 'Convergence Heart', 'spirit'));
        } else {
          // Qi mist
          grid.push(makeSubtile(sx, sy, 'S', '◎', 'Qi Mist', 'spirit'));
        }
      }
    }
    return grid;
  } else {
    // Default for F, W, R, . (Forest, Wilderness, Road, Open): all traversable
    const grid = [];
    for (let sy = 0; sy < _localGridSize; sy++) {
      for (let sx = 0; sx < _localGridSize; sx++) {
        if (sx === 0 || sx === 4 || sy === 0 || sy === 4) {
          // Border = travel edges
          grid.push(makeSubtile(sx, sy, 'T', '⋰', 'Trail', 'travel'));
        } else if (sx === 2 && sy === 2) {
          // Center = waypoint / clearing
          grid.push(makeSubtile(sx, sy, tile.herbs?.length ? 'G' : tile.mobs?.length ? 'M' : 'S', '◈', 'Field Heart', tile.herbs?.length ? 'gather' : tile.mobs?.length ? 'mob' : 'spirit'));
        } else {
          // Mid tiles = general terrain
          const kind = tile.herbs?.length ? 'gather' : tile.mobs?.length ? 'mob' : tile.ores?.length ? 'ore' : 'travel';
          const terrain = kind === 'gather' ? 'G' : kind === 'mob' ? 'M' : kind === 'ore' ? 'O' : 'T';
          const icon = kind === 'gather' ? '✿' : kind === 'mob' ? '⊛' : kind === 'ore' ? '⛏' : '⋰';
          const label = kind === 'gather' ? 'Herb Patch' : kind === 'mob' ? 'Trail' : kind === 'ore' ? 'Outcrop' : 'Field';
          grid.push(makeSubtile(sx, sy, terrain, icon, label, kind));
        }
      }
    }
    return grid;
  }
}

function buildLocalTileSites(tile, x, y) {
  const tileKey = getTileIdentity(tile, x, y);
  switch (tile.t) {
    case 'C':
      return [
        makeLocalSite(tileKey, 'gate', 'Main Gate', '⛩', 'civic', 'Patrols, toll-keepers, and arriving caravans define the gate quarter.', 'cityAffairs'),
        makeLocalSite(tileKey, 'market', 'Market Row', '¤', 'trade', 'Merchants cycle silver, rumor, and supply caches through the market lanes.', 'cityAffairs'),
        makeLocalSite(tileKey, 'vault', 'Vault Ward', '◫', 'vault', 'Ledger clerks and guarded counters handle deposits and sealed withdrawals.', 'bank'),
        makeLocalSite(tileKey, 'sect', 'Sect Court', '☷', 'sect', 'Outer court recruiters, disputes, and faction petitions are heard here.', 'cityAffairs'),
        makeLocalSite(tileKey, 'plaza', 'Spirit Plaza', '◎', 'spirit', 'This central square anchors notices, escorts, and public cultivation traffic.', 'spirit'),
        makeLocalSite(tileKey, 'archive', 'Technique Archive', '☰', 'archive', 'Manual copies, scripture racks, and cultivation notes flow through the archive.', 'techniques'),
        makeLocalSite(tileKey, 'tavern', 'Tavern Row', '♨', 'rumor', 'Travelers trade contracts, grudges, and duel gossip across tavern tables.', 'patron'),
        makeLocalSite(tileKey, 'relay', 'Courier Post', '✉', 'relay', 'Dispatches, sect letters, and player traffic would converge at this relay.', 'cityAffairs'),
        makeLocalSite(tileKey, 'outskirts', 'Outskirts', '↠', 'travel', 'The settlement hands back off into roads, watchpaths, and nearby wilderness.', 'areaIntel')
      ];
    case 'H':
      return [
        makeLocalSite(tileKey, 'dewline', 'Dewline Path', '✿', 'gather', 'A narrow route where the freshest blooms condense before sunrise.', 'herbs'),
        makeLocalSite(tileKey, 'shelf', 'Shade Shelf', '❋', 'gather', 'Shadowed growth pockets hold the more fragile cultivational herbs.', 'herbs'),
        makeLocalSite(tileKey, 'spring', 'Spring Cut', '◌', 'spirit', 'Wet ground and faint qi currents make this patch a good gathering point.', 'spirit'),
        makeLocalSite(tileKey, 'trail', 'Gather Trail', '⋰', 'travel', 'The footpath loops between herb beds and escape cover.', 'areaIntel'),
        makeLocalSite(tileKey, 'hollow', 'Root Hollow', '◈', 'gather', 'This center hollow is where repeated harvest loops would converge.', 'herbs'),
        makeLocalSite(tileKey, 'watch', 'Watch Ridge', '⌁', 'lookout', 'A small rise gives line of sight over poachers and passing beasts.', 'mobs'),
        makeLocalSite(tileKey, 'mud', 'Spirit Mud', '∴', 'spirit', 'Qi-rich silt clings to roots and draws better quality forage.', 'spirit'),
        makeLocalSite(tileKey, 'bloom', 'Bloom Knot', '❀', 'gather', 'Dense clusters show where multi-node harvest logic should later spawn.', 'herbs'),
        makeLocalSite(tileKey, 'egress', 'Backtrail', '↘', 'travel', 'The fastest retreat route if another cultivator contests the patch.', 'areaIntel')
      ];
    case 'K':
      return [
        makeLocalSite(tileKey, 'mouth', 'Mine Mouth', '⛏', 'ore', 'The entrance lip is where mining crews would stage before committing deeper.', 'ores'),
        makeLocalSite(tileKey, 'shaft', 'Side Shaft', '⌬', 'ore', 'A secondary cut branches toward smaller seams and unstable rock.', 'ores'),
        makeLocalSite(tileKey, 'vent', 'Vent Crack', '⋱', 'hazard', 'Heat or pressure escapes here, making the route dangerous but valuable.', 'spirit'),
        makeLocalSite(tileKey, 'camp', 'Lantern Camp', '⌂', 'camp', 'A rest node for miners, escorts, and ambushes waiting on exit traffic.', 'mobs'),
        makeLocalSite(tileKey, 'seam', 'Primary Seam', '◈', 'ore', 'The richest vein or extraction target sits in the center of the tunnel web.', 'ores'),
        makeLocalSite(tileKey, 'crack', 'Deep Crack', '⋄', 'hazard', 'This fracture hints at deeper content once hazard-gated cave travel lands.', 'areaIntel'),
        makeLocalSite(tileKey, 'scaffold', 'Scaffold Ring', '☷', 'ore', 'Temporary bracing and salvage piles suggest repeatable resource loops.', 'ores'),
        makeLocalSite(tileKey, 'heap', 'Spoil Heap', '▣', 'salvage', 'Discarded stone often hides lower-tier loot or overlooked fragments.', 'ores'),
        makeLocalSite(tileKey, 'exit', 'Tunnel Egress', '↗', 'travel', 'A narrow exit channel is ideal for interceptions or companion screening.', 'areaIntel')
      ];
    case 'X':
      return [
        makeLocalSite(tileKey, 'gate', 'Cracked Gate', '✦', 'ruin', 'The broken threshold is where wards, traps, and scavengers first surface.', 'areaIntel'),
        makeLocalSite(tileKey, 'court', 'Collapsed Court', '⌘', 'ruin', 'The outer court still holds fragments of formations and broken statuary.', 'mobs'),
        makeLocalSite(tileKey, 'archive', 'Dust Archive', '☰', 'relic', 'Collapsed shelves and scattered records hint at relic-grade drops.', 'areaIntel'),
        makeLocalSite(tileKey, 'stairs', 'Watch Stairs', '⋰', 'lookout', 'A partial vantage point for scouting rival cultivators around the ruin.', 'mobs'),
        makeLocalSite(tileKey, 'dais', 'Glyph Dais', '◈', 'relic', 'The ruin center is where live zone node content should eventually resolve.', 'areaIntel'),
        makeLocalSite(tileKey, 'crypt', 'Undercroft', '⬖', 'hazard', 'A deeper chamber suggests boss, relic, or ambush hooks.', 'mobs'),
        makeLocalSite(tileKey, 'rubble', 'Rubble Pass', '▤', 'travel', 'Loose stone makes escape slow and noisy.', 'areaIntel'),
        makeLocalSite(tileKey, 'cache', 'Reliquary Niche', '☲', 'relic', 'A sealed wall pocket is ideal for cache-style exploration rewards.', 'areaIntel'),
        makeLocalSite(tileKey, 'pilgrim', 'Pilgrim Path', '↘', 'travel', 'The outbound line where other parties may pass the ruin.', 'areaIntel')
      ];
    case 'V':
      return [
        makeLocalSite(tileKey, 'well', 'Qi Well', '◎', 'spirit', 'A visible pulse in the terrain marks the strongest spiritual draw.', 'spirit'),
        makeLocalSite(tileKey, 'mist', 'Mist Bank', '◌', 'spirit', 'Qi fog pools low here, ideal for detecting resonance shifts.', 'spirit'),
        makeLocalSite(tileKey, 'crystal', 'Crystal Lip', '◈', 'spirit', 'Condensed essence hardens near exposed crystal growth.', 'spirit'),
        makeLocalSite(tileKey, 'shelf', 'Meditation Shelf', '☯', 'cultivation', 'A flat ledge suited for later on-tile cultivation actions.', 'spirit'),
        makeLocalSite(tileKey, 'heart', 'Convergence Heart', '✺', 'spirit', 'The vein center is where the strongest local cultivation multiplier will matter.', 'spirit'),
        makeLocalSite(tileKey, 'fracture', 'Fracture Edge', '⋄', 'hazard', 'Cracked stone suggests unstable qi surges and contested access.', 'mobs'),
        makeLocalSite(tileKey, 'wind', 'Wind Cut', '⌁', 'lookout', 'A clear edge where scouts can watch the surrounding terrain.', 'areaIntel'),
        makeLocalSite(tileKey, 'pool', 'Still Pool', '◍', 'spirit', 'A calm pocket where rare materials might later condense.', 'spirit'),
        makeLocalSite(tileKey, 'path', 'Vein Perimeter', '↗', 'travel', 'The outer ring is where escorts, players, and rivals would cross paths.', 'areaIntel')
      ];
    case 'B':
      return [
        makeLocalSite(tileKey, 'trail', 'Scent Trail', '⊛', 'hunt', 'Fresh tracks point to the beast routes radiating from the den.', 'mobs'),
        makeLocalSite(tileKey, 'bones', 'Bone Scatter', '☠', 'hunt', 'Old kills and broken carcasses mark where the pack feeds.', 'mobs'),
        makeLocalSite(tileKey, 'brush', 'Brush Cover', '♣', 'ambush', 'Dense cover makes this edge ideal for stalking or being stalked.', 'mobs'),
        makeLocalSite(tileKey, 'watch', 'Kill Ridge', '⌁', 'lookout', 'A rise where companions or rivals could spot the lair first.', 'areaIntel'),
        makeLocalSite(tileKey, 'den', 'Den Heart', '◈', 'hunt', 'The center lair should later host the most valuable live encounter hook.', 'mobs'),
        makeLocalSite(tileKey, 'camp', 'Hunter Camp', '⌂', 'camp', 'A temporary foothold for resting, baiting, or tracking.', 'mobs'),
        makeLocalSite(tileKey, 'rut', 'Rut Ring', '⋱', 'hunt', 'Heavy traffic wears the soil into clear pursuit lines.', 'mobs'),
        makeLocalSite(tileKey, 'escape', 'Escape Cut', '↘', 'travel', 'A fast line out if another party or player contests the kill.', 'areaIntel'),
        makeLocalSite(tileKey, 'overlook', 'Outer Overlook', '△', 'lookout', 'A perimeter point for spotting incoming cultivators.', 'areaIntel')
      ];
    case 'F':
    case 'W':
    case '.':
    case 'R':
    default:
      return [
        makeLocalSite(tileKey, 'trail', tile.t === 'R' ? 'Trade Path' : 'Scout Trail', '⋰', 'travel', 'The most reliable path through this tile for caravans, scouts, and parties.', 'areaIntel'),
        makeLocalSite(tileKey, 'cover', 'Brush Line', '♣', 'cover', 'Light cover where gathering, hiding, or ambush checks would happen.', tile.herbs?.length ? 'herbs' : 'mobs'),
        makeLocalSite(tileKey, 'spring', 'Field Spring', '◌', 'spirit', 'A damp pocket where qi or herbs tend to collect first.', tile.spiritDensity ? 'spirit' : (tile.herbs?.length ? 'herbs' : 'areaIntel')),
        makeLocalSite(tileKey, 'camp', 'Waycamp', '⌂', 'camp', 'A staging spot for recovery, escort regrouping, or roadside events.', 'cityAffairs'),
        makeLocalSite(tileKey, 'heart', 'Tile Heart', '◈', 'field', 'The center of the tile should later resolve its most important on-site content.', tile.areaId ? 'areaIntel' : (tile.mobs?.length ? 'mobs' : 'areaIntel')),
        makeLocalSite(tileKey, 'watch', 'Lookout Rise', '⌁', 'lookout', 'The cleanest line of sight across nearby traffic and territorial movement.', tile.mobs?.length ? 'mobs' : 'areaIntel'),
        makeLocalSite(tileKey, 'gather', 'Gather Patch', '✿', 'gather', 'A small resource knot where quick field loops can start.', tile.herbs?.length ? 'herbs' : (tile.ores?.length ? 'ores' : 'areaIntel')),
        makeLocalSite(tileKey, 'drift', 'Drift Edge', '⋄', 'hazard', 'Unstable ground that hints at hazards, hidden seams, or encounter pressure.', tile.ores?.length ? 'ores' : 'mobs'),
        makeLocalSite(tileKey, 'egress', 'Forward Egress', '↗', 'travel', 'The exit line toward the next frontier tile and future pass-by events.', 'areaIntel')
      ];
  }
}

function getLocalSiteActions(site, tile, x, y) {
  const actions = [];
  const isCurrentTile = x === (_gameState?.tileX ?? 9)
    && y === (_gameState?.tileY ?? 6)
    && _travelReadyAt <= Date.now();

  if (isCurrentTile && ['herbs', 'ores', 'mobs', 'spirit'].includes(site.actionHint)) {
    actions.push({
      label: site.actionHint === 'herbs'
        ? 'Forage Now'
        : site.actionHint === 'ores'
          ? 'Mine Now'
          : site.actionHint === 'mobs'
            ? 'Hunt Now'
            : 'Resonate Now',
      kind: 'primary',
      action: `performTileFieldAction('${site.actionHint}', ${x}, ${y})`
    });
  }
  if (isCurrentTile && !actions.length && (tile.t === 'X' || tile.drops?.length) && site.actionHint === 'areaIntel') {
    actions.push({ label: 'Scavenge', kind: 'primary', action: `performTileFieldAction('relic', ${x}, ${y})` });
  }

  if (tile.areaId && site.actionHint !== 'bank' && site.actionHint !== 'techniques' && site.actionHint !== 'patron' && site.actionHint !== 'cityAffairs') {
    actions.push({ label: 'Area Intel', kind: actions.length ? 'ghost' : 'primary', action: `openZoneForArea('${tile.areaId}', ${x}, ${y})` });
  }

  const labelMap = {
    bank: 'Open Vault',
    techniques: 'Open Archive',
    patron: 'Open Patron Hall',
    cityAffairs: 'City Affairs',
    herbs: 'Survey Herbs',
    ores: 'Survey Veins',
    mobs: 'Track Threats',
    spirit: 'Qi Survey',
    areaIntel: 'Scout Surroundings'
  };

  if (site.actionHint) {
    actions.push({
      label: labelMap[site.actionHint] || 'Inspect Site',
      kind: actions.length ? 'ghost' : 'primary',
      action: `openWorldService('${site.actionHint}', ${x}, ${y})`
    });
  }

  if (tile.cityId && site.actionHint !== 'bank' && site.actionHint !== 'techniques' && site.actionHint !== 'patron') {
    actions.push({ label: 'Settlement Dock', kind: 'ghost', action: `openWorldService('cityAffairs', ${x}, ${y})` });
  }

  return actions.slice(0, 3);
}

function inspectTileSite(siteId, x, y) {
  const regionId = getRenderedRegionId(_gameState);
  const tile = getRegionTile(regionId, x, y);
  _selectedTileSite = { tileKey: getTileIdentity(tile, x, y), siteId };
  renderLocalTileMap(tile, x, y);
}

function openWorldService(service, x, y) {
  const regionId = getRenderedRegionId(_gameState);
  const tile = getRegionTile(regionId, x, y);
  switch (service) {
    case 'bank':
      document.getElementById('open-bank')?.click();
      return;
    case 'techniques':
      document.getElementById('open-techniques')?.click();
      return;
    case 'patron':
      document.getElementById('open-patron-hall')?.click();
      return;
    case 'cityAffairs':
      if (tile.cityId) {
        showTileInfo(tile, x, y, { statusMessage: `Docked at ${titleizeSlug(tile.cityId)}. City affairs are available from this anchor tile.` });
      }
      doAction('cityAction', { service: tile.cityId || tile.areaId || 'field-affairs' });
      return;
    case 'herbs':
    case 'ores':
    case 'mobs':
    case 'spirit':
      previewWorldAction(service, x, y);
      return;
    case 'areaIntel':
      if (tile.areaId) openZoneForArea(tile.areaId, x, y);
      else focusWorldTile(x, y);
      return;
    default:
      focusWorldTile(x, y);
  }
}

async function performTileFieldAction(mode, x, y) {
  if (_guestMode || !_character) return;
  const currentX = _gameState?.tileX ?? 9;
  const currentY = _gameState?.tileY ?? 6;
  if (x !== currentX || y !== currentY) {
    showToast('You need to stand on a tile before farming it.', 'warn');
    return;
  }
  if (_travelReadyAt > Date.now()) {
    showToast('Finish traveling before working the tile.', 'warn');
    return;
  }

  const regionId = getRenderedRegionId(_gameState);
  const tile = getRegionTile(regionId, x, y);
  const r = await API.post('/api/game/action', {
    action: 'fieldAction',
    options: {
      mode,
      regionId,
      x,
      y,
      terrainType: tile.t,
      hazard: tile.hazard ?? 0,
      spiritDensity: tile.spiritDensity ?? 0,
      areaId: tile.areaId ?? null
    }
  });

  if (!r.ok) {
    showToast(r.data.error || 'Could not work this tile.', 'warn');
    return;
  }

  _gameState = r.data.state ?? _gameState;
  _cooldowns = r.data.cooldowns ?? _cooldowns;
  renderAll();
  appendToLog((r.data.result || []).join(' '));
  showToast((r.data.result || [`${titleizeSlug(mode)} run complete.`]).join(' '), 'ok');
  showTileInfo(tile, x, y, { statusMessage: `${titleizeSlug(mode)} cycle complete. This tile is now on personal recovery before the next run.` });
}

function renderLocalTileMap(tile, x, y) {
  renderLocalInspector(tile, x, y);
}

function renderWorldQuestBoard(currentTile, selectedTile) {
  const list = document.getElementById('available-events-list');
  if (!list) return;

  const quests = Array.isArray(_gameState?.questLog) ? _gameState.questLog : [];
  const selectedArea = getTileAreaProfile(selectedTile);
  const entries = [];

   if ((selectedTile.cityId || currentTile.cityId) === 'ashgate') {
    getAshgateQuestEntries().forEach(entry => entries.push(entry));
  }

  quests.forEach((quest, index) => {
    if (typeof quest === 'string') {
      entries.push({ title: quest, badgeLabel: 'active', rarity: 'uncommon', meta: 'Tracked from the live quest log.' });
      return;
    }
    entries.push({
      title: quest.title || quest.name || `Quest ${index + 1}`,
      badgeLabel: quest.status || 'active',
      rarity: quest.rarity || 'uncommon',
      meta: quest.summary || quest.description || 'Active objective.'
    });
  });

  if (!entries.length || !((selectedTile.cityId || currentTile.cityId) === 'ashgate')) {
    entries.push({
      title: `Survey ${selectedArea.name}`,
      badgeLabel: 'field',
      rarity: 'common',
      meta: `Walk the local field, inspect resource lanes, and stage the next move through this ${selectedArea.focusLabel.toLowerCase()} tile.`
    });
  }
  if (selectedTile.mobs?.length) {
    entries.push({
      title: `Track ${titleizeSlug(selectedTile.mobs[0])}`,
      badgeLabel: 'hunt',
      rarity: 'uncommon',
      meta: `Hostile traffic is already mapped here: ${selectedTile.mobs.map(titleizeSlug).join(', ')}.`
    });
  }
  if (selectedTile.herbs?.length) {
    entries.push({
      title: `Harvest route reconnaissance`,
      badgeLabel: 'gather',
      rarity: 'common',
      meta: `Known flora on this tile: ${selectedTile.herbs.map(titleizeSlug).join(', ')}.`
    });
  }
  if (selectedTile.ores?.length) {
    entries.push({
      title: `Secure extraction line`,
      badgeLabel: 'ore',
      rarity: 'common',
      meta: `This tile shows workable material: ${selectedTile.ores.map(titleizeSlug).join(', ')}.`
    });
  }
  if (!entries.length) {
    entries.push({ title: 'No active quests', badgeLabel: 'idle', rarity: 'common', meta: 'Rumors, faction contracts, and area leads will surface here once the next quest pass lands.' });
  }

  list.innerHTML = entries.map(entry => `
    <li>
      <div style="flex:1">
        <div class="quest-line-title">
          <span>${escHtml(entry.title)}</span>
          <span class="quest-badge ${escHtml(entry.rarity || 'common')}">${escHtml(entry.badgeLabel)}</span>
        </div>
        <div class="quest-line-meta">${escHtml(entry.meta)}</div>
        ${entry.sense ? `<div class="quest-line-sense">${escHtml(entry.sense)}</div>` : ''}
      </div>
    </li>
  `).join('');
}

function renderWorldPresenceFeed(currentTile, selectedTile) {
  const list = document.getElementById('world-presence-list');
  const summary = document.getElementById('world-party-summary');
  const items = [];

  const companions = Array.isArray(_gameState?.companions) ? _gameState.companions : [];
  const visiblePlayers = getVisiblePlayers();
  const cityId = selectedTile.cityId || currentTile.cityId;
  const cityRoster = cityId === 'ashgate' ? getAshgateRoster() : [];

  if (summary) {
    summary.innerHTML = `
      <div class="world-party-chip"><span class="world-party-chip-label">Party</span><strong>${companions.length ? companions.length : 'Solo'}</strong></div>
      <div class="world-party-chip"><span class="world-party-chip-label">Players</span><strong>${visiblePlayers.length}</strong></div>
      <div class="world-party-chip"><span class="world-party-chip-label">NPCs</span><strong>${cityRoster.length}</strong></div>
    `;
  }

  if (companions.length) {
    items.push({ title: 'Companion party assigned', badgeLabel: 'party', rarity: 'common', meta: `${companions.length} companion${companions.length > 1 ? 's are' : ' is'} keyed to your travel lane.` });
  } else {
    items.push({ title: 'No companion party assigned', badgeLabel: 'solo', rarity: 'common', meta: 'Party UI is ready for companions, but you are moving solo right now.' });
  }

  if (visiblePlayers.length) {
    items.push({ title: 'Cultivators in view', badgeLabel: 'online', rarity: 'uncommon', meta: visiblePlayers.map(player => `${player.name} · ${REALM_NAMES[player.realm_index] ?? 'Realm'}`).join(' | ') });
  } else {
    items.push({ title: 'No nearby player signatures', badgeLabel: 'quiet', rarity: 'common', meta: 'Nearby player nameplates will surface here as cultivators cross your current route.' });
  }

  cityRoster.forEach(entry => items.push(entry));

  if (list) {
    list.innerHTML = items.map(entry => `
      <li>
        <div style="flex:1">
          <div class="quest-line-title">
            <span>${escHtml(entry.title)}</span>
            <span class="quest-badge ${escHtml(entry.rarity || 'common')}">${escHtml(entry.badgeLabel)}</span>
          </div>
          <div class="quest-line-meta">${escHtml(entry.meta)}</div>
        </div>
      </li>
    `).join('');
  }
}

function renderWorldSupportPanels(selectedTile, x, y) {
  const regionId = getRenderedRegionId(_gameState);
  const currentTile = getRegionTile(regionId, _gameState?.tileX ?? 9, _gameState?.tileY ?? 6);
  const title = document.getElementById('world-command-title');
  const desc = document.getElementById('world-command-desc');
  const area = getTileAreaProfile(selectedTile);

  if (title) title.textContent = `${area.name} Command Surface`;
  if (desc) {
    desc.textContent = selectedTile.cityId === 'ashgate'
      ? 'Ashgate contracts, services, and named NPCs now route through the local field.'
      : 'Map-first routing for local actions, contracts, presence, and logs.';
  }

  renderLocalInspector(selectedTile, x, y);
  renderWorldQuestBoard(currentTile, selectedTile);
  renderWorldPresenceFeed(currentTile, selectedTile);

  const log = document.getElementById('event-log');
  if (log && !log.children.length) {
    log.innerHTML = '<li>World actions, travel notes, and exploration results will gather here.</li>';
  }
}

function focusWorldTile(x, y) {
  const regionId = getRenderedRegionId(_gameState);
  const tile = getRegionTile(regionId, x, y);
  showTileInfo(tile, x, y);
}

function previewWorldAction(kind, x, y) {
  const regionId = getRenderedRegionId(_gameState);
  const tile = getRegionTile(regionId, x, y);
  const profiles = {
    herbs: tile.herbs?.length
      ? `You trace the herb routes here: ${tile.herbs.map(titleizeSlug).join(', ')}. Stand on this tile to run a live forage cycle from the World surface.`
      : 'No active herb signals are surfacing on this tile.',
    ores: tile.ores?.length
      ? `The exposed seams suggest ${tile.ores.map(titleizeSlug).join(', ')}. Stand on this tile to mine it directly from the World surface.`
      : 'No exposed ore seams are visible here.',
    mobs: tile.mobs?.length
      ? `Beast sign is heavy here: ${tile.mobs.map(titleizeSlug).join(', ')}. Stand on this tile to run a provisional live hunt loop.`
      : 'No active beast trails are obvious right now.',
    spirit: tile.spiritDensity
      ? `Qi gathers around this tile at density ×${tile.spiritDensity}. Stand on this tile to resonate with it for a live extraction cycle.`
      : 'Ambient qi is flat here compared with nearby spirit nodes.',
    city: tile.cityId
      ? `${titleizeSlug(tile.cityId)} is currently acting as a service anchor. The full navigable city-grid rework is next, but this tile is already the settlement access point.`
      : 'This tile is not currently mapped as a city anchor.'
  };
  showTileInfo(tile, x, y, { statusMessage: profiles[kind] || 'You study the terrain and mark new field notes.' });
}

function renderWorldHud(regionId, px, py, visited) {
  const posEl = document.getElementById('world-current-position');
  const areaEl = document.getElementById('world-current-area');
  const travelEl = document.getElementById('world-travel-state');
  const exploredEl = document.getElementById('world-explored-count');
  const nearbyEl = document.getElementById('world-nearby');
  const route = getActiveTravelRoute();

  const currentTile = getRegionTile(regionId, px, py);
  const currentArea = getTileAreaProfile(currentTile);
  const destinationTile = route ? getRegionTile(regionId, route.toX, route.toY) : currentTile;
  const regionName = ({
    'ashen-frontier': 'Ashen Frontier',
    'jade-delta': 'Jade Delta',
    'iron-wilds': 'Iron Wilds',
    'void-rift': 'Void Rift',
    'celestial-plateau': 'Celestial Plateau',
    'sovereign-wastes': 'Sovereign Wastes'
  })[regionId] ?? titleizeSlug(regionId);
  const travelRem = Math.max(0, _travelReadyAt - Date.now());
  const anchorX = route ? route.toX : px;
  const anchorY = route ? route.toY : py;

  if (posEl) posEl.textContent = route ? `${regionName} · transit corridor` : `${regionName} · ${px},${py}`;
  if (areaEl) areaEl.textContent = route ? `${destinationTile.name || TILE_TERRAIN_NAMES[destinationTile.t]} · destination` : currentArea.name;
  if (travelEl) {
    travelEl.textContent = route
      ? `${Math.round(getTravelProgress(route) * 100)}% en route · ${Math.ceil(travelRem / 1000)}s`
      : 'Movement window open';
  }
  if (exploredEl) exploredEl.textContent = `${countVisitedTiles(visited, regionId)} tiles charted`;

  if (nearbyEl) {
    const chips = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = anchorX + dx;
        const ny = anchorY + dy;
        const tile = getRegionTile(regionId, nx, ny);
        if (tile.t === 'M') continue;
        const name = tile.name || TILE_TERRAIN_NAMES[tile.t] || 'Unknown';
        chips.push(
          `<button type="button" class="world-nearby-chip" onclick="focusWorldTile(${nx}, ${ny})">`
          + `<span class="world-nearby-name">${escHtml(name)}</span>`
          + `<span class="world-nearby-glyph">${escHtml(TILE_GLYPHS[tile.t] ?? '·')}</span>`
          + `</button>`
        );
      }
    }
    nearbyEl.innerHTML = chips.join('') || '<div class="world-empty-note">No traversable neighboring tiles are currently in range.</div>';
  }
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getLocalVisitorPositions(mapData, anchorX, anchorY, players) {
  const positions = new Map();
  if (!players.length) return positions;

  const candidateOffsets = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
    { x: 2, y: 0 },
    { x: -2, y: 0 },
    { x: 0, y: 2 },
    { x: 0, y: -2 }
  ];

  const candidateSlots = candidateOffsets
    .map(offset => ({ x: anchorX + offset.x, y: anchorY + offset.y }))
    .filter(slot => {
      const subtile = getLocalMapTile(mapData, slot.x, slot.y);
      return subtile && subtile.terrain !== '#' && !(slot.x === anchorX && slot.y === anchorY);
    });

  players.slice(0, candidateSlots.length).forEach((player, index) => {
    const start = (hashString(player.id || player.name) + index) % candidateSlots.length;
    for (let offset = 0; offset < candidateSlots.length; offset += 1) {
      const slot = candidateSlots[(start + offset) % candidateSlots.length];
      const key = `${slot.x}:${slot.y}`;
      if (!positions.has(key)) {
        positions.set(key, player);
        break;
      }
    }
  });
  return positions;
}

function renderTileMap() {
  const grid = document.getElementById('tile-grid');
  const wrap = document.getElementById('tile-map-wrap');
  if (!grid || !wrap || !_character || !_gameState) return;

  const SUBTILE_SIZE = 34; // Same size as world tiles for consistency
  
  // Render either world map or local map based on view mode
  if (_viewMode === 'local' && _localMapData && _localViewTile) {
    renderLocalMapView(grid, wrap, SUBTILE_SIZE);
  } else {
    renderWorldMapView(grid, wrap, SUBTILE_SIZE);
  }
}

function renderWorldMapView(grid, wrap, TILE_SIZE) {
  // Original world map rendering
  if (!_character || !_gameState) return;

  const state = _gameState;
  const regionId = getRenderedRegionId(state);
  const px = state.tileX ?? 9;
  const py = state.tileY ?? 6;
  const visited = new Set(state.visitedTiles ?? []);

  if (countVisitedTiles(visited, regionId) === 0) {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        visited.add(`${regionId}:${px + dx}:${py + dy}`);
  }

  const mapW = regionId === 'ashen-frontier' ? AF_W : 10;
  const mapH = regionId === 'ashen-frontier' ? AF_H : 10;
  const isTraveling = _travelReadyAt > Date.now();
  const travelRoute = getActiveTravelRoute();
  const visualPos = getVisualTravelPosition(travelRoute);
  const visiblePlayers = getVisiblePlayers();
  const selectedTile = _selectedWorldTile && _selectedWorldTile.regionId === regionId
    ? _selectedWorldTile
    : { regionId, x: px, y: py };

  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${mapW}, ${TILE_SIZE}px)`;
  grid.style.gridTemplateRows    = `repeat(${mapH}, ${TILE_SIZE}px)`;

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const tile     = getRegionTile(regionId, x, y);
      const vKey     = `${regionId}:${x}:${y}`;
      const isPlayer = !travelRoute && (x === px && y === py);
      const isAdj    = !isPlayer && Math.abs(x - px) <= 1 && Math.abs(y - py) <= 1;
      const isVis    = visited.has(vKey) || isPlayer;
      const inFog    = !isVis && !isAdj;
      const canMove  = isAdj && tile.t !== 'M' && !isTraveling;
      const isSelected = selectedTile.x === x && selectedTile.y === y;
      const isTravelOrigin = travelRoute && x === travelRoute.fromX && y === travelRoute.fromY;
      const isTravelTarget = travelRoute && x === travelRoute.toX && y === travelRoute.toY;
      const playersHere = visiblePlayers.filter(player => player.regionId === regionId && player.tileX === x && player.tileY === y);
      const visiblePlayer = playersHere[0] || null;

      const div = document.createElement('div');
      let cls = `tile t-${tile.t === '.' ? 'dot' : tile.t}`;
      if (inFog)    cls += ' t-fog';
      if (isPlayer) cls += ' t-player';
      if (isAdj && !inFog) cls += ' t-adj-vis';
      if (canMove)  cls += ' t-adj';
      if (isVis && !isPlayer) cls += ' t-visited';
      if (isSelected) cls += ' t-selected';
      if (isTravelOrigin) cls += ' t-travel-origin';
      if (isTravelTarget) cls += ' t-travel-target';
      if (tile.t === 'C' && tile.cityId) cls += ` city-${tile.cityId}`;
      if (tile.areaId) cls += ` area-${tile.areaId.split('-').slice(0,2).join('-')}`;
      if (visiblePlayer) cls += ' t-other-player';
      div.className = cls;
      if (isPlayer || visiblePlayer) {
        const label = isPlayer
          ? `${_character?.name || 'You'}${playersHere.length ? ` +${playersHere.length}` : ''}`
          : `${visiblePlayer.name}${playersHere.length > 1 ? ` +${playersHere.length - 1}` : ''}`;
        const glyph = isPlayer ? '⊕' : '◉';
        div.innerHTML = `<span class="tile-nameplate">${escHtml(label)}</span><span class="tile-glyph">${escHtml(glyph)}</span>`;
      } else {
        div.textContent = TILE_GLYPHS[tile.t] ?? '·';
      }
      div.title = isPlayer
        ? `${_character?.name || 'You'}${playersHere.length ? ` + ${playersHere.length} nearby cultivator${playersHere.length > 1 ? 's' : ''}` : ''} · ${tile.name || TILE_TERRAIN_NAMES[tile.t] || 'Unknown terrain'}`
        : visiblePlayer
          ? `${visiblePlayer.name} · ${tile.name || TILE_TERRAIN_NAMES[tile.t] || 'Unknown terrain'}`
          : tile.name || TILE_TERRAIN_NAMES[tile.t] || 'Unknown terrain';

      if (canMove) {
        div.addEventListener('click', () => moveTile(x, y));
      } else if (isVis && tile.t !== 'M') {
        div.addEventListener('click', () => {
          if (isPlayer && _travelReadyAt <= Date.now()) {
            enterLocalTileView(x, y, regionId);
            renderTileMap();
          } else {
            showTileInfo(tile, x, y);
          }
        });
      }

      grid.appendChild(div);
    }
  }

  // Center viewport on player
  const vpW = wrap.clientWidth  || 600;
  const vpH = wrap.clientHeight || 440;
  const offsetX = Math.round(vpW / 2 - (visualPos.x + 0.5) * TILE_SIZE);
  const offsetY = Math.round(vpH / 2 - (visualPos.y + 0.5) * TILE_SIZE);
  grid.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

  const marker = document.getElementById('tile-travel-marker');
  if (marker) {
    wrap.classList.toggle('is-traveling', Boolean(travelRoute));
    if (travelRoute) {
      const angle = Math.atan2(travelRoute.toY - travelRoute.fromY, travelRoute.toX - travelRoute.fromX) * (180 / Math.PI);
      marker.classList.add('active');
      marker.innerHTML = `<span class="tile-travel-marker-core" style="transform:rotate(${angle}deg)">➤</span>`;
    } else {
      marker.classList.remove('active');
      marker.innerHTML = '';
    }
  }

  const realmLabel = document.getElementById('explore-realm-label');
  if (realmLabel) {
    const rName = REALM_NAMES[_character.realm_index] ?? 'Mortal';
    const regionName = ({ 'ashen-frontier':'Ashen Frontier', 'jade-delta':'Jade Delta', 'iron-wilds':'Iron Wilds', 'void-rift':'Void Rift', 'celestial-plateau':'Celestial Plateau', 'sovereign-wastes':'Sovereign Wastes' })[regionId] ?? regionId;
    realmLabel.textContent = `${regionName} · ${rName}`;
  }

  if (!_selectedWorldTile || _selectedWorldTile.regionId !== regionId) {
    _selectedWorldTile = { regionId, x: px, y: py };
  }

  renderWorldHud(regionId, px, py, visited);
  const activeTile = getRegionTile(regionId, _selectedWorldTile.x, _selectedWorldTile.y);
  showTileInfo(activeTile, _selectedWorldTile.x, _selectedWorldTile.y, { preserveSelection: true });
}

function renderLocalMapView(grid, wrap, TILE_SIZE) {
  // Render procedurally generated local mini-map
  if (!_localMapData || !_localViewTile) return;
  
  const mapW = _localMapData.width;
  const mapH = _localMapData.height;
  const tiles = _localMapData.tiles;
  const worldTile = getRegionTile(_localViewTile.regionId, _localViewTile.x, _localViewTile.y);
  const localVisitors = getVisiblePlayers().filter(player => player.regionId === _localViewTile.regionId && player.tileX === _localViewTile.x && player.tileY === _localViewTile.y);
  const visitorPositions = getLocalVisitorPositions(_localMapData, _localPlayerX, _localPlayerY, localVisitors);
  
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${mapW}, ${TILE_SIZE}px)`;
  grid.style.gridTemplateRows = `repeat(${mapH}, ${TILE_SIZE}px)`;
  
  // Render each local subtile
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const subtile = tiles[y * mapW + x];
      if (!subtile) continue;
      
      const isPlayer = x === _localPlayerX && y === _localPlayerY;
      const visitor = visitorPositions.get(`${x}:${y}`) || null;
      const canStep = Math.abs(x - _localPlayerX) + Math.abs(y - _localPlayerY) === 1;
      const terrainGlyph = subtile.mobs?.length
        ? '☠'
        : subtile.hazards?.length
          ? '!'
          : subtile.resources?.length
            ? (worldTile.herbs?.length ? '✿' : worldTile.ores?.length ? '⛏' : '◆')
            : ({ '#': '█', 'P': '◎', 'R': '·', 'B': '▥', 'H': '✿', 'F': '♣', 'W': '≈', 'M': '~', 'S': '◈', 'T': '⋰', 'D': '⊛', 'Q': '✺', 'A': '◆' }[subtile.terrain] || '·');
      
      const div = document.createElement('div');
      const terrainClass = subtile.terrain === '#' ? 'border' : subtile.terrain.toLowerCase();
      let cls = `local-tile terrain-${terrainClass}`;
      
      if (isPlayer) {
        cls += ' is-player';
      } else if (visitor) {
        cls += ' has-visitor';
      } else if (canStep && subtile.terrain !== '#' && subtile.terrain !== 'B') {
        cls += ' is-adjacent';
      } else if (subtile.resources?.length) {
        cls += ' has-resource';
      } else if (subtile.mobs?.length) {
        cls += ' has-mob';
      } else if (subtile.hazards?.length) {
        cls += ' has-hazard';
      } else if (subtile.npcName) {
        cls += ' has-npc';
      }
      
      if (subtile.terrain === '#') {
        cls += ' is-border';
      }
      
      div.className = cls;
      const label = isPlayer
        ? (_character?.name || 'You')
        : visitor?.name || subtile.npcName || subtile.label || '';
      const glyph = isPlayer ? '⊕' : visitor ? '◉' : terrainGlyph;
      div.innerHTML = `${label ? `<span class="local-tile-nameplate">${escHtml(label)}</span>` : ''}<span class="local-tile-glyph">${escHtml(glyph)}</span>`;
      div.title = visitor
        ? `${visitor.name} · ${subtile.label || subtile.terrain_kind}`
        : isPlayer && subtile?.service
          ? `${subtile.npcName || titleizeSlug(subtile.service)} · click to interact`
          : `[${x},${y}] ${subtile.terrain_kind}`;
      
      if (isPlayer && subtile?.service) {
        div.addEventListener('click', () => handleLocalCityAction(subtile.service, _localViewTile.x, _localViewTile.y));
        div.style.cursor = 'pointer';
      } else if (!isPlayer && !visitor && canStep && subtile.terrain !== '#' && subtile.terrain !== 'B') {
        div.addEventListener('click', () => {
          if (moveLocalPlayer(x, y)) {
            renderTileMap();
          }
        });
        div.style.cursor = 'pointer';
      }
      
      grid.appendChild(div);
    }
  }
  
  // Center viewport on local player
  const vpW = wrap.clientWidth || 600;
  const vpH = wrap.clientHeight || 440;
  const offsetX = Math.round(vpW / 2 - (_localPlayerX + 0.5) * TILE_SIZE);
  const offsetY = Math.round(vpH / 2 - (_localPlayerY + 0.5) * TILE_SIZE);
  grid.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

  const marker = document.getElementById('tile-travel-marker');
  if (marker) {
    marker.classList.remove('active');
    marker.innerHTML = '';
  }
  wrap.classList.remove('is-traveling');
  
  // Update realm label to show local map info
  const realmLabel = document.getElementById('explore-realm-label');
  if (realmLabel) {
    const areaName = getTileAreaProfile(worldTile).name;
    realmLabel.textContent = `${areaName} · Local Map ${_localMapData.width}×${_localMapData.height}`;
  }

  showTileInfo(worldTile, _localViewTile.x, _localViewTile.y, {
    preserveSelection: true,
    statusMessage: 'Local field active. Move tile by tile through the district, then swap back when you need the broader route.'
  });
}

async function moveTile(x, y) {
  if (_guestMode || !_character) return;
  // Client-side travel gate
  const now = Date.now();
  const renderedRegionId = getRenderedRegionId(_gameState);
  const tile = getRegionTile(renderedRegionId, x, y);
  const fromX = _gameState?.tileX ?? 9;
  const fromY = _gameState?.tileY ?? 6;
  if (_travelReadyAt > now) {
    const secs = Math.ceil((_travelReadyAt - now) / 1000);
    showTileInfo(tile, x, y, { statusMessage: `Still traveling… ${secs}s until movement opens again.` });
    return;
  }
  const regionId = _gameState?.regionId ?? 'ashen-frontier';
  const r = await API.post('/api/game/action', { action: 'moveToTile', options: { x, y, regionId, terrainType: tile.t } });
  if (!r.ok) {
    if (r.data.cooldown_ms) {
      _travelReadyAt = Date.now() + r.data.cooldown_ms;
      startTravelTimer();
    }
    showToast(r.data.error || 'Cannot move there.', 'warn');
    return;
  }
  _gameState = r.data.state ?? _gameState;
  if (r.data.travelCooldown > 0) {
    _travelReadyAt = Date.now() + r.data.travelCooldown;
    _lastTileEntry = { regionId: renderedRegionId, fromX, fromY, toX: x, toY: y };
    _travelRoute = {
      regionId: renderedRegionId,
      fromX,
      fromY,
      toX: x,
      toY: y,
      startedAt: Date.now(),
      readyAt: Date.now() + r.data.travelCooldown
    };
    startTravelTimer();
  } else {
    _travelRoute = null;
  }
  _selectedWorldTile = { regionId: renderedRegionId, x, y };
  renderTileMap();
  showTileInfo(tile, x, y, {
    statusMessage: 'Transit engaged. You are moving through this corridor now, not snapping straight into a finished arrival.'
  });
}

function startTravelTimer() {
  if (!_travelRoute && _travelReadyAt > Date.now()) {
    const regionId = getRenderedRegionId(_gameState);
    const x = _gameState?.tileX ?? 9;
    const y = _gameState?.tileY ?? 6;
    _travelRoute = { regionId, fromX: x, fromY: y, toX: x, toY: y, startedAt: Date.now(), readyAt: _travelReadyAt };
  }
  clearInterval(_travelTimerInterval);
  _travelTimerInterval = setInterval(() => {
    const rem = _travelReadyAt - Date.now();
    if (rem <= 0) {
      clearInterval(_travelTimerInterval);
      _travelTimerInterval = null;
      const regionId = getRenderedRegionId(_gameState);
      const x = _gameState?.tileX ?? 9;
      const y = _gameState?.tileY ?? 6;
      _travelRoute = null;
      _selectedWorldTile = { regionId, x, y };
      renderTileMap();
      showTileInfo(getRegionTile(regionId, x, y), x, y, {
        statusMessage: 'Arrival complete. Local routes, service hooks, and nearby contacts are live.'
      });
      return;
    }
    renderTileMap();
  }, 1000);
}

function showTileInfo(tile, x, y, options = {}) {
  const bar = document.getElementById('tile-info');
  if (!bar) return;

  const regionId = options.regionId ?? getRenderedRegionId(_gameState);
  _selectedWorldTile = { regionId, x, y };
  const travelRoute = getActiveTravelRoute();

  const currentX = _gameState?.tileX ?? 9;
  const currentY = _gameState?.tileY ?? 6;
  const isPlayer = x === currentX && y === currentY;
  const isTraveling = _travelReadyAt > Date.now();
  const travelSecs = Math.ceil(Math.max(0, _travelReadyAt - Date.now()) / 1000);
  const area = getTileAreaProfile(tile);
  const intelGroups = getTileIntelGroups(tile);
  const terrainName = TILE_TERRAIN_NAMES[tile.t] ?? 'Unknown Terrain';
  const glyph = isPlayer ? '⊕' : (TILE_GLYPHS[tile.t] ?? '·');
  const playersOnTile = getVisiblePlayers().filter(player => player.regionId === regionId && player.tileX === x && player.tileY === y);
  const dangerLabel = tile.hazard
    ? (tile.hazard >= 6 ? 'Extreme threat' : tile.hazard >= 4 ? 'High threat' : tile.hazard >= 2 ? 'Mid threat' : 'Low threat')
    : 'Quiet ground';
  const fromTile = travelRoute ? getRegionTile(regionId, travelRoute.fromX, travelRoute.fromY) : null;
  const isTravelTarget = travelRoute && x === travelRoute.toX && y === travelRoute.toY;
  const isTravelOrigin = travelRoute && x === travelRoute.fromX && y === travelRoute.fromY;
  const entryDirection = getTileEntryDirection(x, y);
  let statusMessage = options.statusMessage
    ?? (isTravelTarget
      ? `Transit from ${fromTile?.name || 'your previous tile'} is still underway. ${travelSecs}s remain on the route.`
      : isTravelOrigin
        ? `You already left this tile. ${travelSecs}s remain on the route out.`
        : isPlayer && isTraveling
      ? `In transit. ${travelSecs}s until the next move window opens.`
      : isPlayer
        ? 'You are here. Read the tile, act, or open the local field.'
        : 'This tile is within scouting range. Inspect it before you commit movement.');
  if (entryDirection && isPlayer && !isTraveling) {
    statusMessage += ` Entered from the ${entryDirection}.`;
  }

  const chips = [
    `<span class="tag-city">${escHtml(`Coords ${x},${y}`)}</span>`,
    `<span class="tag-city">${escHtml(terrainName)}</span>`
  ];
  if (tile.hazard) chips.push(`<span class="tag-danger">⚠ ${escHtml(dangerLabel)}</span>`);
  if (tile.spiritDensity) chips.push(`<span class="tag-vein">Spirit ×${tile.spiritDensity}</span>`);
  if (tile.cityId) chips.push('<span class="tag-city">City Anchor</span>');
  if (playersOnTile.length) chips.push(`<span class="tag-online">${escHtml(`${playersOnTile.length} nearby cultivator${playersOnTile.length > 1 ? 's' : ''}`)}</span>`);

  const actionButtons = [];
  if (tile.areaId) {
    actionButtons.push(`<button type="button" class="btn-sm btn-primary" onclick="openZoneForArea('${tile.areaId}', ${x}, ${y})">Area Intel</button>`);
  }
  if (tile.herbs?.length) {
    actionButtons.push(`<button type="button" class="btn-sm ${isPlayer && !isTraveling ? 'btn-primary' : 'btn-ghost'}" onclick="${isPlayer && !isTraveling ? `performTileFieldAction('herbs', ${x}, ${y})` : `previewWorldAction('herbs', ${x}, ${y})`}">${isPlayer && !isTraveling ? 'Forage' : 'Herb Routes'}</button>`);
  }
  if (tile.ores?.length) {
    actionButtons.push(`<button type="button" class="btn-sm ${isPlayer && !isTraveling ? 'btn-primary' : 'btn-ghost'}" onclick="${isPlayer && !isTraveling ? `performTileFieldAction('ores', ${x}, ${y})` : `previewWorldAction('ores', ${x}, ${y})`}">${isPlayer && !isTraveling ? 'Mine' : 'Ore Survey'}</button>`);
  }
  if (tile.mobs?.length) {
    actionButtons.push(`<button type="button" class="btn-sm ${isPlayer && !isTraveling ? 'btn-primary' : 'btn-ghost'}" onclick="${isPlayer && !isTraveling ? `performTileFieldAction('mobs', ${x}, ${y})` : `previewWorldAction('mobs', ${x}, ${y})`}">${isPlayer && !isTraveling ? 'Hunt' : 'Track Threats'}</button>`);
  }
  if (tile.drops?.length || tile.t === 'X') {
    actionButtons.push(`<button type="button" class="btn-sm ${isPlayer && !isTraveling ? 'btn-primary' : 'btn-ghost'}" onclick="${isPlayer && !isTraveling ? `performTileFieldAction('relic', ${x}, ${y})` : tile.areaId ? `openZoneForArea('${tile.areaId}', ${x}, ${y})` : `focusWorldTile(${x}, ${y})`}">${isPlayer && !isTraveling ? 'Scavenge' : 'Relic Intel'}</button>`);
  }
  if (tile.spiritDensity) {
    actionButtons.push(`<button type="button" class="btn-sm ${isPlayer && !isTraveling ? 'btn-primary' : 'btn-ghost'}" onclick="${isPlayer && !isTraveling ? `performTileFieldAction('spirit', ${x}, ${y})` : `previewWorldAction('spirit', ${x}, ${y})`}">${isPlayer && !isTraveling ? 'Resonate' : 'Qi Survey'}</button>`);
  }
  if (isPlayer && !isTraveling) {
    actionButtons.unshift(`<button type="button" class="btn-sm btn-primary" onclick="toggleWorldView()">${_viewMode === 'local' ? 'Back to World Map' : 'Open Local Field'}</button>`);
  }

  const state = _gameState ?? { hp: 0, hpMax: 0, qi: 0, qiMax: 0, battleQi: 0, battleQiMax: 0 };
  const liveClockText = getLiveClockText();
  const playerStatusText = `${state.hp}/${state.hpMax} HP · ${state.qi}/${state.qiMax} Qi · ${state.battleQi}/${state.battleQiMax} BQi`;
  const intelMarkup = intelGroups.map(group => {
    const items = group.items
      .map(item => `<span class="${group.chipClass}">${escHtml(titleizeSlug(item))}</span>`)
      .join(' ');
    return `
      <div class="tile-intel-inline">
        <div class="tile-intel-inline-label">${escHtml(group.label)}</div>
        <div class="tile-intel-copy">${items}</div>
      </div>
    `;
  }).join('');

  bar.dataset.traveling = isPlayer && isTraveling ? '1' : '0';
  bar.innerHTML = `
    <div class="tile-readout">
      <div class="tile-readout-head">
        <div>
          <div class="tile-readout-kicker">${isPlayer ? 'Current Tile' : 'Surveyed Tile'}</div>
          <h3 class="tile-readout-title">${escHtml(glyph)} ${escHtml(area.name)}</h3>
          <div class="tile-detail-meta">${chips.join(' ')}</div>
        </div>
        <div class="tile-detail-glyph">${escHtml(glyph)}</div>
      </div>

      <div class="tile-readout-summary${isPlayer && isTraveling ? ' is-live' : ''}">${escHtml(statusMessage)}</div>

      <div class="tile-readout-strip">
        <div class="tile-readout-line">
          <div class="tile-readout-line-label">Condition</div>
          <div class="tile-readout-line-value">${escHtml(playerStatusText)}</div>
        </div>
        <div class="tile-readout-line">
          <div class="tile-readout-line-label">Clock</div>
          <div class="tile-readout-line-value">${escHtml(liveClockText)}</div>
        </div>
        <div class="tile-readout-line">
          <div class="tile-readout-line-label">Threat</div>
          <div class="tile-readout-line-value">${escHtml(dangerLabel)}</div>
        </div>
        <div class="tile-readout-line">
          <div class="tile-readout-line-label">View</div>
          <div class="tile-readout-line-value">${_viewMode === 'local' && isPlayer ? 'Local field active' : 'World map active'}</div>
        </div>
      </div>

      ${intelMarkup ? `<div class="tile-intel-inline-list">${intelMarkup}</div>` : '<div class="world-empty-note">No obvious herbs, veins, drops, or roaming packs are surfacing on this exact tile yet.</div>'}

      ${tile.afkable ? '<div class="tag-afk">⏳ Repeatable field loop marked on this tile</div>' : ''}
      ${actionButtons.length ? `<div class="world-action-row">${actionButtons.join('')}</div>` : ''}
    </div>
  `;

  renderWorldSupportPanels(tile, x, y);
}

async function openZoneForArea(areaId, x, y) {
  if (_guestMode || !_character) return;

  const bar = document.getElementById('tile-info');
  if (!bar) return;
  const regionId = getRenderedRegionId(_gameState);
  const tx = x ?? _selectedWorldTile?.x ?? (_gameState?.tileX ?? 9);
  const ty = y ?? _selectedWorldTile?.y ?? (_gameState?.tileY ?? 6);
  const tile = getRegionTile(regionId, tx, ty);
  const area = getTileAreaProfile({ ...tile, areaId });
  _selectedWorldTile = { regionId, x: tx, y: ty };

  let zones = [];
  const zr = await API.get('/api/zones');
  if (zr.ok) {
    const targets = new Set([
      slugifyWorld(areaId),
      slugifyWorld(area.name),
      slugifyWorld(tile.name)
    ]);
    zones = (zr.data.zones || []).filter(zone => {
      const zoneSlugs = [slugifyWorld(zone.id), slugifyWorld(zone.name)];
      return zoneSlugs.some(zoneSlug => {
        for (const target of targets) {
          if (!target) continue;
          if (zoneSlug === target || zoneSlug.includes(target) || target.includes(zoneSlug)) {
            return true;
          }
        }
        return false;
      });
    });
  }

  let bodyHtml = `
    <div class="tile-area-report">
      <div class="tile-detail-header">
        <div>
          <div class="tile-detail-kicker">Area Intel</div>
          <h3 class="tile-detail-title">${escHtml(area.name)}</h3>
          <div class="tile-detail-meta">
            <span class="tag-city">${escHtml(area.typeLabel)}</span>
            <span class="tag-city">${escHtml(area.focusLabel)}</span>
            ${area.danger ? `<span class="tag-danger">⚠ Danger ${area.danger}</span>` : ''}
          </div>
        </div>
        <button type="button" class="btn-sm btn-ghost" onclick="focusWorldTile(${tx}, ${ty})">Back To Tile</button>
      </div>
      <p class="tile-section-copy">${escHtml(area.description)} ${escHtml(area.summary)}</p>
  `;

  if (!zones.length) {
    const fallbackCards = getTileIntelGroups(tile).map(group => `
      <div class="node-card node-card-local">
        <div class="node-name">${escHtml(group.label)}</div>
        <div class="node-meta">Local tile survey · ${group.items.length} mapped signal(s)</div>
        <div class="tile-section-copy">${group.items.map(item => escHtml(titleizeSlug(item))).join(', ')}</div>
      </div>
    `).join('');

    bodyHtml += `
      <div class="world-empty-note">
        This area currently displays local survey metadata while a dedicated exploration zone seed is pending.
      </div>
      ${fallbackCards || '<div class="world-empty-note">No persistent node packages are seeded for this area yet.</div>'}
    `;
    bodyHtml += '</div>';
    bar.innerHTML = bodyHtml;
    return;
  }

  const zone = zones[0];
  const rd = await API.get(`/api/zones/${zone.id}`);
  if (!rd.ok) {
    bodyHtml += '<div class="world-empty-note">The live zone hook exists, but its detail payload failed to load.</div></div>';
    bar.innerHTML = bodyHtml;
    return;
  }

  const nodes = rd.data.nodes || [];
  bodyHtml += `<div class="tile-section-card"><div class="tile-section-label">Live Zone Match</div><div class="tile-section-value">${escHtml(zone.name)}</div><p class="tile-section-copy">${escHtml(zone.description || 'This zone has a live server payload and can be explored for drops.')}</p></div>`;
  bodyHtml += nodes.length
    ? '<div class="node-list">'
    : '<div class="world-empty-note">This zone is linked, but no live nodes are currently available.</div>';

  nodes.forEach(node => {
    const lastLooted = node.last_looted;
    const respawnMs = (node.respawn_hours || 4) * 3600000;
    const onCd = lastLooted && (Date.now() - lastLooted < respawnMs);
    const rem  = onCd ? respawnMs - (Date.now() - lastLooted) : 0;
    const discovered = node.discovered;
    bodyHtml += `<div class="node-card ${onCd ? 'node-cd' : ''}" style="margin:.3rem 0 0">`;
    bodyHtml += `<span class="node-name">${discovered ? escHtml(node.name) : '??? Unknown'}</span>`;
    bodyHtml += ` <span class="node-meta">${escHtml(node.node_type||'')} · Realm ${node.realm_req}+</span>`;
    if (onCd) bodyHtml += ` <span class="node-cd-label">Respawning ${msToMin(rem)}</span>`;
    else      bodyHtml += ` <button class="btn-sm btn-primary" onclick="exploreNodeFromTile('${node.id}','${zone.id}')">Explore</button>`;
    bodyHtml += `</div>`;
  });
  if (nodes.length) bodyHtml += '</div>';
  bodyHtml += '</div>';
  bar.innerHTML = bodyHtml;
}

async function exploreNodeFromTile(nodeId, zoneId) {
  const r = await API.post('/api/game/action', { action: 'exploreNode', options: { nodeId, zoneId } });
  if (!r.ok) { showToast(r.data.error || 'Exploration failed.', 'error'); return; }
  _gameState = r.data.state;
  renderAll();
  showToast((r.data.result || ['Explored!']).join(' '), 'ok');
  appendToLog((r.data.result || []).join(' '));
  // Refresh the area info
  const regionId = getRenderedRegionId(_gameState);
  const tile = getRegionTile(regionId, _gameState.tileX ?? 9, _gameState.tileY ?? 6);
  if (tile.areaId) openZoneForArea(tile.areaId, _gameState.tileX ?? 9, _gameState.tileY ?? 6);
}

function isTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function setupExplorePanel() {
  document.getElementById('btn-toggle-world-view')?.addEventListener('click', toggleWorldView);
  document.getElementById('close-interaction')?.addEventListener('click', closeInteractionModal);
  document.querySelectorAll('[data-world-tab]').forEach(btn => {
    btn.addEventListener('click', () => setWorldSupportTab(btn.dataset.worldTab || 'local'));
  });
  updateWorldViewToggle();
  updateWorldSupportTabs();
  
  // Keyboard controls for local map navigation
  document.addEventListener('keydown', (e) => {
    if (_viewMode !== 'local' || _localPlayerX === null || _localPlayerY === null) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
    if (isInteractionModalOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeInteractionModal();
      }
      return;
    }
    
    let moved = false;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        moved = moveLocalPlayer(_localPlayerX, _localPlayerY - 1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        moved = moveLocalPlayer(_localPlayerX, _localPlayerY + 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        moved = moveLocalPlayer(_localPlayerX - 1, _localPlayerY);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        moved = moveLocalPlayer(_localPlayerX + 1, _localPlayerY);
        break;
      case 'Escape':
        e.preventDefault();
        toggleWorldView();
        break;
    }
    
    if (moved) {
      renderTileMap();
    }
  });
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
