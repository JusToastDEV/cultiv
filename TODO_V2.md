# Sealed Heavens V2 — Master Development TODO

**Status:** Active  
**Last Updated:** May 2026  
**Guiding Doc:** INSTRUCTIONS.md + VISION_V2.md  
**Priority Scale:** P0 = game-breaking / P1 = launch-critical / P2 = important / P3 = polish / P4 = future

---

## LEGEND
- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked / needs design decision

---

## SECTION 0 — CRITICAL BUG FIXES (P0)

These break core game integrity right now.

- [ ] **Cross-tab battle desync** — Battle state lives in localStorage only. Two open tabs can cause contradictory state. Fix: use BroadcastChannel API to push state updates from the active tab. Any tab that sends a battle action must broadcast the updated state to all other tabs.
- [x] **Simultaneous meditation + body training** — FIXED: Added exclusive action mutex on server (`EXCLUSIVE_ACTIONS`). All three training actions (meditate/trainBody/trainSoul) now share a single active slot. Starting a second action while one is in progress returns a 429 with clear error message.
- [x] **Very long meditation cannot be cancelled** — FIXED: Added `cancelAction` endpoint that clears all exclusive action cooldowns. Cancel button wired in both the action ribbon (top) and cultivate panel. Active action note shows which action is running with remaining time.
- [x] **Task start has 30s–1min visual delay** — FIXED: Optimistic UI added to `doAction()`. Buttons disable instantly on click and show "Starting…" before server responds. Error state restores buttons.
- [ ] **Stats are wildly unbalanced** — "Gate 97% Qi" and "addons from items from breakthroughs/training" are additively broken. Audit every stat modifier path and rewrite as a multiplicative pipeline with caps. See Section 5 for the balancing pass.
- [ ] **Technique scrolls are too easy to get** — Patron Hall gives them on a watch-ad button. Must be rare drops from high-tier zones or player trade only. Remove the ad-watch scroll reward entirely or make it significantly rarer, SIGNIFICANTLY.
- [ ] **Cultivation tech can be switched freely with no penalty** — Switching cultivation arts mid-path must impose: (1) 1 full stage rollback within current realm, (2) 20% Qi reserve loss, (3) 3-day cooldown on switching again. Implement penalty engine in `handleGameAction` and client confirm modal.
- [ ] **Default techniques unrelated to origin** — should be some default really shitty cultivation methods as well for harder starts, shi like that, "Silent Mind" and "Iron Skin Sutra" are generic stubs. Each origin must start with a technique flavored to it. Outlander gets Iron Body Wanderer's Sutra, Scholar gets Ink-Breath Clarity method, etc. Map all origins to starter techs.
- [ ] **Materials for meditation accessible without correct art** — `getCultivationMaterialCandidates()` does not check if the player has the required cultivation art before showing items as catalysts. Add a check: item tags must match the technique's `materialCatalysts` requirement list.

---

## SECTION 1 — REMOVE / REPLACE (P0 / P1)

Items that must be deleted before any new feature is meaningful.

- [ ] **Remove AFK tab entirely** — This is a live-service game. "AFK" happens naturally when you start a task and close the tab. The dedicated AFK queue panel is ideologically contradictory. Remove nav item and section. Keep server-side passive resolution (lazy delta-t at login) but eliminate the explicit tab.
- [ ] **Remove Save button** — Progress is auto-saved server-side on every action. The save button is a relic of the local prototype. Remove button and confirm-save logic from city panel and everywhere else.
- [ ] **Remove "City Affairs" button** — Replace with navigable city space (see Section 3). The modal city blurb is a placeholder that must die.
- [ ] **Remove "Scout Wilds" button from city panel** — Replace with the actual tile map (see Section 4). Scout Wilds as a button action is the wrong abstraction.
- [ ] **Remove Starter Goals layout** — The upfront checklist of goals feels robotic. Goals/quests should be discovered through play: talking to NPCs, exploring zones, encountering events. Remove the quest-list-upfront pattern entirely.
- [ ] **Remove separate Inventory/Equipment/Battle/Techniques/Map/Status/Patron/Bank buttons from city card** — These should be integrated into the proper nav structure (sidebar/top nav) or reachable via the navigable city. The "Menus" card in the City panel is the wrong UX.
- [ ] **Remove left-sidebar tab for Battle** — Battle is triggered contextually (encounter an enemy while exploring, or challenge from city NPC). Not a standalone sidebar section.
- [ ] **Remove left-sidebar tab for Techniques** — Techniques live under the Me/Profile section or inside the Cultivation panel.

---

## SECTION 2 — UI REWORK (P0 / P1)

Differentiate completely from idleqi.com. Kill the neon-cyber aesthetic. Apply the mandated palette.

### 2.1 Global Visual Identity
- [ ] **Palette audit** — Strip any lingering neon cyan, bright teal saturated fills, or blue glow effects. Replace with: ink black (`#0a0b0d`), oxidized bronze (`#8b6914`, `#c9a232`), aged paper (`#e8dfc0`, `#d4c8b1`), lacquer red (`#9e2020`, `#c23232`), jade (`#3a7d60`, `#4caa7e`). Keep current variable names, update values.
- [ ] **Typography pass** — Cinzel for headers stays. Body copy: swap Manrope for a warmer serif-adjacent font (Crimson Pro or Source Serif 4 at 16–18px). Reduce use of all-caps labels to only topbar stats. Increase line-height to 1.65 for readability.
- [ ] **Card redesign** — Cards should feel like worn vellum or lacquered wood. Use `box-shadow: inset 0 1px 0 rgba(201,162,50,0.15)` for a bronze-lit top edge. Remove rounded corners above 8px (too modern/app-like). Border: 1px solid `rgba(201,162,50,0.18)`.
- [ ] **Button redesign** — Primary buttons: lacquer red gradient with embossed top light. Ghost/secondary: aged paper border with ink text. Danger: deep crimson. Remove any glow on hover, replace with a subtle bronze shimmer.
- [ ] **Progress bars** — Replace pill-shaped colorful bars with stone-carved groove aesthetic: flat track, carved shadow inset, colored fill using element-tinted gradients (fire → ember orange, water → jade teal, etc.).
- [ ] **Mobile layout** — All panels must be single-column on <768px. Cards stack. Sidebar collapses to a bottom dock with icon-only tabs. Touch targets ≥44px. No horizontal scrolling anywhere.

