function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialState() {
  const ring = GAME_CONSTANTS.rings[0];
  return {
    realmIndex: 0,
    stageIndex: 0,
    qi: 20,
    qiMax: 100,
    hp: 100,
    hpMax: 100,
    bankSilver: 0,
    wallet: 140,
    stats: {
      physique: 10,
      soulSense: 10,
      comprehension: 10,
      fortune: 10,
      karma: 0
    },
    paths: {
      body: 1,
      soul: 1,
      spirit: 0,
      craft: 0,
      alchemy: 0
    },
    learnedPaths: {
      body: true,
      soul: true,
      spirit: false,
      craft: false,
      alchemy: false
    },
    longevityCurrent: 80,
    longevityMax: 80,
    inventory: [
      { id: "spirit-herb", qty: 4 }
    ],
    baseSlots: 12,
    baseCarry: 50,
    ringLevel: 0,
    ring,
    homeLevel: 0,
    home: null,
    guildMember: false,
    turn: 0,
    cooldowns: {},
    currentRegionId: "ashen-frontier",
    currentCityId: "ember",
    legacyNotes: 0,
    log: ["You awaken in Ember Court with little silver and stubborn ambition."]
  };
}

const ACTION_COOLDOWNS = {
  meditate: 4,
  breakthrough: 8,
  learnTechnique: 10,
  trainBody: 5,
  trainSoul: 5,
  trainSpirit: 6,
  trainCraft: 6,
  trainAlchemy: 6,
  hunt: 7,
  sell: 4,
  bank: 4,
  buyRing: 12,
  buyHome: 15,
  travelRegion: 8,
  explore: 6,
  save: 0,
  reset: 0
};

function getRealmStageLabel(state) {
  const realm = GAME_CONSTANTS.realms[state.realmIndex];
  return `${realm.name} - ${realm.stages[state.stageIndex]}`;
}

function getItemTemplate(id) {
  return GAME_CONSTANTS.inventoryTemplates.find((it) => it.id === id);
}

function getInventoryWeight(state) {
  return state.inventory.reduce((sum, stack) => {
    const t = getItemTemplate(stack.id);
    return sum + (t ? t.weight * stack.qty : 0);
  }, 0);
}

function getInventorySlotsUsed(state) {
  return state.inventory.length;
}

function getSlotLimit(state) {
  const homeSlots = state.home ? state.home.slots : 0;
  return state.baseSlots + state.ring.slots + homeSlots;
}

function getCarryLimit(state) {
  const homeWeight = state.home ? state.home.safeWeight : 0;
  return state.baseCarry + state.ring.maxWeight + Math.round(homeWeight * 0.15);
}

function getCurrentCity(state) {
  return GAME_CONSTANTS.cities.find((c) => c.id === state.currentCityId);
}

function getCurrentRegion(state) {
  return GAME_CONSTANTS.regions.find((region) => region.id === state.currentRegionId) || GAME_CONSTANTS.regions[0];
}

function getCitiesForRegion(regionId) {
  return GAME_CONSTANTS.cities.filter((city) => city.regionId === regionId);
}

function isRegionAdjacent(state, targetRegionId) {
  const current = getCurrentRegion(state);
  if (!current) {
    return false;
  }
  if (current.id === targetRegionId) {
    return true;
  }
  return current.neighbors.includes(targetRegionId);
}

function pushLog(state, text, cls = "") {
  const line = cls ? `[${cls.toUpperCase()}] ${text}` : text;
  state.log.unshift(line);
  if (state.log.length > 40) {
    state.log.pop();
  }
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getActionReadyTurn(state, action) {
  return state.cooldowns[action] || 0;
}

function actionTurnsRemaining(state, action) {
  return Math.max(0, getActionReadyTurn(state, action) - nowSeconds());
}

function canUseAction(state, action) {
  return actionTurnsRemaining(state, action) === 0;
}

function applyCooldown(state, action) {
  const cd = ACTION_COOLDOWNS[action] || 0;
  if (cd > 0) {
    state.cooldowns[action] = nowSeconds() + cd;
  }
}

function actionConsumesTurn(action) {
  return action !== "save" && action !== "reset";
}

function consumeTurnAndCooldown(state, action) {
  state.turn += 1;
  applyCooldown(state, action);
}

function addRandomItem(state) {
  const t = GAME_CONSTANTS.inventoryTemplates[Math.floor(Math.random() * GAME_CONSTANTS.inventoryTemplates.length)];
  const qty = 1 + Math.floor(Math.random() * 4);
  const existing = state.inventory.find((it) => it.id === t.id);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, t.maxStack);
  } else {
    state.inventory.push({ id: t.id, qty });
  }
  pushLog(state, `Gathered ${qty}x ${t.label}.`, "good");
}

