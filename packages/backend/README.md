# `@repo/backend`

Convex backend for Wrapper.

This package owns the authenticated APIs used by the CLI and the web app:
user authentication (Better Auth), session lifecycle, relay join tickets,
onboarding state, and billing (Autumn). It is the single source of truth for
who may attach to which session.

## Data model (`convex/schema.ts`)

- `hostSession`
  - `sessionId`, `ownerUserId`, `shell`, `cwd`
  - `port`, `hostPid`, `shared`
  - `relayState`, `relayLastChangedAt`
  - `status` (`active` or `closed`)
  - `createdAt`, `updatedAt`, `lastHeartbeatAt`, `closedAt`, `closeReason`
- `relayTicket`
  - `tokenHash` (only the hash of the ticket is stored, never the token itself)
  - `sessionId`, `role` (`host` or `viewer`), `userId`
  - `createdAt`, `expiresAt`, `usedAt` (single-use enforcement)
- `onboarding`
  - `userId`
  - `completedProfile`, `connectedCli`, `sharedFirstSession`
  - `status` (`in_progress` or `completed`)
  - `source`, `sourceOther`, `teamSize`
  - `createdAt`, `updatedAt`, `completedAt`
- `rateLimit`
  - fixed-window counters keyed by action, used to throttle unauthenticated
    endpoints such as device-code issuance

## Handlers

`convex/session.ts`:

- `open`: create or re-open a host session (owner-only)
- `heartbeat`: update liveness and share/port state (owner-only)
- `close`: close a host session (owner-only)
- `listActive`: list active sessions for the authenticated owner
- `authorizeAttach`: allow attach only if the caller is the owner or the session
  is shared
- `setShareCode`: owner-only; start sharing and store the SHA-256 of the access
  code, or stop sharing and clear it (revoking outstanding access)
- `markStaleIfTimedOut` (internal): scheduler task that auto-closes stale active
  sessions
- `setRelayState`: owner-only relay presence sync (`offline`, `connecting`,
  `online`, `error`)

`convex/deviceAuth.ts` (wrappers around the Better Auth device flow):

- `requestDeviceCode`: issue a device and user code (rate limited per client and
  globally)
- `pollDeviceToken`: exchange a device code for a session token (globally rate
  limited; per-code pacing enforced by the Better Auth `interval`/`slow_down`
  contract)
- `getDeviceCodeInfo`: globally rate-limited mutation that looks up a pending
  code so the web page can show what is being approved
- `approveDeviceCode` / `denyDeviceCode`: authenticated approve or deny actions

`convex/relay.ts`:

- `issueHostTicket`: owner-only short-lived ticket for the host relay socket,
  gated by the Autumn sharing entitlement
- `issueViewerTicket` (action): short-lived ticket for a viewer socket. The owner is
  always allowed on their own devices. A non-owner must present the correct
  share code, and non-owner attempts are rate limited per user, per hashed target
  bucket, and globally to stop code guessing without exposing session existence
- `consumeTicket`: single-use consumption during the relay handshake, called by
  the relay itself without a user identity
- `cleanupTicket` (internal): scheduled cleanup of used and expired ticket rows

`convex/onboarding.ts`:

- `getState`: current onboarding progress for the authenticated user
- `completeStep`: update one onboarding checklist step
- `complete`: finalize onboarding and persist optional attribution data

`convex/billing.ts`:

- `createProCheckout`: create a Stripe checkout URL for the Pro plan through
  Autumn, used by both the CLI upgrade hint and the web upgrade button

`convex/auth.ts`:

- Better Auth configuration (Convex adapter, device authorization, bearer token
  exchange, social providers). See the auth model below.

## Auth model

- Public handlers use `protectedQuery` / `protectedMutation` from
  `convex/lib/middleware.ts`. Identity is required for every session lifecycle
  operation.
- Errors are normalized through `convex/lib/errors.ts` and `convex/lib/types.ts`.
- The `BETTER_AUTH_SECRET` is required in production. In development a known
  local secret is used. If the secret is missing outside development, the server
  falls back to an ephemeral per-instance secret so it fails closed (existing
  sessions stop validating) rather than starting with a predictable key.
