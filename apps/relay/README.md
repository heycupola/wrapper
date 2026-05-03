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
