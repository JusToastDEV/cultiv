# Sealed Heavens — Vision V2 Design Document
**Date:** May 2026  
**Status:** Ideation / Pre-Production

> This doc captures the full re-design intent for Sealed Heavens.  
> Every section should be treated as a living spec — cross out ideas that get cut, annotate ones that get built.

---

## TABLE OF CONTENTS
1. [The Big Pivot — What We're Building](#1-the-big-pivot)
2. [Technical Stack & Infrastructure](#2-technical-stack--infrastructure)
3. [Account System & Characters](#3-account-system--characters)
4. [Class System & Origins](#4-class-system--origins)
5. [Multiversal Crossover System](#5-multiversal-crossover-system)
6. [Cultivation Progression — The Ladder Redesign](#6-cultivation-progression--the-ladder-redesign)
7. [Combat System Overhaul](#7-combat-system-overhaul)
8. [World, Story & Exploration](#8-world-story--exploration)
9. [NPC Living World System](#9-npc-living-world-system)
10. [Companion System](#10-companion-system)
11. [World Events](#11-world-events)
12. [UI/UX Rework — Mobile-First](#12-uiux-rework--mobile-first)
13. [Drop System Overhaul](#13-drop-system-overhaul)
14. [Quest Tree & Narrative System](#14-quest-tree--narrative-system)
15. [Admin Dashboard & Dev Tracker](#15-admin-dashboard--dev-tracker)
16. [Monetization & Live Service Design](#16-monetization--live-service-design)
17. [Art Direction & Visual References](#17-art-direction--visual-references)
18. [Android App Path](#18-android-app-path)
19. [Reference Analysis — What To Steal (Mechanically)](#19-reference-analysis)
20. [Migration Plan — V1 to V2](#20-migration-plan)
21. [Infrastructure Checklist](#21-infrastructure-checklist)

---

## 1. The Big Pivot

### What V1 Was
A single-player browser sandbox with localStorage saves, no accounts, one character, no backend.  
Good for a prototype — bad for live service.

### What V2 Is
A **live-service cultivation MMO browser game** inspired by:
- **Torn City** — persistent world, time-gated actions, real economy, PvP/PvE duality
- **Overmortal** — mobile cultivation progression depth, sect wars, companion bonds
- **Veyra: Gates of Eclipse** — AI-driven NPC factions, autonomous world state, world events
- **Infinite Immortal Path** — incremental cultivation depth, idle mechanics
- **Top Tier Providence: Secretly Cultivate for a Thousand Years** — time-lapse world state changes, watching subordinates and enemies grow while you cultivate in secret, golden finger awakening events, multi-generational consequences

### Core Design Pillars for V2
1. **The world continues without you.** NPCs advance, wars start, sects fall. Log off for a week and things are different.
2. **Identity over stats.** Your cultivation path, your companions, your history — not just your number.
3. **Secrets and discovery.** Hidden inheritance sites, sealed manuals, masked cultivation levels, secret identities.
4. **Time as currency.** Every action has a real-time cost. No one can brute-force their way to the top without managing their days well.
5. **Meaningful consequences.** No permadeath, but defeat costs time — hospital time, qi deviation recovery, lost items, reputation damage.

---

## 2. Technical Stack & Infrastructure

### Deployment Architecture
```
GitHub repo (source of truth)
  ↓ push to main
Cloudflare Pages (static frontend — HTML/CSS/JS)
  + Cloudflare Workers (API layer)
  + Cloudflare D1 (SQLite database — accounts, characters, world state)
  + Cloudflare KV (session tokens, ephemeral state, cooldown timestamps)
  + Cloudflare R2 (optional — media assets if needed)
```

### Why This Stack
- **Cloudflare Pages** already hosts the V1 static files — no change needed for deployment pipeline
- **Cloudflare Workers** handle auth, character data, world tick logic — serverless, zero cold start
- **D1** is Cloudflare's SQLite-at-edge database — perfect for a game this size, free tier is generous
- **KV** for fast reads on cooldowns, session validation, NPC world-tick deltas
- **Zero infrastructure cost at prototype/early scale**

### What To Set Up First (Infrastructure Checklist → see section 17)
- [ ] Cloudflare account with Pages + Workers enabled
- [ ] D1 database created, schema migrated
- [ ] KV namespace for sessions
- [ ] GitHub secrets for `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
- [ ] `wrangler.toml` configured (see AdDev folder — you already have `chudhosting.js` and `wrangler.toml` there, use that as a template)
- [ ] Auth worker deployed at `/api/auth/*`
- [ ] Game data worker at `/api/game/*`

### Database Schema (D1 — Initial)
```sql
-- Accounts
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,        -- uuid
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,         -- bcrypt or argon2 via Workers crypto
  created_at INTEGER,
  last_login INTEGER,
  is_banned INTEGER DEFAULT 0,
  admin_level INTEGER DEFAULT 0  -- 0=player, 1=mod, 2=admin, 3=superadmin
);

-- Characters (up to 3 per account)
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
  slot INTEGER CHECK(slot IN (1,2,3)),
  name TEXT,
  realm_index INTEGER DEFAULT 0,
  stage_index INTEGER DEFAULT 0,
  created_at INTEGER,
  last_active INTEGER,
  is_deleted INTEGER DEFAULT 0,
  UNIQUE(account_id, slot)
);

-- Character state (serialized JSON blobs per character — evolves with game)
CREATE TABLE character_state (
  character_id TEXT PRIMARY KEY REFERENCES characters(id),
  state_json TEXT,           -- full serialized game state
  updated_at INTEGER
);

-- World state (global, single row or keyed by world segment)
CREATE TABLE world_state (
  key TEXT PRIMARY KEY,
  value_json TEXT,
  updated_at INTEGER
);

-- NPC state (one row per tracked NPC)
CREATE TABLE npc_state (
  npc_id TEXT PRIMARY KEY,
  template_id TEXT,
  current_data_json TEXT,
  last_tick INTEGER
);

-- World events (active and historical)
CREATE TABLE world_events (
  id TEXT PRIMARY KEY,
  type TEXT,
  title TEXT,
  description TEXT,
  started_at INTEGER,
  ends_at INTEGER,
  resolved INTEGER DEFAULT 0,
  data_json TEXT
);

-- Audit log (for admin use)
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT,
  character_id TEXT,
  action TEXT,
  data_json TEXT,
  created_at INTEGER
);
```

### Auth System
- **No OAuth for now** — email/password with bcrypt in Workers
- JWTs stored in httpOnly cookies (not localStorage — prevents XSS account theft)
- Sessions expire after 30 days of inactivity
- Account lock after 10 failed login attempts in 15 minutes (rate-limited by KV)
- Password reset via email (Cloudflare Email Workers or Mailchannels free tier)

---

## 3. Account System & Characters

### Account Rules
- One account per email
- Username is public-facing, email is private
- Accounts have an admin trust level (0–3)
- Banned accounts see a "Your account is suspended" screen with optional reason

### Character System
- **Up to 3 characters per account**
- Each character occupies a named slot: Character 1, 2, 3
- Deleted characters go to a 72-hour grace period (soft delete) before permanent removal
- No cross-character transfers (prevents exploitation between alts)
- Each character has its own full game state JSON
- Character selection screen shows realm, days cultivated, and last active time

### No Save Scumming
- All state is server-side — there is no download/upload save
- The client sends actions to the Worker, the Worker validates and applies them
- No action replay / rollback available to the player
- Admins can manually roll back a character state within 24h window (audit logged)

### Penalty System (No Permadeath)
| Situation | Penalty |
|---|---|
| Defeated in PvE | Qi deviation — recovery time 2–6 real hours, temporary stat reduction |
| Defeated in PvP | Hospital time 1–12 real hours + item/silver loss (capped) |
| Qi deviation during breakthrough | Cultivation regression 1 stage + cooldown on next attempt |
| Severe qi deviation | Hospital time + longevity cost |
| Death by world event | Narrative "near death" — injuries that take 24h to clear |
| Banned sect/guild status | Lost standing, city access restricted until rehabilitated |

### Time-Gating (Torn City Style)
- Every major action has a real-time cooldown (meditate 15min, explore 10min, craft 20min, etc.)
- Cultivators have an **Energy** meter that refills over time — gates how many actions per day
- Premium perks (non-p2w: earnable in-game) can reduce waits slightly but never skip them

---

## 4. Class System & Origins

### Why Classes?
Pure cultivation realm-climbing is deep but can feel samey between characters. A class system gives each character a distinct **identity and flavor** without breaking the cultivation fantasy — the class shapes *how* you cultivate, not *whether* you can.

### The Two-Layer System
```
Layer 1: ORIGIN          — where you come from (world/background)
Layer 2: PATH            — how you fight and grow (combat/utility identity)

Origin sets your starting bonuses and world access.
Path sets your technique tree and companion synergies.
```

### Origin Worlds
Each character selects an origin at creation. Origins shape starting stats, faction reputation, and backstory options.

| Origin | World | Bonus | Starting Faction | Flavor |
|---|---|---|---|---|
| Ashen Cultivator | Ashen World | +Body stats, cheaper ores | Iron Sect / Ember Court | Hard-scrabble, body-first survivor |
| Verdant Herbalist | Verdant World | +Alchemy yield, herb find rate | Jade Archive / Lotus Sect | Scholar-healer archetype |
| Void Walker | Mirror World | +Soul stats, array comprehension | Void Lantern faction | Reclusive, dangerous, multi-planar awareness |
| Heaven Exile | Upper Heaven | +Qi max, faster breakthrough windows | None — hunted | Fallen noble or disgraced disciple, secret power |
| Ancient Remnant | Ancient Heaven | +Longevity, Dao comprehension | Sovereign factions | Reincarnated or fragment-born, hidden memory events |
| Outlander | Unknown | Balanced, no faction affinity | None | Wildcard — unique golden finger event at Mortal stage |

### Cultivation Paths (Classes)
Paths are not locked to Origin — any Origin can walk any Path — but some combinations have **synergy bonuses** noted in character creation.

| Path | Core Style | Signature Mechanic | Synergy Origins |
|---|---|---|---|
| **Sword Sovereign** | Pure combat, sharp qi | Sword intent buildup — stacks bonus damage across rounds | Ashen, Heaven Exile |
| **Body Refiner** | Physical absolute | Iron Body gauge — reduces all damage when filled | Ashen, Ancient Remnant |
| **Dao Alchemist** | Crafting + utility | Pill furnace slot — craft mid-battle consumables | Verdant, Ancient Remnant |
| **Formation Sage** | Trap and array combat | Pre-combat trap placement — triggers bonus effects | Void Walker, Verdant |
| **Spirit Sovereign** | Spirit beast bonding focus | Bond depth mechanics — deeper spirit integration unlocks ultimate assists | Any + Spirit vessel required |
| **Soul Weaver** | Soul and mental cultivation | Soul echo — mirrors enemy technique back once per fight | Void Walker, Heaven Exile |
| **Blood Cultivator** | Risk/reward combat | Blood burn — sacrifice HP to dramatically boost technique damage | Ashen, Outlander |
| **Spatial Wanderer** | Movement and evasion | Void step — can dodge one enemy technique per combat | Void Walker, Outlander |
| **Poison Dao** | Attrition and debuffs | Stacking poisons that compound per round | Verdant, Ancient Remnant |
| **Heavenly Scribe** | Lore and inheritance focus | Manual comprehension — extracts techniques from relic fragments faster | Any |

### Path Progression Tree
Each Path has three internal tiers unlocked by realm gates:
- **Tier 1** (Mortal–Foundation): Core identity skills, 3 techniques
- **Tier 2** (Core Formation–Soul Formation): Advanced mechanics, 5 techniques, path-specific companion synergy
- **Tier 3** (Void Refinement+): Ultimate expressions — named legendary technique, multiverse path variant

### Class + Origin Combinations (Notable Synergies)
| Origin + Path | Synergy Bonus |
|---|---|
| Void Walker + Formation Sage | Arrays charge 40% faster, can place 2 traps instead of 1 |
| Verdant + Dao Alchemist | All pills have +1 extra use per craft session |
| Ashen + Blood Cultivator | Blood burn costs 30% less HP |
| Heaven Exile + Sword Sovereign | Sword intent stacks carry over between combats |
| Ancient Remnant + Soul Weaver | Soul echo activates on 2 techniques per combat |
| Outlander + Any | Unique hidden fourth-tier technique discovered through world events only |

---

## 5. Multiversal Crossover System

### The Core Concept
The game world is not one world — it is a **convergence of multiple planes** that bleed into each other. This is the macro-narrative driver that makes the game feel richer than a single-world cultivation sandbox.

The existing world structure already has this built in:
- **Ashen World** (material, body-cultivation focused)
- **Verdant World** (spirit-herb, alchemy focused)  
- **Mirror World** (soul, void, array focused)
- **Upper Heaven** (elite cultivation, suppression fields)
- **Ancient Heaven** (pre-collapse, relic and dao fragment filled)

### Planar Bleed Events
Random or story-triggered events where **the boundary between planes weakens**:
- Creatures from the Mirror World appear in Ashen World territory (wrong ecology)
- Ancient Heaven relics phase into existence in Void Rift areas (temporal bleed)
- Cultivation methods from one world stop working correctly in an adjacent world (plane law suppression)
- Players from different Origin worlds can experience the same zone completely differently

### The Endless Void — Crossover Plane
A neutral "between planes" space accessible via a specific quest chain and requiring Nascent Soul+:
- **Void Market** — the only place to trade items that normally can't exist in one plane
- **Planar Echo Bosses** — reflections of bosses from other planes, with different technique sets
- **Convergence Dungeons** — multi-floor instances that shift between plane aesthetics each floor
- **Crossover NPCs** — characters native to the Void, connected to no single world's politics

### Multiversal Techniques
Some techniques are **plane-locked** — they only work at full power in their native world:
- A fire technique from the Ashen World is weakened in the Void Rift (wrong plane law)
- Formation arrays from the Mirror World overperform in Mirror World zones
- Mastering a technique in its native world and then adapting it to another world creates a **Transcendent Variant** — more powerful than either original

### Future Planes (Expansion Hooks)
Leave these undefined for now but name them as future content targets:
- **Demon Realm** — counterpart civilization, different cultivation base (demonic qi, not spiritual qi)
- **Mortal Realm Prime** — a plane where cultivation is forbidden or unknown — stealth/influence gameplay
- **Shattered Void** — post-apocalyptic fragments of a destroyed plane — highest-tier content
- **Heaven's Archive** — a library plane — contains records of every technique ever created; read only, extraction requires a quest

### Seamless Integration
The key is making the multiverse feel **organic, not jarring**:
- NPCs comment on plane origin of items and enemies without walls of exposition
- Players notice it through gameplay (technique efficiency changes, unfamiliar enemy types)
- The atlas map gains a **Planar Layer toggle** — switches between viewing one plane at a time
- "Convergence zones" on the map are visually distinct (color bleed, fractured terrain icons)

---

## 6. Cultivation Progression — The Ladder Redesign

### Design Problem with V1
The current realm ladder (10 realms × 3 stages) is structurally fine but mechanically thin — stage advancement is just a number gate. V2 needs each stage to feel **meaningfully different** to play.

### Redesigned Realm Ladder
Each realm now has a distinct **mechanical unlock** beyond just stat increases:

| Realm | Stages | New Mechanic Unlocked | Lifespan |
|---|---|---|---|
| **Mortal** | Bone Tempering → Marrow Cleansing → Blood Refinement | Origin discovery, basic qi sense | 80y |
| **Qi Condensation** | Qi Awakening → Qi Refinement → Qi Perfection | First technique slot, energy system access | 120y |
| **Foundation** | Earthen Root → Iron Pillar → Heaven Jade | Second technique slot, city law access, first companion slot | 220y |
| **Core Formation** | Cracked Core → Solid Core → Flawless Core | Core resonance (passive qi regen boost), first spirit vessel slot | 420y |
| **Nascent Soul** | Soul Seed → Soul Bloom → Soul Sovereign | Nascent soul projection (scouting, distant action), planar awareness | 850y |
| **Soul Formation** | First Heaven → Second Heaven → Third Heaven | Soul domain (area effect in combat), second companion slot | 1600y |
| **Void Refinement** | Void Skin → Void Vessel → Void Mandate | Void step (one use per combat), Endless Void access | 2800y |
| **Saint Ascension** | Saint Spark → Saint Body → Saint Crown | Saint suppression field (can suppress enemies below Core Formation), third companion slot | 4600y |
| **Immortal Lord** | Immortal Ember → Immortal Throne → Immortal Zenith | Immortal decree (one unbreakable command to a non-Immortal NPC per week) | 7600y |
| **Dao Sovereign** | Dao Seed → Dao Dominion → Dao Heaven | Dao imprint (permanent mark on world state — alter a single aspect of a region's law) | 12000y |

### Breakthrough System (V2)
Breakthroughs are **events**, not instant clicks:
1. Player hits XP cap for current stage
2. A **"Stabilize Tribulation"** window opens — player has 24 real hours to prepare
3. Preparation options: gather pills, recruit a companion to stand watch, set up a formation array, find a breakthrough cave
4. Breakthrough attempt: a mini-event chain (not full combat, more like a timed decision tree)
5. Success: advance, gain mechanical unlock
6. Failure: qi deviation — severity scaled to how underprepared the player was
7. **Tribulation Lightning** for Core Formation+: a combat encounter against a Heaven Tribulation entity (scales to realm)

### Cultivation Speed Drivers (No P2W)
All of these are earnable in-game, not purchasable:
- Cultivation methods (higher grade = faster XP)
- Pills and elixirs (temporary boost windows)
- Companion dual cultivation sessions (joint XP bonus)
- Formation arrays in your stronghold (passive XP while offline)
- Meditation cave rent in cities (time-limited boost)
- Area bonuses in focus-matched exploration

### The "Golden Finger" System
At character creation (before first city), each character receives one hidden unique trait:
- Not shown in the UI initially — discovered through play
- Examples: "Spirit Root Variance — your qi has a 5% chance to mutate into a stronger color per breakthrough", "Heaven Defying Constitution — tribulation lightning is weaker against you", "Void Affinity Awakening — formation arrays you place cost 30% less qi"
- Can be partially revealed by visiting specific NPCs (divination, elder assessment)
- Fully revealed by completing Arc 1

---

## 7. Combat System Overhaul

### Design Goal
Make combat feel like a **tactical turn-exchange**, not a click-fest number race.  
Inspired by: Overmortal's skill timing, Torn City's turn-based flow, Xianxia fiction's "qi technique clash" feel.

### Combat Flow — V2
1. Player initiates combat (explore, dungeon, PvP challenge)
2. **Initiative roll** — factors in Speed stat, Soul Sense, technique bonuses
3. Each **round** is a decision point: Attack / Defend / Technique / Flee / Spirit Assist
4. After player action: **enemy responds** (immediate — no waiting)
5. Round result shown as a **combat log panel** with animated damage numbers
6. Victory/defeat/flee resolves to loot or penalty screen

### Technique Clash System
- Some techniques have **counters** and **weaknesses** (fire beats wind, void beats saint, etc.)
- Using the right counter technique grants a **bonus effect** (extra damage, qi drain, status proc)
- Players learn which enemies use which techniques over time (lore book fills in)

### Status Effects (V2 — Expanded)
| Status | Effect | Source |
|---|---|---|
| Qi Sealed | Cannot use qi techniques for N rounds | Void techniques |
| Burning | 5% HP per round | Fire methods |
| Frozen | Skip action once | Ice/water techniques |
| Bleeding | HP drain, resist healing | Body-type attacks |
| Deviated | All technique costs +50% | Failed breakthroughs, some poisons |
| Suppressed | Realm treated as 1 lower for damage | Higher-realm enemies |
| Marked | Enemies focus this target (PvP relevant) | Sect/guild rivals |
| Blessed | +20% all stats for 3 rounds | Spirit bonded assist |
| Berserk | +40% ATK, -30% DEF, cannot defend | Beast rage, some body methods |

### Snappy Combat Rules
- **No animation delays between round resolution** — instant result, log scrolls
- Player can hit "Auto" for a single-round of best-guess auto action (great for mobile)
- Retreat is always available but costs qi and possibly gives enemy a parting shot
- **No long wait states** — if player doesn't act in 30 seconds, auto-action fires

### Spirit Assist in Combat (V2 Rework)
- Spirit assist is no longer just passive — player can **trigger assist** once per combat as an active slot
- Active trigger has a cooldown between combats (10 minutes real time)
- Passive assist proc still fires automatically with RNG

### PvP System
- Opt-in PvP via **Challenge** or regional **Arena**
- Challenge: send a duel request, target has 24h to accept or decline
- Arena: bracket or open, daily entry tickets (earnable)
- PvP result: winner gets prestige points + possible item loot (capped to 1 item, never cultivation manuals)
- Loser: hospital time, minor silver loss — never catastrophic
- **Realm-gated brackets** to prevent bullying

### Boss Encounters
- Named bosses in Exploration Areas with a **weekly respawn**
- First kill of the week grants rare loot
- Subsequent kills: standard materials + small exp
- Boss HP scales to the challenger's realm + a danger multiplier
- Bosses have **phases** — at 50% HP they shift technique set

---

## 5. World, Story & Exploration

### Narrative Framework — "Secretly Cultivate" Inspiration
Inspired by *Top Tier Providence: Secretly Cultivate for a Thousand Years*:
- The world is **generational** — not just a level map but a living timeline
- Your character cultivates through eras; when you log in after days offline the world has moved
- Hidden cultivation caves, sealed inheritances, and disguise mechanics reward low-profile play
- "Golden Finger" event: each character gets a unique affinity bonus discovered early on (hidden from others)

### Main Story Arc (Phased)
**Arc 0 — Awakening** (Tutorial): Fresh cultivator awakens, determines their cultivation root, picks a starting region, first contact with a faction or wanderer guide NPC.

**Arc 1 — The Mortal Struggles** (Realm: Mortal → Foundation): Faction conflict in Ashen Frontier, introduction to sect politics, first inheritance discovery, first companion encounter.

**Arc 2 — The Great Fracture** (Realm: Foundation → Nascent Soul): A world event cracks the border between the Mirror World and Ashen World. Refugees, new factions, sect wars begin. Players can side with different powers.

**Arc 3 — The Sealed Heaven Crisis** (Realm: Nascent Soul → Saint Ascension): The Sealed Heaven suppression activates — a realm-wide suppression field prevents advancement past a certain point. The mystery of WHO sealed the heavens is the main plot. Player has to uncover fragments of the sealing array across all regions.

**Arc 4 — Breaking the Seal** (Realm: Void Refinement+): Investigation, alliances with rival factions, combat against the Dao Sovereign faction that benefits from the seal. Final arc — unsealing the heavens either opens a new realm tier or triggers a world transformation event for all players.

### Exploration Overhaul
Each Exploration Area needs:
- **Entry requirements** — realm minimum, item key, faction standing, or quest trigger
- **Area events** — not just combat, but discovery, dialogue, hazard, trap, secret passage
- **Depth layers** — surface (safe, low reward), middle (moderate danger, good reward), deep (high danger, rare loot, named enemy)
- **Lore pages** — each area has 3–5 discoverable lore tablets that fill in the world history

### New Exploration Modes
| Mode | Description | Risk |
|---|---|---|
| Scout | Fast pass — only surface layer events, low reward, very fast | Low |
| Explore | Standard — full event range, balanced reward | Medium |
| Delve | Deep dive — chance of depth events, boss encounters, rare drops | High |
| Secret Passage | Unlocked by lore — skips to hidden rooms with unique items | High, locked |

### New Area Types To Add
- **Sealed Tombs** — inheritance dungeons, limited daily entry, story-tied
- **Ancient Battlefields** — ghost-echo events where past battles replay
- **Void Fractures** — random access, very dangerous, best loot in the game
- **Hidden Valley** — secret areas you can only find with Fortune > threshold
- **Spirit Nexus** — spirit cultivation areas tied to companion bonding
- **Sect Ruins** — collapsed factions' bases with legacy techniques and karma traps

---

## 6. NPC Living World System

### Core Concept — "Veyra: Gates of Eclipse" Inspiration
Every significant NPC is not static. They have:
- A **cultivation rank** that advances over real time
- A **relationship web** — friends, rivals, lovers, enemies
- **Ambitions** that drive behavior (wants to be sect master, wants revenge, wants immortality)
- **Memory of the player** — what the player has done to/for them affects dialogue and quests

### NPC Categories
| Category | Ticks | Player Interaction |
|---|---|---|
| World Figure | Tick every 12h real time | Quest givers, world event drivers |
| City Elder | Tick every 6h | Standing checks, shop access, city laws |
| Sect Master / Guild Head | Tick every 8h | Faction missions, war declarations |
| Companion (Recruited) | Tick every action player takes | Full relationship system |
| Rival NPC | Tick every 4h | Grows to challenge player |
| Background NPC | Static unless story triggers them | Flavor, quest breadcrumbs |

### NPC Tick Logic (Cloudflare Worker cron)
```
Every 6 hours: run npc_world_tick()
  - Advance NPC cultivation by small increment
  - Check ambition milestones
  - Evaluate relationship changes (did player interact? ignore them? help them?)
  - Check if NPC triggers a world event
  - Update npc_state in D1
```

### Rival NPC System
- Each player has 1–3 assigned rival NPCs that grow alongside them
- Rivals are procedurally generated at character creation with opposing cultivation affinities
- If you ignore a rival they will eventually surpass you and become a regional power
- Rivals can appear in city events, world events, ambush encounters, and faction politics
- Defeating a rival in combat gives a permanent karma bonus and unlocks their technique lore

### Named Merchants (City NPCs That Grow)
- Each city has 2–4 named recurring merchants
- Their stock improves as their cultivation rank grows
- They remember if you helped them in quests — better prices, unique stock
- Some merchants are secretly cultivators — good long-term relationship unlocks hidden items

---

## 7. Companion System

### Design Inspiration
Overmortal companion bonds + *Secretly Cultivate* subordinate system.

### How Companions Work
- Companions are found through quests, world events, dungeons, or specific region encounters
- Maximum **4 active companions** per character (more can be in a "Reserve" list)
- Each companion has their own cultivation rank, techniques, personality type, and relationship score

### Companion Stats
```
Relationship: 0–100 (affects how often they assist, what they share)
Loyalty: 0–100 (low loyalty = may betray, spy, or leave)
Cultivation Rank: grows independently but faster if you feed them materials
Specialty: Combat / Alchemy / Intelligence / Spirit / Body
Affinity: Fire / Water / Wind / Earth / Void / Saint / Dao
Morale: High/Normal/Low — affects in-combat performance
```

### Companion Actions (Real-Time Ticked)
When deployed, companions can:
- Go **gather materials** in an assigned area while you cultivate
- Be sent on **missions** — 2–12h real time, returns with loot and exp
- Stay in **guard mode** — defends your stronghold from raids
- **Cultivate independently** — they grow even when you're offline
- **Trade on your behalf** in city markets (high relationship required)

### Companion Relationship Events
- Random events fire based on relationship level (similar to Stardew Valley hearts)
- High relationship unlocks unique dialogue, personal quests, and joint cultivation sessions
- Joint cultivation gives both parties bonus exp and occasionally unlocks a Dual Technique
- Betrayal is possible if Loyalty drops below 10 — they leave or turn hostile

### Recruitable Companion Types
| Type | Find Condition | Specialty |
|---|---|---|
| Wandering Alchemist | City quest chain | Alchemy, crafting |
| Beast Tamer | Capture a rare spirit beast | Spirit bonding, beast combat |
| Rogue Disciple | Help them escape their sect | Combat, intelligence |
| Fallen Immortal Fragment | Hidden inheritance site | Ancient techniques, lore |
| Silent Assassin | PvP event chain | Stealth, assassination techniques |
| Merchant Prince | City standing + wealth | Trade, market manipulation |
| Young Heaven Genius | Rival system — convert instead of fight | Combat, breakthrough support |

---

## 8. World Events

### Types of World Events
| Category | Trigger | Scale | Duration |
|---|---|---|---|
| Sect War | Two sect NPCs reach conflict threshold | Regional | 3–7 days real |
| Heaven Cracking | Story milestone reached by any player | World-wide | 24h |
| Treasure Emergence | Time-gated, random region | Regional | 6h |
| Plague / Qi Corruption | Random, or triggered by player action | City-wide | 12h |
| Auction Season | Scheduled weekly | City-wide | 48h |
| Great Hunt | Guild event — coordinated beast hunt | Regional | 24h |
| Heavenly Tribulation | Player breakthrough triggers zone event | Localized | 1h |
| Ancient Domain Opens | Story-triggered dungeon access | Regional | 72h |
| Faction Collapse | NPC sect falls below threshold | Regional | Permanent until rebuilt |
| Sealing Array Fragment | Story arc event | World-wide | Permanent plot change |

### World Event Participation
- Players in the affected region see event UI banner
- Participation rewards scale with contribution (actions taken, enemies killed, quests completed)
- Some events have **faction sides** — different players can be on opposing sides
- Event outcome is **voted by collective player action** — what most players do determines the result
- Persistent world state records outcomes (city destroyed = city shows ruin state until rebuilt)

---

## 9. UI/UX Rework — Mobile-First

### Design Principles
- **Every important action is one tap away from the main screen**
- No nested menus more than 2 levels deep for core actions
- All modals are **bottom sheets on mobile** (swipe up to open, swipe down to close)
- Font size minimum 16px on mobile, tappable targets minimum 44x44px
- **Tab bar navigation** at bottom of screen (Torn City style persistent nav)

### Bottom Tab Bar
```
[Cultivation] [World] [Companions] [City] [Profile]
```

### Screen Layouts

**Cultivation Tab:**
- Active technique display at top with progress bar
- Quick action buttons (Meditate, Train Body, Train Soul)
- Timer display for active actions
- Qi/HP/BQ bars always visible

**World Tab:**
- Map view (atlas) — fullscreen with tap-to-select regions
- Current area info card
- Quick explore button
- Active battle display if in combat

**City Tab:**
- Current city name and services grid
- Big tappable service cards (Spirit Hall, Market, Guild, Sect, Inn, Craft)
- Faction standing bars visible

**Companions Tab:**
- Companion cards with thumbnail art placeholders
- Relationship/Loyalty bars
- Quick dispatch buttons (Mission, Gather, Guard)
- Companion chat history (relationship events)

**Profile Tab:**
- Character card (name, realm, age, title)
- Stats grid
- Equipment display
- Quest log
- Inventory

### Battle UI (V2 — Mobile-First)
```
┌─────────────────────────────┐
│  Enemy Name          HP bar │
│  [Enemy art placeholder]    │
│  Status icons               │
├─────────────────────────────┤
│  Combat log (scrollable)    │
│  last 3 lines visible       │
├─────────────────────────────┤
│  Your HP/Qi/BQ bars         │
├─────────────────────────────┤
│ [Attack] [Defend] [Flee]    │
│ [Technique ▾] [Spirit ◈]   │
└─────────────────────────────┘
```
- Technique picker is a horizontal scroll row, not a dropdown
- Spirit button glows when assist is ready
- Auto button in corner for passive play

### Color System (V2)
Keep the dark cultivation aesthetic but add **realm-color coding**:
- Mortal: cool gray
- Qi Condensation: soft blue
- Foundation: jade green
- Core Formation: amber gold
- Nascent Soul: violet
- Soul Formation: deep red
- Void Refinement: electric teal
- Saint Ascension: bright gold
- Immortal Lord: luminous white
- Dao Sovereign: black with star specks

---

## 10. Drop System Overhaul

### Design Principles
- **Drops should feel earned, not random tax returns**
- Drop tables are tiered by area danger, not RNG flat rolls
- Named enemies always have unique drop chances
- Most common drops are small crafting materials (expected)
- Rare drops require specific conditions (rare enemy, deep explore, first weekly kill)

### Drop Tiers
| Tier | Example | Drop Rate Rule |
|---|---|---|
| Common | Spirit Herb, Beast Core | 80–100% from matched combat |
| Uncommon | Embersteel Ingot, Soul Amber | 30–60% from matched focus area |
| Rare | Cultivation Scrolls, Equipment | 5–15% from danger ≥3 combat |
| Epic | Inheritance Fragments, Spirit Vessels | 1–3% from named enemies or boss |
| Legendary | Ancient Techniques, Dao Crystals | 0.1–0.5% from boss first-kill only |
| Unique | NPC personal items, story items | Quest or specific world event only |

### Loot Context Rules
- Kills in focus-matched areas get +25% drop tier bias
- Guild hunt contracts guarantee at least uncommon drop from target
- Companion with Intelligence specialty boosts drop rates by +15%
- Fortune stat adds a small flat bonus to all drop chances
- First kill of any named boss in a week = guaranteed rare or above

### Craft Economy Loop
- Most legendary items are not dropped — they are **crafted** from multiple rare components
- Alchemy paths produce: pills (time recovery), elixirs (stat boost), poisons (PvP), arrays (passive buffs)
- Forging paths produce: weapons, armor, spirit artifact rings, companion equipment
- Crafting has success chance — failed crafts return partial materials, not nothing

---

## 11. Quest Tree & Narrative System

### Quest Types
| Type | Description | Repeatable |
|---|---|---|
| Main Story | Arc-tied, one-time, world-state changing | No |
| Faction Quest | Standing rewards, rotating pool | Yes (daily/weekly) |
| City Side Quest | Local NPC driven, flavor-heavy | Varies |
| Companion Quest | Unlocks companion lore and relationship | No per stage |
| Rival Quest | Track and interact with your rival NPCs | Ongoing chain |
| World Event Quest | Tied to active world event | No (event-scoped) |
| Hidden Quest | No UI indicator — found by exploration or dialogue | No |
| Daily Challenge | Auto-generated from your current area, resets daily | Yes |

### Quest Tree Visualization (Admin & Player-Facing)
- Quest chains are stored as a **directed graph** (nodes = quests, edges = prerequisites)
- Main story quests form the trunk; side quests branch off
- Visual quest log (web) shows a node tree:
  - ◉ Completed (green)
  - ◎ Available (amber)
  - ○ Locked (gray, shows requirement)
  - ⬡ Hidden (only visible once discovered)
- Each node shows: difficulty tier, realm requirement, faction requirement, estimated time
- Connecting lines show whether quest chains are linear, branching, or loop-back

### Quest Difficulty Representation
Visual tiers on quest nodes:
```
⭐          Common (any realm)
⭐⭐         Uncommon (requires specific realm)
⭐⭐⭐        Rare (realm + faction requirement)
⭐⭐⭐⭐       Epic (story-locked + item key)
⭐⭐⭐⭐⭐     Legendary (unique, time-sensitive, world event-locked)
```

---

## 12. Admin Dashboard & Dev Tracker

### What It Is
A separate admin web panel (protected route) showing:
1. **Feature completion tracker** — every feature with a completion %, status tag, and severity
2. **Live player stats** — DAU, active accounts, realm distribution, world event participation
3. **Quest tree builder** — visual node editor for creating quest chains
4. **NPC state viewer** — current state of all world NPCs
5. **World state control** — trigger/end world events manually
6. **Character lookup** — search by name, view full character state, modify if needed
7. **Audit log viewer** — all admin actions and suspicious player activity

### Feature Completion Tracker
Each feature entry has:
```yaml
feature: "PvP Arena System"
status: "In Progress"  # Not Started | In Progress | Needs Work | Complete | Broken
completion: 35         # percentage 0-100
severity: "Medium"     # Low | Medium | High | Critical
priority: "P2"         # P0=blocking | P1=launch requirement | P2=important | P3=nice to have
notes: "Bracket logic done, reward distribution not implemented, UI pending"
blockers: ["Reward system not designed", "Balance testing needed"]
depends_on: ["Account system", "Character state API"]
```

### Feature Status Tags & Colors
| Status | Color | Meaning |
|---|---|---|
| Not Started | Gray | On roadmap, not touched |
| In Progress | Blue | Actively being developed |
| Needs Work | Orange | Implemented but broken or incomplete |
| Complete | Green | Tested and working |
| Broken | Red | Was working, now broken — needs hotfix |
| Deprecated | Purple | Removed or replaced |

### Admin Routes (Protected)
- `/admin` — dashboard home
- `/admin/features` — feature tracker grid
- `/admin/quests` — quest tree builder
- `/admin/npcs` — NPC world state viewer
- `/admin/events` — world event control panel
- `/admin/players` — player/character search and management
- `/admin/audit` — audit log with filters
- `/admin/economy` — silver/item flow analytics

### Access Control
- Admin level is stored in accounts table (`admin_level` column)
- Workers check admin level on every `/admin` route request
- Level 1 (Mod): can view, can't modify
- Level 2 (Admin): can modify most things, can't ban accounts
- Level 3 (Superadmin): full access

---

## 13. Monetization & Live Service Design

### Non-Predatory Principles
- **No pay-to-win** — premium currency only ever buys cosmetics or convenience, never power
- Cultivation speed and power are **not for sale**
- Every premium cosmetic has an earnable equivalent (may take longer but is achievable)
- No loot boxes / gacha — all premium items are direct purchase with visible prices

### Premium Currency — Jade Seals
- Earnable via: story arc completions, weekly event participation, login streaks, special challenges
- Purchasable directly (optional support path)
- **What Jade Seals Buy:**
  | Item | Cost | Notes |
  |---|---|---|
  | 4th character slot | 800 Jade | Account-wide, one time |
  | Cultivation Aura (cosmetic qi visual) | 200–500 Jade | Per character |
  | Title color | 100 Jade | Display name styling |
  | Stronghold skin | 400 Jade | Visual theme for home |
  | Spirit beast skin | 300 Jade | Reskin for bonded spirit |
  | Companion outfit | 250 Jade | Visual only, no stat change |
  | Name change token | 150 Jade | Once per 90 days |
  | Extended offline action queue | 200 Jade | Queue 2 actions instead of 1 while offline |

### Seasonal Pass — "Path of Heaven" (Optional)
- Free track: earnable through normal play
- Premium track (one-time purchase per season, Jade Seal cost): doubles free track rewards, adds exclusive cosmetics
- No gameplay advantage on premium track — only cosmetic and bonus earnable content
- Season duration: 90 days
- Premium track is always purchasable with earned Jade Seals (no mandatory real-money)

### Supporter Pack (One-Time)
- A "Founder's Seal" pack available at launch — one time, direct purchase
- Contents: 1000 Jade Seals, exclusive title "Realm Forger", a founder-only cultivation aura, 4th character slot
- This is a thank-you pack, not a competitive advantage

### Free Player Path
- Patron Coins (V1) → renamed to **Jade Seals** (unified currency)
- Daily login: 5–20 Jade Seals per day (streak bonuses)
- Story arc completion: 100–500 Jade Seals
- Weekly world event: 50–150 Jade Seals based on contribution rank
- Arena weekly reward: 25–100 Jade Seals
- A dedicated free player can earn ~3000 Jade Seals/month — enough for 1–2 cosmetics

### Live Service Cadence
| Cycle | Content Drop |
|---|---|
| Daily | Daily challenge quests, daily faction tasks reset, daily Jade Seal login |
| Weekly | Boss resets, arena bracket, weekly faction event, season pass track progress |
| Monthly | New story arc episode or world event, balance patch, new cosmetic in shop |
| Quarterly | Major system expansion, new region or exploration area, new season pass |
| Annually | Arc conclusion, world state permanent change, realm ladder extension, annual event |

---

---

## 14. Art Direction & Visual References

### Overall Style Direction
**Dark ink-wash cultivation aesthetic** — think Chinese watercolor painting meets modern mobile RPG UI.  
Not pixel art, not generic anime — stylized, atmospheric, readable at small sizes on a phone screen.

### Primary Mood Reference Targets
When commissioning or generating art, these are the vibes to aim for:

| Asset Type | Reference Style | Notes |
|---|---|---|
| Character portraits | Manhwa-style (Solo Leveling linework, colored with cultivation palette) | Clear face features, cultivation aura glow |
| Companion cards | Full portrait card, ornate border by cultivation affinity color | Similar to Overmortal companion cards |
| World map | Illustrated ink-style regional map | Fog of war on undiscovered regions |
| Exploration backgrounds | Atmospheric scenery — misty mountains, jade marshes, ruined temples | Can be simple gradients with overlaid assets |
| Battle backgrounds | Region-matched environment layer behind combat UI | 3 per region minimum |
| Spirit beasts | Mythical creature illustrations — not cartoonish | Reference: Chinese celestial beast paintings |
| Item icons | Clean flat icon with glow border per tier color | 32×32 minimum for mobile readability |
| UI chrome | Dark matte panels with gold/jade line-work borders | Avoid heavy gradients — too slow on mobile |
| Loading screens | Full-scene illustrations of story moments | One per major arc beat |

### Tier / Rarity Color Language (Consistent Across All Art)
| Tier | Color | Hex | Usage |
|---|---|---|---|
| Common | Gray | #9aa0a6 | Default item border, NPC text |
| Uncommon | Green | #4caf7d | Item glow, technique grade |
| Rare | Blue | #4a90e2 | Scroll borders, elder NPC aura |
| Epic | Purple | #9b59b6 | Spirit beast aura, epic technique |
| Legendary | Gold | #f5c842 | Boss name, legendary item glow |
| Unique | Red-Gold gradient | #e74c3c → #f5c842 | Story items, quest keys |
| Transcendent | White-Blue | #e0f7ff | Multiverse technique variants |

### Cultivation Aura Visuals (by Path)
| Path | Aura Color | Particle Effect |
|---|---|---|
| Sword Sovereign | Silver-white | Sharp edge sparks |
| Body Refiner | Deep red-brown | Stone crack overlay |
| Dao Alchemist | Amber | Floating pill particles |
| Formation Sage | Cyan | Geometric array rings |
| Spirit Sovereign | Gold-violet | Spirit beast ghost outline |
| Soul Weaver | Indigo | Ripple wave distortion |
| Blood Cultivator | Crimson | Blood droplet particles |
| Spatial Wanderer | Teal-black | Void ripple |
| Poison Dao | Acid green | Mist particles |
| Heavenly Scribe | White | Floating script characters |

### Character Portrait Slots (Priority Order for Art Production)
1. Player avatar options (6 base face types, 3 male / 3 female variants) — at launch
2. Companion character portraits (7 companion types × 1 portrait each)
3. Major NPC portraits (rival × 3, world figure × 5)
4. Boss illustration (1 per region = 6 initial)
5. Spirit beast illustrations (4 current: Emberstorm Crow, Dreamveil Fox, Tyrant Ape, Starlaw Qilin)

### Placeholder Plan (Before Custom Art Exists)
- Use CSS-generated silhouette cards with class-color gradients as placeholders
- Keep placeholder slots clearly marked with `[ART PENDING]` tooltip in dev builds
- Admin dashboard "Art Tracker" section (see section 15) flags which assets are missing

### Manga / Manhwa Visual References to Study
- **Top Tier Providence: Secretly Cultivate for a Thousand Years** — character design, world scale, sect aesthetics
- **Solo Leveling** — clean UI overlay aesthetic, dungeon atmosphere
- **Return of the Mount Hua Sect** — sect politics, cultivation hierarchy visual language
- **Martial Peak** — vast world scale, item and technique rarity presentation
- **Apotheosis (Bai Lian Cheng Shen)** — multiverse/plane visual design, technique clash panels
- **Infinite Mage** — magic system visualization, clean technique effect design

---

## 15. Android App Path

### Approach — Progressive Web App (PWA) First
1. Add `manifest.json` and a service worker to the Pages site
2. This enables **"Add to Home Screen"** on Android — installs like an app
3. Works offline for static content, syncs when online for game state
4. **No app store required for PWA** — fast iteration path

### Native App Path (Later)
1. Use **Capacitor** (Ionic) to wrap the PWA HTML/JS into an Android APK
2. No framework rewrite needed — same HTML/CSS/JS that runs in the browser
3. Capacitor provides native Android APIs (notifications, camera, vibration)
4. Build with GitHub Actions → output APK → distribute via Google Play or direct APK link

### Push Notifications (Android)
- **Web Push via Cloudflare Workers** — send push when your cultivation action finishes
- PWA can receive push notifications on Android without being a native app
- Notify on: action completed, companion returned from mission, world event started, PvP challenge received

---

## 15. Reference Analysis

### Torn City — What To Take
- ✅ Time-gated actions (energy refill, real-time countdowns)
- ✅ Hospital mechanic (temporary incapacitation instead of permadeath)
- ✅ Persistent PvP with opt-in duel system
- ✅ Text-based city services with multiple silver sinks
- ✅ Faction war system with collective participation
- ✅ Real economy (player-to-player trading later)
- ❌ Skip: crime/jail system — doesn't fit cultivation theme (replace with karmic corruption / sect law violations)

### Overmortal — What To Take
- ✅ Companion bonding with growth trees
- ✅ Sect contribution + internal rank ladder
- ✅ Cultivation session mechanics with pill/item boosters
- ✅ Breakthrough failure with qi deviation consequences
- ✅ Dual cultivation events (joint cultivation with companions)
- ✅ Beast/spirit taming system
- ❌ Skip: gatcha-heavy pull mechanics — we're doing earnable-only drops

### Veyra: Gates of Eclipse — What To Take
- ✅ AI-driven NPC factions that evolve without player input
- ✅ NPCs that have memories of player actions
- ✅ Dynamic world events triggered by NPC threshold states
- ✅ Factions that can collapse if neglected
- ✅ World history log — documented events visible to players
- ❌ Need to adapt for serverless — true AI too expensive, simulate with tick-based state machines

### Infinite Immortal Path — What To Take
- ✅ Incremental cultivation (offline progress accumulates)
- ✅ Layered cultivation depths (surface / deep cultivation modes)
- ✅ Long-form progression with meaningful milestones
- ✅ Event interruptions during cultivation that require player decisions

### Top Tier Providence: Secretly Cultivate for a Thousand Years — What To Take
- ✅ World passes time without you — return to changed circumstances
- ✅ "Golden Finger" — unique personal affinity/ability discovered early
- ✅ Subordinate/companion system where they grow independently and surprise you
- ✅ Disguise/hidden identity mechanic — cultivate in secret, reputation management
- ✅ Generational consequences — your early choices echo decades later
- ✅ Time-skip narrative moments — major world changes between arcs
- ✅ Watching rival and enemy NPCs age and change while you stay hidden

---

## 16. Migration Plan — V1 to V2

### Phase 0 — Infrastructure (Weeks 1–2)
- [ ] Set up Cloudflare D1, Workers, KV
- [ ] Deploy auth worker (register, login, session validation)
- [ ] Convert game state from localStorage to server-side API
- [ ] Character selection screen

### Phase 1 — Core Loop Rewrite (Weeks 3–5)
- [ ] All game actions route through Workers API (not just client-side)
- [ ] Real-time cooldowns moved to server-side KV timestamps
- [ ] State serialization/deserialization via D1
- [ ] Mobile-first UI skeleton (tab bar, bottom sheets)

### Phase 2 — Content Layer (Weeks 6–10)
- [ ] Quest tree system with 20+ quests for Arc 0 + Arc 1
- [ ] NPC tick system (cron job Workers)
- [ ] Companion system (at least 3 companion types)
- [ ] Combat overhaul (status effects, technique clash, snappy resolution)
- [ ] Drop system rewrite (tiered, context-aware)

### Phase 3 — Live Service Features (Weeks 11–16)
- [ ] World events system (at least 3 event types)
- [ ] PvP challenge system
- [ ] Admin dashboard (feature tracker, NPC viewer, event control)
- [ ] PWA manifest + service worker (Android installable)
- [ ] Push notifications

### Phase 4 — Polish & Launch (Weeks 17–20)
- [ ] Balance pass
- [ ] Mobile device testing
- [ ] Quest tree visualization (player-facing)
- [ ] World history log
- [ ] Beta invite system

---

## 17. Infrastructure Checklist

### Cloudflare Setup — Do This First
1. **Create D1 database:**
   ```bash
   wrangler d1 create sealed-heavens-db
   ```
2. **Create KV namespace:**
   ```bash
   wrangler kv:namespace create SESSIONS
   wrangler kv:namespace create COOLDOWNS
   wrangler kv:namespace create WORLD_TICK
   ```
3. **Update wrangler.toml** (base on existing AdDev/wrangler.toml):
   ```toml
   name = "sealed-heavens-api"
   compatibility_date = "2024-01-01"
   
   [[d1_databases]]
   binding = "DB"
   database_name = "sealed-heavens-db"
   database_id = "<your-d1-id>"
   
   [[kv_namespaces]]
   binding = "SESSIONS"
   id = "<your-kv-sessions-id>"
   
   [[kv_namespaces]]
   binding = "COOLDOWNS"
   id = "<your-kv-cooldowns-id>"
   
   [triggers]
   crons = ["0 */6 * * *"]   # NPC world tick every 6h
   ```
4. **GitHub Secrets to add:**
   - `CLOUDFLARE_API_TOKEN` — from Cloudflare dashboard → Profile → API Tokens
   - `CLOUDFLARE_ACCOUNT_ID` — from CF dashboard URL or right sidebar

5. **Workers project structure:**
   ```
   workers/
     src/
       index.js        — main router
       auth.js         — register/login/session
       game.js         — action handler
       world_tick.js   — cron NPC tick
       admin.js        — admin routes
     wrangler.toml
   ```

6. **Pages project settings:**
   - Keep existing static deployment as-is
   - Point API calls from the frontend to `https://sealed-heavens-api.<your-account>.workers.dev`
   - Or use Pages Functions (`/functions/api/`) to colocate Workers + Pages

### Say the Word
When ready to start the infrastructure layer, confirm and I'll:
1. Generate the full `wrangler.toml`
2. Write the auth Worker (register, login, JWT, session management)
3. Write the D1 schema migration file
4. Write the first game action Worker endpoint
5. Update `index.html` + `main.js` to call the API instead of localStorage

---

## 18. Open Questions / Decisions Needed

- [ ] **Username registration**: Email required or anonymous with just username + password?
- [ ] **Trading**: Allow player-to-player item trading, or NPC-market only?
- [ ] **Language**: Single language (English) for launch, or scaffold for i18n?
- [ ] **Character art**: Placeholders for now? Or integrate an AI-art-based avatar picker?
- [ ] **World server**: Single shared world for all players, or separate "realm" servers (shards)?  
  > Recommendation: single world for community feel, shards later if needed
- [ ] **Sect system**: Player-founded sects (like guilds in MMOs) or NPC sects only?  
  > Recommendation: NPC sects only for launch, player sects in Phase 3+
- [ ] **PvP opt-out**: Permanent safe mode (no PvP ever) or temporary safe zones only?
- [ ] **Stronghold raids**: Can other players raid your stronghold while offline?  
  > Recommendation: No auto-raids — PvP must be initiated by challenge, not passive raid
