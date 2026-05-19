# Sealed Heavens - Vision V2
Date: May 2026
Status: Direction locked, systems iterative

This document replaces the old prototype-era vision.
Sealed Heavens V2 is a live-service, text-first cultivation MMO built for deep progression, long-horizon planning, and a world that keeps moving while the player is offline.
The project should feel handcrafted, not bloated, and every major system should justify its existence through meaningful player decisions.

---

## 1. Core Thesis

Sealed Heavens V2 is not trying to be a fast idle clicker, a generic browser RPG, or a thin cultivation skin over ordinary stat grinding.

It is a cultivation world where:
- knowledge matters as much as stats
- time is a strategic resource
- bottlenecks, social ties, and geography shape progression
- different paths feel materially different to play
- the world reacts even when the player is absent
- text remains the primary delivery format, but the presentation still feels alive

The target emotional loop is not "number go up quickly."
It is "I finally understand how this system works, I prepared properly, and the breakthrough felt earned."

---

## 2. Product Pillars

### Pillar 1: Depth that creates guide culture
- Systems should be learnable but not trivial.
- Players should benefit from community theorycrafting, route planning, and comparative builds.
- Complexity should come from interacting systems, not unreadable menus or filler currencies.

### Pillar 2: Progression with pressure, not hopeless punishment
- Failure must matter.
- Failure must not feel like the game hates the player.
- Qi deviation, injury, reputation loss, and temporary inefficiency are good.
- Catastrophic setbacks should be rare, telegraphed, and mostly reserved for high-stakes choices.

### Pillar 3: Identity over solved meta
- The player is defined by origin, hidden karma, cultivation root, manuals, allies, sect ties, and itemization.
- Body, qi, soul, martial, craft, and faction progress should overlap without collapsing into the same build.

### Pillar 4: A world that moves on its own
- Named NPCs cultivate, trade, feud, recruit, betray, and die.
- Sects gain and lose power.
- Cities shift in law, availability, and danger.
- The player should log in to new opportunities and new problems.

### Pillar 5: Low-bloat atmosphere
- The game remains readable on mobile.
- Animations and ambience should enhance the text, not bury it.
- Art should arrive after the systems deserve illustration.

---

## 3. Intro Sequence Rework

The current prototype opening is disposable.
V2 starts with a playable onboarding arc called The Mortal Samsara.

### Sequence outline
1. Divination of Birth
The player answers a short set of mortal-life prompts that determine early stat tendencies, social starting points, and hidden narrative hooks.

2. Awakening of Karma
The engine assigns one hidden permanent trait.
This is the player's golden finger, but it should not be framed as a loud loot-box reveal.
The point is mystery, discovery, and long-term differentiation.

3. Broken Meridian Crisis
The tutorial is not a sterile explanation dump.
It is a survival event in which the player is forced to choose how to stabilize a damaged body, who to trust, and what they are willing to risk early.

4. Origin Lock-In
The intro determines starting origin, early faction attitude, and initial cultivation root affinity.
Origin is not a class.
It is a social and environmental starting context.

5. Departure into the first city
The player arrives damaged, poor, and not yet functional.
Their first real objective is not killing rats.
It is learning how to repair themselves enough to enter the wider cultivation ecosystem.

### Intro design goals
- Teach systems through survival pressure.
- Make the world feel hostile, layered, and worth understanding.
- Establish that player identity is discovered through choices, not selected from a generic class menu.

---

## 4. Account and Character Model

### Account principles
- Username-first identity.
- Email is optional, not mandatory.
- Login must accept username or email.
- Sessions use secure httpOnly cookies.
- All authoritative game state remains server-side.

### Character rules
- Up to 3 main character slots at baseline.
- Each character has distinct world state, reputation, rivalries, and inventory.
- Soft deletion uses a grace period.
- No client-trust save editing.

### Identity layers per character
- Public name and visible reputation
- Origin and early-life tags
- Cultivation root profile
- Hidden karma trait
- Dao leanings and taboo history
- Sect or faction ties
- Known manuals and forbidden knowledge
- Rival network and companion network

### Character creation philosophy
- No rigid MMO classes.
- Paths should emerge from manuals, training priorities, mentors, itemization, and social affiliation.
- Early choices create bias, not permanent build prison.

---

## 5. Progression Architecture

Progression should feel like cultivation, not like a single XP bar wearing robes.

### Major progression lanes
- Body cultivation: durability, resilience, physical thresholds, movement burden tolerance
- Qi cultivation: reserve size, efficiency, purity, circulation quality, breakthrough readiness
- Soul cultivation: perception, resistance, formation literacy, spirit-facing systems
- Martial progression: active technique mastery, counters, combo logic, qinggong, weapon schools
- Profession progression: alchemy, forging, formations, talismans, logistics
- Social progression: sect rank, city standing, faction access, disciple leadership

### Core ladder structure
Use a recognizable structural ladder even when terminology shifts:
- Mortal
- Qi Gathering / Condensation
- Foundation Establishment
- Core Formation
- Nascent Soul
- Soul Formation
- Void Refinement
- Body Integration / Mahayana equivalent
- Tribulation / Transcendence threshold

