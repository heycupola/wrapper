# Wrapper

> One command to make any terminal you open reachable from your phone or another device.

Wrapper transparently wraps every interactive shell session you open
(zsh, bash, or fish) so an authenticated device can mirror it on demand.
The wrapping itself is invisible: your dotfiles, prompt, plugins, and
history all behave exactly as before.

A session never leaves your machine until you decide to share it. Inside
a wrapped shell, `Ctrl+\ s` opens a relay tunnel and `Ctrl+\ u` closes it
again. A second device then attaches to that session and sees the live
terminal.

## How it works in one minute

1. You open a terminal. Your rc file runs `wrapper shell-host`, which spawns
   your real shell inside a pseudo-terminal (PTY) and starts a tiny local
   WebSocket server bound to `127.0.0.1`. Nothing is exposed yet.
2. From the same machine, `wrapper attach` connects to that local server and
   mirrors the session. The transport stays on loopback and does not need the
   relay or Pro; released builds still authorize the signed-in session owner.
3. When you press `Ctrl+\ s`, the CLI asks the Convex backend for a short-lived
   host ticket, connects to the relay on Fly.io, marks the session shared, and
   prints a secret share code. You join your own devices with
   `wrapper attach --relay --id <id>`; anyone else enters the code in a hidden
   prompt, so knowing the session id alone is not enough.
4. By default viewer input prefers a direct WebRTC data channel for lower
   latency. The host keeps relay output available for fallback and mixed
   viewers, and you can force relay-only mode with `WRAPPER_P2P=0`.

## Repository layout

This is a Bun and Turborepo monorepo.

```
apps/
  cli/      Wrapper CLI: shell wrapping, session registry, local + relay attach, device auth, default-on P2P
  relay/    Relay service: authenticated WebSocket routing for shared sessions, deployed on Fly.io
  web/      Next.js app on Vercel: landing page, device-login approval, onboarding, Pro upgrade
  docs/     Mintlify documentation source, published at docs.wrapper.sh
  mobile/   Git submodule pointer to the native SwiftUI iPhone/iPad viewer repository
packages/
  protocol/           Zod wire schema shared by every wrapper component (JSON frames + WebRTC signal)
  backend/            Convex backend: Better Auth, session lifecycle, relay tickets, onboarding, billing
  terminal/           Bun-native PTY layer using the wrapper-pty-helper binary
  logger/             Consola logging plus opt-in PostHog telemetry
  typescript-config/  Single-source tsconfig presets
tools/
  pty-helper/         C source and Makefile for the wrapper-pty-helper binary shipped with the CLI
```

The CLI is the heart of the project. See
[`apps/cli/README.md`](./apps/cli/README.md) for how the wrapping flow works
and what every command does. The transport layer (relay WebSocket and the
default direct WebRTC path) is documented in
[`apps/cli/transport/README.md`](./apps/cli/transport/README.md).

## Where to read next