### 2.2 Navigation Restructure
- [ ] **New nav tabs** (per INSTRUCTIONS.md): `Cultivate` / `World` / `Faction` / `City` / `Me`
  - **Cultivate**: meditation, body training, soul training, breakthrough, technique/art summary
  - **World**: tile map (see Section 4), travel, encounter log, active zone
  - **Faction**: guild/sect panel, rivals, companions, diplomacy
  - **City**: navigable city grid (see Section 3), shop, bank building, patron hall
  - **Me**: character stats, inventory, equipment, skills, profile, settings
- [ ] **Topbar redesign** — Slim it down. Show: realm badge, HP/Qi bars (compact), silver + spirit stones. Move logout to Me panel. Remove AFK badge. Add a world-time clock (see Section 9).
- [ ] **Active action indicator** — When any action is in progress, show a persistent ribbon/banner below topbar: "Meditating... [cancel]" with a live countdown. This replaces the confusing action-status note.

### 2.3 Specific Panel Reworks
- [ ] **Cultivation panel** — Show cultivation XP bar prominently at top. Three training cards below (meditate, body, soul) with clear mutual-exclusion visual state (locked-out while one is active). Breakthrough section at bottom with a dramatic call-to-action only visible when ready. Add sub-stage progress indicators within each realm.
- [ ] **Status / Me panel** — Replace stat wall with a character silhouette layout: head (soul sense), torso (physique, HP), arms (martial), legs (qinggong), dantian (qi max, purity). Stats show on hover/tap per body region. Include cultivation lane progress bars: Body / Qi / Soul / Martial / Profession / Social — each on its own progress track.
- [ ] **Inventory panel** — Replace list with a grid of 40+ square slots (like actual MMO inventory grid). Each slot shows item icon art placeholder (⬜ with item-type color border). Hover/tap shows item name, tier, description, usable actions. Weight bar at top. Filter tabs: All / Materials / Equipment / Pills / Scrolls / Misc.
- [ ] **Battle panel** — Battle must feel dramatic. Player and enemy shown with health bars and cultivation realm badges. Combat log scrollable below. Action buttons: Attack / Defend / Technique / Item / Flee — always visible, not in a separate modal. Battle state synced via BroadcastChannel (see cross-tab fix).
- [ ] **World map** — See Section 4.
- [ ] **City panel** — See Section 3.

---

## SECTION 3 — CITY AS NAVIGABLE SPACE (P1)

Cities should feel like places, not menu buttons.

- [ ] **City grid design** — Each city rendered as a small ASCII/tile grid (2.5D visual or pure CSS grid). Grid cells: Main Gate, Market Street, Tavern, Sect Registration Hall, Alchemy Shop, Weapon Forge, Spirit Hall, Bank, Inn, Dungeon Entrance (if applicable). Player navigates by clicking/tapping cells.
- [ ] **Bank building** — Bank is a physical cell in the city grid. Walking to it opens the deposit/withdraw UI. Universal bank vs. city-specific bank depends on city law level. High-law cities have a branch of the Continental Silver Bank. Low-law cities have only a local vault with higher fees.
- [ ] **Market building** — Players can buy/sell items here. Stock refreshes on world time cycle. Rare items require reputation or sect standing to unlock. Prices fluctuate based on supply/demand simulation.
- [ ] **Alchemy shop** — Buy low-tier pills, sell refined materials. Alchemy master NPC inside who gives crafting quests.
- [ ] **Weapon forge** — Buy/sell weapons and armor. Blacksmith NPC who can upgrade equipment if you bring materials.
- [ ] **Sect Registration Hall** — Join sects here. Check faction standings. Talk to sect recruiters (named NPCs).
- [ ] **Tavern / Inn** — Pick up rumors (trigger quests). Pay for rest (temporary HP/Qi regen bonus). Talk to traveling NPCs for rare quest hooks.
- [ ] **City NPC placement** — Named NPCs from the simulation roam the city. When you share a city district with a rival NPC, they appear as an encounter option. You can challenge, ignore, or pay tribute.
- [ ] **City law enforcement** — Law-level cities detect wanted cultivators. High-law = city guards attack if your reputation is low enough. Black market districts only accessible with sufficient city infamy or jianghu standing.
- [ ] **Traveling between cities** — Travel costs time (delta based on distance, qinggong, terrain). Road tiles have encounter chances. Miasma/cold/gravity hazard zones gate travel by body cultivation tier.

---

## SECTION 4 — TILE-BASED EXPLORABLE MAP (P1)

The world must be walkable, not a dropdown.

