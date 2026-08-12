# Relay Operations Runbook

This runbook defines the minimum production operating standard for `apps/relay`.
Platform-wide ownership, incident severity, backups, and credential rotation are in
[`OPERATIONS.md`](../../OPERATIONS.md).

## Ownership

- The Fly production operator owns mitigation and rollback.
- The incident commander in `OPERATIONS.md` owns severity, coordination, and handoffs.
- Any indication that an unauthorized socket was accepted is SEV-1 and must be escalated to
  the security owner immediately.

## SLO targets

- Availability: 99.9% monthly (`/healthz` reachable)
- Unauthorized ticket rejection accuracy: 100% (no unauthorized connects accepted)
- Ticket consume failure rate: under 0.5% over 15 minutes

The availability source of truth must be an external monitor. The scheduled GitHub synthetic
workflow is a secondary detector. Apply the ticket failure threshold only when there are at
least 20 attempts in the window, and investigate individual failures for security impact
regardless of volume.

## Health and alerts

`fly.toml` configures a Fly service-level GET check against `/healthz` every 15 seconds. The
check controls routing but does not restart a failed Machine. The production relay currently
runs one always-warm Machine; there is no second Machine to receive traffic when that check
fails.

Inspect platform state:

```bash
fly checks list --app <app-name>
fly status --app <app-name>
fly machine list --app <app-name>
fly logs --app <app-name>
```

Configure these alert routes outside the repository:

- Production `/healthz`: page after two consecutive 5-minute probe failures; recover after
  two consecutive successes.
- Fly Machine unhealthy or unavailable for 2 minutes: page the relay operator.
- More than two unexpected Machine restarts in 10 minutes: page the relay operator.
- Ticket consume failure rate above 0.5% for 15 minutes with at least 20 attempts: SEV-2.
- Any smoke test that accepts an unauthenticated WebSocket: SEV-1.
- Development relay failure: maintenance alert after three consecutive failures, not a page.

Route production alerts to the primary and backup operators. Test the notification route
quarterly. Do not place relay tickets, share codes, session identifiers, or terminal content
in alert bodies.

## Deploy checklist

1. Confirm Fly app config:
   - `apps/relay/fly.toml` is current
   - `CONVEX_URL` (or `RELAY_CONVEX_URL`) secret is set on the target app
   - `fly config validate --config apps/relay/fly.toml` succeeds
2. Deploy: push to `dev`/`main` (`deploy-relay.yml`) or run `workflow_dispatch`.
   Dev -> `wrapper-relay-dev`, prod -> `wrapper-relay-prod` (see ENVIRONMENTS.md)
3. Verify post-deploy smoke:
   - `/healthz` reports `ok: true`
   - unauthenticated `/ws` closes with `4001` or `4003`
   - Fly reports the Machine and service check healthy
4. Watch logs and the external monitor for at least 10 minutes after production deploys.

The deploy workflow intentionally passes `--ha=false`. Do not remove it or increase the
Machine count without explicit budget approval; Fly HA can incur additional cost.

## Incident checks

If relay attach fails:

1. Declare the incident and confirm whether dev, production, or both are affected.
2. Run `fly status`, `fly machine list`, and `fly checks list` for the affected app.
3. Run `fly logs --app <app-name>` and look for boot failures, crashes, and `ticket rejected`.
   Redact identifiers before copying any output.
4. Confirm the Fly `CONVEX_URL` secret points to the matching deployment:
   - `wrapper-relay-dev` -> `https://sleek-echidna-539.convex.cloud`
   - `wrapper-relay-prod` -> `https://confident-fox-458.convex.cloud`
5. Run the smoke script:

```bash
RELAY_URL="https://<app>.fly.dev" bun run --cwd apps/relay smoke
```

6. If health succeeds but valid tickets fail, inspect Convex health and recent backend or
   secret changes. Do not weaken ticket validation to restore service.
7. If the Machine or health check is bad after a deploy, roll back. Because there is one
   Machine, prioritize a known-good rollback over prolonged in-place debugging.

## Rollback

1. List releases:

```bash
fly releases --app <app-name>
```

2. Roll back to previous stable image:

```bash
fly deploy --image <image-ref> --app <app-name>
```

3. Re-run the smoke check, verify Fly health, and monitor logs and external checks for
   10 minutes.
4. Record the bad and restored image references in the incident record.

## Manual synthetic verification

Run all canonical page and relay probes:

```bash
gh workflow run synthetic-health.yml --ref dev
gh run list --workflow synthetic-health.yml --limit 5
```

This is useful after DNS, TLS, Fly, Convex, legal-page, or documentation changes. GitHub
scheduled workflows are best-effort and are not a substitute for the external SLO monitor.