function clampVitals(state) {
  state.qi = Math.max(0, Math.min(state.qi, state.qiMax));
  state.hp = Math.max(0, Math.min(state.hp, state.hpMax));
  state.longevityCurrent = Math.max(1, Math.min(state.longevityCurrent, state.longevityMax));
}

function huntBeast(state) {
  const qiCost = 8;
  if (state.qi < qiCost) {
    pushLog(state, "Insufficient qi to safely hunt.", "bad");
    return;
  }

  state.qi -= qiCost;
  const realmPressure = state.realmIndex * 14 + state.stageIndex * 7;
  const playerPower = state.stats.physique * 2 + state.paths.body * 3 + state.paths.soul + Math.floor(Math.random() * 30);
  const beastPower = 20 + realmPressure + Math.floor(Math.random() * 35);

  if (playerPower >= beastPower) {
    addRandomItem(state);
    state.wallet += 10;
    state.stats.physique += 1;
    state.hp = Math.min(state.hpMax, state.hp + 2);
    pushLog(state, "Hunt success. Beast defeated and resources harvested.", "good");
  } else {
    state.hp = Math.max(0, state.hp - 12);
    state.longevityCurrent = Math.max(1, state.longevityCurrent - 2);
    pushLog(state, "Hunt failed. You escape wounded and lose vitality.", "bad");
  }
}

function sellHalfMaterials(state) {
  let total = 0;
  state.inventory.forEach((stack) => {
    const t = getItemTemplate(stack.id);
    if (!t || stack.qty <= 0) {
      return;
    }
    const sold = Math.floor(stack.qty / 2);
    stack.qty -= sold;
    total += sold * t.value;
  });
  state.inventory = state.inventory.filter((it) => it.qty > 0);
  state.wallet += total;
  if (total > 0) {
    pushLog(state, `Sold excess materials for ${total} silver.`, "good");
  } else {
    pushLog(state, "Nothing to sell.", "bad");
  }
}

function attemptBreakthrough(state) {
  const finalRealmIndex = GAME_CONSTANTS.realms.length - 1;
  const finalStageIndex = GAME_CONSTANTS.realms[finalRealmIndex].stages.length - 1;
  if (state.realmIndex === finalRealmIndex && state.stageIndex === finalStageIndex) {
    pushLog(state, "You are already at the current prototype's highest stage.", "bad");
    return;
  }

  const minQi = 25 + state.realmIndex * 5;
  if (state.qi < minQi) {
    pushLog(state, `Need at least ${minQi} qi to attempt this breakthrough.`, "bad");
    return;
  }

  const realm = GAME_CONSTANTS.realms[state.realmIndex];
  const pathSum = state.paths.body + state.paths.soul + state.paths.spirit + state.paths.craft + state.paths.alchemy;
  const difficulty = 60 + state.realmIndex * 14 + state.stageIndex * 10;
  const power = state.qi + state.stats.comprehension * 2 + pathSum * 2 + Math.floor(Math.random() * 22);

  if (power >= difficulty) {
    state.qi = Math.max(0, state.qi - 30);
    state.stageIndex += 1;
    if (state.stageIndex >= realm.stages.length) {
      state.stageIndex = 0;
      state.realmIndex += 1;
    }

    const nextRealm = GAME_CONSTANTS.realms[state.realmIndex];
    state.longevityMax = Math.max(state.longevityMax, nextRealm.longevityBase);
    state.longevityCurrent = Math.min(state.longevityCurrent + 20, state.longevityMax);
    state.stats.physique += 1;
    state.stats.soulSense += 1;
    state.qiMax = Math.min(300, state.qiMax + 5);
    state.hpMax = Math.min(300, state.hpMax + 3);
    state.hp = Math.min(state.hpMax, state.hp + 6);
    pushLog(state, `Breakthrough success! Entered ${getRealmStageLabel(state)}.`, "good");
  } else {
    state.qi = Math.max(0, state.qi - 15);
    state.hp = Math.max(0, state.hp - 8);
    state.longevityCurrent = Math.max(1, state.longevityCurrent - 3);
    pushLog(state, "Breakthrough backlash. Qi disorder and lifespan loss.", "bad");
  }
}

