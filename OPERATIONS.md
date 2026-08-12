# Production Operations

This document is the control-plane runbook for Wrapper's hosted services. Service-specific
relay commands live in [`apps/relay/RUNBOOK.md`](./apps/relay/RUNBOOK.md), and environment
names and deployment paths live in [`ENVIRONMENTS.md`](./ENVIRONMENTS.md).

## Ownership and incident response

Cupola Labs, LLC is accountable for production operation. Keep the private contact roster
outside this repository and ensure at least two people have the access needed to respond.

| Responsibility                    | Owner                                                        |
| --------------------------------- | ------------------------------------------------------------ |
| Incident commander                | First production-enabled maintainer to acknowledge the alert |
| Backend, auth, and data           | Convex production operator                                   |
| Relay                             | Fly production operator                                      |
| Web and legal pages               | Vercel production operator                                   |
| Documentation                     | Mintlify production operator                                 |
| Security and disclosure           | Cupola Labs security (`can@relic.so`)                        |
| Communications and backup command | Second production-enabled maintainer                         |

The incident commander owns coordination, timestamps, severity, and handoffs even when
another operator performs the mitigation. Do not put credentials, terminal contents, user
data, OAuth codes, relay tickets, or share codes in incident notes.

### Severity and response

- **SEV-1:** active compromise, cross-user access, destructive data loss, or all production
  access paths unavailable. Acknowledge immediately, stop the unsafe path, and page the
  security owner.
- **SEV-2:** a production component is unavailable or materially degraded without confirmed
  compromise. Acknowledge within 15 minutes during staffed hours and begin mitigation.
- **SEV-3:** development failure, partial degradation, or an operational warning with no
  current user impact. Create a tracked maintenance item.

For SEV-1 and SEV-2:

1. Open a private incident record with UTC start time, severity, commander, and affected
   environments.
2. Preserve redacted logs and deployment identifiers. Never copy production data into a
   public issue.
3. Prefer reversible containment: disable the affected integration, revoke a compromised
   credential, or roll back to the last known-good release.
4. Run the relevant health and smoke checks before declaring recovery.
5. Record detection time, mitigation time, recovery time, user impact, and follow-up owners.
6. Complete a blameless review within five business days for SEV-1 and SEV-2 incidents.

Suspected vulnerabilities follow [`SECURITY.md`](./SECURITY.md). Do not discuss a security
incident publicly until the security owner approves disclosure.

## Service levels and monitoring

Use a trailing 30-day window. Planned maintenance still consumes the error budget unless it
is fully outside the published service contract.

| Surface              | Production objective | Successful probe                                                     |
| -------------------- | -------------------- | -------------------------------------------------------------------- |
| Web and legal pages  | 99.9% availability   | HTTP 200, non-empty HTML                                             |
| Public documentation | 99.9% availability   | HTTP 200, non-empty HTML                                             |
| Relay                | 99.9% availability   | `/healthz` returns HTTP 200 and `{ "ok": true, "service": "relay" }` |

99.9% monthly availability permits about 43 minutes of unavailability in a 30-day month.
Development endpoints have no user-facing SLO, but they must stay healthy enough to detect
configuration drift before promotion.

### Repository synthetic checks

`.github/workflows/synthetic-health.yml` runs at minutes 17 and 47 of every hour and can be
run manually. It checks:

- `https://www.wrapper.sh/`
- `https://www.wrapper.sh/privacy-policy`
- `https://www.wrapper.sh/terms-of-service`
- `https://docs.wrapper.sh/`
- `https://wrapper-relay-dev.fly.dev/healthz`
- `https://wrapper-relay-prod.fly.dev/healthz`

Each request has a 5-second connection timeout, a 15-second total attempt timeout, a 5 MiB
response cap, one bounded retry, and a five-minute job timeout. The step continues after
individual failures, adds an annotation and summary row for every failed target, then fails
the run.

Run and inspect it with:

```bash
gh workflow run synthetic-health.yml --ref dev
gh run list --workflow synthetic-health.yml --limit 5
```

GitHub schedules are best-effort and can be delayed or disabled after repository inactivity.
This workflow is a secondary detector, not the SLO source of truth.

### External alert configuration

Configure an uptime monitor already approved by Cupola Labs; do not add a paid service only
for these checks.

1. Probe the four production page URLs and production relay every 5 minutes with a 10-second
   timeout. Apply the same content and final HTTPS host assertions as the repository workflow.
2. Alert the incident commander after two consecutive production failures and send recovery
   only after two consecutive successes.
