function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function formatSeconds(value) {
  return `${Math.max(0, Math.floor(value))}s`;
}

function getItemTemplate(id) {
  return GAME_CONSTANTS.inventoryTemplates.find((it) => it.id === id);
}

function getEquipmentTemplate(id) {
  return (GAME_CONSTANTS.equipmentTemplates || []).find((it) => it.id === id);
}

function getInventoryTemplate(id) {
  return getItemTemplate(id) || getEquipmentTemplate(id) || null;
}

function isEquipmentItem(id) {
  return Boolean(getEquipmentTemplate(id));
}

function getTechniqueTemplate(id) {
  return (GAME_CONSTANTS.techniques || []).find((t) => t.id === id);
}

function getSpiritTemplate(id) {
  return (GAME_CONSTANTS.spiritTemplates || []).find((spirit) => spirit.id === id) || null;
}

function getSpiritTemplateByVesselItemId(itemId) {
  return (GAME_CONSTANTS.spiritTemplates || []).find((spirit) => spirit.vesselItemId === itemId) || null;
}

function isSpiritVesselItem(itemId) {
  return Boolean(getSpiritTemplateByVesselItemId(itemId));
}

function getSpiritState(state) {
  state.spirits = state.spirits || { bondedId: null, unlocked: {} };
  state.spirits.unlocked = state.spirits.unlocked || {};
  return state.spirits;
}

function getSpiritEntry(state, spiritId) {
  return getSpiritState(state).unlocked?.[spiritId] || null;
}

function getBondedSpiritInfo(state) {
  const spiritState = getSpiritState(state);
  if (!spiritState.bondedId) {
    return null;
  }
  const template = getSpiritTemplate(spiritState.bondedId);
  const entry = getSpiritEntry(state, spiritState.bondedId);
  if (!template || !entry) {
    return null;
  }
  return { id: template.id, template, entry };
}

function getSpiritLevelCap(spiritTemplate) {
  return spiritTemplate?.grade === "Mythic" ? 10 : 8;
}

function getSpiritXpRequired(level) {
  return 18 + level * 14;
}

function getSpiritPassiveBonus(state, key) {
  const bonded = getBondedSpiritInfo(state);
  if (!bonded) {
    return 0;
  }
  const level = Math.max(1, Number(bonded.entry.level || 1));
  const base = Number(bonded.template.passiveBonuses?.[key] || 0);
  const perLevel = Number(bonded.template.perLevelBonuses?.[key] || 0);
  return base + perLevel * Math.max(0, level - 1);
}

function getUnlockedSpiritEntries(state) {
  return Object.entries(getSpiritState(state).unlocked || {})
    .map(([id, entry]) => {
      const template = getSpiritTemplate(id);
      if (!template) {
        return null;
      }
      return { id, template, entry };
    })
    .filter(Boolean)
    .sort((a, b) => (b.entry.level || 1) - (a.entry.level || 1) || a.template.label.localeCompare(b.template.label));
}

function formatSpiritSummary(template, entry) {
  const level = Number(entry?.level || 1);
  const nextReq = level >= getSpiritLevelCap(template) ? "max" : getSpiritXpRequired(level);
  return `${template.label} · Lv ${level} · ${template.grade} · XP ${entry?.xp || 0}/${nextReq}`;
}

function canCurrentCityAccessSpiritHall(state) {
  return state.currentRegionId === "sovereign-wastes" || getUnlockedSpiritEntries(state).length > 0;
}

function formatBonusLabel(key, value, suffix = "") {
  const labels = {
    hpMax: "HP Max",
    hp: "HP",
    qiMax: "Qi Max",
    qi: "Qi",
    battleQiMax: "Battle Qi Max",
    battleQi: "Battle Qi",
    physique: "Physique",
    soulSense: "Soul Sense",
    comprehension: "Comprehension",
    longevityBonus: "Years Left",
    longevity: "Years Left",
    fortune: "Fortune",
    extraLevel: "Technique Level",
    successChance: "Breakthrough Success",
    requirementReduction: "Qi Gate Reduction",
    backlashMitigation: "Backlash Mitigation",
    qiPreservation: "Qi Preservation"
  };
  return `${labels[key] || key} +${value}${suffix}`;
}

function formatTechniqueBonusLabel(key, value) {
  return formatBonusLabel(key, value, "/lv");
}

function formatBonusSummary(bonuses = {}, separator = ", ") {
  const lines = Object.entries(bonuses)
    .filter(([, value]) => Number(value || 0) !== 0)
    .map(([key, value]) => formatBonusLabel(key, value));
  return lines.length > 0 ? lines.join(separator) : "No direct modifiers";
}

function getEquipmentSlotLabel(slot) {
  const labels = {
    weapon: "Weapon",
    head: "Head",
    hands: "Hands",
    robe: "Robe",
    boots: "Boots",
    accessory: "Accessory",
    armor: "Robe"
  };
  return labels[slot] || slot;
}

function getTechniqueBuffLines(tpl) {
  return Object.entries(tpl?.bonusPerLevel || {}).map(([key, value]) => formatTechniqueBonusLabel(key, value));
}

function getTechniqueDrawbackLines(tpl) {
  return Array.isArray(tpl?.drawbacks) ? tpl.drawbacks : [];
}

function getTechniqueCatalystLines(tpl) {
  return Array.isArray(tpl?.materialCatalysts) ? tpl.materialCatalysts : [];
}

function getRecommendedTechniqueCatalyst(tpl, itemId) {
  return getTechniqueCatalystLines(tpl).find((entry) => entry.itemId === itemId) || null;
}

function isMaterialItem(template) {
  return Boolean(template)
    && !isSpiritVesselItem(template.id)
    && !template.id.startsWith("scroll-")
    && !template.id.startsWith("battle-scroll-")
    && Array.isArray(template.tags)
    && template.tags.length > 0;
}

function getCultivationMaterialCandidates(state, selectedItemIds = []) {
  const selectedCounts = selectedItemIds.reduce((counts, itemId) => {
    counts[itemId] = (counts[itemId] || 0) + 1;
    return counts;
  }, {});
  const seen = new Set();
  return state.inventorySlots.reduce((items, stack) => {
    if (!stack || seen.has(stack.id)) {
      return items;
    }
    seen.add(stack.id);
    const template = getItemTemplate(stack.id);
    if (!isMaterialItem(template)) {
      return items;
    }
    const owned = countItemInInventory(state, stack.id);
    const remaining = owned - (selectedCounts[stack.id] || 0);
    if (remaining <= 0) {
      return items;
    }
    items.push({
      id: stack.id,
      label: template.label,
      owned,
      remaining,
      potency: Number(template.potency || 1),
      tags: template.tags || []
    });
    return items;
  }, []);
}

function getActiveTechniqueIdForAction(state, action) {
  if (action === "trainBody") {
    return state.activeBodyTechniqueId || state.meditationTechniqueId || "iron-skin-sutra";
  }
  if (action === "meditate" || action === "trainSoul") {
    return state.activeSoulTechniqueId || state.meditationTechniqueId || "silent-mind-sutra";
  }
  return state.activeSoulTechniqueId || state.meditationTechniqueId || "silent-mind-sutra";
}

function buildImprovisedCultivationPlan(tpl, item) {
  const tags = item.tags || [];
  const potency = Number(item.potency || 1);
  const bodyMethod = tpl?.pillar === "body";
  if (!bodyMethod) {
    return null;
  }
  let successRate = 42 + potency * 7;
  let effectPercent = 68 + potency * 11;
  const bonuses = {};
  const fragments = [];

  if (tags.includes("herb") || tags.includes("fungus") || tags.includes("medicine")) {
    successRate += 10;
    bonuses.hp = 6 + potency * 4;
    bonuses.longevity = (tags.includes("fungus") ? 2 : 1);
    fragments.push("settles damaged flesh and keeps the body-refining cycle steadier");
  }
  if (tags.includes("spirit") || tags.includes("soul") || tags.includes("resin") || tags.includes("cloth")) {
    successRate += 3;
    bonuses.hp = (bonuses.hp || 0) + 4 + potency * 2;
    bonuses.qi = (bonuses.qi || 0) + 4 + potency * 3;
    fragments.push("threads spiritual residue through the body so the reconstruction does not tear itself apart");
  }
  if (tags.includes("ore") || tags.includes("metal") || tags.includes("mineral") || tags.includes("glass")) {
    successRate += 7;
    effectPercent += 14;
    bonuses.hp = (bonuses.hp || 0) + 7 + potency * 4;
    bonuses.physique = (bonuses.physique || 0) + 1 + (potency >= 3 ? 1 : 0);
    bonuses.extraLevel = Math.max(bonuses.extraLevel || 0, potency >= 2 ? 1 : 0);
    fragments.push("hardens tendon, bone, and skin so the rebuilding body sets denser and stronger");
  }
  if (tags.includes("beast") || tags.includes("core") || tags.includes("blood")) {
    successRate -= 4;
    effectPercent += 12;
    bonuses.battleQi = (bonuses.battleQi || 0) + 8 + potency * 4;
    bonuses.hp = (bonuses.hp || 0) + 5 + potency * 3;
    bonuses.physique = (bonuses.physique || 0) + 1;
    fragments.push("injects raw living force into the frame and forces rougher but stronger physical growth");
  }
  if (tags.includes("poison") || tags.includes("yin")) {
    successRate -= 8;
    effectPercent += 16;
    bonuses.battleQi = (bonuses.battleQi || 0) + 10 + potency * 3;
    bonuses.hp = (bonuses.hp || 0) + 4 + potency * 2;
    fragments.push("forces the body to survive harsher reconstruction and leaves the gains violent and unstable");
  }
  if (tags.includes("fire") || tags.includes("lightning")) {
    successRate -= 3;
    effectPercent += 10;
    bonuses.battleQi = (bonuses.battleQi || 0) + 7 + potency * 3;
    bonuses.physique = (bonuses.physique || 0) + 1;
    fragments.push("kicks the body-tempering cycle into a hotter, harsher tempo");
  }

  if (Object.keys(bonuses).length === 0) {
    bonuses.hp = 5 + potency * 3;
    fragments.push("nudges the body-rebuilding cycle forward without especially good affinity");
  }

  return {
    itemId: item.id,
    label: item.label,
    recommended: false,
    successRate: Math.max(28, Math.min(91, successRate)),
    effectPercent: Math.max(50, Math.min(148, effectPercent)),
    effect: `${item.label} ${fragments.join(", ")}.`,
    bonuses
  };
}

function buildCultivationMaterialPlan(tpl, catalystOrItemId) {
  const itemId = typeof catalystOrItemId === "string" ? catalystOrItemId : catalystOrItemId?.itemId;
  const item = getItemTemplate(itemId);
  const recommended = getRecommendedTechniqueCatalyst(tpl, itemId);
  if (!item) {
    return {
      itemId: itemId || "unknown",
      label: itemId || "Unknown",
      recommended: false,
      successRate: 30,
      effectPercent: 50,
      effect: "The material does not settle cleanly into the method.",
      bonuses: {}
    };
  }
  if (!recommended) {
    return buildImprovisedCultivationPlan(tpl, item);
  }
  const potency = Number(item?.potency || 1);
  const successRate = Math.max(35, Math.min(96, recommended.successRate || (58 + potency * 9)));
  const effectPercent = Math.max(55, Math.min(175, recommended.effectPercent || (90 + potency * 12)));
  return {
    itemId,
    label: item.label,
    recommended: true,
    successRate,
    effectPercent,
    effect: recommended.effect,
    bonuses: recommended.bonuses || {}
  };
}

function getTechniqueMaterialPlans(state, tpl, selectedItemIds = []) {
  return getCultivationMaterialCandidates(state, selectedItemIds)
    .map((item) => {
      const plan = buildCultivationMaterialPlan(tpl, item.id);
      return plan ? {
        ...plan,
        remaining: item.remaining,
        owned: item.owned
      } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.recommended !== b.recommended) {
        return a.recommended ? -1 : 1;
      }
      if (b.effectPercent !== a.effectPercent) {
        return b.effectPercent - a.effectPercent;
      }
      return b.successRate - a.successRate;
    });
}

function summarizeCultivationBlend(plans) {
  if (!Array.isArray(plans) || plans.length === 0) {
    return "No catalyst materials selected.";
  }
  const recommended = plans.filter((plan) => plan.recommended).length;
  const avgSuccess = Math.round(plans.reduce((sum, plan) => sum + plan.successRate, 0) / plans.length);
  const avgYield = Math.round(plans.reduce((sum, plan) => sum + plan.effectPercent, 0) / plans.length);
  return `${plans.length} material${plans.length > 1 ? "s" : ""} selected · ${recommended} recommended · average ${avgSuccess}% success / ${avgYield}% yield.`;
}

function resolveTechniqueCatalyst(state, tpl, action, plan) {
  if (!plan) {
    return { used: false, success: false, extraLevel: 0 };
  }
  const roll = Math.random() * 100;
  const success = roll <= plan.successRate;
  const scale = success ? (plan.effectPercent / 100) : Math.max(0.2, (plan.effectPercent / 100) * 0.35);
  const bonuses = plan.bonuses || {};
  const applyScaled = (value) => Math.max(0, Math.round(value * scale));
  const applied = [];

  if (bonuses.hp) {
    const gained = applyScaled(bonuses.hp);
    state.hp = Math.min(state.hpMax, state.hp + gained);
    if (gained > 0) applied.push(formatBonusLabel("hp", gained));
  }
  if (bonuses.qi) {
    const gained = applyScaled(bonuses.qi);
    state.qi = Math.min(state.qiMax, state.qi + gained);
    state.qiPeak = Math.max(state.qiPeak || 0, state.qi);
    if (gained > 0) applied.push(formatBonusLabel("qi", gained));
  }
  if (bonuses.battleQi) {
    const gained = applyScaled(bonuses.battleQi);
    state.battleQi = Math.min(state.battleQiMax, state.battleQi + gained);
    if (gained > 0) applied.push(formatBonusLabel("battleQi", gained));
  }
  if (bonuses.physique) {
    const gained = applyScaled(bonuses.physique);
    state.stats.physique += gained;
    if (gained > 0) applied.push(formatBonusLabel("physique", gained));
  }
  if (bonuses.soulSense) {
    const gained = applyScaled(bonuses.soulSense);
    state.stats.soulSense += gained;
    if (gained > 0) applied.push(formatBonusLabel("soulSense", gained));
  }
  if (bonuses.comprehension) {
    const gained = applyScaled(bonuses.comprehension);
    state.stats.comprehension += gained;
    if (gained > 0) applied.push(formatBonusLabel("comprehension", gained));
  }
  if (bonuses.longevity) {
    const gained = applyScaled(bonuses.longevity);
    state.longevityCurrent = Math.min(state.longevityMax, state.longevityCurrent + gained);
    if (gained > 0) applied.push(formatBonusLabel("longevity", gained));
  }
  const extraLevelGain = success ? applyScaled(bonuses.extraLevel || 0) : 0;
  if (extraLevelGain > 0) {
    applied.push(formatBonusLabel("extraLevel", extraLevelGain));
  }

  pushLog(
    state,
    success
      ? `${tpl.label} successfully refines ${plan.label}. ${plan.effect} (${plan.effectPercent}% yield${applied.length > 0 ? ` | ${applied.join(", ")}` : ""})`
      : `${tpl.label} only partially stabilizes ${plan.label}. The catalyst burns away at reduced effect.`,
    success ? "good" : "bad"
  );

  return {
    used: true,
    success,
    extraLevel: extraLevelGain,
    itemId: plan.itemId,
    appliedBonuses: {
      hp: bonuses.hp ? applyScaled(bonuses.hp) : 0,
      qi: bonuses.qi ? applyScaled(bonuses.qi) : 0,
      battleQi: bonuses.battleQi ? applyScaled(bonuses.battleQi) : 0,
      physique: bonuses.physique ? applyScaled(bonuses.physique) : 0,
      soulSense: bonuses.soulSense ? applyScaled(bonuses.soulSense) : 0,
      comprehension: bonuses.comprehension ? applyScaled(bonuses.comprehension) : 0,
      longevity: bonuses.longevity ? applyScaled(bonuses.longevity) : 0,
      extraLevel: extraLevelGain
    }
  };
}

function resolveTechniqueCatalysts(state, tpl, action, plans) {
  if (!Array.isArray(plans) || plans.length === 0) {
    return { used: false, successCount: 0, extraLevel: 0, appliedBonuses: {} };
  }
  const results = plans.map((plan) => resolveTechniqueCatalyst(state, tpl, action, plan));
  const appliedBonuses = results.reduce((totals, result) => {
    Object.entries(result.appliedBonuses || {}).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + Number(value || 0);
    });
    return totals;
  }, {});
  return {
    used: true,
    successCount: results.filter((result) => result.success).length,
    extraLevel: Math.min(2, results.reduce((sum, result) => sum + (result.extraLevel || 0), 0)),
    appliedBonuses
  };
}

function getBattleTechTemplate(id) {
  return (GAME_CONSTANTS.battleTechniques || []).find((t) => t.id === id);
}

// Returns the technique id encoded in a scroll item id
// "scroll-iron-skin-sutra" → cultivation technique "iron-skin-sutra"
// "battle-scroll-thunder-palm" → battle technique "thunder-palm"
function getTechniqueIdFromScrollId(scrollId) {
  if (scrollId.startsWith("battle-scroll-")) return scrollId.slice(14);
  if (scrollId.startsWith("scroll-")) return scrollId.slice(7);
  return null;
}

function isBattleScroll(scrollId) {
  return scrollId.startsWith("battle-scroll-");
}

// Pick a random technique scroll id, preferring techniques the player hasn't learned yet
function getRandomTechniqueScrollId(state) {
  const all = GAME_CONSTANTS.techniques
    .filter((technique) => Number(technique.realmReq || 0) <= state.realmIndex + 1)
    .map((t) => t.id);
  const learned = state.learnedTechniques || {};
  const unlearned = all.filter((id) => !(learned[id] > 0));
  const pool = unlearned.length > 0 ? unlearned : all;
  const techId = pool[Math.floor(Math.random() * pool.length)];
  return `scroll-${techId}`;
}

// Convert any techniqueScrolls increments on state into actual scroll items in inventory
function convertPendingScrolls(state, countBefore) {
  const added = (state.techniqueScrolls || 0) - countBefore;
  if (added > 0) {
    state.techniqueScrolls -= added;
    for (let i = 0; i < added; i++) {
      const scrollId = getRandomTechniqueScrollId(state);
      const leftover = addItemToInventory(state, scrollId, 1);
      if (leftover > 0) {
        pushLog(state, "Inventory full — technique scroll was lost.", "bad");
      }
    }
  }
}

// Returns { techniqueId -> level } for all learned techniques
function getLearnedTechniques(state) {
  return state.learnedTechniques || {};
}

// Sum a bonus field across all learned techniques, weighted by their level
function getTechniqueBonus(state, bonusKey) {
  const learned = getLearnedTechniques(state);
  return Object.entries(learned).reduce((sum, [id, level]) => {
    const tpl = getTechniqueTemplate(id);
    if (!tpl || !tpl.bonusPerLevel) {
      return sum;
    }
    return sum + (Number(tpl.bonusPerLevel[bonusKey] || 0) * level);
  }, 0);
}

// Combined body/soul pillar levels
function getBodyLevel(state) {
  const learned = getLearnedTechniques(state);
  return Object.entries(learned).reduce((sum, [id, level]) => {
    const tpl = getTechniqueTemplate(id);
    return sum + (tpl?.pillar === "body" ? level : 0);
  }, 0);
}

function getSoulLevel(state) {
  const learned = getLearnedTechniques(state);
  return Object.entries(learned).reduce((sum, [id, level]) => {
    const tpl = getTechniqueTemplate(id);
    return sum + (tpl?.pillar === "soul" ? level : 0);
  }, 0);
}

function getEquippedItems(state) {
  if (!state.equipment || typeof state.equipment !== "object") {
    return [];
  }
  return Object.values(state.equipment)
    .filter(Boolean)
    .map((id) => getEquipmentTemplate(id))
    .filter(Boolean);
}

function getEquippedItemIdSet(state) {
  return new Set(Object.values(state.equipment || {}).filter(Boolean));
}

function findInventorySlotById(state, id) {
  return state.inventorySlots.findIndex((stack) => stack && stack.id === id);
}

function getEquipmentBonus(state, key) {
  return getEquippedItems(state).reduce((sum, item) => sum + Number(item.bonuses?.[key] || 0), 0);
}

function getCurrentRegion(state) {
  return GAME_CONSTANTS.regions.find((region) => region.id === state.currentRegionId) || GAME_CONSTANTS.regions[0];
}

function getCurrentCity(state) {
  return GAME_CONSTANTS.cities.find((city) => city.id === state.currentCityId) || GAME_CONSTANTS.cities[0];
}

function getCitiesForRegion(regionId) {
  return GAME_CONSTANTS.cities.filter((city) => city.regionId === regionId);
}

function getAreasForRegion(regionId) {
  return (GAME_CONSTANTS.explorationAreas || []).filter((area) => area.regionId === regionId);
}

function getCurrentArea(state) {
  const exact = (GAME_CONSTANTS.explorationAreas || []).find((area) => area.id === state.currentAreaId);
  if (exact) {
    return exact;
  }
  return getAreasForRegion(state.currentRegionId)[0] || null;
}

function getNpcTemplate(id) {
  return (GAME_CONSTANTS.npcs || []).find((npc) => npc.id === id) || null;
}

function getRealmStageLabel(state) {
  const realm = GAME_CONSTANTS.realms[state.realmIndex];
  return `${realm.name} - ${realm.stages[state.stageIndex]}`;
}

function pushLog(state, text, cls = "") {
  const line = cls ? `[${cls.toUpperCase()}] ${text}` : text;
  state.log.unshift(line);
  if (state.log.length > 50) {
    state.log.pop();
  }
}

function getSlotLimit(state) {
  const homeSlots = state.home ? state.home.slots : 0;
  return state.baseSlots + state.ring.slots + homeSlots;
}

function getCarryLimit(state) {
  const bodyLevel = getBodyLevel(state);
  const homeWeight = state.home ? state.home.safeWeight : 0;
  return state.baseCarry + state.ring.maxWeight + Math.round(homeWeight * 0.15) + bodyLevel * 12;
}

function getActiveDebuffs(state) {
  const debuffs = [];
  const weight = getInventoryWeight(state);
  const limit = getCarryLimit(state);
  if (weight > limit) {
    debuffs.push({
      id: "overburdened",
      label: "Overburdened",
      short: `Weight ${weight}/${limit}`,
      desc: `You are carrying ${weight - limit} over your limit. This adds +1s global cooldown to actions. It is not related to lifespan.`,
      severity: weight - limit
    });
  }
  return debuffs;
}

function normalizeInventorySize(state) {
  const limit = getSlotLimit(state);
  if (!Array.isArray(state.inventorySlots)) {
    state.inventorySlots = [];
  }
  if (!Array.isArray(state.pendingLoot)) {
    state.pendingLoot = [];
  }
  while (state.inventorySlots.length < limit) {
    state.inventorySlots.push(null);
  }
  while (state.inventorySlots.length > limit) {
    const removed = state.inventorySlots.pop();
    if (removed) {
      state.pendingLoot.push(removed);
    }
  }
}

function getUsedSlots(state) {
  return state.inventorySlots.filter(Boolean).length;
}

function getInventoryWeight(state) {
  return state.inventorySlots.reduce((sum, stack) => {
    if (!stack) {
      return sum;
    }
    const template = getInventoryTemplate(stack.id);
    return sum + (template ? template.weight * stack.qty : 0);
  }, 0);
}

function addItemToInventory(state, id, qty, preferredSlot) {
  const template = getInventoryTemplate(id);
  if (!template || qty <= 0) {
    return qty;
  }
  const maxStack = Number(template.maxStack || 1);

  if (Number.isInteger(preferredSlot) && preferredSlot >= 0 && preferredSlot < state.inventorySlots.length) {
    const slot = state.inventorySlots[preferredSlot];
    if (!slot) {
      const add = Math.min(qty, maxStack);
      state.inventorySlots[preferredSlot] = { id, qty: add };
      return qty - add;
    }
    if (slot.id === id && slot.qty < maxStack) {
      const room = maxStack - slot.qty;
      const add = Math.min(room, qty);
      slot.qty += add;
      return qty - add;
    }
    return qty;
  }

  for (let i = 0; i < state.inventorySlots.length; i += 1) {
    const slot = state.inventorySlots[i];
    if (slot && slot.id === id && slot.qty < maxStack) {
      const room = maxStack - slot.qty;
      const add = Math.min(room, qty);
      slot.qty += add;
      qty -= add;
      if (qty <= 0) {
        return 0;
      }
    }
  }

  for (let i = 0; i < state.inventorySlots.length; i += 1) {
    if (!state.inventorySlots[i]) {
      const add = Math.min(qty, maxStack);
      state.inventorySlots[i] = { id, qty: add };
      qty -= add;
      if (qty <= 0) {
        return 0;
      }
    }
  }

  return qty;
}

function countItemInInventory(state, id) {
  return state.inventorySlots.reduce((sum, stack) => {
    if (!stack || stack.id !== id) {
      return sum;
    }
    return sum + stack.qty;
  }, 0);
}

function removeItemFromInventory(state, id, qty) {
  let remaining = Math.max(0, qty);
  for (let i = 0; i < state.inventorySlots.length && remaining > 0; i += 1) {
    const stack = state.inventorySlots[i];
    if (!stack || stack.id !== id) {
      continue;
    }
    const take = Math.min(stack.qty, remaining);
    stack.qty -= take;
    remaining -= take;
    if (stack.qty <= 0) {
      state.inventorySlots[i] = null;
      if (state.ui?.selectedSlot === i) {
        state.ui.selectedSlot = null;
      }
    }
  }
  return remaining === 0;
}

function getInventoryFitForItem(state, id) {
  const template = getInventoryTemplate(id);
  if (!template) {
    return 0;
  }
  const maxStack = Number(template.maxStack || 1);
  let room = 0;
  state.inventorySlots.forEach((slot) => {
    if (!slot) {
      room += maxStack;
    } else if (slot.id === id) {
      room += Math.max(0, maxStack - slot.qty);
    }
  });
  return room;
}

function clampVitals(state) {
  state.qi = Math.max(0, Math.min(state.qi, state.qiMax));
  state.hp = Math.max(0, Math.min(state.hp, state.hpMax));
  state.battleQi = Math.max(0, Math.min(state.battleQi, state.battleQiMax));
  state.longevityCurrent = Math.max(1, Math.min(state.longevityCurrent, state.longevityMax));
}

function recalculateDerivedStats(state) {
  const previousLongevityMax = Number(state.longevityMax || 0);
  const bodyLevel = getBodyLevel(state);
  const soulLevel = getSoulLevel(state);

  // Technique bonuses stacked from learned technique levels
  const techQi       = getTechniqueBonus(state, "qiMax");
  const techHp       = getTechniqueBonus(state, "hpMax");
  const techBattleQi = getTechniqueBonus(state, "battleQiMax");
  const techPhysique = getTechniqueBonus(state, "physique");
  const techSoul     = getTechniqueBonus(state, "soulSense");
  const techComp     = getTechniqueBonus(state, "comprehension");
  const techLongevity= getTechniqueBonus(state, "longevityBonus");

  // Equipment bonuses
  const eqQi       = getEquipmentBonus(state, "qiMax");
  const eqHp       = getEquipmentBonus(state, "hpMax");
  const eqBattleQi = getEquipmentBonus(state, "battleQiMax");
  const eqPhysique = getEquipmentBonus(state, "physique");
  const eqSoul     = getEquipmentBonus(state, "soulSense");
  const spiritQi       = getSpiritPassiveBonus(state, "qiMax");
  const spiritHp       = getSpiritPassiveBonus(state, "hpMax");
  const spiritBattleQi = getSpiritPassiveBonus(state, "battleQiMax");
  const spiritPhysique = getSpiritPassiveBonus(state, "physique");
  const spiritSoul     = getSpiritPassiveBonus(state, "soulSense");
  const spiritComp     = getSpiritPassiveBonus(state, "comprehension");
  const spiritLongevity= getSpiritPassiveBonus(state, "longevityBonus");
  const spiritFortune  = getSpiritPassiveBonus(state, "fortune");

  const effPhysique = state.stats.physique + techPhysique + eqPhysique + spiritPhysique;
  const effSoul     = state.stats.soulSense + techSoul + eqSoul + spiritSoul;

  // Soul pillar governs qi capacity; body pillar governs health
  state.qiMax      = 100 + state.realmIndex * 55 + state.stageIndex * 18 + effSoul * 2 + soulLevel * 4 + techQi + eqQi + spiritQi;
  state.hpMax      = 100 + state.realmIndex * 42 + state.stageIndex * 16 + effPhysique * 3 + bodyLevel * 5 + techHp + eqHp + spiritHp;
  state.battleQiMax= 40  + state.realmIndex * 20 + state.stageIndex * 8  + soulLevel * 3 + bodyLevel * 2 + effSoul + techBattleQi + eqBattleQi + spiritBattleQi;

  // Comprehension from techniques
  state.stats.comprehensionBonus = techComp + spiritComp;
  state.stats.fortuneBonus = spiritFortune;

  const realm = GAME_CONSTANTS.realms[state.realmIndex];
  const nextLongevityMax = Math.max(previousLongevityMax, realm.longevityBase + state.stageIndex * 25 + techLongevity + spiritLongevity);
  state.longevityMax = nextLongevityMax;
  if (nextLongevityMax > previousLongevityMax) {
    state.longevityCurrent = Math.min(nextLongevityMax, (state.longevityCurrent || 0) + (nextLongevityMax - previousLongevityMax));
  }

  // Qi regen rate: fills soul realm passively (per render tick ~0.5s)
  state.qiRegenRate = 1 + Math.floor(soulLevel * 0.4) + state.realmIndex;

  // Battle qi regen rate: ~70% of regular qi regen, always active
  state.battleQiRegenRate = Math.max(1, Math.floor(state.qiRegenRate * 0.7));

  clampVitals(state);
}

