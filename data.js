const GAME_CONSTANTS = {
  saveKey: "sealed_heavens_save_v2",
  realms: [
    { name: "Mortal", stages: ["Bone Tempering", "Marrow Cleansing", "Blood Refinement"], longevityBase: 80 },
    { name: "Qi Condensation", stages: ["Qi Awakening", "Qi Refinement", "Qi Perfection"], longevityBase: 120 },
    { name: "Foundation", stages: ["Earthen Root", "Iron Pillar", "Heaven Jade"], longevityBase: 220 },
    { name: "Core Formation", stages: ["Cracked Core", "Solid Core", "Flawless Core"], longevityBase: 420 },
    { name: "Nascent Soul", stages: ["Soul Seed", "Soul Bloom", "Soul Sovereign"], longevityBase: 850 },
    { name: "Soul Formation", stages: ["First Heaven", "Second Heaven", "Third Heaven"], longevityBase: 1600 },
    { name: "Void Refinement", stages: ["Void Skin", "Void Vessel", "Void Mandate"], longevityBase: 2800 },
    { name: "Saint Ascension", stages: ["Saint Spark", "Saint Body", "Saint Crown"], longevityBase: 4600 },
    { name: "Immortal Lord", stages: ["Immortal Ember", "Immortal Throne", "Immortal Zenith"], longevityBase: 7600 },
    { name: "Dao Sovereign", stages: ["Dao Seed", "Dao Dominion", "Dao Heaven"], longevityBase: 12000 }
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
      neighbors: ["jade-delta", "iron-wilds", "celestial-plateau"]
    },
    {
      id: "celestial-plateau",
      name: "Celestial Plateau",
      world: "Upper Heaven",
      danger: "Extreme",
      resources: "Void lotuses, saint bone, star-metal",
      neighbors: ["void-rift", "sovereign-wastes"]
    },
    {
      id: "sovereign-wastes",
      name: "Sovereign Wastes",
      world: "Ancient Heaven",
      danger: "Cataclysmic",
      resources: "Dao crystals, immortal dew, sovereign relics",
      neighbors: ["celestial-plateau"]
    }
  ],
  cities: [
    { id: "ember", name: "Ember Court", regionId: "ashen-frontier", world: "Ashen World", avgRealm: "Foundation", law: "Strict", landCost: 180 },
    { id: "cinder", name: "Cinder Bastion", regionId: "ashen-frontier", world: "Ashen World", avgRealm: "Qi Condensation", law: "Strict", landCost: 130 },
    { id: "ashgate", name: "Ashgate Borough", regionId: "ashen-frontier", world: "Ashen World", avgRealm: "Mortal", law: "Moderate", landCost: 90 },
    { id: "char-haven", name: "Char Haven", regionId: "ashen-frontier", world: "Ashen World", avgRealm: "Qi Condensation", law: "Moderate", landCost: 115 },
    { id: "sable-forge", name: "Sable Forge", regionId: "ashen-frontier", world: "Ashen World", avgRealm: "Foundation", law: "Harsh", landCost: 160 },
    { id: "grim-terrace", name: "Grim Terrace", regionId: "ashen-frontier", world: "Ashen World", avgRealm: "Foundation", law: "Strict", landCost: 190 },
    { id: "jade", name: "Jade Harbor", regionId: "jade-delta", world: "Verdant World", avgRealm: "Qi Condensation", law: "Moderate", landCost: 120 },
    { id: "lotus", name: "Lotus Archive", regionId: "jade-delta", world: "Verdant World", avgRealm: "Foundation", law: "Moderate", landCost: 170 },
    { id: "rain-wharf", name: "Rainwharf Quay", regionId: "jade-delta", world: "Verdant World", avgRealm: "Mortal", law: "Moderate", landCost: 80 },
    { id: "bamboo-rise", name: "Bamboo Rise", regionId: "jade-delta", world: "Verdant World", avgRealm: "Qi Condensation", law: "Soft", landCost: 105 },
    { id: "mist-pier", name: "Mist Pier", regionId: "jade-delta", world: "Verdant World", avgRealm: "Foundation", law: "Moderate", landCost: 140 },
    { id: "green-vault", name: "Green Vault District", regionId: "jade-delta", world: "Verdant World", avgRealm: "Foundation", law: "Strict", landCost: 175 },
    { id: "iron", name: "Iron Howl Keep", regionId: "iron-wilds", world: "Ashen World", avgRealm: "Foundation", law: "Harsh", landCost: 210 },
    { id: "fang-cross", name: "Fang Cross", regionId: "iron-wilds", world: "Ashen World", avgRealm: "Qi Condensation", law: "Harsh", landCost: 135 },
    { id: "red-cliff", name: "Red Cliff Yard", regionId: "iron-wilds", world: "Ashen World", avgRealm: "Foundation", law: "Harsh", landCost: 170 },
    { id: "bone-spear", name: "Bone Spear Ward", regionId: "iron-wilds", world: "Ashen World", avgRealm: "Foundation", law: "Strict", landCost: 195 },
    { id: "steel-marsh", name: "Steel Marsh", regionId: "iron-wilds", world: "Ashen World", avgRealm: "Core", law: "Harsh", landCost: 230 },
    { id: "war-drum", name: "War Drum City", regionId: "iron-wilds", world: "Ashen World", avgRealm: "Core", law: "Harsh", landCost: 250 },
    { id: "void", name: "Void Lantern Capital", regionId: "void-rift", world: "Mirror World", avgRealm: "Core", law: "Harsh", landCost: 260 },
    { id: "night-shard", name: "Night Shard Port", regionId: "void-rift", world: "Mirror World", avgRealm: "Foundation", law: "Harsh", landCost: 180 },
    { id: "mirror-step", name: "Mirrorstep Enclave", regionId: "void-rift", world: "Mirror World", avgRealm: "Core", law: "Harsh", landCost: 240 },
    { id: "riftwatch", name: "Riftwatch Bastion", regionId: "void-rift", world: "Mirror World", avgRealm: "Core", law: "Strict", landCost: 280 },
    { id: "hollow-sun", name: "Hollow Sun Bastille", regionId: "void-rift", world: "Mirror World", avgRealm: "Nascent Soul", law: "Harsh", landCost: 320 },
    { id: "echo-prism", name: "Echo Prism Court", regionId: "void-rift", world: "Mirror World", avgRealm: "Soul Formation", law: "Strict", landCost: 360 },
    { id: "starfall", name: "Starfall Terrace", regionId: "celestial-plateau", world: "Upper Heaven", avgRealm: "Void Refinement", law: "Strict", landCost: 420 },
    { id: "saint-vigil", name: "Saint Vigil City", regionId: "celestial-plateau", world: "Upper Heaven", avgRealm: "Saint Ascension", law: "Strict", landCost: 520 },
    { id: "auric-steps", name: "Auric Steps", regionId: "celestial-plateau", world: "Upper Heaven", avgRealm: "Void Refinement", law: "Moderate", landCost: 390 },
    { id: "dao-furnace", name: "Dao Furnace Capital", regionId: "sovereign-wastes", world: "Ancient Heaven", avgRealm: "Immortal Lord", law: "Harsh", landCost: 640 },
    { id: "crown-void", name: "Crown Void Citadel", regionId: "sovereign-wastes", world: "Ancient Heaven", avgRealm: "Dao Sovereign", law: "Strict", landCost: 820 },
    { id: "ashen-throne", name: "Ashen Throne Gate", regionId: "sovereign-wastes", world: "Ancient Heaven", avgRealm: "Saint Ascension", law: "Harsh", landCost: 570 }
  ],
  explorationAreas: [
    { id: "cinder-steppe", name: "Cinder Steppe", short: "Steppe", regionId: "ashen-frontier", type: "wilderness", danger: 1, focus: "beasts" },
    { id: "burnt-shrines", name: "Burnt Shrines", short: "Shrines", regionId: "ashen-frontier", type: "ruins", danger: 2, focus: "relic" },
    { id: "smoke-pits", name: "Smoke Pits", short: "Pits", regionId: "ashen-frontier", type: "mine", danger: 2, focus: "ore" },
    { id: "jade-marsh", name: "Jade Marsh", short: "Marsh", regionId: "jade-delta", type: "wetland", danger: 1, focus: "herb" },
    { id: "lotus-fissure", name: "Lotus Fissure", short: "Fissure", regionId: "jade-delta", type: "rift", danger: 2, focus: "spirit" },
    { id: "bamboo-veil", name: "Bamboo Veil", short: "Veil", regionId: "jade-delta", type: "forest", danger: 1, focus: "ambush" },
    { id: "red-fang-range", name: "Red Fang Range", short: "Fang", regionId: "iron-wilds", type: "mountain", danger: 2, focus: "beasts" },
    { id: "bone-hollows", name: "Bone Hollows", short: "Hollows", regionId: "iron-wilds", type: "ruins", danger: 3, focus: "relic" },
    { id: "war-scar-vale", name: "War Scar Vale", short: "Vale", regionId: "iron-wilds", type: "battlefield", danger: 3, focus: "ambush" },
    { id: "fracture-coast", name: "Fracture Coast", short: "Coast", regionId: "void-rift", type: "rift", danger: 3, focus: "array" },
    { id: "prism-chasm", name: "Prism Chasm", short: "Chasm", regionId: "void-rift", type: "chasm", danger: 4, focus: "relic" },
    { id: "hushed-mirror", name: "Hushed Mirror Expanse", short: "Mirror", regionId: "void-rift", type: "anomaly", danger: 4, focus: "spirit" },
    { id: "star-shear-rim", name: "Star Shear Rim", short: "Shear", regionId: "celestial-plateau", type: "sky-ruin", danger: 5, focus: "saint" },
    { id: "lotus-of-absence", name: "Lotus of Absence", short: "Absence", regionId: "celestial-plateau", type: "void-garden", danger: 5, focus: "void" },
    { id: "seraph-spine", name: "Seraph Spine", short: "Spine", regionId: "celestial-plateau", type: "mountain", danger: 6, focus: "saint" },
    { id: "dao-bone-desert", name: "Dao Bone Desert", short: "Dao Bone", regionId: "sovereign-wastes", type: "desolation", danger: 6, focus: "dao" },
    { id: "immortal-furnace-sea", name: "Immortal Furnace Sea", short: "Furnace", regionId: "sovereign-wastes", type: "sea-of-fire", danger: 7, focus: "immortal" },
    { id: "thronefall-necropolis", name: "Thronefall Necropolis", short: "Necropolis", regionId: "sovereign-wastes", type: "necropolis", danger: 7, focus: "dao" },
    { id: "myriad-spirit-mausoleum", name: "Myriad Spirit Mausoleum", short: "Mausoleum", regionId: "sovereign-wastes", type: "anomaly", danger: 8, focus: "spiritlord" }
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
    { id: "spirit-herb",                  label: "Spirit Herb",                     weight: 1, value: 5,  maxStack: 99, tags: ["herb", "spirit", "organic"], potency: 1 },
    { id: "healing-salve",               label: "Healing Salve",                  weight: 1, value: 9,  maxStack: 20, tags: ["medicine", "herb"], potency: 1 },
    { id: "revitalizing-pill",           label: "Revitalizing Pill",              weight: 1, value: 15, maxStack: 20, tags: ["pill", "spirit", "medicine"], potency: 2 },
    { id: "beast-core",                   label: "Beast Core",                      weight: 4, value: 18, maxStack: 20, tags: ["beast", "core", "blood"], potency: 2 },
    { id: "array-ore",                    label: "Array Ore",                       weight: 6, value: 27, maxStack: 15, tags: ["ore", "array", "mineral"], potency: 3 },
    { id: "blood-jade",                   label: "Blood Jade",                      weight: 2, value: 14, maxStack: 30, tags: ["jade", "blood", "mineral"], potency: 2 },
    { id: "black-iron-ore",               label: "Black Iron Ore",                  weight: 6, value: 24, maxStack: 18, tags: ["ore", "metal", "mineral"], potency: 2 },
    { id: "venom-gland",                  label: "Venom Gland",                     weight: 1, value: 21, maxStack: 15, tags: ["poison", "beast", "organic"], potency: 2 },
    { id: "poison-essence",               label: "Poison Essence",                  weight: 1, value: 32, maxStack: 12, tags: ["poison", "refined", "spirit"], potency: 3 },
    { id: "moon-dew-fungus",              label: "Moon Dew Fungus",                 weight: 1, value: 19, maxStack: 20, tags: ["fungus", "herb", "spirit"], potency: 2 },
    { id: "soul-amber",                   label: "Soul Amber",                      weight: 2, value: 34, maxStack: 12, tags: ["soul", "resin", "mineral"], potency: 3 },
    { id: "embersteel-ingot",             label: "Embersteel Ingot",                weight: 5, value: 29, maxStack: 16, tags: ["metal", "fire", "mineral"], potency: 3 },
    { id: "stormglass-shard",             label: "Stormglass Shard",                weight: 2, value: 26, maxStack: 20, tags: ["glass", "lightning", "mineral"], potency: 3 },
    { id: "cloud-silk",                   label: "Cloud Silk",                      weight: 1, value: 23, maxStack: 24, tags: ["cloth", "spirit", "soul"], potency: 2 },
    { id: "grave-bloom",                  label: "Grave Bloom",                     weight: 1, value: 28, maxStack: 18, tags: ["herb", "yin", "soul"], potency: 3 },
    { id: "void-lotus",                   label: "Void Lotus",                      weight: 1, value: 42, maxStack: 16, tags: ["void", "herb", "spirit"], potency: 4 },
    { id: "saint-bone-fragment",          label: "Saint Bone Fragment",             weight: 3, value: 48, maxStack: 14, tags: ["bone", "saint", "mineral"], potency: 4 },
    { id: "immortal-dew",                 label: "Immortal Dew",                    weight: 1, value: 56, maxStack: 14, tags: ["dew", "immortal", "spirit"], potency: 5 },
    { id: "dao-crystal",                  label: "Dao Crystal",                     weight: 2, value: 64, maxStack: 12, tags: ["dao", "crystal", "mineral"], potency: 5 },
    { id: "tempered-marrow-paste",        label: "Tempered Marrow Paste",           weight: 1, value: 40, maxStack: 16, tags: ["crafted", "medicine", "body"], potency: 3 },
    { id: "focus-incense",                label: "Focus Incense",                   weight: 1, value: 38, maxStack: 16, tags: ["crafted", "soul", "spirit"], potency: 3 },
    { id: "venom-temper-draught",         label: "Venom Temper Draught",            weight: 1, value: 46, maxStack: 14, tags: ["crafted", "poison", "body"], potency: 4 },
    { id: "void-meridian-elixir",         label: "Void Meridian Elixir",            weight: 1, value: 58, maxStack: 12, tags: ["crafted", "void", "soul"], potency: 4 },
    { id: "saintfire-pellet",             label: "Saintfire Pellet",                weight: 1, value: 72, maxStack: 10, tags: ["crafted", "saint", "body"], potency: 5 },
    { id: "dao-heart-tonic",              label: "Dao Heart Tonic",                 weight: 1, value: 84, maxStack: 10, tags: ["crafted", "dao", "soul"], potency: 5 },
    { id: "ancestral-spirit-incense",     label: "Ancestral Spirit Incense",        weight: 1, value: 62, maxStack: 12, tags: ["crafted", "spirit", "soul"], potency: 4 },
    { id: "soul-forge-nectar",            label: "Soul Forge Nectar",               weight: 1, value: 88, maxStack: 10, tags: ["crafted", "dao", "spirit", "immortal"], potency: 5 },
    { id: "vessel-emberstorm-crow",       label: "Emberstorm Crow Spirit Vessel",   weight: 1, value: 120, maxStack: 2, tags: ["spirit", "fire", "lightning", "vessel"], potency: 5 },
    { id: "vessel-dreamveil-fox",         label: "Dreamveil Fox Spirit Vessel",     weight: 1, value: 122, maxStack: 2, tags: ["spirit", "yin", "soul", "vessel"], potency: 5 },
    { id: "vessel-tyrant-ape",            label: "Tyrant Ape Spirit Vessel",        weight: 2, value: 126, maxStack: 2, tags: ["spirit", "beast", "blood", "vessel"], potency: 5 },
    { id: "vessel-starlaw-qilin",         label: "Starlaw Qilin Spirit Vessel",     weight: 1, value: 140, maxStack: 2, tags: ["spirit", "dao", "saint", "vessel"], potency: 6 },
    // Technique scrolls — weightless, sellable, max 3 per stack
    { id: "scroll-iron-skin-sutra",       label: "Iron Skin Sutra Scroll",          weight: 0, value: 28, maxStack: 3 },
    { id: "scroll-dragon-marrow-art",     label: "Dragon Marrow Art Scroll",        weight: 0, value: 44, maxStack: 3 },
    { id: "scroll-crimson-vein-method",   label: "Crimson Vein Method Scroll",      weight: 0, value: 40, maxStack: 3 },
    { id: "scroll-thousand-bone-scripture", label: "Thousand Bone Scripture Scroll",weight: 0, value: 56, maxStack: 3 },
    { id: "scroll-jade-body-tempering",   label: "Jade Body Tempering Scroll",      weight: 0, value: 30, maxStack: 3 },
    { id: "scroll-titan-root-stance",     label: "Titan Root Stance Scroll",        weight: 0, value: 58, maxStack: 3 },
    { id: "scroll-silent-mind-sutra",     label: "Silent Mind Sutra Scroll",        weight: 0, value: 28, maxStack: 3 },
    { id: "scroll-void-resonance-art",    label: "Void Resonance Art Scroll",       weight: 0, value: 60, maxStack: 3 },
    { id: "scroll-heaven-ear-method",     label: "Heaven Ear Method Scroll",        weight: 0, value: 72, maxStack: 3 },
    { id: "scroll-star-chart-circulation",label: "Star Chart Circulation Scroll",   weight: 0, value: 42, maxStack: 3 },
    { id: "scroll-dream-lotus-meditation",label: "Dream Lotus Meditation Scroll",   weight: 0, value: 34, maxStack: 3 },
    { id: "scroll-soul-forging-rite",     label: "Soul Forging Rite Scroll",        weight: 0, value: 68, maxStack: 3 },
    { id: "scroll-heavenly-stag-bone-mantra", label: "Heavenly Stag Bone Mantra Scroll", weight: 0, value: 62, maxStack: 3 },
    { id: "scroll-nine-sun-ember-flesh",  label: "Nine Sun Ember Flesh Scroll",     weight: 0, value: 74, maxStack: 3 },
    { id: "scroll-painted-dream-devil-scripture", label: "Painted Dream Devil Scripture Scroll", weight: 0, value: 76, maxStack: 3 },
    { id: "scroll-azure-pavilion-breath", label: "Azure Pavilion Breath Scroll",    weight: 0, value: 58, maxStack: 3 },
    // Battle Art Scrolls
    { id: "battle-scroll-crushing-wave",    label: "Crushing Wave Scroll",           weight: 0, value: 24, maxStack: 2 },
    { id: "battle-scroll-shadowstep",       label: "Shadow Step Scroll",             weight: 0, value: 30, maxStack: 2 },
    { id: "battle-scroll-iron-bell-guard",  label: "Iron Bell Guard Scroll",         weight: 0, value: 28, maxStack: 2 },
    { id: "battle-scroll-thunder-palm",     label: "Thunder Palm Scroll",            weight: 0, value: 46, maxStack: 2 },
    { id: "battle-scroll-spirit-rend",      label: "Spirit Rend Scroll",             weight: 0, value: 50, maxStack: 2 },
    { id: "battle-scroll-bloodfire-strike", label: "Bloodfire Strike Scroll",        weight: 0, value: 62, maxStack: 2 },
    { id: "battle-scroll-void-pierce",      label: "Void Pierce Scroll",             weight: 0, value: 52, maxStack: 2 },
    { id: "battle-scroll-meridian-lock",    label: "Meridian Lock Scroll",           weight: 0, value: 40, maxStack: 2 },
    { id: "battle-scroll-qi-burst",         label: "Qi Burst Scroll",                weight: 0, value: 48, maxStack: 2 },
    { id: "battle-scroll-predator-stance",  label: "Predator Stance Scroll",         weight: 0, value: 26, maxStack: 2 }
  ],
  // ─── Cultivation Techniques ───────────────────────────────────────────────
  // pillar: "body" | "soul"   (the two fundamental pillars)
  // category: flavour grouping shown to the player
  // realmReq: minimum realmIndex to study this technique
  // bonuses applied once per technique level during recalc
  techniques: [
    // ── Body Pillar ──
    {
      id: "iron-skin-sutra",
      label: "Iron Skin Sutra",
      grade: "Common",
      pillar: "body",
      category: "Tempering",
      origin: "Ashen Frontier Sect",
      realmReq: 0,
      desc: "Toughens the flesh layer by layer; favoured by low-realm wanderers.",
      drawbacks: ["Slow soul growth", "Rigid body focus can stall flexible qi control"],
      materialCatalysts: [
        {
          itemId: "spirit-herb",
          effect: "Poulticed herbs soothe the flesh and help the sutra settle deeper into muscle.",
          bonuses: { hp: 10, extraLevel: 1 }
        }
      ],
      bonusPerLevel: { hpMax: 12, physique: 1 }
    },
    {
      id: "dragon-marrow-art",
      label: "Dragon Marrow Art",
      grade: "Rare",
      pillar: "body",
      category: "Tempering",
      origin: "Iron Wilds War Clan",
      realmReq: 1,
      desc: "Refines marrow with beast essence, building explosive physical power.",
      drawbacks: ["Violent refinement strains recovery", "Requires beast essence mindset to master safely"],
      materialCatalysts: [
        {
          itemId: "beast-core",
          effect: "A beast core cracks open through the marrow route, feeding brutal body growth.",
          bonuses: { hp: 16, physique: 1, extraLevel: 1 }
        }
      ],
      bonusPerLevel: { hpMax: 18, physique: 2 }
    },
    {
      id: "crimson-vein-method",
      label: "Crimson Vein Method",
      grade: "Rare",
      pillar: "body",
      category: "Blood Forge",
      origin: "Blood Jade Covenant",
      realmReq: 1,
      desc: "Circulates refined blood qi through the meridians, trading pain for power.",
      drawbacks: ["Painful circulation", "Aggressive flow makes stable meditation harder"],
      materialCatalysts: [
        {
          itemId: "blood-jade",
          effect: "Blood jade dissolves into the circulation pattern, sharpening battle channels.",
          bonuses: { hp: 8, battleQi: 12, extraLevel: 1 }
        }
      ],
      bonusPerLevel: { hpMax: 14, physique: 2, battleQiMax: 6 }
    },
    {
      id: "thousand-bone-scripture",
      label: "Thousand Bone Scripture",
      grade: "Legacy",
      pillar: "body",
      category: "Blood Forge",
      origin: "Ashen Sect Remnant Archive",
      realmReq: 2,
      desc: "A brutal scripture that fractures and re-forges bone structure.",
      drawbacks: ["Extreme bodily pain", "Unsafe for low-realm cultivators"],
      materialCatalysts: [
        {
          itemId: "beast-core",
          effect: "Dense beast marrow essence lets the scripture rebuild broken structure faster.",
          bonuses: { hp: 18, physique: 1, extraLevel: 1 }
        },
        {
          itemId: "blood-jade",
          effect: "Blood jade keeps shattered channels fed during the reforging cycle.",
          bonuses: { hp: 10, battleQi: 8 }
        }
      ],
      bonusPerLevel: { hpMax: 22, physique: 3 }
    },
    {
      id: "jade-body-tempering",
      label: "Jade Body Tempering",
      grade: "Refined",
      pillar: "body",
      category: "Tempering",
      origin: "Jade Delta Healers Guild",
      realmReq: 0,
      desc: "Gentle refinement using spirit-herb essence. Slower but accumulates without injury.",
      drawbacks: ["Lower raw power growth", "Best results depend on steady herb access"],
      materialCatalysts: [
        {
          itemId: "spirit-herb",
          effect: "Herbal steam opens the pores and deepens restorative body tempering.",
          bonuses: { hp: 14, longevity: 2, extraLevel: 1 }
        }
      ],
      bonusPerLevel: { hpMax: 9, physique: 1, longevityBonus: 4 }
    },
    {
      id: "titan-root-stance",
      label: "Titan Root Stance",
      grade: "Legacy",
      pillar: "body",
      category: "Foundation",
      origin: "Old World Earth Scripture",
      realmReq: 2,
      desc: "Anchors the dantian to earth qi; vastly magnifies endurance.",
      drawbacks: ["Heavy, immobile circulation style", "Adaptation to swift techniques is poor"],
      materialCatalysts: [
        {
          itemId: "array-ore",
          effect: "Ground array ore reinforces the stance and lets it root more deeply.",
          bonuses: { hp: 16, qi: 10, extraLevel: 1 }
        }
      ],
      bonusPerLevel: { hpMax: 28, physique: 2, qiMax: 8 }
    },
    {
      id: "black-iron-tyrant-body",
      label: "Black Iron Tyrant Body",
      grade: "Legacy",
      pillar: "body",
      category: "Forge Flesh",
      origin: "Northern Forge Citadel",
      realmReq: 1,
      desc: "A forge-body method that tempers flesh with metallic qi until muscle carries the weight of armor.",
      drawbacks: ["Rigid circulation", "Heavy body methods tire the spirit if overused"],
      materialCatalysts: [
        { itemId: "black-iron-ore", effect: "Black iron filings reinforce tendon and bone during the tyrant cycle.", bonuses: { hp: 14, physique: 1, extraLevel: 1 }, successRate: 82, effectPercent: 125 },
        { itemId: "array-ore", effect: "Array ore locks the forge-body pattern into place.", bonuses: { hp: 10, qi: 8 }, successRate: 74, effectPercent: 112 }
      ],
      bonusPerLevel: { hpMax: 20, physique: 2, battleQiMax: 4 }
    },
    {
      id: "venom-cauldron-physique",
      label: "Venom Cauldron Physique",
      grade: "Forbidden",
      pillar: "body",
      category: "Poison Forge",
      origin: "Hidden Marsh Venom Hall",
      realmReq: 1,
      desc: "Turns the body into a poison cauldron, refining toxins into brutal resilience and violent force.",
      drawbacks: ["Reckless poison use can backfire", "Hard on longevity without control"],
      materialCatalysts: [
        { itemId: "venom-gland", effect: "Fresh venom is boiled through the blood channels to strengthen poison resistance.", bonuses: { hp: 12, battleQi: 10, extraLevel: 1 }, successRate: 78, effectPercent: 128 },
        { itemId: "poison-essence", effect: "Refined poison essence pushes the cauldron body beyond normal limits.", bonuses: { hp: 8, physique: 1, battleQi: 12, extraLevel: 1 }, successRate: 66, effectPercent: 145 }
      ],
      bonusPerLevel: { hpMax: 16, physique: 2, battleQiMax: 8 }
    },
    {
      id: "storm-forged-meridian-body",
      label: "Storm-Forged Meridian Body",
      grade: "Rare",
      pillar: "body",
      category: "Forge Flesh",
      origin: "Tempest Gate Martial Hall",
      realmReq: 1,
      desc: "Forges the meridians like tempered wire so the body can carry explosive surges without collapse.",
      drawbacks: ["Strains the nerves", "Poor fit for slow, restorative styles"],
      materialCatalysts: [
        { itemId: "array-ore", effect: "Array residue teaches the meridians to hold a sharper current.", bonuses: { qi: 10, battleQi: 12, extraLevel: 1 }, successRate: 79, effectPercent: 120 },
        { itemId: "black-iron-ore", effect: "Dense iron grit toughens the body's channels against shock.", bonuses: { hp: 12, physique: 1 }, successRate: 75, effectPercent: 115 }
      ],
      bonusPerLevel: { hpMax: 14, physique: 1, battleQiMax: 10 }
    },
    {
      id: "ashen-revenant-muscle-art",
      label: "Ashen Revenant Muscle Art",
      grade: "Rare",
      pillar: "body",
      category: "Tempering",
      origin: "Ash War Memorial Codex",
      realmReq: 2,
      desc: "An ugly but potent art that teaches deadened flesh to reawaken harder after ruin.",
      drawbacks: ["Recovery feels like dying twice", "Best used by stubborn cultivators with high pain tolerance"],
      materialCatalysts: [
        { itemId: "beast-core", effect: "Beast vitality drags ruined muscle fibers back to life.", bonuses: { hp: 16, physique: 1, extraLevel: 1 }, successRate: 80, effectPercent: 122 },
        { itemId: "blood-jade", effect: "Blood jade keeps the half-dead musculature fed long enough to rebuild.", bonuses: { hp: 10, battleQi: 8 }, successRate: 73, effectPercent: 110 }
      ],
      bonusPerLevel: { hpMax: 18, physique: 2 }
    },
    {
      id: "heavenly-stag-bone-mantra",
      label: "Heavenly Stag Bone Mantra",
      grade: "Legacy",
      pillar: "body",
      category: "Bone Scripture",
      origin: "Stag King's Hidden Valley",
      realmReq: 1,
      desc: "A marrow-deep scripture that teaches the body to rebuild with patient, antler-like growth after every fracture.",
      drawbacks: ["Slow and stubborn circulation", "Requires repeated tempering before its full force appears"],
      materialCatalysts: [
        { itemId: "beast-core", effect: "Stag-kin vitality feeds the mantra's patient bone growth.", bonuses: { hp: 14, physique: 1, extraLevel: 1 }, successRate: 79, effectPercent: 122 },
        { itemId: "moon-dew-fungus", effect: "Moon dew keeps the bone scripture cool while it hardens from within.", bonuses: { hp: 10, longevity: 2 }, successRate: 84, effectPercent: 114 }
      ],
      bonusPerLevel: { hpMax: 18, physique: 2, longevityBonus: 3 }
    },
    {
      id: "nine-sun-ember-flesh",
      label: "Nine Sun Ember Flesh",
      grade: "Heaven",
      pillar: "body",
      category: "Forge Flesh",
      origin: "Sable Forge Solar Annex",
      realmReq: 2,
      desc: "A furnace-body method that keeps nine ember cycles burning under the skin until flesh itself feels smithed.",
      drawbacks: ["Consumes qi aggressively", "Refinement runs hot and can exhaust the mind"],
      materialCatalysts: [
        { itemId: "embersteel-ingot", effect: "Embersteel sinks into the body's forge and keeps the inner suns stoked.", bonuses: { hp: 16, battleQi: 12, extraLevel: 1 }, successRate: 81, effectPercent: 128 },
        { itemId: "black-iron-ore", effect: "Black iron anchors the flesh so the ember cycles do not warp it.", bonuses: { hp: 12, physique: 1 }, successRate: 76, effectPercent: 117 }
      ],
      bonusPerLevel: { hpMax: 22, physique: 2, battleQiMax: 8 }
    },
    // ── Soul Pillar ──
    {
      id: "silent-mind-sutra",
      label: "Silent Mind Sutra",
      grade: "Common",
      pillar: "soul",
      category: "Perception",
      origin: "Lotus Archive",
      realmReq: 0,
      desc: "Stills the mind; the student learns to sense qi threads before they break.",
      drawbacks: ["Limited body reinforcement", "Power spikes come slower than aggressive methods"],
      materialCatalysts: [
        {
          itemId: "spirit-herb",
          effect: "Burned herbs calm the sea of consciousness and sharpen quiet observation.",
          bonuses: { qi: 14, soulSense: 1, comprehension: 1 }
        },
        {
          itemId: "soul-amber",
          effect: "Soul amber traps stray thought-waves and lets the sutra settle into cleaner perception.",
          bonuses: { qi: 12, soulSense: 1, comprehension: 1, extraLevel: 1 },
          successRate: 84,
          effectPercent: 122
        },
        {
          itemId: "focus-incense",
          effect: "Focus incense clears surface noise so the mind-sutra can refine deeper without leaking insight.",
          bonuses: { qi: 16, soulSense: 1, comprehension: 2, extraLevel: 1 },
          successRate: 88,
          effectPercent: 128
        }
      ],
      bonusPerLevel: { qiMax: 14, soulSense: 1 }
    },
    {
      id: "void-resonance-art",
      label: "Void Resonance Art",
      grade: "Legacy",
      pillar: "soul",
      category: "Resonance",
      origin: "Void Rift Mirror School",
      realmReq: 2,
      desc: "The student learns to mirror the void, making qi channels near-invisible to enemies.",
      drawbacks: ["Alien circulation is hard to stabilize", "Training failures can feel disorienting"],
      materialCatalysts: [
        {
          itemId: "array-ore",
          effect: "Formation-threaded ore helps the mind lock onto void harmonics.",
          bonuses: { qi: 18, soulSense: 1, battleQi: 8, extraLevel: 1 }
        },
        {
          itemId: "soul-amber",
          effect: "Soul amber holds the void echo steady long enough for the art to resonate cleanly.",
          bonuses: { qi: 14, soulSense: 1, comprehension: 1 },
          successRate: 79,
          effectPercent: 120
        },
        {
          itemId: "void-lotus",
          effect: "Void lotus thins the boundary between thought and silence, making resonance unnervingly pure.",
          bonuses: { qi: 22, soulSense: 2, comprehension: 1, extraLevel: 1 },
          successRate: 76,
          effectPercent: 138
        }
      ],
      bonusPerLevel: { qiMax: 20, soulSense: 2, battleQiMax: 8 }
    },
    {
      id: "heaven-ear-method",
      label: "Heaven Ear Method",
      grade: "Heaven",
      pillar: "soul",
      category: "Perception",
      origin: "Echo Prism Elder Lineage",
      realmReq: 3,
      desc: "The cultivator can sense soul fluctuations across a region. Increases comprehension and insight.",
      drawbacks: ["Overstimulation risk", "Requires calm environments to fully exploit"],
      materialCatalysts: [
        {
          itemId: "array-ore",
          effect: "Prismatic array residue sharpens distant echoes into coherent insight.",
          bonuses: { qi: 16, soulSense: 1, comprehension: 2 }
        },
        {
          itemId: "soul-amber",
          effect: "Soul amber dampens false echoes so the heaven-ear catches only what matters.",
          bonuses: { qi: 14, soulSense: 1, comprehension: 2, extraLevel: 1 },
          successRate: 81,
          effectPercent: 121
        },
        {
          itemId: "focus-incense",
          effect: "Focus incense sharpens the listening mind and helps the method separate whispers from noise.",
          bonuses: { qi: 12, soulSense: 1, comprehension: 2 },
          successRate: 86,
          effectPercent: 118
        }
      ],
      bonusPerLevel: { qiMax: 16, soulSense: 2, comprehension: 2 }
    },
    {
      id: "star-chart-circulation",
      label: "Star Chart Circulation",
      grade: "Rare",
      pillar: "soul",
      category: "Resonance",
      origin: "Wandering Astronomer Lineage",
      realmReq: 1,
      desc: "Models qi circulation after constellation paths. Efficient but cryptic to learn.",
      drawbacks: ["Cryptic theory slows mastery", "Requires patience and high comprehension"],
      materialCatalysts: [
        {
          itemId: "array-ore",
          effect: "Array ore dust maps luminous routes across the inner heavens.",
          bonuses: { qi: 15, comprehension: 1, extraLevel: 1 }
        },
        {
          itemId: "soul-amber",
          effect: "Soul amber fixes each stellar route in place so the circulation loses less force between turns.",
          bonuses: { qi: 12, soulSense: 1, comprehension: 1 },
          successRate: 82,
          effectPercent: 119
        }
      ],
      bonusPerLevel: { qiMax: 18, soulSense: 1, comprehension: 1 }
    },
    {
      id: "dream-lotus-meditation",
      label: "Dream Lotus Meditation",
      grade: "Refined",
      pillar: "soul",
      category: "Foundation",
      origin: "Jade Delta Spirit Hall",
      realmReq: 0,
      desc: "Uses natural spirit-herb essence to deepen soul sense during sleep cycles.",
      drawbacks: ["Gentle pace", "Combat gains lag behind harsher soul arts"],
      materialCatalysts: [
        {
          itemId: "spirit-herb",
          effect: "Dream-soaked herbs coax the spirit sea into a more lucid rhythm.",
          bonuses: { qi: 16, soulSense: 1, longevity: 2, extraLevel: 1 }
        },
        {
          itemId: "moon-dew-fungus",
          effect: "Moon dew fungus cools the sleeping spirit and makes the dream field hold steady longer.",
          bonuses: { qi: 14, soulSense: 1, comprehension: 1, longevity: 2 },
          successRate: 84,
          effectPercent: 124
        },
        {
          itemId: "focus-incense",
          effect: "Focus incense turns loose dream images into a disciplined meditative cycle.",
          bonuses: { qi: 18, soulSense: 1, comprehension: 1, extraLevel: 1 },
          successRate: 87,
          effectPercent: 126
        }
      ],
      bonusPerLevel: { qiMax: 12, soulSense: 1, longevityBonus: 3 }
    },
    {
      id: "soul-forging-rite",
      label: "Soul Forging Rite",
      grade: "Forbidden",
      pillar: "soul",
      category: "Foundation",
      origin: "Ancient Remnant Sect",
      realmReq: 2,
      desc: "A rite that forcibly expands the soul sea. High risk, high reward.",
      drawbacks: ["Unstable for the unprepared", "A harsh rite that invites backlash if rushed"],
      materialCatalysts: [
        {
          itemId: "blood-jade",
          effect: "Blood jade cracks under pressure and floods the rite with savage spiritual force.",
          bonuses: { qi: 20, soulSense: 1, battleQi: 10, extraLevel: 1 }
        },
        {
          itemId: "array-ore",
          effect: "Array ore braces the soul sea against collapse while the rite burns hotter.",
          bonuses: { qi: 14, comprehension: 1 }
        },
        {
          itemId: "soul-amber",
          effect: "Soul amber seals the worst fractures and lets the soul-forging rite expand more cleanly.",
          bonuses: { qi: 16, soulSense: 1, comprehension: 1 },
          successRate: 77,
          effectPercent: 122
        },
        {
          itemId: "poison-essence",
          effect: "Poison essence makes the rite vicious enough to scour weakness from the soul sea itself.",
          bonuses: { qi: 16, battleQi: 12, soulSense: 1, extraLevel: 1 },
          successRate: 64,
          effectPercent: 146
        }
      ],
      bonusPerLevel: { qiMax: 24, soulSense: 3, battleQiMax: 10 }
    },
    {
      id: "mirror-lake-heart-scripture",
      label: "Mirror Lake Heart Scripture",
      grade: "Refined",
      pillar: "soul",
      category: "Reflection",
      origin: "Moon Basin Hermitage",
      realmReq: 1,
      desc: "A lucid heart-manual that turns stillness into a clear reflective mind resistant to spiritual turbulence.",
      drawbacks: ["Requires patience", "Slow to bloom in violent environments"],
      materialCatalysts: [
        { itemId: "moon-dew-fungus", effect: "Moon dew vapors smooth the heart-water until reflection becomes effortless.", bonuses: { qi: 16, soulSense: 1, comprehension: 1, extraLevel: 1 }, successRate: 83, effectPercent: 122 },
        { itemId: "soul-amber", effect: "Soul amber traps emotional static and deepens the scripture's clarity.", bonuses: { qi: 12, comprehension: 2 }, successRate: 76, effectPercent: 118 }
      ],
      bonusPerLevel: { qiMax: 18, soulSense: 1, comprehension: 1 }
    },
    {
      id: "thousand-venoms-heart-method",
      label: "Thousand Venoms Heart Method",
      grade: "Forbidden",
      pillar: "soul",
      category: "Poison Mind",
      origin: "Creeping Mist Inner Court",
      realmReq: 2,
      desc: "Refines poison through thought itself, turning toxicity into spiritual pressure and warped insight.",
      drawbacks: ["Mind can grow cruel and unstable", "Best handled by careful poison users"],
      materialCatalysts: [
        { itemId: "poison-essence", effect: "Poison essence floods the heart method and sharpens deadly focus.", bonuses: { qi: 18, soulSense: 1, battleQi: 10, extraLevel: 1 }, successRate: 69, effectPercent: 142 },
        { itemId: "venom-gland", effect: "Crude venom gives the method teeth at the cost of stability.", bonuses: { qi: 10, comprehension: 1 }, successRate: 61, effectPercent: 126 }
      ],
      bonusPerLevel: { qiMax: 20, soulSense: 2, battleQiMax: 8 }
    },
    {
      id: "celestial-wheel-visualization",
      label: "Celestial Wheel Visualization",
      grade: "Heaven",
      pillar: "soul",
      category: "Resonance",
      origin: "Astral Wheel Pavilion",
      realmReq: 2,
      desc: "Forms revolving stars within the mind to grind thought into luminous precision.",
      drawbacks: ["Demanding on attention", "Can feel detached from ordinary emotion"],
      materialCatalysts: [
        { itemId: "array-ore", effect: "Array ore sketches revolving stellar paths across the soul sea.", bonuses: { qi: 16, comprehension: 2, extraLevel: 1 }, successRate: 81, effectPercent: 124 },
        { itemId: "soul-amber", effect: "Soul amber preserves each luminous thought so the wheel turns cleaner.", bonuses: { qi: 12, soulSense: 1, comprehension: 1 }, successRate: 79, effectPercent: 120 }
      ],
      bonusPerLevel: { qiMax: 20, soulSense: 1, comprehension: 2 }
    },
    {
      id: "demon-heart-resonance",
      label: "Demon Heart Resonance",
      grade: "Legacy",
      pillar: "soul",
      category: "Will",
      origin: "Ruin Mountain Saber Records",
      realmReq: 2,
      desc: "A domineering will-art that compresses fear, rage, and ambition into a resonant spiritual core.",
      drawbacks: ["Easy to become overbearing", "Poor fit for serene cultivators"],
      materialCatalysts: [
        { itemId: "blood-jade", effect: "Blood jade gives the heart resonance a harsher, more forceful beat.", bonuses: { qi: 14, battleQi: 12, extraLevel: 1 }, successRate: 74, effectPercent: 130 },
        { itemId: "beast-core", effect: "Beast instinct burns into the will-art and makes it hit harder.", bonuses: { qi: 10, soulSense: 1, battleQi: 8 }, successRate: 71, effectPercent: 118 }
      ],
      bonusPerLevel: { qiMax: 16, soulSense: 2, battleQiMax: 10 }
    },
    {
      id: "painted-dream-devil-scripture",
      label: "Painted Dream Devil Scripture",
      grade: "Forbidden",
      pillar: "soul",
      category: "Dream Poison",
      origin: "Night Canvas Pavilion",
      realmReq: 2,
      desc: "An unclean but brilliant soul-manual that turns dream imagery into hooks for poison, fear, and suggestion.",
      drawbacks: ["Warps sleep and emotion", "Repeated use makes ordinary meditation feel hollow"],
      materialCatalysts: [
        { itemId: "grave-bloom", effect: "Grave bloom opens the dream field and lets the scripture paint darker, deeper symbols.", bonuses: { qi: 14, soulSense: 1, comprehension: 1, extraLevel: 1 }, successRate: 74, effectPercent: 126 },
        { itemId: "poison-essence", effect: "Poison essence stains the dream sea and sharpens hostile intent.", bonuses: { qi: 12, battleQi: 12, extraLevel: 1 }, successRate: 66, effectPercent: 143 }
      ],
      bonusPerLevel: { qiMax: 18, soulSense: 2, comprehension: 1, battleQiMax: 8 }
    },
    {
      id: "azure-pavilion-breath",
      label: "Azure Pavilion Breath",
      grade: "Refined",
      pillar: "soul",
      category: "Breath Weaving",
      origin: "Azure Pavilion Guest Hall",
      realmReq: 1,
      desc: "A graceful breath-art that treats each exhale like thread, weaving loose qi into a neater spiritual fabric.",
      drawbacks: ["Modest offensive growth", "Works best for disciplined and patient cultivators"],
      materialCatalysts: [
        { itemId: "cloud-silk", effect: "Cloud silk smooths the breath-weave and keeps the pavilion pattern from snagging.", bonuses: { qi: 15, soulSense: 1, extraLevel: 1 }, successRate: 86, effectPercent: 118 },
        { itemId: "soul-amber", effect: "Soul amber holds each breath-thread in place long enough to settle deeper.", bonuses: { qi: 10, comprehension: 1 }, successRate: 79, effectPercent: 115 }
      ],
      bonusPerLevel: { qiMax: 16, soulSense: 1, comprehension: 1 }
    }
  ],
  // ─── City Landmarks (keyed by city id) ───────────────────────────────────
  cityLandmarks: {
    "ember":       ["Ashen Forge Market", "Ember Gate Sect Hall", "Cultivator Ridge Tea House", "Ironbound Guild Post"],
    "cinder":      ["Cinder Bazaar", "Bastion Arena Yard", "Wanderer Rest Inn", "Spirit Pill Counter"],
    "ashgate":     ["Ash Road Market", "Borough Elder Hall", "Pilgrim Tea Stall", "Formation Scribe Office"],
    "char-haven":  ["Haven Night Market", "Char Elder Pavilion", "Jade Road Tea House", "Dungeon Bond Prison"],
    "sable-forge": ["Sable Weapon Hall", "Forger Alliance HQ", "Bronze Road Inn", "Scripture Exchange"],
    "grim-terrace":["Terrace Auction Hall", "Stone Court Elder", "Fog Path Tea Stall", "Hidden Scripture Vault"],
    "jade":        ["Jade Harbor Exchange", "Pearl Fish Market", "River Sect Outpost", "Harbor Tea Lodge"],
    "lotus":       ["Lotus Archive Hall", "Scroll Transcriber Row", "Spirit Pill Atelier", "Garden Courtyard Inn"],
    "rain-wharf":  ["Wharf Fish Market", "Sailor Tea House", "Storm Warning Sect Post", "Relic Pawn Stall"],
    "bamboo-rise": ["Bamboo Rise Market", "Forest Elder Pavilion", "Spirit Herb Atelier", "Scholar Road Inn"],
    "mist-pier":   ["Mist Night Bazaar", "Spirit Boat Dock", "Fog Hall Tea House", "Smuggler Alley"],
    "green-vault": ["Green Vault Exchange", "Formation Array Shop", "District Elder Court", "Relic Vault Door"],
    "iron":        ["Iron Howl Arena", "War Clan Hall", "Bone Tea Stall", "Beast Core Market"],
    "fang-cross":  ["Fang Cross Bazaar", "Mercenary Guild Hall", "Claw Path Inn", "Chain Auction Yard"],
    "red-cliff":   ["Red Cliff Market", "Cliff Sect Hall", "Ember Tea House", "Blood Jade Counter"],
    "bone-spear":  ["Bone Spear Forge", "Ward Elder Hall", "Dusty Path Inn", "Trophy Auction Block"],
    "steel-marsh": ["Steel Marsh Forge", "Marsh Sect Commune", "Watchtower Tea House", "Array Core Market"],
    "war-drum":    ["War Drum Arena", "City Gate War Council", "Drum Hall Inn", "War Relic Vault"],
    "void":        ["Void Mirror Exchange", "Lantern Capital Array Hall", "Mirror Lodge Tea House", "Forbidden Archive"],
    "night-shard": ["Night Shard Port Market", "Dark Sect Outpost", "Ember Night Inn", "Soul Shard Counter"],
    "mirror-step": ["Mirrorstep Relic Hall", "Enclave Elder Pavilion", "Prism Tea House", "Formation Test Arena"],
    "riftwatch":   ["Riftwatch Armory", "Bastion Sect Gate", "Warden's Tea Hall", "Void Relic Cache"],
    "hollow-sun":  ["Hollow Sun Auction", "Bastille Archives", "Sun Path Tea Lodge", "Heaven Relic Exchange"],
    "echo-prism":  ["Echo Court Grand Exchange", "Prism Elder Council", "Resonance Tea Hall", "Ascension Archive"],
    "starfall":    ["Starfall Array Docks", "Terrace Saint Hall", "Meteor Tea Arcade", "Void Lotus Exchange"],
    "saint-vigil": ["Saint Vigil Tribunal", "Crown Furnace Market", "Watcher Pavilion", "Heaven Bone Treasury"],
    "auric-steps": ["Auric Pilgrim Market", "Step Array Academy", "Radiant Tea Steps", "Star-Metal Yard"],
    "dao-furnace": ["Dao Furnace Grand Forge", "Immortal Contract Hall", "Ash Crown Inn", "Crystal Archive"],
    "crown-void":  ["Crown Void Court", "Sovereign Scripture Vault", "Dao Glass Causeway", "Final Heaven Exchange"],
    "ashen-throne": ["Ashen Throne Arena", "Fallen Saint Tribunal", "Bone Banner Street", "Immortal Dew Depot"]
  },
  sectOrders: [
    { id: "ashen-frontier-sect", name: "Ashen Frontier Sect", regionId: "ashen-frontier", hostCityId: "ember", tier: "regional", primary: true },
    { id: "sable-ember-monastery", name: "Sable Ember Monastery", regionId: "ashen-frontier", hostCityId: "sable-forge", tier: "regional" },
    { id: "jade-lotus-pavilion", name: "Jade Lotus Pavilion", regionId: "jade-delta", hostCityId: "jade", tier: "regional", primary: true },
    { id: "green-vault-scriptorium", name: "Green Vault Scriptorium", regionId: "jade-delta", hostCityId: "green-vault", tier: "regional" },
    { id: "iron-howl-warhall", name: "Iron Howl Warhall", regionId: "iron-wilds", hostCityId: "iron", tier: "regional", primary: true },
    { id: "red-cliff-blood-court", name: "Red Cliff Blood Court", regionId: "iron-wilds", hostCityId: "red-cliff", tier: "regional" },
    { id: "void-lantern-order", name: "Void Lantern Order", regionId: "void-rift", hostCityId: "void", tier: "high", primary: true },
    { id: "echo-prism-scholarium", name: "Echo Prism Scholarium", regionId: "void-rift", hostCityId: "echo-prism", tier: "high" },
    { id: "starfall-saint-cloister", name: "Starfall Saint Cloister", regionId: "celestial-plateau", hostCityId: "starfall", tier: "saint", primary: true },
    { id: "auric-lotus-heavenschool", name: "Auric Lotus Heavenschool", regionId: "celestial-plateau", hostCityId: "auric-steps", tier: "saint" },
    { id: "dao-crown-tribunal", name: "Dao Crown Tribunal", regionId: "sovereign-wastes", hostCityId: "crown-void", tier: "sovereign", primary: true },
    { id: "immortal-furnace-sanctum", name: "Immortal Furnace Sanctum", regionId: "sovereign-wastes", hostCityId: "dao-furnace", tier: "immortal" }
  ],
  equipmentTemplates: [
    { id: "charred-blade", label: "Charred Blade", slot: "weapon", cost: 85, value: 48, weight: 5, maxStack: 1, bonuses: { physique: 2, hpMax: 18 } },
    { id: "jade-silk-robe", label: "Jade Silk Robe", slot: "robe", cost: 95, value: 54, weight: 3, maxStack: 1, bonuses: { soulSense: 2, qiMax: 22 } },
    { id: "rift-thread-boots", label: "Rift Thread Boots", slot: "boots", cost: 80, value: 44, weight: 2, maxStack: 1, bonuses: { fortune: 2, battleQiMax: 12 } },
    { id: "echo-talisman", label: "Echo Talisman", slot: "accessory", cost: 110, value: 62, weight: 1, maxStack: 1, bonuses: { comprehension: 3, qiMax: 14 } },
    { id: "ember-iron-helm", label: "Ember Iron Helm", slot: "head", cost: 88, value: 50, weight: 3, maxStack: 1, bonuses: { hpMax: 16, physique: 1 } },
    { id: "marrow-grip-gloves", label: "Marrow Grip Gloves", slot: "hands", cost: 92, value: 52, weight: 2, maxStack: 1, bonuses: { physique: 1, battleQiMax: 8 } },
    { id: "blood-jade-spear", label: "Blood Jade Spear", slot: "weapon", cost: 170, value: 96, weight: 6, maxStack: 1, bonuses: { physique: 4, hpMax: 35 } },
    { id: "voidward-cuirass", label: "Voidward Cuirass", slot: "robe", cost: 190, value: 108, weight: 4, maxStack: 1, bonuses: { soulSense: 4, hpMax: 26, qiMax: 18 } },
    { id: "starstep-greaves", label: "Starstep Greaves", slot: "boots", cost: 155, value: 88, weight: 3, maxStack: 1, bonuses: { fortune: 4, battleQiMax: 18 } },
    { id: "heavens-eye-pendant", label: "Heavens Eye Pendant", slot: "accessory", cost: 215, value: 124, weight: 1, maxStack: 1, bonuses: { comprehension: 5, soulSense: 2, qiMax: 30 } },
    { id: "veilseer-circlet", label: "Veilseer Circlet", slot: "head", cost: 148, value: 82, weight: 1, maxStack: 1, bonuses: { soulSense: 2, comprehension: 2, qiMax: 10 } },
    { id: "silk-channel-gloves", label: "Silk Channel Gloves", slot: "hands", cost: 136, value: 76, weight: 1, maxStack: 1, bonuses: { soulSense: 1, qiMax: 12, battleQiMax: 6 } },
    { id: "emberwolf-knife", label: "Emberwolf Knife", slot: "weapon", cost: 125, value: 70, weight: 4, maxStack: 1, bonuses: { physique: 3, battleQiMax: 10 } },
    { id: "mist-veil-cloak", label: "Mist Veil Cloak", slot: "robe", cost: 140, value: 78, weight: 2, maxStack: 1, bonuses: { soulSense: 3, qiMax: 16, fortune: 1 } },
    { id: "stone-root-sandals", label: "Stone Root Sandals", slot: "boots", cost: 118, value: 66, weight: 2, maxStack: 1, bonuses: { hpMax: 20, physique: 1 } },
    { id: "scribe-bone-ring", label: "Scribe Bone Ring", slot: "accessory", cost: 132, value: 74, weight: 1, maxStack: 1, bonuses: { comprehension: 2, soulSense: 1, qiMax: 10 } },
    { id: "thunder-rib-halberd", label: "Thunder Rib Halberd", slot: "weapon", cost: 245, value: 142, weight: 7, maxStack: 1, bonuses: { physique: 5, battleQiMax: 16 } },
    { id: "mirror-thread-cassock", label: "Mirror Thread Cassock", slot: "robe", cost: 235, value: 136, weight: 3, maxStack: 1, bonuses: { soulSense: 4, qiMax: 24, comprehension: 2 } },
    { id: "voidcurrent-sabatons", label: "Voidcurrent Sabatons", slot: "boots", cost: 220, value: 126, weight: 3, maxStack: 1, bonuses: { fortune: 3, battleQiMax: 22, hpMax: 10 } },
    { id: "bone-lantern-seal", label: "Bone Lantern Seal", slot: "accessory", cost: 248, value: 144, weight: 1, maxStack: 1, bonuses: { comprehension: 4, soulSense: 3, battleQiMax: 12 } },
    { id: "saint-flame-diadem", label: "Saint Flame Diadem", slot: "head", cost: 320, value: 188, weight: 1, maxStack: 1, bonuses: { soulSense: 3, comprehension: 2, qiMax: 18 } },
    { id: "dao-lattice-gauntlets", label: "Dao Lattice Gauntlets", slot: "hands", cost: 338, value: 198, weight: 2, maxStack: 1, bonuses: { physique: 2, soulSense: 1, battleQiMax: 18 } }
  ],
  // ─── Battle Arts (combat-specific techniques, separate from cultivation) ─────
  // qiCost: battle qi spent per use
  // baseDmg: flat damage before multipliers
  // physMult: multiplier on physique stat
  // soulMult: multiplier on soul sense stat (defaults 0)
  // special: side-effect string (null = none)
  battleTechniques: [
    {
      id: "crushing-wave",
      label: "Crushing Wave Strike",
      category: "Force",
      desc: "Drive qi into both fists and release a wave of force that crushes armor.",
      qiCost: 10,
      realmReq: 0,
      baseDmg: 22,
      physMult: 1.5,
      soulMult: 0,
      special: null
    },
    {
      id: "shadowstep",
      label: "Shadow Step",
      category: "Evasion",
      desc: "Borrow the space between breaths to slip behind the enemy. Greatly reduces incoming damage for one round.",
      qiCost: 12,
      realmReq: 0,
      baseDmg: 10,
      physMult: 0.8,
      soulMult: 0,
      special: "evade"
    },
    {
      id: "iron-bell-guard",
      label: "Iron Bell Guard",
      category: "Defense",
      desc: "Coil hardened qi around the body, absorbing the next blow and generating battle qi.",
      qiCost: 8,
      realmReq: 0,
      baseDmg: 4,
      physMult: 0.5,
      soulMult: 0,
      special: "fortify"
    },
    {
      id: "thunder-palm",
      label: "Thunder Palm",
      category: "Lightning",
      desc: "Channel volatile qi through the palm, sending tremors through the enemy's channels — draining their qi.",
      qiCost: 16,
      realmReq: 1,
      baseDmg: 30,
      physMult: 2.0,
      soulMult: 0,
      special: "drain-qi"
    },
    {
      id: "spirit-rend",
      label: "Spirit Rend",
      category: "Soul",
      desc: "Strike at the spirit directly — soul-scaled damage that bypasses physical defenses.",
      qiCost: 18,
      realmReq: 1,
      baseDmg: 22,
      physMult: 0.6,
      soulMult: 3.5,
      special: null
    },
    {
      id: "bloodfire-strike",
      label: "Bloodfire Strike",
      category: "Forbidden",
      desc: "Burn a fraction of longevity to output explosive power. Dangerous but devastating.",
      qiCost: 22,
      realmReq: 2,
      baseDmg: 50,
      physMult: 2.5,
      soulMult: 0,
      special: "longevity-cost"
    },
    {
      id: "void-pierce",
      label: "Void Pierce",
      category: "Void",
      desc: "A strike that briefly phases through space, bypassing the enemy's current defensive state.",
      qiCost: 18,
      realmReq: 2,
      baseDmg: 35,
      physMult: 1.8,
      soulMult: 0,
      special: "ignore-defense"
    },
    {
      id: "meridian-lock",
      label: "Meridian Lock",
      category: "Control",
      desc: "Seize the enemy's qi channels with precision, halting their next attack entirely.",
      qiCost: 14,
      realmReq: 1,
      baseDmg: 14,
      physMult: 0.8,
      soulMult: 1.5,
      special: "skip-enemy-turn"
    },
    {
      id: "qi-burst",
      label: "Qi Burst",
      category: "Force",
      desc: "Violently expel condensed qi in all directions. Max damage but no passive gains.",
      qiCost: 24,
      realmReq: 2,
      baseDmg: 45,
      physMult: 1.6,
      soulMult: 0,
      special: null
    },
    {
      id: "predator-stance",
      label: "Predator Stance",
      category: "Recovery",
      desc: "Enter a heightened combat state. Moderate damage plus immediate battle qi recovery.",
      qiCost: 6,
      realmReq: 0,
      baseDmg: 12,
      physMult: 1.0,
      soulMult: 0,
      special: "bqi-regen"
    }
  ],
  spiritTemplates: [
    {
      id: "emberstorm-crow",
      label: "Emberstorm Crow",
      grade: "Ancient",
      realmReq: 6,
      vesselItemId: "vessel-emberstorm-crow",
      desc: "A tyrant crow spirit born in thunderfire storms. Fast, vicious, and drawn to explosive qi circulation.",
      favoredItemIds: ["embersteel-ingot", "stormglass-shard", "saintfire-pellet"],
      favoredTags: ["fire", "lightning", "spirit"],
      passiveBonuses: { qiMax: 12, battleQiMax: 10, fortune: 1 },
      perLevelBonuses: { qiMax: 2, battleQiMax: 3, soulSense: 1 },
      assist: {
        label: "Stormfire Dive",
        desc: "The crow dives through the enemy's channels in a streak of ash lightning.",
        baseDamage: 12,
        damagePerLevel: 4,
        enemyQiBurn: 6
      }
    },
    {
      id: "dreamveil-fox",
      label: "Dreamveil Fox",
      grade: "Ancient",
      realmReq: 6,
      vesselItemId: "vessel-dreamveil-fox",
      desc: "A fox spirit woven from dream-mist and moonlit intent, famed for deceptive movement and soul-soothing whispers.",
      favoredItemIds: ["grave-bloom", "focus-incense", "void-meridian-elixir", "ancestral-spirit-incense"],
      favoredTags: ["yin", "soul", "void", "herb"],
      passiveBonuses: { soulSense: 1, comprehension: 1, qiMax: 8 },
      perLevelBonuses: { soulSense: 1, comprehension: 1, qiMax: 2 },
      assist: {
        label: "Moondream Veil",
        desc: "The fox blurs across the battlefield, slicing the spirit and returning refined qi to its master.",
        baseDamage: 9,
        damagePerLevel: 3,
        qiRestore: 8,
        battleQiRestore: 6
      }
    },
    {
      id: "tyrant-ape",
      label: "Tyrant Ape",
      grade: "Ancient",
      realmReq: 6,
      vesselItemId: "vessel-tyrant-ape",
      desc: "A brutal mountain-ape spirit that values marrow, blood, and overwhelming force over elegance.",
      favoredItemIds: ["beast-core", "saint-bone-fragment", "tempered-marrow-paste"],
      favoredTags: ["beast", "blood", "bone", "metal", "body"],
      passiveBonuses: { hpMax: 18, physique: 2 },
      perLevelBonuses: { hpMax: 6, physique: 1, battleQiMax: 1 },
      assist: {
        label: "Heaven-Splitting Smash",
        desc: "The ape spirit crashes down with savage force and braces your stance for the next exchange.",
        baseDamage: 14,
        damagePerLevel: 5,
        grantDefense: true,
        hpRestore: 6
      }
    },
    {
      id: "starlaw-qilin",
      label: "Starlaw Qilin",
      grade: "Mythic",
      realmReq: 7,
      vesselItemId: "vessel-starlaw-qilin",
      desc: "A sovereign-grade qilin spirit carrying fragments of saint law and heavenly order. It is difficult to bind and harder to outgrow.",
      favoredItemIds: ["dao-crystal", "immortal-dew", "dao-heart-tonic", "soul-forge-nectar"],
      favoredTags: ["dao", "saint", "immortal", "spirit"],
      passiveBonuses: { soulSense: 1, comprehension: 1, battleQiMax: 8, qiMax: 8 },
      perLevelBonuses: { comprehension: 1, battleQiMax: 2, qiMax: 2 },
      assist: {
        label: "Star-Law Descent",
        desc: "The qilin spirit stamps down a law-marked starfire pulse that wounds the enemy and steadies your meridians.",
        baseDamage: 15,
        damagePerLevel: 4,
        hpRestore: 10,
        qiRestore: 10,
        battleQiRestore: 8
      }
    }
  ],
  events: [
    {
      title: "Flicker in the Meridian",
      text: "Your qi circulation stabilizes after a painful cycle.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.qi = Math.min(state.qiMax, state.qi + 18);
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
      text: "You find a fragment of an ancient body-soul tempering method.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.stats.physique += 1;
        state.stats.soulSense += 1;
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
          state.hp = Math.max(1, state.hp - 14);
          state.qi = Math.max(0, state.qi - 16);
          state.logClass = "bad";
        } else {
          state.qi = Math.min(state.qiMax, state.qi + 10);
          state.logClass = "good";
        }
      }
    },
    {
      title: "Ancestral Technique Fragment",
      text: "A worn scroll surfaces, hinting at a forgotten cultivation method.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.techniqueScrolls = (state.techniqueScrolls || 0) + 1;
        state.logClass = "good";
      }
    },
    {
      title: "Beast Tide Omen",
      text: "Scouts signal unusual beast movement near the region border.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.breakthroughPermit = true;
        state.logClass = "good";
      }
    },
    {
      title: "Soul Tremor at Dawn",
      text: "A resonance from the ley lines briefly amplifies your soul sea.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.qi = Math.min(state.qiMax, state.qi + Math.floor(state.qiMax * 0.25));
        state.stats.soulSense += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Wandering Beggar's Riddle",
      text: "An old beggar asks you a cultivation riddle. You solve it and receive a blessing.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.stats.comprehension += 2;
        state.stats.fortune += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Street Duel Challenge",
      rumor: "A plaza duelist is looking for face and an audience.",
      text: "A hot-headed cultivator cuts across the street as onlookers drift back to form a ring around you.",
      scenes: [
        {
          id: "plaza-showoff",
          weight: 3,
          rumor: "A plaza showoff is baiting passersby into public duels.",
          text: "A spear-bearing youth twirls into the center of the avenue and loudly demands someone worth embarrassing. By the time they settle on you, the whole street has slowed to watch.",
          tags: ["Crowd", "Face"]
        },
        {
          id: "sect-cub",
          weight: 2,
          rumor: "A sect junior is trying to recover face after a public humiliation.",
          text: "A junior disciple with a bruised jaw steps down from a tea house railing and names you as the witness they will redeem themselves against.",
          tags: ["Sect Junior", "Pride"]
        }
      ],
      intuition: {
        threshold: 11,
        text: "Their meridians flicker unevenly. The bravado is real, but the circulation underneath it is unstable and easy to bait."
      },
      battle: {
        label: "Accept The Duel",
        desc: "Let the street clear and answer in force.",
        enemyName: "Street Duelist",
        hpScale: 0.78,
        qiScale: 0.82,
        qiCost: 8,
        lootFocus: "ambush",
        reward: { silver: 24, fortune: 1, comprehension: 1 },
        victoryText: "The crowd remembers the way you ended the duel and showers you with silver and open admiration."
      },
      choices: [
        {
          label: "Dissect Their Form",
          desc: "Read the stance before the clash and win without fighting for long.",
          check: { stat: "soulSense", bonusStat: "comprehension", difficulty: 22 },
          onSuccess: (state) => {
            state.stats.comprehension += 1;
            state.stats.fortune += 2;
            state.wallet += 12;
            state.logClass = "good";
          },
          onFailure: (state) => {
            state.hp = Math.max(1, state.hp - 10);
            state.stats.karma -= 1;
            state.logClass = "bad";
          },
          successText: "You expose the flaw in their breathing and the duel dies before it begins.",
          failText: "You misread the first exchange and leave with your pride scraped raw."
        },
        {
          label: "Refuse Without Bowing",
          desc: "Deny the spectacle and keep moving.",
          onResolve: (state) => {
            state.stats.karma += 1;
            state.stats.fortune += 1;
            state.logClass = "good";
          }
        }
      ],
      canTrigger: () => true,
      onResolve: (state) => {
        state.stats.karma += 1;
        state.stats.fortune += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Forgotten Fangkou Grove",
      text: "You discover an untouched grove radiating with spirit essence. You absorb its qi.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.qi = Math.min(state.qiMax, state.qi + Math.floor(state.qiMax * 0.3));
        state.qiPeak = Math.max(state.qiPeak || 0, state.qi);
        state.stats.soulSense += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Corruption in the Market",
      text: "You discover a merchant running illegal operations. Report or ignore?",
      canTrigger: () => true,
      choices: [
        {
          label: "Report The Merchant",
          desc: "Lean on karma and standing with the law.",
          check: { stat: "karma", bonusStat: "fortune", difficulty: 16 },
          onSuccess: (state) => {
            state.stats.karma += 2;
            state.wallet += 30;
            state.logClass = "good";
          },
          onFailure: (state) => {
            state.wallet -= Math.min(20, state.wallet);
            state.stats.karma -= 1;
            state.logClass = "bad";
          },
          successText: "The inspectors raid the stall and quietly leave you a reward.",
          failText: "The merchant's backers hear your name before the guards do."
        },
        {
          label: "Take A Quiet Bribe",
          desc: "Profit now and look away.",
          tone: "warn",
          onResolve: (state) => {
            state.wallet += 24;
            state.stats.karma -= 2;
            state.logClass = "";
          }
        },
        {
          label: "Walk Past",
          desc: "Avoid the tangle entirely.",
          onResolve: (state) => {
            state.stats.fortune += 1;
            state.logClass = "good";
          }
        }
      ],
      onResolve: (state) => {
        if (Math.random() < 0.5) {
          state.stats.karma += 2;
          state.wallet += 30;
          state.logClass = "good";
        } else {
          state.stats.karma -= 1;
          state.wallet -= 20;
          state.logClass = "bad";
        }
      }
    },
    {
      title: "Dreamscape Intrusion",
      text: "During meditation, an ancient consciousness speaks to you. You gain insight.",
      canTrigger: (state) => state.stats.soulSense >= 8,
      onResolve: (state) => {
        state.stats.comprehension += 3;
        state.stats.soulSense += 2;
        state.legacyNotes += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Beast Pack Territory",
      rumor: "Something large has been circling the outer wards at night.",
      text: "Tracks, shredded banners, and a coppery smell lead you toward a beast pack's feeding ground just outside the city routes.",
      intuition: {
        threshold: 10,
        text: "The killing intent is layered. There is at least one alpha hanging back while lesser beasts test the perimeter."
      },
      battle: {
        label: "Drive The Pack Off",
        desc: "Step into the territory and break the beast line yourself.",
        enemyName: "Territory Alpha",
        hpScale: 0.84,
        qiScale: 0.88,
        lootFocus: "beasts",
        reward: { itemId: "beast-core", itemQty: 1, physique: 1 },
        victoryText: "With the alpha down, scavengers and handlers strip the site. The best core is yours."
      },
      choices: [
        {
          label: "Skim The Edge",
          desc: "Take only what the pack cannot immediately contest.",
          check: { stat: "soulSense", bonusStat: "fortune", difficulty: 19 },
          onSuccess: (state) => {
            addItemToInventory(state, Math.random() > 0.5 ? "beast-core" : "blood-jade", 1);
            state.stats.fortune += 1;
            state.logClass = "good";
          },
          onFailure: (state) => {
            state.hp = Math.max(1, state.hp - 12);
            state.logClass = "bad";
          },
          successText: "You skim the remains and leave before the pack closes the trap.",
          failText: "The outer ring snaps shut and you pay for your greed in blood."
        },
        {
          label: "Retreat And Mark The Route",
          desc: "Leave the pack alone and sell the information later.",
          onResolve: (state) => {
            state.wallet += 14;
            state.stats.comprehension += 1;
            state.logClass = "good";
          }
        }
      ],
      canTrigger: () => true,
      onResolve: (state) => {
        const loot = Math.random() > 0.5 ? "beast-core" : "blood-jade";
        addItemToInventory(state, loot, 1);
        state.hp = Math.max(1, state.hp - 10);
        state.logClass = "neutral";
      }
    },
    {
      title: "Sect Messenger Arrives",
      text: "A courier delivers a letter offering a temporary position in the local sect.",
      canTrigger: (state) => !state.guildMember,
      onResolve: (state) => {
        state.wallet += 45;
        state.stats.comprehension += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Unexpected Betrayal",
      rumor: "Someone close to your recent dealings has been asking too many questions.",
      text: "A familiar face arrives smiling, then closes the room from the outside and reaches for a hidden blade with the other hand.",
      scenes: [
        {
          id: "teahouse-turn",
          weight: 2,
          text: "A contact from the market invites you upstairs for privacy, then seals the teahouse room and produces a killing talisman instead of a contract.",
          tags: ["Ambush", "Contract"]
        },
        {
          id: "courtyard-sellout",
          weight: 1,
          text: "A cultivator who shared wine with you last night steps aside in a quiet courtyard and nods to hired killers moving in from both exits.",
          tags: ["Sellout", "Killers"]
        }
      ],
      intuition: {
        threshold: 12,
        text: "Their killing intent leaked a moment too early. You can still choose the line of escape."
      },
      battle: {
        label: "Break The Ambush",
        desc: "Turn the trap around before they lock the exits.",
        enemyName: "Turncoat Enforcer",
        hpScale: 0.86,
        qiScale: 0.9,
        lootFocus: "ambush",
        reward: { silver: 18, fortune: 1, karma: -1 },
        victoryText: "You leave the betrayer bleeding on their own floor and take the silver they prepared for your death."
      },
      choices: [
        {
          label: "Slip Out First",
          desc: "Trust your instincts and leave before the knife falls.",
          check: { stat: "soulSense", bonusStat: "fortune", difficulty: 23 },
          onSuccess: (state) => {
            state.stats.fortune += 2;
            state.stats.comprehension += 1;
            state.logClass = "good";
          },
          onFailure: (state) => {
            state.hp = Math.max(1, state.hp - 14);
            state.stats.karma -= 2;
            state.logClass = "bad";
          },
          successText: "You were already moving when the betrayal finally surfaced.",
          failText: "You realize the truth only after the first strike lands."
        },
        {
          label: "Cut Ties And Vanish",
          desc: "Escape the trap but leave the relationship in ashes.",
          onResolve: (state) => {
            state.stats.karma -= 2;
            state.stats.fortune -= 1;
            state.logClass = "bad";
          }
        }
      ],
      canTrigger: () => true,
      onResolve: (state) => {
        state.stats.karma -= 2;
        state.stats.fortune -= 2;
        state.logClass = "bad";
      }
    },
    {
      title: "Celestial Alignment Window",
      text: "The stars align perfectly. Your breakthrough chances increase briefly.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.breakthroughPermit = true;
        state.qi = Math.min(state.qiMax, state.qi + 15);
        state.logClass = "good";
      }
    },
    {
      title: "Hidden Cultivator's Journal",
      text: "You find an ancient journal describing cultivation secrets. Comprehension grows.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.stats.comprehension += 2;
        state.legacyNotes += 2;
        state.logClass = "good";
      }
    },
    {
      title: "Qi Deviation Crisis",
      text: "Your meridians start spiraling into chaos. By a miracle, you stabilize.",
      canTrigger: (state) => state.hp < state.hpMax * 0.4,
      onResolve: (state) => {
        state.hp = Math.min(state.hpMax, state.hp + 30);
        state.stats.physique += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Traveling Monk's Teaching",
      text: "A monk shares wisdom about the nature of cultivation and suffering.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.stats.soulSense += 2;
        state.stats.karma += 2;
        state.logClass = "good";
      }
    },
    // ── Additional World Events ───────────────────────────────────────────
    {
      title: "Merchant's Dying Confession",
      text: "A gravely wounded merchant presses a ledger into your hands before collapsing. Debts, secrets, and a map fragment point toward buried wealth.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.legacyNotes += 1;
        state.wallet += 35;
        state.logClass = "good";
      }
    },
    {
      title: "Collapsed Sect Tower",
      text: "An ancient sect tower crumbles in the night. You salvage cultivation remnants at personal risk, bruised but rewarded.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.techniqueScrolls = (state.techniqueScrolls || 0) + 1;
        state.hp = Math.max(1, state.hp - 10);
        state.logClass = "good";
      }
    },
    {
      title: "Fever Dream Vision",
      text: "Uncontrolled meridian flow in your sleep. You wake both drained and oddly enlightened — something shifted in the deep channels.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.qi = Math.max(0, state.qi - Math.floor(state.qiMax * 0.1));
        state.stats.comprehension += 2;
        state.stats.soulSense += 1;
        state.logClass = "neutral";
      }
    },
    {
      title: "Ambush on the Northern Pass",
      rumor: "The northern road is open, but only if you pay the wrong people.",
      text: "Armed cultivators have turned the northern pass into a private toll gate and are already arguing over how much your life is worth.",
      intuition: {
        threshold: 10,
        text: "The killing intent on the ridge is stronger than the voices below. There are archers in reserve, not just road thugs."
      },
      battle: {
        label: "Break The Toll Line",
        desc: "Hit first and scatter the extortion ring.",
        enemyName: "Pass Extortionist",
        hpScale: 0.88,
        qiScale: 0.86,
        lootFocus: "ambush",
        reward: { silver: 30, battleQi: 10, fortune: 1 },
        victoryText: "Once the line breaks, frightened merchants collect your name and the extortion silver changes hands."
      },
      choices: [
        {
          label: "Pay A Smaller Toll",
          desc: "Use sense and speech to cut the price, then leave intact.",
          check: { stat: "comprehension", bonusStat: "soulSense", difficulty: 21 },
          onSuccess: (state) => {
            state.wallet = Math.max(0, state.wallet - 8);
            state.stats.fortune += 1;
            state.logClass = "good";
          },
          onFailure: (state) => {
            state.wallet = Math.max(0, state.wallet - 18);
            state.hp = Math.max(1, state.hp - 8);
            state.logClass = "bad";
          },
          successText: "You notice where their formation is thin and talk them down from confidence to greed.",
          failText: "They smell hesitation and make you pay for it."
        },
        {
          label: "Turn Back Quietly",
          desc: "Lose the route, keep your blood.",
          onResolve: (state) => {
            state.stats.comprehension += 1;
            state.logClass = "good";
          }
        }
      ],
      canTrigger: () => true,
      onResolve: (state) => {
        state.wallet += 28;
        state.hp = Math.max(1, state.hp - 15);
        state.battleQi = Math.min(state.battleQiMax, state.battleQi + 12);
        state.logClass = "neutral";
      }
    },
    {
      title: "Gift from a Wandering Pilgrim",
      text: "An old pilgrim offers a crude cultivation pill before departing without a word. No explanation. No debt.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.qi = Math.min(state.qiMax, state.qi + 25);
        state.hp = Math.min(state.hpMax, state.hp + 20);
        state.logClass = "good";
      }
    },
    {
      title: "Rival Cultivator's Challenge",
      rumor: "A rival cultivator is collecting names by humiliating peers in public.",
      text: "A cultivator close to your own age offers a formal challenge with the kind of smile that only appears before a crowd or a funeral.",
      scenes: [
        {
          id: "measured-rival",
          weight: 2,
          text: "Your rival bows with perfect manners while quietly making sure half the street has stopped to witness whether you deserve your current reputation.",
          tags: ["Public", "Rival"]
        },
        {
          id: "jealous-peer",
          weight: 1,
          text: "A jealous peer steps from a scripture stall and names every slight they imagine you owe them before demanding a proper qi comparison.",
          tags: ["Jealousy", "Face"]
        }
      ],
      intuition: {
        threshold: 12,
        text: "Their qi is disciplined but not deep. They want a spectacle more than a kill."
      },
      battle: {
        label: "Answer The Challenge",
        desc: "Take the comparison out of words and into technique.",
        enemyName: "Rival Cultivator",
        hpScale: 0.9,
        qiScale: 0.95,
        lootFocus: "spirit",
        reward: { silver: 18, comprehension: 1, fortune: 1 },
        victoryText: "Word of the result spreads faster than you do. Doors open a little easier afterward."
      },
      choices: [
        {
          label: "Win On Theory",
          desc: "Beat them in front of the crowd without ever striking.",
          check: { stat: "comprehension", bonusStat: "soulSense", difficulty: 24 },
          onSuccess: (state) => {
            state.stats.comprehension += 2;
            state.stats.fortune += 1;
            state.logClass = "good";
          },
          onFailure: (state) => {
            state.qi = Math.max(0, state.qi - 12);
            state.stats.karma -= 1;
            state.logClass = "bad";
          },
          successText: "The crowd hears the flaw in your rival's method long before they do.",
          failText: "You overstate the point, lose the crowd, and feel your own qi slip with your temper."
        },
        {
          label: "Decline With Formal Respect",
          desc: "Deny the match without handing them a clean insult.",
          onResolve: (state) => {
            state.stats.karma += 1;
            state.stats.fortune += 1;
            state.logClass = "good";
          }
        }
      ],
      canTrigger: () => true,
      onResolve: (state) => {
        if (Math.random() < 0.55) {
          state.stats.comprehension += 2;
          state.stats.fortune += 1;
          state.logClass = "good";
        } else {
          state.qi = Math.max(0, state.qi - 12);
          state.stats.karma -= 1;
          state.logClass = "bad";
        }
      }
    },
    {
      title: "Black Market Pill Discovery",
      text: "A discreet stall offers qi-boosting pills of dubious origin. You take the risk.",
      canTrigger: (state) => state.wallet >= 30,
      choices: [
        {
          label: "Buy The Pill",
          desc: "Accept the risk for a surge of qi.",
          tone: "warn",
          onResolve: (state) => {
            state.wallet -= 30;
            if (Math.random() < 0.60) {
              state.qi = Math.min(state.qiMax, state.qi + 35);
              state.qiPeak = Math.max(state.qiPeak || 0, state.qi);
              state.logClass = "good";
            } else {
              state.hp = Math.max(1, state.hp - 20);
              pushLog(state, "The pill contained corrupted qi — brutal backlash.", "bad");
              state.logClass = "bad";
            }
          }
        },
        {
          label: "Analyze Before Swallowing",
          desc: "Use perception and study to strip away the impurity.",
          check: { stat: "comprehension", bonusStat: "soulSense", difficulty: 23 },
          onSuccess: (state) => {
            state.wallet -= 20;
            state.qi = Math.min(state.qiMax, state.qi + 24);
            state.battleQi = Math.min(state.battleQiMax, state.battleQi + 14);
            state.logClass = "good";
          },
          onFailure: (state) => {
            state.wallet -= 20;
            state.hp = Math.max(1, state.hp - 14);
            state.qi = Math.max(0, state.qi - 10);
            state.logClass = "bad";
          },
          successText: "You peel away the filthy layers and keep the usable essence.",
          failText: "Your analysis fails halfway and the residue lashes back."
        },
        {
          label: "Refuse It",
          desc: "Keep your silver and your channels clean.",
          onResolve: (state) => {
            state.stats.fortune += 1;
            state.logClass = "good";
          }
        }
      ],
      onResolve: (state) => {
        state.wallet -= 30;
        if (Math.random() < 0.60) {
          state.qi = Math.min(state.qiMax, state.qi + 35);
          state.qiPeak = Math.max(state.qiPeak || 0, state.qi);
          state.logClass = "good";
        } else {
          state.hp = Math.max(1, state.hp - 20);
          pushLog(state, "The pill contained corrupted qi — brutal backlash.", "bad");
          state.logClass = "bad";
        }
      }
    },
    {
      title: "Spirit Spring Discovered",
      text: "Hidden beneath old stone, a natural spring radiates cultivation energy. You drink deeply and feel the channels open.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.qi = Math.min(state.qiMax, state.qi + 32);
        state.hp = Math.min(state.hpMax, state.hp + 18);
        state.qiPeak = Math.max(state.qiPeak || 0, state.qi);
        state.logClass = "good";
      }
    },
    {
      title: "Memorial Stone Inscription",
      text: "An engraved stone lists the names of cultivators lost in a forgotten war. You read every name. Deep reflection crystallizes something.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.stats.comprehension += 1;
        state.stats.karma += 2;
        state.logClass = "good";
      }
    },
    {
      title: "Stolen Weapon Recovered",
      text: "You track down a thief who robbed a blacksmith. The grateful smith pays in ore rather than coin.",
      canTrigger: () => true,
      onResolve: (state) => {
        addItemToInventory(state, "array-ore", 2);
        state.stats.karma += 1;
        state.wallet += 12;
        state.logClass = "good";
      }
    },
    {
      title: "Arena Stage Collapse",
      text: "The dueling platform shatters mid-match. The shockwave scatters spectators. You absorb residual combat qi from the blast zone.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.battleQi = Math.min(state.battleQiMax, state.battleQi + 20);
        state.hp = Math.max(1, state.hp - 8);
        state.logClass = "neutral";
      }
    },
    {
      title: "Forbidden Altar in the Wilds",
      text: "A hidden altar hums with forbidden energy. Inscriptions warn of price. You read them anyway — old knowledge sinks in.",
      canTrigger: (state) => state.realmIndex >= 1,
      onResolve: (state) => {
        state.stats.soulSense += 3;
        state.longevityCurrent = Math.max(5, state.longevityCurrent - 8);
        state.logClass = "neutral";
      }
    },
    {
      title: "Ancient Battle Echo",
      text: "Residual battlefield qi surges from an old war site. Combat instinct crystallizes in your muscles.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.stats.physique += 2;
        state.battleQi = Math.min(state.battleQiMax, state.battleQi + 15);
        state.logClass = "good";
      }
    },
    {
      title: "Sect Patrol Stops You",
      text: "Outer sect disciples demand identification. The scrutiny ends with a cleared seal — but not without a toll extracted first.",
      canTrigger: (state) => !state.guildMember,
      onResolve: (state) => {
        const toll = Math.min(18, state.wallet);
        state.wallet -= toll;
        state.logClass = "bad";
      }
    },
    {
      title: "Cultivation Ghost Encounter",
      text: "A wisp of residual cultivation — the ghost of a dead master — attempts to transmit technique fragments. The transfer is unstable.",
      canTrigger: () => true,
      onResolve: (state) => {
        if (Math.random() < 0.45) {
          state.techniqueScrolls = (state.techniqueScrolls || 0) + 1;
          state.logClass = "good";
        } else {
          state.qi = Math.max(0, state.qi - 18);
          state.logClass = "bad";
        }
      }
    },
    {
      title: "Wandering Body Preceptor",
      text: "A scarred body cultivator watches your stance in silence before offering to correct it for a price.",
      canTrigger: () => true,
      choices: [
        {
          label: "Pay For Correction",
          desc: "Spend silver for direct body guidance.",
          onResolve: (state) => {
            const fee = Math.min(45, state.wallet);
            state.wallet -= fee;
            state.stats.physique += 2;
            state.hp = Math.min(state.hpMax, state.hp + 18);
            state.logClass = fee > 0 ? "good" : "bad";
          }
        },
        {
          label: "Debate The Theory",
          desc: "Use comprehension to force the lesson into words.",
          check: { stat: "comprehension", bonusStat: "physique", difficulty: 22 },
          onSuccess: (state) => {
            state.stats.physique += 1;
            state.stats.comprehension += 1;
            state.logClass = "good";
          },
          onFailure: (state) => {
            state.hp = Math.max(1, state.hp - 10);
            state.logClass = "bad";
          },
          successText: "You force a brutal lesson into a usable method.",
          failText: "The preceptor demonstrates the flaw by knocking you flat."
        },
        {
          label: "Observe Quietly",
          desc: "Take only what the eye can steal.",
          onResolve: (state) => {
            state.stats.comprehension += 1;
            state.logClass = "good";
          }
        }
      ]
    },
    {
      title: "Poison Matriarch's Bargain",
      text: "An elderly poison expert offers a small vial, a warning, and a smile that suggests all three are linked.",
      canTrigger: () => true,
      choices: [
        {
          label: "Buy The Vial",
          desc: "Spend silver on dangerous insight.",
          tone: "warn",
          onResolve: (state) => {
            const fee = Math.min(52, state.wallet);
            state.wallet -= fee;
            addItemToInventory(state, "poison-essence", 1);
            state.stats.soulSense += 1;
            state.logClass = fee > 0 ? "good" : "bad";
          }
        },
        {
          label: "Ask For Theory Instead",
          desc: "Use soul sense and study to take the knowledge without the toxin.",
          check: { stat: "soulSense", bonusStat: "comprehension", difficulty: 24 },
          onSuccess: (state) => {
            state.stats.comprehension += 2;
            state.stats.soulSense += 1;
            state.logClass = "good";
          },
          onFailure: (state) => {
            state.qi = Math.max(0, state.qi - 15);
            state.hp = Math.max(1, state.hp - 9);
            state.logClass = "bad";
          },
          successText: "The matriarch gives you principles instead of venom.",
          failText: "One careless breath and her hallucinogenic fumes sting your channels."
        }
      ]
    },
    {
      title: "Mirror Hall Lecturer",
      text: "A cultivated lecturer opens a paid discussion on advanced methods, insisting true secrets are never free.",
      canTrigger: () => true,
      choices: [
        {
          label: "Buy A Seat",
          desc: "Spend silver to hear the full lecture.",
          onResolve: (state) => {
            const fee = Math.min(60, state.wallet);
            state.wallet -= fee;
            state.stats.comprehension += 2;
            state.stats.soulSense += 1;
            if (Math.random() < 0.22) {
              state.techniqueScrolls = (state.techniqueScrolls || 0) + 1;
            }
            state.logClass = fee > 0 ? "good" : "bad";
          }
        },
        {
          label: "Sneak In Back",
          desc: "Try to hear enough without paying.",
          check: { stat: "fortune", bonusStat: "comprehension", difficulty: 21 },
          onSuccess: (state) => {
            state.stats.comprehension += 1;
            state.logClass = "good";
          },
          onFailure: (state) => {
            state.wallet = Math.max(0, state.wallet - 18);
            state.stats.karma -= 1;
            state.logClass = "bad";
          },
          successText: "You catch enough of the lecture to shift your path slightly.",
          failText: "The ushers find you and collect an embarrassing fine."
        }
      ]
    },
    {
      title: "Corrupted Beast Core Refining",
      text: "A beast core radiates violent qi during refinement. You barely contain the discharge — the overflow charges your combat channels.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.qi = Math.max(0, state.qi - 8);
        state.hp = Math.max(1, state.hp - 10);
        state.battleQi = Math.min(state.battleQiMax, state.battleQi + 18);
        state.logClass = "neutral";
      }
    },
    {
      title: "Old Friend Returns",
      text: "A kindred spirit from your past crosses your path unexpectedly. They share news, a meal, and a scroll they claimed they no longer needed.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.techniqueScrolls = (state.techniqueScrolls || 0) + 1;
        state.wallet += 15;
        state.stats.fortune += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Thunder Tribulation Nearby",
      text: "A cultivator elsewhere triggers a minor tribulation. The qi storm reaches you as scattered lightning. Painful — but clarifying.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.hp = Math.max(1, state.hp - 12);
        state.stats.comprehension += 3;
        state.stats.soulSense += 1;
        state.logClass = "neutral";
      }
    },
    {
      title: "Night Market Fortune Reading",
      text: "A blind fortune-teller insists on reading your qi lines for free. Her words are cryptic — but one phrase sticks: 'The ascent comes sooner than you deserve.'",
      canTrigger: () => true,
      onResolve: (state) => {
        state.breakthroughPermit = true;
        state.stats.fortune += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Fleeing Fugitive Passes By",
      text: "A cultivator flees through the street, dropping their pack. You find blood jade and a coded letter inside.",
      canTrigger: () => true,
      onResolve: (state) => {
        addItemToInventory(state, "blood-jade", 2);
        state.legacyNotes += 1;
        state.logClass = "good";
      }
    },
    {
      title: "Secret Duel Witnessed",
      text: "Two Foundation cultivators fight in an alley — neither aware you are watching. Their technique gaps become obvious. You take notes.",
      canTrigger: () => true,
      onResolve: (state) => {
        state.stats.comprehension += 2;
        state.stats.soulSense += 1;
        state.logClass = "good";
      }
    }
  ],

  // ─── NPC Characters (recurring across events) ─────────────────
  npcs: [
    { id: "lady-sting", name: "Lady Sting", title: "Mercenary Master", desc: "A scarred warrior who runs the Iron Guild." },
    { id: "lotus-keeper", name: "Lotus Keeper", title: "Archive Custodian", desc: "Ancient scholar guarding forbidden knowledge." },
    { id: "void-sentinel", name: "Void Sentinel", title: "Boundary Guard", desc: "Mysterious warden of the Void Rift." },
    { id: "ember-elder", name: "Elder Lu", title: "Sect Authority", desc: "Political figure of the Ember hierarchy." },
    { id: "dark-merchant", name: "Shen", title: "Underground Dealer", desc: "Black market merchant with dangerous connections." },
    { id: "scholar-chen", name: "Master Chen", title: "Exile Scholar", desc: "Wandering scholar hiding from his past." },
    { id: "madam-yan", name: "Madam Yan", title: "Forge-Body Broker", desc: "A practical body cultivator who sells hard lessons like forged steel." },
    { id: "granny-viper", name: "Granny Viper", title: "Poison Matriarch", desc: "A smiling poison mistress whose compliments sound like threats." },
    { id: "mirror-hermit", name: "Mirror Hermit Su", title: "Soul Lecturer", desc: "A lecturer who charges by the sentence and never wastes one." },
    { id: "dao-smith", name: "Dao Smith Han", title: "Battlefield Artificer", desc: "A forge master who knows exactly what desperate cultivators will buy." },
    { id: "saint-auntie", name: "Saint Auntie Qiao", title: "Saint Apothecary", desc: "A patient apothecary whose pills feel like sermons." },
    { id: "crown-judge", name: "Judge Wei of the Crown", title: "Dao Arbiter", desc: "An unnerving sovereign cultivator who prices truth higher than gold." }
  ],

  cityExperts: [
    { id: "madam-yan", cityId: "ember", name: "Madam Yan", title: "Forge-Body Broker", focus: "body", recruitCost: 140, trainingCost: 55, requiredStanding: 1, faction: "guild", desc: "Turns silver into scar tissue and scar tissue into practical body growth." },
    { id: "scholar-chen", cityId: "lotus", name: "Master Chen", title: "Exile Scholar", focus: "soul", recruitCost: 165, trainingCost: 60, requiredStanding: 1, faction: "sect", desc: "A quiet scholar who teaches comprehension, breath patterns, and how not to waste a scroll." },
    { id: "dao-smith", cityId: "iron", name: "Dao Smith Han", title: "Battlefield Artificer", focus: "combat", recruitCost: 210, trainingCost: 75, requiredStanding: 2, faction: "guild", desc: "Tunes battle qi, gear, and nerves for cultivators who expect to survive real fights." },
    { id: "granny-viper", cityId: "jade", name: "Granny Viper", title: "Poison Matriarch", focus: "poison", recruitCost: 185, trainingCost: 68, requiredStanding: 1, faction: "sect", desc: "Deals in poison theory, dangerous materials, and methods most sects publicly condemn." },
    { id: "mirror-hermit", cityId: "void", name: "Mirror Hermit Su", title: "Soul Lecturer", focus: "soul", recruitCost: 260, trainingCost: 88, requiredStanding: 2, faction: "sect", desc: "Sells advanced soul instruction, breakthrough insight, and rare method fragments." },
    { id: "saint-auntie", cityId: "saint-vigil", name: "Saint Auntie Qiao", title: "Saint Apothecary", focus: "poison", recruitCost: 360, trainingCost: 120, requiredStanding: 3, faction: "sect", desc: "Brews saint-tier medicine, void antidotes, and brutal body restoratives for the worthy." },
    { id: "crown-judge", cityId: "crown-void", name: "Judge Wei of the Crown", title: "Dao Arbiter", focus: "soul", recruitCost: 520, trainingCost: 165, requiredStanding: 4, faction: "sect", desc: "Refines sovereign-level focus through judgment, doctrine, and impossible standards." }
  ],

  craftingRecipes: [
    { id: "tempered-marrow-paste", label: "Tempered Marrow Paste", cityTags: ["forge", "market"], realmReq: 0, output: { itemId: "tempered-marrow-paste", qty: 1 }, ingredients: [{ itemId: "black-iron-ore", qty: 1 }, { itemId: "spirit-herb", qty: 2 }] },
    { id: "focus-incense", label: "Focus Incense", cityTags: ["archive", "garden"], realmReq: 0, output: { itemId: "focus-incense", qty: 1 }, ingredients: [{ itemId: "cloud-silk", qty: 1 }, { itemId: "moon-dew-fungus", qty: 1 }] },
    { id: "venom-temper-draught", label: "Venom Temper Draught", cityTags: ["poison", "market"], realmReq: 1, output: { itemId: "venom-temper-draught", qty: 1 }, ingredients: [{ itemId: "venom-gland", qty: 1 }, { itemId: "grave-bloom", qty: 1 }] },
    { id: "void-meridian-elixir", label: "Void Meridian Elixir", cityTags: ["array", "void"], realmReq: 2, output: { itemId: "void-meridian-elixir", qty: 1 }, ingredients: [{ itemId: "array-ore", qty: 1 }, { itemId: "soul-amber", qty: 1 }, { itemId: "stormglass-shard", qty: 1 }] },
    { id: "saintfire-pellet", label: "Saintfire Pellet", cityTags: ["saint", "forge"], realmReq: 5, output: { itemId: "saintfire-pellet", qty: 1 }, ingredients: [{ itemId: "saint-bone-fragment", qty: 1 }, { itemId: "embersteel-ingot", qty: 1 }, { itemId: "immortal-dew", qty: 1 }] },
    { id: "dao-heart-tonic", label: "Dao Heart Tonic", cityTags: ["dao", "archive"], realmReq: 6, output: { itemId: "dao-heart-tonic", qty: 1 }, ingredients: [{ itemId: "dao-crystal", qty: 1 }, { itemId: "void-lotus", qty: 1 }, { itemId: "soul-amber", qty: 1 }] }
  ],

  // ─── City-Specific Event Pools ───────────────────────────────
  // Optional location-based events; generic pool still applies
  cityEventPools: {
    "ember": [
      {
        id: "ember-sect-demand",
        npc: "ember-elder",
        title: "Sect Audit Begins",
        rumor: "Elder Lu is walking the district with accountants and two enforcers.",
        text: "Elder Lu arrives with auditors demanding 'sect maintenance fees' and enough muscle behind the ledgers to make the numbers feel like a weapon.",
        tags: ["Ember Court", "Authority", "Consequence"],
        scenes: [
          {
            id: "ledger-shakedown",
            weight: 2,
            text: "The auditors move stall to stall with polished tablets, inventing arrears faster than merchants can protest.",
            tags: ["Ledgers", "Pressure"]
          },
          {
            id: "confiscation-sweep",
            weight: 1,
            text: "Elder Lu has already confiscated one merchant's pills when your turn arrives, and everyone on the street is pretending not to watch.",
            tags: ["Confiscation", "Fear"]
          }
        ],
        intuition: {
          threshold: 11,
          text: "One of the enforcers is ready for violence before the numbers are even spoken. This is a shakedown wearing clerical robes."
        },
        battle: {
          label: "Challenge The Enforcers",
          desc: "Break the intimidation line and make them collect fees from someone else.",
          enemyName: "Sect Enforcer",
          hpScale: 0.92,
          qiScale: 0.9,
          lootFocus: "ambush",
          reward: { silver: 10, guildStanding: 1, karma: -1 },
          victoryText: "The market quietly pushes silver and gratitude into your hands once Elder Lu's people retreat."
        },
        canTrigger: () => true,
        choices: [
          {
            label: "Pay The Fee",
            desc: "Hand over silver and avoid immediate trouble.",
            tone: "warn",
            onResolve: (state) => {
              state.wallet = Math.max(10, state.wallet - 25);
              state.stats.karma -= 1;
              state.logClass = "bad";
            }
          },
          {
            label: "Cite Guild Ledgers",
            desc: "Use records and measured speech to cut the fee down.",
            check: { stat: "comprehension", bonusStat: "guildStanding", difficulty: 19 },
            onSuccess: (state) => {
              state.wallet = Math.max(10, state.wallet - 8);
              state.guildStanding = Math.min(10, (state.guildStanding || 0) + 1);
              state.logClass = "good";
            },
            onFailure: (state) => {
              state.wallet = Math.max(10, state.wallet - 32);
              state.stats.karma -= 1;
              state.logClass = "bad";
            },
            successText: "The auditors grudgingly accept your argument and reduce the payment.",
            failText: "Elder Lu finds a technicality and doubles the harassment fee."
          },
          {
            label: "Refuse And Endure",
            desc: "Keep your silver, but take the political blow.",
            tone: "warn",
            onResolve: (state) => {
              state.hp = Math.max(1, state.hp - 12);
              state.stats.fortune -= 1;
              state.logClass = "bad";
            }
          }
        ],
        onResolve: (state) => {
          state.wallet = Math.max(10, state.wallet - 25);
          state.stats.karma -= 1;
          state.logClass = "bad";
        }
      }
    ],
    "jade": [
      {
        id: "jade-spirit-trade",
        npc: "dark-merchant",
        title: "Rare Cargo Needs a Courier",
        rumor: "Shen is paying too well for a courier job that should not exist.",
        text: "Shen offers 50 silver to carry a sealed box to the next city. No questions asked, no delays, and no witnesses.",
        tags: ["Jade Harbor", "Trade", "Risk"],
        scenes: [
          {
            id: "wharf-handoff",
            weight: 2,
            text: "Shen keeps one foot on a mooring post while the crate rests between you, as if the harbor itself might overhear the wrong word.",
            tags: ["Wharf", "Smuggling"]
          },
          {
            id: "rain-alley",
            weight: 1,
            text: "The deal happens in a narrow rain alley where talisman ash floats in puddles and nobody makes eye contact for long.",
            tags: ["Alley", "Arrays"]
          }
        ],
        intuition: {
          threshold: 12,
          text: "The seal hums in two rhythms. One is concealment. The other is a trigger waiting for fear, qi, or curiosity."
        },
        canTrigger: () => true,
        choices: [
          {
            label: "Take The Box",
            desc: "Fast silver, no questions.",
            tone: "warn",
            onResolve: (state) => {
              state.wallet += 50;
              state.stats.fortune += 1;
              state.stats.karma -= 1;
              state.guildStanding = Math.min(10, (state.guildStanding || 0) + 1);
              state.logClass = "";
            }
          },
          {
            label: "Inspect The Seal",
            desc: "Probe the container before agreeing.",
            check: { stat: "soulSense", bonusStat: "comprehension", difficulty: 22 },
            onSuccess: (state) => {
              state.wallet += 25;
              state.techniqueScrolls = (state.techniqueScrolls || 0) + 1;
              state.stats.karma += 1;
              state.logClass = "good";
            },
            onFailure: (state) => {
              state.hp = Math.max(1, state.hp - 10);
              state.qi = Math.max(0, state.qi - 12);
              state.logClass = "bad";
            },
            successText: "You sense contraband arrays inside and negotiate safer pay for keeping quiet.",
            failText: "The seal snaps at your senses and the deal collapses into backlash."
          },
          {
            label: "Report Shen",
            desc: "Trade profit for lawful favor.",
            onResolve: (state) => {
              state.wallet += 16;
              state.stats.karma += 2;
              state.stats.fortune -= 1;
              state.logClass = "good";
            }
          }
        ],
        onResolve: (state) => {
          state.wallet += 50;
          state.stats.fortune += 1;
          state.stats.karma -= 1;
          state.logClass = "neutral";
        }
      }
    ],
    "lotus": [
      {
        id: "lotus-archive-secret",
        npc: "lotus-keeper",
        title: "The Forbidden Section",
        rumor: "The Keeper has opened a wing that is never open twice the same way.",
        text: "The Keeper shows you a scroll marked with warnings. 'Knowledge has a price,' they whisper, and the room around the text feels too still.",
        tags: ["Lotus Archive", "Knowledge", "Danger"],
        scenes: [
          {
            id: "ink-mirror",
            weight: 2,
            text: "The page reflects your face a breath behind your real movement, as if the scripture wants time to think before you do.",
            tags: ["Mirror Ink", "Memory"]
          },
          {
            id: "whisper-sutra",
            weight: 1,
            text: "Every line on the scroll seems to whisper a different ending to the same cultivation method, and none of them feel harmless.",
            tags: ["Whispers", "Forbidden"]
          }
        ],
        intuition: {
          threshold: 13,
          text: "The text is not only dangerous. It is also watching for the reader's greed and reshaping itself around it."
        },
        canTrigger: (state) => state.realmIndex >= 1,
        choices: [
          {
            label: "Study Under Supervision",
            desc: "Accept the Keeper's terms and learn carefully.",
            check: { stat: "comprehension", bonusStat: "soulSense", difficulty: 23 },
            onSuccess: (state) => {
              state.stats.comprehension += 2;
              state.stats.soulSense += 2;
              state.logClass = "good";
            },
            onFailure: (state) => {
              state.qi = Math.max(0, state.qi - 20);
              state.stats.karma -= 1;
              state.logClass = "bad";
            },
            successText: "You absorb the structure without letting the forbidden patterns sink too deep.",
            failText: "The text lingers in your channels and leaves your qi unsettled."
          },
          {
            label: "Memorize A Page",
            desc: "Steal only a fragment and leave before the cost grows.",
            tone: "warn",
            onResolve: (state) => {
              state.techniqueScrolls = (state.techniqueScrolls || 0) + 1;
              state.stats.soulSense += 2;
              state.stats.karma -= 2;
              state.logClass = "good";
            }
          },
          {
            label: "Refuse The Knowledge",
            desc: "Walk away before debt forms.",
            onResolve: (state) => {
              state.stats.karma += 1;
              state.stats.comprehension += 1;
              state.logClass = "good";
            }
          }
        ],
        onResolve: (state) => {
          state.techniqueScrolls = (state.techniqueScrolls || 0) + 1;
          state.stats.soulSense += 2;
          state.stats.karma -= 2;
          state.logClass = "good";
        }
      }
    ]
  },

  // Character backstory pool — 3 random picks presented at game start
  // apply(state) mutates the freshly-created state
  backstories: [
    {
      id: "fallen-noble",
      title: "Fallen Noble",
      desc: "Once wealthy, your family's sect was dissolved by political rivals. You carry an old jade pendant worth nothing now.",
      tags: ["Wealth +30", "Comprehension −3", "Soul Sense −2"],
      apply: (s) => { s.wallet += 30; s.stats.comprehension -= 3; s.stats.soulSense -= 2; }
    },
    {
      id: "street-orphan",
      title: "Street Orphan",
      desc: "You learned to read qi through stolen glances at sect disciples, never having a master of your own.",
      tags: ["Comprehension +5", "Fortune +3", "Wallet −30"],
      apply: (s) => { s.stats.comprehension += 5; s.stats.fortune += 3; s.wallet = Math.max(10, s.wallet - 30); }
    },
    {
      id: "temple-initiate",
      title: "Temple Initiate",
      desc: "You spent years in a minor temple transcribing sutras before the sect closed its gates to outsiders.",
      tags: ["Soul Sense +4", "Technique Scroll ×1", "Physique −3"],
      apply: (s) => { s.stats.soulSense += 4; s.techniqueScrolls += 1; s.stats.physique -= 3; }
    },
    {
      id: "mountain-hermit",
      title: "Mountain Hermit",
      desc: "Raised in isolation near a qi vein. You breathe cultivation like others breathe air, but know little of the world.",
      tags: ["Soul Sense +5", "Qi Regen +1", "Fortune −4"],
      apply: (s) => { s.stats.soulSense += 5; s.qiRegenRate = (s.qiRegenRate || 1) + 1; s.stats.fortune -= 4; }
    },
    {
      id: "mercenary-guard",
      title: "Mercenary Guard",
      desc: "Years of hired blades and caravans hardened your body. Your mind stayed sharp enough to survive, nothing more.",
      tags: ["Physique +6", "Wallet +20", "Comprehension −4"],
      apply: (s) => { s.stats.physique += 6; s.wallet += 20; s.stats.comprehension -= 4; }
    },
    {
      id: "disgraced-scholar",
      title: "Disgraced Scholar",
      desc: "You solved a sect elder's theoretical treatise at fourteen — then exposed their plagiarism. exile followed.",
      tags: ["Comprehension +7", "Fortune −4", "Wallet −20"],
      apply: (s) => { s.stats.comprehension += 7; s.stats.fortune -= 4; s.wallet = Math.max(10, s.wallet - 20); }
    },
    {
      id: "merchant-apprentice",
      title: "Merchant's Apprentice",
      desc: "Every coin a teacher. You know value, route, and the weight of a bribe — cultivation is just another market.",
      tags: ["Wallet +50", "Fortune +3", "Soul Sense −5"],
      apply: (s) => { s.wallet += 50; s.stats.fortune += 3; s.stats.soulSense -= 5; }
    },
    {
      id: "wandering-herbalist",
      title: "Wandering Herbalist",
      desc: "The wilds taught you which roots mend meridians and which summon beasts. Your satchel is always full.",
      tags: ["Herbs ×8 (instead of 4)", "Comprehension +3", "Physique −3"],
      apply: (s) => {
        const idx = s.inventorySlots.findIndex(sk => sk && sk.id === "spirit-herb");
        if (idx >= 0) s.inventorySlots[idx].qty += 4;
        s.stats.comprehension += 3; s.stats.physique -= 3;
      }
    },
    {
      id: "expelled-disciple",
      title: "Expelled Sect Disciple",
      desc: "You trained in a real sect for three years before a scandal you didn't start drove you out empty-handed.",
      tags: ["Technique Scrolls ×2", "Soul Sense +3", "Wallet −40"],
      apply: (s) => { s.techniqueScrolls += 2; s.stats.soulSense += 3; s.wallet = Math.max(10, s.wallet - 40); }
    },
    {
      id: "condemned-prisoner",
      title: "Condemned Prisoner",
      desc: "You survived three years in the Ironbound Cells through sheer flesh and spite. The chains left scars but sharpened your will.",
      tags: ["Physique +8", "Fortune −5", "Soul Sense −4"],
      apply: (s) => { s.stats.physique += 8; s.stats.fortune -= 5; s.stats.soulSense -= 4; }
    }
  ],

  // Character creation: a multi-step journey for new cultivators
  characterCreation: {
    opening: `
      <p>You awaken in a dimly-lit chamber, unclear how you arrived. Your limbs ache as if from a long sleep. Around you stretches an unfamiliar world of cultivators, ancient secrets, and paths to immortality.</p>
      <p>Reality flickers. For a moment, you remember nothing. Then—memories flood back, though their meaning is lost. You are at a crossroads.</p>
      <p><strong>Who are you? What brought you to this moment?</strong></p>
    `,
    paths: [
      {
        id: "sect-trained",
        title: "Sect-Trained",
        subtitle: "Raised in an ancient order",
        desc: "You spent formative years in a sect's halls, studying alongside others. Discipline shaped you, but rigid structure defined your limits.",
        tags: ["Soul Sense +3", "Comprehension +2", "Wallet −20"],
        apply: (s) => {
          s.stats.soulSense += 3;
          s.stats.comprehension += 2;
          s.wallet = Math.max(10, s.wallet - 20);
          s.qiRegenRate = (s.qiRegenRate || 1) + 1;
        }
      },
      {
        id: "wild-born",
        title: "Wild-Born",
        subtitle: "Raised alone in nature's embrace",
        desc: "Isolation taught you to hear qi's whispers in the wind. You are unshackled by sect dogma but raw in technique.",
        tags: ["Soul Sense +5", "Physique +2", "Fortune −3"],
        apply: (s) => {
          s.stats.soulSense += 5;
          s.stats.physique += 2;
          s.stats.fortune -= 3;
          s.stats.comprehension -= 2;
        }
      },
      {
        id: "cursed-child",
        title: "Cursed Child",
        subtitle: "Marked by fate's cruelty",
        desc: "An ancient curse or blessing runs through your meridians. Cultivation is your only escape—or your doom. Power comes at a price.",
        tags: ["Qi Max +20", "Fortune −5", "Physique −3"],
        apply: (s) => {
          s.qiMax += 20;
          s.qi = s.qiMax;
          s.stats.fortune -= 5;
          s.stats.physique -= 3;
          s.stats.comprehension += 3;
        }
      }
    ],
    natures: [
      {
        id: "ascetic",
        title: "Ascetic",
        subtitle: "Self-denial yields clarity",
        desc: "You seek the path through suffering. Meditation comes easily; distractions are shed like old skin.",
        tags: ["Comprehension +3", "Soul Sense +2"],
        apply: (s) => {
          s.stats.comprehension += 3;
          s.stats.soulSense += 2;
        }
      },
      {
        id: "ambitious",
        title: "Ambitious",
        subtitle: "Power intoxicates the soul",
        desc: "You hunger for strength and recognition. Others' doubt fuels your drive. Faster breakthroughs come at the cost of stability.",
        tags: ["Physique +3", "Fortune +2", "Soul Sense −2"],
        apply: (s) => {
          s.stats.physique += 3;
          s.stats.fortune += 2;
          s.stats.soulSense = Math.max(1, s.stats.soulSense - 2);
          s.wallet += 25;
        }
      },
      {
        id: "enigmatic",
        title: "Enigmatic",
        subtitle: "Mystery is your shield",
        desc: "You trust nothing at face value. Cunning intuition guides your steps. Others find you difficult to read.",
        tags: ["Fortune +3", "Comprehension +1", "Physique −2"],
        apply: (s) => {
          s.stats.fortune += 3;
          s.stats.comprehension += 1;
          s.stats.physique = Math.max(1, s.stats.physique - 2);
          const idx = s.inventorySlots.findIndex(sk => sk && sk.id === "spirit-herb");
          if (idx >= 0) s.inventorySlots[idx].qty += 2;
        }
      }
    ],
    fateEvents: [
      {
        id: "star-branded",
        title: "Star-Branded at Birth",
        text: "Your mother noted that a comet crossed the sky the moment you were born. Cultivators who later learned of it called it an omen. You never knew whether to feel chosen or cursed — but the soul sense came naturally.",
        effects: "Soul Sense +2",
        apply: (s) => { s.stats.soulSense += 2; }
      },
      {
        id: "qi-scar",
        title: "A Qi Scar from Childhood",
        text: "A childhood accident tore a line through your lower meridians. The scar never fully healed, but it forced your qi into stranger, stronger paths.",
        effects: "Qi Max +15, Physique −1",
        apply: (s) => { s.qiMax += 15; s.qi = Math.min(s.qi, s.qiMax); s.stats.physique = Math.max(1, s.stats.physique - 1); }
      },
      {
        id: "spirit-debt",
        title: "A Spirit Debt Owed",
        text: "At twelve, a wandering cultivator saved your life from a rogue beast and asked nothing in return. You still don't know why. The uncertainty sits in your chest like lodged qi.",
        effects: "Fortune +1, Karma +2",
        apply: (s) => { s.stats.fortune += 1; s.stats.karma += 2; }
      },
      {
        id: "hollow-dream",
        title: "The Hollow Dream",
        text: "For three years as a child you dreamed of a tower surrounded by clouds and heard a voice speaking in an unknown tongue. The dreams stopped the day you first felt qi. Some say the tower is real.",
        effects: "Comprehension +2",
        apply: (s) => { s.stats.comprehension += 2; }
      },
      {
        id: "robbed-at-gate",
        title: "Robbed at the Gate",
        text: "The day you left for the Ashen Frontier, a pickpocket took your starting silver. You have been careful with coin ever since — perhaps overly so.",
        effects: "Silver −20, Fortune +2",
        apply: (s) => { s.wallet = Math.max(10, s.wallet - 20); s.stats.fortune += 2; }
      },
      {
        id: "strange-taste",
        title: "You Taste Qi in Rain",
        text: "Others find this peculiar. To you it is entirely ordinary. When it rains, the qi in the air tastes of something sweet, almost like iron dissolved in honey. Cultivation masters say this marks heightened perception.",
        effects: "Soul Sense +3",
        apply: (s) => { s.stats.soulSense += 3; }
      },
      {
        id: "iron-memory",
        title: "Iron Memory",
        text: "You never forget a face, a price, or an insult. At times this is a gift. At others it sits in your mind like gravel, slowing the flow.",
        effects: "Comprehension +2, Fortune −1",
        apply: (s) => { s.stats.comprehension += 2; s.stats.fortune = Math.max(1, s.stats.fortune - 1); }
      },
      {
        id: "blood-promise",
        title: "A Blood Promise",
        text: "Before parting, a dying elder made you swear to avenge an old injustice you barely understood. The promise is inscribed on your marrow whether you honor it or not.",
        effects: "Physique +4, Soul Sense −2",
        apply: (s) => { s.stats.physique += 4; s.stats.soulSense = Math.max(1, s.stats.soulSense - 2); }
      },
      {
        id: "early-scroll",
        title: "An Early Scroll",
        text: "A now-burned library held one scroll you were allowed to read before the fire. You memorized the first seven principles of cultivation before you understood any of them.",
        effects: "Gain 1 Technique Scroll",
        apply: (s) => { s.techniqueScrolls += 1; }
      },
      {
        id: "the-wound",
        title: "That Old Wound",
        text: "You walk with a slight hitch when the rain comes. No healer can explain it. It does not stop you — but it reminds you of mortality on quiet mornings.",
        effects: "Physique −1, Comprehension +2, Karma +1",
        apply: (s) => { s.stats.physique = Math.max(1, s.stats.physique - 1); s.stats.comprehension += 2; s.stats.karma += 1; }
      },
      {
        id: "beast-encounter",
        title: "A Beast You Didn't Kill",
        text: "You once had a massive spirit beast cornered and chose to turn away. Weakness or wisdom — you still debate it. The beast's eyes haven't left your memory.",
        effects: "Karma +3, Fortune −1",
        apply: (s) => { s.stats.karma += 3; s.stats.fortune = Math.max(1, s.stats.fortune - 1); }
      },
      {
        id: "cursed-mark",
        title: "A Mark You Cannot Explain",
        text: "There is a mark on your inner wrist that appeared overnight three years ago. It does not hurt. It does not fade. Scholars have been conflicted — one said it was a seal, another said it was a blessing.",
        effects: "Qi Max +10, Battle Qi Max +10",
        apply: (s) => { s.qiMax += 10; s.battleQiMax += 10; s.battleQi = Math.min(s.battleQi, s.battleQiMax); }
      }
    ]
  }
};