The names can flex by region or path.
The structure should remain legible.

### Stage quality matters more than stage count
- A cracked foundation and a perfect foundation must not be equivalent.
- Core quality should influence later ceiling, not just current power.
- Breakthrough materials, mentor support, environmental fit, and mental state should affect quality.

### Qigong-derived design language
Draw from body, breath, and mind regulation rather than pure fantasy numbers.
Cultivation actions should meaningfully map to:
- posture and body conditioning
- breath control and circulation
- attention, clarity, and internal balance

This gives the system texture and supports active vs passive cultivation modes.

### Bottlenecks
Bottlenecks are required.
They create drama, planning, and build identity.
They should come from:
- rare materials
- time-gated preparation
- manual comprehension
- faction access
- body compatibility
- environment compatibility
- previous bad decisions catching up to the player

### Breakthrough model
Breakthroughs are event chains, not one-button upgrades.
Preparation should include:
- choosing a location
- securing pills or arrays
- stabilizing emotions or injuries
- assigning guards or companions
- deciding whether to attempt early or delay for higher certainty

### Failure model
Do not make failures so punishing that players quit.
Use escalating but recoverable consequences:
- short-term deviation
- temporary stat inefficiency
- damaged meridians that need treatment
- worsened future odds until stabilized
- severe failures only when the player knowingly forced a dangerous attempt

### Qinggong and movement
Movement techniques should matter for map access.
Without enough movement mastery, some areas stay inaccessible even if the player has raw combat strength.

---

## 6. World Structure and Social Simulation

### World shape
The world should feel like a layered cultivation society, not a flat menu of zones.

Core layers:
- city life and legal economy
- jianghu gray zones and outlaw dealings
- sect territories and protected resources
- ruins, fractures, valleys, and hidden inheritances
- late-game sect or domain management

### Region design rules
Each region should differ in more than enemy level.
Regions need distinct:
- laws and taboos
- dominant resources
- faction control
- travel hazards
- cultivation affinities
- signature event types
- economic pressures

### NPC simulation goals
Named NPCs should have:
- ambition
- cultivation progress
- relationships
- faction ties
- memory of player actions
- off-screen activity resolved lazily when needed

### Rival framework
Every serious character should eventually accumulate rivals.
Rivals should not just be random duel targets.
They should:
- compete for inheritances
- win or lose standing in the same cities
- join or found sects
- remember humiliation or mercy
- sometimes surpass the player if ignored

### Companion framework
Companions are not passive stat sticks.
They are sub-plots.
They need:
- loyalty and trust
- preferences and fears
- growth outside direct combat
- mission and logistics utility
- the possibility of disagreement, departure, or betrayal

### Sect building
Sect gameplay should exist, but not as immediate startup clutter.
It belongs in the midgame after the player understands city, faction, and personal cultivation loops.

Sect systems should enable:
- territory logistics
- storage and production chains
- disciple assignment
- raiding and defense
- diplomacy and recruitment
- late-game prestige projects

---

## 7. Itemization, Crafting, and Economy

### Economy layers
- silver: everyday city money, transport, legal fees, supplies
- spirit stones: cultivator market currency and advanced resource sink
- faction merit: non-transferable institutional leverage
- rare barter goods: beast cores, relic shards, blood essences, tribulation residue

### Item philosophy
Items should be defined by templates, but room should exist for individuality.

### Itemization layers
- base template
- rarity tier
- affixes or modifiers
- quality roll
- durability where it adds meaningful tension
- lore tags and faction legality

### Durability policy
Durability should exist on weapons, armor, tools, and selected artifacts.
It should not be attached to every trivial object.
The goal is maintenance pressure and economic flow, not annoyance.

### Affix policy
Affixes should create playstyle pressure, not just larger numbers.
Examples:
- steadier qi flow but slower burst output
- better breakthrough stability but worse combat resonance
- higher movement efficiency in mountain terrain only
- stronger poison resistance but reduced spiritual sensitivity

### Crafting roles
- alchemy: recovery, breakthrough prep, poison, cleansing, rare stabilizers
- forging: arms, armor, spirit vessels, tools, maintenance
- formation work: passive spaces, defensive arrays, support structures, trap preparation
- talismans: consumable tactical flexibility and emergency responses

### Recipe and lore authoring
The project needs a content studio where items, recipes, flavor text, legality, and source tags can be authored without hand-editing code every time.
Content creation needs draft, preview, validation, and publish steps.

---

## 8. Combat, PvE, and PvP

### Combat goals
- fast resolution
- readable logs
- meaningful technique choice
- momentum without visual sludge
- clear differences between body, qi, soul, and item-based play

### Core combat layers
- HP for physical life
- Qi for technique and circulation expenditure
- Battle Qi or tempo for active combat initiative
- status effects tied to real path identities
- counters and enemy pattern recognition

### PvE consequences
PvE losses should mostly produce:
- injuries
- time loss
- local opportunity loss
- damaged gear
- deviation buildup

PvE should not constantly erase long-term progress.