function createInitialState() {
  const ring = GAME_CONSTANTS.rings[0];
  const state = {
    realmIndex: 0,
    stageIndex: 0,
    qi: 20,
    qiMax: 100,
    battleQi: 60,
    battleQiMax: 60,
    hp: 100,
    hpMax: 100,
    bankSilver: 0,
    wallet: 140,
    stats: {
      physique: 10,
      soulSense: 10,
      comprehension: 10,
      comprehensionBonus: 0,
      fortune: 10,
      karma: 0
    },
    // Two fundamental pillars expressed via learned techniques
    // learnedTechniques: { [techniqueId]: level }
    learnedTechniques: {
      "iron-skin-sutra": 1,
      "silent-mind-sutra": 1
    },
    techniqueScrolls: 0,
    patronCoins: 0,
    meditationTechniqueId: "silent-mind-sutra",
    activeBodyTechniqueId: "iron-skin-sutra",
    activeSoulTechniqueId: "silent-mind-sutra",
    longevityCurrent: 80,
    longevityMax: 80,
    longevityCurrentSynced: true,
    inventorySlots: [],
    pendingLoot: [],
    baseSlots: 12,
    baseCarry: 50,
    ringLevel: 0,
    ring,
    homeLevel: 0,
    home: null,
    guildMember: false,
    guildStanding: 0,
    sectAffiliation: null,
    sectStanding: 0,
    recruitedExperts: [],
    turn: 0,
    globalCooldownUntil: 0,
    globalCooldownBase: 3,
    currentRegionId: "ashen-frontier",
    currentCityId: "ember",
    currentAreaId: "cinder-steppe",
    breakthroughPermit: false,
    breakthroughFailureBoost: 0,
    equipment: {
      weapon: null,
      head: null,
      hands: null,
      robe: null,
      boots: null,
      accessory: null
    },
    ownedEquipment: [],
    qiRegenRate: 1,
    qiRegenAccum: 0,
    qiPeak: 20,
    backstoryChosen: false,
    legacyNotes: 0,
    activeAction: null,
    battle: null,
    spirits: {
      bondedId: null,
      unlocked: {}
    },
    questsCompleted: {}, // Track { questId: true }
    questState: {},      // Track multi-part quest data { questId: stage }
    learnedBattleTechniques: { "crushing-wave": true }, // Track battle arts { techId: true }
    log: ["You awaken in Ember Court with little silver and stubborn ambition."]
  };

  normalizeInventorySize(state);
  addItemToInventory(state, "spirit-herb", 4);
  recalculateDerivedStats(state);
  return state;
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
    merged.learnedTechniques = (parsed.learnedTechniques && typeof parsed.learnedTechniques === "object")
      ? { ...base.learnedTechniques, ...parsed.learnedTechniques }
      : { ...base.learnedTechniques };
    merged.techniqueScrolls = Number.isInteger(parsed.techniqueScrolls) ? parsed.techniqueScrolls : 0;
    merged.patronCoins = Number.isInteger(parsed.patronCoins) ? parsed.patronCoins : 0;
    merged.meditationTechniqueId = parsed.meditationTechniqueId || "silent-mind-sutra";
    merged.activeBodyTechniqueId = parsed.activeBodyTechniqueId || "iron-skin-sutra";
    merged.activeSoulTechniqueId = parsed.activeSoulTechniqueId || merged.meditationTechniqueId || "silent-mind-sutra";
    merged.qiRegenAccum = 0;
    merged.qiPeak = Number.isFinite(parsed.qiPeak) ? parsed.qiPeak : merged.qi;
    merged.backstoryChosen = Boolean(parsed.backstoryChosen);
    merged.learnedBattleTechniques = (parsed.learnedBattleTechniques && typeof parsed.learnedBattleTechniques === "object")
      ? { ...base.learnedBattleTechniques, ...parsed.learnedBattleTechniques }
      : { ...base.learnedBattleTechniques };
    merged.questsCompleted = (parsed.questsCompleted && typeof parsed.questsCompleted === "object")
      ? { ...parsed.questsCompleted }
      : {};
    merged.questState = (parsed.questState && typeof parsed.questState === "object")
      ? { ...parsed.questState }
      : {};
    merged.sectAffiliation = typeof parsed.sectAffiliation === "string" ? parsed.sectAffiliation : null;
    merged.guildStanding = Number.isFinite(parsed.guildStanding) ? parsed.guildStanding : 0;
    merged.sectStanding = Number.isFinite(parsed.sectStanding) ? parsed.sectStanding : 0;
    merged.recruitedExperts = Array.isArray(parsed.recruitedExperts) ? [...new Set(parsed.recruitedExperts)] : [];
    merged.spirits = {
      bondedId: typeof parsed.spirits?.bondedId === "string" ? parsed.spirits.bondedId : null,
      unlocked: parsed.spirits?.unlocked && typeof parsed.spirits.unlocked === "object"
        ? { ...parsed.spirits.unlocked }
        : {}
    };
    merged.longevityCurrentSynced = Boolean(parsed.longevityCurrentSynced);
    merged.ringLevel = Number.isInteger(merged.ringLevel) ? merged.ringLevel : 0;
    merged.ring = GAME_CONSTANTS.rings[merged.ringLevel] || GAME_CONSTANTS.rings[0];
    merged.breakthroughPermit = Boolean(merged.breakthroughPermit);
    merged.breakthroughFailureBoost = Number.isFinite(merged.breakthroughFailureBoost) ? merged.breakthroughFailureBoost : 0;
    merged.equipment = {
      weapon: merged.equipment?.weapon || null,
      head: merged.equipment?.head || null,
      hands: merged.equipment?.hands || null,
      robe: merged.equipment?.robe || merged.equipment?.armor || null,
      boots: merged.equipment?.boots || null,
      accessory: merged.equipment?.accessory || null
    };
    merged.ownedEquipment = Array.isArray(merged.ownedEquipment) ? merged.ownedEquipment : [];
    if (merged.activeAction?.catalystPlan && !Array.isArray(merged.activeAction.catalystPlans)) {
      merged.activeAction.catalystPlans = [merged.activeAction.catalystPlan];
    }

    if (!Array.isArray(merged.inventorySlots)) {
      merged.inventorySlots = [];
      if (Array.isArray(parsed.inventory)) {
        parsed.inventory.forEach((stack) => addItemToInventory(merged, stack.id, stack.qty));
      }
    }
    const equippedIds = getEquippedItemIdSet(merged);
    merged.ownedEquipment.forEach((equipmentId) => {
      if (!equippedIds.has(equipmentId) && findInventorySlotById(merged, equipmentId) === -1) {
        addItemToInventory(merged, equipmentId, 1);
      }
    });
    merged.ownedEquipment = [];

    if (!(merged.learnedTechniques?.[merged.activeBodyTechniqueId] > 0)) {
      merged.activeBodyTechniqueId = Object.keys(merged.learnedTechniques || {}).find((id) => getTechniqueTemplate(id)?.pillar === "body") || "iron-skin-sutra";
    }
    if (!(merged.learnedTechniques?.[merged.activeSoulTechniqueId] > 0)) {
      merged.activeSoulTechniqueId = Object.keys(merged.learnedTechniques || {}).find((id) => getTechniqueTemplate(id)?.pillar === "soul") || "silent-mind-sutra";
    }
    merged.meditationTechniqueId = merged.activeSoulTechniqueId;

    const city = GAME_CONSTANTS.cities.find((candidate) => candidate.id === merged.currentCityId);
    if (!city) {
      merged.currentCityId = base.currentCityId;
      merged.currentRegionId = base.currentRegionId;
    } else {
      merged.currentRegionId = city.regionId;
    }

    const area = (GAME_CONSTANTS.explorationAreas || []).find((item) => item.id === merged.currentAreaId);
    if (!area || area.regionId !== merged.currentRegionId) {
      const fallbackArea = getAreasForRegion(merged.currentRegionId)[0];
      merged.currentAreaId = fallbackArea ? fallbackArea.id : null;
    }

    normalizeInventorySize(merged);
    recalculateDerivedStats(merged);
    if (!merged.longevityCurrentSynced) {
      merged.longevityCurrent = merged.longevityMax;
      merged.longevityCurrentSynced = true;
    }
    return merged;
  } catch {
    return createInitialState();
  }
}

function globalCooldownRemaining(state) {
  return Math.max(0, state.globalCooldownUntil - nowSeconds());
}

function setGlobalCooldown(state, extra = 0) {
  state.globalCooldownUntil = nowSeconds() + state.globalCooldownBase + extra;
}

function isRegionAdjacent(state, targetRegionId) {
  const current = getCurrentRegion(state);
  return current.id === targetRegionId || current.neighbors.includes(targetRegionId);
}

function getRegionLayout(regionId) {
  const positions = {
    "ashen-frontier": { x: 300, y: 420 },
    "jade-delta": { x: 820, y: 310 },
    "iron-wilds": { x: 760, y: 690 },
    "void-rift": { x: 1200, y: 500 },
    "celestial-plateau": { x: 1360, y: 220 },
    "sovereign-wastes": { x: 1450, y: 760 }
  };
  return positions[regionId] || { x: 540, y: 420 };
}

