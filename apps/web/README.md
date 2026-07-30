# `web`

The Wrapper web app. It is a Next.js (App Router) project deployed on Vercel.
It is the human-facing side of the product and the browser half of the CLI
login flow.

## What it does

- **Landing page** (`app/page.tsx` + `components/horizontal-landing.tsx`): a
  horizontally scrolling marketing page with a product video and a copyable
  install command.
- **Device login approval** (`app/oauth/authorize`): the page the CLI sends you
  to during `wrapper auth login`. It reads the `user_code` from the URL,
  confirms your identity through Better Auth, and approves the device code so the
  CLI can finish logging in.
- **Onboarding** (`app/onboarding`): a first-run checklist (complete profile,
  connect the CLI, share a first session) backed by the Convex `onboarding`
  handlers. It also hosts the Upgrade to Pro button
  (`components/upgrade-pro.tsx`), which redirects to a Stripe checkout URL
  created by the Convex `billing:createProCheckout` action.
- **Auth API** (`app/api/auth/[...all]/route.ts`): the Better Auth handler that
  the client SDK talks to.
- **Installer** (`app/install/route.ts`): canonical `https://wrapper.sh/install`
  endpoint, serving the reviewed CLI installer source from the main branch.
- **Legal and support** (`app/privacy-policy`, `app/terms-of-service`,
  `app/support`): Wrapper-specific terminal data flow, service terms, support
  channels, and private vulnerability reporting.

## How it connects to the rest of Wrapper

- **Convex backend** (`@repo/backend`) for auth, onboarding state, and billing.
- **Better Auth** for sessions and the device authorization approval step.

The canonical marketing domain is `wrapper.sh` (see `app/layout.tsx`). The
landing video assets are described in `public/README.md`.

## Local development

```bash
bun install                 # from the repo root
bun run --cwd apps/web dev  # starts Next.js on http://localhost:3000
```

Environment variables come from the shared and web-specific `.env` templates.
The web app expects the Convex deployment URL and the Better Auth site URL to
match the environment it runs against (local, dev, or prod). See
[`../../ENVIRONMENTS.md`](../../ENVIRONMENTS.md) for the full matrix and the
GitHub OAuth callback URLs per environment.

## Build and deploy

```bash
bun run --cwd apps/web build
```

Deployment is handled by Vercel. Pushing to the tracked branches deploys the
matching environment; production tracks `main`.
