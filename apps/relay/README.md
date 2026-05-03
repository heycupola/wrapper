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