- [ ] **Map grid schema** — Implement `map_tiles` table in D1: `tile_id`, `x`, `y`, `region_id`, `terrain_type` (road/forest/mountain/ruin/spirit-vein/city), `hazard_level`, `spirit_density`, `zone_id` (nullable), `npc_ids` (JSON), `resource_nodes` (JSON), `controlled_by` (sect_id or null), `last_event_at`.
- [ ] **Tile rendering** — Client renders the map as a CSS grid. Each tile: a color-coded square with a terrain icon (text glyph or small emoji). Player position: highlighted tile. Roads connect tiles. Fog of war: undiscovered tiles shown as `?` until visited.
- [ ] **Player movement** — Click a tile to move to it. If tile is adjacent, instant. If further, pathfinding via road tiles with time cost shown. Submit movement as a server action. Server validates hazard gating.
- [ ] **Travel time system** — Tile-to-tile travel on roads: 2–5 real minutes per tile based on realm/qinggong. Off-road: 2x. Extreme terrain (mountain, void rift): requires body cultivation ≥ hazard_level. Player moves in the background (can do other actions while traveling). Arrival triggers a zone entry event.
- [ ] **Zone entry / lazy resolution** — On entering a zone tile: server resolves Δt since last visit, spawns appropriate resources, advances NPC states for that zone. No cron loops. Pure event-driven.
- [ ] **Encounter system** — Moving through wilderness tiles has a % chance to trigger an encounter: random beast, traveling merchant, ambush, or natural phenomenon. Chance scales with danger_level.
- [ ] **Resource nodes on tiles** — Spirit herb nodes, ore veins, and beast lairs tied to specific tiles. Have respawn timers. When a player arrives at a tile with a resource node, show it as an interactive element. Harvesting depletes it for that player for the respawn window.
- [ ] **Sect territory tiles** — Sects claim tiles around their compound. Entering enemy territory without standing triggers a warning and possible guard NPC encounter.
- [ ] **Fog of war** — New characters start with only their starting city tile and immediate roads visible. Exploration reveals adjacent tiles. Scouted tiles (visited) are always visible. Unvisited tiles in known regions show terrain type but not resource detail.
- [ ] **Multi-character party** — Party members share a tile. Party members can assist in battles (contribution system). Party formed in same city, disbanded any time.

---

## SECTION 5 — CULTIVATION SYSTEM REBALANCING (P1)

The math is broken and the progression feels cheap.

- [ ] **Qi requirement scaling** — Stage XP costs: linear within a realm (shallow curve). Breakthrough costs: exponential. Formula: `breakthrough_qi_needed = base_realm_cost * (1.8 ^ realm_index) * stage_multiplier`. Stage multipliers: Stage 1 = 1.0, Stage 2 = 1.5, Stage 3 = 2.2. This means higher realms need thousands of meditation sessions, not tens.
- [ ] **Sub-stages within each realm** — Each of the 3 stages (Early / Middle / Late) contains 3 minor thresholds(9 thresholds per realm). Minor threshold = stat boost + new dialogue unlock. No dramatic event needed. Just visible progress markers.
- [ ] **Stage quality system** — When breaking through a stage, calculate quality based on: preparation materials (50%), location spirit density (25%), injury/deviation state (15%), mentor bonus (10%). Quality tiers: Cracked / Common / Refined / Flawless / Perfect. Permanently recorded. Higher quality = higher stat caps at that stage. Never retroactively improvable.
- [ ] **Foundation quality permanent branch** — If foundation is Cracked, Core Formation ceiling is capped. Perfect foundation unlocks additional Core Formation sub-paths. Implement this as a `quality_multiplier` multiplied into all future stat calculations for that realm, still should be ways to save your core for sure, unless you somehow actually got fucked by a giga evil npc who despises you, then ggs lol.
- [ ] **Qi deviation system** — Failed breakthroughs cause Qi Deviation debuff. Severity scales with how far under-prepared the attempt was. Mild: -20% Qi regen for 1 real-hour. Moderate: random meridian damage → –X to a stat for 3 hours + needs a healing item to fix. Severe: stage rollback (1 sub-stage) + 6 hour debuff. Add `deviation_state` to character state.
- [ ] **Breakthrough event chain** — Breakthrough is NOT a single button click. It is a 3-step event:
  1. Declare intent: choose location, optionally consume pills/arrays, assign a guardian companion.
  2. Tribulation phase: Some cultivation techniques incurr heavenly tribulation, a series of 3–5 dice rolls modified by preparation score. Each roll is a "challenge" (bad luck, technique clash, body instability). Player can spend items mid-sequence to boost rolls.
  3. Outcome: success (quality roll) or failure (deviation).
