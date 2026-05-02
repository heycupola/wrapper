# Wrapper

> One command to make any terminal you open reachable from your phone.

Wrapper transparently wraps every interactive shell session you open
(zsh, bash, or fish) so an authenticated phone — or any other client —
can mirror it on demand. The wrapping itself is invisible: your dotfiles,
prompt, plugins, and history all behave exactly as before.

The session never leaves your machine until you decide to share it. A
single `Ctrl+\ s` opens a relay tunnel; `Ctrl+\ u` closes it again.

## Status

The CLI core is in place: shell wrapping, registry, attach, install hooks,
keystroke prefix, environments. The relay, the auth backend, and the iOS
app are coming next, in that order.

## Repository layout

This is a Bun + Turborepo monorepo.

```
apps/
  cli/      Wrapper CLI — shell wrapping, registry, attach, install
  web/      Marketing / waitlist landing page (Next.js)
  docs/     Public docs site (Next.js)
packages/
  protocol/             Wire schema shared by every wrapper component
  backend/              Convex backend blueprint and implementation plan
  ui/                   Shared React components for web + docs
  typescript-config/    Single-source tsconfig presets
```

The CLI is the heart of the project — see
[`apps/cli/README.md`](./apps/cli/README.md) for how the wrapping flow
works and what every command does.

Backend implementation planning is tracked in
[`packages/backend/README.md`](./packages/backend/README.md).

Delivery phase status is tracked in [`PHASES.md`](./PHASES.md).

## Local development

Requires:

- **Bun ≥ 1.3.5** (we use `Bun.Terminal` and the `terminal:` option of `Bun.spawn`).
- **POSIX**: macOS or Linux. Windows users should run Wrapper inside
  [WSL](https://learn.microsoft.com/windows/wsl/).

```sh
bun install            # one-time
bun run check-types    # typecheck every package
bun run lint           # oxlint
bun run format         # oxfmt --write
bun run dev --filter=@repo/cli -- shell-host    # try the wrapping flow

# or, in apps/cli:
DEV=true bun run index.ts shell-host
```

`DEV=true` redirects every on-disk path into a `wrapper-dev` namespace
under XDG state (or `%APPDATA%\wrapper-dev\` on Windows), points the
relay/auth URLs at localhost, mirrors logs to stderr, and writes rc-file
patches to a fake-rc directory. A developer running the CLI locally can
never corrupt a real installation's registry, logs, or rc files.

`CI=…` (any value) disables telemetry and console output.

For a full list of environment variables see
[`apps/cli/README.md`](./apps/cli/README.md#environment-variables).

## Tooling

- **Bun** for runtime, package management, and bundling.
- **Turborepo** for task orchestration and caching.
- **oxlint + oxfmt** for linting/formatting (no ESLint, no Prettier).
- **Lefthook** for git hooks (pre-commit oxfmt + oxlint, pre-push checks).
- **Catalog dependencies** so `react`, `next`, `zod`, `typescript`, etc.
  share a single pinned version across the workspace.

## License

TBD.
