# `@repo/logger`

Tagged logging + opt-in PostHog telemetry, used by the Wrapper CLI and any
future workspace packages that need structured output.

The package is a near-verbatim port of the Relic logger and deliberately
keeps the same shape: the same env vars (renamed `RELIC_*` to `WRAPPER_*`),
the same semantics, and the same Consola backbone, so an engineer who has worked on
either codebase sees the same surface.

## Usage

```ts
import { initLogger, createLogger, trackEvent, trackError } from "@repo/logger";

await initLogger();

const log = createLogger("cli");
log.info("Starting up");
log.debug("Detailed info");

trackEvent("session_started", { shell: "zsh" });
trackError("shell-host", err, { sessionId: "abc123" });
```

## Exports

### Core

| Export              | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `initLogger()`      | Loads config, sets up transports, registers shutdown hook |
| `createLogger(tag)` | Tagged Consola logger                                     |

### Telemetry

| Export                                | Description                              |
| ------------------------------------- | ---------------------------------------- |
| `trackEvent(event, properties?)`      | Send to PostHog and mirror as a log line |
| `trackError(source, error, context?)` | Convenience wrapper around `trackEvent`  |
| `flushTelemetry()`                    | Force-flush the PostHog client           |

### Telemetry preferences

| Export                             | Description                         |
| ---------------------------------- | ----------------------------------- |
| `saveTelemetryPreference(enabled)` | Persist consent in `telemetry.json` |
| `getTelemetryPreference()`         | Read consent (`null` on first run)  |
| `isFirstRun()`                     | Convenience for the consent prompt  |

### Paths

| Export           | Description                                                           |
| ---------------- | --------------------------------------------------------------------- |
| `getConfigDir()` | Config directory (`<config>/wrapper`, or `wrapper-dev` in dev mode)   |
| `getLogsDir()`   | Logs directory (`<state>/wrapper/logs`, or `wrapper-dev` in dev mode) |

## Behaviour matrix

| Mode                   | Console output        | File transport | Telemetry               |
| ---------------------- | --------------------- | -------------- | ----------------------- |
| Default (prod)         | off                   | yes            | enabled (after consent) |
| `NODE_ENV!=production` | yes (Consola colours) | yes            | disabled                |
| `CI=…` (any value)     | off                   | yes            | disabled                |

## Log files

| Mode | File                                 |
| ---- | ------------------------------------ |
| Dev  | `<state>/wrapper-dev/logs/debug.log` |
| Prod | `<state>/wrapper/logs/wrapper.log`   |

Override with `WRAPPER_LOG_FILE`.

Format: `[ISO timestamp] [LEVEL] [tag] message`

## Telemetry

Opt-in PostHog analytics, routed through `https://telemetry.wrapper.sh`
(a reverse proxy in front of `us.i.posthog.com`).

Telemetry is enabled when **all** are true:

- `WRAPPER_TELEMETRY` is not `"false"`
- Not in CI
- Not in dev mode
- Stored preference is `true` (default after the user opts in)

Each event includes `platform`, `arch`, and `node_version`.

Preference lives at `<config>/wrapper/telemetry.json` (or
`wrapper-dev/telemetry.json` in dev mode).

## Environment variables

| Variable                | Description                                         | Default                        |
| ----------------------- | --------------------------------------------------- | ------------------------------ |
| `WRAPPER_LOG`           | Log level (`debug`, `info`, `warn`, `error`, `off`) | Dev: `info`, Prod: `warn`      |
| `WRAPPER_LOG_FILE`      | Override the log file path                          | platform default               |
| `WRAPPER_TELEMETRY`     | `"false"` disables telemetry                        | enabled                        |
| `WRAPPER_POSTHOG_KEY`   | PostHog project key                                 | empty (telemetry off)          |
| `WRAPPER_TELEMETRY_URL` | Proxy host                                          | `https://telemetry.wrapper.sh` |
| `NODE_ENV`              | `production` disables dev mode; others are dev      | unset (treated as dev)         |
| `CI`                    | Any value enables CI mode                           | unset                          |

## Dev workflow

```sh
bun run log:watch    # tail the active log file
```
