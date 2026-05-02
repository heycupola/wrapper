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

const lib = dlopen(`libc.${suffix}`, {
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
});

export const libc = lib.symbols;
