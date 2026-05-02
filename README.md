# Sealed Heavens Prototype

A browser-based cultivation game prototype with:
- Realm and stage breakthroughs
- Multi-path cultivation learning
- HP/Qi/Longevity HUD
- Second-based action cooldowns
- Inventory, ring, housing, hunting, events
- Region-based world map exploration

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
- Move cooldown authority to a backend service for anti-cheat.
- Add account auth before live service launch.
- Add server-validated combat and economy events.
