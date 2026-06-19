/*
 * libc bindings used by the Terminal class.
 *
 * Scope is intentionally narrow: PTY allocation (posix_openpt +
 * grantpt + unlockpt + ptsname), master fd I/O (read/write/close),
 * and tcgetpgrp() for foreground-process-group inspection. Anything
 * involving ioctl(2) is delegated to short-lived `stty` invocations
 * because bun:ffi's varargs handling for ioctl is currently
 * unreliable on macOS PTYs.
 */

import { dlopen, FFIType, suffix } from "bun:ffi";

const PLATFORM = process.platform;

if (PLATFORM !== "darwin" && PLATFORM !== "linux") {
  throw new Error(`@repo/terminal: unsupported platform "${PLATFORM}" (expected darwin or linux)`);
}

/** open(2) flags. */
export const O_RDWR = 2;

/**
 * Platform-dependent constants. The numeric values for O_NOCTTY and
 * O_NONBLOCK differ between Darwin and Linux, and we set them at PTY
 * creation time because masking them in afterwards via fcntl(F_SETFL)
 * is unreliable on macOS PTYs.
 */
export const O_NOCTTY = PLATFORM === "darwin" ? 0x20000 : 0o400;
export const O_NONBLOCK = PLATFORM === "darwin" ? 0x0004 : 0o4000;

const LIBC_SYMBOLS = {
  posix_openpt: { args: [FFIType.i32], returns: FFIType.i32 },
  grantpt: { args: [FFIType.i32], returns: FFIType.i32 },
  unlockpt: { args: [FFIType.i32], returns: FFIType.i32 },
  ptsname: { args: [FFIType.i32], returns: FFIType.cstring },
  close: { args: [FFIType.i32], returns: FFIType.i32 },
  read: {
    args: [FFIType.i32, FFIType.ptr, FFIType.u64],
    returns: FFIType.i64,
  },
  write: {
    args: [FFIType.i32, FFIType.ptr, FFIType.u64],
    returns: FFIType.i64,
  },
  tcgetpgrp: { args: [FFIType.i32], returns: FFIType.i32 },
} as const;

/*
 * On Linux, `libc.so` is an ld linker script (text), not a dlopen-able
 * shared object — the real object is `libc.so.6` (glibc) or the musl
 * equivalent. On macOS the system resolver handles `libc.dylib`. We try
 * the most likely names per platform so the bindings load everywhere.
 */
const LIBC_CANDIDATES =
  PLATFORM === "darwin"
    ? [`libc.${suffix}`]
    : ["libc.so.6", "libc.so", "libc.musl-x86_64.so.1", `libc.${suffix}`];

function loadLibc(): ReturnType<typeof dlopen<typeof LIBC_SYMBOLS>> {
  let lastError: unknown;
  for (const name of LIBC_CANDIDATES) {
    try {
      return dlopen(name, LIBC_SYMBOLS);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`@repo/terminal: failed to load libc (tried ${LIBC_CANDIDATES.join(", ")})`, {
    cause: lastError,
  });
}

const lib = loadLibc();

export const libc = lib.symbols;