function regionPixelDist(fromId, toId) {
  const a = getRegionLayout(fromId);
  const b = getRegionLayout(toId);
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function cityPixelDist(fromCity, toCity) {
  const a = getCityLayout(fromCity);
  const b = getCityLayout(toCity);
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getCityLayout(city) {
  const regionalCities = getCitiesForRegion(city.regionId);
  const index = Math.max(0, regionalCities.findIndex((item) => item.id === city.id));
  const count = Math.max(1, regionalCities.length);
  const anchor = getRegionLayout(city.regionId);
  const angle = (Math.PI * 2 * index) / count;
  const ring = 88 + (index % 3) * 30;
  return {
    x: anchor.x + Math.cos(angle) * ring,
    y: anchor.y + Math.sin(angle) * ring
  };
}

function getAreaLayout(area) {
  const regionalAreas = getAreasForRegion(area.regionId);
  const index = Math.max(0, regionalAreas.findIndex((item) => item.id === area.id));
  const count = Math.max(1, regionalAreas.length);
  const anchor = getRegionLayout(area.regionId);
  const angle = (Math.PI * 2 * index) / count + Math.PI / 6;
  const ring = 145 + (index % 3) * 24;
  return {
    x: anchor.x + Math.cos(angle) * ring,
    y: anchor.y + Math.sin(angle) * ring
  };
}

function getSectsForRegion(regionId) {
  return (GAME_CONSTANTS.sectOrders || []).filter((sect) => sect.regionId === regionId);
}

function getSectLayout(sect) {
  const hostCity = GAME_CONSTANTS.cities.find((city) => city.id === sect.hostCityId);
  const anchor = hostCity ? getCityLayout(hostCity) : getRegionLayout(sect.regionId);
  const regionalSects = getSectsForRegion(sect.regionId);
  const index = Math.max(0, regionalSects.findIndex((item) => item.id === sect.id));
  const count = Math.max(1, regionalSects.length);
  const angle = (Math.PI * 2 * index) / count + Math.PI / 4;
  const ring = 36 + (index % 2) * 16;
  return {
    x: anchor.x + Math.cos(angle) * ring,
    y: anchor.y + Math.sin(angle) * ring
  };
}

function compactLabel(text, max = 10) {
  if (!text) {
    return "-";
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}.`;
}

function compactRegionLabel(region) {
  const regionId = typeof region === "string" ? region : region.id;
  const regionName = typeof region === "string" ? region : region.name;
  const labels = {
    "ashen-frontier": "Ashen",
    "jade-delta": "Jade",
    "iron-wilds": "Iron",
    "void-rift": "Void",
    "celestial-plateau": "Plateau",
    "sovereign-wastes": "Sovereign"
  };
  return labels[regionId] || compactLabel(regionName, 8);
}

function clampAtlasPan(viewport, canvas, pan) {
  const minX = Math.min(0, viewport.clientWidth - canvas.clientWidth);
  const minY = Math.min(0, viewport.clientHeight - canvas.clientHeight);
  return {
    x: Math.max(minX, Math.min(0, pan.x)),
    y: Math.max(minY, Math.min(0, pan.y))
  };
}

function actionDuration(action) {
  if (action === "meditate") {
    return 12;
  }
  if (action === "cityRest") {
    return 8;
  }
  if (action === "trainBody") {
    return 10;
  }
  if (action === "trainSoul") {
    return 10;
  }
  return 0;
}

function startActiveAction(state, action, options = {}) {
  if (state.activeAction) {
    pushLog(state, "You are already engaged in an active cultivation action.", "bad");
    return false;
  }

  const duration = actionDuration(action);
  if (duration <= 0) {
    return false;
  }

  const startAt = nowSeconds();
  const techniqueId = getActiveTechniqueIdForAction(state, action);
  const catalystPlans = Array.isArray(options.catalystPlans)
    ? options.catalystPlans
    : (options.catalystPlan ? [options.catalystPlan] : []);
  for (const plan of catalystPlans) {
    if (!removeItemFromInventory(state, plan.itemId, 1)) {
      pushLog(state, `You no longer have ${plan.label} to refine with this method.`, "bad");
      return false;
    }
  }
  state.activeAction = {
    action,
    techniqueId,
    catalystPlans,
    startAt,
    endAt: startAt + duration,
    lastHealAt: startAt
  };

  const tpl = getTechniqueTemplate(techniqueId);
  const label = action === "cityRest" ? getCurrentCity(state).name : (tpl ? tpl.label : action);
  const actionLabel = action === "meditate"
    ? "Meditation"
    : action === "cityRest"
      ? "City rest"
      : `${action.replace("train", "")} training`;
  const catalystLabel = catalystPlans.length > 0
    ? ` + ${catalystPlans.map((plan) => plan.label).join(", ")}`
    : "";
  pushLog(state, `${actionLabel} started (${label}${catalystLabel}). ${duration}s.`, "good");
  return true;
}

function applyMeditationRewards(state, techniqueId) {
  const tpl = getTechniqueTemplate(techniqueId);
  const learned = getLearnedTechniques(state);
  const currentLevel = learned[techniqueId] || 0;
  const catalystPlans = state.lastResolvedCatalystPlans || [];
  const catalyst = tpl ? resolveTechniqueCatalysts(state, tpl, "meditation", catalystPlans) : { extraLevel: 0 };
  const meditationBoost = catalyst.appliedBonuses || {};

  // Meditation heals: restore some HP during meditation
  const hpGainBase = 8 + Math.floor(state.stats.physique * 0.3) + state.realmIndex * 2 + Math.floor((meditationBoost.hp || 0) * 0.35);
  const hpGain = state.qi >= state.qiMax ? Math.floor(hpGainBase * 1.4) : hpGainBase;
  state.hp = Math.min(state.hpMax, state.hp + hpGain);

  // Phase 1: restore qi back up to the highest qi this cultivator has ever held
  const peak = state.qiPeak || state.qi;
  if (state.qi < peak) {
    const qiGain = Math.min(
      peak - state.qi,
      12 + Math.floor(state.stats.soulSense * 0.4) + state.realmIndex * 3 + Math.floor((meditationBoost.qi || 0) * 0.45) + (meditationBoost.soulSense || 0)
    );
    state.qi = Math.min(peak, state.qi + qiGain);
    // track updated peak
    if (state.qi > (state.qiPeak || 0)) state.qiPeak = state.qi;
    pushLog(state, `Meditation: body mends (${hpGain} HP), qi restored to ${state.qi} / ${peak}${catalyst.used ? `, with catalyst resonance improving the cycle` : ""}.`, "good");
    return; // cultivation advance waits until qi is whole
  }

  // Phase 2: qi already full to peak — advance technique and push the peak slightly
  const qiBonus = 4 + Math.floor(state.stats.comprehension * 0.3) + state.realmIndex + Math.floor((meditationBoost.qi || 0) * 0.2) + (meditationBoost.comprehension || 0);
  state.qi = Math.min(state.qiMax, state.qi + qiBonus);
  const peakGrowth = Math.floor((meditationBoost.qi || 0) * 0.3) + (meditationBoost.soulSense || 0) + (meditationBoost.comprehension || 0);
  state.qiPeak = Math.max(state.qiPeak || 0, Math.min(state.qiMax, state.qi + peakGrowth));

  state.stats.comprehension += 1 + Math.min(2, meditationBoost.comprehension || 0);
  if (meditationBoost.longevity) {
    state.longevityCurrent = Math.min(state.longevityMax, state.longevityCurrent + meditationBoost.longevity);
  }

  if (tpl) {
    state.learnedTechniques[techniqueId] = currentLevel + 1 + (catalyst.extraLevel || 0);
    pushLog(state, `Meditation: body mends (${hpGain} HP), ${tpl.label} advanced to level ${state.learnedTechniques[techniqueId]}. Qi peak now ${state.qiPeak}${catalyst.used ? ` and the catalyst deepened the meditation output` : ""}.`, "good");
  } else {
    state.stats.soulSense += 1;
    pushLog(state, `Meditation: body mends (${hpGain} HP), formless meditation sharpens soul sense.`, "good");
  }
}

function applyCityRestRewards(state) {
  const qiGain = 10 + Math.floor(state.stats.soulSense * 0.35);
  state.qi = Math.min(state.qiMax, state.qi + qiGain);
  if (state.qi > (state.qiPeak || 0)) state.qiPeak = state.qi;
  pushLog(state, `${getCurrentCity(state).name}: you return rested, tended, and clearer of mind.`, "good");
}

function applyTrainRewards(state, action, techniqueId) {
  const tpl = getTechniqueTemplate(techniqueId);
  if (!tpl) {
    if (action === "trainBody") {
      state.stats.physique += 1;
      pushLog(state, "Unguided body training. Physique hardened slightly.", "good");
    } else {
      state.stats.soulSense += 1;
      pushLog(state, "Unguided spirit training. Soul sense sharpened slightly.", "good");
    }
    return;
  }

  const pillarMatches = (action === "trainBody" && tpl.pillar === "body")
                     || (action === "trainSoul" && tpl.pillar === "soul");

  if (!pillarMatches) {
    pushLog(state, `${tpl.label} does not match this training pillar. Minimal gains.`, "bad");
    state.stats.comprehension += 1;
    return;
  }

  const current = state.learnedTechniques[tpl.id] || 0;
  const catalyst = resolveTechniqueCatalysts(state, tpl, action, state.lastResolvedCatalystPlans || []);
  state.learnedTechniques[tpl.id] = current + 1 + (catalyst.extraLevel || 0);
  pushLog(state, `${tpl.pillar === "body" ? "Body" : "Soul"} training: ${tpl.label} advanced to level ${state.learnedTechniques[tpl.id]}.`, "good");
}

function processActiveAction(state) {
  // Passive qi regen from soul realm filling — runs every tick
  if (!state.battle) {
    const rate = state.qiRegenRate || 1;
    state.qiRegenAccum = (state.qiRegenAccum || 0) + rate;
    if (state.qiRegenAccum >= 2) {
      const gained = Math.floor(state.qiRegenAccum / 2);
      state.qi = Math.min(state.qiMax, state.qi + gained);
      state.qiRegenAccum = state.qiRegenAccum % 2;
      // track historical qi peak
      if (state.qi > (state.qiPeak || 0)) state.qiPeak = state.qi;
    }
  }

  // Passive battle qi regen — always active, slightly slower than regular qi
  {
    const bqRate = state.battleQiRegenRate || 1;
    state.battleQiRegenAccum = (state.battleQiRegenAccum || 0) + bqRate;
    if (state.battleQiRegenAccum >= 3) {
      const gained = Math.floor(state.battleQiRegenAccum / 3);
      state.battleQi = Math.min(state.battleQiMax, state.battleQi + gained);
      state.battleQiRegenAccum = state.battleQiRegenAccum % 3;
    }
  }

  // Progressive HP regen while resting/meditating
  if (state.activeAction && (state.activeAction.action === "meditate" || state.activeAction.action === "cityRest")) {
    const now = nowSeconds();
    const lastHeal = state.activeAction.lastHealAt || state.activeAction.startAt;
    const interval = state.activeAction.action === "cityRest" ? 1 : 2;
    if (now - lastHeal >= interval) {
      const baseHeal = state.activeAction.action === "cityRest" ? 5 : 3;
      const qiMultiplier = state.qi >= state.qiMax ? 1.5 : state.qi >= Math.floor(state.qiMax * 0.9) ? 1.2 : 1;
      const tickHeal = Math.max(1, Math.floor((baseHeal + state.stats.physique * 0.12 + state.realmIndex * 0.5) * qiMultiplier));
      state.hp = Math.min(state.hpMax, state.hp + tickHeal);
      state.activeAction.lastHealAt = now;
    }
  }

  if (!state.activeAction) {
    return;
  }
  if (nowSeconds() < state.activeAction.endAt) {
    return;
  }

  const finished = state.activeAction;
  state.activeAction = null;
  state.lastResolvedCatalystPlans = finished.catalystPlans || [];

  if (finished.action === "meditate") {
    applyMeditationRewards(state, finished.techniqueId);
  } else if (finished.action === "cityRest") {
    applyCityRestRewards(state);
  } else {
    applyTrainRewards(state, finished.action, finished.techniqueId);
  }

  state.lastResolvedCatalystPlans = [];

  recalculateDerivedStats(state);
}

function sellHalfMaterials(state) {
  let total = 0;
  state.inventorySlots.forEach((stack, idx) => {
    if (!stack) {
      return;
    }
    const template = getItemTemplate(stack.id);
    if (!template) {
      return;
    }
    const sold = Math.floor(stack.qty / 2);
    stack.qty -= sold;
    total += sold * template.value;
    if (stack.qty <= 0) {
      state.inventorySlots[idx] = null;
    }
  });

  if (total <= 0) {
    pushLog(state, "Nothing to sell.", "bad");
    return false;
  }

  state.wallet += total;
  pushLog(state, `Sold excess materials for ${total} silver.`, "good");
  return true;
}

function depositSilver(state) {
  const amount = Math.max(1, Math.floor(Number(document.getElementById("bank-amount").value) || 0));
  if (state.wallet < amount) {
    pushLog(state, `Need ${amount} silver in wallet.`, "bad");
    return false;
  }
  state.wallet -= amount;
  state.bankSilver += amount;
  pushLog(state, `Deposited ${amount} silver into the vault.`, "good");
  return true;
}

function withdrawSilver(state) {
  const amount = Math.max(1, Math.floor(Number(document.getElementById("withdraw-amount").value) || 0));
  if (state.bankSilver < amount) {
    pushLog(state, `Need ${amount} silver in bank.`, "bad");
    return false;
  }
  state.bankSilver -= amount;
  state.wallet += amount;
  pushLog(state, `Withdrew ${amount} silver from the vault.`, "good");
  return true;
}

function buildBreakthroughMaterialPlan(itemId) {
  const item = getItemTemplate(itemId);
  if (!isMaterialItem(item)) {
    return null;
  }
  const tags = item.tags || [];
  const potency = Number(item.potency || 1);
  let successRate = 54 + potency * 8;
  let effectPercent = 82 + potency * 10;
  const bonuses = {
    successChance: 0,
    requirementReduction: 0,
    backlashMitigation: 0,
    qiPreservation: 0,
    longevity: 0
  };
  const fragments = [];

  if (tags.some((tag) => ["spirit", "soul", "resin", "cloth"].includes(tag))) {
    bonuses.successChance += 4 + potency;
    bonuses.requirementReduction += 1 + Math.floor(potency / 2);
    bonuses.backlashMitigation += 5 + potency * 2;
    fragments.push("steadies the soul sea against breakthrough turbulence");
  }
  if (tags.some((tag) => ["herb", "fungus", "medicine", "dew"].includes(tag))) {
    bonuses.backlashMitigation += 6 + potency * 2;
    bonuses.longevity += 2 + potency;
    fragments.push("softens backlash and nourishes a longer surviving body");
  }
  if (tags.some((tag) => ["ore", "metal", "mineral", "crystal", "bone", "saint", "dao"].includes(tag))) {
    bonuses.successChance += 3 + potency * 2;
    bonuses.requirementReduction += 1;
    bonuses.qiPreservation += 4 + potency * 2;
    fragments.push("gives the breakthrough frame and structure under crushing pressure");
  }
  if (tags.some((tag) => ["void", "array"].includes(tag))) {
    bonuses.successChance += 5 + potency * 2;
    bonuses.requirementReduction += 2;
    bonuses.backlashMitigation += 3 + potency;
    fragments.push("thins inner resistance so qi can pass the bottleneck more cleanly");
  }
  if (tags.some((tag) => ["poison", "blood", "beast", "core", "yin"].includes(tag))) {
    bonuses.successChance += 4 + potency * 2;
    bonuses.backlashMitigation = Math.max(0, bonuses.backlashMitigation - (2 + potency));
    effectPercent += 10;
    fragments.push("forces the bottleneck open violently and risks a harsher backlash");
  }

  if (!fragments.length) {
    bonuses.successChance += 2 + potency;
    fragments.push("adds a little force to the breakthrough attempt");
  }

  return {
    itemId,
    label: item.label,
    successRate: Math.max(32, Math.min(94, successRate)),
    effectPercent: Math.max(60, Math.min(155, effectPercent)),
    bonuses,
    effect: `${item.label} ${fragments.join(", ")}.`
  };
}

function getBreakthroughMaterialPlans(state, selectedItemIds = []) {
  return getCultivationMaterialCandidates(state, selectedItemIds)
    .map((item) => {
      const plan = buildBreakthroughMaterialPlan(item.id);
      return plan ? { ...plan, remaining: item.remaining, owned: item.owned } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const powerA = (a.bonuses.successChance || 0) + (a.bonuses.requirementReduction || 0) + (a.bonuses.backlashMitigation || 0);
      const powerB = (b.bonuses.successChance || 0) + (b.bonuses.requirementReduction || 0) + (b.bonuses.backlashMitigation || 0);
      return powerB - powerA;
    });
}

function resolveBreakthroughCatalysts(state, plans) {
  if (!Array.isArray(plans) || plans.length === 0) {
    return { successChance: 0, requirementReduction: 0, backlashMitigation: 0, qiPreservation: 0, longevity: 0, labels: [] };
  }
  return plans.reduce((totals, plan) => {
    if (!removeItemFromInventory(state, plan.itemId, 1)) {
      pushLog(state, `You no longer carry ${plan.label} for this breakthrough.`, "bad");
      return totals;
    }
    const roll = Math.random() * 100;
    const success = roll <= plan.successRate;
    const scale = success ? (plan.effectPercent / 100) : Math.max(0.2, (plan.effectPercent / 100) * 0.35);
    Object.entries(plan.bonuses || {}).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + Math.max(0, Math.round(Number(value || 0) * scale));
    });
    totals.labels.push(`${plan.label}${success ? "" : " (unstable)"}`);
    pushLog(state, success
      ? `${plan.label} settles into the bottleneck. ${plan.effect} (${formatBonusSummary(plan.bonuses || {})})`
      : `${plan.label} destabilizes during the breakthrough and only partly helps.`, success ? "good" : "bad");
    return totals;
  }, { successChance: 0, requirementReduction: 0, backlashMitigation: 0, qiPreservation: 0, longevity: 0, labels: [] });
}

function attemptBreakthroughWithPlans(state, plans = []) {
  const finalRealmIndex = GAME_CONSTANTS.realms.length - 1;
  const finalStageIndex = GAME_CONSTANTS.realms[finalRealmIndex].stages.length - 1;
  if (state.realmIndex === finalRealmIndex && state.stageIndex === finalStageIndex) {
    pushLog(state, "You are already at the current prototype cap.", "bad");
    return false;
  }

  const catalyst = resolveBreakthroughCatalysts(state, plans);
  const minRequiredPct = Math.max(0.9, 0.97 - (catalyst.requirementReduction || 0) / 100);
  const minRequired = Math.ceil(state.qiMax * minRequiredPct);
  if (state.qi < minRequired) {
    pushLog(state, `Breakthrough requires at least ${Math.round(minRequiredPct * 100)}% qi (${minRequired}). You have ${state.qi}/${state.qiMax}.`, "bad");
    return false;
  }

  const qiPct = state.qi / state.qiMax;
  let baseChance = 0.1;
  let tierLabel = "Near-Full Strain";
  if (qiPct >= 1) {
    baseChance = 0.28;
    tierLabel = "Perfect Saturation";
  } else if (qiPct >= 0.985) {
    baseChance = 0.19;
    tierLabel = "Heaven-Pressing";
  } else if (qiPct >= 0.97) {
    baseChance = 0.13;
    tierLabel = "Wall-Touching";
  }

  const totalComp = state.stats.comprehension + (state.stats.comprehensionBonus || 0);
  const compBonus = Math.min(0.12, totalComp * 0.003);
  const failStacks = Math.min(2, state.breakthroughFailureBoost || 0);
  const failBonus = failStacks * 0.08;
  const omenBonus = state.breakthroughPermit ? 0.08 : 0;
  const materialBonus = Math.min(0.2, (catalyst.successChance || 0) / 100);

  if (state.breakthroughPermit) {
    pushLog(state, "A breakthrough omen is consumed.", "good");
    state.breakthroughPermit = false;
  }

  const successChance = Math.min(0.72, baseChance + compBonus + failBonus + omenBonus + materialBonus);
  if (Math.random() < successChance) {
    const qiBurnPct = Math.max(0.72, 0.86 - ((catalyst.qiPreservation || 0) / 100));
    state.qi = Math.max(0, state.qi - Math.floor(state.qiMax * qiBurnPct));
    const realm = GAME_CONSTANTS.realms[state.realmIndex];
    state.stageIndex += 1;
    if (state.stageIndex >= realm.stages.length) {
      state.stageIndex = 0;
      state.realmIndex += 1;
    }
    state.stats.physique += 1;
    state.stats.soulSense += 1;
    state.breakthroughFailureBoost = 0;
    recalculateDerivedStats(state);
    state.hp = Math.min(state.hpMax, state.hp + 12 + Math.floor((catalyst.backlashMitigation || 0) * 0.5));
    state.longevityCurrent = Math.min(state.longevityMax, state.longevityCurrent + 35 + (catalyst.longevity || 0));
    pushLog(state, `Breakthrough! [${tierLabel} — ${Math.round(successChance * 100)}% chance] Entered ${getRealmStageLabel(state)}${catalyst.labels.length ? ` using ${catalyst.labels.join(", ")}` : ""}.`, "good");
    return true;
  }

  const mitigation = Math.min(0.18, (catalyst.backlashMitigation || 0) / 100);
  const qiLoss = Math.floor(state.qi * Math.max(0.28, 0.52 - mitigation + Math.random() * 0.12));
  const hpLoss = Math.max(10, Math.floor((18 + Math.random() * 18) * (1 - Math.min(0.35, mitigation))));
  const lifeLoss = Math.max(1, Math.floor((4 + Math.random() * 4) * (1 - Math.min(0.45, mitigation))));
  state.qi = Math.max(0, state.qi - qiLoss);
  state.hp = Math.max(1, state.hp - hpLoss);
  state.longevityCurrent = Math.max(1, state.longevityCurrent - lifeLoss);
  state.breakthroughFailureBoost = Math.min(2, failStacks + 1);
  pushLog(state, `Backlash! [${tierLabel} — was ${Math.round(successChance * 100)}%] Lost ${qiLoss} qi, ${hpLoss} HP, and ${lifeLoss} years${catalyst.labels.length ? ` despite using ${catalyst.labels.join(", ")}` : ""}.`, "bad");
  return true;
}

function openBreakthroughMaterialPanel(state, selectedItemIds = []) {
  const chosenPlans = selectedItemIds.map((itemId) => buildBreakthroughMaterialPlan(itemId)).filter(Boolean);
  const plans = getBreakthroughMaterialPlans(state, selectedItemIds);
  const minRequiredPct = Math.max(90, 97 - chosenPlans.reduce((sum, plan) => sum + Number(plan.bonuses?.requirementReduction || 0), 0));
  const minRequired = Math.ceil(state.qiMax * (minRequiredPct / 100));
  const actions = [];

  actions.push({
    label: chosenPlans.length > 0 ? `Attempt With ${chosenPlans.length} Material${chosenPlans.length > 1 ? "s" : ""}` : "Attempt Without Materials",
    desc: `Baseline gate ${minRequiredPct}% qi (${minRequired}). ${chosenPlans.length > 0 ? `Current modifiers: ${chosenPlans.map((plan) => `${plan.label} [${formatBonusSummary(plan.bonuses || {})}]`).join(" | ")}` : "No stabilizing materials selected."}`,
    tone: chosenPlans.length > 0 ? "good" : "warn",
    onChoose: () => ({
      success: attemptBreakthroughWithPlans(state, chosenPlans),
      consumeTurn: true,
      actionName: "breakthrough",
      cooldownBonus: 1
    })
  });

  if (chosenPlans.length > 0) {
    actions.push({
      label: "Remove Last Material",
      desc: `Drop ${chosenPlans[chosenPlans.length - 1].label} from the attempt.`,
      tone: "",
      onChoose: () => {
        openBreakthroughMaterialPanel(state, selectedItemIds.slice(0, -1));
        return { success: true, close: false };
      }
    });
  }

  plans.slice(0, 10).forEach((plan) => actions.push({
    label: `Add ${plan.label} x${plan.remaining}`,
    desc: `${plan.successRate}% settle rate · ${plan.effectPercent}% effect · Mods: ${formatBonusSummary(plan.bonuses || {})} · ${plan.effect}`,
    tone: (plan.bonuses.successChance || 0) + (plan.bonuses.requirementReduction || 0) >= 8 ? "good" : "",
    onChoose: () => {
      openBreakthroughMaterialPanel(state, [...selectedItemIds, plan.itemId]);
      return { success: true, close: false };
    }
  }));

  actions.push({
    label: "Back Out",
    desc: "Do not force a breakthrough right now.",
    tone: "",
    onChoose: () => ({ success: false, close: true })
  });

  openInteractionPanel(state, {
    title: "Breakthrough Preparation",
    subtitle: `Near-full qi required · current ${state.qi}/${state.qiMax}`,
    text: `Breakthroughs now demand near-saturation. By default you need roughly 97% of your qi reservoir filled before forcing the next realm. Materials can reduce the threshold slightly, improve success, and blunt backlash, but they will be consumed whether the attempt succeeds or fails.`,
    tags: chosenPlans.length > 0 ? chosenPlans.map((plan) => plan.label).slice(0, 4) : ["Breakthrough", "Qi Saturation", "Materials"],
    checkNote: `Current selected threshold: ${minRequiredPct}% qi (${minRequired}). Base success remains low even at saturation; comprehension, failure focus, omens, and materials all matter.`,
    actions
  });
  return false;
}

function attemptBreakthrough(state) {
  return attemptBreakthroughWithPlans(state, []);
}

// Learn a technique — scroll must already have been removed from inventory by the caller
function learnNewTechnique(state, techniqueId) {
  const tpl = getTechniqueTemplate(techniqueId);
  if (!tpl) {
    pushLog(state, "Unknown technique.", "bad");
    return false;
  }
  if ((state.learnedTechniques[techniqueId] || 0) > 0) {
    pushLog(state, `${tpl.label} is already known.`, "bad");
    return false;
  }
  if (state.realmIndex < (tpl.realmReq || 0)) {
    pushLog(state, `${tpl.label} requires at least realm ${tpl.realmReq}.`, "bad");
    return false;
  }
  state.learnedTechniques[techniqueId] = 1;
  recalculateDerivedStats(state);
  pushLog(state, `Mastered: ${tpl.label} (${tpl.origin}). Cultivation expands.`, "good");
  return true;
}

function learnBattleTechnique(state, techId) {
  const tpl = getBattleTechTemplate(techId);
  if (!tpl) {
    pushLog(state, "Unknown battle art.", "bad");
    return false;
  }
  if (state.learnedBattleTechniques?.[techId]) {
    pushLog(state, `${tpl.label} is already mastered.`, "bad");
    return false;
  }
  if (state.realmIndex < (tpl.realmReq || 0)) {
    pushLog(state, `${tpl.label} requires realm ${tpl.realmReq}.`, "bad");
    return false;
  }
  state.learnedBattleTechniques = state.learnedBattleTechniques || {};
  state.learnedBattleTechniques[techId] = true;
  pushLog(state, `Combat art mastered: ${tpl.label}. Battle channels aligned.`, "good");
  return true;
}

function acquireRing(state) {
  const next = GAME_CONSTANTS.rings[state.ringLevel + 1];
  if (!next) {
    pushLog(state, "Ring already at top known tier.", "bad");
    return false;
  }
  if (state.wallet < next.cost) {
    pushLog(state, `Need ${next.cost} silver for ${next.tier}.`, "bad");
    return false;
  }

  state.wallet -= next.cost;
  state.ringLevel += 1;
  state.ring = next;
  normalizeInventorySize(state);
  pushLog(state, `Acquired ${next.tier}.`, "good");
  return true;
}

function acquireHome(state) {
  const next = GAME_CONSTANTS.homes[state.homeLevel];
  if (!next) {
    pushLog(state, "No higher residence tier available.", "bad");
    return false;
  }

  const city = getCurrentCity(state);
  const totalCost = next.cost + city.landCost;
  if (state.wallet < totalCost) {
    pushLog(state, `Need ${totalCost} silver for ${next.tier} in ${city.name}.`, "bad");
    return false;
  }

  state.wallet -= totalCost;
  state.homeLevel += 1;
  state.home = next;
  normalizeInventorySize(state);
  pushLog(state, `Acquired ${next.tier} in ${city.name}.`, "good");
  return true;
}

function formatBonuses(bonuses = {}) {
  const tokens = [];
  Object.entries(bonuses).forEach(([key, value]) => {
    if (!value) {
      return;
    }
    tokens.push(`${key}+${value}`);
  });
  return tokens.length > 0 ? tokens.join(" | ") : "No bonuses";
}

function hashString(value) {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) {
    out = (out * 31 + value.charCodeAt(i)) % 100000;
  }
  return out;
}

function isConsumableItem(itemId) {
  return [
    "spirit-herb",
    "healing-salve",
    "revitalizing-pill",
    "tempered-marrow-paste",
    "focus-incense",
    "venom-temper-draught",
    "void-meridian-elixir",
    "saintfire-pellet",
    "dao-heart-tonic"
  ].includes(itemId);
}

function getSpiritCultivationCandidates(state) {
  const seen = new Set();
  return state.inventorySlots.reduce((items, stack) => {
    if (!stack || seen.has(stack.id)) {
      return items;
    }
    seen.add(stack.id);
    const template = getItemTemplate(stack.id);
    if (!template || isSpiritVesselItem(template.id) || !isMaterialItem(template)) {
      return items;
    }
    items.push({
      id: template.id,
      label: template.label,
      qty: countItemInInventory(state, template.id),
      potency: Number(template.potency || 1),
      tags: template.tags || []
    });
    return items;
  }, []);
}

function buildSpiritCultivationPlan(spiritTemplate, item) {
  const favoredItem = (spiritTemplate.favoredItemIds || []).includes(item.id);
  const favoredTagHits = (item.tags || []).filter((tag) => (spiritTemplate.favoredTags || []).includes(tag)).length;
  let exp = 8 + item.potency * 5 + favoredTagHits * 4 + (favoredItem ? 10 : 0);
  if ((item.tags || []).includes("spirit") || (item.tags || []).includes("soul")) {
    exp += 4;
  }
  if ((item.tags || []).includes("poison") && !favoredItem && favoredTagHits === 0) {
    exp = Math.max(6, exp - 4);
  }
  const affinity = favoredItem ? "perfect" : favoredTagHits >= 2 ? "high" : favoredTagHits === 1 ? "steady" : "rough";
  const notes = {
    perfect: "A near-perfect spirit feed. The vessel and essence resonate cleanly.",
    high: "Strong affinity. The spirit swallows the essence eagerly.",
    steady: "Decent affinity. Growth should be stable.",
    rough: "Low affinity, but enough essence to force growth."
  };
  return {
    itemId: item.id,
    label: item.label,
    qty: item.qty,
    exp,
    affinity,
    desc: `${affinity} affinity · +${exp} spirit xp · ${notes[affinity]}`
  };
}

function gainSpiritExperience(state, spiritId, amount) {
  const template = getSpiritTemplate(spiritId);
  const entry = getSpiritEntry(state, spiritId);
  if (!template || !entry || amount <= 0) {
    return { gainedLevels: 0, level: entry?.level || 0, xp: entry?.xp || 0 };
  }
  const cap = getSpiritLevelCap(template);
  let levels = 0;
  entry.level = Math.max(1, Number(entry.level || 1));
  entry.xp = Math.max(0, Number(entry.xp || 0) + amount);
  while (entry.level < cap) {
    const required = getSpiritXpRequired(entry.level);
    if (entry.xp < required) {
      break;
    }
    entry.xp -= required;
    entry.level += 1;
    levels += 1;
  }
  if (entry.level >= cap) {
    entry.level = cap;
    entry.xp = 0;
  }
  return { gainedLevels: levels, level: entry.level, xp: entry.xp };
}

function awakenSpirit(state, spiritId) {
  const template = getSpiritTemplate(spiritId);
  if (!template) {
    pushLog(state, "Unknown spirit vessel.", "bad");
    return false;
  }
  if (state.realmIndex < (template.realmReq || 0)) {
    pushLog(state, `${template.label} resists integration until at least realm ${template.realmReq}.`, "bad");
    return false;
  }
  const spiritState = getSpiritState(state);
  if (!spiritState.unlocked[spiritId]) {
    spiritState.unlocked[spiritId] = { level: 1, xp: 0 };
    if (!spiritState.bondedId) {
      spiritState.bondedId = spiritId;
    }
    recalculateDerivedStats(state);
    pushLog(state, `${template.label} answers your call and settles into your soul sea.${spiritState.bondedId === spiritId ? " It is now your integrated spirit." : ""}`, "good");
    return true;
  }
  const growth = gainSpiritExperience(state, spiritId, 20 + state.realmIndex * 2);
  recalculateDerivedStats(state);
  pushLog(state, `${template.label}'s spare vessel collapses into essence. Spirit xp rises.${growth.gainedLevels > 0 ? ` It reaches Lv ${growth.level}.` : ""}`, "good");
  return true;
}

function integrateSpirit(state, spiritId) {
  const template = getSpiritTemplate(spiritId);
  const entry = getSpiritEntry(state, spiritId);
  if (!template || !entry) {
    pushLog(state, "That spirit has not been awakened yet.", "bad");
    return false;
  }
  getSpiritState(state).bondedId = spiritId;
  recalculateDerivedStats(state);
  pushLog(state, `${template.label} is now fully integrated with your meridians.`, "good");
  return true;
}

function cultivateSpiritWithItem(state, spiritId, itemId) {
  const template = getSpiritTemplate(spiritId);
  const entry = getSpiritEntry(state, spiritId);
  const item = getItemTemplate(itemId);
  if (!template || !entry || !item) {
    return false;
  }
  if (!removeItemFromInventory(state, itemId, 1)) {
    pushLog(state, "You no longer carry that spirit feed.", "bad");
    return false;
  }
  const result = gainSpiritExperience(state, spiritId, buildSpiritCultivationPlan(template, { id: item.id, label: item.label, potency: Number(item.potency || 1), tags: item.tags || [], qty: 1 }).exp);
  recalculateDerivedStats(state);
  pushLog(state, `${template.label} devours ${item.label}. Spirit growth deepens.${result.gainedLevels > 0 ? ` It reaches Lv ${result.level}.` : ""}`, "good");
  return true;
}

function openSpiritCultivationPanel(state, spiritId) {
  const template = getSpiritTemplate(spiritId);
  const entry = getSpiritEntry(state, spiritId);
  if (!template || !entry) {
    return false;
  }
  const plans = getSpiritCultivationCandidates(state)
    .map((item) => buildSpiritCultivationPlan(template, item))
    .sort((a, b) => b.exp - a.exp || a.label.localeCompare(b.label));
  const actions = plans.slice(0, 12).map((plan) => ({
    label: `Feed ${plan.label} x${plan.qty}`,
    desc: plan.desc,
    tone: plan.affinity === "perfect" || plan.affinity === "high" ? "good" : plan.affinity === "rough" ? "warn" : "",
    onChoose: () => ({
      success: cultivateSpiritWithItem(state, spiritId, plan.itemId),
      consumeTurn: true,
      actionName: "cityAction",
      cooldownBonus: 1
    })
  }));
  actions.push({
    label: "Back To Spirit Hall",
    desc: "Return without feeding anything.",
    tone: "",
    onChoose: () => {
      openSpiritHall(state);
      return { success: true, close: false };
    }
  });
  openInteractionPanel(state, {
    title: `${template.label} Cultivation`,
    subtitle: formatSpiritSummary(template, entry),
    text: plans.length > 0
      ? `${template.desc} Feed it materials that match its nature to deepen the bond and strengthen its battle assist.`
      : `${template.desc} You currently lack suitable materials. Spirit, soul, beast, saint, dao, and crafted essence items all work to different degrees.`,
    tags: [template.grade, ...(template.favoredTags || []).slice(0, 4)],
    checkNote: `Favored materials: ${(template.favoredItemIds || []).map((itemId) => getItemTemplate(itemId)?.label || itemId).join(", ")}`,
    actions
  });
  return false;
}

function openSpiritHall(state) {
  const spirits = getUnlockedSpiritEntries(state);
  const bonded = getBondedSpiritInfo(state);
  const city = getCurrentCity(state);
  const actions = [];
  spirits.forEach(({ id, template, entry }) => {
    const passiveSummary = formatBonusSummary(Object.keys(template.passiveBonuses || {}).reduce((bonuses, key) => {
      bonuses[key] = (Number(template.passiveBonuses?.[key] || 0)) + (Number(template.perLevelBonuses?.[key] || 0) * Math.max(0, Number(entry.level || 1) - 1));
      return bonuses;
    }, {}));
    actions.push({
      label: bonded?.id === id ? `Integrated: ${template.label}` : `Integrate ${template.label}`,
      desc: `${formatSpiritSummary(template, entry)} · Passive ${passiveSummary}`,
      tone: bonded?.id === id ? "good" : "",
      disabled: bonded?.id === id,
      onChoose: () => ({ success: integrateSpirit(state, id), consumeTurn: false, actionName: "cityAction", cooldownBonus: 0 })
    });
    actions.push({
      label: `Cultivate ${template.label}`,
      desc: `${template.assist?.label || "Spirit Assist"} · ${template.assist?.desc || template.desc}`,
      tone: "",
      onChoose: () => {
        openSpiritCultivationPanel(state, id);
        return { success: true, close: false };
      }
    });
  });
  if (actions.length === 0) {
    actions.push({
      label: "No Spirits Awakened Yet",
      desc: "Search the Myriad Spirit Mausoleum in the Sovereign Wastes for spirit vessels and ancient demon-spirit remnants.",
      tone: "warn",
      disabled: true
    });
  }
  actions.push({
    label: "Back To City Services",
    desc: `Return to ${city.name}'s broader city services.`,
    tone: "",
    onChoose: () => {
      openCityActionPanel(state);
      return { success: true, close: false };
    }
  });
  openInteractionPanel(state, {
    title: `${city.name} Spirit Hall`,
    subtitle: bonded ? `${bonded.template.label} currently integrated` : "No integrated spirit",
    text: "Ancient spirit altars let you integrate awakened spirits, cultivate them with materials, and push their battlefield manifestations higher.",
    tags: [city.name, bonded ? `Bonded ${bonded.entry.level}` : "Unbonded", spirits.length > 0 ? `${spirits.length} Awakened` : "No Spirits"],
    checkNote: spirits.length > 0 ? "Integrated spirits grant passive bonuses and automatically assist after your actions in battle." : "Awaken a spirit vessel from inventory first, or hunt one in the Myriad Spirit Mausoleum.",
    actions
  });
  return false;
}

function rollSpiritVesselDrop() {
  const vessels = (GAME_CONSTANTS.spiritTemplates || []).map((spirit) => spirit.vesselItemId).filter(Boolean);
  if (vessels.length === 0) {
    return null;
  }
  return vessels[Math.floor(Math.random() * vessels.length)];
}

function resolveSpiritAssist(state) {
  if (!state.battle) {
    return false;
  }
  const bonded = getBondedSpiritInfo(state);
  if (!bonded?.template?.assist) {
    return false;
  }
  if (state.battle.spiritAssistRound === state.battle.round) {
    return false;
  }

  const level = Math.max(1, Number(bonded.entry.level || 1));
  const assist = bonded.template.assist;
  const assistChance = Math.min(0.78, 0.34 + level * 0.05 + state.stats.soulSense * 0.01);
  if (Math.random() >= assistChance) {
    return false;
  }

  const damage = Math.max(
    1,
    Number(assist.baseDamage || 0)
      + Number(assist.damagePerLevel || 0) * Math.max(0, level - 1)
      + Math.floor(state.stats.soulSense * 0.45)
      + Math.floor(Math.random() * (5 + level))
  );
  state.battle.enemyHp -= damage;
  state.battle.spiritAssistRound = state.battle.round;

  const effects = [`${assist.label} tears through ${state.battle.enemyName} for ${damage}`];
  if (assist.enemyQiBurn) {
    const qiBurn = Number(assist.enemyQiBurn || 0) + Math.floor(level / 2);
    state.battle.enemyQi = Math.max(0, state.battle.enemyQi - qiBurn);
    effects.push(`burns ${qiBurn} enemy qi`);
  }
  if (assist.qiRestore) {
    const qiRestore = Number(assist.qiRestore || 0) + Math.floor(level / 2);
    state.qi = Math.min(state.qiMax, state.qi + qiRestore);
    effects.push(`restores ${qiRestore} qi`);
  }
  if (assist.battleQiRestore) {
    const battleQiRestore = Number(assist.battleQiRestore || 0) + Math.floor(level / 2);
    state.battleQi = Math.min(state.battleQiMax, state.battleQi + battleQiRestore);
    effects.push(`restores ${battleQiRestore} battle qi`);
  }
  if (assist.hpRestore) {
    const hpRestore = Number(assist.hpRestore || 0) + level;
    state.hp = Math.min(state.hpMax, state.hp + hpRestore);
    effects.push(`restores ${hpRestore} HP`);
  }
  if (assist.grantDefense) {
    state.battle.defending = true;
    effects.push("braces your stance");
  }

  pushLog(state, `${bonded.template.label}: ${effects.join(", ")}.`, "good");
  return true;
}

function getItemDescription(template) {
  if (!template) {
    return "Unknown item.";
  }
  const spiritTemplate = getSpiritTemplateByVesselItemId(template.id);
  if (spiritTemplate) {
    return `Awakens ${spiritTemplate.label}. Use from inventory to integrate the spirit into your soul sea once you are strong enough.`;
  }
  if (isEquipmentItem(template.id)) {
    return `${getEquipmentSlotLabel(template.slot)} equipment. Bonuses: ${formatBonusSummary(template.bonuses || {})}.`;
  }
  const descriptions = {
    "spirit-herb": "A common herb used by wandering cultivators. Restores a small amount of health and qi when consumed.",
    "healing-salve": "A thick medicinal paste sold in city stalls. Restores a solid amount of health.",
    "revitalizing-pill": "A low-grade pill that stabilizes the body and replenishes both health and qi.",
    "beast-core": "A hardened knot of beast essence. Valuable for trade and later refinement.",
    "array-ore": "Ore threaded with formation residue. Heavy, rare, and sought by artificers.",
    "blood-jade": "A crimson mineral that stores violent qi. Useful for forging and barter.",
    "black-iron-ore": "Dense ore prized by body refiners and armor smiths.",
    "venom-gland": "A fresh toxin sac. Dangerous, valuable, and unstable outside a proper seal.",
    "poison-essence": "Refined poison condensed into a volatile spiritual reagent.",
    "moon-dew-fungus": "A pale fungus used in calm, restorative, and dream-linked cultivation.",
    "soul-amber": "Amber that captures spiritual residue and holds it without much loss.",
    "embersteel-ingot": "Fire-touched ingot favored by forge-body cultivators.",
    "stormglass-shard": "A brittle shard humming with trapped storm residue.",
    "cloud-silk": "Fine spiritual cloth that settles breath and thought.",
    "grave-bloom": "A yin herb used in soul work, ghosts arts, and dangerous dream methods.",
    "void-lotus": "A high-tier lotus grown where presence thins. Used in void and dao tonics.",
    "saint-bone-fragment": "A luminous fragment of saint-tempered remains, prized by body refiners.",
    "immortal-dew": "Condensed dawn essence from immortal-grade lands. Gentle to drink, hard to find.",
    "dao-crystal": "A resonant crystal that carries law-like structure through crafted elixirs.",
    "tempered-marrow-paste": "A forged medicinal paste that hardens marrow, heals wounds, and slightly improves physique.",
    "focus-incense": "Lit or inhaled during meditation to restore qi and sharpen soul focus.",
    "venom-temper-draught": "A controlled poison tonic that tempers the body and floods battle channels.",
    "void-meridian-elixir": "A high-grade elixir that clears inner channels and refines void-sensitive perception.",
    "saintfire-pellet": "A saint-tier pellet that surges through flesh and qi alike, leaving the body denser and stronger.",
    "dao-heart-tonic": "A sovereign tonic that steadies the heart-mind, restores qi, and deepens comprehension of law.",
    "ancestral-spirit-incense": "Slow-burning incense prepared specifically to nourish integrated spirits and calm their will.",
    "soul-forge-nectar": "A rare nectar used in high-realm spirit cultivation, especially for sovereign-grade spirit bonds."
  };
  if (descriptions[template.id]) {
    return descriptions[template.id];
  }
  if (template.id.startsWith("scroll-")) {
    return "A cultivation scroll. Study it from your inventory to learn the encoded method.";
  }
  if (template.id.startsWith("battle-scroll-")) {
    return "A battle art scroll. Master it from your inventory to unlock a combat technique.";
  }
  return `${template.label} can be traded in cities for silver.`;
}

function getConsumableEffect(itemId) {
  switch (itemId) {
    case "spirit-herb":
      return { hp: 8, qi: 8 };
    case "healing-salve":
      return { hp: 22, qi: 0 };
    case "revitalizing-pill":
      return { hp: 30, qi: 18 };
    case "tempered-marrow-paste":
      return { hp: 36, battleQi: 12, stats: { physique: 1 } };
    case "focus-incense":
      return { qi: 26, stats: { soulSense: 1, comprehension: 1 } };
    case "venom-temper-draught":
      return { hp: 18, battleQi: 24, stats: { physique: 1 } };
    case "void-meridian-elixir":
      return { qi: 42, battleQi: 18, stats: { soulSense: 1, comprehension: 1 } };
    case "saintfire-pellet":
      return { hp: 58, qi: 28, battleQi: 20, stats: { physique: 2 } };
    case "dao-heart-tonic":
      return { qi: 62, battleQi: 24, stats: { soulSense: 2, comprehension: 1 }, longevity: 12 };
    default:
      return null;
  }
}

function getCityStoreEquipment(state) {
  const city = getCurrentCity(state);
  const all = GAME_CONSTANTS.equipmentTemplates || [];
  const seed = hashString(`${city.id}:${city.avgRealm}:${city.law}`);
  const realmTier = {
    "Mortal": 0,
    "Qi Condensation": 1,
    Foundation: 2,
    Core: 3,
    "Nascent Soul": 4,
    "Soul Formation": 5,
    "Void Refinement": 6,
    "Saint Ascension": 7,
    "Immortal Lord": 8,
    "Dao Sovereign": 9
  }[city.avgRealm] ?? 1;
  const count = 6 + (seed % 3);
  const sorted = all.slice().sort((a, b) => a.cost - b.cost);
  const minCost = Math.max(0, 55 + realmTier * 35 - 25);
  const maxCost = 170 + realmTier * 75;
  const eligible = sorted.filter((item) => item.cost >= minCost && item.cost <= maxCost);
  const pool = eligible.length >= count ? eligible : sorted;
  const chosen = [];
  for (let i = 0; i < pool.length && chosen.length < count; i += 1) {
    const idx = (seed + i * 5) % pool.length;
    const item = pool[idx];
    if (!chosen.some((existing) => existing.id === item.id)) {
      chosen.push(item);
    }
  }
  return chosen;
}

function getCityStoreConsumables(state) {
  const city = getCurrentCity(state);
  const wares = [
    { id: "spirit-herb", label: "Spirit Herb Bundle", cost: 10, qty: 2 },
    { id: "healing-salve", label: "Healing Salve", cost: 22, qty: 1 },
    { id: "revitalizing-pill", label: "Revitalizing Pill", cost: 38, qty: 1 }
  ];
  const regionalWares = {
    "ashen-frontier": [
      { id: "black-iron-ore", label: "Black Iron Ore", cost: 24, qty: 1 },
      { id: "embersteel-ingot", label: "Embersteel Ingot", cost: 31, qty: 1 }
    ],
    "jade-delta": [
      { id: "moon-dew-fungus", label: "Moon Dew Fungus", cost: 21, qty: 1 },
      { id: "cloud-silk", label: "Cloud Silk", cost: 26, qty: 1 },
      { id: "grave-bloom", label: "Grave Bloom", cost: 32, qty: 1 }
    ],
    "iron-wilds": [
      { id: "beast-core", label: "Beast Core", cost: 25, qty: 1 },
      { id: "blood-jade", label: "Blood Jade", cost: 20, qty: 1 },
      { id: "venom-gland", label: "Venom Gland", cost: 24, qty: 1 }
    ],
    "void-rift": [
      { id: "array-ore", label: "Array Ore", cost: 32, qty: 1 },
      { id: "soul-amber", label: "Soul Amber", cost: 39, qty: 1 },
      { id: "stormglass-shard", label: "Stormglass Shard", cost: 30, qty: 1 }
    ],
    "celestial-plateau": [
      { id: "void-lotus", label: "Void Lotus", cost: 58, qty: 1 },
      { id: "saint-bone-fragment", label: "Saint Bone Fragment", cost: 66, qty: 1 },
      { id: "focus-incense", label: "Focus Incense", cost: 72, qty: 1 }
    ],
    "sovereign-wastes": [
      { id: "dao-crystal", label: "Dao Crystal", cost: 84, qty: 1 },
      { id: "immortal-dew", label: "Immortal Dew", cost: 78, qty: 1 },
      { id: "void-meridian-elixir", label: "Void Meridian Elixir", cost: 110, qty: 1 },
      { id: "ancestral-spirit-incense", label: "Ancestral Spirit Incense", cost: 118, qty: 1 },
      { id: "soul-forge-nectar", label: "Soul Forge Nectar", cost: 146, qty: 1 }
    ]
  };
  const premiumRealms = ["Foundation", "Core", "Nascent Soul", "Soul Formation", "Void Refinement", "Saint Ascension", "Immortal Lord", "Dao Sovereign"];
  const premium = premiumRealms.includes(city.avgRealm)
    ? [{ id: "poison-essence", label: "Poison Essence", cost: 44, qty: 1 }]
    : [];
  const seed = hashString(`${city.id}:${city.avgRealm}`);
  const allWares = [...wares, ...(regionalWares[city.regionId] || []), ...premium];
  return allWares.filter((_, idx) => ((seed + idx) % 5 !== 2) || idx < 3);
}

function buyConsumable(state, itemId, qty = 1) {
  const listing = getCityStoreConsumables(state).find((item) => item.id === itemId);
  if (!listing) {
    pushLog(state, "This item is not sold in the current city.", "bad");
    return false;
  }
  const totalQty = (listing.qty || 1) * qty;
  const totalCost = listing.cost * qty;
  if (state.wallet < totalCost) {
    pushLog(state, `Need ${totalCost} silver for ${listing.label}.`, "bad");
    return false;
  }
  if (getInventoryFitForItem(state, listing.id) < totalQty) {
    pushLog(state, "Not enough inventory space.", "bad");
    return false;
  }
  const left = addItemToInventory(state, listing.id, totalQty);
  if (left > 0) {
    pushLog(state, "Not enough inventory space.", "bad");
    return false;
  }
  state.wallet -= totalCost;
  pushLog(state, `Purchased ${listing.label} for ${totalCost} silver.`, "good");
  return true;
}

function useInventoryItem(state, slotIdx) {
  const stack = state.inventorySlots[slotIdx];
  if (!stack) {
    return false;
  }
  if (isSpiritVesselItem(stack.id)) {
    const spirit = getSpiritTemplateByVesselItemId(stack.id);
    if (!spirit || !awakenSpirit(state, spirit.id)) {
      return false;
    }
    stack.qty -= 1;
    if (stack.qty <= 0) {
      state.inventorySlots[slotIdx] = null;
      state.ui.selectedSlot = null;
    }
    return true;
  }
  const effect = getConsumableEffect(stack.id);
  if (!effect) {
    pushLog(state, "This item cannot be used directly.", "bad");
    return false;
  }
  const hpBefore = state.hp;
  const qiBefore = state.qi;
  const battleQiBefore = state.battleQi;
  const longevityBefore = state.longevityCurrent;
  const statBefore = {
    physique: state.stats.physique,
    soulSense: state.stats.soulSense,
    comprehension: state.stats.comprehension
  };
  state.hp = Math.min(state.hpMax, state.hp + (effect.hp || 0));
  state.qi = Math.min(state.qiMax, state.qi + (effect.qi || 0));
  state.battleQi = Math.min(state.battleQiMax, state.battleQi + (effect.battleQi || 0));
  if (effect.stats) {
    Object.entries(effect.stats).forEach(([key, value]) => {
      state.stats[key] = (state.stats[key] || 0) + value;
    });
  }
  if (effect.longevity) {
    state.longevityCurrent = Math.min(state.longevityMax, state.longevityCurrent + effect.longevity);
  }
  stack.qty -= 1;
  if (stack.qty <= 0) {
    state.inventorySlots[slotIdx] = null;
    state.ui.selectedSlot = null;
  }
  recalculateDerivedStats(state);
  const gains = [];
  if (state.hp > hpBefore) gains.push(`+${state.hp - hpBefore} HP`);
  if (state.qi > qiBefore) gains.push(`+${state.qi - qiBefore} Qi`);
  if (state.battleQi > battleQiBefore) gains.push(`+${state.battleQi - battleQiBefore} Battle Qi`);
  if (state.longevityCurrent > longevityBefore) gains.push(`+${state.longevityCurrent - longevityBefore} Longevity`);
  if (state.stats.physique > statBefore.physique) gains.push(`+${state.stats.physique - statBefore.physique} Physique`);
  if (state.stats.soulSense > statBefore.soulSense) gains.push(`+${state.stats.soulSense - statBefore.soulSense} Soul Sense`);
  if (state.stats.comprehension > statBefore.comprehension) gains.push(`+${state.stats.comprehension - statBefore.comprehension} Comprehension`);
  pushLog(state, `Used ${getItemTemplate(stack.id)?.label || stack.id}: ${gains.join(", ") || "the medicine settles with little visible effect"}.`, "good");
  return true;
}

function sellInventoryItem(state, slotIdx, qty = 1) {
  const stack = state.inventorySlots[slotIdx];
  if (!stack) {
    return false;
  }
  const template = getInventoryTemplate(stack.id);
  if (!template || template.value <= 0) {
    pushLog(state, "This item cannot be sold here.", "bad");
    return false;
  }
  const sellQty = Math.max(1, Math.min(stack.qty, qty));
  const total = sellQty * template.value;
  stack.qty -= sellQty;
  if (stack.qty <= 0) {
    state.inventorySlots[slotIdx] = null;
    state.ui.selectedSlot = null;
  }
  state.wallet += total;
  pushLog(state, `Sold ${sellQty}x ${template.label} for ${total} silver.`, "good");
  return true;
}

function acquireEquipment(state, equipmentId) {
  const template = getEquipmentTemplate(equipmentId);
  if (!template) {
    pushLog(state, "Unknown equipment.", "bad");
    return false;
  }
  if (findInventorySlotById(state, template.id) !== -1 || getEquippedItemIdSet(state).has(template.id)) {
    pushLog(state, `${template.label} already owned.`, "bad");
    return false;
  }
  if (state.wallet < template.cost) {
    pushLog(state, `Need ${template.cost} silver for ${template.label}.`, "bad");
    return false;
  }
  if (getInventoryFitForItem(state, template.id) < 1) {
    pushLog(state, "Not enough inventory space for this equipment.", "bad");
    return false;
  }

  state.wallet -= template.cost;
  addItemToInventory(state, template.id, 1);
  pushLog(state, `Purchased ${template.label}. It is now stored in your carried gear pack.`, "good");
  return true;
}

function equipOwnedEquipment(state, equipmentId) {
  const template = getEquipmentTemplate(equipmentId);
  const slotIdx = findInventorySlotById(state, equipmentId);
  if (!template || slotIdx === -1) {
    pushLog(state, "This equipment is not currently in your inventory.", "bad");
    return false;
  }
  const canonicalSlot = template.slot === "armor" ? "robe" : template.slot;
  const currentlyEquipped = state.equipment[canonicalSlot];
  state.inventorySlots[slotIdx].qty -= 1;
  if (state.inventorySlots[slotIdx].qty <= 0) {
    state.inventorySlots[slotIdx] = null;
    if (state.ui?.selectedSlot === slotIdx) {
      state.ui.selectedSlot = null;
    }
  }
  if (currentlyEquipped) {
    addItemToInventory(state, currentlyEquipped, 1);
  }
  state.equipment[canonicalSlot] = template.id;
  recalculateDerivedStats(state);
  pushLog(state, `Equipped ${template.label} to ${getEquipmentSlotLabel(canonicalSlot)}.`, "good");
  return true;
}

function unequipSlot(state, slot) {
  if (!state.equipment[slot]) {
    pushLog(state, `No item equipped in ${slot}.`, "bad");
    return false;
  }
  if (getInventoryFitForItem(state, state.equipment[slot]) < 1) {
    pushLog(state, "Not enough inventory space to unequip this item.", "bad");
    return false;
  }
  const template = getEquipmentTemplate(state.equipment[slot]);
  addItemToInventory(state, state.equipment[slot], 1);
  state.equipment[slot] = null;
  recalculateDerivedStats(state);
  pushLog(state, `Unequipped ${template ? template.label : slot}.`, "good");
  return true;
}

function getCityPulseEntries(state) {
  const city = getCurrentCity(state);
  const region = getCurrentRegion(state);
  const area = getCurrentArea(state);
  const guild = getRegionalGuild(region.id);
  const sect = getRegionalSect(region.id);
  const regionalSects = getSectsForRegion(region.id);
  const hunt = getCurrentHuntContract(state);
  const experts = getCityExperts(city.id);
  return [
    `${city.name}: ${guild.name} is posting paid commissions at the board${state.guildMember ? ` (standing ${state.guildStanding})` : ""}.`,
    `${city.name}: ${(regionalSects.length > 1 ? regionalSects.map((entry) => entry.name).join(", ") : sect.name)} are recruiting outer court hands for beast suppression${state.sectAffiliation ? ` (standing ${state.sectStanding})` : ""}.`,
    experts.length > 0
      ? `${city.name}: ${experts.map((expert) => expert.name).join(", ")} are taking students, commissions, or retainers.`
      : `${city.name}: no major expert houses are active today, only ordinary market chatter.`,
    hunt
      ? `${region.name}: active ${hunt.issuerType} hunt ${hunt.progress}/${hunt.targetKills} against ${hunt.targetName} in ${hunt.areaName}.`
      : `${region.name}: scouts report movement near ${area ? area.name : "the outskirts"}.`
  ];
}

function getRegionalSect(regionId) {
  const regionalSects = getSectsForRegion(regionId);
  return regionalSects.find((sect) => sect.primary) || regionalSects[0] || { id: "wandering-sect", name: "Wandering Sect" };
}

function getRegionalGuild(regionId) {
  const guilds = {
    "ashen-frontier": { id: "iron-guild", name: "Iron Guild" },
    "jade-delta": { id: "river-exchange", name: "River Exchange Guild" },
    "iron-wilds": { id: "wild-hunt-syndicate", name: "Wild Hunt Syndicate" },
    "void-rift": { id: "riftwatch-consortium", name: "Riftwatch Consortium" },
    "celestial-plateau": { id: "star-ledger-compact", name: "Star Ledger Compact" },
    "sovereign-wastes": { id: "ashen-crown-exchange", name: "Ashen Crown Exchange" }
  };
  return guilds[regionId] || { id: "free-trader-guild", name: "Free Trader Guild" };
}

function getCityCraftingTags(city) {
  const landmarks = GAME_CONSTANTS.cityLandmarks?.[city.id] || [];
  const searchable = `${city.name} ${landmarks.join(" ")}`.toLowerCase();
  const tagChecks = {
    forge: ["forge", "furnace", "weapon", "metal"],
    market: ["market", "bazaar", "exchange", "auction", "yard", "depot"],
    archive: ["archive", "scripture", "scribe", "vault", "scroll", "library", "council"],
    garden: ["garden", "herb", "tea", "lotus", "pavilion"],
    poison: ["poison", "marsh", "grave", "smuggler"],
    array: ["array", "formation", "prism"],
    void: ["void", "mirror", "rift"],
    saint: ["saint", "heaven", "starfall", "radiant", "crown"],
    dao: ["dao", "sovereign", "tribunal", "final heaven", "crystal"]
  };
  return Object.entries(tagChecks)
    .filter(([, needles]) => needles.some((needle) => searchable.includes(needle)))
    .map(([tag]) => tag);
}

function getAvailableCraftingRecipes(state) {
  const city = getCurrentCity(state);
  const cityTags = getCityCraftingTags(city);
  return (GAME_CONSTANTS.craftingRecipes || []).filter((recipe) => {
    if (state.realmIndex < (recipe.realmReq || 0)) {
      return false;
    }
    return !Array.isArray(recipe.cityTags) || recipe.cityTags.length === 0 || recipe.cityTags.some((tag) => cityTags.includes(tag));
  });
}

function hasRecipeIngredients(state, recipe) {
  return (recipe.ingredients || []).every((ingredient) => countItemInInventory(state, ingredient.itemId) >= ingredient.qty);
}

function craftRecipe(state, recipeId) {
  const recipe = (GAME_CONSTANTS.craftingRecipes || []).find((entry) => entry.id === recipeId);
  if (!recipe) {
    pushLog(state, "Unknown recipe.", "bad");
    return false;
  }
  if (!getAvailableCraftingRecipes(state).some((entry) => entry.id === recipe.id)) {
    pushLog(state, "This city lacks the facilities to craft that item.", "bad");
    return false;
  }
  if (!hasRecipeIngredients(state, recipe)) {
    pushLog(state, `${recipe.label} requires more ingredients than you currently carry.`, "bad");
    return false;
  }
  if (getInventoryFitForItem(state, recipe.output.itemId) < recipe.output.qty) {
    pushLog(state, "Not enough inventory space for the finished item.", "bad");
    return false;
  }
  (recipe.ingredients || []).forEach((ingredient) => {
    removeItemFromInventory(state, ingredient.itemId, ingredient.qty);
  });
  addItemToInventory(state, recipe.output.itemId, recipe.output.qty);
  pushLog(state, `Crafted ${recipe.label} in ${getCurrentCity(state).name}.`, "good");
  return true;
}

function openCraftingPanel(state) {
  const city = getCurrentCity(state);
  const cityTags = getCityCraftingTags(city);
  const recipes = getAvailableCraftingRecipes(state);
  const actions = recipes.map((recipe) => {
    const ready = hasRecipeIngredients(state, recipe);
    const ingredients = (recipe.ingredients || []).map((ingredient) => {
      const owned = countItemInInventory(state, ingredient.itemId);
      const label = getItemTemplate(ingredient.itemId)?.label || ingredient.itemId;
      return `${label} ${owned}/${ingredient.qty}`;
    }).join(" | ");
    return {
      label: `Craft ${recipe.label}`,
      desc: `${ingredients} -> ${(getItemTemplate(recipe.output.itemId)?.label || recipe.output.itemId)} x${recipe.output.qty}`,
      tone: ready ? "good" : "warn",
      disabled: !ready,
      onChoose: () => {
        const success = craftRecipe(state, recipe.id);
        openCraftingPanel(state);
        return { success, consumeTurn: success, actionName: "cityAction", cooldownBonus: 1, close: false };
      }
    };
  });

  actions.push({
    label: "Back To City Action",
    desc: "Return to the broader city menu.",
    tone: "",
    onChoose: () => {
      openCityActionPanel(state);
      return { success: true, close: false };
    }
  });

  openInteractionPanel(state, {
    title: `${city.name} Craft Hall`,
    subtitle: cityTags.length > 0 ? `Facilities: ${cityTags.join(", ")}` : "Local refiners and market artisans.",
    text: recipes.length > 0
      ? "Select a recipe. Crafting consumes a turn and uses materials from your inventory."
      : "This city lacks recipes you can currently perform. Return after reaching a higher realm or travel to a city with better facilities.",
    tags: cityTags,
    actions
  });
}

function getCityExperts(cityId) {
  return (GAME_CONSTANTS.cityExperts || []).filter((expert) => expert.cityId === cityId);
}

function getExpertTemplate(expertId) {
  return (GAME_CONSTANTS.cityExperts || []).find((expert) => expert.id === expertId) || null;
}

function getExpertStandingValue(state, expert) {
  return expert?.faction === "sect" ? Number(state.sectStanding || 0) : Number(state.guildStanding || 0);
}

function meetsExpertRequirement(state, expert) {
  return getExpertStandingValue(state, expert) >= Number(expert?.requiredStanding || 0);
}

function recruitCityExpert(state, expertId) {
  const expert = getExpertTemplate(expertId);
  if (!expert) {
    pushLog(state, "No such cultivation expert is available here.", "bad");
    return false;
  }
  if ((state.recruitedExperts || []).includes(expert.id)) {
    pushLog(state, `${expert.name} is already in your circle.`, "bad");
    return false;
  }
  if (!meetsExpertRequirement(state, expert)) {
    pushLog(state, `${expert.name} refuses until your ${expert.faction === "sect" ? "sect" : "guild"} standing reaches ${expert.requiredStanding}.`, "bad");
    return false;
  }
  if (state.wallet < expert.recruitCost) {
    pushLog(state, `Need ${expert.recruitCost} silver to recruit ${expert.name}.`, "bad");
    return false;
  }
  state.wallet -= expert.recruitCost;
  state.recruitedExperts.push(expert.id);
  pushLog(state, `${expert.name} joins your retinue as a paid cultivation advisor.`, "good");
  return true;
}

function trainWithCityExpert(state, expertId) {
  const expert = getExpertTemplate(expertId);
  if (!expert || !(state.recruitedExperts || []).includes(expert.id)) {
    pushLog(state, "That expert is not available for private instruction.", "bad");
    return false;
  }
  if (state.wallet < expert.trainingCost) {
    pushLog(state, `Need ${expert.trainingCost} silver for ${expert.name}'s instruction.`, "bad");
    return false;
  }
  state.wallet -= expert.trainingCost;
  if (expert.focus === "body") {
    state.stats.physique += 1;
    state.hp = Math.min(state.hpMax, state.hp + 18);
  } else if (expert.focus === "combat") {
    state.stats.physique += 1;
    state.battleQi = Math.min(state.battleQiMax, state.battleQi + 20);
  } else if (expert.focus === "poison") {
    state.stats.soulSense += 1;
    state.battleQi = Math.min(state.battleQiMax, state.battleQi + 12);
    addItemToInventory(state, "venom-gland", 1);
  } else {
    state.stats.comprehension += 1;
    state.stats.soulSense += 1;
    state.qi = Math.min(state.qiMax, state.qi + 18);
  }
  if (Math.random() < 0.18) {
    const scrollId = getRandomTechniqueScrollId(state);
    addItemToInventory(state, scrollId, 1);
    pushLog(state, `${expert.name} leaves behind ${getItemTemplate(scrollId)?.label || "a copied technique fragment"} after the lesson.`, "good");
  }
  pushLog(state, `${expert.name} drills you personally for ${expert.trainingCost} silver.`, "good");
  return true;
}

function conveneExpertCouncil(state) {
  const experts = (state.recruitedExperts || []).map((id) => getExpertTemplate(id)).filter(Boolean);
  if (experts.length === 0) {
    pushLog(state, "You have no recruited experts to consult.", "bad");
    return false;
  }
  const cost = 28 + experts.length * 22;
  if (state.wallet < cost) {
    pushLog(state, `Need ${cost} silver to convene your expert council.`, "bad");
    return false;
  }
  state.wallet -= cost;
  state.qi = Math.min(state.qiMax, state.qi + 16 + experts.length * 5);
  state.battleQi = Math.min(state.battleQiMax, state.battleQi + 10 + experts.length * 4);
  state.stats.comprehension += 1;
  if (experts.some((expert) => expert.focus === "soul")) {
    state.stats.soulSense += 1;
  }
  if (experts.some((expert) => expert.focus === "body" || expert.focus === "combat")) {
    state.stats.physique += 1;
  }
  if (!state.breakthroughPermit && experts.length >= 2) {
    state.breakthroughPermit = true;
  }
  pushLog(state, `You spend ${cost} silver convening your expert council for a focused cultivation review.`, "good");
  return true;
}

function leaseTrainingChamber(state) {
  const city = getCurrentCity(state);
  const cost = 42 + Math.round(city.landCost * 0.12);
  if (state.wallet < cost) {
    pushLog(state, `Need ${cost} silver to rent a sealed cultivation chamber in ${city.name}.`, "bad");
    return false;
  }
  state.wallet -= cost;
  state.qi = Math.min(state.qiMax, state.qi + 24);
  state.hp = Math.min(state.hpMax, state.hp + 18);
  state.battleQi = Math.min(state.battleQiMax, state.battleQi + 12);
  state.breakthroughPermit = true;
  pushLog(state, `${city.name}'s chamber masters rent you a stabilized room for ${cost} silver.`, "good");
  return true;
}

function buyScriptureAuctionLot(state) {
  const city = getCurrentCity(state);
  const cost = 90 + state.realmIndex * 35 + Math.round(city.landCost * 0.2);
  if (state.wallet < cost) {
    pushLog(state, `Need ${cost} silver to bid on a scripture lot.`, "bad");
    return false;
  }
  state.wallet -= cost;
  const scrollId = getRandomTechniqueScrollId(state);
  addItemToInventory(state, scrollId, 1);
  if (Math.random() < 0.35) {
    const battleScrolls = GAME_CONSTANTS.inventoryTemplates.filter((item) => item.id.startsWith("battle-scroll-"));
    const battleScroll = battleScrolls[Math.floor(Math.random() * battleScrolls.length)];
    addItemToInventory(state, battleScroll.id, 1);
    pushLog(state, `${city.name}'s scripture lot also contains ${battleScroll.label}.`, "good");
  }
  pushLog(state, `You outbid lesser cultivators and secure ${getItemTemplate(scrollId)?.label || "a scripture"} for ${cost} silver.`, "good");
  return true;
}

function buyCityMaterialCache(state) {
  const city = getCurrentCity(state);
  const region = getCurrentRegion(state);
  const cost = 36 + state.realmIndex * 12 + Math.round(city.landCost * 0.08);
  if (state.wallet < cost) {
    pushLog(state, `Need ${cost} silver for a curated material cache.`, "bad");
    return false;
  }
  const regionalMaterials = {
    "ashen-frontier": ["spirit-herb", "black-iron-ore", "embersteel-ingot"],
    "jade-delta": ["spirit-herb", "moon-dew-fungus", "cloud-silk", "grave-bloom"],
    "iron-wilds": ["beast-core", "blood-jade", "black-iron-ore", "venom-gland"],
    "void-rift": ["array-ore", "soul-amber", "stormglass-shard", "grave-bloom"]
  };
  const pool = regionalMaterials[region.id] || ["spirit-herb", "blood-jade"];
  state.wallet -= cost;
  pool.slice(0, 3).forEach((itemId, index) => {
    addItemToInventory(state, itemId, index === 0 ? 2 : 1);
  });
  pushLog(state, `${city.name}'s brokers assemble a material cache for ${cost} silver.`, "good");
  return true;
}

function getStandingKey(issuerType) {
  return issuerType === "sect" ? "sectStanding" : "guildStanding";
}

function getStandingLabel(value) {
  if (value >= 8) return "Inner Circle";
  if (value >= 5) return "Trusted Hand";
  if (value >= 3) return "Known Hand";
  if (value >= 1) return "Junior Hand";
  return "Outsider";
}

function getAreaHuntProfile(area) {
  const profiles = {
    "cinder-steppe": { targetName: "Cinderback Jackal", trophy: "ash fang" },
    "burnt-shrines": { targetName: "Shrine Wisp", trophy: "charred prayer seal" },
    "smoke-pits": { targetName: "Smoke Burrower", trophy: "slag claw" },
    "jade-marsh": { targetName: "Marsh Serpent", trophy: "jade scale" },
    "lotus-fissure": { targetName: "Fissure Moth", trophy: "spirit wing" },
    "bamboo-veil": { targetName: "Veil Stalker", trophy: "green whisker" },
    "red-fang-range": { targetName: "Red Fang Prowler", trophy: "crimson fang" },
    "bone-hollows": { targetName: "Bone Gnawer", trophy: "ivory shard" },
    "war-scar-vale": { targetName: "War Scar Revenant", trophy: "rusted insignia" },
    "fracture-coast": { targetName: "Fracture Eel", trophy: "rift barb" },
    "prism-chasm": { targetName: "Prism Raptor", trophy: "prism feather" },
    "hushed-mirror": { targetName: "Mirror Shade", trophy: "mirror splinter" }
  };
  return profiles[area?.id] || { targetName: `${area?.short || "Wild"} Marauder`, trophy: "proof seal" };
}

function getCheckStatValue(state, stat) {
  switch (stat) {
    case "physique":
    case "soulSense":
    case "comprehension":
    case "fortune":
    case "karma":
      return Number(state.stats?.[stat] || 0);
    case "guildStanding":
    case "sectStanding":
      return Number(state[stat] || 0);
    case "bodyLevel":
      return getBodyLevel(state);
    case "soulLevel":
      return getSoulLevel(state);
    case "realm":
      return state.realmIndex * 3 + state.stageIndex + 1;
    default:
      return Number(state[stat] || 0);
  }
}

function describeCheck(check) {
  if (!check?.stat || !check?.difficulty) {
    return "";
  }
  const names = {
    physique: "Physique",
    soulSense: "Soul Sense",
    comprehension: "Comprehension",
    fortune: "Fortune",
    karma: "Karma",
    guildStanding: "Guild Standing",
    sectStanding: "Sect Standing",
    bodyLevel: "Body Level",
    soulLevel: "Soul Level",
    realm: "Realm"
  };
  const label = names[check.stat] || check.stat;
  const bonus = check.bonusStat ? ` + ${names[check.bonusStat] || check.bonusStat}` : "";
  return `Check: 1d12 + ${label}${bonus} vs ${check.difficulty}`;
}

function rollSkillCheck(state, check) {
  const roll = 1 + Math.floor(Math.random() * 12);
  const base = getCheckStatValue(state, check.stat);
  const bonus = check.bonusStat ? getCheckStatValue(state, check.bonusStat) : 0;
  const total = roll + base + bonus;
  return {
    roll,
    base,
    bonus,
    total,
    success: total >= check.difficulty
  };
}

function getFeaturedEvents(state, limit = 4) {
  return getEligibleEvents(state)
    .slice()
    .sort((a, b) => {
      const rarityDelta = getRarityWeight(getEventRarity(b)) - getRarityWeight(getEventRarity(a));
      if (rarityDelta !== 0) {
        return rarityDelta;
      }
      const aSeed = hashString(`${state.currentCityId}:${a.id || a.title}`) % 97;
      const bSeed = hashString(`${state.currentCityId}:${b.id || b.title}`) % 97;
      return aSeed - bSeed;
    })
    .slice(0, limit);
}

function getEventRarity(event) {
  if (event.rarity) {
    return event.rarity;
  }
  const title = `${event.title || ""} ${event.id || ""}`;
  if (/Ancient|Forbidden|Ghost|Tribulation|Celestial|Void|Secret Duel|Dreamscape|Collapsed|Journal/i.test(title)) {
    return "rare";
  }
  if (event.npc || event.id || event.unlockedBy) {
    return "uncommon";
  }
  return "common";
}

function getRarityWeight(rarity) {
  const weights = {
    common: 12,
    uncommon: 5,
    rare: 1.5,
    legendary: 0.35
  };
  return weights[rarity] || weights.common;
}

function pickWeighted(items, weightFn) {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightFn(item)), 0);
  if (total <= 0) {
    return items[0] || null;
  }
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(0, weightFn(item));
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1] || null;
}

