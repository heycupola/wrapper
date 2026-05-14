# `@repo/relay`

Relay service for remote Wrapper session attach.

It authenticates host/viewer WebSocket connections with short-lived Convex
tickets and routes `@repo/protocol` messages by `sessionId`.

## Endpoints

- `GET /healthz` - health check
- `GET /ws?ticket=<relay-ticket>` - authenticated WebSocket endpoint

## Environment

- `PORT` - relay listen port (default `8080`)
- `RELAY_CONVEX_URL` - Convex URL override for ticket consumption
- `WRAPPER_CONVEX_URL` / `CONVEX_URL` - fallback Convex URL values

## Dev commands

From monorepo root:

```bash
bun run --cwd apps/relay dev
bunx tsc --noEmit -p apps/relay/tsconfig.json
bunx oxlint apps/relay
bun test apps/relay/tests
```

## Deploy

### Fly.io

`apps/relay/fly.toml` is included for a single-service deploy.

Required secrets/env on Fly:

- `RELAY_CONVEX_URL` (or `WRAPPER_CONVEX_URL` / `CONVEX_URL`)

Example:

```bash
cd apps/relay
fly launch --no-deploy
fly secrets set RELAY_CONVEX_URL="https://<your-convex>.convex.cloud"
fly deploy
```

### Railway

`apps/relay/railway.json` is included for baseline runtime policy.
Set `RELAY_CONVEX_URL` in Railway service variables.

## Smoke verification

### Automated smoke (deployed relay)

```bash
RELAY_URL="https://relay.example.com" bun run --cwd apps/relay smoke
```

The smoke script checks:

- `GET /healthz` returns `{ ok: true, service: "relay" }`
- unauthenticated `GET /ws` closes with `4001` or `4003`

### Manual end-to-end smoke (CLI + backend + relay)

1. `wrapper auth login`
2. Start host shell and press `Ctrl+\` then `s` to share.
3. Note `sessionId` from `wrapper status`.
4. From another terminal: `wrapper attach --relay --id <sessionId>`
5. Run commands, verify output, detach (`Ctrl+\` then `d`), then unshare (`Ctrl+\` then `u`).

## Operational checklist

- Deploy relay only from `apps/relay/fly.toml`.
- Keep `RELAY_CONVEX_URL` secret configured in Fly.
- Verify app health after deploy:
  - `fly status --app <app-name>`
  - `fly machine list --app <app-name>`
  - `RELAY_URL=\"https://<app-name>.fly.dev\" bun run --cwd apps/relay smoke`

## Fly dashboard: Pending Sync

`Pending Sync` usually means machine state is converging toward the latest release.
With `min_machines_running = 0` and `auto_stop_machines = \"stop\"`, machines can be
stopped while still being healthy for scale-to-zero operation.

If you see `Pending Sync`, run:

```bash
fly releases --app <app-name>
fly machine list --app <app-name>
fly status --app <app-name>
fly logs --app <app-name>
```

If release is complete and all machines are on the same image/version, the app is
typically in a good state even when dashboard sync lags.