function runEvent(state) {
  const eligibleEvents = GAME_CONSTANTS.events.filter((event) => {
    if (typeof event.canTrigger !== "function") {
      return true;
    }
    return event.canTrigger(state);
  });

  if (eligibleEvents.length === 0) {
    pushLog(state, "No valid events are currently available.", "bad");
    return;
  }

  const event = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
  event.onResolve(state, { inventoryWeight: getInventoryWeight(state) });
  pushLog(state, `${event.title}: ${event.text}` + (event.logClass ? ` (${event.logClass})` : ""), state.logClass || "");
  state.logClass = "";
}

function trainPath(state, key, qiCost) {
  if (!state.learnedPaths[key]) {
    pushLog(state, `${key} cultivation is locked. Learn the technique first.`, "bad");
    return;
  }
  if (state.qi < qiCost) {
    pushLog(state, "Not enough qi to train that path.", "bad");
    return;
  }
  state.qi -= qiCost;
  state.paths[key] += 1;
  if (key === "alchemy" || key === "craft") {
    state.wallet += 8;
  }
  pushLog(state, `${key} cultivation advanced to ${state.paths[key]}.`, "good");
}

function acquireRing(state) {
  const next = GAME_CONSTANTS.rings[state.ringLevel + 1];
  if (!next) {
    pushLog(state, "Your current ring is already at top known tier.", "bad");
    return;
  }
  if (state.wallet < next.cost) {
    pushLog(state, `Need ${next.cost} silver for ${next.tier}.`, "bad");
    return;
  }
  state.wallet -= next.cost;
  state.ringLevel += 1;
  state.ring = next;
  pushLog(state, `Acquired ${next.tier}. Storage expanded.`, "good");
}

function acquireHome(state) {
  const next = GAME_CONSTANTS.homes[state.homeLevel];
  if (!next) {
    pushLog(state, "No higher residence tier is currently available.", "bad");
    return;
  }

  const city = getCurrentCity(state);
  const totalCost = next.cost + city.landCost;
  if (state.wallet < totalCost) {
    pushLog(state, `Need ${totalCost} silver to secure ${next.tier} in ${city.name}.`, "bad");
    return;
  }

  state.wallet -= totalCost;
  state.homeLevel += 1;
  state.home = next;
  pushLog(state, `Acquired ${next.tier} in ${city.name}. Secure vault unlocked.`, "good");
}

function switchCity(state, id) {
  const city = GAME_CONSTANTS.cities.find((candidate) => candidate.id === id);
  if (!city) {
    pushLog(state, "Unknown city.", "bad");
    return;
  }
  if (city.regionId !== state.currentRegionId) {
    pushLog(state, `You must enter ${city.regionId} before traveling to ${city.name}.`, "bad");
    return;
  }
  state.currentCityId = id;
  pushLog(state, `You relocated to ${city.name} (${city.world}).`, "good");
}

function travelRegion(state, targetRegionId) {
  const target = GAME_CONSTANTS.regions.find((region) => region.id === targetRegionId);
  if (!target) {
    pushLog(state, "Unknown region.", "bad");
    return;
  }
  if (target.id === state.currentRegionId) {
    pushLog(state, `You are already in ${target.name}.`, "bad");
    return;
  }
  if (!isRegionAdjacent(state, targetRegionId)) {
    pushLog(state, `${target.name} is not directly connected to your current region.`, "bad");
    return;
  }
  if (!canUseAction(state, "travelRegion")) {
    pushLog(state, `Regional travel is cooling down for ${actionTurnsRemaining(state, "travelRegion")}s.`, "bad");
    return;
  }

  const qiCost = 6;
  if (state.qi < qiCost) {
    pushLog(state, "Not enough qi to travel safely between regions.", "bad");
    return;
  }

  state.qi -= qiCost;
  state.currentRegionId = target.id;
  const regionalCities = getCitiesForRegion(target.id);
  if (!regionalCities.some((city) => city.id === state.currentCityId) && regionalCities.length > 0) {
    state.currentCityId = regionalCities[0].id;
  }

  consumeTurnAndCooldown(state, "travelRegion");
  pushLog(state, `You crossed into ${target.name}. Danger: ${target.danger}.`, "good");
}