function pickSeededWeighted(items, weightFn, seed) {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightFn(item)), 0);
  if (total <= 0) {
    return items[0] || null;
  }
  let roll = ((Math.abs(Number(seed) || 0) % 100000) / 100000) * total;
  for (const item of items) {
    roll -= Math.max(0, weightFn(item));
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1] || null;
}

function truncateText(value, maxLength = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function getEventSeed(state, event) {
  return Math.abs(hashString(`${state.currentCityId}:${state.turn}:${event.id || event.title || "event"}`));
}

function pickEventScene(state, event) {
  const scenes = Array.isArray(event?.scenes) ? event.scenes : [];
  if (scenes.length === 0) {
    return null;
  }
  return pickSeededWeighted(scenes, (scene) => Number(scene.weight || 1), getEventSeed(state, event));
}

function cloneEventChoices(choices) {
  return Array.isArray(choices) ? choices.map((choice) => ({ ...choice })) : [];
}

function getEventPreviewText(state, event, scene = null) {
  const teaser = scene?.rumor || event?.rumor;
  if (teaser) {
    return teaser;
  }
  const sourceText = scene?.text || event?.text || "A thread in the city demands attention.";
  const firstSentence = sourceText.split(/[.!?]/).find(Boolean) || sourceText;
  let preview = truncateText(firstSentence, 108);
  const intuition = scene?.intuition || event?.intuition;
  if (intuition?.text && Number(state.stats?.soulSense || 0) >= Number(intuition.threshold || 10)) {
    preview = `${preview} Your soul sense says more is hidden.`;
  }
  return preview;
}

function getEventIntuitionNote(state, event, scene = null) {
  const intuition = scene?.intuition || event?.intuition;
  if (!intuition || !intuition.text) {
    return "";
  }
  const threshold = Number(intuition.threshold || 10);
  return Number(state.stats?.soulSense || 0) >= threshold ? intuition.text : "";
}

function prepareEventEncounter(state, event) {
  const scene = pickEventScene(state, event);
  const prepared = {
    ...event,
    ...(scene || {}),
    title: scene?.title || event.title,
    text: scene?.text || event.text,
    tags: [...new Set([...(event.tags || []), ...(scene?.tags || [])])],
    choices: cloneEventChoices(scene?.choices?.length ? scene.choices : event.choices),
    battle: scene?.battle || event.battle || null
  };
  prepared.previewText = getEventPreviewText(state, prepared, scene);
  prepared.intuitionNote = getEventIntuitionNote(state, prepared, scene);
  return prepared;
}

function clearPendingCityEncounterBattle(state) {
  if (!state.questState) {
    state.questState = {};
  }
  delete state.questState.pendingCityEncounterBattle;
}

function beginCityEncounterBattle(state, battleConfig = {}, eventTitle = "Encounter") {
  const reward = { ...(battleConfig.reward || {}) };
  const started = startBattle(state, {
    enemyName: battleConfig.enemyName,
    hpScale: battleConfig.hpScale,
    qiScale: battleConfig.qiScale,
    qiCost: battleConfig.qiCost,
    lootFocus: battleConfig.lootFocus
  });
  if (!started) {
    return false;
  }
  state.questState = state.questState || {};
  state.questState.pendingCityEncounterBattle = {
    title: eventTitle,
    logText: battleConfig.victoryText || reward.logText || "",
    ...reward
  };
  if (battleConfig.openingText) {
    pushLog(state, battleConfig.openingText, battleConfig.openingTone || "bad");
  }
  return true;
}

function applyPendingCityEncounterReward(state) {
  const pending = state.questState?.pendingCityEncounterBattle;
  if (!pending) {
    return;
  }
  if (pending.silver) {
    state.wallet += pending.silver;
  }
  if (pending.qi) {
    state.qi = Math.min(state.qiMax, state.qi + pending.qi);
  }
  if (pending.battleQi) {
    state.battleQi = Math.min(state.battleQiMax, state.battleQi + pending.battleQi);
  }
  if (pending.hp) {
    state.hp = Math.min(state.hpMax, state.hp + pending.hp);
  }
  if (pending.comprehension) {
    state.stats.comprehension += pending.comprehension;
  }
  if (pending.soulSense) {
    state.stats.soulSense += pending.soulSense;
  }
  if (pending.physique) {
    state.stats.physique += pending.physique;
  }
  if (pending.fortune) {
    state.stats.fortune += pending.fortune;
  }
  if (pending.karma) {
    state.stats.karma += pending.karma;
  }
  if (pending.guildStanding) {
    state.guildStanding = Math.min(10, state.guildStanding + pending.guildStanding);
  }
  if (pending.sectStanding) {
    state.sectStanding = Math.min(10, state.sectStanding + pending.sectStanding);
  }
  if (pending.itemId && pending.itemQty) {
    const overflow = addItemToInventory(state, pending.itemId, pending.itemQty);
    if (overflow > 0) {
      pushLog(state, `${pending.title}: ${overflow}x ${getItemTemplate(pending.itemId)?.label || pending.itemId} could not fit in your inventory.`, "bad");
    }
  }
  if (pending.logText) {
    pushLog(state, pending.logText, "good");
  }
  clearPendingCityEncounterBattle(state);
}

function getEligibleEvents(state) {
  let allEvents = [...GAME_CONSTANTS.events];
  const cityPool = GAME_CONSTANTS.cityEventPools?.[state.currentCityId];
  if (cityPool && Array.isArray(cityPool)) {
    allEvents = [...cityPool, ...allEvents];
  }
  return allEvents.filter((event) => {
    const passesCanTrigger = typeof event.canTrigger === "function" ? event.canTrigger(state) : true;
    if (!passesCanTrigger) return false;
    if (event.unlockedBy && Array.isArray(event.unlockedBy)) {
      for (const prereq of event.unlockedBy) {
        if (!state.questsCompleted[prereq]) return false;
      }
    }
    if (event.id && state.questsCompleted[event.id]) return false;
    return true;
  });
}

function getCurrentHuntContract(state) {
  return state.questState?.huntContract || null;
}

function setCurrentHuntContract(state, contract) {
  state.questState = state.questState || {};
  state.questState.huntContract = contract;
}

function createHuntContract(state, issuerType = "guild") {
  const areas = getAreasForRegion(state.currentRegionId);
  const targetArea = pickWeighted(areas, (area) => 6 + area.danger * 2);
  if (!targetArea) {
    return null;
  }
  const issuer = issuerType === "sect" ? getRegionalSect(state.currentRegionId) : getRegionalGuild(state.currentRegionId);
  const profile = getAreaHuntProfile(targetArea);
  const standing = state[getStandingKey(issuerType)] || 0;
  const rank = 1 + Math.min(3, Math.floor((standing + targetArea.danger) / 3));
  const targetKills = 2 + targetArea.danger + Math.min(2, Math.floor(standing / 4));
  return {
    id: `hunt-${issuerType}-${targetArea.id}-${state.turn}`,
    issuerType,
    issuerName: issuer.name,
    cityId: state.currentCityId,
    areaId: targetArea.id,
    areaName: targetArea.name,
    targetName: profile.targetName,
    trophyLabel: profile.trophy,
    rank,
    targetKills,
    progress: 0,
    rewardSilver: 28 + targetArea.danger * 14 + state.realmIndex * 10 + standing * 6 + rank * 8,
    rewardBattleQi: 10 + targetArea.danger * 4 + rank * 4,
    bonusItemId: rank >= 3 ? "revitalizing-pill" : (rank >= 2 ? "healing-salve" : null)
  };
}

function issueHuntContract(state, issuerType = "guild") {
  if (getCurrentHuntContract(state)) {
    pushLog(state, "You already hold an active hunt contract.", "bad");
    return false;
  }
  const contract = createHuntContract(state, issuerType);
  if (!contract) {
    pushLog(state, "No valid hunt contract could be issued here.", "bad");
    return false;
  }
  setCurrentHuntContract(state, contract);
  pushLog(state, `${contract.issuerName} assigns a rank ${contract.rank} hunt in ${contract.areaName}: defeat ${contract.targetKills} ${contract.targetName}${contract.targetKills > 1 ? "s" : ""}.`, "good");
  return true;
}

function turnInHuntContract(state) {
  const contract = getCurrentHuntContract(state);
  if (!contract) {
    pushLog(state, "No hunt contract to turn in.", "bad");
    return false;
  }
  if (contract.cityId !== state.currentCityId) {
    pushLog(state, `Return to ${GAME_CONSTANTS.cities.find((city) => city.id === contract.cityId)?.name || "the issuing city"} to turn in this contract.`, "bad");
    return false;
  }
  if (contract.progress < contract.targetKills) {
    pushLog(state, `Contract incomplete: ${contract.progress}/${contract.targetKills} ${contract.targetName}${contract.targetKills > 1 ? "s" : ""} hunted in ${contract.areaName}.`, "bad");
    return false;
  }
  state.wallet += contract.rewardSilver;
  state.battleQi = Math.min(state.battleQiMax, state.battleQi + contract.rewardBattleQi);
  state.stats.fortune += 1;
  const standingKey = getStandingKey(contract.issuerType);
  state[standingKey] = Math.min(10, (state[standingKey] || 0) + 1);
  if (contract.bonusItemId && getInventoryFitForItem(state, contract.bonusItemId) > 0) {
    addItemToInventory(state, contract.bonusItemId, 1);
    pushLog(state, `${contract.issuerName} includes ${getItemTemplate(contract.bonusItemId)?.label || contract.bonusItemId} with your pay.`, "good");
  }
  pushLog(state, `${contract.issuerName} pays ${contract.rewardSilver} silver for the completed hunt. ${getStandingLabel(state[standingKey])} standing rises to ${state[standingKey]}.`, "good");
  setCurrentHuntContract(state, null);
  return true;
}

function resolveEventEffects(state, event, handler) {
  const scrollsBefore = state.techniqueScrolls || 0;
  handler(state, { inventoryWeight: getInventoryWeight(state) });

  if (event.id) {
    state.questsCompleted[event.id] = true;
  }

  convertPendingScrolls(state, scrollsBefore);

  if (!state.breakthroughPermit && Math.random() < 0.16) {
    state.breakthroughPermit = true;
    pushLog(state, "A strange omen settles in your dantian. A breakthrough chance is now available.", "good");
  }
}

function resolveEventChoice(state, event, choice) {
  const checkResult = choice.check ? rollSkillCheck(state, choice.check) : null;
  if (checkResult) {
    pushLog(
      state,
      `${choice.label}: ${checkResult.success ? "success" : "failure"} (${checkResult.total} vs ${choice.check.difficulty}).`,
      checkResult.success ? "good" : "bad"
    );
  }

  const handler = checkResult
    ? (checkResult.success ? choice.onSuccess : (choice.onFailure || choice.onResolve))
    : (choice.onResolve || event.onResolve);

  if (typeof handler !== "function") {
    pushLog(state, "Nothing comes of that choice.", "bad");
    return false;
  }

  resolveEventEffects(state, event, (nextState, context) => handler(nextState, { ...context, checkResult }));
  pushLog(state, `${event.title}: ${event.text}`, state.logClass || "");
  if (checkResult?.success && choice.successText) {
    pushLog(state, choice.successText, "good");
  } else if (checkResult && !checkResult.success && choice.failText) {
    pushLog(state, choice.failText, "bad");
  } else if (!checkResult && choice.resultText) {
    pushLog(state, choice.resultText, state.logClass || "");
  }
  state.logClass = "";
  return true;
}

function resolveEventNow(state, event) {
  if (typeof event.onResolve !== "function") {
    return false;
  }
  resolveEventEffects(state, event, event.onResolve);
  pushLog(state, `${event.title}: ${event.text}`, state.logClass || "");
  state.logClass = "";
  return true;
}

function closeInteractionPanel(state) {
  state.ui.interaction = null;
  closePanel(document.getElementById("interaction-modal"));
}

function openInteractionPanel(state, config) {
  state.ui.interaction = config;
  openPanel(document.getElementById("interaction-modal"));
}

function handleInteractionChoice(state, result) {
  const normalized = typeof result === "boolean" ? { success: result } : (result || { success: false });
  if (normalized.success && normalized.consumeTurn) {
    processActionSuccess(state, true, normalized.actionName || "cityAction", normalized.cooldownBonus || 0);
  }
  if (normalized.close !== false) {
    closeInteractionPanel(state);
  }
  render(state);
}

function openEventInteraction(state, event, backAction) {
  const encounter = prepareEventEncounter(state, event);
  const npc = getNpcTemplate(encounter.npc);
  const rarity = getEventRarity(encounter);
  const actions = (Array.isArray(encounter.choices) && encounter.choices.length > 0
    ? encounter.choices.map((choice) => ({
        label: choice.label,
        desc: [choice.desc, describeCheck(choice.check)].filter(Boolean).join(" "),
        tone: choice.tone || "",
        onChoose: () => ({
          success: resolveEventChoice(state, encounter, choice),
          consumeTurn: true,
          actionName: "cityAction",
          cooldownBonus: 1
        })
      }))
    : [{
        label: "Resolve Encounter",
        desc: "Follow the lead and accept the outcome.",
        tone: rarity === "rare" || rarity === "legendary" ? "warn" : "good",
        onChoose: () => ({
          success: resolveEventNow(state, encounter),
          consumeTurn: true,
          actionName: "cityAction",
          cooldownBonus: 1
        })
      }]);

  if (encounter.battle) {
    actions.unshift({
      label: encounter.battle.label || "Force A Confrontation",
      desc: encounter.battle.desc || "Turn the rumor into a direct clash before the other side controls the ground.",
      tone: encounter.battle.tone || "warn",
      onChoose: () => ({
        success: beginCityEncounterBattle(state, encounter.battle, encounter.title),
        consumeTurn: true,
        actionName: "cityAction",
        cooldownBonus: 1
      })
    });
  }

  if (typeof backAction === "function") {
    actions.push({
      label: "Back",
      desc: "Return without spending time.",
      tone: "",
      onChoose: () => {
        backAction();
        return { success: true, close: false };
      }
    });
  }

  const checkNotes = [];
  if (encounter.intuitionNote) {
    checkNotes.push(`Soul Sense: ${encounter.intuitionNote}`);
  }
  if (Array.isArray(encounter.choices) && encounter.choices.some((choice) => choice.check)) {
    checkNotes.push("Choices with checks roll 1d12 plus the listed stats against the difficulty.");
  }

  openInteractionPanel(state, {
    title: encounter.title,
    subtitle: npc ? `${npc.name} · ${npc.title} · ${rarity}` : `${rarity} encounter`,
    text: encounter.text,
    tags: [rarity, ...(encounter.tags || []), ...(npc ? [npc.name] : [])],
    checkNote: checkNotes.join(" "),
    actions
  });
}

function openCityRumorBoard(state) {
  const events = getFeaturedEvents(state, 5);
  const actions = events.map((event) => {
    const encounter = prepareEventEncounter(state, event);
    const npcName = encounter.npc ? (getNpcTemplate(encounter.npc)?.name || encounter.npc) : "";
    const rarity = getEventRarity(encounter);
    return {
    label: encounter.title,
    desc: `${npcName ? `${npcName} · ` : ""}${encounter.previewText}`,
    tone: rarity === "rare" || rarity === "legendary" || encounter.battle ? "warn" : "",
    onChoose: () => {
      openEventInteraction(state, event, () => openCityRumorBoard(state));
      return { success: true, close: false };
    }
  };});

  actions.push({
    label: "Back To City Action",
    desc: "Return to the broader city menu.",
    tone: "",
    onChoose: () => {
      openCityActionPanel(state);
      return { success: true, close: false };
    }
  });

  openInteractionPanel(state, {
    title: `${getCurrentCity(state).name} Rumor Board`,
    subtitle: "Posted requests, whispered chances, and faction work.",
    text: "Choose which thread to pursue. Rumors only show what reaches the board; sharper senses reveal a little more. Taking one will spend your turn, browsing will not.",
    tags: [getRegionalGuild(state.currentRegionId).name, getRegionalSect(state.currentRegionId).name],
    actions
  });
}

function buildCityActionBuckets(state) {
  const city = getCurrentCity(state);
  const region = getCurrentRegion(state);
  const guild = getRegionalGuild(region.id);
  const sect = getRegionalSect(region.id);
  const hunt = getCurrentHuntContract(state);
  const experts = getCityExperts(city.id);
  const recruitedExperts = (state.recruitedExperts || []).map((id) => getExpertTemplate(id)).filter(Boolean);
  const herbCount = countItemInInventory(state, "spirit-herb");
  const coreCount = countItemInInventory(state, "beast-core");
  const buckets = {
    faction: [],
    services: [],
    experts: []
  };

  if (!state.guildMember) {
    buckets.faction.push({
      label: `Register With ${guild.name}`,
      desc: "Gain legal market backing, a small stipend, and access to guild hunts.",
      tone: "good",
      onChoose: () => {
        state.guildMember = true;
        state.guildStanding = Math.max(1, state.guildStanding || 0);
        state.wallet += 12;
        pushLog(state, `${guild.name} registers you and waives the first dues.`, "good");
        return { success: true, consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 };
      }
    });
  } else if (hunt?.issuerType === "guild" && hunt.cityId === state.currentCityId && hunt.progress >= hunt.targetKills) {
    buckets.faction.push({
      label: `Turn In ${guild.name} Hunt`,
      desc: `Claim ${hunt.rewardSilver} silver for ${hunt.targetKills} ${hunt.targetName}${hunt.targetKills > 1 ? "s" : ""}.`,
      tone: "good",
      onChoose: () => ({ success: turnInHuntContract(state), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
    });
  } else if (!hunt) {
    buckets.faction.push({
      label: `${guild.name} Hunt Desk`,
      desc: `Request a posted hunt. Standing ${state.guildStanding} (${getStandingLabel(state.guildStanding)}).`,
      tone: "good",
      onChoose: () => ({ success: issueHuntContract(state, "guild"), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
    });
  }

  if (state.guildMember) {
    buckets.faction.push({
      label: "Quartermaster Delivery",
      desc: `Turn in 2 Beast Cores for silver and standing. Carrying ${coreCount}/2.`,
      tone: coreCount >= 2 ? "good" : "",
      disabled: coreCount < 2,
      onChoose: () => {
        if (!removeItemFromInventory(state, "beast-core", 2)) {
          pushLog(state, "You lack enough Beast Cores.", "bad");
          return { success: false, close: false };
        }
        const reward = 32 + state.guildStanding * 4;
        state.wallet += reward;
        state.guildStanding = Math.min(10, state.guildStanding + 1);
        pushLog(state, `${guild.name} quartermasters pay ${reward} silver for your cores.`, "good");
        return { success: true, consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 };
      }
    });
  }

  if (!state.sectAffiliation) {
    buckets.faction.push({
      label: `Petition ${sect.name}`,
      desc: "Seek outer court affiliation and modest guidance from the local sect.",
      tone: "good",
      onChoose: () => {
        state.sectAffiliation = sect.name;
        state.sectStanding = Math.max(1, state.sectStanding || 0);
        state.stats.comprehension += 1;
        state.stats.soulSense += 1;
        pushLog(state, `${sect.name} accepts you as an outer court associate.`, "good");
        return { success: true, consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 };
      }
    });
  } else if (hunt?.issuerType === "sect" && hunt.cityId === state.currentCityId && hunt.progress >= hunt.targetKills) {
    buckets.faction.push({
      label: `Turn In ${sect.name} Hunt`,
      desc: "Report suppression complete and claim sect standing.",
      tone: "good",
      onChoose: () => ({ success: turnInHuntContract(state), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
    });
  } else if (!hunt) {
    buckets.faction.push({
      label: `${sect.name} Beast Suppression`,
      desc: `Request a sect hunt. Standing ${state.sectStanding} (${getStandingLabel(state.sectStanding)}).`,
      tone: "good",
      onChoose: () => ({ success: issueHuntContract(state, "sect"), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
    });
  }

  if (state.sectAffiliation) {
    buckets.faction.push({
      label: "Sect Herb Offering",
      desc: `Offer 3 Spirit Herbs for favor and qi guidance. Carrying ${herbCount}/3.`,
      tone: herbCount >= 3 ? "good" : "",
      disabled: herbCount < 3,
      onChoose: () => {
        if (!removeItemFromInventory(state, "spirit-herb", 3)) {
          pushLog(state, "You lack enough Spirit Herbs.", "bad");
          return { success: false, close: false };
        }
        state.sectStanding = Math.min(10, state.sectStanding + 1);
        state.qi = Math.min(state.qiMax, state.qi + 18 + state.sectStanding * 2);
        state.battleQi = Math.min(state.battleQiMax, state.battleQi + 10);
        pushLog(state, `${sect.name} elders accept your herbs and guide your breathing cycle.`, "good");
        return { success: true, consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 };
      }
    });

    buckets.faction.push({
      label: "Undergo Sect Trial",
      desc: "Demonstrate poise before the elders for standing, insight, and occasional scroll rewards.",
      tone: "",
      onChoose: () => {
        const event = {
          title: `${sect.name} Trial Court`,
          text: "The elders demand calm technique, measured speech, and absolute control of your circulation.",
          choices: [{
            label: "Center Your Breathing",
            desc: "Rely on soul cultivation and study to impress the court.",
            check: { stat: "soulSense", bonusStat: "comprehension", difficulty: 24 },
            successText: "Your circulation remains smooth under pressure. The elders nod.",
            failText: "Your breathing falters and the court dismisses you with cold silence.",
            onSuccess: (nextState) => {
              nextState.sectStanding = Math.min(10, nextState.sectStanding + 1);
              nextState.stats.comprehension += 1;
              if (Math.random() < 0.45) {
                nextState.techniqueScrolls = (nextState.techniqueScrolls || 0) + 1;
              }
              nextState.logClass = "good";
            },
            onFailure: (nextState) => {
              nextState.qi = Math.max(0, nextState.qi - 14);
              nextState.hp = Math.max(1, nextState.hp - 8);
              nextState.logClass = "bad";
            }
          }]
        };
        openEventInteraction(state, event, () => openCityActionPanel(state));
        return { success: true, close: false };
      }
    });
  }

  buckets.services.push({
    label: "Visit Craft Hall",
    desc: `Refine materials into practical medicines and progression items using ${city.name}'s facilities.`,
    tone: "good",
    onChoose: () => {
      openCraftingPanel(state);
      return { success: true, close: false };
    }
  });

  buckets.services.push({
    label: "Lease Sealed Training Chamber",
    desc: `Spend silver for stabilized cultivation, breakthrough support, and safer recovery in ${city.name}.`,
    tone: "",
    onChoose: () => ({ success: leaseTrainingChamber(state), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
  });

  buckets.services.push({
    label: "Bid At Scripture Auction",
    desc: "Use silver where it makes sense: buy a real scripture lot instead of hoping beasts carry one.",
    tone: "warn",
    onChoose: () => ({ success: buyScriptureAuctionLot(state), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
  });

  buckets.services.push({
    label: "Purchase Material Cache",
    desc: `Buy a regional reagent bundle tailored to ${region.name}.`,
    tone: "",
    onChoose: () => ({ success: buyCityMaterialCache(state), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
  });

  if (canCurrentCityAccessSpiritHall(state)) {
    const bonded = getBondedSpiritInfo(state);
    const awakenedCount = getUnlockedSpiritEntries(state).length;
    buckets.services.push({
      label: "Enter Spirit Hall",
      desc: bonded
        ? `${bonded.template.label} is integrated. ${awakenedCount} awakened spirit${awakenedCount === 1 ? "" : "s"} can be cultivated here.`
        : awakenedCount > 0
          ? `${awakenedCount} awakened spirit${awakenedCount === 1 ? "" : "s"} await integration and cultivation.`
          : "Attune ancient spirit altars, bind awakened vessels, and strengthen bonded spirits.",
      tone: bonded || awakenedCount > 0 ? "good" : "",
      onChoose: () => {
        openSpiritHall(state);
        return { success: true, close: false };
      }
    });
  }

  if (recruitedExperts.length > 0) {
    buckets.experts.push({
      label: "Convene Expert Council",
      desc: `Gather ${recruitedExperts.length} recruited expert${recruitedExperts.length > 1 ? "s" : ""} for a paid cultivation review.`,
      tone: "good",
      onChoose: () => ({ success: conveneExpertCouncil(state), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
    });
  }

  experts.forEach((expert) => {
    const recruited = (state.recruitedExperts || []).includes(expert.id);
    if (!recruited) {
      const standingNow = getExpertStandingValue(state, expert);
      buckets.experts.push({
        label: `Recruit ${expert.name}`,
        desc: `${expert.title} · ${expert.focus} expert · ${expert.recruitCost} silver · needs ${expert.faction} standing ${expert.requiredStanding} (current ${standingNow}).`,
        tone: meetsExpertRequirement(state, expert) ? "" : "warn",
        onChoose: () => ({ success: recruitCityExpert(state, expert.id), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
      });
      return;
    }
    buckets.experts.push({
      label: `Train With ${expert.name}`,
      desc: `${expert.title} · ${expert.trainingCost} silver · ${expert.desc}`,
      tone: "good",
      onChoose: () => ({ success: trainWithCityExpert(state, expert.id), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
    });
  });

  buckets.services.push({
    label: `Rest At ${city.name} Inn`,
    desc: state.activeAction?.action === "cityRest" ? "You are already resting." : "Begin a faster, safer recovery cycle inside the city.",
    tone: "",
    disabled: state.activeAction?.action === "cityRest",
    onChoose: () => ({ success: startActiveAction(state, "cityRest"), consumeTurn: true, actionName: "cityAction", cooldownBonus: 1 })
  });

  return {
    city,
    region,
    guild,
    sect,
    hunt,
    experts,
    recruitedExperts,
    buckets
  };
}

function openCityBucketPanel(state, bucketKey) {
  const context = buildCityActionBuckets(state);
  const config = {
    faction: {
      title: `${context.city.name} Faction Affairs`,
      subtitle: `${context.guild.name} and ${context.sect.name}`,
      text: "Guild registrations, faction hunts, offerings, and political obligations all flow through this desk.",
      tags: [
        `Guild ${state.guildMember ? `${state.guildStanding} ${getStandingLabel(state.guildStanding)}` : "Unaffiliated"}`,
        `Sect ${state.sectAffiliation ? `${state.sectStanding} ${getStandingLabel(state.sectStanding)}` : "Unaffiliated"}`,
        context.hunt ? `Active Hunt ${context.hunt.progress}/${context.hunt.targetKills}` : "No Active Hunt"
      ]
    },
    services: {
      title: `${context.city.name} Services`,
      subtitle: `${context.region.name} civic district`,
      text: "Use the city itself: crafting halls, sealed rooms, auctions, material brokers, and safe recovery.",
      tags: [context.city.law, context.region.resources, context.hunt ? `Hunt In ${context.hunt.areaName}` : "Open Schedule"]
    },
    experts: {
      title: `${context.city.name} Expert Hall`,
      subtitle: `${context.experts.length} local expert${context.experts.length === 1 ? "" : "s"}`,
      text: context.experts.length > 0
        ? "Recruit specialists or pay those already in your circle for direct instruction."
        : "No major cultivation experts are taking direct students in this city right now.",
      tags: [
        context.recruitedExperts.length > 0 ? `Recruited ${context.recruitedExperts.length}` : "No Recruited Experts",
        context.experts.length > 0 ? context.experts.map((expert) => expert.focus).join(" · ") : "Quiet Hall"
      ]
    }
  };
  const bucketActions = [...(context.buckets[bucketKey] || [])];
  bucketActions.push({
    label: "Back To City Affairs",
    desc: "Return to the district overview.",
    tone: "",
    onChoose: () => {
      openCityActionPanel(state);
      return { success: true, close: false };
    }
  });
  openInteractionPanel(state, {
    ...config[bucketKey],
    actions: bucketActions
  });
}

function openCityActionPanel(state) {
  const context = buildCityActionBuckets(state);
  const featured = getFeaturedEvents(state, 3).map((event) => prepareEventEncounter(state, event));
  const actions = [
    {
      label: "Faction Affairs",
      desc: `${context.buckets.faction.length} option${context.buckets.faction.length === 1 ? "" : "s"} for guild dues, sect favors, hunts, and court business.`,
      tone: context.hunt ? "good" : "",
      onChoose: () => {
        openCityBucketPanel(state, "faction");
        return { success: true, close: false };
      }
    },
    {
      label: "City Services",
      desc: `${context.buckets.services.length} option${context.buckets.services.length === 1 ? "" : "s"} covering recovery, chambers, crafting, auctions, and caches.`,
      tone: "",
      onChoose: () => {
        openCityBucketPanel(state, "services");
        return { success: true, close: false };
      }
    },
    {
      label: "Expert Hall",
      desc: context.experts.length > 0
        ? `${context.experts.length} local expert${context.experts.length === 1 ? "" : "s"}, ${context.recruitedExperts.length} already in your circle.`
        : "No local experts are openly taking work here right now.",
      tone: context.experts.length > 0 || context.recruitedExperts.length > 0 ? "good" : "",
      onChoose: () => {
        openCityBucketPanel(state, "experts");
        return { success: true, close: false };
      }
    },
    {
      label: "Rumor Board",
      desc: featured.length > 0
        ? featured.map((event) => event.title).join(" | ")
        : "No strong leads are posted right now.",
      tone: featured.some((event) => event.battle) ? "warn" : "",
      onChoose: () => {
        openCityRumorBoard(state);
        return { success: true, close: false };
      }
    }
  ];

  openInteractionPanel(state, {
    title: `${context.city.name} City Affairs`,
    subtitle: `${context.region.name} · ${context.guild.name} · ${context.sect.name}`,
    text: "Handle city life by district instead of one long action wall. Faction work, services, experts, and rumors are split so you can read the city faster.",
    tags: [
      `Guild ${state.guildMember ? `${state.guildStanding} ${getStandingLabel(state.guildStanding)}` : "Unaffiliated"}`,
      `Sect ${state.sectAffiliation ? `${state.sectStanding} ${getStandingLabel(state.sectStanding)}` : "Unaffiliated"}`,
      context.hunt ? `Active Hunt ${context.hunt.progress}/${context.hunt.targetKills}` : "No Active Hunt",
      context.recruitedExperts.length > 0 ? `Experts ${context.recruitedExperts.length}` : `${context.experts.length} Local Expert${context.experts.length === 1 ? "" : "s"}`
    ],
    actions
  });
}

function openCultivationMaterialPanel(state, action, selectedItemIds = []) {
  const techniqueId = getActiveTechniqueIdForAction(state, action);
  const tpl = getTechniqueTemplate(techniqueId);
  if (!tpl) {
    return startActiveAction(state, action);
  }

  const chosenPlans = selectedItemIds.map((itemId) => buildCultivationMaterialPlan(tpl, itemId)).filter(Boolean);
  const plans = getTechniqueMaterialPlans(state, tpl, selectedItemIds);
  const allowsImprovisedBlend = tpl.pillar === "body";
  const actionTitle = action === "meditate"
    ? "Meditation Infusion"
    : action === "trainBody"
      ? "Body Refinement Infusion"
      : "Spirit Refinement Infusion";

  const actions = [];

  if (chosenPlans.length > 0) {
    actions.push({
      label: `Begin With ${chosenPlans.length} Material${chosenPlans.length > 1 ? "s" : ""}`,
      desc: `${summarizeCultivationBlend(chosenPlans)} Start this cycle now.`,
      tone: "good",
      onChoose: () => ({
        success: startActiveAction(state, action, { catalystPlans: chosenPlans }),
        consumeTurn: true,
        actionName: action,
        cooldownBonus: 0
      })
    });
    actions.push({
      label: "Remove Last Material",
      desc: `Drop ${chosenPlans[chosenPlans.length - 1].label} from this blend.`,
      tone: "",
      onChoose: () => {
        openCultivationMaterialPanel(state, action, selectedItemIds.slice(0, -1));
        return { success: true, close: false };
      }
    });
  } else {
    actions.push({
      label: "Proceed Without Material",
      desc: "Cultivate with no catalyst infusion.",
      tone: "",
      onChoose: () => ({
        success: startActiveAction(state, action),
        consumeTurn: true,
        actionName: action,
        cooldownBonus: 0
      })
    });
  }

  plans.slice(0, 10).forEach((plan) => actions.push({
    label: `${plan.recommended ? "Recommended: " : "Add "}${plan.label} x${plan.remaining}`,
    desc: `${plan.successRate}% success · ${plan.effectPercent}% catalyst yield · Mods: ${formatBonusSummary(plan.bonuses || {})} · ${plan.effect}`,
    tone: plan.successRate >= 80 ? "good" : plan.successRate >= 65 ? "" : "warn",
    onChoose: () => {
      openCultivationMaterialPanel(state, action, [...selectedItemIds, plan.itemId]);
      return { success: true, close: false };
    }
  }));

  actions.push({
    label: "Back Out",
    desc: "Leave the blend unchanged and do nothing.",
    tone: "",
    onChoose: () => ({ success: false, close: true })
  });

  openInteractionPanel(state, {
    title: `${tpl.label} · ${actionTitle}`,
    subtitle: `${tpl.grade || "Unknown"} · ${tpl.pillar === "body" ? "Body" : "Soul"} Method`,
    text: plans.length > 0 || chosenPlans.length > 0
      ? (allowsImprovisedBlend
        ? `This body-rebuilding method can be reinforced with extra materials. Recommended catalysts fit ${tpl.label} best, while ore, cores, herbs, and other materials can still be blended in to harden the body in rougher ways. Current blend: ${chosenPlans.map((plan) => plan.label).join(", ") || "none"}.`
        : `This method only accepts its listed compatible catalysts. Current selection: ${chosenPlans.map((plan) => plan.label).join(", ") || "none"}.`)
      : (allowsImprovisedBlend
        ? "You have no usable body-refining materials on hand right now. You can still cultivate without a blend."
        : "You do not currently have any compatible listed catalysts for this method. You can still cultivate without one."),
    tags: [tpl.category, ...(chosenPlans.length > 0 ? chosenPlans.map((plan) => plan.label).slice(0, 3) : plans.map((plan) => plan.label).slice(0, 3))],
    checkNote: chosenPlans.length > 0
      ? (allowsImprovisedBlend
        ? `${summarizeCultivationBlend(chosenPlans)} Selected modifiers: ${chosenPlans.map((plan) => `${plan.label} [${formatBonusSummary(plan.bonuses || {})}]`).join(" | ")}. Recommended materials are safer; improvised body blends trade safety for harsher physique gains.`
        : `${summarizeCultivationBlend(chosenPlans)} Selected modifiers: ${chosenPlans.map((plan) => `${plan.label} [${formatBonusSummary(plan.bonuses || {})}]`).join(" | ")}. Soul methods stay limited to their listed compatible catalysts.`)
      : (plans.length > 0
        ? (allowsImprovisedBlend
          ? "Add one or more materials. Each choice shows success chance, yield, and direct modifiers. Recommended materials are safer; improvised body blends trade safety for harsher physique gains."
          : "Only the listed compatible catalysts make sense for this method, and each one now lists its direct modifiers." )
        : (allowsImprovisedBlend
          ? "Gather ore, herbs, cores, poison reagents, or other body-refining materials to build a blend."
          : "Gather one of this method's listed catalysts if you want to refine it with extra materials.")),
    actions
  });
  return false;
}

function attemptBreakthrough(state) {
  const finalRealmIndex = GAME_CONSTANTS.realms.length - 1;
  const finalStageIndex = GAME_CONSTANTS.realms[finalRealmIndex].stages.length - 1;
  if (state.realmIndex === finalRealmIndex && state.stageIndex === finalStageIndex) {
    pushLog(state, "You are already at the current prototype cap.", "bad");
    return false;
  }

  // Minimum 60% qi required to even attempt
  const minRequired = Math.floor(state.qiMax * 0.60);
  if (state.qi < minRequired) {
    pushLog(state, `Breakthrough requires at least 60% qi (${minRequired}). You have ${state.qi}/${state.qiMax}.`, "bad");
    return false;
  }

  // ── Base success rate by qi fill tier ──────────────────────
  const qiPct = state.qi / state.qiMax;
  let baseChance;
  let tierLabel;
  if (qiPct >= 1.0) {
    baseChance = 0.78; tierLabel = "Full Condensation";
  } else if (qiPct >= 0.90) {
    baseChance = 0.57; tierLabel = "Primed";
  } else if (qiPct >= 0.75) {
    baseChance = 0.36; tierLabel = "Ready";
  } else {
    baseChance = 0.18; tierLabel = "Straining";
  }

  // Comprehension bonus (caps at +18%)
  const totalComp = (state.stats.comprehension + (state.stats.comprehensionBonus || 0));
  const compBonus = Math.min(0.18, totalComp * 0.005);

  // Failure focus boost — each prior failure on this stage adds +15%, max 2 stacks
  const failStacks = Math.min(2, state.breakthroughFailureBoost || 0);
  const failBonus = failStacks * 0.15;

  // Omen permit bonus
  const omenBonus = state.breakthroughPermit ? 0.12 : 0;
  if (state.breakthroughPermit) {
    pushLog(state, "A breakthrough omen is consumed.", "good");
    state.breakthroughPermit = false;
  }

  const successChance = Math.min(0.95, baseChance + compBonus + failBonus + omenBonus);

  if (Math.random() < successChance) {
    // ── SUCCESS ──────────────────────────────────────────────
    const qiCost = Math.floor(state.qiMax * 0.35);
    state.qi = Math.max(0, state.qi - qiCost);
    const realm = GAME_CONSTANTS.realms[state.realmIndex];
    state.stageIndex += 1;
    if (state.stageIndex >= realm.stages.length) {
      state.stageIndex = 0;
      state.realmIndex += 1;
    }
    state.stats.physique += 1;
    state.stats.soulSense += 1;
    state.breakthroughFailureBoost = 0;
    recalculateDerivedStats(state);
    state.hp = Math.min(state.hpMax, state.hp + 15);
    state.longevityCurrent = Math.min(state.longevityMax, state.longevityCurrent + 25);
    pushLog(state, `Breakthrough! [${tierLabel} — ${Math.round(successChance * 100)}% chance] Entered ${getRealmStageLabel(state)}.`, "good");
    return true;
  }

  // ── FAILURE ──────────────────────────────────────────────
  const qiLoss = Math.floor(state.qi * (0.20 + Math.random() * 0.10));
  const hpLoss = 12 + Math.floor(Math.random() * 14);
  const longevityLoss = 2 + Math.floor(Math.random() * 3);
  state.qi = Math.max(0, state.qi - qiLoss);
  state.hp = Math.max(1, state.hp - hpLoss);
  state.longevityCurrent = Math.max(1, state.longevityCurrent - longevityLoss);

  // Grant failure boost for next attempt on this stage (max 2 stacks)
  state.breakthroughFailureBoost = Math.min(2, failStacks + 1);
  const nextChance = Math.min(0.95, successChance + 0.15);
  pushLog(state, `Backlash! [${tierLabel} — was ${Math.round(successChance * 100)}%] Lost ${qiLoss} qi and ${hpLoss} HP. Will refined — next attempt ≈${Math.round(nextChance * 100)}% (+${Math.round(failBonus * 100 + 15)}% total focus boost).`, "bad");
  return true;
}

function runEvent(state) {
  const eligible = getEligibleEvents(state);

  if (eligible.length === 0) {
    pushLog(state, "No valid events available right now.", "bad");
    return false;
  }

  const event = pickWeighted(eligible, (item) => getRarityWeight(getEventRarity(item)));
  openEventInteraction(state, event, () => openCityActionPanel(state));
  return false;
}

function runCityEncounter(state) {
  openCityActionPanel(state);
  return false;
}

function exploreCurrentArea(state) {
  const area = getCurrentArea(state);
  if (!area) {
    pushLog(state, "No exploration area is available in this region.", "bad");
    return false;
  }
  if (area.regionId !== state.currentRegionId) {
    pushLog(state, "Travel to that region before exploring this area.", "bad");
    return false;
  }

  // Exploration costs no qi — the soul realm fills the cultivator passively.
  // Danger influences encounter chance and rewards only.
  const hunt = getCurrentHuntContract(state);
  const huntBoost = hunt && hunt.areaId === area.id ? 24 : 0;
  const roll = Math.floor(Math.random() * 100);
  if (roll < 18 + area.danger * 5 + huntBoost) {
    pushLog(state, `${area.name}: hostile encounter ignites${huntBoost > 0 ? " — contract prey sighted" : ""}!`, "bad");
    return startBattle(state);
  }

  if (area.focus === "herb") {
    const left = addItemToInventory(state, "spirit-herb", 2 + Math.floor(Math.random() * 3));
    pushLog(state, left > 0 ? `${area.name}: herbs found, but ${left} overflowed inventory.` : `${area.name}: harvested rare spirit herbs.`, left > 0 ? "bad" : "good");
    return true;
  }

  if (area.focus === "ore" || area.focus === "array") {
    const itemId = area.focus === "array" ? "array-ore" : "blood-jade";
    const left = addItemToInventory(state, itemId, 1 + Math.floor(Math.random() * 3));
    state.wallet += 8 + area.danger * 4;
    pushLog(state, left > 0 ? `${area.name}: materials found, ${left} overflowed inventory.` : `${area.name}: extracted valuable materials.`, left > 0 ? "bad" : "good");
    return true;
  }

  if (area.focus === "void") {
    const left = addItemToInventory(state, "void-lotus", 1 + Math.floor(Math.random() * 2));
    state.qi = Math.min(state.qiMax, state.qi + 14 + area.danger * 3);
    pushLog(state, left > 0 ? `${area.name}: void lotuses were gathered, but ${left} overflowed inventory.` : `${area.name}: void lotuses and thin-space insight reward your route.`, left > 0 ? "bad" : "good");
    return true;
  }

  if (area.focus === "saint") {
    const left = addItemToInventory(state, "saint-bone-fragment", 1 + Math.floor(Math.random() * 2));
    state.hp = Math.min(state.hpMax, state.hp + 10 + area.danger * 3);
    state.battleQi = Math.min(state.battleQiMax, state.battleQi + 10 + area.danger * 2);
    pushLog(state, left > 0 ? `${area.name}: saint remains were found, but ${left} overflowed inventory.` : `${area.name}: saint remnants temper your body and fill your battle channels.`, left > 0 ? "bad" : "good");
    return true;
  }

  if (area.focus === "immortal") {
    const left = addItemToInventory(state, "immortal-dew", 1 + Math.floor(Math.random() * 2));
    state.hp = Math.min(state.hpMax, state.hp + 18 + area.danger * 3);
    state.qi = Math.min(state.qiMax, state.qi + 18 + area.danger * 4);
    pushLog(state, left > 0 ? `${area.name}: immortal dew condensed, but ${left} overflowed inventory.` : `${area.name}: immortal dew restores both body and spirit.`, left > 0 ? "bad" : "good");
    return true;
  }

  if (area.focus === "dao") {
    const left = addItemToInventory(state, "dao-crystal", 1 + Math.floor(Math.random() * 2));
    state.stats.comprehension += 1;
    state.wallet += 16 + area.danger * 8;
    pushLog(state, left > 0 ? `${area.name}: dao crystals were uncovered, but ${left} overflowed inventory.` : `${area.name}: dao crystals and law-fragments sharpen your understanding.`, left > 0 ? "bad" : "good");
    return true;
  }

  if (area.focus === "spiritlord") {
    const drops = [];
    drops.push(Math.random() < 0.5 ? { id: "ancestral-spirit-incense", qty: 1 } : { id: "soul-forge-nectar", qty: 1 });
    if (Math.random() < 0.28) {
      drops.push({ id: Math.random() < 0.5 ? "dao-crystal" : "immortal-dew", qty: 1 });
    }
    if (Math.random() < 0.18) {
      const vesselId = rollSpiritVesselDrop();
      if (vesselId) {
        drops.push({ id: vesselId, qty: 1 });
      }
    }

    let overflow = 0;
    drops.forEach((drop) => {
      overflow += addItemToInventory(state, drop.id, drop.qty);
    });
    state.qi = Math.min(state.qiMax, state.qi + 14 + area.danger * 4);
    state.battleQi = Math.min(state.battleQiMax, state.battleQi + 10 + area.danger * 2);
    const labels = drops.map((drop) => `${getItemTemplate(drop.id)?.label || drop.id} x${drop.qty}`).join(", ");
    pushLog(
      state,
      overflow > 0
        ? `${area.name}: ancestral spirit echoes yield ${labels}, but ${overflow} item${overflow === 1 ? "" : "s"} overflowed inventory.`
        : `${area.name}: spirit mausoleum echoes yield ${labels}, and the altars refill your channels.`,
      overflow > 0 ? "bad" : "good"
    );
    return true;
  }

  if (area.focus === "relic") {
    state.stats.comprehension += 1;
    state.stats.soulSense += 1;
    state.legacyNotes += 1;
    state.wallet += 10 + area.danger * 6;
    pushLog(state, `${area.name}: relic fragments grant insight.`, "good");
    return true;
  }

  if (area.focus === "spirit") {
    state.qi += 12 + area.danger * 3;
    state.battleQi = Math.min(state.battleQiMax, state.battleQi + 8);
    pushLog(state, `${area.name}: spirit tides replenish your channels.`, "good");
    return true;
  }

  state.wallet += 6 + area.danger * 3;
  state.stats.fortune += 1;
  pushLog(state, `${area.name}: exploration yields clues and profit.`, "good");
  return true;
}

function dangerToScale(regionDanger) {
  if (regionDanger === "Low") {
    return 0;
  }
  if (regionDanger === "Low-Mid") {
    return 1;
  }
  if (regionDanger === "Mid") {
    return 2;
  }
  if (regionDanger === "High") {
    return 3;
  }
  if (regionDanger === "Extreme") {
    return 4;
  }
  if (regionDanger === "Cataclysmic") {
    return 5;
  }
  return 3;
}

function startBattle(state, options = {}) {
  if (state.battle) {
    pushLog(state, "Already in battle.", "bad");
    return false;
  }
  const qiCost = Number.isFinite(options.qiCost) ? Math.max(0, options.qiCost) : 10;
  if (state.qi < qiCost) {
    pushLog(state, `Need at least ${qiCost} qi to begin battle.`, "bad");
    return false;
  }

  const region = getCurrentRegion(state);
  const area = getCurrentArea(state);
  const scale = dangerToScale(region.danger) + (area ? area.danger : 0);
  const tier = state.realmIndex * 30 + state.stageIndex * 12 + scale * 25;
  const enemyHpMax = Math.max(40, Math.round((90 + tier + Math.floor(Math.random() * 30)) * Number(options.hpScale || 1)));
  const enemyQiMax = Math.max(20, Math.round((40 + Math.floor(tier * 0.45)) * Number(options.qiScale || 1)));

  state.qi -= qiCost;
  const hunt = getCurrentHuntContract(state);
  const profile = hunt && hunt.areaId === state.currentAreaId
    ? { targetName: hunt.targetName }
    : getAreaHuntProfile(area);
  state.battle = {
    enemyName: options.enemyName || profile.targetName || `${area ? area.short : region.name} Beast`,
    enemyHp: enemyHpMax,
    enemyHpMax,
    enemyQi: enemyQiMax,
    enemyQiMax,
    forcedLootFocus: options.lootFocus || null,
    defending: false,
    spiritAssistRound: 0,
    round: 1
  };

  openPanel(document.getElementById("battle-modal"));
  pushLog(state, `Battle started against ${state.battle.enemyName}.`, "good");
  return true;
}

function generateBattleLoot(state, focusOverride = null) {
  const area = getCurrentArea(state);
  const drops = [];
  const dropCount = 1 + Math.floor(Math.random() * 2);
  const materialPools = {
    beasts: ["spirit-herb", "beast-core", "blood-jade", "venom-gland"],
    ore: ["black-iron-ore", "array-ore", "embersteel-ingot", "stormglass-shard"],
    spirit: ["spirit-herb", "moon-dew-fungus", "soul-amber", "cloud-silk", "grave-bloom"],
    spiritlord: ["ancestral-spirit-incense", "soul-forge-nectar", "dao-crystal", "immortal-dew"],
    relic: ["array-ore", "soul-amber", "stormglass-shard", "blood-jade"],
    ambush: ["beast-core", "blood-jade", "black-iron-ore", "venom-gland"],
    void: ["void-lotus", "soul-amber", "stormglass-shard", "array-ore"],
    saint: ["saint-bone-fragment", "void-lotus", "embersteel-ingot", "immortal-dew"],
    immortal: ["immortal-dew", "dao-crystal", "void-lotus", "saint-bone-fragment"],
    dao: ["dao-crystal", "immortal-dew", "void-lotus", "soul-amber"]
  };
  const poolByFocus = {
    beasts: materialPools.beasts,
    ore: materialPools.ore,
    herb: materialPools.spirit,
    spirit: materialPools.spirit,
    spiritlord: materialPools.spiritlord,
    relic: materialPools.relic,
    ambush: materialPools.ambush,
    array: materialPools.relic,
    void: materialPools.void,
    saint: materialPools.saint,
    immortal: materialPools.immortal,
    dao: materialPools.dao
  };
  const focusPool = poolByFocus[focusOverride || area?.focus] || materialPools.beasts;
  for (let i = 0; i < dropCount; i += 1) {
    const itemId = focusPool[Math.floor(Math.random() * focusPool.length)];
    drops.push({ id: itemId, qty: 1 + Math.floor(Math.random() * (area?.danger >= 3 ? 2 : 1)) });
  }
  const scrollEligible = ["ruins", "rift", "battlefield", "anomaly", "chasm"].includes(area?.type);
  if (scrollEligible && Math.random() < (0.015 + (area?.danger || 0) * 0.006)) {
    drops.push({ id: getRandomTechniqueScrollId(state), qty: 1 });
  }
  if (scrollEligible && Math.random() < (0.01 + (area?.danger || 0) * 0.004)) {
    const battleScrolls = GAME_CONSTANTS.inventoryTemplates.filter((item) => item.id.startsWith("battle-scroll-"));
    const battleScroll = battleScrolls[Math.floor(Math.random() * battleScrolls.length)];
    drops.push({ id: battleScroll.id, qty: 1 });
  }
  if ((focusOverride || area?.focus) === "spiritlord" && Math.random() < 0.22) {
    const vesselId = rollSpiritVesselDrop();
    if (vesselId) {
      drops.push({ id: vesselId, qty: 1 });
    }
  }
  state.pendingLoot = drops;
  state.ui.manualLootIndex = null;
}

function resolveEnemyTurn(state) {
  if (!state.battle) {
    return;
  }

  // Meridian Lock skips enemy attack
  if (state.battle.skipEnemyTurn) {
    state.battle.skipEnemyTurn = false;
    pushLog(state, `${state.battle.enemyName}'s attack is disrupted by the Meridian Lock!`, "good");
    return;
  }

  const enemyDamageBase = 10 + state.realmIndex * 4 + state.stageIndex * 2;
  let damage = enemyDamageBase + Math.floor(Math.random() * 12);
  if (state.battle.defending) {
    damage = Math.floor(damage * 0.45);
  }
  state.battle.defending = false;
  state.hp = Math.max(0, state.hp - damage);
  state.battle.enemyQi = Math.max(0, state.battle.enemyQi - 3);
  pushLog(state, `${state.battle.enemyName} hits you for ${damage}.`, "bad");

  if (state.hp <= 0) {
    state.hp = 1;
    state.qi = Math.max(0, state.qi - 25);
    state.wallet = Math.max(0, state.wallet - 20);
    state.battle = null;
    clearPendingCityEncounterBattle(state);
    pushLog(state, "You collapsed and escaped with losses.", "bad");
  }
}

function finishBattleVictory(state) {
  const lootFocus = state.battle?.forcedLootFocus || null;
  state.wallet += 12 + state.realmIndex * 4 + state.stageIndex * 2;
  state.stats.physique += 1;
  state.stats.soulSense += 1;
  const hunt = getCurrentHuntContract(state);
  if (hunt && hunt.areaId === state.currentAreaId) {
    hunt.progress += 1;
    if (hunt.progress >= hunt.targetKills) {
      pushLog(state, `${hunt.issuerName}: hunt complete. Return to ${getCurrentCity(state).name} to claim payment.`, "good");
    } else {
      pushLog(state, `${hunt.issuerName} hunt progress: ${hunt.progress}/${hunt.targetKills} ${hunt.targetName}${hunt.targetKills > 1 ? "s" : ""} in ${hunt.areaName}.`, "good");
    }
  }
  applyPendingCityEncounterReward(state);
  state.battle = null;
  generateBattleLoot(state, lootFocus);
  recalculateDerivedStats(state);
  pushLog(state, "Battle won. Loot dropped.", "good");
  closePanel(document.getElementById("battle-modal"));
  openPanel(document.getElementById("loot-modal"));
}

function battleAction(state, action, options = {}) {
  if (!state.battle) {
    pushLog(state, "No active battle.", "bad");
    return false;
  }

  const bodyLvl = getBodyLevel(state);
  const soulLvl = getSoulLevel(state);
  const baseDamage = 14 + state.stats.physique + bodyLvl * 2;

  if (action === "battleAttack") {
    const damage = baseDamage + Math.floor(Math.random() * 14);
    state.battle.enemyHp -= damage;
    state.battleQi = Math.min(state.battleQiMax, state.battleQi + 8);
    pushLog(state, `You strike for ${damage}.`, "good");
  } else if (action === "useBattleTech") {
    const techId = options.techId;
    if (!techId) { pushLog(state, "No technique selected.", "bad"); return false; }
    const tpl = getBattleTechTemplate(techId);
    if (!tpl) { pushLog(state, "Unknown battle art.", "bad"); return false; }
    if (!state.learnedBattleTechniques?.[techId]) { pushLog(state, "You haven't mastered this art.", "bad"); return false; }
    if (state.battleQi < tpl.qiCost) { pushLog(state, `Need ${tpl.qiCost} battle qi for ${tpl.label}.`, "bad"); return false; }

    state.battleQi -= tpl.qiCost;
    const qiScaling = Math.floor(state.qi * 0.06) + Math.floor(state.qiMax * 0.015);
    let damage = tpl.baseDmg
      + Math.floor(state.stats.physique * (tpl.physMult || 1.0))
      + Math.floor(state.stats.soulSense * (tpl.soulMult || 0))
      + qiScaling
      + Math.floor(Math.random() * 10);
    state.battle.enemyHp -= damage;
    pushLog(state, `${tpl.label}: ${damage} damage. Qi within your meridians amplifies the strike.`, "good");

    // Handle special effects
    switch (tpl.special) {
      case "evade":
        state.battle.defending = true;
        pushLog(state, "Shadow Step: you slip aside, reducing next hit.", "good");
        break;
      case "fortify":
        state.battle.defending = true;
        state.battleQi = Math.min(state.battleQiMax, state.battleQi + 8);
        pushLog(state, "Iron Bell Guard: qi shell absorbs impact.", "good");
        break;
      case "drain-qi":
        state.battle.enemyQi = Math.max(0, state.battle.enemyQi - 18);
        pushLog(state, "Thunder Palm: enemy qi disrupted.", "good");
        break;
      case "longevity-cost":
        state.longevityCurrent = Math.max(1, state.longevityCurrent - 4);
        pushLog(state, "Life burns like fuel — brutal but scorching.", "bad");
        break;
      case "skip-enemy-turn":
        state.battle.skipEnemyTurn = true;
        pushLog(state, "Meridian Lock seizes their channels.", "good");
        break;
      case "bqi-regen":
        state.battleQi = Math.min(state.battleQiMax, state.battleQi + 12);
        pushLog(state, "Predator Stance: combat qi surges.", "good");
        break;
      default:
        break;
    }
  } else if (action === "battleDefend") {
    state.battle.defending = true;
    state.battleQi = Math.min(state.battleQiMax, state.battleQi + 5);
    pushLog(state, "You defend and gather battle qi.", "good");
  } else if (action === "battleFlee") {
    const chance = 35 + state.stats.fortune + soulLvl * 2;
    if (Math.floor(Math.random() * 100) < chance) {
      state.battle = null;
      clearPendingCityEncounterBattle(state);
      pushLog(state, "You escaped battle.", "good");
      closePanel(document.getElementById("battle-modal"));
      return true;
    }
    pushLog(state, "Flee attempt failed.", "bad");
  }

  resolveSpiritAssist(state);

  if (state.battle && state.battle.enemyHp <= 0) {
    finishBattleVictory(state);
    return true;
  }

  resolveEnemyTurn(state);
  if (state.battle) {
    state.battle.round += 1;
  }
  return true;
}

function travelRegion(state, targetRegionId) {
  const target = GAME_CONSTANTS.regions.find((region) => region.id === targetRegionId);
  if (!target) {
    pushLog(state, "Unknown region.", "bad");
    return false;
  }
  if (target.id === state.currentRegionId) {
    pushLog(state, `You are already in ${target.name}.`, "bad");
    return false;
  }
  if (!isRegionAdjacent(state, target.id)) {
    pushLog(state, `${target.name} is not directly connected to current region.`, "bad");
    return false;
  }
  if (state.qi < 8) {
    pushLog(state, "Need 8 qi to cross region boundaries.", "bad");
    return false;
  }

  state.qi -= 8;
  state.currentRegionId = target.id;
  const cities = getCitiesForRegion(target.id);
  if (!cities.some((city) => city.id === state.currentCityId) && cities.length > 0) {
    state.currentCityId = cities[0].id;
  }
  const areas = getAreasForRegion(target.id);
  state.currentAreaId = areas.length > 0 ? areas[0].id : null;
  pushLog(state, `You entered ${target.name}.`, "good");
  return true;
}

function switchCity(state, cityId) {
  const city = GAME_CONSTANTS.cities.find((candidate) => candidate.id === cityId);
  if (!city) {
    pushLog(state, "Unknown city.", "bad");
    return false;
  }
  if (city.regionId !== state.currentRegionId) {
    pushLog(state, "Travel to that region first.", "bad");
    return false;
  }
  if (city.id === state.currentCityId) {
    pushLog(state, "Already in this city.", "bad");
    return false;
  }

  state.currentCityId = city.id;
  pushLog(state, `You relocated to ${city.name}.`, "good");
  return true;
}

function processActionSuccess(state, success, actionName, extraCooldown = 0) {
  if (!success) {
    return;
  }
  state.turn += 1;
  const debuffs = getActiveDebuffs(state);
  const overburdened = debuffs.find((debuff) => debuff.id === "overburdened");
  const cooldownPenalty = overburdened ? 1 : 0;
  setGlobalCooldown(state, extraCooldown + cooldownPenalty);
  if (overburdened) {
    pushLog(state, `Overburdened: ${overburdened.short}. Actions take longer until you lighten your load.`, "bad");
  }
  recalculateDerivedStats(state);
  normalizeInventorySize(state);
}

function canUseAction(state, action) {
  if (action === "save" || action === "reset" || action === "cancelAction") {
    return true;
  }
  if (globalCooldownRemaining(state) > 0) {
    return false;
  }

  if (state.activeAction && !action.startsWith("battle")) {
    return false;
  }

  if (state.battle && !action.startsWith("battle")) {
    return false;
  }

  if (!state.battle && action.startsWith("battle")) {
    return false;
  }

  return true;
}

function applyAction(state, action) {
  processActiveAction(state);

  if (!canUseAction(state, action)) {
    if (globalCooldownRemaining(state) > 0) {
      pushLog(state, `Global cooldown active: ${formatSeconds(globalCooldownRemaining(state))}.`, "bad");
    } else if (state.activeAction) {
      pushLog(state, "An active action is still in progress.", "bad");
    } else if (state.battle) {
      pushLog(state, "Battle must be resolved first.", "bad");
    }
    return;
  }

  if (action === "save") {
    saveState(state);
    return;
  }

  if (action === "cityAction" || action === "explore" || action === "cityEncounter") {
    openCityActionPanel(state);
    return;
  }

  if (action === "reset") {
    localStorage.removeItem(GAME_CONSTANTS.saveKey);
    const fresh = createInitialState();
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, deepClone(fresh));
    state.ui = {
      selectedSlot: null,
      manualLootIndex: null
    };
    pushLog(state, "Cycle reset. A new path begins.", "bad");
    return;
  }

  let success = false;
  let cooldownBonus = 0;

  if (action === "meditate" || action === "trainBody" || action === "trainSoul") {
    const openedSelection = openCultivationMaterialPanel(state, action);
    if (openedSelection === false) {
      return;
    }
    success = openedSelection;
    cooldownBonus = 0;
  } else if (action === "cancelAction") {
    if (state.activeAction) {
      pushLog(state, `${state.activeAction.action} cancelled.`, "bad");
      state.activeAction = null;
      success = true;
    }
    cooldownBonus = 0;
  } else if (action === "breakthrough") {
    const openedSelection = openBreakthroughMaterialPanel(state);
    if (openedSelection === false) {
      return;
    }
    success = openedSelection;
    cooldownBonus = 1;
  } else if (action === "sell") {
    success = sellHalfMaterials(state);
    cooldownBonus = 1;
  } else if (action === "bank") {
    success = depositSilver(state);
    cooldownBonus = 0;
  } else if (action === "withdraw") {
    success = withdrawSilver(state);
    cooldownBonus = 0;
  } else if (action === "buyRing") {
    success = acquireRing(state);
    cooldownBonus = 2;
  } else if (action === "buyHome") {
    success = acquireHome(state);
    cooldownBonus = 2;
  } else if (action === "exploreArea") {
    success = exploreCurrentArea(state);
    cooldownBonus = 1;
  } else if (action === "hunt") {
    success = startBattle(state);
    cooldownBonus = 1;
  } else if (action.startsWith("battle")) {
    success = battleAction(state, action);
    cooldownBonus = 0;
  }

  processActionSuccess(state, success, action, cooldownBonus);
}

function openPanel(node) {
  node.classList.remove("hidden");
  node.setAttribute("aria-hidden", "false");
}

function closePanel(node) {
  node.classList.add("hidden");
  node.setAttribute("aria-hidden", "true");
}

function renderInteractionPanel(state) {
  const panel = document.getElementById("interaction-modal");
  const title = document.getElementById("interaction-title");
  const subtitle = document.getElementById("interaction-subtitle");
  const text = document.getElementById("interaction-text");
  const tags = document.getElementById("interaction-tags");
  const check = document.getElementById("interaction-check");
  const actions = document.getElementById("interaction-actions");
  if (!panel || !title || !subtitle || !text || !tags || !check || !actions) {
    return;
  }

  const interaction = state.ui?.interaction;
  if (!interaction) {
    closePanel(panel);
    return;
  }

  openPanel(panel);
  title.textContent = interaction.title || "Interaction";
  subtitle.textContent = interaction.subtitle || "";
  subtitle.classList.toggle("hidden", !interaction.subtitle);
  text.textContent = interaction.text || "";
  text.classList.toggle("hidden", !interaction.text);

  tags.innerHTML = "";
  (interaction.tags || []).filter(Boolean).forEach((tagText) => {
    const chip = document.createElement("span");
    chip.className = "interaction-tag";
    chip.textContent = tagText;
    tags.appendChild(chip);
  });
  tags.classList.toggle("hidden", (interaction.tags || []).filter(Boolean).length === 0);

  if (interaction.checkNote) {
    check.textContent = interaction.checkNote;
    check.classList.remove("hidden");
  } else {
    check.textContent = "";
    check.classList.add("hidden");
  }

  actions.innerHTML = "";
  (interaction.actions || []).forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `interaction-action${action.tone ? ` ${action.tone}` : ""}`;
    button.disabled = Boolean(action.disabled);
    button.innerHTML = `<strong>${action.label}</strong><span>${action.desc || ""}</span>`;
    button.addEventListener("click", () => {
      if (button.disabled || typeof action.onChoose !== "function") {
        return;
      }
      handleInteractionChoice(state, action.onChoose(state));
    });
    actions.appendChild(button);
  });
}

function setupDraggable(panelId, handleId) {
  const panel = document.getElementById(panelId);
  const handle = document.getElementById(handleId);
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener("mousedown", (event) => {
    dragging = true;
    const rect = panel.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
  });

  document.addEventListener("mousemove", (event) => {
    if (!dragging) {
      return;
    }
    panel.style.left = `${Math.max(0, event.clientX - offsetX)}px`;
    panel.style.top = `${Math.max(0, event.clientY - offsetY)}px`;
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });
}

function renderInventoryList(state) {
  const node = document.getElementById("inventory-list");
  if (!node) return;
  node.innerHTML = "";
  state.inventorySlots.forEach((stack) => {
    if (!stack) {
      return;
    }
    const template = getInventoryTemplate(stack.id);
    const li = document.createElement("li");
    li.textContent = `${template.label} x${stack.qty} (w:${template.weight}, v:${template.value})`;
    node.appendChild(li);
  });
}

function renderInventoryGrid(state) {
  const grid = document.getElementById("inventory-grid");
  const popover = document.getElementById("inventory-detail-popover");
  grid.innerHTML = "";

  state.inventorySlots.forEach((stack, idx) => {
    const slot = document.createElement("div");
    slot.className = `slot ${stack ? "" : "empty"}`;
    if (state.ui.selectedSlot === idx) {
      slot.classList.add("selected");
    }
    if (state.pendingLoot.length > 0) {
      slot.classList.add("loot-target");
    }
    slot.dataset.index = String(idx);
    slot.draggable = true;
    const isScroll = stack && stack.id.startsWith("scroll-");
    const isBScroll = stack && stack.id.startsWith("battle-scroll-");
    const isEquipment = stack && isEquipmentItem(stack.id);
    const isSpiritVessel = stack && isSpiritVesselItem(stack.id);
    const showStudy = isScroll || isBScroll;
    slot.innerHTML = stack
      ? `<strong>Slot ${idx + 1}</strong>${getInventoryTemplate(stack.id).label}<br />x${stack.qty}${showStudy ? `<br /><button type="button" class="inv-learn-btn" data-slot="${idx}">${isBScroll ? "Master Battle Art" : "Study Scroll"}</button>` : ""}${isEquipment ? `<br /><button type="button" class="inv-equip-btn" data-slot="${idx}">Equip</button>` : ""}${isSpiritVessel ? `<br /><button type="button" class="inv-awaken-btn" data-slot="${idx}">Awaken Spirit</button>` : ""}`
      : `<strong>Slot ${idx + 1}</strong>Empty`;

    slot.addEventListener("click", () => {
      if (state.pendingLoot.length > 0 && Number.isInteger(state.ui.manualLootIndex)) {
        const loot = state.pendingLoot[state.ui.manualLootIndex];
        if (loot) {
          const left = addItemToInventory(state, loot.id, loot.qty, idx);
          if (left === 0) {
            state.pendingLoot.splice(state.ui.manualLootIndex, 1);
            if (state.pendingLoot.length === 0) {
              closePanel(document.getElementById("loot-modal"));
            }
          } else {
            loot.qty = left;
          }
          render(state);
          return;
        }
      }

      if (state.ui.selectedSlot === null) {
        state.ui.selectedSlot = idx;
      } else {
        const from = state.ui.selectedSlot;
        const temp = state.inventorySlots[from];
        state.inventorySlots[from] = state.inventorySlots[idx];
        state.inventorySlots[idx] = temp;
        state.ui.selectedSlot = null;
      }
      render(state);
    });

    slot.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", String(idx));
    });
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      const from = Number(event.dataTransfer.getData("text/plain"));
      if (!Number.isInteger(from) || from === idx) {
        return;
      }
      const temp = state.inventorySlots[from];
      state.inventorySlots[from] = state.inventorySlots[idx];
      state.inventorySlots[idx] = temp;
      render(state);
    });

    grid.appendChild(slot);
  });

  // Wire Study Scroll buttons (after all slots are in the DOM)
  grid.querySelectorAll(".inv-learn-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation(); // don't trigger the slot swap handler
      const slotIdx = Number(btn.dataset.slot);
      const stack = state.inventorySlots[slotIdx];
      if (!stack) return;
      const techId = getTechniqueIdFromScrollId(stack.id);
      if (!techId) return;
      const success = isBattleScroll(stack.id)
        ? learnBattleTechnique(state, techId)
        : learnNewTechnique(state, techId);
      if (success) {
        stack.qty -= 1;
        if (stack.qty <= 0) state.inventorySlots[slotIdx] = null;
      }
      render(state);
    });
  });

  grid.querySelectorAll(".inv-equip-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const slotIdx = Number(btn.dataset.slot);
      const stack = state.inventorySlots[slotIdx];
      if (!stack || !isEquipmentItem(stack.id)) return;
      equipOwnedEquipment(state, stack.id);
      render(state);
    });
  });

  grid.querySelectorAll(".inv-awaken-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const slotIdx = Number(btn.dataset.slot);
      useInventoryItem(state, slotIdx);
      render(state);
    });
  });

  if (!popover) {
    return;
  }
  const selectedIdx = state.ui.selectedSlot;
  const selectedStack = Number.isInteger(selectedIdx) ? state.inventorySlots[selectedIdx] : null;
  if (!selectedStack) {
    popover.classList.add("hidden");
    popover.innerHTML = "";
    return;
  }

  const template = getInventoryTemplate(selectedStack.id);
  const slotNode = grid.querySelector(`[data-index="${selectedIdx}"]`);
  if (!template || !slotNode) {
    popover.classList.add("hidden");
    popover.innerHTML = "";
    return;
  }

  const canUse = Boolean(getConsumableEffect(selectedStack.id));
  const canEquip = isEquipmentItem(selectedStack.id);
  const canAwakenSpirit = isSpiritVesselItem(selectedStack.id);
  const canSell = template.value > 0;
  popover.classList.remove("hidden");
  popover.innerHTML = `
    <h4>${template.label}</h4>
    <div class="inventory-detail-meta">Qty ${selectedStack.qty} | Weight ${template.weight} | Sell ${template.value} silver</div>
    <p>${getItemDescription(template)}</p>
    <div class="button-row inventory-detail-actions">
      ${canEquip ? `<button type="button" data-equip-slot="${selectedIdx}">Equip</button>` : ""}
      ${canAwakenSpirit ? `<button type="button" data-awaken-slot="${selectedIdx}">Awaken Spirit</button>` : ""}
      ${canUse ? `<button type="button" data-use-slot="${selectedIdx}">Use</button>` : ""}
      ${canSell ? `<button type="button" data-sell-one="${selectedIdx}">Sell 1</button><button type="button" data-sell-stack="${selectedIdx}">Sell Stack</button>` : ""}
    </div>
  `;
  const gridRect = grid.getBoundingClientRect();
  const slotRect = slotNode.getBoundingClientRect();
  popover.style.left = `${Math.max(0, Math.min(gridRect.width - 240, slotRect.left - gridRect.left + slotRect.width + 8))}px`;
  popover.style.top = `${Math.max(0, slotRect.top - gridRect.top)}px`;

  popover.querySelectorAll("button[data-use-slot]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      useInventoryItem(state, Number(button.dataset.useSlot));
      render(state);
    });
  });
  popover.querySelectorAll("button[data-equip-slot]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const idx = Number(button.dataset.equipSlot);
      const itemId = state.inventorySlots[idx]?.id;
      if (itemId) {
        equipOwnedEquipment(state, itemId);
      }
      render(state);
    });
  });
  popover.querySelectorAll("button[data-awaken-slot]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      useInventoryItem(state, Number(button.dataset.awakenSlot));
      render(state);
    });
  });
  popover.querySelectorAll("button[data-sell-one]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      sellInventoryItem(state, Number(button.dataset.sellOne), 1);
      render(state);
    });
  });
  popover.querySelectorAll("button[data-sell-stack]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const idx = Number(button.dataset.sellStack);
      const qty = state.inventorySlots[idx]?.qty || 1;
      sellInventoryItem(state, idx, qty);
      render(state);
    });
  });
}

