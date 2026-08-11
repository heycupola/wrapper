# Security Policy

Wrapper provides access to live terminal sessions, so vulnerabilities must be
reported privately before public disclosure.

## Report a vulnerability

Do not open a public issue or pull request for a suspected security problem.
Use the [hosted security-reporting instructions](https://wrapper.sh/support#security),
email [can@relic.so](mailto:can@relic.so) (Cupola Labs security), or submit a
[private GitHub security advisory](https://github.com/heycupola/wrapper/security/advisories/new)
while signed in to GitHub.

Include:

- affected version and platform
- impact and attack prerequisites
- minimal reproduction steps using test data
- logs with tokens, share codes, paths, and terminal content removed
- a safe proof of concept, if available

Do not access another user's terminal, retain terminal data, or disrupt
production while investigating. We will acknowledge valid reports as soon as
practical and coordinate disclosure after affected users are protected.

## Security boundaries

- A session is local and owner-only until the host explicitly shares it.
- Non-owner relay viewers need the session id and share code.
- Every accepted viewer can read and control the shared shell.
- P2P traffic is encrypted between peers and exposes peer IP addresses.
- Relay fallback is encrypted in transit, but the relay processes terminal
  traffic after TLS termination.
- Processes running as the same operating-system user, and root/administrator,
  are inside the local trust boundary.

See the [Privacy Policy](https://wrapper.sh/privacy-policy) for the complete data
flow.
