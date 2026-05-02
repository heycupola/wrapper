/*
 * wrapper-pty-helper — bridges a slave PTY into a fresh shell process.
 *
 * Usage:
 *     wrapper-pty-helper <slave-path> <shell> [shell args...]
 *
 * Optional environment:
 *     WRAPPER_PTY_ROWS, WRAPPER_PTY_COLS — initial winsize. Applied via
 *     ioctl(TIOCSWINSZ) on the slave fd before exec. Set to whole-number
 *     decimal strings; both must be present, otherwise we leave the
 *     winsize at the kernel default.
 *
 * Why this exists:
 *     The Wrapper CLI runs on Bun. To wrap a user's shell with a PTY
 *     it needs to (1) allocate a master/slave pair, (2) become the
 *     session leader on the slave side, (3) attach the slave as the
 *     controlling terminal so the kernel's line discipline routes
 *     Ctrl+C / Ctrl+Z / Ctrl+\ to the foreground process group, and
 *     finally (4) exec the user's shell.
 *
 *     Bun.spawn does not expose a pre-exec hook, so steps 2 and 3
 *     cannot be done in JavaScript. A POSIX `forkpty()` would handle
 *     the lot, but Bun's runtime crashes in the forked-but-not-exec'd
 *     branch. The cheapest fix is a tiny native binary that handles
 *     2–4 itself; Bun.spawn invokes us, and we hand off via execvp.
 */

#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <termios.h>
#include <unistd.h>

static void die(const char *msg) {
    perror(msg);
    /* _Exit so we don't run any inherited atexit hooks. */
    _Exit(127);
}

/*
 * Parse a positive 16-bit decimal env var. Returns the value or 0 if
 * unset / out of range; the caller decides whether 0 means "use
 * kernel default".
 */
static unsigned short parse_dim(const char *name) {
    const char *raw = getenv(name);
    if (raw == NULL || raw[0] == '\0') return 0;
    char *end = NULL;
    long value = strtol(raw, &end, 10);
    if (end == raw || *end != '\0') return 0;
    if (value <= 0 || value > 0xFFFF) return 0;
    return (unsigned short)value;
}

int main(int argc, char *argv[]) {
    if (argc < 3) {
        fprintf(stderr,
                "wrapper-pty-helper: usage: %s <slave-path> <shell> [args...]\n",
                argv[0]);
        return 2;
    }

    const char *slave_path = argv[1];
    char *const shell = argv[2];
    char *const *shell_args = &argv[2]; /* argv[2]..argv[argc-1], NULL-terminated by argv */

    /*
     * 1. New session, new process group.
     *
     * After setsid() we have no controlling terminal, which is exactly
     * what we want — the next tty we open without O_NOCTTY becomes our
     * controlling terminal.
     */
    if (setsid() == (pid_t)-1) {
        die("setsid");
    }

    /*
     * 2. Open the slave side without O_NOCTTY so it implicitly becomes
     *    the controlling terminal of this session.
     */
    int slave_fd = open(slave_path, O_RDWR);
    if (slave_fd < 0) {
        die("open slave");
    }

#if defined(TIOCSCTTY)
    /*
     * 3. Belt-and-braces: explicitly request the slave as the
     *    controlling terminal. On macOS/BSD this is required; on Linux
     *    it's redundant after the implicit attach above but harmless.
     *    We pass `0` instead of `1`: a non-zero arg means "steal even
     *    if some other session owns it" and is reserved for root.
     */
    if (ioctl(slave_fd, TIOCSCTTY, 0) < 0) {
        die("ioctl TIOCSCTTY");
    }
#endif

    /*
     * 4. Apply the requested winsize before exec. Doing it from C
     *    avoids a Bun:FFI quirk where ioctl(TIOCSWINSZ) appears to
     *    succeed on the master fd but never actually updates the
     *    slave's window size, *and* sidesteps a race where running
     *    `stty -f <slave>` from the parent process can land before
     *    the helper has opened the slave (which clears the size on
     *    macOS).
     */
    {
        unsigned short rows = parse_dim("WRAPPER_PTY_ROWS");
        unsigned short cols = parse_dim("WRAPPER_PTY_COLS");
        if (rows > 0 && cols > 0) {
            struct winsize ws;
            ws.ws_row = rows;
            ws.ws_col = cols;
            ws.ws_xpixel = 0;
            ws.ws_ypixel = 0;
            /* Best-effort: ignore failure here — the worst case is
             * a 0x0 terminal which the parent can re-resize over the
             * `stty -f` path once the user actually types. */
            (void)ioctl(slave_fd, TIOCSWINSZ, &ws);
        }
    }

    /*
     * 5. Wire the slave fd onto stdin/stdout/stderr. dup2 closes the
     *    target descriptor first if it's already open, so we don't
     *    leave Bun's inherited stdio attached.
     */
    if (dup2(slave_fd, STDIN_FILENO) < 0) die("dup2 stdin");
    if (dup2(slave_fd, STDOUT_FILENO) < 0) die("dup2 stdout");
    if (dup2(slave_fd, STDERR_FILENO) < 0) die("dup2 stderr");

    if (slave_fd > STDERR_FILENO) {
        close(slave_fd);
    }

    /*
     * 6. Replace this process image with the user's shell. From here
     *    on the wrapper-pty-helper executable is gone; the shell sees
     *    a real PTY and the kernel's line discipline takes over.
     */
    execvp(shell, shell_args);

    /* Only reached on execvp failure. */
    die("execvp");
    return 127; /* unreachable */
}
