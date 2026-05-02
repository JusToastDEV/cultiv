const GAME_CONSTANTS = {
  saveKey: "sealed_heavens_save_v1",
  realms: [
    { name: "Mortal", stages: ["Body Tempering", "Meridian Opening", "Qi Sensing"], longevityBase: 80 },
    { name: "Qi Condensation", stages: ["Early", "Mid", "Great Perfection"], longevityBase: 120 },
    { name: "Foundation", stages: ["Human", "Earth", "Heaven"], longevityBase: 220 },
    { name: "Core", stages: ["Cracked", "Stable", "Flawless"], longevityBase: 420 },
    { name: "Nascent Soul", stages: ["Soul Seed", "Soul Embryo", "Emergence"], longevityBase: 850 },
    { name: "Soul Formation", stages: ["Integration", "Domain Awakening", "Domain Perfection"], longevityBase: 1600 }
  ],
  regions: [
    {
      id: "ashen-frontier",
      name: "Ashen Frontier",
      world: "Ashen World",
      danger: "Low",
      resources: "Herbs, low-tier ores",
      neighbors: ["jade-delta", "iron-wilds"]
    },
    {
      id: "jade-delta",
      name: "Jade Delta",
      world: "Verdant World",
      danger: "Low-Mid",
      resources: "Spirit herbs, alchemy reagents",
      neighbors: ["ashen-frontier", "void-rift"]
    },
    {
      id: "iron-wilds",
      name: "Iron Wilds",
      world: "Ashen World",
      danger: "Mid",
      resources: "Beast cores, blood jade",
      neighbors: ["ashen-frontier", "void-rift"]
    },
    {
      id: "void-rift",
      name: "Void Rift March",
      world: "Mirror World",
      danger: "High",
      resources: "Array ore, rare relic fragments",
      neighbors: ["jade-delta", "iron-wilds"]
    }
  ],
  cities: [
    { id: "ember", name: "Ember Court", regionId: "ashen-frontier", world: "Ashen World", avgRealm: "Foundation", law: "Strict", landCost: 180 },
    { id: "cinder", name: "Cinder Bastion", regionId: "ashen-frontier", world: "Ashen World", avgRealm: "Qi Condensation", law: "Strict", landCost: 130 },
    { id: "jade", name: "Jade Harbor", regionId: "jade-delta", world: "Verdant World", avgRealm: "Qi Condensation", law: "Moderate", landCost: 120 },
    { id: "lotus", name: "Lotus Archive", regionId: "jade-delta", world: "Verdant World", avgRealm: "Foundation", law: "Moderate", landCost: 170 },
    { id: "iron", name: "Iron Howl Keep", regionId: "iron-wilds", world: "Ashen World", avgRealm: "Foundation", law: "Harsh", landCost: 210 },
    { id: "void", name: "Void Lantern Capital", regionId: "void-rift", world: "Mirror World", avgRealm: "Core", law: "Harsh", landCost: 260 }
  ],
  homes: [
    { tier: "Rented Room", slots: 12, safeWeight: 80, cost: 90 },
    { tier: "Courtyard House", slots: 28, safeWeight: 230, cost: 220 },
    { tier: "City Manor", slots: 60, safeWeight: 640, cost: 650 }
  ],
  rings: [
    { tier: "None", slots: 0, maxWeight: 0, upkeep: 0, cost: 0 },
    { tier: "Cracked Ring", slots: 8, maxWeight: 40, upkeep: 2, cost: 95 },
    { tier: "Standard Ring", slots: 20, maxWeight: 140, upkeep: 6, cost: 260 },
    { tier: "Spirit Ring", slots: 45, maxWeight: 420, upkeep: 16, cost: 700 }
  ],
  inventoryTemplates: [
    { id: "spirit-herb", label: "Spirit Herb", weight: 1, value: 5, maxStack: 99 },
    { id: "beast-core", label: "Beast Core", weight: 4, value: 18, maxStack: 20 },
    { id: "array-ore", label: "Array Ore", weight: 6, value: 27, maxStack: 15 },
    { id: "blood-jade", label: "Blood Jade", weight: 2, value: 14, maxStack: 30 }
  ],
  events: [
    {
      title: "Flicker in the Meridian",
      text: "Your qi circulation stabilizes after a painful cycle. You can push now or rest.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.qi += 10;
        state.stats.comprehension += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Debt Collector of the Iron Guild",
      text: "As a registered guild trader, a collector requests dues on your recent haul.",
      canTrigger: (state) => state.guildMember,
      onResolve: (state) => {
        const loss = Math.min(30, state.wallet);
        state.wallet -= loss;
        state.logClass = loss > 0 ? "bad" : "good";
      }
    },
    {
      title: "Ruined Pavilion Inheritance",
      text: "You find a fragment describing mixed body-soul tempering.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.paths.body += 1;
        state.paths.soul += 1;
        state.legacyNotes += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Guild Oath Contract",
      text: "A merchant elder offers guild registration in exchange for legal market protection.",
      canTrigger: (state) => !state.guildMember,
      onResolve: (state) => {
        state.guildMember = true;
        state.wallet += 20;
        state.logClass = "good";
      }
    },
    {
      title: "Ring Instability Pulse",
      text: "Your dimensional ring shudders under spiritual load.",
      canTrigger: (state) => state.ringLevel > 0,
      onResolve: (state, context) => {
        if (context.inventoryWeight > state.ring.maxWeight) {
          const burn = Math.min(7, state.longevityCurrent - 10);
          state.longevityCurrent -= burn;
          state.logClass = "bad";
        } else {
          state.qi += 5;
          state.logClass = "good";
        }
      }
    }
  ]
};