function learnTechnique(state) {
  const unlockable = Object.entries(state.learnedPaths)
    .filter(([, isLearned]) => !isLearned)
    .map(([key]) => key);

  if (unlockable.length === 0) {
    pushLog(state, "All current cultivation paths are already learned.", "bad");
    return;
  }

  if (state.qi < 15 || state.wallet < 25) {
    pushLog(state, "Learning a new path requires at least 15 qi and 25 silver.", "bad");
    return;
  }

  state.qi -= 15;
  state.wallet -= 25;
  const learned = unlockable[Math.floor(Math.random() * unlockable.length)];
  state.learnedPaths[learned] = true;
  state.paths[learned] = Math.max(1, state.paths[learned]);
  pushLog(state, `Technique breakthrough: ${learned} cultivation path unlocked.`, "good");
}

function saveState(state) {
  localStorage.setItem(GAME_CONSTANTS.saveKey, JSON.stringify(state));
  pushLog(state, "Progress saved.", "good");
}

function loadState() {
  try {
    const raw = localStorage.getItem(GAME_CONSTANTS.saveKey);
    if (!raw) {
      return createInitialState();
    }
    const parsed = JSON.parse(raw);
    const base = createInitialState();
    const merged = { ...base, ...parsed };
    merged.stats = { ...base.stats, ...(parsed.stats || {}) };
    merged.paths = { ...base.paths, ...(parsed.paths || {}) };
    merged.learnedPaths = { ...base.learnedPaths, ...(parsed.learnedPaths || {}) };
    merged.cooldowns = { ...base.cooldowns, ...(parsed.cooldowns || {}) };
    merged.ringLevel = Number.isInteger(merged.ringLevel) ? merged.ringLevel : 0;
    merged.ring = GAME_CONSTANTS.rings[merged.ringLevel] || GAME_CONSTANTS.rings[0];
    merged.currentRegionId = merged.currentRegionId || base.currentRegionId;
    const city = GAME_CONSTANTS.cities.find((candidate) => candidate.id === merged.currentCityId);
    if (!city || city.regionId !== merged.currentRegionId) {
      const fallbackCity = getCitiesForRegion(merged.currentRegionId)[0] || GAME_CONSTANTS.cities[0];
      merged.currentCityId = fallbackCity.id;
    }
    return merged;
  } catch {
    return createInitialState();
  }
}