function renderLoot(state) {
  const lootList = document.getElementById("loot-list");
  lootList.innerHTML = "";
  state.pendingLoot.forEach((stack, idx) => {
    const template = getItemTemplate(stack.id);
    const li = document.createElement("li");
    li.innerHTML = `${template.label} x${stack.qty} <button type="button" data-loot-index="${idx}">Manual Place</button>`;
    lootList.appendChild(li);
  });

  lootList.querySelectorAll("button[data-loot-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui.manualLootIndex = Number(button.getAttribute("data-loot-index"));
      openPanel(document.getElementById("inventory-modal"));
      render(state);
    });
  });
}

function renderEquipment(state) {
  const summary = document.getElementById("equipment-summary");
  const topline = document.getElementById("equipment-topline");
  const grid = document.getElementById("equipment-grid");
  const pack = document.getElementById("equipment-pack");
  const store = document.getElementById("equipment-store");

  const equipped = getEquippedItems(state);
  const summaryText = equipped.length > 0
    ? `Equipped: ${equipped.map((item) => item.label).join(", ")}`
    : "No equipment equipped.";
  
  if (summary) summary.textContent = summaryText;
  if (topline) topline.textContent = `${summaryText} Market: ${getCurrentCity(state).name}`;

  if (grid) {
    grid.innerHTML = "";
    Object.entries(state.equipment).forEach(([slot, equippedId]) => {
      const tile = document.createElement("div");
      tile.className = "equipment-tile equipment-slot-tile";
      const equippedItem = equippedId ? getEquipmentTemplate(equippedId) : null;
      tile.innerHTML = `<strong>${getEquipmentSlotLabel(slot)}</strong><div>${equippedItem ? equippedItem.label : "Empty"}</div><div class="equipment-bonuses">${equippedItem ? formatBonusSummary(equippedItem.bonuses || {}) : "No bonuses"}</div>`;
      if (equippedItem) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Unequip";
        button.addEventListener("click", () => {
          unequipSlot(state, slot);
          render(state);
        });
        tile.appendChild(button);
      }
      grid.appendChild(tile);
    });
  }

  if (pack) {
    pack.innerHTML = "";
    const equippedIds = getEquippedItemIdSet(state);
    const gearStacks = state.inventorySlots.filter((stack) => stack && isEquipmentItem(stack.id) && !equippedIds.has(stack.id));
    if (gearStacks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "equipment-empty-note";
      empty.textContent = "No spare gear in your carried pack.";
      pack.appendChild(empty);
    } else {
      gearStacks.forEach((stack) => {
        const item = getEquipmentTemplate(stack.id);
        const tile = document.createElement("div");
        tile.className = "equipment-tile";
        tile.innerHTML = `<strong>${item.label}</strong><div>Slot: ${getEquipmentSlotLabel(item.slot)}</div><div class="equipment-bonuses">${formatBonusSummary(item.bonuses || {})}</div>`;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Equip";
        button.addEventListener("click", () => {
          equipOwnedEquipment(state, item.id);
          render(state);
        });
        tile.appendChild(button);
        pack.appendChild(tile);
      });
    }
  }

  if (store) {
    store.innerHTML = "";
    getCityStoreEquipment(state).forEach((item) => {
      const owned = findInventorySlotById(state, item.id) !== -1 || getEquippedItemIdSet(state).has(item.id);
      const equippedNow = Object.values(state.equipment || {}).includes(item.id);
      const tile = document.createElement("div");
      tile.className = "equipment-tile";
      tile.innerHTML = `<strong>${item.label}</strong><div>Slot: ${getEquipmentSlotLabel(item.slot)} | Cost: ${item.cost}</div><div class="equipment-bonuses">${formatBonusSummary(item.bonuses || {})}</div><div class="equipment-bonuses">${getCurrentCity(state).name} market stock</div>`;

      const button = document.createElement("button");
      button.type = "button";
      if (!owned) {
        button.textContent = "Buy To Pack";
        button.disabled = state.wallet < item.cost || getInventoryFitForItem(state, item.id) < 1;
        button.addEventListener("click", () => {
          acquireEquipment(state, item.id);
          render(state);
        });
      } else if (equippedNow) {
        button.textContent = "Equipped";
        button.disabled = true;
      } else {
        button.textContent = "In Pack";
        button.disabled = true;
      }
      tile.appendChild(button);
      store.appendChild(tile);
    });

    getCityStoreConsumables(state).forEach((item) => {
      const template = getItemTemplate(item.id);
      const tile = document.createElement("div");
      tile.className = "equipment-tile";
      tile.innerHTML = `<strong>${item.label}</strong><div>Bundle: x${item.qty || 1} | Cost: ${item.cost}</div><div class="equipment-bonuses">${getItemDescription(template)}</div>`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Buy";
      button.disabled = state.wallet < item.cost;
      button.addEventListener("click", () => {
        buyConsumable(state, item.id, 1);
        render(state);
      });
      tile.appendChild(button);
      store.appendChild(tile);
    });
  }
}