3. Probe the development relay every 5 minutes. Create a SEV-3 maintenance alert after three
   consecutive failures; do not page for development alone.
4. Alert at 14 days before TLS certificate expiry.
5. Route production failure and recovery notifications to both the primary and backup
   operator. Verify the route quarterly with a controlled test.
6. Use the monitor's 30-day availability report for the SLO review. Investigate any source
   disagreement with GitHub or Fly rather than averaging the results.

For relay-specific logs, Fly health checks, ticket-consume signals, and escalation thresholds,
see [`apps/relay/RUNBOOK.md`](./apps/relay/RUNBOOK.md).

## Convex backup and restore

### Policy

- **RPO target:** 24 hours.
- **RTO target:** 4 hours after the restore decision.
- Export production data and file storage at least daily.
- Keep 7 daily, 4 weekly, and 12 monthly encrypted snapshots, subject to the published data
  retention policy.
- Store snapshots and checksums in access-controlled encrypted storage outside the repository
  and outside the primary Convex account.
- Maintain a privacy-approved reconciliation record for account deletions and access
  revocations newer than each retained snapshot.
- Test a restore into an isolated deployment at least quarterly and after a material schema or
  authentication migration.

Convex exports contain sensitive account, authentication, device, and session data. Never
commit them, attach them to a GitHub issue, or use a real snapshot on a developer laptop
without an approved incident or drill.

### Create and verify an export

Run from a trusted operator machine. `--prod` is mandatory; without it the CLI defaults to a
development deployment.

```bash
cd packages/backend
umask 077

backup_dir="$HOME/wrapper-backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
snapshot="$backup_dir/wrapper-prod-$timestamp.zip"
mkdir -p "$backup_dir"

bunx convex export --prod --include-file-storage --path "$snapshot"
unzip -t "$snapshot"
(
  cd "$backup_dir"
  shasum -a 256 "$(basename "$snapshot")" > "$(basename "$snapshot").sha256"
)
```

Copy the ZIP and checksum to encrypted backup storage, verify the stored copy's checksum, and
remove the local copy according to the workstation's secure-data policy. Record only the
timestamp, Convex deployment name, application revision, CLI version, checksum, storage
location, and operator in the private backup register.

If the current Convex plan already includes managed backups, retain them as a second recovery
path. A dashboard backup does not replace the independent export or restore drill.

### Quarterly restore drill

1. Select a retained snapshot and download it with its checksum to the same directory on a
   trusted machine. Verify both:

   ```bash
   snapshot="<verified-snapshot.zip>"
   (
     cd "$(dirname "$snapshot")"
     shasum -a 256 -c "$(basename "$snapshot").sha256"
     unzip -t "$(basename "$snapshot")"
   )
   ```

2. Provision a disposable Convex project or deployment with no production integrations,
   production OAuth callbacks, email delivery, billing webhooks, or user traffic.
3. Check out the exact application revision recorded with the snapshot. Deploy that revision
   using a temporary deploy key scoped to the drill deployment.
4. Set the target explicitly and import:

   ```bash
   cd packages/backend
   drill_deployment="<disposable-deployment-name>"
   snapshot="<verified-snapshot.zip>"

   bunx convex import --deployment "$drill_deployment" --replace-all "$snapshot"
   ```

   `--replace-all` is destructive. Before confirming, verify in the Convex dashboard that the
   target is disposable and is not `confident-fox-458` or `sleek-echidna-539`.

5. Validate representative table counts and relationships, Better Auth records, file-storage
   objects, and read-only application flows. Do not send real notifications or run billing.
6. Record elapsed restore time, validation results, gaps, and follow-up owners. Destroy the
   drill deployment and securely delete local snapshot copies.

### Production restore

A production import requires a SEV-1 incident commander and a second operator to verify the
target and snapshot. First contain writes and take a fresh safety export when the deployment
is readable. Verify the selected snapshot, rehearse the command against an isolated
deployment, and deploy the backend revision whose schema matches the snapshot before importing.

For a full rollback, use `bunx convex import --prod --replace-all <snapshot.zip>` only after
both operators confirm the production target and accept deletion of data absent from the
snapshot. Do not pass `--yes`; the interactive destructive confirmation is an intentional
safety gate. Before reopening traffic, replay account-deletion requests and credential
revocations recorded after the snapshot so the restore cannot resurrect deleted access.
Validate auth and core data flows, rotate any credentials implicated in the incident, and
monitor for at least 30 minutes.