function render(state) {
  const currentRegion = getCurrentRegion(state);
  const hpPct = Math.round((state.hp / state.hpMax) * 100);
  const qiPct = Math.round((state.qi / state.qiMax) * 100);
  const lifePct = Math.round((state.longevityCurrent / state.longevityMax) * 100);

  document.getElementById("current-region").textContent = `Region: ${currentRegion.name}`;
  document.getElementById("current-city").textContent = `City: ${getCurrentCity(state).name}`;
  document.getElementById("realm-display").textContent = `Realm: ${getRealmStageLabel(state)}`;
  document.getElementById("hp-display").textContent = `${state.hp} / ${state.hpMax}`;
  document.getElementById("qi-display").textContent = `${state.qi} / ${state.qiMax}`;
  document.getElementById("longevity-display").textContent = `${state.longevityCurrent} / ${state.longevityMax}`;
  document.getElementById("hp-meter").style.width = `${hpPct}%`;
  document.getElementById("qi-meter").style.width = `${qiPct}%`;
  document.getElementById("longevity-meter").style.width = `${lifePct}%`;

  const statsGrid = document.getElementById("stats-grid");
  statsGrid.innerHTML = "";
  const baseStats = [
    ["Turn", state.turn],
    ["HP", `${state.hp}/${state.hpMax}`],
    ["Qi", state.qi],
    ["Qi Max", state.qiMax],
    ["Wallet Silver", state.wallet],
    ["Banked Silver", state.bankSilver],
    ["Longevity", `${state.longevityCurrent} / ${state.longevityMax}`],
    ["Physique", state.stats.physique],
    ["Soul Sense", state.stats.soulSense],
    ["Comprehension", state.stats.comprehension],
    ["Fortune", state.stats.fortune],
    ["Karma", state.stats.karma]
  ];
  baseStats.forEach(([label, value]) => {
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    tile.innerHTML = `<strong>${label}</strong><div>${value}</div>`;
    statsGrid.appendChild(tile);
  });

  const pathGrid = document.getElementById("path-grid");
  pathGrid.innerHTML = "";
  Object.entries(state.paths).forEach(([key, value]) => {
    const tile = document.createElement("div");
    tile.className = "path-tile";
    const lockState = state.learnedPaths[key] ? "Learned" : "Locked";
    tile.innerHTML = `<strong>${key}</strong><div>Level ${value}</div><div>${lockState}</div>`;
    pathGrid.appendChild(tile);
  });

  const invWeight = getInventoryWeight(state);
  const invSlots = getInventorySlotsUsed(state);
  const slotLimit = getSlotLimit(state);
  const carryLimit = getCarryLimit(state);

  document.getElementById("inventory-topline").textContent =
    `Slots ${invSlots}/${slotLimit} | Weight ${invWeight}/${carryLimit} | Ring: ${state.ring.tier} | Home: ${state.home ? state.home.tier : "None"}`;

  const invList = document.getElementById("inventory-list");
  invList.innerHTML = "";
  state.inventory.forEach((stack) => {
    const t = getItemTemplate(stack.id);
    const li = document.createElement("li");
    li.textContent = `${t.label} x${stack.qty} (w:${t.weight}, v:${t.value})`;
    invList.appendChild(li);
  });

  const regionGrid = document.getElementById("region-grid");
  regionGrid.innerHTML = "";
  GAME_CONSTANTS.regions.forEach((region) => {
    const tile = document.createElement("div");
    tile.className = "city-tile";
    const isCurrent = region.id === state.currentRegionId;
    const isAdjacent = isRegionAdjacent(state, region.id);
    tile.innerHTML = `
      <strong>${region.name}</strong>
      <div>World: ${region.world}</div>
      <div>Danger: ${region.danger}</div>
      <div>Resources: ${region.resources}</div>
    `;
    const btn = document.createElement("button");
    const regionalTravelRemaining = actionTurnsRemaining(state, "travelRegion");
    btn.textContent = isCurrent
      ? "Current Region"
      : regionalTravelRemaining > 0
        ? `Travel Region (${regionalTravelRemaining}s)`
        : "Travel Region";
    btn.disabled = isCurrent || !isAdjacent || regionalTravelRemaining > 0;
    btn.addEventListener("click", () => {
      travelRegion(state, region.id);
      render(state);
    });
    tile.appendChild(btn);
    regionGrid.appendChild(tile);
  });

  const cityGrid = document.getElementById("city-grid");
  cityGrid.innerHTML = "";
  getCitiesForRegion(state.currentRegionId).forEach((city) => {
    const tile = document.createElement("div");
    tile.className = "city-tile";
    const isCurrentCity = city.id === state.currentCityId;
    tile.innerHTML = `
      <strong>${city.name}</strong>
      <div>World: ${city.world}</div>
      <div>Avg Realm: ${city.avgRealm}</div>
      <div>Law: ${city.law}</div>
    `;
    const btn = document.createElement("button");
    btn.textContent = isCurrentCity ? "Current City" : "Travel City";
    btn.disabled = isCurrentCity;
    btn.addEventListener("click", () => {
      switchCity(state, city.id);
      render(state);
    });
    tile.appendChild(btn);
    cityGrid.appendChild(tile);
  });

  const note = document.getElementById("breakthrough-note");
  note.textContent = "Breakthroughs require enough qi, get harder by stage, and stop at current cap.";

  const cooldownNote = document.getElementById("cooldown-note");
  const activeCooldowns = Object.entries(state.cooldowns)
    .map(([action, readyAt]) => [action, Math.max(0, readyAt - nowSeconds())])
    .filter(([, remaining]) => remaining > 0)
    .map(([action, remaining]) => `${action}:${remaining}s`);
  cooldownNote.textContent = activeCooldowns.length > 0
    ? `Cooldowns -> ${activeCooldowns.join(" | ")}`
    : "Cooldowns -> none";

  const globalCooldownNote = document.getElementById("global-cooldown-note");
  globalCooldownNote.textContent = cooldownNote.textContent;

  document.querySelectorAll("button[data-action]").forEach((button) => {
    const action = button.getAttribute("data-action");
    const remaining = actionTurnsRemaining(state, action);
    const label = button.textContent.split(" (")[0];
    button.disabled = remaining > 0;
    button.textContent = remaining > 0 ? `${label} (${remaining}s)` : label;
  });

  const eventLog = document.getElementById("event-log");
  eventLog.innerHTML = "";
  state.log.forEach((line) => {
    const li = document.createElement("li");
    if (line.startsWith("[GOOD]")) {
      li.className = "good";
    }
    if (line.startsWith("[BAD]")) {
      li.className = "bad";
    }
    li.textContent = line.replace("[GOOD] ", "").replace("[BAD] ", "");
    eventLog.appendChild(li);
  });
}

