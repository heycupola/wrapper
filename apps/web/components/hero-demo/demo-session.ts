/**
 * Pure state machine behind the interactive hero.
 *
 * One reducer drives both devices: the MacBook renders the host shell, the
 * iPhone renders the viewer app, and everything the visitor does on either
 * side flows through `reduceDemo`. Timing (relay handshake, ticket issuance,
 * the armed-prefix timeout) is modelled as scheduled actions that fire on
 * `tick`, so the whole share → attach → unshare loop can be replayed in a
 * unit test without a DOM or real timers.
 *
 * Text, key bindings and latencies mirror the real CLI (`apps/cli`) and the
 * SwiftUI viewer (`apps/mobile`) so the demo doubles as an end-to-end
 * walkthrough of the product rather than an illustration of it.
 */

export const DEMO_SESSION_ID = "4J8K2PQ7M3XW";
export const DEMO_SESSION_TAG = DEMO_SESSION_ID.slice(0, 6);
export const DEMO_SHARE_CODE = "7N4K-WQ2M";
export const DEMO_PORT = 51823;
export const DEMO_HOME = "~/projects/api";
export const DEMO_USER = "icanvardar";
export const DEMO_HOME_DIR = `/Users/${DEMO_USER}`;
export const DEMO_SHELL = "zsh";
export const PREFIX_LABEL = "Ctrl+\\";

/** Mirrors `DEFAULT_TIMEOUT_MS` in `apps/cli/shell/prefix.ts`. */
export const ARMED_TIMEOUT_MS = 1500;
export const SHARE_LATENCY_MS = 720;
export const TICKET_LATENCY_MS = 650;
export const RELAY_LATENCY_MS = 520;
export const P2P_LATENCY_MS = 900;
export const MAX_INPUT_LENGTH = 96;
export const MAX_LINES = 160;

export type HostTransport = "local" | "sharing" | "connecting" | "relay" | "p2p" | "offline";
export type LineKind = "command" | "output" | "wrapper" | "muted" | "error";
export type DemoDevice = "mac" | "phone";
export type ViewerScreen =
  | "list"
  | "join"
  | "settings"
  | "ticket"
  | "terminal"
  | "denied"
  | "notConnected";
export type ViewerLink = "connecting" | "relay" | "p2p" | "offline";
export type HostCommand = "share" | "unshare" | "status" | "detach";
export type GuideStep = "share" | "sharing" | "tap" | "connecting" | "live" | "done";

export interface TerminalLine {
  id: number;
  kind: LineKind;
  text: string;
  /** Present on `command` lines: the prompt's working directory. */
  cwd?: string;
}

export interface ViewerState {
  screen: ViewerScreen;
  link: ViewerLink;
  attached: boolean;
}

export type DemoAction =
  | { type: "focus"; device: DemoDevice | null }
  | { type: "key"; key: string; ctrl?: boolean; meta?: boolean; alt?: boolean }
  | { type: "runCommand"; command: string }
  | { type: "prefix" }
  | { type: "hostCommand"; command: HostCommand }
  | { type: "tapSession" }
  | { type: "openJoin" }
  | { type: "closeJoin" }
  | { type: "openSettings" }
  | { type: "closeSettings" }
  | { type: "submitJoin" }
  | { type: "tapDetach" }
  | { type: "tapCancel" }
  | { type: "tapRetry" }
  | { type: "tick"; now: number }
  | { type: "reset" }
  | { type: "@armTimeout"; armId: number }
  | { type: "@shareEstablished" }
  | { type: "@ticketIssued" }
  | { type: "@ticketDenied" }
  | { type: "@linkRelay" }
  | { type: "@linkP2P" };

interface ScheduledAction {
  id: number;
  at: number;
  action: DemoAction;
}

export interface DemoState {
  now: number;
  nextLineId: number;
  nextTimerId: number;
  timers: ScheduledAction[];
  cwd: string;
  lines: TerminalLine[];
  input: string;
  history: string[];
  historyCursor: number | null;
  draft: string;
  armed: boolean;
  armId: number;
  sharing: boolean;
  shared: boolean;
  viewer: ViewerState;
  focus: DemoDevice | null;
  commandsRun: number;
  /** The visitor has gone through attach at least once; unlocks "start over". */
  toured: boolean;
}

export function controlsHint(prefixLabel = PREFIX_LABEL): string {
  return `controls: ${prefixLabel} then s share | u unshare | ? status`;
}

