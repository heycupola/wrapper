# `@repo/backend`

Convex backend for Wrapper.

This package owns authenticated APIs for session lifecycle and device auth
integration used by the CLI.

## Current schema

- `hostSession`
  - `sessionId`, `ownerUserId`, `shell`, `cwd`
  - `port`, `hostPid`, `shared`
  - `relayState`, `relayLastChangedAt`
  - `status` (`active` or `closed`)
  - `createdAt`, `updatedAt`, `lastHeartbeatAt`, `closedAt`, `closeReason`
- `relayTicket`
  - `tokenHash`, `sessionId`, `role`, `userId`
  - `createdAt`, `expiresAt`, `usedAt`

## Current handlers

`convex/session.ts`:

- `open` - create or re-open host session (owner-only)
- `heartbeat` - update liveness and share/port state (owner-only)
- `close` - close host session (owner-only)
- `listActive` - list active sessions for authenticated owner
- `authorizeAttach` - allow attach only if caller is owner or session is shared
- `markStaleIfTimedOut` (internal) - scheduler task that auto-closes stale active sessions
- `setRelayState` - owner-only relay presence/state sync (`offline/connecting/online/error`)

`convex/deviceAuth.ts`:

- device authorization flow wrappers around Better Auth component

`convex/relay.ts`:

- `issueHostTicket` - owner-only short-lived ticket for host relay socket
- `issueViewerTicket` - shared/owner-allowed short-lived ticket for viewer socket
- `consumeTicket` - single-use ticket consumption for relay handshake
- `cleanupTicket` (internal) - scheduled cleanup of used/expired ticket rows

## Auth model

- Public handlers use `protectedQuery` / `protectedMutation` from
  `convex/lib/middleware.ts`.
- Identity is required for all session lifecycle operations.
- Errors are normalized through `convex/lib/errors.ts` and
  `convex/lib/types.ts`.
- Session liveness uses heartbeat timeout. Missing heartbeats trigger scheduler
  cleanup and close with `closeReason: "stale_timeout"`.

## Session timeout config

- `WRAPPER_SESSION_STALE_AFTER_MS` - heartbeat timeout window (default `60000`)
- `WRAPPER_SESSION_STALE_GRACE_MS` - scheduler grace window (default `10000`)

Total stale close delay is:

`WRAPPER_SESSION_STALE_AFTER_MS + WRAPPER_SESSION_STALE_GRACE_MS`

## Relay ticket config

- `WRAPPER_RELAY_HOST_TICKET_TTL_MS` - host ticket TTL (default `30000`)
- `WRAPPER_RELAY_VIEWER_TICKET_TTL_MS` - viewer ticket TTL (default `60000`)

## Dev commands

From monorepo root:

```bash
bunx tsc --noEmit -p packages/backend/tsconfig.json
bunx oxlint packages/backend/convex
cd packages/backend && bunx convex codegen
bun test packages/backend/tests
```

## Smoke checklist

1. `wrapper auth login`
2. Start a wrapped shell (`wrapper shell-host` or normal wrapped terminal)
3. `wrapper attach --id <sessionId>`
4. Detach viewer (`Ctrl+\`, then `d`)
5. Exit host shell and verify session closes
6. Kill host process without close and verify stale timeout auto-closes session
