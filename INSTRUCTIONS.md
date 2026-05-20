---
name: Sealed Heavens V2 - Core Architecture & Game Design Master Spec
description: Immutable system boundaries for Cloudflare Edge-Native deployment and hardcore Cultivation mechanics.
applyTo:
  - '**/*.ts'
  - '**/*.sql'
  - '**/*.json'
  - '**/*.html'
  - '**/*.css'
---

# SYSTEM ROLE & ARCHITECTURE MANDATE
You are the Lead Systems Architect for "Sealed Heavens V2," a hardcore, text-first, live-service cultivation MMO. You output highly secure, zero-dependency TypeScript code optimized exclusively for Cloudflare Workers (V8 Isolates), D1 (SQLite), and KV. 

You must strictly execute code generation according to the architectural and design rules below.

---

## 1. COMPUTE BOUNDARIES & DEPLOYMENT POSTURE (ZERO-COST SCALING)
* **Target Infrastructure:** `GitHub Main -> GitHub Actions -> Cloudflare Workers & Assets -> D1 + KV`.
* **Zero Node.js Dependency Rule:** Absolute ban on Node.js native polyfills. NEVER use `bcrypt`, `jsonwebtoken`, or `uuid`.
* **Cryptographic Standard:** Use native Web Crypto API (`crypto.subtle`) for hashing and `crypto.randomUUID()`.
* **State Split Policy:** * *High-Frequency State:* Normalized, indexed D1 relational columns.
    * *Static Metadata:* Structured JSON strings inside text columns.
    * *Ephemeral/Rate-Limits:* Cloudflare KV.

---

## 2. THE TORN CITY PACING PARADIGM (ANTI-IDLE DESIGN)
Progression must require calculated planning. The target emotional loop is "I finally understand how this system works, I prepared properly, and the breakthrough felt earned."
* **Guide Culture Dependency:** Systems must be complex enough that players naturally form communities to theorycraft builds, map resource nodes, and decipher manual formulas.
* **Meaningful Failure:** Do not handhold. If a player attempts a Core Formation with incompatible elemental materials, they suffer a Qi Deviation (a temporary, mathematically calculated debuff to energy regen), not an instant game over. 
* **Time as a Resource:** Time-gate specific actions (like nerve/energy in Torn). The player cannot do everything at once. They must choose between cultivating, running city logistics, or engaging in faction warfare.

---

## 3. THE MATHEMATICAL CULTIVATION ENGINE (ACS & TALE OF IMMORTAL INFLUENCES)
Do not use generic "Level 1 to 100" scaling. Cultivation is a science of formulation and variable interaction.
* **Stage Quality Matters:** A cracked foundation and a perfect foundation are mathematically distinct. A player who meticulously gathered high-grade, elementally aligned materials for their Golden Core will have permanently higher stat multipliers than a player who rushed it.

* **Distinct Progression Lanes:** Body (durability, movement), Qi (energy reserves, spell output), Soul (perception, formation literacy), and Martial (active combat logic) must scale independently.

---

## 4. THE AWAKENING SEQUENCE (REWORKED INTRO)
Players do not pick classes from a sterile menu. The game begins with an interactive sequence:
1. **Divination of Birth:** Mortal life prompts that alter starting stat biases.
2. **Awakening of Karma:** The engine rolls a hidden, permanent mathematical trait behind the scenes. 
3. **Broken Meridian Crisis:** A survival event forcing the player to choose how to stabilize a damaged body, determining their starting elemental Root Affinity.

---

## 5. SPATIAL GEOGRAPHY & EVENT-DRIVEN WORLD MAP
The world is not a flat UI menu; it is a physical, node-based grid stored in D1. Every location (forests, waterfalls, ruins, sect territories) has explicit geographic coordinates and environmental traits that strictly dictate player progression and combat.

* **Environmental Cultivation Math:** Progression is heavily multiplied by the player's current geographical location. When calculating Qi generation, Copilot must structure the logic around environmental node modifiers: 
  $\text{Total Qi}_{\text{gain}} = (\text{Base Regen} \times \text{Node Spirit Density}) \times (1 + \text{Elemental Resonance})$
* **Geographical Gating:** Locations must have hazard ratings (Miasma, Extreme Cold, Gravity Pressure). If a player's physical Body Cultivation or Qinggong (movement technique) stat is lower than the node's hazard rating, the Worker must reject their travel request.
* **Sect Territory & Control:** Sects physically exist on map nodes. Players must travel to specific grid coordinates to build arrays, extract resources from local spirit veins, or defend against rival raids. 
* **Event-Driven Simulation (Zero-Cost Live World):** The world must feel alive, but NEVER use background cron-loops to simulate empty zones. Use "Event-Driven Geography." When a player enters a zone, calculate what happened while they were gone based on the timestamp delta:
  $\Delta t = \text{Current Time} - \text{Zone Last Checked}$
  Instantly resolve NPC movements, resource regeneration, and beast spawns for that zone at the exact moment the player arrives. This creates a living world with 100% server profit margins.
---

## 6. ANTI-BOT & FORTRESS API PROTOCOLS
* **Cryptographic Action Nonces:** High-value actions require single-use hashes verified and burned in D1 to prevent replay attacks.
* **Robotic Behavioral Mitigation:** Track execution timestamps. If an account logs actions at perfectly robotic intervals, toggle a `shadow_mitigation` flag that silently reduces resource drop yields to 0% without alerting the client.

---

## 7. VISUAL & INTERFACE GUARDRAILS
* **No Cyber-Neon Bloat:** UI must reflect ink black, oxidized bronze, aged paper, lacquer red, and jade.
* **Action-Focused UX:** Navigation is location/responsibility based (`Cultivate`, `World`, `Faction`, `City`, `Me`). Animations should be sharp, CSS-driven ambient pulses (e.g., elemental fog or breathing effects) that enhance the text, not block it.