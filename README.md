# Sealed Heavens V2

Sealed Heavens is a browser-based cultivation MMO in active rework.
The current live build runs on a Cloudflare Worker that serves both the API and the static frontend.

## Current State

- Plain HTML, CSS, and JS frontend
- Cloudflare Worker backend
- D1 for durable game data
- KV for sessions and other ephemeral state
- Staged asset deploys from `workers/dist`
- Username-first auth with optional email on registration

## Important Project Docs

- `VISION_V2.md` for the current product direction
- `RESEARCH_CULTIVATION_SYSTEMS.md` for the reference synthesis behind that direction

## Local Run

Open `index.html` in a browser for static frontend work.

For live-service testing, run the Worker stack instead of relying on offline-only behavior.

## Production Architecture

Production currently deploys like this:

`GitHub main -> GitHub Actions -> Cloudflare Worker + Workers Assets -> D1 + KV`

The Worker is the source of truth for auth and live gameplay.
The staged asset build prevents accidental upload of repo internals.

## Safe GitHub Update Flow

Use one real git clone as the source of truth.
Do not edit one local copy and push another.

Recommended flow:

1. Run `git status --short` before you touch anything.
2. Make the change in the real repo clone.
3. Stage both frontend assets and Worker files when they belong to the same feature.
4. Commit once the feature is internally consistent.
5. Push to `main`.
6. Confirm `.github/workflows/deploy-workers.yml` completed successfully.
7. Smoke test the live site.

Useful command set:

```powershell
git status --short
git add -A
git commit -m "Describe the feature or fix"
git push origin main
```

If root assets changed but were not committed, production will drift.
If Worker files changed but the asset staging config did not deploy with them, production can also drift.

## Live Auth Contract

- Register accepts `username` and `password`
- `email` is optional
- Login accepts `identifier` plus `password`
- `identifier` can be a username or an email

## Manual Fallback Deploy

From `workers/`:

```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
& "C:\Program Files\nodejs\npx.cmd" wrangler deploy
```

Use this when GitHub Actions has not caught up yet or when production needs an immediate fix.

## Minimum Smoke Tests After Deploy

- `GET /api/auth/session`
- register a throwaway account
- login with the throwaway username
- probe a missing file path such as `/.git/index` and confirm it does not expose repo contents

## Current Priorities

- replace prototype onboarding with the V2 intro sequence
- deepen progression loops without bloating the interface
- add safer content-authoring and staging workflows
- expand NPC, faction, and world-state simulation
