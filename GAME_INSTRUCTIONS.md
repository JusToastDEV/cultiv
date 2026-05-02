# Cultivation Web Game - Creative + Production Instructions

## 1) Core Vision
Build a free-to-play, browser-based cultivation RPG that is event-rich, replayable, and fair.
The game should reward planning, adaptation, and long-term progression instead of pay-to-win pressure.

Design target:
- Session style: medium-length tactical runs with persistent account progression
- Tone: mythic martial world, high stakes, faction politics, treasures, betrayals, breakthroughs
- Feel: "one more event" loop with meaningful choices and consequences

## 2) Product Pillars (Non-Negotiable)
1. Event density over empty grinding.
2. Player choice must have consequences.
3. No whale mechanics. Monetization must be cosmetic or convenience-only.
4. Every system must reinforce cultivation fantasy (realm progression, resources, dao paths, tribulations).
5. Distinct identity: inspired by genre, but not direct copies of protected IP.

## 3) Genre References Policy (Important)
Use famous cultivation stories as inspiration for structure and themes only.
Do NOT copy protected names, factions, characters, exact artifacts, story arcs, or dialogue.

Allowed:
- Inspired mechanics (sect rivalry, inheritance trials, spirit roots, alchemy, forging, body tempering)
- Inspired themes (revenge, fate, forbidden techniques, demonic vs righteous conflict)

Not allowed:
- Reusing exact titles, unique character names, signature moves, or recognizable one-to-one story beats
- Reproducing original art, text, or script content

Rule of thumb:
If a fan can point at content and say "this is directly from one specific series," redesign it.

## 4) Player Experience Goals
- First 10 minutes: player understands core loop and gets at least 3 meaningful decisions.
- First 60 minutes: player experiences breakthrough, setback, rare event, and faction consequence.
- Ongoing: each session reveals new event branches, traits, artifact interactions, and world state changes.

## 5) High-Level Core Loop
1. Prepare run (choose background, starting manual, minor blessing/curse).
2. Explore nodes (region map with event, combat, rest, market, ruins, faction nodes).
3. Resolve events (branching choices with stats, tags, and trait checks).
4. Gain resources (qi, insights, pills, materials, reputation, karma).
5. Attempt breakthroughs (risk/reward checks, tribulations, potential injury/death).
6. Persist progress (unlock codex entries, account perks, alternate origins, event chains).

## 6) Progression Architecture
### 6.1 Character Progression (Run-based)
- Realms: Mortal -> Qi Condensation -> Foundation -> Core -> Nascent -> Soul Formation (extend later)
- Stats:
  - Physique
  - Soul Sense
  - Comprehension
  - Fortune
  - Karma (righteous/demonic alignment pressure)
- Hidden values:
  - Heart Demons
  - Tribulation Instability
  - Dao Resonance

### 6.2 Meta Progression (Account-based)
- Unlock new origins, manuals, faction starts, event pools
- Unlock QoL systems (faster codex lookup, better scouting intel)
- No raw pay-to-win stat multipliers

### 6.3 Full Cultivation Stage Model (V1)
Each major realm has 3 sub-stages: Early, Mid, Late.
Every breakthrough checks core stats, resource quality, and method compatibility.

Stage model:
- Mortal:
  - Body Tempering
  - Meridian Opening
  - Qi Sensing
- Qi Condensation:
  - Early Condensation
  - Mid Condensation
  - Great Perfection Condensation
- Foundation Establishment:
  - Human Foundation
  - Earth Foundation
  - Heaven Foundation
- Core Formation:
  - Cracked Core
  - Stable Core
  - Flawless Core
- Nascent Soul:
  - Soul Seed
  - Soul Embryo
  - Nascent Emergence
- Soul Formation:
  - Soul Integration
  - Domain Awakening
  - Domain Perfection

Design requirements:
- Foundation and Core quality permanently affect late-game ceiling.
- Early shortcuts create hidden debt (instability, heart demons, reduced max lifespan).
- Rare events can partially repair debt but never for free.

### 6.4 Cultivation Methods and Technique Quality
Cultivation methods must feel meaningfully different, not simple stat reskins.

Method quality tiers:
- Mortal Grade: easy to learn, weak scaling, often with side effects.
- Spirit Grade: balanced, reliable baseline for most players.
- Earth Grade: harder breakthroughs, stronger realm bonuses.
- Heaven Grade: high requirement, powerful synergies, rare inheritance access.
- Emperor Grade: severe entry checks, major power spikes, narrative consequences.
- Forbidden Grade: strongest short-term growth, heavy karma and lifespan risk.

Method attributes (minimum):
- breakthroughDifficulty
- qiEfficiency
- combatAffinityTags
- sideEffects
- lifespanModifier
- heartDemonRisk
- tribulationModifier

Method design rules:
- Lower-tier methods can have fast starts but capped potential.
- High-tier methods must be difficult to stabilize and maintain.
- Some low-tier manuals should shorten lifespan or damage meridians when overused.
- Method swaps should cost time/resources and can cause backlash.

