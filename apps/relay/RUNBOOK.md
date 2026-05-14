# Relay Operations Runbook

This runbook defines the minimum production operating standard for `apps/relay`.

## SLO targets

- Availability: 99.9% monthly (`/healthz` reachable)
- Unauthorized ticket rejection accuracy: 100% (no unauthorized connects accepted)
- Ticket consume failure rate: under 0.5% over 15 minutes

## Deploy checklist

1. Confirm Fly app config:
   - `apps/relay/fly.toml` is current
   - `RELAY_CONVEX_URL` secret is set
2. Trigger deploy workflow (`fly-deploy.yml`)
3. Verify post-deploy smoke:
   - `/healthz` reports `ok: true`
   - unauthenticated `/ws` closes with `4001` or `4003`

## Incident checks

If relay attach fails:

1. `fly logs --app <app-name>` for ticket consume errors
2. Confirm Convex env and relay URL alignment
3. Run smoke script:

```bash
RELAY_URL="https://<app>.fly.dev" bun run --cwd apps/relay smoke
```

## Rollback

1. List releases:

```bash
fly releases --app <app-name>
```

2. Roll back to previous stable image:

```bash
fly deploy --image <image-ref> --app <app-name>
```

3. Re-run smoke and monitor logs for 10 minutes.
