# `@repo/terminal`

Internal package: a small PTY runtime built on `bun:ffi` + a tiny C
helper. We use it because Bun.Terminal currently bypasses the kernel's
line discipline (Bun#25779), which means Ctrl+C / Ctrl+Z / Ctrl+\\
never reach the shell. `@repo/terminal` produces a real controlling
terminal, identical in behaviour to `node-pty`, but in pure Bun.

## API

```ts
import { Terminal } from "@repo/terminal";

const term = new Terminal({
  cmd: ["/bin/zsh", "-l"],
  size: { cols: 120, rows: 30 },
  cwd: process.cwd(),
  env: process.env,
  onData: (chunk) => process.stdout.write(chunk),
  onExit: ({ exitCode, signalCode }) => {
    console.log("shell exited", { exitCode, signalCode });
  },
});

term.write("echo hello\n");
term.resize(140, 40);

// At any time, observe the foreground process group of the slave —
// useful for telling "shell prompt" from "TUI".
console.log(term.foregroundProcessGroup);

await term.exited;
```

## Internals

1. We allocate the PTY pair using libc's `posix_openpt` + `grantpt`
   - `unlockpt` + `ptsname`, with `O_NOCTTY | O_NONBLOCK` set on the
     master fd at open time. Setting these post-open via `fcntl` is
     unreliable on macOS PTYs.
2. We spawn `wrapper-pty-helper` via `Bun.spawn`, passing the slave
   path as argv[1]. The helper executes
   `setsid → open(slave) → ioctl(TIOCSCTTY) → dup2 → execvp(shell)`,
   then disappears.
3. The master fd lives in JS land; `read()` / `write()` go through
   `bun:ffi` against `libc`.
4. Reads are non-blocking; the read loop polls every `pollIntervalMs`
   (default 4 ms) which is well below human-perceivable latency.

## Building the helper

```sh
cd tools/pty-helper
make            # native build to apps/cli/bin/wrapper-pty-helper
make all        # cross-compile every supported triple (needs zig)
```

We commit the binaries into `apps/cli/bin/` so end users never need a
C toolchain.

## Supported platforms

- macOS arm64
- macOS x64
- Linux arm64 (musl)
- Linux x64 (musl)

Windows is intentionally out of scope; recommend WSL.