| Topic                                             | Document                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| CLI commands, keystrokes, env vars                | [`apps/cli/README.md`](./apps/cli/README.md)                     |
| Relay + direct P2P transports                     | [`apps/cli/transport/README.md`](./apps/cli/transport/README.md) |
| Relay service and Fly deploy                      | [`apps/relay/README.md`](./apps/relay/README.md)                 |
| Convex backend (auth, sessions, tickets, billing) | [`packages/backend/README.md`](./packages/backend/README.md)     |
| Wire protocol                                     | [`packages/protocol/README.md`](./packages/protocol/README.md)   |
| PTY internals                                     | [`packages/terminal/README.md`](./packages/terminal/README.md)   |
| Logging and telemetry                             | [`packages/logger/README.md`](./packages/logger/README.md)       |
| Dev and prod environments, deploy automation      | [`ENVIRONMENTS.md`](./ENVIRONMENTS.md)                           |
| Production operations, incidents, backups, SLOs   | [`OPERATIONS.md`](./OPERATIONS.md)                               |
| Public documentation                              | [`docs.wrapper.sh`](https://docs.wrapper.sh)                     |
| Documentation source                              | [`apps/docs`](./apps/docs) (run `bun run --cwd apps/docs dev`)   |

`https://wrapper.sh` is the canonical production website, auth, installer,
legal, and support origin. `https://docs.wrapper.sh` is the canonical public
documentation origin.

## Status

The CLI core, the Convex auth and backend, the relay transport, and the web
onboarding flow are implemented in this repository. Sharing attempts a direct
WebRTC P2P data path by default, with the relay kept online for signaling and
automatic fallback (`WRAPPER_P2P=0` forces relay-only mode). The terminal title
shows the role, session, and active transport without reserving a screen row.
The separate `apps/mobile` submodule now contains a Simulator-ready native
iPhone/iPad viewer MVP: device authorization, owner and guest join flows,
SwiftTerm rendering, relay transport, native WebRTC, and adaptive navigation.
It uses Swift 6.0 language mode with complete strict concurrency on Xcode 26.
CLI `v0.1.2` is published on GitHub Releases. Signed-device validation and App
Store review remain pre-release work.

The active focus is operational hardening:

- rotate `HOMEBREW_TAP_TOKEN` so release workflow can keep the tap in sync
- keep dependency audit, lint, format, types, auth, and relay checks green
- complete the TestFlight public beta for the iOS viewer, then App Store review
- finish the remaining hosted-ops items in [`OPERATIONS.md`](./OPERATIONS.md)

## Local development

Requirements:

- **Bun 1.3.5 or newer** for runtime, package management, and bundling.
- **A POSIX system** (macOS or Linux). On Windows, run Wrapper inside
  [WSL](https://learn.microsoft.com/windows/wsl/).

Environment templates are included:

- `.env.example` (shared)
- `apps/cli/.env.example`
- `apps/relay/.env.example`
- `packages/backend/.env.example`

Clone with the mobile submodule:

```sh
git clone --recurse-submodules https://github.com/heycupola/wrapper.git
cd wrapper

# For an existing clone:
git submodule update --init --recursive
```

The mobile repository has its own git history. The parent repository tracks
only its commit pointer. For mobile development on macOS, install the
prerequisites in [`apps/mobile/README.md`](./apps/mobile/README.md), then
generate the ignored Xcode project:

```sh
make -C apps/mobile bootstrap
```

```sh
bun install            # one-time
bun run check-types    # typecheck every package
bun run lint           # oxlint
bun run format         # oxfmt --write

# try the wrapping flow locally
cd apps/cli && NODE_ENV=development bun run index.ts shell-host
```

`NODE_ENV=development` moves every on-disk path into a `wrapper-dev` namespace
under XDG state (or `%APPDATA%\wrapper-dev\` on Windows), points the relay and
auth URLs at localhost, mirrors logs to stderr, and writes rc-file patches into
a throwaway directory. A developer running the CLI locally can never corrupt a
real installation's registry, logs, or rc files.

Setting `CI` to any value disables telemetry and console output. For the full
list of CLI environment variables, see
[`apps/cli/README.md`](./apps/cli/README.md#environment-variables).

## Tooling

- **Bun** for runtime, package management, and bundling.
- **Turborepo** for task orchestration and caching.
- **oxlint and oxfmt** for linting and formatting (no ESLint, no Prettier).
- **Lefthook** for git hooks (pre-commit oxfmt and oxlint, pre-push checks).
- **Catalog dependencies** so shared packages such as `react`, `next`, `zod`,
  and `typescript` use a single pinned version across the workspace.
- **`bun run audit`** for advisory checks. Werift's abandoned `ip` dependency is
  replaced by the tested `packages/ip` compatibility shim backed by
  `ipaddr.js`. The audit script ignores only Bun's name-based false positive for
  that private shim.

## License

This repository is [MIT](./LICENSE) © 2026 Cupola Labs, LLC.

The iOS app in [`apps/mobile`](./apps/mobile) is a separate repository and is
**not** covered by this MIT license.

Security issues must be reported privately according to [`SECURITY.md`](./SECURITY.md).
Hosted-service policies are published at
[wrapper.sh/privacy-policy](https://wrapper.sh/privacy-policy) and
[wrapper.sh/terms-of-service](https://wrapper.sh/terms-of-service).