- The CLI authenticates with the device authorization flow, stores a session
  token, then exchanges that token for a short-lived Convex JWT through the
  `bearer()` plugin before calling any Convex function. A long-running host
  re-mints the JWT from the stored session token before it expires, so hours-long
  sessions keep authenticating. See `apps/cli/util/convex-client.ts`.
- Session liveness uses a heartbeat timeout. Missing heartbeats trigger scheduler
  cleanup and close the session with `closeReason: "stale_timeout"`.

## Session access model

Access to a session is deliberately narrow:

- **Not shared:** owner only. Every lifecycle call (open, heartbeat, close,
  relay state, host ticket) rejects anyone who is not the owner.
- **Shared:** the owner runs `setShareCode`, which marks the session shared and
  stores only the SHA-256 of a secret code the host generates. To join, a
  non-owner must call `issueViewerTicket` with the matching code. Knowing the
  session id alone is not enough, and the owner can still join their own session
  from any device without a code.
- **Revocation:** unsharing (or closing) clears the code hash, and
  `consumeTicket` re-checks the shared state, so outstanding viewer tickets stop
  working the moment the owner unshares.
- **Anti-guessing:** non-owner `issueViewerTicket` calls are rate limited in a
  separate committed mutation before access validation. This prevents Convex
  transaction rollback from erasing failed-attempt counters.

Unknown, unshared, missing-code, and wrong-code sessions return the same access
denial so callers cannot use the API to discover another user's active session.

This is a capability model (possession of the code grants access), which suits
pair-prompting on a shared session. Note that every viewer who joins shares
control of the same shell (anyone connected can type). A per-join host approval
step could be layered on later if watch-only viewers are needed.

## Relay ticket security

- Tickets are random tokens. Only their hash is stored (`tokenHash`), so a
  database read never reveals a usable credential.
- Tickets are single-use (`usedAt`) and short-lived (`expiresAt`).
- On consumption the backend re-checks that the session still exists and is
  still shared, so unsharing immediately invalidates outstanding viewer tickets.

## Billing (Autumn)

- Relay sharing is gated by the `can_share_relay` feature on the Pro plan.
- Plans are defined as code in `autumn.config.ts` and pushed with `bunx atmn`.
- The entitlement check fails open on billing-provider errors so a billing
  outage cannot break the core sharing flow. This is a deliberate availability
  choice; it never grants access to another user's data.
- The gate can be disabled entirely with `WRAPPER_AUTUMN_RELAY_SHARE_FEATURE_ID`
  set to an empty value.

## Configuration

Session timeouts:

- `WRAPPER_SESSION_STALE_AFTER_MS`: heartbeat timeout window (default `60000`)
- `WRAPPER_SESSION_STALE_GRACE_MS`: scheduler grace window (default `10000`)

Total stale-close delay is
`WRAPPER_SESSION_STALE_AFTER_MS + WRAPPER_SESSION_STALE_GRACE_MS`.

Relay tickets:

- `WRAPPER_RELAY_HOST_TICKET_TTL_MS`: host ticket TTL (default `30000`)
- `WRAPPER_RELAY_VIEWER_TICKET_TTL_MS`: viewer ticket TTL (default `60000`)
- `WRAPPER_AUTUMN_RELAY_SHARE_FEATURE_ID`: Autumn entitlement checked before
  issuing a host relay ticket (default `can_share_relay`)

## Dev commands

From the monorepo root:

```bash
bunx tsc --noEmit -p packages/backend/tsconfig.json
bunx oxlint packages/backend/convex
cd packages/backend && bunx convex codegen
bun test packages/backend/tests
bun run --cwd packages/backend test:integration
```

## Smoke checklist

1. `wrapper auth login`
2. Start a wrapped shell (`wrapper shell-host` or a normal wrapped terminal)
3. `wrapper attach --id <sessionId>`
4. Detach the viewer (`Ctrl+\`, then `d`)
5. Exit the host shell and verify the session closes
6. Kill the host process without a clean close and verify the stale timeout
   auto-closes the session
