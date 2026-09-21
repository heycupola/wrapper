/**
 * One-shot "Press Enter to open the browser" interceptor for a live shell.
 *
 * Login can block on a clack confirm. Shell-host cannot: stdin already belongs
 * to the PTY. Arm this after printing a checkout (or similar) URL, then feed
 * stdin chunks through `process` before they reach the shell.
 *
 * Enter opens the URL and is swallowed so it does not submit a prompt line.
 * Any other key cancels immediately so a later command's Enter is never stolen.
 */

export interface EnterToOpenOptions {
  open: (url: string) => boolean;
  onOpened?: (ok: boolean) => void;
}

export interface EnterToOpen {
  arm: (url: string) => void;
  disarm: () => void;
  process: (chunk: string) => string;
  readonly pending: boolean;
}

export function createEnterToOpen(opts: EnterToOpenOptions): EnterToOpen {
  let pendingUrl: string | null = null;

  const disarm = (): void => {
    pendingUrl = null;
  };

  return {
    arm(url: string): void {
      pendingUrl = url;
    },
    disarm,
    get pending(): boolean {
      return pendingUrl !== null;
    },
    process(chunk: string): string {
      if (!pendingUrl || chunk.length === 0) return chunk;

      const ch = chunk[0]!;
      if (ch === "\r" || ch === "\n") {
        const url = pendingUrl;
        disarm();
        const restStart = ch === "\r" && chunk[1] === "\n" ? 2 : 1;
        const ok = opts.open(url);
        opts.onOpened?.(ok);
        return chunk.slice(restStart);
      }

      disarm();
      return chunk;
    },
  };
}
