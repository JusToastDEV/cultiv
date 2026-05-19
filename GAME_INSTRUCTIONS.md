# CultivationHTML - Gameplay Expansion Instructions

## 1) Current Project State
This repo is a static browser cultivation RPG prototype built in plain HTML, CSS, and JavaScript.

Current implementation reality:
- Core runtime is centered in `main.js`
- Content and progression data live in `data.js`
- UI shell is in `index.html`
- Visual systems are in `styles.css`
- Saves are local and browser-bound via `localStorage`

This file is the project-facing instruction document for future expansion work. It should describe both design intent and the actual runtime systems that already exist.

## 2) Product Direction
Build an event-rich cultivation sandbox with clear progression, meaningful city interaction, and system-driven build identity.

The prototype should emphasize:
- replayable event chains over repetitive grind
- strong differences between body and soul development
- factions, experts, cities, and markets as active progression engines
- silver and materials as meaningful strategic resources
- data-driven expansion instead of hardcoded one-off content

## 3) Non-Negotiable Design Rules
1. Systems must reinforce cultivation fantasy.
2. Cities must always offer at least one meaningful sink for silver.
3. Scrolls and advanced methods must feel rare and sourced from believable places.
4. Body and soul cultivation must remain mechanically distinct.
5. New content should be data-driven when practical.
6. Inspiration is acceptable; direct copying of protected content is not.

## 4) Current Core Systems
These systems already exist and should be extended, not replaced casually.

### 4.1 Realms And Stages
- Realm ladder is defined in `GAME_CONSTANTS.realms` in `data.js`
- Each realm currently has 3 stages
- Breakthrough logic already uses the realm array length dynamically
- Adding realms in `data.js` is enough to extend the breakthrough ladder structurally

### 4.2 Cultivation Pillars
- Body methods and soul methods are separate
- Active cultivation loadouts exist:
  - `activeBodyTechniqueId`
  - `activeSoulTechniqueId`
- `meditate` and `trainSoul` route through soul methods
- `trainBody` routes through body methods

### 4.3 Materials And Cultivation Blending
- Listed `materialCatalysts` on techniques are recommended catalysts
- Improvised blending is allowed only for body-rebuilding methods
- Ore, metal, mineral, core, herb, poison, and similar materials have tag-driven effects
- Multi-material selection is already implemented for body cultivation
- Soul methods are intentionally restricted to their listed compatible catalysts

### 4.4 City Economy
- City actions are unified through an interaction modal
- Current silver sinks include:
  - inns and recovery
  - training chambers
  - scripture auctions
  - material caches
  - expert recruitment and training
  - equipment and consumable markets

### 4.5 Factions And Experts
- Guild and sect affiliation already exist
- Standing affects access to contracts and experts
- Cities can host recruitable cultivation experts
- Recruited experts can train the player or be convened as a council

### 4.6 Combat And Loot
- Normal battles now favor area-themed materials
- Scroll drops are rare and should stay rare
- Advanced manuals should come more often from auctions, ruins, inheritances, experts, or rare encounter chains than from ordinary beasts

### 4.7 Event Framework
- Events are data-driven in `GAME_CONSTANTS.events` and `cityEventPools`
- Interactive modal events already support:
  - multiple choices
  - stat checks
  - success and failure branches
  - delayed flags via quest/event state

## 5) Required Expansion Strategy
When adding new gameplay, prioritize these directions.

### 5.1 City Expansion
Cities should continue becoming the main strategic layer between battles.

Expand with:
- submenus for auction house, forge hall, apothecary, and expert hall
- city-specific legal restrictions and specialty inventories
- black market access tied to karma, faction standing, or city law
- city permits, faction dues, and service contracts

### 5.2 Realm Expansion
Realm growth must continue beyond the current high tiers.

Current planned progression ladder:
- Mortal
- Qi Condensation
- Foundation
- Core Formation
- Nascent Soul
- Soul Formation
- Void Refinement
- Saint Ascension
- Immortal Lord
- Dao Sovereign

Design rule:
- Every new realm must include 3 stage names and a longevity baseline
- New realms should also imply stronger cities, rarer events, and higher-tier technique families over time

### 5.3 Technique Growth
New methods should not just be larger stat numbers.

Every meaningful technique should define:
- `grade`
- `pillar`
- `category`
- `origin`
- `realmReq`
- `desc`
- `drawbacks`
- `materialCatalysts`
- `bonusPerLevel`

Additions should aim for:
- more high-realm body methods
- more high-realm soul methods
- later spirit, alchemy, and crafting paths once the prototype supports them cleanly

### 5.4 Material Logic
Material logic must remain fictionally coherent.

Rules:
- Ore, metal, mineral, and similar hardening materials should mostly support body rebuilding, physique growth, or dense body refinement.
- Herbs and medicines should support recovery, stabilization, and safe reinforcement.
- Cores and blood materials should feel strong but unstable.
- Poison materials should be risky and should not read like generic free power.
- Soul methods should not casually accept arbitrary body-hardening materials.