const OPENING_COMMAND = "git status";

export function createDemoState(now = 0): DemoState {
  // Seed a lived-in shell so the first thing the visitor is asked to do is
  // share — the product — rather than prove the prompt is interactive.
  return reduceDemo(idleDemoState(now), { type: "runCommand", command: OPENING_COMMAND });
}

function idleDemoState(now: number): DemoState {
  return {
    now,
    nextLineId: 2,
    nextTimerId: 1,
    timers: [],
    cwd: DEMO_HOME,
    lines: [{ id: 1, kind: "wrapper", text: controlsHint() }],
    input: "",
    history: [],
    historyCursor: null,
    draft: "",
    armed: false,
    armId: 0,
    sharing: false,
    shared: false,
    viewer: { screen: "list", link: "offline", attached: false },
    focus: null,
    commandsRun: 0,
    toured: false,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// selectors
// ────────────────────────────────────────────────────────────────────────────

/** Mirrors `currentTransport()` in `apps/cli/commands/shell-host.ts`. */
export function hostTransport(state: DemoState): HostTransport {
  if (state.sharing && !state.shared) return "sharing";
  if (!state.shared) return "local";
  if (state.viewer.attached && state.viewer.link === "p2p") return "p2p";
  return "relay";
}

/** Mirrors `formatSessionHud()` in `apps/cli/util/feedback.ts`. */
export function hostTitle(state: DemoState): string {
  const transport = hostTransport(state);
  const label = transport === "p2p" ? "p2p x1" : transport;
  const identity = `host • ${DEMO_SESSION_TAG} • ${label}`;
  if (!state.armed) return `wrapper • ${identity}`;
  return `● ${identity} | s share • u unshare • ? status`;
}

export function viewerCanConnect(state: DemoState): boolean {
  return state.shared;
}

export function guideStep(state: DemoState): GuideStep {
  if (state.viewer.attached) return "live";
  if (state.viewer.screen === "ticket") return "connecting";
  if (state.shared) return "tap";
  if (state.sharing) return "sharing";
  if (state.toured) return "done";
  return "share";
}

export function hasPendingTimers(state: DemoState): boolean {
  return state.timers.length > 0;
}

export function nextTimerAt(state: DemoState): number | null {
  if (state.timers.length === 0) return null;
  let at = Number.POSITIVE_INFINITY;
  for (const timer of state.timers) at = Math.min(at, timer.at);
  return at;
}

// ────────────────────────────────────────────────────────────────────────────
// reducer
// ────────────────────────────────────────────────────────────────────────────

export function reduceDemo(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "tick":
      return runDueTimers({ ...state, now: Math.max(state.now, action.now) });
    case "reset":
      return createDemoState(state.now);
    case "focus":
      return state.focus === action.device ? state : { ...state, focus: action.device };
    case "key":
      return handleKey(state, action);
    case "runCommand":
      return runCommand(disarm(state), action.command);
    case "prefix":
      return arm(state);
    case "hostCommand":
      return hostCommand(disarm(state), action.command);
    case "tapSession":
    case "submitJoin":
      if (!viewerCanConnect(state) || state.viewer.attached) return state;
      return requestTicket(state);
    case "openJoin":
      if (state.viewer.screen !== "list") return state;
      return setViewer(state, { screen: "join" });
    case "closeJoin":
      if (state.viewer.screen !== "join") return state;
      return setViewer(state, { screen: "list" });
    case "openSettings":
      if (state.viewer.screen !== "list") return state;
      return setViewer(state, { screen: "settings" });
    case "closeSettings":
      if (state.viewer.screen !== "settings") return state;
      return setViewer(state, { screen: "list" });
    case "tapCancel":
      return detachViewer(cancelViewerTimers(state));
    case "tapRetry":
      if (state.viewer.screen !== "denied" && state.viewer.screen !== "notConnected") return state;
      return requestTicket(state);
    case "tapDetach":
      if (!state.viewer.attached) return state;
      return detachViewer(cancelViewerTimers(state));
    case "@armTimeout":
      return action.armId === state.armId ? disarm(state) : state;
    case "@shareEstablished":
      return shareEstablished(state);
    case "@ticketIssued":
      return ticketIssued(state);
    case "@ticketDenied":
      return setViewer(state, { screen: "denied", link: "offline", attached: false });
    case "@linkRelay":
      if (!state.viewer.attached) return state;
      return setViewer(state, { link: "relay" });
    case "@linkP2P":
      if (!state.viewer.attached) return state;
      return setViewer(state, { link: "p2p" });
  }
}

/** Convenience for tests and scripted sequences. */
export function reduceAll(state: DemoState, actions: readonly DemoAction[]): DemoState {
  let next = state;
  for (const action of actions) next = reduceDemo(next, action);
  return next;
}

// ────────────────────────────────────────────────────────────────────────────
// timers
// ────────────────────────────────────────────────────────────────────────────

function schedule(state: DemoState, delay: number, action: DemoAction): DemoState {
  const timer: ScheduledAction = { id: state.nextTimerId, at: state.now + delay, action };
  return { ...state, nextTimerId: state.nextTimerId + 1, timers: [...state.timers, timer] };
}

function cancelTimers(state: DemoState, types: readonly DemoAction["type"][]): DemoState {
  const timers = state.timers.filter((timer) => !types.includes(timer.action.type));
  return timers.length === state.timers.length ? state : { ...state, timers };
}

function cancelViewerTimers(state: DemoState): DemoState {
  return cancelTimers(state, ["@ticketIssued", "@ticketDenied", "@linkRelay", "@linkP2P"]);
}

function runDueTimers(state: DemoState): DemoState {
  let next = state;
  for (;;) {
    let first: ScheduledAction | undefined;
    for (const timer of next.timers) {
      if (timer.at > next.now) continue;
      if (!first || timer.at < first.at || (timer.at === first.at && timer.id < first.id)) {
        first = timer;
      }
    }
    if (!first) return next;
    next = { ...next, timers: next.timers.filter((timer) => timer.id !== first.id) };
    next = reduceDemo(next, first.action);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// host: prefix + wrapper commands
// ────────────────────────────────────────────────────────────────────────────

function arm(state: DemoState): DemoState {
  if (state.armed) return state;
  const armId = state.armId + 1;
  return schedule({ ...state, armed: true, armId }, ARMED_TIMEOUT_MS, {
    type: "@armTimeout",
    armId,
  });
}

function disarm(state: DemoState): DemoState {
  if (!state.armed) return state;
  return cancelTimers({ ...state, armed: false }, ["@armTimeout"]);
}

function hostCommand(state: DemoState, command: HostCommand): DemoState {
  switch (command) {
    case "share": {
      if (state.shared) return announce(state, "already shared");
      if (state.sharing) return announce(state, "already sharing…");
      const next = announce({ ...state, sharing: true }, "sharing…");
      return schedule(next, SHARE_LATENCY_MS, { type: "@shareEstablished" });
    }
    case "unshare": {
      if (state.sharing) return announce(state, "still sharing…");
      if (!state.shared) return announce(state, "not currently shared");
      let next: DemoState = { ...state, shared: false, sharing: false };
      next = cancelViewerTimers(next);
      if (next.viewer.attached || next.viewer.screen === "ticket") {
        next = setViewer(next, { screen: "notConnected", link: "offline", attached: false });
      }
      next = announce(next, "session unshared");
      return next;
    }
    case "status": {
      const shared = state.shared ? "yes" : state.sharing ? "sharing" : "no";
      return announce(
        state,
        `id=${DEMO_SESSION_TAG} port=${DEMO_PORT} shared=${shared} transport=${hostTransport(state)}`,
      );
    }
    case "detach":
      return announce(state, "this terminal owns the session — type `exit` to end it");
  }
}

function shareEstablished(state: DemoState): DemoState {
  if (!state.sharing) return state;
  let next: DemoState = { ...state, sharing: false, shared: true };
  next = announce(next, "session shared via relay");
  next = pushLine(next, "wrapper", `share code: ${DEMO_SHARE_CODE}`);
  return pushLine(
    next,
    "wrapper",
    `others join with: wrapper attach --relay --id ${DEMO_SESSION_ID}`,
  );
}

/** The `[wrapper] …` inline line the CLI prints while the shell is idle. */
function announce(state: DemoState, text: string): DemoState {
  return pushLine(state, "wrapper", text);
}

// ────────────────────────────────────────────────────────────────────────────
// viewer
// ────────────────────────────────────────────────────────────────────────────

function setViewer(state: DemoState, patch: Partial<ViewerState>): DemoState {
  return { ...state, viewer: { ...state.viewer, ...patch } };
}

function requestTicket(state: DemoState): DemoState {
  let next = cancelViewerTimers(state);
  next = setViewer(next, { screen: "ticket", link: "connecting", attached: false });
  return schedule(next, TICKET_LATENCY_MS, {
    type: next.shared ? "@ticketIssued" : "@ticketDenied",
  });
}

function ticketIssued(state: DemoState): DemoState {
  if (state.viewer.screen !== "ticket") return state;
  if (!state.shared) return setViewer(state, { screen: "denied", link: "offline" });
  let next = setViewer(state, { screen: "terminal", link: "connecting", attached: true });
  next = { ...next, toured: true };
  next = schedule(next, RELAY_LATENCY_MS, { type: "@linkRelay" });
  return schedule(next, RELAY_LATENCY_MS + P2P_LATENCY_MS, { type: "@linkP2P" });
}

function detachViewer(state: DemoState): DemoState {
  const focus = state.focus === "phone" ? null : state.focus;
  return setViewer({ ...state, focus }, { screen: "list", link: "offline", attached: false });
}

// ────────────────────────────────────────────────────────────────────────────
// keyboard
// ────────────────────────────────────────────────────────────────────────────

const PREFIX_KEYS = new Set(["\\", "|", "g", "G"]);

function handleKey(state: DemoState, action: Extract<DemoAction, { type: "key" }>): DemoState {
  const { key, ctrl = false, meta = false, alt = false } = action;

  if (ctrl && !meta && PREFIX_KEYS.has(key)) {
    // A second prefix while armed forwards the literal byte in the real CLI;
    // the demo shell has nothing useful to do with it, so it just disarms.
    return state.armed ? disarm(state) : arm(state);
  }

  if (state.armed) {
    const next = disarm(state);
    if (key === "Escape") return next;
    switch (key) {
      case "s":
        return hostCommand(next, "share");
      case "u":
        return hostCommand(next, "unshare");
      case "?":
        return hostCommand(next, "status");
      case "d":
        return hostCommand(next, "detach");
      default:
        return handleKey(next, action);
    }
  }

  // Line editing the way a Mac terminal does it: ⌥⌫ and ⌃W kill the word
  // (⌃⌫ too, for Linux hands), ⌘⌫ and ⌃U kill the whole line.
  if (meta) return key === "Backspace" ? killLine(state) : state;
  if (alt) return key === "Backspace" ? killWord(state) : state;

  if (ctrl) {
    switch (key.toLowerCase()) {
      case "c":
        return {
          ...pushLine(state, "command", `${state.input}^C`, state.cwd),
          input: "",
          historyCursor: null,
        };
      case "l":
        return { ...state, lines: [] };
      case "u":
        return killLine(state);
      case "w":
      case "backspace":
        return killWord(state);
      default:
        return state;
    }
  }

  switch (key) {
    case "Enter":
      return runCommand(state, state.input);
    case "Tab":
      return completeInput(state);
    case "Backspace":
      return state.input ? { ...state, input: state.input.slice(0, -1) } : state;
    case "ArrowUp":
      return recallHistory(state, -1);
    case "ArrowDown":
      return recallHistory(state, 1);
    case "Escape":
      return { ...state, focus: null };
    default:
      if (key.length !== 1) return state;
      if (state.input.length >= MAX_INPUT_LENGTH) return state;
      return { ...state, input: state.input + key, historyCursor: null };
  }
}

function recallHistory(state: DemoState, direction: -1 | 1): DemoState {
  if (state.history.length === 0) return state;
  const current = state.historyCursor ?? state.history.length;
  const next = current + direction;
  if (next < 0) return state;
  if (next >= state.history.length) {
    return state.historyCursor === null
      ? state
      : { ...state, historyCursor: null, input: state.draft };
  }
  const draft = state.historyCursor === null ? state.input : state.draft;
  return { ...state, historyCursor: next, draft, input: state.history[next] ?? "" };
}

function killLine(state: DemoState): DemoState {
  return state.input ? { ...state, input: "", historyCursor: null } : state;
}

/** readline's backward-kill-word: skip trailing blanks, then eat the word. */
function killWord(state: DemoState): DemoState {
  if (!state.input) return state;
  const input = state.input.replace(/\S+\s*$/, "");
  return { ...state, input: input === state.input ? "" : input, historyCursor: null };
}

// ────────────────────────────────────────────────────────────────────────────
// completion
// ────────────────────────────────────────────────────────────────────────────

const COMPLETABLE_COMMANDS = [
  "bun",
  "cat",
  "cd",
  "clear",
  "date",
  "echo",
  "git",
  "help",
  "ls",
  "npm",
  "pnpm",
  "pwd",
  "uptime",
  "whoami",
  "wrapper",
] as const;

const SUBCOMMANDS: Record<string, readonly string[]> = {
  git: ["branch", "diff", "log", "status"],
  bun: ["test"],
  npm: ["test"],
  pnpm: ["test"],
  wrapper: ["status", "--version"],
};

type Completion = { label: string; replacement: string };

/**
 * Tab the way zsh does it: a single match is filled in (directories get a
 * `/`, everything else a space), several matches extend to their common
 * prefix, and when nothing more can be typed for the visitor the candidates
 * are listed under the line, which stays as it was.
 */
function completeInput(state: DemoState): DemoState {
  const { input } = state;
  if (input.length >= MAX_INPUT_LENGTH) return state;
  const token = /\S*$/.exec(input)?.[0] ?? "";
  const head = input.slice(0, input.length - token.length);
  const words = head.trim() === "" ? [] : head.trim().split(/\s+/);
  const command = words[0];

  let candidates: Completion[];
  if (command === undefined) {
    if (token === "") return state;
    candidates = COMPLETABLE_COMMANDS.filter((name) => name.startsWith(token)).map((name) => ({
      label: name,
      replacement: `${name} `,
    }));
  } else if (words.length === 1 && SUBCOMMANDS[command]) {
    candidates = SUBCOMMANDS[command]
      .filter((sub) => sub.startsWith(token))
      .map((sub) => ({ label: sub, replacement: `${sub} ` }));
  } else {
    candidates = completePath(state.cwd, token, command === "cd");
  }

  if (candidates.length === 0) return state;
  if (candidates.length === 1) {
    return { ...state, input: head + candidates[0]!.replacement, historyCursor: null };
  }
  const shared = commonPrefix(candidates.map((candidate) => candidate.replacement));
  if (shared.length > token.length) {
    return { ...state, input: head + shared, historyCursor: null };
  }
  const echoed = pushLine(state, "command", input, state.cwd);
  return pushLine(echoed, "output", candidates.map((candidate) => candidate.label).join("  "));
}

function completePath(cwd: string, token: string, directoriesOnly: boolean): Completion[] {
  const slash = token.lastIndexOf("/");
  const dirPart = slash === -1 ? "" : token.slice(0, slash + 1);
  const prefix = token.slice(slash + 1);
  const directoryPath = resolvePath(cwd, dirPart);
  const entries = TREE[directoryPath];
  if (!entries) return [];
  const completions: Completion[] = [];
  for (const entry of entries) {
    if (!entry.startsWith(prefix)) continue;
    if (entry.startsWith(".") && !prefix.startsWith(".")) continue;
    const directory = TREE[`${directoryPath}/${entry}`] !== undefined;
    if (directoriesOnly && !directory) continue;
    completions.push({
      label: directory ? `${entry}/` : entry,
      replacement: `${dirPart}${entry}${directory ? "/" : " "}`,
    });
  }
  // Local array built just above, so in-place sorting is safe (and `toSorted`
  // is outside the project's TS lib target).
  // oxlint-disable-next-line unicorn/no-array-sort
  return completions.sort((a, b) => a.label.localeCompare(b.label));
}

function commonPrefix(values: readonly string[]): string {
  let prefix = values[0] ?? "";
  for (const value of values) {
    let index = 0;
    while (index < prefix.length && prefix[index] === value[index]) index += 1;
    prefix = prefix.slice(0, index);
  }
  return prefix;
}

// ────────────────────────────────────────────────────────────────────────────
// the demo shell
// ────────────────────────────────────────────────────────────────────────────

function pushLine(state: DemoState, kind: LineKind, text: string, cwd?: string): DemoState {
  const line: TerminalLine =
    cwd === undefined
      ? { id: state.nextLineId, kind, text }
      : { id: state.nextLineId, kind, text, cwd };
  const lines = [...state.lines, line];
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
  return { ...state, lines, nextLineId: state.nextLineId + 1 };
}

function pushLines(state: DemoState, kind: LineKind, texts: readonly string[]): DemoState {
  let next = state;
  for (const text of texts) next = pushLine(next, kind, text);
  return next;
}

function runCommand(state: DemoState, rawCommand: string): DemoState {
  const command = rawCommand.trim();
  let next: DemoState = {
    ...pushLine(state, "command", rawCommand, state.cwd),
    input: "",
    draft: "",
    historyCursor: null,
  };
  if (command === "") return next;

  next = {
    ...next,
    commandsRun: next.commandsRun + 1,
    history: next.history.at(-1) === command ? next.history : [...next.history, command].slice(-40),
  };

  const [name = "", ...args] = command.split(/\s+/);
  switch (name) {
    case "clear":
      return { ...next, lines: [] };
    case "help":
      return pushLines(next, "output", [
        "demo shell — a few commands to poke at:",
        "  ls  pwd  cd  cat  git  bun  echo  whoami  uptime  clear",
        `  ${PREFIX_LABEL} then s shares this terminal with the phone`,
      ]);
    case "pwd":
      return pushLine(next, "output", expandHome(next.cwd));
    case "whoami":
      return pushLine(next, "output", DEMO_USER);
    case "uptime":
      return pushLine(
        next,
        "output",
        "9:41  up 6 days,  3:12, 2 users, load averages: 1.42 1.37 1.29",
      );
    case "date":
      return pushLine(next, "output", "Mon Jun 10 09:41:07 2026");
    case "echo":
      return pushLine(next, "output", args.join(" ").replace(/^["'](.*)["']$/, "$1"));
    case "ls":
      return runLs(next, args);
    case "cd":
      return runCd(next, args[0]);
    case "cat":
      return runCat(next, args[0]);
    case "git":
      return runGit(next, args);
    case "bun":
    case "npm":
    case "pnpm":
      return runTests(next, name, args);
    case "wrapper":
      return runWrapper(next, args);
    case "exit":
    case "logout":
      return pushLine(next, "muted", "the demo shell stays open — nothing to exit here");
    case "sudo":
      return pushLine(
        next,
        "error",
        `${DEMO_USER} is not in the sudoers file. This incident will be reported.`,
      );
    case "rm":
      return pushLine(next, "muted", "nice try — this is a demo shell");
    default:
      return pushLine(next, "error", `zsh: command not found: ${name}`);
  }
}

const TREE: Record<string, readonly string[]> = {
  "~": ["projects", "Documents", "Downloads"],
  "~/projects": ["api", "wrapper", "site"],
  "~/projects/api": [
    "README.md",
    "bun.lock",
    "package.json",
    "src",
    "tests",
    "tsconfig.json",
    ".env.example",
  ],
  "~/projects/api/src": ["index.ts", "router.ts", "sessions.ts", "tickets.ts", "relay"],
  "~/projects/api/src/relay": ["bridge.ts", "signal.ts", "p2p.ts"],
  "~/projects/api/tests": ["router.test.ts", "sessions.test.ts", "tickets.test.ts"],
};

function runLs(state: DemoState, args: readonly string[]): DemoState {
  const flags = args.filter((arg) => arg.startsWith("-")).join("");
  const target = args.find((arg) => !arg.startsWith("-"));
  const path = target ? resolvePath(state.cwd, target) : state.cwd;
  const entries = TREE[path];
  if (!entries) return pushLine(state, "error", `ls: ${target}: No such file or directory`);
  const visible = flags.includes("a") ? entries : entries.filter((e) => !e.startsWith("."));
  if (flags.includes("l")) {
    const rows = visible.map((entry) => {
      const dir = TREE[`${path}/${entry}`] !== undefined || !entry.includes(".");
      const mode = dir ? "drwxr-xr-x" : "-rw-r--r--";
      const size = dir ? "160" : String(400 + entry.length * 37);
      return `${mode}  1 ${DEMO_USER}  staff  ${size.padStart(5)} Jun 10 09:41 ${entry}`;
    });
    return pushLines(state, "output", rows);
  }
  return pushLine(state, "output", visible.join("  "));
}

function runCd(state: DemoState, target?: string): DemoState {
  const path = resolvePath(state.cwd, target ?? "~");
  if (!TREE[path]) return pushLine(state, "error", `cd: no such file or directory: ${target}`);
  return { ...state, cwd: path };
}

const FILES: Record<string, readonly string[]> = {
  "~/projects/api/README.md": [
    "# api",
    "",
    "Session registry, share codes and relay tickets for Wrapper.",
    "Run `bun test` before opening a pull request.",
  ],
  "~/projects/api/package.json": [
    "{",
    '  "name": "api",',
    '  "scripts": { "test": "bun test", "dev": "bun run src/index.ts" }',
    "}",
  ],
  "~/projects/api/.env.example": ["RELAY_URL=wss://relay.wrapper.sh", "CONVEX_URL="],
};

function runCat(state: DemoState, target?: string): DemoState {
  if (!target) return pushLine(state, "error", "cat: missing file operand");
  const path = resolvePath(state.cwd, target);
  const content = FILES[path];
  if (content) return pushLines(state, "output", content);
  if (TREE[path]) return pushLine(state, "error", `cat: ${target}: Is a directory`);
  return pushLine(state, "error", `cat: ${target}: No such file or directory`);
}

function runGit(state: DemoState, args: readonly string[]): DemoState {
  const [sub] = args;
  switch (sub) {
    case "status":
      return pushLines(state, "output", [
        "On branch main",
        "Your branch is up to date with 'origin/main'.",
        "",
        "Changes not staged for commit:",
        "  modified:   src/relay/p2p.ts",
        "  modified:   tests/tickets.test.ts",
        "",
        'no changes added to commit (use "git add" and/or "git commit -a")',
      ]);
    case "log":
      return pushLines(state, "output", [
        "e4f21c9 relay: prefer p2p once the data channel opens",
        "b7a0d13 tickets: hash viewer tickets at rest",
        "91cc4e8 sessions: heartbeat shared flag",
        "3d8fa02 initial commit",
      ]);
    case "branch":
      return pushLines(state, "output", ["* main", "  relay/p2p-fallback"]);
    case "diff":
      return pushLines(state, "output", [
        "diff --git a/src/relay/p2p.ts b/src/relay/p2p.ts",
        "@@ -41,7 +41,7 @@ export async function openDataChannel(peer) {",
        '-  channel.binaryType = "blob";',
        '+  channel.binaryType = "arraybuffer";',
      ]);
    case undefined:
      return pushLine(
        state,
        "output",
        "usage: git [-v | --version] [-h | --help] <command> [<args>]",
      );
    default:
      return pushLine(state, "error", `git: '${sub}' is not a git command. See 'git --help'.`);
  }
}

function runTests(state: DemoState, runner: string, args: readonly string[]): DemoState {
  const [sub] = args;
  if (sub !== "test" && !(runner === "bun" && sub === "t")) {
    return pushLine(
      state,
      "muted",
      `${runner} ${sub ?? ""}: only \`${runner} test\` runs in the demo`,
    );
  }
  return pushLines(state, "output", [
    runner === "bun" ? "bun test v1.2.19" : "> api@0.1.0 test",
    "",
    "tests/router.test.ts:",
    "✓ routes attach requests to the session owner [2.10ms]",
    "✓ rejects expired tickets [0.42ms]",
    "tests/sessions.test.ts:",
    "✓ marks a session shared after the relay is up [1.08ms]",
    "tests/tickets.test.ts:",
    "✓ stores viewer tickets hashed [0.77ms]",
    "",
    " 4 pass",
    " 0 fail",
    "Ran 4 tests across 3 files. [38.00ms]",
  ]);
}

function runWrapper(state: DemoState, args: readonly string[]): DemoState {
  const [sub] = args;
  if (sub === "--version" || sub === "-v") return pushLine(state, "output", "wrapper 0.4.2");
  if (sub === "status" || sub === undefined) {
    return pushLines(state, "output", [
      `session ${DEMO_SESSION_TAG} · ${DEMO_SHELL} · listening on 127.0.0.1:${DEMO_PORT}`,
      `shared: ${state.shared ? "yes" : "no"} · transport: ${hostTransport(state)}`,
      `share from inside the shell with ${PREFIX_LABEL} then s`,
    ]);
  }
  return pushLine(state, "error", `wrapper: unknown command '${sub}'`);
}

// ────────────────────────────────────────────────────────────────────────────
// paths
// ────────────────────────────────────────────────────────────────────────────

function expandHome(path: string): string {
  return path.replace(/^~/, DEMO_HOME_DIR);
}

function resolvePath(cwd: string, target: string): string {
  const normalized = target.replace(new RegExp(`^${DEMO_HOME_DIR}(?=\\/|$)`), "~");
  if (normalized.startsWith("/")) return normalized;
  const fromHome = normalized.startsWith("~");
  const stack = fromHome ? ["~"] : cwd.split("/");
  const parts = (fromHome ? normalized.slice(1) : normalized).split("/");
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}
