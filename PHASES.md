# Wrapper phase ledger

This file tracks implementation status against the previously agreed Wrapper
delivery phases.

## Current status

## Phase 1 - Local PTY + attach (done)

Implemented:

- PTY lifecycle and shell wrapping
- local WebSocket server
- attach client flow
- local session registry and status command

Evidence:

- `apps/cli/commands/shell-host.ts`
- `apps/cli/server/local.ts`
- `apps/cli/client/attach-client.ts`
- `apps/cli/registry/sessions.ts`

## Phase 2 - Relay + auth + routing (not started)

Current state:

- env placeholders exist (`WRAPPER_RELAY_URL`, `WRAPPER_AUTH_ORIGIN`)
- share/unshare currently toggles local state only

Missing:

- relay transport integration
- Better Auth-backed identity verification
- backend session ownership and routing checks
- attach authorization across devices

## Phase 3 - iOS + push (not started)

Missing:

- iOS client implementation
- push token registration
- APNs event pipeline

## Phase 4 - Shell hook + setup UX (mostly done)

Implemented:

- install/uninstall/init shell hook workflow
- rc patch management
- prefix command UX in host/viewer

Partial:

- share/unshare still local until Phase 2 is implemented

## Phase 5 - Notification intelligence (not started)

Missing:

- backend notification policy engine
- signal classification and dedupe strategy
- context-aware push behavior

## Next milestone order

1. Complete docs-first learning track (`apps/cli` and `packages/backend`)
2. Safe redundancy cleanup
3. Phase 2 implementation (relay + auth + routing)
4. Phase 3 mobile + push
5. Phase 4 finalization of real share state
6. Phase 5 intelligence layer