### 5.5 Scroll Distribution
Manual scarcity matters.

Rules:
- Wolves, jackals, and low-tier beasts should almost never produce advanced scrolls.
- Technique scrolls belong primarily in:
  - ruins
  - rifts
  - auction lots
  - faction rewards
  - inheritance chains
  - expert lessons
- Battle arts should remain somewhat more accessible than high-grade core cultivation methods.

## 6) Runtime Extension Points
When modifying gameplay, prefer extending these runtime seams.

### 6.1 In `data.js`
Use for:
- new realms
- new techniques
- new materials
- new equipment
- city expert rosters
- event pools

### 6.2 In `main.js`
Use for:
- economy and market behavior
- cultivation reward resolution
- city interaction flow
- battle reward generation
- expert recruitment and training rules
- breakthrough and progression logic

### 6.3 In `index.html`
Use for:
- new panels only when the current modal and menu structure cannot support the feature cleanly

### 6.4 In `styles.css`
Use for:
- visual structure for new panels, rows, chips, cards, and lists
- avoid massive unrelated restyling during system additions

## 7) Coding Rules For Future Expansion
1. Prefer minimal, coherent changes over wide rewrites.
2. Preserve save compatibility whenever feasible.
3. Keep new systems data-driven.
4. Avoid adding mechanics that bypass city/faction/material progression unless intentionally special.
5. If a new mechanic creates a new resource loop, add at least one acquisition source and one sink.
6. If you add new high-tier realms, do not forget to consider event and item sourcing implications.

## 8) Immediate Next Gameplay Targets
These are the most valuable next systems to expand.

1. Higher-realm events and cities for post-Soul-Formation play.
2. Alchemy and poison crafting instead of only finding refined poison items.
3. City subdistrict menus so the city action modal scales cleanly.
4. Enemy archetypes with more believable loot and manual ownership.
5. More realm-gated techniques for the newly added high realms.

## 9) Originality Guardrails
Use cultivation fiction as genre inspiration only.

Do not:
- reuse protected character names
- reuse specific named sects or signature techniques from one franchise
- reproduce distinctive story arcs or dialogue

If content feels too close to one recognizable source, redesign it before implementation.

No bland stat sticks unless intentionally common-tier filler.

### 9.1 Inventory and Carrying Capacity System
The game must support constrained inventory with meaningful logistics choices.

Inventory model requirements:
- Hybrid limits: both slot count and carry weight apply.
- Stack rules by item type (materials stack high, artifacts stack low or not at all).
- Encumbrance states: Light, Normal, Heavy, Overburdened.
- Encumbrance affects movement, travel event success, stealth, and combat initiative.
- Currency should have wallet storage and not consume normal bag slots.

Item storage schema (minimum):
- itemId
- itemType
- stackSize
- maxStack
- unitWeight
- volumeClass
- storageFlags (bag, vault, house, ring, sect)

Design rules:
- Critical quest items should not be lost to routine inventory overflow.
- Valuable crafting materials should force risk decisions during exploration.
- Carrying too much loot must feel powerful but dangerous, not merely annoying.

### 9.2 Dimensional Rings and Advanced Storage Artifacts
Dimensional rings are late-early to mid-game progression goals, not starting defaults.

Ring tiers:
- Cracked Ring: small extra slots, unstable, chance of item damage on severe backlash.
- Standard Ring: reliable storage expansion, mild spiritual upkeep.
- Spirit Ring: larger capacity, reduced item decay, better sorting features.
- Domain Ring: massive storage, supports fragile/rare materials safely.
- Void Ring: legendary tier, extreme capacity with high theft/tribulation attention risk.

Ring mechanics:
- Rings have capacity by slot and spiritual load.
- Overloading a ring can trigger instability events, item loss, or temporary lockout.
- Some restricted items cannot enter low-tier rings (volatile pills, cursed relics, active arrays).
- Ring ownership can be contested via theft, inheritance duels, or sect confiscation events.

Quality requirement:
Ring progression should feel like a major power-economy milestone, not a simple backpack upgrade.

## 10) World Building Requirements
- Minimum 5 factions at launch (righteous sect, demonic sect, merchant guild, imperial court, hidden clan)
- Each faction must have:
  - ideology
  - preferred resources
  - allies/rivals
  - signature event types
- Region identity matters: each region gets unique hazards, opportunities, and event tags.

### 10.1 Multi-World and Multi-Capital Structure
Do not use a single-capital world design. Each world must have multiple political and cultivation centers.

World structure rules:
- Each world has 3 to 6 capital cities (martial, imperial, trade, scholarly, forbidden, frontier).
- Each capital has a distinct average cultivation level and resource economy.
- Capital power balance must shift over time due to events, wars, and tribulations.
- Players should have reasons to travel between capitals (exclusive manuals, auctions, mentors, faction courts).

