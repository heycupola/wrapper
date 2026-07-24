# `@repo/cli` - Wrapper CLI

Wrapper CLI is the runtime core of the product.

It wraps every interactive shell session and exposes that live session over a
local WebSocket endpoint so other clients can attach. It can also publish a
shared session through the relay for remote viewers, with an optional direct
WebRTC **P2P fast path** for lower latency (see
[`transport/README.md`](./transport/README.md)).

This README is a technical walkthrough so you can understand the system while
building.

## Core roles

- `shell-host` is the owner of a session.
- `attach` is a viewer/controller of an existing session.

The host process owns PTY lifecycle, local server, and registry state. Attach
clients are disposable.

## End-to-end architecture

```mermaid
flowchart TD
  terminal[TerminalEmulator]
  outerShell[OuterShellRc]
  shellHost[WrapperShellHost]
  pty[PtySession]
  wsServer[LocalWsServer127001]
  registry[SessionRegistry]
  attach[AttachClient]

  terminal --> outerShell
  outerShell -->|"exec wrapper shell-host"| shellHost
  shellHost --> pty
  shellHost --> wsServer
  shellHost --> registry
  attach --> wsServer
  wsServer --> pty
  pty --> wsServer
  wsServer --> attach
```

## Session sequence

```mermaid
sequenceDiagram
  participant user as UserTerminal
  participant host as wrapper_shell_host
  participant pty as PtySession
  participant ws as LocalWsServer
  participant viewer as wrapper_attach

  user->>host: start shell via rc hook
  host->>pty: spawn inner shell
  host->>ws: bind 127.0.0.1:port
  host->>host: register sessions.json
  viewer->>ws: connect
  ws-->>viewer: session.opened (+size)
  viewer->>ws: input/resize
  ws->>pty: write/resize
  pty-->>ws: output
  ws-->>viewer: output broadcast
  viewer->>ws: detach
  Note over host,pty: host session keeps running
  pty-->>host: exit
  host->>ws: session.closed + shutdown
```

## How `shell-host` actually works

`commands/shell-host.ts` orchestrates the full host lifecycle:

1. Creates a `sessionId`.
2. Starts `PtySession` (`pty/session.ts`).
3. Starts local server (`server/local.ts`).
4. Registers the session (`registry/sessions.ts`).
5. Starts in-process attach bridge (`client/attach-client.ts`) so the current
   terminal stays interactive.
6. Installs signal handlers and deterministic shutdown.
7. If authenticated, syncs session lifecycle to Convex:
   - host start -> `session:open`
   - periodic tick -> `session:heartbeat`
   - shutdown -> `session:close`
8. On `share`, it issues a relay host ticket and starts a relay bridge.

Important safety guards:

- `WRAPPER_WRAPPED=1` prevents recursive hook execution in inner shell.
- `WRAPPER_NESTING_GUARD=1` kills accidental nested `shell-host` loops.

## How `attach` works

`commands/attach.ts` does:

1. Resolve target session by `--id`, `--port`, or picker from registry.
2. Local path: run `session:authorizeAttach`, then connect to `ws://127.0.0.1:<port>`.
3. Relay path (`--relay` or no local match for `--id`): issue `relay:issueViewerTicket`
   (passing `--code` when joining someone else's session) and connect to
   `WRAPPER_RELAY_URL/ws?ticket=...`.
4. Bridge stdin/stdout via protocol messages.
5. Support detach without ending host session (`Ctrl+\` then `d`).

Detach semantics:

- Detach closes only the viewer socket.
- Host keeps running until inner shell exits.
- Authorization failures are normalized with actionable hints (login required,
  not shared, or session not active).

## Protocol path in local phase

Message types come from `@repo/protocol`.

Main message flow used by CLI:

- `session.opened`
- `input`
- `resize`
- `output`
- `session.closed`
- `error`

`server/local.ts` validates and routes these messages between clients and PTY.

## Transports: relay + direct P2P

Host and viewer are transport-agnostic, so they exchange `@repo/protocol` frames
through a small `Transport` interface (`transport/transport.ts`), so the wire can
be either:

- **Relay WebSocket** (`WebSocketTransport`), always used, and it also carries WebRTC
  signaling and is the fallback.
- **WebRTC data channel** (`WebRtcDataChannelTransport`), a direct P2P connection
  negotiated over the relay. It is **on by default** (opt out with
  `WRAPPER_P2P=0`). When it opens, session traffic flows directly (SSH-like
  latency); if ICE can't connect, the session transparently stays on the relay.

Full design, security model, and testing steps live in
[`transport/README.md`](./transport/README.md). P2P applies only to `--relay`
attaches; local `127.0.0.1` attaches are already direct. A direct connection
exposes each peer's IP to the other, so opt out if that matters for a session.

## Sharing and access

Sharing is capability-based, so only people you explicitly invite can join:

- Pressing `Ctrl+\` `s` marks the session shared and prints a **share code** plus
  the exact join command. The backend stores only the hash of that code.
- The owner can attach to their own session from any device with no code.
- Anyone else must pass the code:
  `wrapper attach --relay --id <sessionId> --code <code>`. Knowing the session id
  alone is not enough, and guessing is rate limited.
- Pressing `Ctrl+\` `u` (or ending the shell) revokes access immediately by
  clearing the stored code and shared flag.

Behaviors to know once viewers join:

- **Shared control:** every connected viewer can type into the same shell. This
  is intended for pair-prompting. There is no watch-only viewer mode yet.
- **Multiple viewers:** many viewers can attach to one session at once; host
  output is broadcast to all of them (and fanned out over each P2P channel).
- **Consensus resize:** the terminal is sized to the smallest connected viewer,
  so a small window shrinks everyone's view.
- **One host per session:** a second host connecting to the same session id
  replaces the first.

## Commands

### Install and hook management

```bash
wrapper install
wrapper install --all
wrapper install --shell=zsh,bash
wrapper uninstall
wrapper init <shell>
```

`install` writes a managed rc block:

```sh
if [ -z "$WRAPPER_WRAPPED" ] && [ -z "$WRAPPER_DISABLE" ]; then
  exec wrapper shell-host
fi
```

### Daily usage

```bash
wrapper auth login
wrapper auth whoami
wrapper auth logout
wrapper status
wrapper attach
wrapper attach --id <sessionId>
wrapper attach --port <port>
wrapper attach --relay --id <sessionId>
wrapper attach --relay --id <sessionId> --code <shareCode>
wrapper logs --follow
```

### Internal

```bash
wrapper shell-host
```

### Local development helper

```bash
bun run dev:host
```

## In-session prefix shortcuts

Inside host shell:

| Keys              | Action                    |
| ----------------- | ------------------------- |
| `Ctrl+\` `s`      | share + print share code  |
| `Ctrl+\` `u`      | unshare + revoke access   |
| `Ctrl+\` `?`      | status overlay            |
| `Ctrl+\` `Ctrl+\` | send literal control byte |
| `Ctrl+\` `Esc`    | cancel prefix mode        |

Inside attach viewer:

| Keys         | Action        |
| ------------ | ------------- |
| `Ctrl+\` `d` | detach viewer |
| `Ctrl+\` `?` | viewer status |

When shared and authenticated, `Ctrl+\` + `s` starts a relay bridge, prints a
share code, and enables remote attach with
`wrapper attach --relay --id <sessionId> --code <shareCode>`.

## Debugging workflow

### Verify host is alive

1. Open wrapped terminal (or run `wrapper shell-host` in dev).
2. Run `wrapper status` from another terminal.
3. Confirm `sessionId`, `pid`, and `port` appear.

### Verify attach path

1. Run `wrapper attach`.
2. Type commands and confirm host shell receives output.
3. Resize the attach terminal and confirm redraw behavior.

### If attach fails

- `wrapper logs --follow`
- verify session registry exists and includes live entry
- verify local port is reachable on `127.0.0.1`
- re-check rc hook installation is single and not duplicated

## Environment variables

| Variable                | Description                                  | Default                                      |
| ----------------------- | -------------------------------------------- | -------------------------------------------- |
| `NODE_ENV`              | runtime mode (`production` or dev)           | unset (treated as dev)                       |
| `CI`                    | enable CI mode                               | unset                                        |
| `WRAPPER_LOG`           | `debug/info/warn/error/off`                  | dev=`info`, prod=`warn`                      |
| `WRAPPER_LOG_FILE`      | override log file path                       | platform default                             |
| `WRAPPER_TELEMETRY`     | `"false"` disables telemetry                 | enabled after consent                        |
| `WRAPPER_POSTHOG_KEY`   | PostHog key                                  | empty                                        |
| `WRAPPER_TELEMETRY_URL` | telemetry endpoint                           | `https://telemetry.wrapper.sh`               |
| `WRAPPER_RELAY_URL`     | relay endpoint override                      | dev localhost, prod `wss://relay.wrapper.sh` |
| `WRAPPER_AUTH_ORIGIN`   | auth callback origin                         | dev localhost, prod `https://wrapper.sh`     |
| `WRAPPER_HUD`           | HUD (`on/off`)                               | `on`                                         |
| `WRAPPER_P2P`           | WebRTC P2P fast path; `0/false/off` opts out | on (relay is the fallback)                   |
| `WRAPPER_CONVEX_URL`    | Convex deployment URL for backend            | falls back to `CONVEX_URL` if set            |
| `WRAPPER_DISABLE`       | disable hook in one terminal                 | unset                                        |
| `WRAPPER_WRAPPED`       | set by `shell-host` in inner shell           | unset                                        |

`NODE_ENV=development` redirects state into `wrapper-dev`, uses localhost defaults, and
mirrors logs to stderr for easier local debugging.

## Source map

```text
index.ts                       commander entrypoint
commands/
  shell-host.ts                host runtime orchestration
  attach.ts                    viewer command
  auth.ts                      device auth login/whoami/logout
  install.ts                   rc install flow
  uninstall.ts                 rc uninstall flow
  init.ts                      snippet generator
  status.ts                    list live sessions
  logs.ts                      tail log file
client/
  attach-client.ts             transport-agnostic viewer + tty bridge (WS/P2P)
server/
  local.ts                     local ws broker
pty/
  session.ts                   pty lifecycle + replay buffer
registry/
  sessions.ts                  local session metadata
relay/
  host-bridge.ts               host relay bridge; per-viewer P2P negotiation
transport/
  transport.ts                 Transport interface + WebSocketTransport
  webrtc.ts                    WebRTC P2P transport (werift, opt-in)
  README.md                    transport + P2P design/security/testing
shell/
  detect.ts                    shell detection
  rc-edit.ts                   managed rc patcher
  prefix.ts                    prefix parser
util/
  env.ts                       runtime env flags and defaults
  paths.ts                     config/state path helpers
  auth-session.ts              stored auth token + Convex URL resolution
  convex-client.ts             shared authenticated Convex client helper
  feedback.ts                  title/inline/bell notifications
  signals.ts                   signal shutdown helper
```

## Runtime requirements

- Bun >= 1.3.5
- POSIX shells (macOS/Linux)

## Why `@repo/terminal` instead of node-pty

`@repo/terminal` keeps PTY lifecycle in Bun-native code while using the
committed `wrapper-pty-helper` binaries to provide real controlling terminals
on macOS and Linux.
