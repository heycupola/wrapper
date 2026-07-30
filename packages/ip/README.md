# Safe `ip` compatibility shim

`werift-ice@0.2.2` depends on the abandoned `ip@2.0.1`, which is affected by
GHSA-2p57-rm9w-gvfp. Wrapper provides this private workspace package at version
`2.1.0` so Werift receives only the API it uses, backed by maintained
`ipaddr.js`.

Implemented and tested compatibility methods:

- `isLoopback`
- `isV4Format` / `isV6Format`
- `toBuffer` / `toString`
- `isPrivate` / `isPublic`

Bun's audit resolver reports workspace packages by requested package name
without applying the workspace version to this advisory, so the root `audit`
script ignores that one advisory. The vulnerable registry implementation is not
installed; `bun.lock` must resolve `ip` to `workspace:packages/ip`.