Capital city profile schema (minimum):
- cityId
- worldId
- rulingPowers
- averageRealmBand
- marketSpecialties
- lawSeverity
- factionInfluence
- localEventPools

City cultivation examples:
- Frontier Capital: more Qi Condensation and Foundation cultivators, frequent beast tide events.
- Imperial Capital: Core and Nascent elites, strict law, heavy faction politics.
- Hidden Capital: fewer but stronger experts, inheritance and forbidden-art events.

### 10.2 Regional Cultivation Level Ecology
Each region and city should define a "cultivation pressure" profile.

Pressure profile controls:
- enemy realm distribution
- event danger scaling
- resource rarity tables
- breakthrough support infrastructure (spirit veins, alchemy halls, training arrays)

Gameplay rule:
Low-realm players can enter high-pressure regions but face severe risk unless using stealth, escorts, or protective artifacts.

### 10.3 Housing, Estates, and City Residency
Players can acquire homes for storage, crafting, and social status progression.

Acquisition routes:
- Purchase property in cities with available land and legal eligibility.
- Earn sect-assigned residence through rank and contributions.
- Inherit family estate via origin/background or event chain outcomes.
- Seize abandoned or ruined property through risk-heavy events.

Housing system rules:
- Property access depends on city law, faction standing, wealth, and permit events.
- Homes provide secure storage, treasury vault, and optional craft/alchemy rooms.
- Better homes unlock servant management, workshop upgrades, and passive income options.
- Property can be taxed, raided, contested, or confiscated based on politics and karma.

Residence tiers:
- Rented Room
- Courtyard House
- Clan Compound
- City Manor
- Spirit Vein Estate

Birth status design:
- Wealthy birth backgrounds begin with better shelter/resources but stronger political obligations.
- Poor birth backgrounds start constrained but receive unique grit/survival event advantages.

Resource storage requirement:
- Materials, crafted goods, and currency can be stored in housing vaults.
- Housing plus ring storage should enable long-term hoarding strategies without removing all scarcity pressure.

## 11) Combat and Pacing Direction
Keep combat concise and tactical, not bloated.
- Fast resolution for common encounters
- Deeper decision points for elites/bosses/tribulations
- Events and faction consequences should be at least as important as combat victories

## 12) F2P Monetization Constraints
Allowed:
- cosmetics (profile frames, visual effects, UI themes)
- optional non-power battle pass with lore/cosmetic rewards
- extra save/load slots if fair

Forbidden:
- paid power stats
- paid progression gates
- energy systems that block normal play
- premium-only core content

## 13) Anti-Generic "AI-Looking" Quality Rules
- Avoid generic fantasy names; build naming conventions by faction language style.
- Every major feature needs a "why this exists in this world" note.
- Prefer specific consequences over vague text.
- Ban placeholder prose in shipped content.
- Every event writer must include:
  - conflict
  - choice tension
  - consequence clarity

## 14) Content Authoring Workflow
1. Draft event in template.
2. Link to at least 1 existing tag system and 1 follow-up possibility.
3. Peer review for lore and balance.
4. Simulate 20+ randomized runs including new event.
5. Approve, version, and add to codex index.

## 15) Technical Delivery Plan (Web)
Recommended stack (initial):
- Frontend: HTML/CSS/TypeScript (or lightweight framework if needed)
- Data: JSON content packs for events/items/factions
- Runtime:
  - deterministic random seed support
  - save system with schema versioning
  - event dispatcher with condition evaluator

Must-have technical features:
- Autosave + manual save slots
- Content validation scripts (missing tags, unreachable events, invalid outcomes)
- Telemetry for balancing (event pick rates, failure rates, churn points)

## 16) Definition of Done (Per Feature)
A feature is done only if:
- Mechanically complete
- Properly integrated into event ecosystem
- Has UI feedback and tooltips
- Has balance pass notes
- Has at least one regression test or validation script coverage

## 17) Starter Milestones
Milestone A:
- Core data models (events, options, outcomes, items, factions)
- Minimal playable loop with 20 events

Milestone B:
- Realm breakthrough system + tribulation prototype
- 60 total events + 2 event chains

Milestone C:
- Artifact system v1
- Faction reputation and consequence hooks
- 120+ events and codex browser

Milestone D:
- Balance, polish, mobile-friendly layout, onboarding rewrite
- Launch candidate for closed alpha

## 18) Immediate Next Implementation Tasks
1. Create event JSON schema and validator.
2. Implement event dispatcher and condition engine.
3. Build a tiny playable vertical slice (10-20 events).
4. Add save/load and deterministic seed support.
5. Start content bible (naming rules, faction glossary, realm glossary).

---
Use this file as the single source of truth for creative scope and implementation standards.
If a new idea conflicts with these rules, update this file first before coding it.
