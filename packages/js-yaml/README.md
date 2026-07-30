# Safe js-yaml compatibility shim

Mint includes both current ESM consumers and `front-matter@4`, which still calls
the removed js-yaml v3 `safeLoad` API. This private workspace package wraps
patched js-yaml 4.3 and restores only safe aliases:

- `safeLoad` to `load`
- `safeLoadAll` to `loadAll`
- `safeDump` to `dump`

js-yaml 4's load/dump APIs are safe by default. The shim prevents vulnerable
legacy versions from entering the lockfile while keeping Mint's old metadata
parser compatible.
