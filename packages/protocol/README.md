# `@repo/protocol`

The single source of truth for the wire protocol spoken between every Wrapper
component:

```
wrapper shell-host  ◄── ws ──►  wrapper attach   (local, same machine)
        ▲                              ▲
        │                              │
        └────────── ws ────────── relay service ◄── ws ── remote attach / mobile app
```

All messages are JSON-encoded and validated with Zod. New frames emit
`protocolVersion: 1`; unversioned v0 frames remain readable for compatibility
with clients released before mobile.

Terminal traffic can travel over the relay WebSocket or, once negotiated, a
direct WebRTC data channel. The `signal` message carries the WebRTC offer/answer/
ICE payloads (relayed host↔viewer) used to establish that direct path.

## Exports

| Symbol                                                                                                                                                              | Where        | Notes                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------- |
| `WrapperMessage`, `WrapperMessageSchema`                                                                                                                            | `./messages` | The discriminated union               |
| `InputMessage`, `OutputMessage`, `ResizeMessage`, `AttachMessage`, `DetachMessage`, `SessionOpenedMessage`, `SessionClosedMessage`, `ErrorMessage`, `SignalMessage` | `./messages` | Individual schemas + types            |
| `SessionId`, `SessionStatus`, `TerminalSize`                                                                                                                        | `./session`  | Shared scalar types                   |
| `parseMessage(raw)`, `encodeMessage(msg)`                                                                                                                           | `./codec`    | The only places JSON gets touched     |
| `createSessionId()`                                                                                                                                                 | `./id`       | Crockford-like 12 char id, no I/L/O/U |
| `PROTOCOL_VERSION`, payload limit constants                                                                                                                         | `./messages` | Mobile compatibility and DoS limits   |

## Design notes

- **JSON for now.** A binary codec (MessagePack / CBOR) is a single-file swap
  in `codec.ts` once profiling shows it matters.
- **`parseMessage` returns `null` on failure.** Callers decide whether to drop,
  log, or send an `error` message back to the peer. We do not throw.
- **Frames are bounded before parsing.** Raw frames, terminal data, errors, and
  WebRTC signals have explicit limits to protect the relay and clients.
- **Errors are first-class.** The `error` message lets the host tell a client
  about a malformed payload without dropping the connection.
- **Direction is documented in `messages.ts`.** Some messages are
  client→server (input/resize/attach/detach), others server→client (output,
  session.opened, session.closed, error). Misdirected messages are silently
  ignored by the receiver.