function applyAction(state, action) {
  if (!canUseAction(state, action)) {
    pushLog(state, `Action on cooldown. Wait ${actionTurnsRemaining(state, action)}s.`, "bad");
    return;
  }

  let performed = false;
  if (action === "meditate") {
    state.qi += 12;
    state.hp += 4;
    state.stats.comprehension += 1;
    pushLog(state, "Meditation cycle complete. Qi, HP, and comprehension increased.", "good");
    performed = true;
  }
  if (action === "breakthrough") {
    attemptBreakthrough(state);
    performed = true;
  }
  if (action === "learnTechnique") {
    learnTechnique(state);
    performed = true;
  }
  if (action === "trainBody") {
    trainPath(state, "body", 10);
    performed = true;
  }
  if (action === "trainSoul") {
    trainPath(state, "soul", 10);
    performed = true;
  }
  if (action === "trainSpirit") {
    trainPath(state, "spirit", 12);
    performed = true;
  }
  if (action === "trainCraft") {
    trainPath(state, "craft", 9);
    performed = true;
  }
  if (action === "trainAlchemy") {
    trainPath(state, "alchemy", 9);
    performed = true;
  }
  if (action === "hunt") {
    huntBeast(state);
    performed = true;
  }
  if (action === "sell") {
    sellHalfMaterials(state);
    performed = true;
  }
  if (action === "bank") {
    if (state.wallet >= 20) {
      state.wallet -= 20;
      state.bankSilver += 20;
      pushLog(state, "Deposited 20 silver into your vault ledger.", "good");
    } else {
      pushLog(state, "Need at least 20 silver to make a deposit.", "bad");
    }
    performed = true;
  }
  if (action === "buyRing") {
    acquireRing(state);
    performed = true;
  }
  if (action === "buyHome") {
    acquireHome(state);
    performed = true;
  }
  if (action === "explore") {
    runEvent(state);
    performed = true;
  }
  if (action === "save") {
    saveState(state);
    performed = true;
  }
  if (action === "reset") {
    localStorage.removeItem(GAME_CONSTANTS.saveKey);
    const fresh = createInitialState();
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, deepClone(fresh));
    pushLog(state, "Cycle reset. A new path begins.", "bad");
    performed = true;
  }

  if (performed && actionConsumesTurn(action)) {
    consumeTurnAndCooldown(state, action);
  }

  clampVitals(state);

  const weight = getInventoryWeight(state);
  const limit = getCarryLimit(state);
  if (weight > limit) {
    state.stats.fortune = Math.max(1, state.stats.fortune - 1);
    pushLog(state, "Overburdened: movement and fortune penalty applied.", "bad");
  }

  if (state.hp <= 0) {
    state.hp = 1;
    state.qi = Math.max(0, state.qi - 20);
    state.wallet = Math.max(0, state.wallet - 15);
    pushLog(state, "You collapsed from injuries and lost qi and silver recovering.", "bad");
  }
}

function bootstrap() {
  const state = loadState();
  clampVitals(state);
  document.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");
      applyAction(state, action);
      render(state);
    });
  });
  render(state);
  setInterval(() => render(state), 500);
}

bootstrap();
