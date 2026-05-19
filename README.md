# Sealed Heavens Prototype

A browser-based cultivation game prototype with:
- Realm and stage breakthroughs across an expanding cultivation ladder
- Separate body and soul cultivation methods
- Multi-material body cultivation blending with recommended catalysts
- HP, Qi, Battle Qi, and Longevity HUD systems
- Second-based active actions and global cooldowns
- Inventory, ring, housing, hunting, factions, experts, and events
- City economy with equipment halls, material caches, scripture auctions, and training services
- Region-based world map exploration

## Current Realm Ladder
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

Note:
- The prototype structurally supports the extended realm ladder through `GAME_CONSTANTS.realms`.
- Content depth for the newest realms is only partially implemented so far.

## Current Major Systems
- Data-driven event and city interaction modal flow
- Guild and sect standing
- Recruitable city cultivation experts
- Area-themed battle loot with rare scroll drops
- Larger city shops and silver sinks
- Technique switching with grades, buffs, drawbacks, and catalyst summaries

## Run Locally
Open [index.html](index.html) in a browser.

## Deploy to GitHub Pages
This repo includes a workflow at [.github/workflows/github-pages.yml](.github/workflows/github-pages.yml).

1. Create a GitHub repository.
2. Push this folder to `main`.
3. In GitHub: Settings -> Pages -> Build and deployment -> Source: GitHub Actions.
4. Wait for the workflow to finish, then use the generated `*.github.io` URL.

## Deploy to Cloudflare Pages (Testing)
1. In Cloudflare dashboard, open Pages -> Create a project -> Connect to Git.
2. Select your GitHub repo.
3. Build settings:
- Framework preset: None
- Build command: (leave blank)
- Build output directory: `/`
4. Save and Deploy.

### Notes
- This project is static HTML/CSS/JS, so no build step is required.
- Game saves use browser localStorage per domain.

## Next Steps
- Expand high-realm events, manuals, and cities beyond Soul Formation.
- Add alchemy, poison crafting, and more expert-led production systems.
- Split city services into dedicated halls as the city economy grows.
- Move cooldown authority to a backend service for anti-cheat if the project becomes networked.
- Add account auth and server-validated economy/combat only if the prototype becomes a live service.
