# `wrapper-pty-helper`

A ~80-line C shim that gives the Wrapper CLI a fully-fledged controlling
PTY on Bun. `Bun.spawn` does not expose the pre-`exec` hook needed to
call `setsid()` + `ioctl(TIOCSCTTY)`, so we delegate that step to a tiny
native binary which we then invoke through `Bun.spawn`.

The helper is dumb: read the slave-pty path from `argv[1]`, become the
session leader, attach the slave as the controlling terminal, dup it
onto stdin/stdout/stderr, and `execvp` the shell. After exec the
helper's image is gone — the shell sees a real terminal, the kernel's
line discipline routes Ctrl+C / Ctrl+Z / Ctrl+\\ to the right process
group, and the wrapper CLI keeps the master fd.

## Build

```sh
make            # current host
make all        # every supported triple (requires zig >= 0.13)
make clean
```

Output binaries land in `apps/cli/bin/wrapper-pty-helper[-<triple>]` and
are committed to git so end users never need a C toolchain.

## Why C?

Three reasons:

1. **Bun.spawn has no pre-exec hook.** We can't run JS code in the
   forked-but-not-yet-exec'd child. Without that, `setsid()` and
   `TIOCSCTTY` cannot fire on the right side of the fork.

2. **`forkpty()` crashes the Bun runtime.** Tested directly: the
   forked-and-not-yet-exec'd half of Bun emits a crash report instead
   of behaving like a plain libc child.

3. **Pure Bun:FFI workarounds (signal injection, `kill(-pgid)`) are
   approximations** that miss Ctrl+Z reliably and race against pgrp
   churn. The helper produces a real PTY identical to the one `node-pty`
   builds in C++.

## Files

- `pty-helper.c` — the shim (well-commented; ~80 lines)
- `Makefile` — host + cross-compile (zig) targets
- `../../apps/cli/bin/wrapper-pty-helper[-<triple>]` — committed binaries