## Secret and client-secret rotation

Maintain a private register containing the credential owner, scope, consumers, creation date,
maximum age, next rotation, and revocation evidence. The register must contain metadata only,
never secret values.

| Credential                           | Maximum age or trigger                         | Validation before revocation                      |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------------------- |
| Apple client-secret JWT              | 150 days, at least 30 days before expiry       | Apple login in the matching environment           |
| Apple Sign in with Apple key (`.p8`) | Annual review or immediate compromise response | New key signs a working JWT                       |
| GitHub/Google OAuth client secret    | 180 days or provider warning                   | Login and callback in dev, then production        |
| Convex deploy key                    | 180 days or maintainer/access change           | Manual dry run or deployment for that environment |
| Fly deploy token                     | 180 days or maintainer/access change           | Deploy and smoke the matching relay               |
| Autumn secret key                    | 180 days or billing access change              | Read-only sandbox/production verification         |
| `BETTER_AUTH_SECRET`                 | Annual review or immediate compromise response | Planned reauthentication and auth smoke           |
| Homebrew tap token                   | 180 days or release access change              | Dry-run release metadata access                   |

Use this sequence unless a credential is already compromised:

1. Create a replacement with the narrowest available scope. Keep the old credential active.
2. Update and verify development first.
3. Update production, run the relevant login, deploy, billing, or relay smoke check, and watch
   errors.
4. Revoke the old credential.
5. Record dates, operator, affected environments, and validation evidence without recording
   the value.

For a suspected compromise, revoke first, preserve redacted audit evidence, rotate downstream
credentials that could have been reached, and follow the incident process.

Apple's client-secret JWT is generated and installed using the non-history pipeline in
[`ENVIRONMENTS.md`](./ENVIRONMENTS.md#one-time-setup-checklist). Keep the `.p8` file outside
the repository. Replacing `BETTER_AUTH_SECRET` can invalidate active sessions and must be a
planned maintenance event unless immediate containment is required.

## GitHub branch protection assessment

Assessment on 2026-08-12:

- the repository is public and its default branch is `dev`;
- `dev` and `main` have no branch protection rules; and
- the repository has no rulesets.

Create one active repository ruleset named `protect-dev-and-main` with these exact settings:

- **Target:** branch names `refs/heads/dev` and `refs/heads/main`.
- **Bypass list:** empty. Administrators remain able to edit the ruleset for a documented
  emergency, but routine merges must not bypass it.
- **Restrict deletions:** enabled.
- **Block force pushes:** enabled.
- **Require linear history:** enabled.
- **Require a pull request before merging:** enabled.
  - Required approvals: `1`.
  - Dismiss stale approvals on new commits: enabled.
  - Require approval of the most recent reviewable push: enabled.
  - Require conversation resolution: enabled.
  - Require Code Owner review: disabled until a real multi-owner `CODEOWNERS` file exists.
  - Allowed merge methods: squash and rebase only.
- **Require status checks to pass:** enabled.
  - Require branches to be up to date: enabled.
  - Required check: `Quality gate (audit/lint/format/types)`.
  - Required check: `Full lane (unit + e2e + relay smoke)`.
- **Require deployments, merge queue, signed commits, and code scanning results:** disabled
  until their workflows and operator process are proven not to deadlock changes.

Leave all unlisted rules disabled.

Run CI on a pull request first so GitHub can select the exact check names. Do not require
`Synthetic health`, `Deploy relay`, or `Deploy Convex`: synthetic health has no pull-request
trigger, and the deploy workflows are path-filtered, so requiring them would leave unrelated
pull requests permanently pending.

Also restrict the GitHub `dev` environment to deployments from `dev` and the `production`
environment to deployments from `main`. Add a production reviewer and disable self-review
after a second production-enabled maintainer is assigned.

## External setup still required

Repository files cannot safely perform these account-level operations:

1. Assign a second incident operator and maintain the private contact and credential registers.
2. Create the repository ruleset and GitHub environment restrictions described above.
3. Configure failure notifications for the scheduled GitHub workflow.
4. Configure the external uptime checks and primary/backup notification routes.
5. Select encrypted backup storage, define the deletion/revocation reconciliation source,
   take the first production export, and complete the first isolated restore drill.
6. Create rotation reminders and execute each provider's replacement-and-revoke sequence.

Fly high availability is intentionally not enabled. The relay remains a single always-warm
Machine because adding Machines can incur cost; revisit HA only with explicit budget approval.