### PvP philosophy
PvP should be meaningful without turning the game into grief-first gameplay.

Rules:
- bracket or realm protection where needed
- opt-in or clearly telegraphed dangerous zones early on
- capped loot loss
- hospital and recovery time that hurts but does not delete days of life
- sect or reputation consequences for repeated predation

### Penalty guardrail
The player should think "I lost because I made a bad choice" not "the system just wasted my week."

---

## 9. UI, Motion, and Art Direction

### UI goals
- mobile-first
- low nesting
- fast state readability
- atmospheric without performance bloat

### Core navigation targets
- Cultivate
- World
- Faction / Sect
- City
- Me

### Presentation rules
- text logs remain central
- panels should feel ceremonial, not sterile
- cultivation actions should have subtle motion signatures
- combat feedback should be immediate and sharp
- item icons should eventually become lightweight SVG or similarly cheap assets

### Motion rules
- use ambient pulses, micro-shakes, reveal timing, and elemental accents
- avoid long blocking animations
- preserve the speed of a good text game

### Art rollout
- system coherence first
- item and character art second
- richer scene art only once the content pipeline is stable

---

## 10. Live Architecture and Modular Safety

### Actual deployment architecture
Current production should be modeled as:

`GitHub main -> GitHub Actions -> Cloudflare Worker + Workers Assets -> D1 + KV`

The Worker serves both API and static assets.
Deployable assets are staged into `workers/dist` through a whitelist build step.

### Data model rules
- High-frequency state belongs in normalized D1 columns.
- JSON belongs to static template data, low-frequency custom payloads, and authoring metadata.
- Ephemeral or rate-limited state belongs in KV.

### Content modularity rules
New gameplay content should be introduced as versioned templates and flagged systems, not as direct destructive edits to live data.

Required concepts:
- content version ids
- feature flags
- backward-compatible schema migrations
- immutable published templates where practical
- reversible admin publish controls

### Staging and admin sandbox
There should be a separate admin-only testing surface for:
- preview items and recipes
- unpublished quest chains
- balance experiments
- NPC and event simulation
- migration dry runs

This can be a separate Worker environment, a preview deployment, or an admin shard with gated data.
The important point is that new content should not be trialed directly on live player progression.

### Content studio requirements
The admin content area should eventually support:
- item templates
- recipe editing
- lore editing
- modifier pools
- encounter tables
- quest nodes
- faction data
- publish notes and rollback metadata

---

## 11. Security, Anti-Botting, and Future Self-Hosting

### Core security rules
- Use Web Crypto APIs only.
- No bcrypt, no JWT dependency sprawl, no unnecessary Node polyfills.
- Secure httpOnly cookies only.
- Server-authoritative cooldowns and state changes.

### Anti-bot measures
- per-action nonces on sensitive activity
- replay invalidation
- rate limiting by IP and account
- invisible Turnstile on high-value endpoints
- behavioral variance checks for robotic timing
- audit logging on critical actions
- shadow mitigation for suspected automation where appropriate

### Auth and onboarding rules
- username-first login flow
- optional email
- no hard dependency on email to start playing

### Self-hosting later
If the project moves off Cloudflare-only hosting later, keep the same security posture:
- CDN and WAF in front
- locked-down origin
- admin surface isolated from public gameplay
- rate limits at edge and app layers
- secrets never stored client-side
- deploy previews and staging kept separate from production data

Unddosable is not a real promise.
The correct goal is expensive to attack, resilient under load, and recoverable under failure.

---

## 12. Roadmap Priorities

### Phase 0: Live-service hardening
- auth stability
- deploy safety
- single source of truth repo workflow
- migration discipline
- admin visibility into live state

### Phase 1: Real onboarding and character shell
- intro sequence rework
- character identity layers
- first-city recovery arc
- rival and companion seeds

### Phase 2: Dense early-midgame loops
- breakthrough prep
- item affixes and repair economy
- qinggong travel gating
- profession progression
- stronger city and faction differentiation

### Phase 3: Living world layer
- NPC ambition simulation
- region event ecology
- auction and black-market flow
- sect conflict escalation

### Phase 4: Content tooling and staging discipline
- draft/publish content tools
- admin sandbox
- preview deployments
- repeatable balancing workflow

---

## 13. Hard Guardrails

- Do not copy another cultivation game's systems one-to-one.
- Do not turn every path into the same progression loop with different names.
- Do not let punishment become so severe that normal players bounce off.
- Do not add five shallow systems where one deep one would do.
- Do not ship live content without a staging path.
- Do not let the world become static just because the UI is text-forward.
- Do not build the upper realms as pure number inflation.
- Do not let prototype shortcuts dictate V2 architecture.

---

## 14. Success Criteria

V2 is on the right track when:
- the intro is memorable and replayable
- early progression already feels guide-worthy
- different builds create different bottlenecks
- cities and sects feel socially distinct
- logging in after absence produces meaningful world change
- content additions can be tested safely before going live
- losses feel tense, not insulting
- the game still feels alive even when rendered primarily through text, logs, panels, and lightweight motion
