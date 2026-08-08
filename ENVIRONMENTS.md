# Environments & Deployment

How Wrapper's pieces fit together across **local**, **dev**, and **prod**, and how
each one deploys. If you only want to test locally, jump to
[Local development](#local-development).

## Components

| Component | What it is | Hosting | Code |
|---|---|---|---|
| **backend** | Convex functions, auth (Better Auth), billing (Autumn) | Convex | `packages/backend` |
| **relay** | Bun + Hono WebSocket relay for remote sessions | Fly.io | `apps/relay` |
| **web** | Next.js site | Vercel | `apps/web` |
| **cli** | The `wrapper` CLI (host/attach) | GitHub Releases / Homebrew | `apps/cli` |

## Environment model

Two long-lived environments, driven by branch:

```
local        your machine         convex dev (sleek-echidna) + ws://localhost:8080 + localhost:3000
  |
dev branch   ->  DEV  env    ->   Convex sleek-echidna-539 · wrapper-relay-dev · Vercel Preview
main branch  ->  PROD env    ->   Convex confident-fox-458  · wrapper-relay-prod · Vercel Production
```

Real Convex URLs:

| | dev | prod |
|---|---|---|
| `.cloud` | `https://sleek-echidna-539.convex.cloud` | `https://confident-fox-458.convex.cloud` |
| `.site` | `https://sleek-echidna-539.convex.site` | `https://confident-fox-458.convex.site` |

Released CLI binaries treat an unset `NODE_ENV` as production and default to
`https://confident-fox-458.convex.cloud`,
`wss://wrapper-relay-prod.fly.dev`, and `https://wrapper.sh`. Source development
must set `NODE_ENV=development` and explicit dev endpoints.

### How each component picks dev vs prod

- **web (Vercel)**: Vercel's Git integration decides by the **Production Branch**
  setting. Set Production Branch = `main`. Then `main` → Production, every other
  branch (incl. `dev`) and PR → Preview. No GitHub workflow needed.
- **backend + relay (GitHub Actions)**: the deploy workflows pick a GitHub
  Environment from the branch, so secrets/variables resolve per environment:

  ```yaml
  environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'dev' }}
  ```

| Workflow | Trigger | Deploys |
|---|---|---|
| `.github/workflows/deploy-backend.yml` | push `dev`/`main` on `packages/backend/**` | Convex (`convex deploy`) |
| `.github/workflows/deploy-relay.yml` | push `dev`/`main` on `apps/relay/**` | Fly app (`flyctl deploy --app`) |
| `.github/workflows/ci.yml` | every PR/push | lint, types, tests, web build, relay smoke (no deploy) |

Web is **not** in GitHub Actions. Vercel deploys it directly from Git.

## Env var matrix

### backend: Convex (set per deployment with `bunx convex env set KEY value`)

| Key | dev (sleek-echidna) | prod (confident-fox) |
|---|---|---|
| `ENVIRONMENT` | `development` | `production` |
| `SITE_URL` | Vercel dev/preview URL | Vercel production URL |
| `BETTER_AUTH_SECRET` | dev secret | prod secret |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | dev OAuth app | prod OAuth app |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` | dev Services ID + secret | prod Services ID + secret |
| `AUTUMN_SECRET_KEY` | `am_sk_test_…` (sandbox) | `am_sk_live_…` (production) |
| `WRAPPER_AUTUMN_RELAY_SHARE_FEATURE_ID` | `can_share_relay` | `can_share_relay` |
| `WRAPPER_RELAY_HOST_TICKET_TTL_MS` etc. | optional (has defaults) | optional (has defaults) |

### relay: Fly secrets (`flyctl secrets set KEY=value --app <app>`)

| Key | wrapper-relay-dev | wrapper-relay-prod |
|---|---|---|
| `CONVEX_URL` | `https://sleek-echidna-539.convex.cloud` | `https://confident-fox-458.convex.cloud` |
| `PORT` | 8080 (in fly.toml) | 8080 (in fly.toml) |

### web: Vercel (Project, then Settings, then Environment Variables)

Vercel scopes: **Production** = `main`, **Preview** = `dev` + PRs, **Development**
= local `vercel dev` only. The web app only needs these two (both are baked at
build time):

| Key | Production | Preview | Development |
|---|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `…confident-fox-458.convex.cloud` | `…sleek-echidna-539.convex.cloud` | `…sleek-echidna-539.convex.cloud` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `…confident-fox-458.convex.site` | `…sleek-echidna-539.convex.site` | `…sleek-echidna-539.convex.site` |

### GitHub Environments (`dev`, `production`): backend and relay only

| Name | Kind | dev | production |
|---|---|---|---|
| `CONVEX_DEPLOY_KEY` | secret | sleek-echidna deploy key | confident-fox deploy key |
| `FLY_API_TOKEN` | secret | ✓ | ✓ |
| `FLY_APP_NAME` | var | `wrapper-relay-dev` | `wrapper-relay-prod` |

## One-time setup checklist

1. **Vercel (web)**: import the repo, set **Root Directory = `apps/web`** and
   **Production Branch = `main`**. Add the env vars from the web table above
   (Production / Preview / Development). If the build fails resolving the bun
   `catalog:` versions, set the Install Command to run at the repo root
   (`cd ../.. && bun install`).

2. **Convex env**: set the backend vars on both deployments and create a deploy
   key each (Dashboard → Settings → Deploy Keys):

   ```bash
   cd packages/backend
   # dev (against sleek-echidna, e.g. `bunx convex env set --preview-name` or via dashboard)
   bunx convex env set SITE_URL https://<vercel-dev-url>
   # prod (against confident-fox)
   bunx convex env set SITE_URL https://<vercel-prod-url>
   ```

3. **Fly (relay)**: two apps plus secrets:

   ```bash
   flyctl apps create wrapper-relay-dev
   flyctl apps create wrapper-relay-prod
   flyctl secrets set CONVEX_URL=https://sleek-echidna-539.convex.cloud --app wrapper-relay-dev
   flyctl secrets set CONVEX_URL=https://confident-fox-458.convex.cloud --app wrapper-relay-prod
   # FLY_API_TOKEN: `flyctl tokens create deploy` -> GitHub env secret (both envs)
   ```
   After the new prod app is verified, delete the old one:
   `flyctl apps destroy wrapper-dry-pathway-1935`.

4. **GitHub Environments**: create `dev` and `production`, then fill the table above.

5. **OAuth apps**: dev GitHub OAuth app now (callback
   `https://sleek-echidna-539.convex.site/api/auth/callback/github`), prod later
   (`https://confident-fox-458.convex.site/api/auth/callback/github`). Put client
   id/secret in the matching Convex deployment env.

6. **Autumn**: push config to both (not automatic, the key decides the env):

   ```bash
   cd packages/backend
   bunx atmn push          # sandbox (dev)  -> am_sk_test_ key
   bunx atmn push --prod   # production     -> am_sk_live_ key
   ```

Once done: push to `dev` → dev backend/relay deploy + Vercel Preview; merge to
`main` → prod everything.

## Local development

Four terminals:

```bash
# 1) backend (Convex dev deployment + live codegen)
cd packages/backend && bunx convex dev

# 2) relay
cd apps/relay && CONVEX_URL="https://sleek-echidna-539.convex.cloud" bun run dev

# 3) web (optional, for auth/onboarding UI)
cd apps/web && bun run dev            # http://localhost:3000

# 4) cli
cd apps/cli && bun run index.ts auth login
bun run index.ts shell-host
```

`packages/backend/.env.local` holds your local Convex + `AUTUMN_SECRET_KEY`. Point
the CLI at local with `apps/cli/.env.local` (copy from `.env.example`).

### Test the Pro / relay-share gate

1. In the host shell, press `Ctrl+\` then `s` to share.
2. As a **free** user you should see *"Relay sharing requires Pro"* + a checkout
   URL (URL only if Stripe is connected in the Autumn sandbox; otherwise the
   generic message, still correctly denied).
3. Grant Pro (Stripe test card `4242 4242 4242 4242`, or attach `pro` in the
   Autumn dashboard), retry → sharing succeeds and a viewer can attach:

   ```bash
   bun run index.ts attach --id <session-id>
   ```
