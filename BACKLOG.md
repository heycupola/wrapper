# Wrapper MVP backlog

This backlog mirrors the current phase ledger and prioritizes execution for an
MVP that proves remote terminal access safely.

## Priority 0 - docs and cleanup (done in this pass)

- Expand `apps/cli/README.md` into a system walkthrough.
- Add `packages/backend/README.md` as Convex backend blueprint.
- Create `PHASES.md` as implementation status ledger.
- Remove safe redundant items:
  - `packages/ui/card.tsx`
  - `packages/ui/code.tsx`
  - `packages/typescript-config/convex.json`
  - unused `@repo/ui` dependency from `apps/web/package.json`

## Priority 1 - Phase 2 (relay + auth + routing)

1. Introduce relay service package/app and host outbound connection path.
2. Integrate Better Auth identity verification in backend.
3. Implement backend session lifecycle APIs:
   - open, heartbeat, share, unshare, close, listActive.
4. Add routing metadata for host/viewer attachment authorization.
5. Wire `share/unshare` in CLI to real backend + relay behavior.

## Priority 2 - Phase 3 (iOS + push)

1. Implement iOS client protocol compatibility with `@repo/protocol`.
2. Register push tokens and trigger APNs events for core session changes.
3. Add attach from mobile against authenticated relay routes.

## Priority 3 - Phase 4 completion

1. Refine setup UX around install/uninstall/status for non-technical users.
2. Validate shell coverage and edge cases for zsh/bash/fish in real-world configs.

## Priority 4 - Phase 5 intelligence

1. Add notification policy engine (dedupe, suppression, priority).
2. Add context-aware push behavior from backend event signals.
3. Add ops metrics dashboard for attach success and disconnect quality.