### 6.5 Breakthrough Risk and Lifespan Systems
Breakthrough outcomes should create tension, not binary pass/fail only.

Breakthrough outcomes:
- Perfect Success: gain bonus stability, minor trait upgrade.
- Standard Success: advance normally.
- Flawed Success: advance with permanent or semi-permanent penalty.
- Failed Attempt: stay in stage, gain instability/wounds.
- Backlash: regression, severe injury, or lifespan loss.

Lifespan system:
- Lifespan is a core resource, not cosmetic flavor.
- Methods, pills, forbidden arts, and tribulation damage can reduce lifespan.
- Some rare techniques trade lifespan for temporary combat spikes.
- Long-life paths exist but require sacrifice in burst combat potential.
- Lifespan thresholds unlock special events (desperation arcs, rebirth options, legacy transfer).

### 6.6 Longevity Growth by Realm
Advancing realms must generally increase longevity, but gains depend on cultivation quality.

Longevity rules:
- Each major realm grants a base longevity increase.
- Foundation/Core quality modifies longevity gain up or down.
- Flawed breakthroughs reduce longevity gain from that realm.
- Forbidden methods can grant temporary pseudo-longevity at hidden long-term cost.
- Body damage, soul fractures, and heart demons can permanently consume max lifespan.

Suggested baseline table (for balancing prototype only):
- Mortal: 60 to 100 years baseline
- Qi Condensation completion: +20 to +40 years
- Foundation completion: +60 to +120 years
- Core completion: +150 to +300 years
- Nascent completion: +300 to +600 years
- Soul Formation completion: +600 to +1200 years

Balance note:
These values are tuning scaffolds and should be adjusted with telemetry before public release.

### 6.7 Multi-Path Cultivation Disciplines
The game supports parallel cultivation systems beyond basic qi advancement.

Primary paths:
- Body Cultivation: physique durability, burst melee power, poison resistance, recovery speed.
- Soul Cultivation: perception, control, illusion resistance, spirit attack/defense.
- Spirit Cultivation: contract entities, spirit channels, resonance buffs, companion mechanics.
- Craft Cultivation: forging arrays, weapon/armor refinement, inscription systems.
- Alchemy Cultivation: pill crafting, toxicity management, medicinal body tempering, economy leverage.

Path interaction rules:
- Players can specialize in one primary path and one secondary path without severe penalties.
- Triple-path and above builds are possible but add heavy resource and comprehension burden.
- Path conflicts exist (example: unstable body technique vs delicate soul method).
- High mastery in one path can unlock unique cross-path techniques.

### 6.8 Learning New Techniques and Method Evolution
Players should be able to learn new cultivation techniques over time rather than being locked forever.

Technique acquisition sources:
- Sect libraries and elders
- Capital auctions and black markets
- Inheritance realms and hidden ruins
- Enemy manuals/fragments after conflicts
- Craft/alchemy self-created techniques at high mastery

Technique learning model:
- Technique rarity and grade determine comprehension time.
- Learning requires resource cost plus compatibility checks.
- Low compatibility increases failure chance, qi deviation risk, and soul strain.
- Replacing a core cultivation method should trigger conversion events and potential backlash.
- Legacy conversion options should allow partial transfer instead of full reset.

Technique progression states:
- Unlearned -> Initiate -> Proficient -> Mastered -> Transcendent Variant

Design requirement:
At least 30% of advanced techniques should have branching evolution choices so endgame builds do not converge into one obvious meta.

## 7) Event System Blueprint (Must Be Robust)
Events are the main content engine. Build this first and keep it data-driven.

Event object schema (minimum):
- id
- title
- flavorText
- tags (e.g., sect, demonic, ancient-ruin, karma, artifact, beast)
- triggerConditions
- options[]
- outcomes[]
- cooldown / uniqueness rules
- followupEventIds

Option schema (minimum):
- text
- requirements (stats/tags/items/relationship)
- successWeights
- failureWeights
- immediateEffects
- delayedEffects

Outcome design rules:
- Every option should change at least one meaningful state.
- At least 25% of major events should have delayed consequences.
- Some outcomes should add flags used by future events.

## 8) Event Content Targets (Initial Production)
Phase 1 target:
- 120 small events
- 40 medium branching events
- 12 long multi-step chains
- 8 tribulation events
- 6 inheritance realm events

Quality gates per event:
- Has at least 2 viable options
- Has at least 1 non-obvious consequence
- Uses at least 1 system interaction (item, stat, karma, faction, trait)
- Passes tone and lore consistency review

## 9) Artifact and Item Design Rules
Item categories:
- Martial manuals
- Pills/elixirs
- Weapons
- Talismans
- Legacy fragments
- Rare curios

Artifact depth checklist:
- Passive effect
- Active trigger or conditional effect
- Synergy tag (alchemy, sword, blood, soul, array, etc.)
- Drawback or risk for high-power artifacts
- Lore snippet (2-5 lines) connected to world history

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