function renderAtlasMap(state) {
  const canvas = document.getElementById("atlas-canvas");
  const info = document.getElementById("atlas-info");
  canvas.innerHTML = "";

  const seenLines = new Set();
  const drawLine = (key, from, to, cls = "") => {
    if (seenLines.has(key)) {
      return;
    }
    seenLines.add(key);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const line = document.createElement("div");
    line.className = `atlas-line ${cls}`.trim();
    line.style.left = `${from.x}px`;
    line.style.top = `${from.y}px`;
    line.style.width = `${distance}px`;
    line.style.transform = `rotate(${angle}deg)`;
    canvas.appendChild(line);
  };

  GAME_CONSTANTS.regions.forEach((region) => {
    const from = getRegionLayout(region.id);
    region.neighbors.forEach((neighborId) => {
      const key = [region.id, neighborId].sort().join("|");
      const to = getRegionLayout(neighborId);
      drawLine(key, from, to);
    });
  });

  GAME_CONSTANTS.cities.forEach((city) => {
    const from = getRegionLayout(city.regionId);
    const to = getCityLayout(city);
    drawLine(`region-city:${city.id}`, from, to, "subline");
  });

  (GAME_CONSTANTS.sectOrders || []).forEach((sect) => {
    const city = GAME_CONSTANTS.cities.find((entry) => entry.id === sect.hostCityId);
    if (!city) {
      return;
    }
    drawLine(`city-sect:${city.id}:${sect.id}`, getCityLayout(city), getSectLayout(sect), "subline faint");
  });

  (GAME_CONSTANTS.explorationAreas || []).forEach((area) => {
    const regionalCities = getCitiesForRegion(area.regionId);
    const areaPos = getAreaLayout(area);
    const targetCity = regionalCities.reduce((best, city) => {
      if (!best) return city;
      const bestPos = getCityLayout(best);
      const cityPos = getCityLayout(city);
      const bestDist = Math.sqrt((bestPos.x - areaPos.x) ** 2 + (bestPos.y - areaPos.y) ** 2);
      const cityDist = Math.sqrt((cityPos.x - areaPos.x) ** 2 + (cityPos.y - areaPos.y) ** 2);
      return cityDist < bestDist ? city : best;
    }, regionalCities[0] || null) || regionalCities[0];
    if (!targetCity) {
      return;
    }
    drawLine(`city-area:${targetCity.id}:${area.id}`, getCityLayout(targetCity), areaPos, "subline faint");
  });

  GAME_CONSTANTS.regions.forEach((region) => {
    const pos = getRegionLayout(region.id);
    const node = document.createElement("button");
    node.type = "button";
    node.className = `atlas-node region ${region.id === state.currentRegionId ? "current" : ""} ${state.ui.mapSelection?.id === region.id && state.ui.mapSelection?.type === "region" ? "selected" : ""}`;
    node.style.left = `${pos.x - 18}px`;
    node.style.top = `${pos.y - 18}px`;
    node.innerHTML = `<span class="node-icon">RG</span><span>${region.name}</span>`;
    node.addEventListener("click", () => {
      state.ui.mapSelection = { type: "region", id: region.id };
      render(state);
    });
    canvas.appendChild(node);
  });

  GAME_CONSTANTS.cities.forEach((city) => {
    const pos = getCityLayout(city);
    const node = document.createElement("button");
    node.type = "button";
    node.className = `atlas-node city ${city.id === state.currentCityId ? "current" : ""} ${state.ui.mapSelection?.id === city.id && state.ui.mapSelection?.type === "city" ? "selected" : ""}`;
    node.style.left = `${pos.x}px`;
    node.style.top = `${pos.y}px`;
    node.innerHTML = `<span class="node-icon">CT</span><span>${city.name}</span>`;
    node.addEventListener("click", () => {
      state.ui.mapSelection = { type: "city", id: city.id };
      render(state);
    });
    canvas.appendChild(node);
  });

  (GAME_CONSTANTS.sectOrders || []).forEach((sect) => {
    const pos = getSectLayout(sect);
    const node = document.createElement("button");
    node.type = "button";
    node.className = `atlas-node sect ${state.sectAffiliation === sect.name ? "current" : ""} ${state.ui.mapSelection?.id === sect.id && state.ui.mapSelection?.type === "sect" ? "selected" : ""}`;
    node.style.left = `${pos.x}px`;
    node.style.top = `${pos.y}px`;
    node.innerHTML = `<span class="node-icon">SC</span><span class="node-label">${compactLabel(sect.name, 16)}</span>`;
    node.addEventListener("click", () => {
      state.ui.mapSelection = { type: "sect", id: sect.id };
      render(state);
    });
    canvas.appendChild(node);
  });

  const areas = getAreasForRegion(state.currentRegionId);
  areas.forEach((area) => {
    const pos = getAreaLayout(area);
    const node = document.createElement("button");
    node.type = "button";
    node.className = `atlas-node area ${area.id === state.currentAreaId ? "current" : ""} ${state.ui.mapSelection?.id === area.id && state.ui.mapSelection?.type === "area" ? "selected" : ""}`;
    node.style.left = `${pos.x}px`;
    node.style.top = `${pos.y}px`;
    node.innerHTML = `<span class="node-icon">AR</span><span class="node-label">${compactLabel(area.short || area.name, 14)}</span>`;
    node.addEventListener("click", () => {
      state.ui.mapSelection = { type: "area", id: area.id };
      render(state);
    });
    canvas.appendChild(node);
  });

  const selection = state.ui.mapSelection;
  if (!selection) {
    info.textContent = "Select a region, sect, city, or area icon.";
    return;
  }

  if (selection.type === "region") {
    const region = GAME_CONSTANTS.regions.find((item) => item.id === selection.id);
    if (!region) {
      info.textContent = "Select a region or city icon.";
      return;
    }
    const canTravel = globalCooldownRemaining(state) === 0 && isRegionAdjacent(state, region.id) && region.id !== state.currentRegionId;
    info.innerHTML = `${region.name} | World: ${region.world} | Danger: ${region.danger}<br />Resources: ${region.resources}<br />`;
    if (region.id !== state.currentRegionId) {
      const pixelDist = regionPixelDist(state.currentRegionId, region.id);
      const regionTravelSecs = Math.round(15 + pixelDist / 40);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = canTravel ? `Travel To Region (~${regionTravelSecs}s)` : "Region Unavailable";
      btn.disabled = !canTravel;
      btn.addEventListener("click", () => {
        const success = travelRegion(state, region.id);
        processActionSuccess(state, success, "travelRegion", Math.max(0, regionTravelSecs - state.globalCooldownBase));
        render(state);
      });
      info.appendChild(btn);
    }
    return;
  }

  if (selection.type === "sect") {
    const sect = (GAME_CONSTANTS.sectOrders || []).find((item) => item.id === selection.id);
    const hostCity = sect ? GAME_CONSTANTS.cities.find((item) => item.id === sect.hostCityId) : null;
    if (!sect || !hostCity) {
      info.textContent = "Select a region, sect, city, or area icon.";
      return;
    }
    const cityTravelReady = globalCooldownRemaining(state) === 0 && hostCity.regionId === state.currentRegionId && hostCity.id !== state.currentCityId;
    info.innerHTML = `${sect.name} | Tier: ${sect.tier} | Host City: ${hostCity.name}<br />Region: ${compactRegionLabel(sect.regionId)} | ${state.sectAffiliation === sect.name ? `Affiliated, standing ${state.sectStanding}` : "Unaffiliated"}`;
    if (hostCity.id !== state.currentCityId) {
      const fromCity = GAME_CONSTANTS.cities.find((item) => item.id === state.currentCityId);
      let cityTravelSecs = 8;
      if (fromCity && fromCity.regionId === hostCity.regionId) {
        cityTravelSecs = Math.round(5 + cityPixelDist(fromCity, hostCity) / 25);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = cityTravelReady ? `Travel To ${hostCity.name} (~${cityTravelSecs}s)` : "Host City Unavailable";
      btn.disabled = !cityTravelReady;
      btn.addEventListener("click", () => {
        const success = switchCity(state, hostCity.id);
        processActionSuccess(state, success, "travelCity", Math.max(0, cityTravelSecs - state.globalCooldownBase));
        render(state);
      });
      info.appendChild(btn);
    }
    return;
  }

  const city = GAME_CONSTANTS.cities.find((item) => item.id === selection.id);
  if (selection.type === "city") {
    if (!city) {
      info.textContent = "Select a region, sect, city, or area icon.";
      return;
    }
    const cityTravelReady = globalCooldownRemaining(state) === 0 && city.regionId === state.currentRegionId && city.id !== state.currentCityId;
    info.innerHTML = `${city.name} | Avg Realm: ${city.avgRealm} | Law: ${city.law}<br />Land Cost: ${city.landCost} | Region: ${compactRegionLabel(city.regionId)}`;
    if (city.id !== state.currentCityId) {
      const fromCity = GAME_CONSTANTS.cities.find((c) => c.id === state.currentCityId);
      let cityTravelSecs = 8;
      if (fromCity && fromCity.regionId === city.regionId) {
        const pixelDist = cityPixelDist(fromCity, city);
        cityTravelSecs = Math.round(5 + pixelDist / 25);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = cityTravelReady ? `Travel To City (~${cityTravelSecs}s)` : "City Unavailable";
      btn.disabled = !cityTravelReady;
      btn.addEventListener("click", () => {
        const success = switchCity(state, city.id);
        processActionSuccess(state, success, "travelCity", Math.max(0, cityTravelSecs - state.globalCooldownBase));
        render(state);
      });
      info.appendChild(btn);
    }
    return;
  }

  const area = GAME_CONSTANTS.explorationAreas.find((item) => item.id === selection.id);
  if (!area) {
    info.textContent = "Select a region, sect, city, or area icon.";
    return;
  }
  const exploreReady = globalCooldownRemaining(state) === 0;
  info.innerHTML = `${area.name} | Type: ${area.type} | Danger: ${area.danger}<br />Focus: ${area.focus} | Region: ${compactRegionLabel(area.regionId)}`;

  const setBtn = document.createElement("button");
  setBtn.type = "button";
  setBtn.textContent = area.id === state.currentAreaId ? "Active Area" : "Set Active Area";
  setBtn.disabled = area.id === state.currentAreaId;
  setBtn.addEventListener("click", () => {
    state.currentAreaId = area.id;
    pushLog(state, `You attune your route toward ${area.name}.`);
    render(state);
  });
  info.appendChild(setBtn);

  const exploreBtn = document.createElement("button");
  exploreBtn.type = "button";
  exploreBtn.textContent = exploreReady ? "Explore This Area" : "Cooldown Active";
  exploreBtn.disabled = !exploreReady;
  exploreBtn.addEventListener("click", () => {
    state.currentAreaId = area.id;
    const success = exploreCurrentArea(state);
    processActionSuccess(state, success, "exploreArea", 1);
    render(state);
  });
  info.appendChild(exploreBtn);
}

function renderBattleStatus(state) {
  const modalStatus = document.getElementById("battle-modal-status");
  const bonded = getBondedSpiritInfo(state);

  const statusText = state.battle
    ? `${state.battle.enemyName} — Round ${state.battle.round}${state.battle.defending ? " | Defending" : ""}${bonded ? ` | Spirit ${bonded.template.label} Lv ${bonded.entry.level}` : ""}`
    : "No active battle.";
  
  if (modalStatus) modalStatus.textContent = statusText;

  // Player stats
  const playerHp   = document.getElementById("bm-player-hp");
  const playerHpB  = document.getElementById("bm-player-hp-bar");
  const playerQi   = document.getElementById("bm-player-qi");
  const playerQiB  = document.getElementById("bm-player-qi-bar");
  const playerBqi  = document.getElementById("bm-player-bqi");
  const playerBqiB = document.getElementById("bm-player-bqi-bar");

  if (playerHp)   playerHp.textContent   = `${state.hp} / ${state.hpMax}`;
  if (playerHpB)  playerHpB.style.width  = `${Math.max(0, Math.round(state.hp / state.hpMax * 100))}%`;
  if (playerQi)   playerQi.textContent   = `${state.qi} / ${state.qiMax}`;
  if (playerQiB)  playerQiB.style.width  = `${state.qiMax > 0 ? Math.round(state.qi / state.qiMax * 100) : 0}%`;
  if (playerBqi)  playerBqi.textContent  = `${state.battleQi} / ${state.battleQiMax}`;
  if (playerBqiB) playerBqiB.style.width = `${state.battleQiMax > 0 ? Math.round(state.battleQi / state.battleQiMax * 100) : 0}%`;

  // Enemy stats
  const enemyName = document.getElementById("bm-enemy-name");
  const enemyHp   = document.getElementById("bm-enemy-hp");
  const enemyHpB  = document.getElementById("bm-enemy-hp-bar");
  const enemyQi   = document.getElementById("bm-enemy-qi");
  const enemyQiB  = document.getElementById("bm-enemy-qi-bar");

  if (state.battle) {
    if (enemyName) enemyName.textContent = state.battle.enemyName;
    if (enemyHp)   enemyHp.textContent   = `${Math.max(0, state.battle.enemyHp)} / ${state.battle.enemyHpMax}`;
    if (enemyHpB)  enemyHpB.style.width  = `${Math.max(0, Math.round(state.battle.enemyHp / state.battle.enemyHpMax * 100))}%`;
    if (enemyQi)   enemyQi.textContent   = `${Math.max(0, state.battle.enemyQi)} / ${state.battle.enemyQiMax}`;
    if (enemyQiB)  enemyQiB.style.width  = `${state.battle.enemyQiMax > 0 ? Math.max(0, Math.round(state.battle.enemyQi / state.battle.enemyQiMax * 100)) : 0}%`;
  } else {
    if (enemyName) enemyName.textContent = "\u2014";
    if (enemyHp)   enemyHp.textContent   = "\u2014";
    if (enemyHpB)  enemyHpB.style.width  = "0%";
    if (enemyQi)   enemyQi.textContent   = "\u2014";
    if (enemyQiB)  enemyQiB.style.width  = "0%";
  }

  // Battle arts list
  const techList = document.getElementById("battle-tech-list");
  if (techList) {
    techList.innerHTML = "";
    const learned = state.learnedBattleTechniques || {};
    const knownIds = Object.keys(learned).filter(id => learned[id]);
    if (knownIds.length === 0) {
      const note = document.createElement("span");
      note.className = "tech-unknown";
      note.textContent = "No battle arts learned. Study battle scrolls from inventory.";
      techList.appendChild(note);
    } else {
      knownIds.forEach(id => {
        const tpl = getBattleTechTemplate(id);
        if (!tpl) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "battle-tech-btn";
        btn.title = `${tpl.desc} (${tpl.qiCost} BQ)`;
        btn.textContent = `${tpl.label} [${tpl.qiCost} BQ]`;
        btn.disabled = !state.battle || state.battleQi < tpl.qiCost;
        btn.addEventListener("click", () => {
          battleAction(state, "useBattleTech", { techId: id });
          render(state);
        });
        techList.appendChild(btn);
      });
    }
  }
}

function renderTechniquesPanel(state) {
  const cultPanel  = document.getElementById("tech-cultivation-panel");
  const battlePanel = document.getElementById("tech-battle-panel");
  if (!cultPanel || !battlePanel) return;

  const bodySummary = document.getElementById("active-body-summary");
  const spiritSummary = document.getElementById("active-spirit-summary");
  const bodyTpl = getTechniqueTemplate(state.activeBodyTechniqueId);
  const spiritTpl = getTechniqueTemplate(state.activeSoulTechniqueId);
  [
    { node: bodySummary, tpl: bodyTpl, empty: "No active body method selected." },
    { node: spiritSummary, tpl: spiritTpl, empty: "No active spirit method selected." }
  ].forEach(({ node, tpl, empty }) => {
    if (!node) {
      return;
    }
    if (tpl) {
      const buffs = getTechniqueBuffLines(tpl).join(" | ") || "No listed buffs";
      const drawbacks = getTechniqueDrawbackLines(tpl).join(" | ") || "No listed drawbacks";
      const catalysts = getTechniqueCatalystLines(tpl)
        .map((entry) => {
          const plan = buildCultivationMaterialPlan(tpl, entry);
          return `${plan.label} (${plan.successRate}% / ${plan.effectPercent}% · ${formatBonusSummary(plan.bonuses || {})})`;
        })
        .join(" | ") || "No catalyst use";
      node.innerHTML = `<strong>${tpl.label}</strong> · ${tpl.grade || "Unknown"} · ${tpl.pillar === "body" ? "Body" : "Soul"} Pillar<br />Buffs: ${buffs}<br />Tradeoffs: ${drawbacks}<br />Catalysts: ${catalysts}`;
    } else {
      node.textContent = empty;
    }
  });

  // Cultivation techniques
  cultPanel.innerHTML = "";
  const learnedCult = state.learnedTechniques || {};
  const allCultTechs = GAME_CONSTANTS.techniques || [];
  allCultTechs.forEach((tpl) => {
    const lvl = learnedCult[tpl.id] || 0;
    const entry = document.createElement("div");
    const isActive = tpl.pillar === "body"
      ? state.activeBodyTechniqueId === tpl.id
      : state.activeSoulTechniqueId === tpl.id;
    entry.className = `tech-entry${isActive ? " active-cultivation" : ""}`;
    if (lvl > 0) {
      const buffLines = getTechniqueBuffLines(tpl)
        .map((line) => `<div class="tech-buff-line">+ ${line}</div>`)
        .join("");
      const drawbackLines = getTechniqueDrawbackLines(tpl)
        .map((line) => `<div class="tech-drawback-line">- ${line}</div>`)
        .join("");
      const catalystLines = getTechniqueCatalystLines(tpl)
        .map((entry) => {
          const plan = buildCultivationMaterialPlan(tpl, entry);
          return `<div class="tech-catalyst-line">* Recommended ${plan.label}: ${entry.effect} (${plan.successRate}% success · ${plan.effectPercent}% yield · ${formatBonusSummary(plan.bonuses || {})})</div>`;
        })
        .join("");
      entry.innerHTML = `
        <h4>${tpl.label} <small style="font-size:0.75rem;color:var(--ink-2)">Lv ${lvl}</small></h4>
        <div class="tech-meta"><span class="tech-grade">${tpl.grade || "Unknown"}</span>${tpl.pillar === "body" ? "Body" : "Soul"} Pillar · ${tpl.category} · ${tpl.origin}</div>
        <div class="tech-desc">${tpl.desc}</div>
        <div class="tech-buff-list">${buffLines || '<div class="tech-buff-line">+ No listed buffs</div>'}</div>
        <div class="tech-drawback-list">${drawbackLines || '<div class="tech-drawback-line">- No listed drawbacks</div>'}</div>
        <div class="tech-catalyst-list">${catalystLines || '<div class="tech-catalyst-line">* No compatible catalyst materials</div>'}</div>
        <div class="tech-action-row">
          ${isActive
            ? '<span class="tech-active-pill">Currently Used</span>'
            : `<button type="button" class="tech-set-active" data-tech-id="${tpl.id}" data-pillar="${tpl.pillar}">Use This ${tpl.pillar === "body" ? "Body" : "Spirit"} Method</button>`}
        </div>`;
    } else {
      entry.style.opacity = "0.5";
      const catalystLines = getTechniqueCatalystLines(tpl)
        .map((entry) => {
          const plan = buildCultivationMaterialPlan(tpl, entry);
          return `<div class="tech-catalyst-line">* Recommended ${plan.label}: ${entry.effect} (${plan.successRate}% success · ${plan.effectPercent}% yield · ${formatBonusSummary(plan.bonuses || {})})</div>`;
        })
        .join("");
      entry.innerHTML = `
        <h4 style="color:var(--ink-2)">${tpl.label} <small style="font-size:0.75rem">(not learned)</small></h4>
        <div class="tech-meta"><span class="tech-grade">${tpl.grade || "Unknown"}</span>${tpl.pillar === "body" ? "Body" : "Soul"} Pillar · Realm req: ${tpl.realmReq}</div>
        <div class="tech-desc">${tpl.desc}</div>
        <div class="tech-drawback-list">${getTechniqueDrawbackLines(tpl).map((line) => `<div class="tech-drawback-line">- ${line}</div>`).join("") || '<div class="tech-drawback-line">- No listed drawbacks</div>'}</div>
        <div class="tech-catalyst-list">${catalystLines || '<div class="tech-catalyst-line">* No compatible catalyst materials</div>'}</div>`;
    }
    cultPanel.appendChild(entry);
  });

  cultPanel.querySelectorAll(".tech-set-active").forEach((button) => {
    button.addEventListener("click", () => {
      const techId = button.getAttribute("data-tech-id");
      const pillar = button.getAttribute("data-pillar");
      if (!techId || !(state.learnedTechniques?.[techId] > 0)) {
        return;
      }
      if (pillar === "body") {
        state.activeBodyTechniqueId = techId;
        pushLog(state, `Active body method changed to ${getTechniqueTemplate(techId)?.label || techId}.`, "good");
      } else {
        state.activeSoulTechniqueId = techId;
        state.meditationTechniqueId = techId;
        pushLog(state, `Active spirit method changed to ${getTechniqueTemplate(techId)?.label || techId}.`, "good");
      }
      render(state);
    });
  });

  if (allCultTechs.length === 0) {
    cultPanel.innerHTML = '<p class="tech-unknown">No cultivation techniques in database.</p>';
  }

  // Battle techniques
  battlePanel.innerHTML = "";
  const learnedBattle = state.learnedBattleTechniques || {};
  const allBattleTechs = GAME_CONSTANTS.battleTechniques || [];
  allBattleTechs.forEach(tpl => {
    const known = learnedBattle[tpl.id];
    const entry = document.createElement("div");
    entry.className = `tech-entry battle-tech${known ? "" : ""}`;
    if (known) {
      entry.innerHTML = `
        <h4>${tpl.label} <small style="font-size:0.75rem;color:var(--ink-2)">Mastered</small></h4>
        <div class="tech-meta">${tpl.category} · ${tpl.qiCost} Battle Qi · Realm req: ${tpl.realmReq}</div>
        <div class="tech-desc">${tpl.desc}</div>`;
    } else {
      entry.style.opacity = "0.5";
      entry.innerHTML = `
        <h4 style="color:var(--ink-2)">${tpl.label} <small style="font-size:0.75rem">(not learned)</small></h4>
        <div class="tech-meta">${tpl.category} · Realm req: ${tpl.realmReq} · Cost: ${tpl.qiCost} BQ when used</div>
        <div class="tech-desc">${tpl.desc}</div>
        <div class="tech-meta" style="margin-top:0.3rem;font-style:italic">Learn by mastering a Battle Art scroll from your inventory.</div>`;
    }
    battlePanel.appendChild(entry);
  });
  if (allBattleTechs.length === 0) {
    battlePanel.innerHTML = '<p class="tech-unknown">No battle arts found in database.</p>';
  }
}

function render(state) {
  processActiveAction(state);
  recalculateDerivedStats(state);
  normalizeInventorySize(state);

  const setTextIfPresent = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  const setWidthIfPresent = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.style.width = value;
  };

  const hpPct = Math.round((state.hp / state.hpMax) * 100);
  const qiPct = Math.round((state.qi / state.qiMax) * 100);
  const bqPct = state.battleQiMax > 0 ? Math.round((state.battleQi / state.battleQiMax) * 100) : 0;
  const lifePct = Math.round((state.longevityCurrent / state.longevityMax) * 100);

  setTextIfPresent("current-region", `Region: ${getCurrentRegion(state).name}`);
  setTextIfPresent("current-city", `City: ${getCurrentCity(state).name}`);
  setTextIfPresent("current-area", `Area: ${getCurrentArea(state)?.name || "None"}`);
  setTextIfPresent("realm-display", `Realm: ${getRealmStageLabel(state)}`);

  setTextIfPresent("hp-display", `${state.hp} / ${state.hpMax}`);
  setTextIfPresent("qi-display", `${state.qi} / ${state.qiMax}`);
  setTextIfPresent("battle-qi-display", `${state.battleQi} / ${state.battleQiMax}`);
  setTextIfPresent("longevity-display", `${state.longevityCurrent} / ${state.longevityMax}`);

  setWidthIfPresent("hp-meter", `${hpPct}%`);
  setWidthIfPresent("qi-meter", `${qiPct}%`);
  setWidthIfPresent("battle-qi-meter", `${bqPct}%`);
  setWidthIfPresent("longevity-meter", `${lifePct}%`);

  const gcd = globalCooldownRemaining(state);
  setTextIfPresent("global-cooldown-note", gcd > 0 ? `Global Cooldown: ${formatSeconds(gcd)}` : "Global Cooldown: Ready");
  
  const cooldownNote = document.getElementById("cooldown-note");
  if (cooldownNote) {
    cooldownNote.textContent = gcd > 0 ? "One global cooldown gates all active actions." : "Actions are ready.";
  }
  
  const breakthroughNote = document.getElementById("breakthrough-note");
  if (breakthroughNote) {
    const minReq = Math.ceil(state.qiMax * 0.97);
    if (state.qi < minReq) {
      breakthroughNote.textContent = `Breakthrough: need roughly ≥97% qi (${minReq}) before materials. Current: ${state.qi}/${state.qiMax}. Materials can lower the threshold slightly.`;
    } else {
      const qiPct = state.qi / state.qiMax;
      let tier, base;
      if (qiPct >= 1.0)        { tier = "Perfect Saturation"; base = 28; }
      else if (qiPct >= 0.985) { tier = "Heaven-Pressing";   base = 19; }
      else                     { tier = "Wall-Touching";     base = 13; }
      const totalComp = state.stats.comprehension + (state.stats.comprehensionBonus || 0);
      const compPct  = Math.round(Math.min(12, totalComp * 0.3));
      const failPct  = Math.min(16, (state.breakthroughFailureBoost || 0) * 8);
      const omenPct  = state.breakthroughPermit ? 8 : 0;
      const total    = Math.min(72, base + compPct + failPct + omenPct);
      let note = `Breakthrough: ${tier} — ~${total}% success`;
      if (failPct > 0) note += ` | +${failPct}% focus (×${state.breakthroughFailureBoost} failure${state.breakthroughFailureBoost > 1 ? "s" : ""})`;
      if (omenPct > 0) note += ` | +${omenPct}% omen`;
      note += " | materials can further stabilize the attempt";
      breakthroughNote.textContent = note;
    }
  }

  const bodySelect = document.getElementById("body-technique");
  const spiritSelect = document.getElementById("spirit-technique");
  const learnedIds = Object.keys(state.learnedTechniques || {});
  const bodyTechs = learnedIds.filter((id) => getTechniqueTemplate(id)?.pillar === "body");
  const spiritTechs = learnedIds.filter((id) => getTechniqueTemplate(id)?.pillar === "soul");
  if (bodySelect) {
    bodySelect.innerHTML = bodyTechs.length > 0
      ? bodyTechs.map((id) => {
          const tpl = getTechniqueTemplate(id);
          return `<option value="${id}"${id === state.activeBodyTechniqueId ? " selected" : ""}>${tpl ? tpl.label : id}</option>`;
        }).join("")
      : '<option value="">No body techniques learned</option>';
  }
  if (spiritSelect) {
    spiritSelect.innerHTML = spiritTechs.length > 0
      ? spiritTechs.map((id) => {
          const tpl = getTechniqueTemplate(id);
          return `<option value="${id}"${id === state.activeSoulTechniqueId ? " selected" : ""}>${tpl ? tpl.label : id}</option>`;
        }).join("")
      : '<option value="">No spirit techniques learned</option>';
  }

  // Show stop-action button only when there is an active action
  const btnStop = document.getElementById("btn-stop-action");
  if (btnStop) {
    btnStop.style.display = state.activeAction ? "" : "none";
  }

  if (!state.activeAction) {
    document.getElementById("active-action-note").textContent = "No active action.";
  } else {
    const actTpl = getTechniqueTemplate(state.activeAction.techniqueId);
    const actLabel = state.activeAction.action === "cityRest"
      ? getCurrentCity(state).name
      : (actTpl ? actTpl.label : (state.activeAction.techniqueId || "—"));
    const catalystLabel = Array.isArray(state.activeAction.catalystPlans) && state.activeAction.catalystPlans.length > 0
      ? ` + ${state.activeAction.catalystPlans.map((plan) => plan.label).join(", ")}`
      : "";
    document.getElementById("active-action-note").textContent =
      `Active: ${state.activeAction.action} (${actLabel}${catalystLabel}) → ${formatSeconds(state.activeAction.endAt - nowSeconds())}`;
  }

  const statsGrid = document.getElementById("stats-grid");
  if (statsGrid) {
    statsGrid.innerHTML = "";
    const hunt = getCurrentHuntContract(state);
    const bonded = getBondedSpiritInfo(state);
    [
      ["Turn", state.turn],
      ["HP", `${state.hp}/${state.hpMax}`],
      ["Qi", `${state.qi}/${state.qiMax}`],
      ["Qi Peak", state.qiPeak || state.qi],
      ["Qi Regen", `${state.qiRegenRate || 1}/tick`],
      ["Battle Qi", `${state.battleQi}/${state.battleQiMax}`],
      ["Body Level", getBodyLevel(state)],
      ["Soul Level", getSoulLevel(state)],
      ["Wallet Silver", state.wallet],
      ["Banked Silver", state.bankSilver],
      ["Years Left", `${state.longevityCurrent}/${state.longevityMax}`],
      ["Physique", state.stats.physique],
      ["Soul Sense", state.stats.soulSense],
      ["Comprehension", state.stats.comprehension],
      ["Fortune", state.stats.fortune],
      ["Karma", state.stats.karma],
      ["Patron Coins", state.patronCoins],
      ["Breakthrough Omen", state.breakthroughPermit ? "Active" : "None"],
      ["Guild", state.guildMember ? `${getRegionalGuild(state.currentRegionId).name} · ${state.guildStanding} ${getStandingLabel(state.guildStanding)}` : "Unaffiliated"],
      ["Sect", state.sectAffiliation ? `${state.sectAffiliation} · ${state.sectStanding} ${getStandingLabel(state.sectStanding)}` : "Unaffiliated"],
      ["Spirit Bond", bonded ? `${bonded.template.label} · Lv ${bonded.entry.level}` : "None"],
      ["Experts", (state.recruitedExperts || []).length > 0 ? (state.recruitedExperts || []).map((id) => getExpertTemplate(id)?.name || id).join(", ") : "None"],
      ["Hunt Contract", hunt ? `${hunt.progress}/${hunt.targetKills} ${hunt.targetName}${hunt.targetKills > 1 ? "s" : ""} in ${hunt.areaName}` : "None"]
    ].forEach(([label, value]) => {
      const tile = document.createElement("div");
      tile.className = "stat-tile";
      tile.innerHTML = `<strong>${label}</strong><div>${value}</div>`;
      statsGrid.appendChild(tile);
    });
  }

  const activeDebuffs = getActiveDebuffs(state);
  const debuffStrip = document.getElementById("debuff-strip");
  if (debuffStrip) {
    debuffStrip.innerHTML = "";
    if (activeDebuffs.length === 0) {
      debuffStrip.classList.add("hidden");
    } else {
      debuffStrip.classList.remove("hidden");
      activeDebuffs.forEach((debuff) => {
        const chip = document.createElement("div");
        chip.className = "debuff-chip";
        chip.title = debuff.desc;
        chip.textContent = `${debuff.label} · ${debuff.short}`;
        debuffStrip.appendChild(chip);
      });
    }
  }

  const statusDebuffs = document.getElementById("status-debuffs");
  if (statusDebuffs) {
    statusDebuffs.innerHTML = "";
    if (activeDebuffs.length === 0) {
      const tile = document.createElement("div");
      tile.className = "path-tile";
      tile.innerHTML = `<strong>None</strong><div>No active debuffs.</div>`;
      statusDebuffs.appendChild(tile);
    } else {
      activeDebuffs.forEach((debuff) => {
        const tile = document.createElement("div");
        tile.className = "path-tile debuff-tile";
        tile.innerHTML = `<strong>${debuff.label}</strong><div>${debuff.short}</div><div class="small">${debuff.desc}</div>`;
        statusDebuffs.appendChild(tile);
      });
    }
  }

  const pathGrid = document.getElementById("path-grid");
  if (pathGrid) {
    pathGrid.innerHTML = "";
    GAME_CONSTANTS.techniques.forEach(tpl => {
      const lvl = (state.learnedTechniques || {})[tpl.id] || 0;
      if (lvl === 0) return;
      const tile = document.createElement("div");
      tile.className = "path-tile";
      const isActive = tpl.pillar === "body" ? state.activeBodyTechniqueId === tpl.id : state.activeSoulTechniqueId === tpl.id;
      const catalystSummary = getTechniqueCatalystLines(tpl)
        .map((entry) => {
          const plan = buildCultivationMaterialPlan(tpl, entry);
          return `${plan.label} ${plan.successRate}%/${plan.effectPercent}%`;
        })
        .join(", ") || "None";
      tile.innerHTML = `<strong>${tpl.label}${isActive ? " · Active" : ""}</strong><div>${tpl.grade || "Unknown"} · ${tpl.pillar === "body" ? "Body" : "Soul"} Pillar — Lv ${lvl}</div><div class="small">Buffs: ${getTechniqueBuffLines(tpl).join(", ") || "None"}</div><div class="small">Tradeoffs: ${getTechniqueDrawbackLines(tpl).join(", ") || "None"}</div><div class="small">Catalysts: ${catalystSummary}</div><div class="small">${tpl.origin}</div>`;
      pathGrid.appendChild(tile);
    });
  }

  const inventoryTopline = document.getElementById("inventory-topline");
  if (inventoryTopline) {
    const carryFlag = activeDebuffs.some((debuff) => debuff.id === "overburdened") ? " | Debuff: Overburdened" : "";
    inventoryTopline.textContent =
      `Slots ${getUsedSlots(state)}/${getSlotLimit(state)} | Weight ${getInventoryWeight(state)}/${getCarryLimit(state)}${carryFlag} | Ring: ${state.ring.tier} | Home: ${state.home ? state.home.tier : "None"}`;
  }

  const bankSummary = document.getElementById("bank-summary");
  if (bankSummary) {
    bankSummary.textContent = `Wallet: ${state.wallet} | Bank: ${state.bankSilver}`;
  }

  const mapMeta = document.getElementById("map-meta");
  if (mapMeta) {
    const region = getCurrentRegion(state);
    mapMeta.textContent = `World: ${region.world} | Danger: ${region.danger} | Cities: ${GAME_CONSTANTS.cities.length} | Areas: ${GAME_CONSTANTS.explorationAreas.length}`;
  }

  const pulse = document.getElementById("world-pulse-list");
  if (pulse) {
    pulse.innerHTML = "";
    getCityPulseEntries(state).forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      pulse.appendChild(li);
    });
  }

  renderInventoryList(state);
  renderInventoryGrid(state);
  renderLoot(state);
  renderEquipment(state);
  renderAtlasMap(state);
  renderInteractionPanel(state);
  const atlasViewport = document.getElementById("atlas-viewport");
  const atlasCanvas = document.getElementById("atlas-canvas");
  state.ui.mapPan = clampAtlasPan(atlasViewport, atlasCanvas, state.ui.mapPan || { x: -250, y: -150 });
  atlasCanvas.style.transform = `translate3d(${state.ui.mapPan.x}px, ${state.ui.mapPan.y}px, 0)`;
  renderBattleStatus(state);
  renderTechniquesPanel(state);

  // ─── Update Hub Panel ───────────────────────────────────────
  const hubRealm = document.getElementById("hub-realm");
  const hubLocation = document.getElementById("hub-location");
  const hubWallet = document.getElementById("hub-wallet");
  if (hubRealm) hubRealm.textContent = getRealmStageLabel(state);
  if (hubLocation) hubLocation.textContent = getCurrentCity(state).name;
  if (hubWallet) hubWallet.textContent = `${state.wallet} silver`;

  // Update available events list for current city
  const eventsList = document.getElementById("available-events-list");
  if (eventsList) {
    eventsList.innerHTML = "";
    const hunt = getCurrentHuntContract(state);
    if (hunt) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="quest-line-title">
          <span>Active ${hunt.issuerType === "sect" ? "Sect" : "Guild"} Hunt</span>
          <span class="quest-badge uncommon">rank ${hunt.rank}</span>
        </div>
        <div class="quest-line-meta">${hunt.progress}/${hunt.targetKills} ${hunt.targetName}${hunt.targetKills > 1 ? "s" : ""} in ${hunt.areaName} for ${hunt.rewardSilver} silver</div>
      `;
      eventsList.appendChild(li);
    }

    const previewLines = [
      {
        title: state.guildMember
          ? `${getRegionalGuild(state.currentRegionId).name} affairs`
          : `Register with ${getRegionalGuild(state.currentRegionId).name}`,
        meta: state.guildMember
          ? `Standing ${state.guildStanding} · ${getStandingLabel(state.guildStanding)} · quartermaster, contracts, and guild disputes`
          : "Gain faction access, a stipend, and guild contracts",
        badge: "guild"
      },
      {
        title: state.sectAffiliation
          ? `${state.sectAffiliation} court`
          : `Petition ${getRegionalSect(state.currentRegionId).name}`,
        meta: state.sectAffiliation
          ? `Standing ${state.sectStanding} · ${getStandingLabel(state.sectStanding)} · herb offerings, trials, and pressure from the court`
          : "Seek outer court affiliation and sect-backed work",
        badge: "sect"
      }
    ];

    previewLines.forEach((entry) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="quest-line-title">
          <span>${entry.title}</span>
          <span class="quest-badge common">${entry.badge}</span>
        </div>
        <div class="quest-line-meta">${entry.meta}</div>
      `;
      eventsList.appendChild(li);
    });

    getFeaturedEvents(state, 3).forEach((event) => {
      const encounter = prepareEventEncounter(state, event);
      const li = document.createElement("li");
      const npcLabel = encounter.npc ? `${getNpcTemplate(encounter.npc)?.name || encounter.npc} · ` : "";
      const rarity = getEventRarity(encounter);
      const intuitionNote = encounter.intuitionNote ? `<div class="quest-line-sense">Soul Sense: ${encounter.intuitionNote}</div>` : "";
      li.innerHTML = `
        <div class="quest-line-title">
          <span>${encounter.title}</span>
          <span class="quest-badge ${rarity}">${rarity}</span>
        </div>
        <div class="quest-line-meta">${npcLabel}${encounter.previewText}</div>
        ${intuitionNote}
      `;
      eventsList.appendChild(li);
    });

    if (!hunt && getFeaturedEvents(state, 1).length === 0) {
      const li = document.createElement("li");
      li.textContent = "No available quests right now.";
      li.style.color = "var(--ink-2)";
      eventsList.appendChild(li);
    }
  }

  // Update compact event log (last 10 entries)
  const eventLogCompact = document.getElementById("event-log-compact");
  if (eventLogCompact) {
    eventLogCompact.innerHTML = "";
    const recentLogs = state.log.slice(-10);
    recentLogs.forEach((line) => {
      const li = document.createElement("li");
      if (line.startsWith("[GOOD]")) {
        li.className = "good";
      } else if (line.startsWith("[BAD]")) {
        li.className = "bad";
      }
      li.textContent = line.replace("[GOOD] ", "").replace("[BAD] ", "");
      eventLogCompact.appendChild(li);
    });
  }

  document.querySelectorAll("button[data-action]").forEach((button) => {
    const action = button.getAttribute("data-action");
    const label = button.textContent.split(" (")[0];
    const disabled = !canUseAction(state, action);
    button.disabled = disabled;
    button.textContent = disabled && gcd > 0 && action !== "save" && action !== "reset" ? `${label} (${formatSeconds(gcd)})` : label;
  });

  const eventLog = document.getElementById("event-log");
  eventLog.innerHTML = "";
  state.log.forEach((line) => {
    const li = document.createElement("li");
    if (line.startsWith("[GOOD]")) {
      li.className = "good";
    } else if (line.startsWith("[BAD]")) {
      li.className = "bad";
    }
    li.textContent = line.replace("[GOOD] ", "").replace("[BAD] ", "");
    eventLog.appendChild(li);
  });
}

