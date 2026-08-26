# `web`

The Wrapper web app. It is a Next.js (App Router) project deployed on Vercel.
It is the human-facing side of the product and the browser half of the CLI
login flow.

## What it does

- **Landing page** (`app/page.tsx` + `components/horizontal-landing.tsx`): a
  five-part desktop product narrative covering the hero, connection path,
  explicit control, pricing, and installation. At 1024px and above, a `100dvh`
  sticky viewport maps each vertical scroll pixel directly to horizontal track
  movement; Lenis smooths the native wheel input and
  `requestAnimationFrame` writes the compositor-backed `translate3d`. The track
  remains continuous and never snaps between scenes. Hash links map each
  section back to its vertical document coordinate without adding visible
  navigation chrome.
  Below 1024px, and whenever reduced motion is requested, the same semantic DOM
  becomes a normal vertical story with no pinning or smooth-scroll runtime.
  Visual tokens, motion rules, and voice guidance live in [`BRAND.md`](BRAND.md).
  The start panel keeps CLI install (`brew` / `curl`) as the host path and adds
  an iOS viewer CTA. `NEXT_PUBLIC_IOS_APP_URL` points at App Store or TestFlight
  when live; otherwise the CTA falls back to the mobile viewer docs.
- **Dashboard** (`app/dashboard`): a sidebar-based nested workspace with separate
  profile, active sessions, billing, and data/deletion routes. `/dashboard`
  opens the profile page, and incomplete onboarding redirects to the required
  setup flow before dashboard content renders. Sessions use the real
  `session:listActive` query, while billing reuses the existing protected
  checkout and portal actions. The workspace stays on a flat canvas and uses no
  invented metrics.
- **Device login approval** (`app/oauth/authorize`): the page the CLI sends you
  to during `wrapper auth login`. It reads the `user_code` from the URL,
  confirms your identity through Better Auth, presents the request as structured
  account information, and approves the device code so the CLI can finish
  logging in.
- **Onboarding** (`app/onboarding`): a minimal one-question-at-a-time flow for
  connecting the CLI, reviewing share/revoke controls, and optionally providing
  constrained product context. Required state is still persisted through the
  existing Convex `onboarding` handlers, without exposing internal progress UI.
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

The canonical marketing domain is `wrapper.sh` (see `app/layout.tsx`). Optional
landing video assets live in `public/` and are enabled with
`NEXT_PUBLIC_WRAPPER_DEMO_VIDEO_URL` and `NEXT_PUBLIC_WRAPPER_DEMO_POSTER_URL`.
`app/opengraph-image.tsx` generates the large social preview from the same visual
system as the landing page.

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