- [ ] **Heavenly tribulation at key realms** — Core Formation and Nascent Soul breakthroughs trigger a Heavenly Tribulation. Random lightning-based damage sequence. Player must survive 3 waves using HP, Qi shields, and battle arts. Fail = severe deviation, stage rollback.
- [ ] **Cultivation lane separation** — Body XP, Qi XP, Soul XP, Martial XP each advance independently. You can be Body: Core Formation but Qi: Foundation. Penalties apply for huge gaps (can't use highest-tier techniques if soul cultivation lags). Each lane has its own visible progress bar.
- [ ] **Qi purity stat** — Separate from Qi Max. High purity = less qi per technique use + better breakthrough quality rolls. Purity improved by: technique quality, meditation at spirit veins, avoiding impure pill use. Impure pills (cheaper) leave pill toxin that reduces purity temporarily.
- [ ] **Spiritual root system** — Each character has a hidden elemental affinity (Fire / Water / Wood / Metal / Earth / Lightning / Void / Dual). Root affinity determines: which techniques gain bonus efficiency (+20–40%), which materials are synergistic, which areas have resonance bonus. Revealed during Broken Meridian Crisis intro, can be refined later via rare insight items.
- [ ] **Longevity system** — Cultivation increases lifespan. Each realm grants longevity. Qi deviation, severe wounds, and pill toxin reduce longevity. Dying of old age is a valid game-ending condition (rare). Show lifespan bar in Me panel.
- [ ] **Cultivation stat formula rewrite** — All stat bonuses must flow through a single pipeline:
  ```
  final_stat = (base_stat + additive_bonuses) * multiplicative_bonuses * quality_multiplier
  ```
  No more direct flat additions from items that bypass the formula. Every item must specify whether it grants additive or multiplicative bonus.

---

## SECTION 6 — INTRO SEQUENCE REWORK (P1)

The current character creation is a sterile menu.

- [ ] **Multi-stage creation flow** — Replace current creation with a 5-act interactive narrative:
  1. **The Mortal Life** — 4 short prompts (not stat selector). "How did you spend your youth?" Choices: Laboring in fields / Studying scrolls in poverty / Training under a wandering master / Growing up in a merchant family / Surviving as a street orphan. Each choice biases starting stats and adds flavor tags.
  2. **The Catalyst** — What drove you to seek immortality? Hidden karma trait assigned by server based on seeded RNG from account creation time + choice sequence. NOT shown to player. Revealed through gameplay events.
  3. **The Broken Meridian** — A survival scenario. Your meridians are damaged. An old stranger offers three things: a tattered body cultivation manual, a pouch of spirit herbs, or a letter of introduction to a city sect. This choice determines: starting technique type, starting resource, starting faction rep.
  4. **The Root Awakening** — A brief sensory vision determines spiritual root. 5 options presented with poetic descriptions, no element label shown. The player picks the one that resonates. Server maps to element.
  5. **Departure** — Choose starting city (shown as a travel route from a birthplace map fragment). Each city has a 1-sentence atmosphere description.
- [ ] **Remove binary body/soul/balanced selector** — This is replaced by the multi-stage above.
- [ ] **Origin-linked starter technique** — Based on mortal life choice + Broken Meridian choice, assign a unique starting technique. 8+ starter techniques planned. Each has flavor text about its origin and 2–3 drawbacks. No starter technique should be optimal — they're all viable but biased.
- [ ] **Hidden karma trait** — 20+ hidden trait variants. Examples: "Blessed Meridians" (tiny daily Qi purity increase), "Void Touched" (soul sense slightly warped, see spirits others can't), "Stubborn Will" (technique cannot be forcibly removed by sect or formation). None revealed at start. Some revealed at milestones, some only via NPC dialogue or specific events.
- [ ] **Name generation assist** — Offer a randomized cultivator name as default with a refresh button. Names drawn from a curated pool of xianxia-style name parts (surnames + given names with poetic meaning tags). Allow manual name input too.

---

## SECTION 7 — NPC SIMULATION (P2)

The world should move when you're not looking.

- [ ] **Named NPC catalog** — Create 50+ named NPC templates across all regions. Each has: name, cultivation realm, elemental root, sect affiliation, personality tags (Ambitious / Reclusive / Treacherous / Noble / Obsessive), signature technique type.
- [ ] **NPC lazy advancement** — On zone entry, calculate how much time has passed since last tick. Advance NPC realm/stage proportional to Δt * their cultivation speed. Cap at their designed ceiling. Store in `npc_state`.
- [ ] **NPC memory** — NPCs remember: player humiliated them (reputation score -50), player showed mercy (+30), player completed their request (+40), player stole from their sect (-60). Store in `memory_json` column. Affects dialogue, trade prices, quest availability.
- [ ] **NPC rival escalation** — If ignored for too long, a rival NPC grows strong enough to challenge the player unprompted. If player is not in their city/region, the rival sends an "Invitation to a Duel" world event. If player ignores that, rival attacks their sect compound (if player has one).
- [ ] **NPC relationships** — NPCs have relationships to each other (allies, rivals, master-disciple). These affect group reactions: helping one NPC's ally gives rep with their whole network.
- [ ] **Named sect disciple pool** — Beyond named NPCs, sects have a pool of generic disciples that can be recruited by the player. Disciples have: cultivation realm, combat power, skill tags (herbalist, formation-layer, scout, fighter). After 10+ player interactions, a generic disciple can "name themselves" and become a named NPC.
- [ ] **NPC quests** — Named NPCs offer quests based on their current state and memory. Quest types: escort them through dangerous territory, retrieve an item they lost, duel a rival on their behalf, deliver a message to another city. Quests expire if player ignores them too long (NPC resolves situation themselves).
- [ ] **Quest difficulty and disciple scaling** — Some quests require a full team. Solo player without disciples = much harder (penalty dice rolls). With 3 disciples assigned = normalized difficulty. Some quests literally impossible solo (defend a compound while outnumbered).
- [ ] **NPC cultivation ceiling design** — No NPC can surpass Void Refinement in early-game. Only divine NPC templates can reach Mahayana/Tribulation. This ensures player can eventually rival any NPC with commitment.
- [ ] **Lazy NPC activity simulation** — When player enters a region, server runs: for each NPC in that region whose `last_tick` is old, calculate: did they gather resources? Advance in realm? Move to adjacent zone? Fight someone? Store compressed outcome in `npc_state.memory_json`.

---

## SECTION 8 — COMPANION & PET SYSTEM (P2)

Companions are sub-plots, not buffs.

- [ ] **Companion types** — Three types: Disciples (combat/craft assistants), Bonded Spirits (spiritual beasts tamed from the wild), Sworn Brothers/Sisters (peer cultivators who form a blood pact).
- [ ] **Companion recruitment** — Disciples: recruit from Sect Registration Hall or via quests. Bonded Spirits: capture in the wild via beast-taming technique (must be learned first). Sworn Brotherhood: offered by named NPCs after high trust threshold.
- [ ] **Companion loyalty system** — Loyalty score 0–100. Below 30: may disobey dangerous orders. Above 80: gains a personal ability unlock. Loyalty increases via: completing quests together, gifting items they prefer, allowing them to cultivate freely. Decreases via: forcing them into unwinnable fights, ignoring their personal quest, starving their cultivation.
- [ ] **Companion cultivation** — Disciples cultivate independently using resources you assign them. They grow slowly in the background. Assign a cultivation method to them. Their ceiling is lower than the player's.
- [ ] **Companion dismissal / departure** — Companions can leave if loyalty hits 0 or if their personal goal is incompatible with player's faction choices. Some return later as rivals. Some become independent named NPCs.
- [ ] **Spirit beast system** — Capture a beast core of a tamed beast + use beast-taming scroll + 3 days in a containment array. Beast becomes a pet. Stats based on beast grade. Can be leveled by feeding it appropriate items. Bonded spirit grants passive bonuses and an active ability in battle.
- [ ] **Team formation** — A team is player + up to 5 companions. Team members each occupy a tile slot together. All get proportional loot share. Battle becomes party combat (each companion takes turn in combat round). Party formation interface in the Faction panel.

---

## SECTION 9 — WORLD TIME SYSTEM (P2)

The world runs on a shared clock.

- [ ] **Universal calendar** — Implement `world_time` table: `epoch` (unix ms at game start), `rate` (1.0 = real-time for now, can be changed later). Current in-game time = `(current_unix - epoch) * rate`. Display format: Year X, Month X, Day X, Hour X (e.g., "Year 3, Harvest Month, Day 14, Hour of the Rooster").
- [ ] **Seasonal events** — 4 seasons × 3 months = 12 in-game months. Each season biases: which herbs grow, which beasts are active, which weather phenomena affect travel. Shown in the world map corner.
- [ ] **World time display** — Show the in-game date/time in the topbar next to the realm badge.
- [ ] **Time-gated content** — Some quests only appear on specific days. Some NPCs only appear at certain times. Spirit veins pulse at specific hours (bonus cultivation window). Heavenly phenomena (rare solar/lunar events) give a limited cultivation boost if witnessed from a matching terrain tile.
- [ ] **Tribulation timing** — Attempting a Heavenly Tribulation during an auspicious hour (as shown on the in-game calendar) adds a +5% success modifier. This rewards players who pay attention to world time.

---

## SECTION 10 — SECT BUILDING SYSTEM (P2 → P1 midgame)

Sect building is a midgame feature after Foundation Establishment minimum.

- [ ] **Sect founding** — Player must reach Foundation Establishment, have 10,000 silver, and receive a "Sect Founding Decree" (dropped from a Heavenly Tribulation treasure chest or bought from city). Sect occupies a selected tile on the world map.
- [ ] **Sect compound layout** — Compound occupies 3×3 tiles initially. Upgradeable structures: Training Grounds, Cultivation Hall, Alchemy Lab, Weapon Forge, Formation Arrays (defensive), Treasure Hall, Disciple Barracks, Spirit Vein Tap (if tile has one).
- [ ] **Sect resources** — Compound generates resources per world-time tick based on what structures are built and which tiles are controlled. Requires active management: assign disciples to tasks, manage upkeep costs.
- [ ] **Sect territory** — Sects can claim adjacent tiles (wilderness, spirit veins) by building marker formations on them. Contested tiles between two sects trigger diplomatic events or raids.
- [ ] **Sect raids** — Rival sects or bandit groups can raid the compound while player is offline. Defensive formations reduce damage. Disciples defend automatically. Player logs in to aftermath: damaged structures, stolen resources, event log of the battle. Can launch counter-raid.
- [ ] **Sect diplomacy** — Sects have standing with each other: Allied / Neutral / Hostile / War. Changing standing requires envoy missions (disciple or player travels to rival sect). Tribute payments, marriage alliances (NPCs), or battle outcomes affect standing.
- [ ] **Disciple assignments** — Assign disciples to: cultivation training, resource gathering, compound defense, mission tasks, external scouting. Each role generates passive output in the background resolved lazily on player login.
- [ ] **Sect prestige** — Sect prestige score determines: recruitment tier (which NPCs are willing to join), shop discounts in nearby cities, ability to host auction events.

---

## SECTION 11 — BATTLE SYSTEM V2 (P1)

Battle needs to feel weighty, not trivial.

- [ ] **Battle length** — Current battles are too short. Standard encounter: 8–15 rounds. Boss/named NPC: 20–30 rounds. Each round presents 4 choices: Attack / Technique / Defend / Item. Round timer: 30 seconds (can be disabled in settings for turn-based feel).
- [ ] **Technique clash system** — Each technique has an elemental type and a clash matrix. Fire vs. Water = 0.6x damage multiplier. Earth vs. Lightning = 1.4x. This creates strategic depth in technique selection.
- [ ] **Status effects in battle** — Bleeding (lose HP per round), Burning (Qi drain per round), Petrify (miss next action), Confused (50% chance to attack ally/self), Rooted (can't flee). Enemies apply these. Player applies them via techniques.
- [ ] **Battle flee penalty** — Fleeing from a battle with an NPC you've wronged costs reputation. Fleeing from a boss leaves a "cowardice" debuff (-10% all stats for 1 hour).
- [ ] **Battle loot overhaul** — Beast drops use a tier-based loot table with quality rolls. Named NPC drops always include their signature item. Boss drops include a guaranteed rare item + chance of technique scroll.
- [ ] **PvP system** — Players can challenge each other to duels in cities with an arena. Duels are asynchronous: challenger submits their action sequence, defender is notified and submits theirs, server resolves the full battle and sends result. No real-time required.
- [ ] **Multi-enemy encounters** — Parties of beasts/bandits. Each enemy acts independently. Player can target specific enemies. Companions each take a turn per round.
- [ ] **Battle state persistence** — Battle state stored server-side in `character_state.battle_json`. Any tab that loads the character state sees the current battle. BroadcastChannel used client-side to sync UI without double-resolving.
- [ ] **Technique combo system** — Using the same technique 3 rounds in a row triggers a "technique overdrive" variant with doubled effect but half the battle Qi cost. Builds towards skill mastery.
- [ ] **Formation arrays in battle** — Players with formation literacy can deploy a 1-use formation flag at start of battle: defensive array (reduce incoming damage), offensive array (add area damage), trapping array (root enemy for 3 rounds).

---

## SECTION 12 — SKILL TREES (P2)

Not a single tree. One tree per progression lane.

- [ ] **Body tree** — 4 branches: Physique (raw stats), Iron Skin (damage reduction), Qinggong (movement speed, hazard gating), Bloodline Refinement (longevity + special abilities).
- [ ] **Qi tree** — 4 branches: Capacity (Qi Max), Efficiency (reduce cost per technique use), Purity (quality rolls for breakthrough), Elemental Attunement (element-specific power).
- [ ] **Soul tree** — 4 branches: Spirit Sense (perception, see invisible things), Formation Literacy (use and break formations), Will Fortification (mental attacks resistance), Soul Projection (rare: spirit body can leave physical body briefly).
- [ ] **Martial tree** — 4 branches: Weapon Mastery (per weapon type), Battle Arts (active technique nodes), Counter-Flow (reaction/parry), Killing Intent (damage boost when HP < 30%).
- [ ] **Profession tree** — Separate trees per profession: Alchemy, Forging, Formation Laying, Talisman Writing, Beast Taming. Each has 3 tiers (Apprentice / Journeyman / Master).
- [ ] **Social tree** — Nodes: Trade Reputation, Sect Authority, Jianghu Fame, City Law Standing, Black Market Access.
- [ ] **Skill point system** — Skill points earned at each sub-stage breakthrough (not realm breakthrough). This gives players constant small progression choices throughout each realm.
- [ ] **Tree UI** — Show as an SVG or CSS-drawn branching tree. Nodes highlight when prereqs met. Locked nodes show unlock condition on hover.

---

## SECTION 13 — TRAINING EQUIPMENT (P2)

Equipment that makes training harder but more rewarding.

- [ ] **Training weight item class** — Add "Training Weights" equipment subcategory. Tiers: Copper (10 units), Iron (25 units), Star-Iron (50 units), Void-Metal (100 units). Equipped in a dedicated Training Slot (not combat slots).
- [ ] **Weighted armor** — New armor subtype: training robes with a weight stat. Mediocre defense stats. While worn: movement slowness debuff (increases travel time). Offset: +15–40% Body XP gain from all training.
- [ ] **Slowness formula** — `travel_time_mod = 1 + (equipped_training_weight / player_strength)`. Strength stat reduces slowness penalty.
- [ ] **Training equipment gate** — To use higher-tier training weights, must meet a strength threshold. Copper weights: no req. Iron: Physique ≥ 50. Star-Iron: Foundation realm body. Void-Metal: Core Formation body.
- [ ] **Training intensity selection** — When clicking Train Body, player can choose: Light / Normal / Intense. Intense = 2× XP but also 2× cooldown and depletes HP by 10%. Light = 0.7x XP, half cooldown, no HP cost. Supports different playstyles.

---

## SECTION 14 — BREAKTHROUGH ANIMATION & FEEDBACK (P1)

Breakthroughs should feel epic, not transactional.

- [ ] **Pre-breakthrough atmosphere** — When player declares breakthrough intent, background fades to near-black. Subtle ambient particles (element-colored) drift upward. A cinematic text panel plays: "You still your breath. The Qi in your meridians presses against every gate..."
- [ ] **Tribulation sequence** — For Core Formation+: a CSS-based visual sequence plays. Lightning bolt SVG animations strike from above. Screen flashes. Player sees their character described fighting through the tribulation in 3 vivid text beats.
- [ ] **Success reveal** — On success: the new realm name appears in large Cinzel text, centered, with a golden shimmer animation (CSS keyframe). Stats display briefly. The first sub-stage is locked in with its quality tier shown.
- [ ] **Failure reveal** — On failure: screen flickers red. "Your Qi deviates." Deviation type described. A short text beat about the consequences plays before control is returned.
- [ ] **Breakthrough sound cue** — When audio is added: a deep bell tone for success, a discordant scraping sound for deviation. Not yet implemented but plan the hook.
- [ ] **Mini-game variant (optional post-launch)** — A 5-second quicktime style sequence: a wave of Qi is animated, player clicks to "guide" it through meridian checkpoints. Success adds +5% quality roll. Fail = no penalty. Low stakes extra layer.

---

## SECTION 15 — QUEST SYSTEM REWORK (P1)

Quests should be found, not listed.

- [ ] **Emergent quest triggers** — Quests are seeded by: NPC state (their need exists in the simulation), world events (a beast den near a city creates a hunt quest), player exploration (finding a ruin activates a mystery chain), city NPC dialogue (rumors lead to quests).
- [ ] **Quest discovery system** — On talking to an NPC, server checks: does this NPC have any quest for this player based on their reputation, sect, realm, and items? If yes, NPC dialogue includes a hook. No separate quest log entry appears until the player accepts it.
- [ ] **Quest log** — Minimal: a list of accepted active quests with their most recent update text. No map markers. No upfront list of "starter goals." Players build their own reference. This is part of the guide culture.
- [ ] **Quest types**:
  - Delivery: bring item X to person Y in city Z
  - Hunt: eliminate N of beast type in region (tracked by exploration kills)
  - Escort: travel with an NPC from city A to B (combat encounter chance during transit)
  - Investigation: find and read 3 clues in a ruin zone, report back
  - Crafting commission: produce item X with quality ≥ Refined
  - Sect war: participate in a siege event
  - Personal: NPC-driven, tied to their backstory arc
- [ ] **Disciple quest helper** — Assigned disciples reduce quest difficulty. Some quests marked "Requires 2+ team members" fail automatically if attempted solo. Disciples can be sent solo on simple delivery quests without player going.
- [ ] **Quest expiry** — Quests with time pressure are labeled. Most others are open-ended. Expired quests: NPC resolved it themselves, relationship score affected.
- [ ] **Narrative arc** — A main story chain spans all regions. Teased through: an artifact found in the opening zone, a named NPC who speaks of an ancient sealed gate, a recurring antagonist faction. Not required to play the game. Players who engage discover lore layers others miss.

---

## SECTION 16 — STORY & NARRATIVE (P2)

A followable thread that rewards engaged players.

- [ ] **"The Sealed Heaven" main arc** — The world's highest cultivation path is literally sealed. Someone or something sealed the path to true immortality. Fragments of the key (Dao Crystals + specific knowledge) are scattered across all regions. Collecting them is not obvious — it requires piecing together NPC lore, hidden zone discoveries, and rare item descriptions.
- [ ] **Region lore** — Each region has a written history, 3 historical named NPCs (dead), and 2 living lore-givers (NPCs who provide info if you have enough trust). Lore is stored in a "World Notes" section of the Me panel. Added when player reads a lore item or has a revealing NPC conversation.
- [ ] **Antagonist faction: The Sealing Covenant** — A secretive organization that maintains the seal. They have sleeper agents in major sects. As player grows powerful, Covenant agents start appearing as recurring named NPC rivals. They are aware of the player's progress toward the sealed path.
- [ ] **Seasonal story events** — World time seasonal shifts can trigger story beats: a famous NPC completes their tribulation and a city festival erupts, or a sealed zone suddenly opens for 72 real-hours.
- [ ] **Player's personal narrative log** — A "Cultivation Chronicle" in the Me panel that auto-populates with key events: first breakthrough, first duel, first city visited, first death. Reads like a personal in-world diary. User cannot edit it, but can name-tag entries.

---

## SECTION 17 — GACHA SYSTEM (P3, NON-P2W)

Cosmetic and world-enrichment gacha only.

- [ ] **"Fate Weaving" gacha** — Spend Jade Seals (premium cosmetic currency) to pull on themed banners. Banners contain: portrait frames, character title overlays, technique visual effect skins, sect banner designs, special greeting dialogue variants. NO stat items ever.
- [ ] **Summoning gacha (non-P2W)** — "Celestial Gathering" banner: pull legendary NPC templates into your server's world. Example: "72 Divine Peaches to summon Sun Wukong as an NPC in the Jade Delta region for 72 real-hours." These NPCs carry unique quests and drop unique cosmetic items. They are world events accessible to anyone — not personal power.
- [ ] **Jade Seal earning** — Jade Seals earned via: weekly achievement completions, rare world event participation, trading premium items at the auction house. Can also be purchased. Never provides combat advantage.
- [ ] **Pity system** — After 90 pulls without a legendary cosmetic, next pull guaranteed legendary.
- [ ] **Auction house** — Player-to-player trading. Spirit Stones as currency. List items with a buyout price or auction format. Rare technique scrolls have very high market value here (tying back to scroll rarity fix).

---

## SECTION 18 — AUDIO (P3)

Sound to enhance atmosphere, not distract.

- [ ] **Ambient layer** — Per-region ambient loops: crackling ash wastes, bamboo wind, iron forge sounds, void hum. Play as a low-volume background loop. Mutable via settings.
- [ ] **Action sound cues** — Meditation: gentle bowl ring at start. Body training: wooden thud. Breakthrough success: deep bell. Breakthrough failure: dissonant scrape. Battle hit: sword clash. All CSS/Web Audio API triggers, no third-party libraries.
- [ ] **Notification ping** — A soft chime when action completes in background.
- [ ] **Settings toggle** — Master volume + SFX / Ambient split. Saved in localStorage. Default off for first load (respect user preferences).

---

## SECTION 19 — ADMIN & DEVTOOLS (P2)

You need tools to balance the live game.

- [ ] **Admin panel enhancement** — Feature Tracker already exists. Add:
  - Kill switch per feature flag (disable a buggy feature without deploy)
  - Player lookup: view full character state as JSON, force-advance/rollback realm, grant/remove items
  - World event manual trigger from admin panel
  - NPC state browser: see every named NPC's realm, location, last tick
  - Economy monitoring: average silver/spirit stone holdings per realm tier
- [ ] **Balance dashboard** — Plot: average turns to breakthrough per realm across all accounts. Identify where players are grinding longest vs. giving up.
- [ ] **Server-side shadow mitigation** — Robotic timing detection (already designed in INSTRUCTIONS.md). Add admin view to see current shadow-flagged accounts + reason timestamps.

---

## SECTION 20 — INFRASTRUCTURE / TECHNICAL DEBT (P1)

- [ ] **BroadcastChannel for cross-tab state** — Whenever character state is updated (server response), broadcast the state update to all tabs via `BroadcastChannel('sealed_heavens_state')`. All tabs listen and update their local state mirror. This fixes battle sync and all other cross-tab issues.
- [ ] **Remove client-side localStorage game state** — Migrate fully to server-side state. The `createInitialState()` local prototype state in `main.js` is legacy. All state reads must go through the `/api/game-state` endpoint. LocalStorage is only used for: session cookie presence check, cached NPC dialogue history (non-authoritative), settings preferences.
- [ ] **Action nonce system** — High-value actions (breakthrough, technique switch, large bank transactions) require a server-issued nonce fetched before the action. Nonce burned in D1 on use. Prevents replay attacks.
- [ ] **Optimistic UI pattern** — All action buttons should: (1) immediately show a loading/in-progress state, (2) send the API request, (3) update UI on response, (4) show error and revert if request fails. No 30-second waiting with no feedback.
- [ ] **Rate limiting** — KV-based rate limiting already designed. Implement: 30 actions/minute per character. Burst limit: 5 actions in 5 seconds triggers a 30-second lock.
- [ ] **Error handling UI** — Network errors should display as a non-blocking toast at the bottom. Action failures should explain why (cooldown, missing item, locked by active action) clearly in English, not raw JSON.
- [ ] **Mobile PWA manifest** — Add manifest.json and service worker for offline shell caching. Character state never offline, but the HTML/CSS/JS shell should load instantly from cache.
- [ ] **CSS code split** — Split styles.css into: base.css, layout.css, panels.css, modals.css, animations.css. Load via `<link>` in order. Reduces debugging confusion.
- [ ] **Map data migration** — Move map data from `data.js` (client-visible, hackable) to D1 exclusively. Client requests map data from `/api/world/map` with realm-gated filtering.
- [ ] **Auto-save removal** — Remove all localStorage save/load logic. Every action auto-saves via the server. No "Save" button ever again.
- [ ] **Session expiry UX** — When session expires mid-play, show a gentle overlay: "Your session has ended. Sign back in to continue." Don't lose what the player was reading.

---

## SECTION 21 — ONLINE PRESENCE / SOCIAL FEATURES (P3)

- [ ] **Online cultivators panel** — In the World panel: show how many players are currently active by region (not by nation like idleqi.com). Shows the world feels populated. Click a region to see count. No exact player locations visible.
- [ ] **Cultivation rankings** — Leaderboards: Top 100 by realm/stage (with character names). Accessible from Me panel. Updates every 30 minutes.
- [ ] **Titles and notoriety** — Character earns visible titles based on deeds: "Demon Slayer," "Jade Blood Cultivator," "Sect Founder," "Unbroken Will." Shown next to name in city interactions and rankings.
- [ ] **Tribute system** — Players can send a small silver gift or a spirit herb bundle to another character. The game narrates it as a formal scroll. No combat items can be gifted.
- [ ] **Guild/sect alliance board** — Sects can post alliance announcements visible to all players in their region.

---

## SECTION 22 — ITEM ART (P4, FUTURE)

- [ ] **Item icon art** — Once systems are complete, commission or generate pixel art icons for all item templates (≈80 items). Each icon: 32×32px, fits cultivation aesthetic.
- [ ] **Character portrait slots** — Character creation includes a placeholder avatar slot. Once art exists, portraits tie to origin + spiritual root + chosen mortal life.
- [ ] **Zone/city illustration headers** — Each zone and city gets a small header illustration (256×128px or CSS-generated art composition). Future.
- [ ] **Technique scroll visual** — Technique scrolls show a scroll visual with a glowing seal of their element.

---

## SECTION 23 — CLEANUP (P0 / P1)

- [ ] **Delete or archive `RESEARCH_CULTIVATION_SYSTEMS.md`** — Information has been distilled into VISION_V2.md and this TODO. Keep it locally for reference but remove from git before launch. (Optional: move to a `/docs/archive/` folder.)
- [ ] **Clean up `app.js`** — Determine if this is an old prototype entry point. If so, remove it. It is not linked from index.html as far as can be seen.
- [ ] **Audit root-level `wrangler.toml`** — The actual config lives in `workers/wrangler.toml`. Check if root-level one is a duplicate/stale. Remove if redundant.
- [ ] **Remove AFK_CAPS_MS from game.js** — AFK queue system is being removed per Section 1.
- [ ] **Remove `handleAfk` route from index.js** — Deprecate the AFK endpoint entirely.
- [ ] **Remove `afk_queue` table from schema.sql** — Or mark as deprecated and leave for migration purposes.
- [ ] **Feature tracker seed data in schema.sql** — Update seeded features to reflect actual current status. Remove stale entries.
- [ ] **Technique scroll rarity fix** — Remove `patron-watch-ad` scroll reward. Remove all non-combat pathways to get technique scrolls cheaply. They should only drop from high-danger zone nodes (rare %) or player-traded auction.

---

## SECTION 24 — ACCOUNT MANAGEMENT (P2)

- [x] **Account panel in game UI** — Added Account nav item and panel showing session info, username, email, rank, session start/expiry, and logout button. Staff badge shown for admin_level ≥ 1.
- [x] **Admin elevation: fwehhhh123** — Account set to `admin_level = 3` (Sovereign/superadmin) via D1 remote command.
- [x] **`/api/account` GET endpoint** — Returns full account info including adminLevel, session timestamps, email, username.

---

## PRIORITY QUEUE — WHAT TO BUILD NEXT

1. Section 0: All P0 bug fixes (especially cross-tab battle + mutual exclusion)
2. Section 1: Remove AFK tab, Save button, City Affairs button
3. Section 2: Full visual/navigation rework (kill IdleQI look, implement new nav)
4. Section 20: BroadcastChannel + optimistic UI + full server-state migration
5. Section 6: Intro sequence rework (character creation is the first impression)
6. Section 5: Cultivation math rebalancing (Qi costs, stage quality, deviation)
7. Section 4: Tile-based explorable map (core differentiator)
8. Section 3: City as navigable space
9. Section 11: Battle system V2
10. Section 12: Skill trees
11. Section 14: Breakthrough animation
12. Section 7: NPC simulation
13. Sections 8, 9, 10, 13, 15, 16: Companions, world time, sects, training equipment, quests, story
14. Sections 17, 18, 19, 21: Gacha, audio, admin tools, social
15. Section 22: Art (last, when systems are solid)