function bootstrap() {
  const state = loadState();
  window.state = state;
  window.saveState = saveState;
  window.loadState = loadState;
  state.ui = {
    selectedSlot: null,
    manualLootIndex: null,
    mapRegionId: state.currentRegionId,
    mapSelection: null,
    mapPan: { x: -250, y: -150 },
    interaction: null
  };

  document.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");
      applyAction(state, action);
      render(state);
    });
  });

  const bodySelect = document.getElementById("body-technique");
  if (bodySelect) {
    bodySelect.addEventListener("change", (event) => {
      state.activeBodyTechniqueId = event.target.value;
      render(state);
    });
  }
  const spiritSelect = document.getElementById("spirit-technique");
  if (spiritSelect) {
    spiritSelect.addEventListener("change", (event) => {
      state.activeSoulTechniqueId = event.target.value;
      state.meditationTechniqueId = event.target.value;
      render(state);
    });
  }

  document.getElementById("open-patron-hall").addEventListener("click", () => {
    openPanel(document.getElementById("patron-modal"));
    render(state);
  });
  document.getElementById("close-patron-hall").addEventListener("click", () => {
    closePanel(document.getElementById("patron-modal"));
  });

  // Watch-ad stub: simulates a short delay then awards 1 scroll
  let adCooldown = false;
  document.getElementById("patron-watch-ad").addEventListener("click", () => {
    if (adCooldown) {
      document.getElementById("patron-ad-note").textContent = "Ad already watched recently. Come back in a bit.";
      return;
    }
    const note = document.getElementById("patron-ad-note");
    note.textContent = "Loading ad\u2026";
    adCooldown = true;
    setTimeout(() => {
      const scrollId = getRandomTechniqueScrollId(state);
      const scrollTpl = getItemTemplate(scrollId);
      addItemToInventory(state, scrollId, 1);
      pushLog(state, `Watched an ad — found a ${scrollTpl ? scrollTpl.label : "Technique Scroll"}. Check your inventory.`, "good");
      note.textContent = `Thanks for supporting! Scroll added to inventory.`;
      render(state);
      // 5-minute cooldown
      setTimeout(() => { adCooldown = false; note.textContent = ""; }, 300000);
    }, 3000);
  });

  document.getElementById("open-bank").addEventListener("click", () => {
    openPanel(document.getElementById("bank-modal"));
  });
  document.getElementById("close-bank").addEventListener("click", () => {
    closePanel(document.getElementById("bank-modal"));
  });

  document.getElementById("open-status").addEventListener("click", () => {
    openPanel(document.getElementById("status-modal"));
    render(state);
  });
  document.getElementById("close-status").addEventListener("click", () => {
    closePanel(document.getElementById("status-modal"));
  });

  document.getElementById("open-equipment").addEventListener("click", () => {
    openPanel(document.getElementById("equipment-modal"));
    render(state);
  });
  document.getElementById("close-equipment").addEventListener("click", () => {
    closePanel(document.getElementById("equipment-modal"));
  });

  document.getElementById("open-map").addEventListener("click", () => {
    state.ui.mapSelection = { type: "region", id: state.currentRegionId };
    openPanel(document.getElementById("map-modal"));
    render(state);
  });
  document.getElementById("close-map").addEventListener("click", () => {
    closePanel(document.getElementById("map-modal"));
  });

  document.getElementById("open-battle").addEventListener("click", () => {
    openPanel(document.getElementById("battle-modal"));
    render(state);
  });
  document.getElementById("close-battle").addEventListener("click", () => {
    closePanel(document.getElementById("battle-modal"));
  });

  document.getElementById("close-interaction").addEventListener("click", () => {
    closeInteractionPanel(state);
  });

  // ─── Techniques modal ───────────────────────────────────────
  const openTechBtn = document.getElementById("open-techniques");
  if (openTechBtn) {
    openTechBtn.addEventListener("click", () => {
      openPanel(document.getElementById("techniques-modal"));
      renderTechniquesPanel(state);
    });
  }
  const closeTechBtn = document.getElementById("close-techniques");
  if (closeTechBtn) {
    closeTechBtn.addEventListener("click", () => {
      closePanel(document.getElementById("techniques-modal"));
    });
  }
  const tabCult = document.getElementById("tab-cultivation");
  const tabBattle = document.getElementById("tab-battle");
  const panelCult = document.getElementById("tech-cultivation-panel");
  const panelBattle = document.getElementById("tech-battle-panel");
  if (tabCult && tabBattle && panelCult && panelBattle) {
    tabCult.addEventListener("click", () => {
      panelCult.classList.remove("hidden");
      panelBattle.classList.add("hidden");
      tabCult.classList.add("active");
      tabBattle.classList.remove("active");
    });
    tabBattle.addEventListener("click", () => {
      panelBattle.classList.remove("hidden");
      panelCult.classList.add("hidden");
      tabBattle.classList.add("active");
      tabCult.classList.remove("active");
    });
  }
  const techniquesDragHandle = document.getElementById("techniques-drag-handle");
  const techniquesModal = document.getElementById("techniques-modal");
  setupDraggable("techniques-modal", "techniques-drag-handle");

  document.getElementById("atlas-center-current").addEventListener("click", () => {
    const viewport = document.getElementById("atlas-viewport");
    const canvas = document.getElementById("atlas-canvas");
    const cityPos = getCityLayout(getCurrentCity(state));
    const centered = {
      x: Math.round(viewport.clientWidth / 2 - cityPos.x),
      y: Math.round(viewport.clientHeight / 2 - cityPos.y)
    };
    state.ui.mapPan = clampAtlasPan(viewport, canvas, centered);
    render(state);
  });

  document.getElementById("atlas-reset-pan").addEventListener("click", () => {
    state.ui.mapPan = { x: -250, y: -150 };
    render(state);
  });

  // Hub panel modal buttons
  document.getElementById("open-inventory").addEventListener("click", () => {
    openPanel(document.getElementById("inventory-modal"));
    render(state);
  });

  document.getElementById("close-inventory").addEventListener("click", () => {
    state.ui.selectedSlot = null;
    closePanel(document.getElementById("inventory-modal"));
    render(state);
  });

  document.getElementById("close-loot").addEventListener("click", () => {
    closePanel(document.getElementById("loot-modal"));
  });

  document.getElementById("loot-quick-add").addEventListener("click", () => {
    const remaining = [];
    state.pendingLoot.forEach((stack) => {
      const left = addItemToInventory(state, stack.id, stack.qty);
      if (left > 0) {
        remaining.push({ id: stack.id, qty: left });
      }
    });
    state.pendingLoot = remaining;
    if (state.pendingLoot.length === 0) {
      closePanel(document.getElementById("loot-modal"));
      pushLog(state, "Loot transferred to inventory.", "good");
    } else {
      pushLog(state, "Not enough free slots for all loot. Use manual placement.", "bad");
    }
    render(state);
  });

  setupDraggable("inventory-modal", "inventory-drag-handle");
  setupDraggable("loot-modal", "loot-drag-handle");
  setupDraggable("bank-modal", "bank-drag-handle");
  setupDraggable("map-modal", "map-drag-handle");
  setupDraggable("battle-modal", "battle-drag-handle");
  setupDraggable("status-modal", "status-drag-handle");
  setupDraggable("equipment-modal", "equipment-drag-handle");
  setupDraggable("patron-modal", "patron-drag-handle");
  setupDraggable("interaction-modal", "interaction-drag-handle");

  const atlasViewport = document.getElementById("atlas-viewport");
  const atlasCanvas = document.getElementById("atlas-canvas");
  let mapDragging = false;
  let startPan = { x: 0, y: 0 };
  let startMouse = { x: 0, y: 0 };

  atlasViewport.addEventListener("mousedown", (event) => {
    mapDragging = true;
    startPan = { ...state.ui.mapPan };
    startMouse = { x: event.clientX, y: event.clientY };
    atlasViewport.classList.add("dragging");
  });

  document.addEventListener("mousemove", (event) => {
    if (!mapDragging) {
      return;
    }
    const next = {
      x: startPan.x + event.clientX - startMouse.x,
      y: startPan.y + event.clientY - startMouse.y
    };
    state.ui.mapPan = clampAtlasPan(atlasViewport, atlasCanvas, next);
    atlasCanvas.style.transform = `translate3d(${state.ui.mapPan.x}px, ${state.ui.mapPan.y}px, 0)`;
  });

  document.addEventListener("mouseup", () => {
    if (!mapDragging) {
      return;
    }
    mapDragging = false;
    atlasViewport.classList.remove("dragging");
  });

  render(state);
  setInterval(() => render(state), 500);

  // Show character creation overlay for new games
  if (!state.backstoryChosen) {
    const overlay = document.getElementById("character-creation-overlay");
    overlay.classList.remove("hidden");

    // Track selections through the creation stages
    state.ui.creationPath = null;
    state.ui.creationNature = null;

    // Helper: show a stage and hide others
    const showStage = (stageName) => {
      document.querySelectorAll(".creation-stage").forEach((stage) => {
        stage.classList.add("hidden");
      });
      document.getElementById(`creation-stage-${stageName}`).classList.remove("hidden");
    };

    // Stage 1: Opening Scene
    const openingText = document.getElementById("creation-opening-text");
    openingText.innerHTML = GAME_CONSTANTS.characterCreation.opening;
    
    document.getElementById("btn-creation-open-to-path").addEventListener("click", () => {
      showStage("paths");
      // Populate path cards
      const pathContainer = document.getElementById("creation-path-cards");
      pathContainer.innerHTML = "";
      GAME_CONSTANTS.characterCreation.paths.forEach((path) => {
        const card = document.createElement("div");
        card.className = "creation-card";
        card.innerHTML = `
          <h3>${path.title}</h3>
          <div class="subtitle">${path.subtitle}</div>
          <p>${path.desc}</p>
          <ul>${path.tags.map(t => `<li>${t}</li>`).join("")}</ul>
        `;
        card.addEventListener("click", () => {
          document.querySelectorAll("#creation-path-cards .creation-card").forEach(c => c.classList.remove("selected"));
          card.classList.add("selected");
          state.ui.creationPath = path;
          // Proceed to nature selection after a brief delay
          setTimeout(() => {
            showStage("natures");
            // Populate nature cards
            const natureContainer = document.getElementById("creation-nature-cards");
            natureContainer.innerHTML = "";
            GAME_CONSTANTS.characterCreation.natures.forEach((nature) => {
              const nCard = document.createElement("div");
              nCard.className = "creation-card";
              nCard.innerHTML = `
                <h3>${nature.title}</h3>
                <div class="subtitle">${nature.subtitle}</div>
                <p>${nature.desc}</p>
                <ul>${nature.tags.map(t => `<li>${t}</li>`).join("")}</ul>
              `;
              nCard.addEventListener("click", () => {
                document.querySelectorAll("#creation-nature-cards .creation-card").forEach(nc => nc.classList.remove("selected"));
                nCard.classList.add("selected");
                state.ui.creationNature = nature;
                // Roll fate event, then show fate stage
                setTimeout(() => {
                  const fates = GAME_CONSTANTS.characterCreation.fateEvents;
                  const fate = fates[Math.floor(Math.random() * fates.length)];
                  state.ui.creationFate = fate;
                  const fateCard = document.getElementById("creation-fate-card");
                  if (fateCard) {
                    fateCard.innerHTML = `
                      <h3>${fate.title}</h3>
                      <p>${fate.text}</p>
                      <div class="fate-effect">Effect: ${fate.effects}</div>
                    `;
                  }
                  showStage("fate");
                }, 200);
              });
              natureContainer.appendChild(nCard);
            });
          }, 200);
        });
        pathContainer.appendChild(card);
      });
    });

    // Fate stage: Accept Fate → show summary
    const acceptFateBtn = document.getElementById("btn-creation-accept-fate");
    if (acceptFateBtn) {
      acceptFateBtn.addEventListener("click", () => {
        showStage("summary");
        const summaryDiv = document.getElementById("creation-summary-text");
        const fateInfo = state.ui.creationFate
          ? `<p><strong>Fate:</strong> ${state.ui.creationFate.title} — ${state.ui.creationFate.effects}</p>`
          : "";
        summaryDiv.innerHTML = `
          <h3>A cultivator emerges from the void</h3>
          <p><strong>Origin:</strong> ${state.ui.creationPath ? state.ui.creationPath.title : "Unknown"} — ${state.ui.creationPath ? state.ui.creationPath.desc : ""}</p>
          <p><strong>Nature:</strong> ${state.ui.creationNature ? state.ui.creationNature.title : "Unknown"} — ${state.ui.creationNature ? state.ui.creationNature.desc : ""}</p>
          ${fateInfo}
          <p>These choices shape your path. Your cultivation begins now, informed by your past and your will.</p>
        `;
      });
    }

    // Stage 4: Confirm and Begin
    document.getElementById("btn-creation-confirm").addEventListener("click", () => {
      if (state.ui.creationPath && state.ui.creationNature) {
        // Apply both path and nature
        state.ui.creationPath.apply(state);
        state.ui.creationNature.apply(state);

        // Apply fate event if one was rolled
        if (state.ui.creationFate && typeof state.ui.creationFate.apply === "function") {
          state.ui.creationFate.apply(state);
        }
        
        // Convert any pending scrolls
        const scrollsBefore = 0;
        convertPendingScrolls(state, scrollsBefore);
        
        state.backstoryChosen = true;
        const pathTitle = state.ui.creationPath.title;
        const natureTitle = state.ui.creationNature.title;
        const fateTitle = state.ui.creationFate ? ` Fate: ${state.ui.creationFate.title}.` : "";
        pushLog(state, `You are ${pathTitle}. Your nature is ${natureTitle}.${fateTitle} Your journey begins.`, "good");
        recalculateDerivedStats(state);
        overlay.classList.add("hidden");
        
        // Cleanup
        state.ui.creationPath = null;
        state.ui.creationNature = null;
        state.ui.creationFate = null;
        
        render(state);
      }
    });

    // Show the opening stage
    showStage("opening");
  }
}

bootstrap();
