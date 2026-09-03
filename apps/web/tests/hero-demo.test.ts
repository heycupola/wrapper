import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ARMED_TIMEOUT_MS,
  createDemoState,
  DEMO_SESSION_ID,
  DEMO_SESSION_TAG,
  DEMO_SHARE_CODE,
  DEMO_HOME_DIR,
  type DemoAction,
  type DemoState,
  guideStep,
  hostTitle,
  hostTransport,
  P2P_LATENCY_MS,
  reduceAll,
  reduceDemo,
  RELAY_LATENCY_MS,
  SHARE_LATENCY_MS,
  TICKET_LATENCY_MS,
} from "../components/hero-demo/demo-session";

const type = (text: string): DemoAction[] => [...text].map((key) => ({ type: "key", key }));
const enter: DemoAction = { type: "key", key: "Enter" };
const prefix: DemoAction = { type: "key", key: "\\", ctrl: true };
const tick = (state: DemoState, ms: number): DemoState =>
  reduceDemo(state, { type: "tick", now: state.now + ms });
const wrapperLines = (state: DemoState) =>
  state.lines.filter((line) => line.kind === "wrapper").map((line) => line.text);
const lastLine = (state: DemoState) => state.lines.at(-1);

function shareAndSettle(state: DemoState): DemoState {
  const armed = reduceAll(state, [prefix, { type: "key", key: "s" }]);
  return tick(armed, SHARE_LATENCY_MS);
}

function attachAndSettle(state: DemoState): DemoState {
  let next = reduceDemo(state, { type: "tapSession" });
  next = tick(next, TICKET_LATENCY_MS);
  return tick(next, RELAY_LATENCY_MS + P2P_LATENCY_MS);
}

describe("hero demo shell", () => {
  test("starts with a lived-in shell and the share prompt", () => {
    const state = createDemoState();
    const command = state.lines.find((line) => line.kind === "command");
    assert.equal(command?.text, "git status");
    assert.equal(command?.cwd, "~/projects/api");
    assert.ok(state.lines.some((line) => line.text === "On branch main"));
    assert.deepEqual(state.history, ["git status"]);
    assert.equal(state.commandsRun, 1);
    assert.deepEqual(wrapperLines(state), [
      "controls: Ctrl+\\ then s share | u unshare | ? status",
    ]);
    assert.equal(hostTitle(state), `wrapper • host • ${DEMO_SESSION_TAG} • local`);
    assert.equal(guideStep(state), "share");
  });

  test("runs commands, keeps history and echoes the prompt cwd", () => {
    let state = reduceAll(createDemoState(), [...type("cd src"), enter, ...type("pwd"), enter]);
    assert.equal(state.cwd, "~/projects/api/src");
    assert.equal(lastLine(state)?.text, `${DEMO_HOME_DIR}/projects/api/src`);

    state = reduceDemo(state, { type: "key", key: "ArrowUp" });
    assert.equal(state.input, "pwd");
    state = reduceDemo(state, { type: "key", key: "ArrowUp" });
    assert.equal(state.input, "cd src");
    state = reduceAll(state, [
      { type: "key", key: "ArrowDown" },
      { type: "key", key: "ArrowDown" },
    ]);
    assert.equal(state.input, "");
  });

  test("reports unknown commands like zsh and never runs destructive ones", () => {
    const state = reduceAll(createDemoState(), [
      ...type("frobnicate"),
      enter,
      ...type("rm -rf /"),
      enter,
    ]);
    const texts = state.lines.map((line) => line.text);
    assert.ok(texts.includes("zsh: command not found: frobnicate"));
    assert.equal(lastLine(state)?.kind, "muted");
  });

  test("ctrl+c abandons the line and ctrl+l clears the screen", () => {
    let state = reduceAll(createDemoState(), [
      ...type("sleep 100"),
      { type: "key", key: "c", ctrl: true },
    ]);
    assert.equal(lastLine(state)?.text, "sleep 100^C");
    assert.equal(state.input, "");
    state = reduceDemo(state, { type: "key", key: "l", ctrl: true });
    assert.equal(state.lines.length, 0);
  });

  test("word and line kills follow the Mac terminal chords", () => {
    const typed = reduceAll(createDemoState(), type("git status  "));
    // ⌥⌫, ⌃W and ⌃⌫ eat trailing blanks and the word before them.
    for (const chord of [
      { type: "key", key: "Backspace", alt: true },
      { type: "key", key: "w", ctrl: true },
      { type: "key", key: "Backspace", ctrl: true },
    ] as const) {
      assert.equal(reduceDemo(typed, chord).input, "git ");
    }
    assert.equal(
      reduceAll(typed, [
        { type: "key", key: "w", ctrl: true },
        { type: "key", key: "w", ctrl: true },
      ]).input,
      "",
    );
    // ⌘⌫ and ⌃U clear the whole line; other ⌘/⌥ chords are left to the browser.
    assert.equal(reduceDemo(typed, { type: "key", key: "Backspace", meta: true }).input, "");
    assert.equal(reduceDemo(typed, { type: "key", key: "u", ctrl: true }).input, "");
    assert.equal(reduceDemo(typed, { type: "key", key: "c", meta: true }), typed);
  });

  test("tab completes commands, subcommands and paths like zsh", () => {
    const tab: DemoAction = { type: "key", key: "Tab" };
    const complete = (text: string) => reduceAll(createDemoState(), [...type(text), tab]);
    // A unique command or subcommand is filled in with a trailing space.
    assert.equal(complete("wh").input, "whoami ");
    assert.equal(complete("git st").input, "git status ");
    // Directories get a slash so the visitor can keep descending; files a space.
    assert.equal(complete("cd sr").input, "cd src/");
    assert.equal(complete("cat READ").input, "cat README.md ");
    assert.equal(complete("ls src/relay/b").input, "ls src/relay/bridge.ts ");
    assert.equal(complete("cd ~/proj").input, "cd ~/projects/");
    // cd only offers directories; hidden files only appear once the dot is typed.
    assert.equal(complete("cd R").input, "cd R");
    assert.equal(complete("cat .").input, "cat .env.example ");
    // Several matches extend to the shared prefix first, then get listed with
    // the line left intact.
    assert.equal(complete("ls te").input, "ls tests/");
    let state = complete("ls src/r");
    assert.equal(state.input, "ls src/r");
    assert.equal(lastLine(state)?.text, "relay/  router.ts");
    assert.equal(state.lines.at(-2)?.text, "ls src/r");
    // Nothing to complete leaves the line alone, including an empty one.
    state = createDemoState();
    assert.equal(reduceDemo(state, tab), state);
    assert.equal(complete("frobnicate").input, "frobnicate");
  });
});

describe("hero demo prefix", () => {
  test("arms on ctrl+\\, paints the armed HUD, and auto-disarms like the CLI", () => {
    let state = reduceDemo(createDemoState(), prefix);
    assert.equal(state.armed, true);
    assert.equal(
      hostTitle(state),
      `● host • ${DEMO_SESSION_TAG} • local | s share • u unshare • ? status`,
    );
    state = tick(state, ARMED_TIMEOUT_MS - 1);
    assert.equal(state.armed, true);
    state = tick(state, 1);
    assert.equal(state.armed, false);
    assert.equal(hostTitle(state), `wrapper • host • ${DEMO_SESSION_TAG} • local`);
  });

  test("escape cancels silently and unknown keys fall through to the shell", () => {
    let state = reduceAll(createDemoState(), [prefix, { type: "key", key: "Escape" }]);
    assert.equal(state.armed, false);
    assert.equal(state.input, "");
    state = reduceAll(createDemoState(), [prefix, { type: "key", key: "x" }]);
    assert.equal(state.armed, false);
    assert.equal(state.input, "x");
  });

  test("ctrl+g works as the alternate prefix", () => {
    const state = reduceDemo(createDemoState(), { type: "key", key: "g", ctrl: true });
    assert.equal(state.armed, true);
  });

  test("? prints the status line the host prints", () => {
    const state = reduceAll(createDemoState(), [prefix, { type: "key", key: "?" }]);
    assert.equal(
      lastLine(state)?.text,
      `id=${DEMO_SESSION_TAG} port=51823 shared=no transport=local`,
    );
  });
});

describe("hero demo share → attach → unshare loop", () => {
  test("sharing goes through the relay handshake and prints the invite", () => {
    let state = reduceAll(createDemoState(), [prefix, { type: "key", key: "s" }]);
    assert.equal(state.sharing, true);
    assert.equal(state.shared, false);
    assert.equal(hostTransport(state), "sharing");
    assert.equal(lastLine(state)?.text, "sharing…");
    assert.equal(guideStep(state), "sharing");

    state = tick(state, SHARE_LATENCY_MS);
    assert.equal(state.shared, true);
    assert.equal(hostTransport(state), "relay");
    assert.deepEqual(wrapperLines(state).slice(-3), [
      "session shared via relay",
      `share code: ${DEMO_SHARE_CODE}`,
      `others join with: wrapper attach --relay --id ${DEMO_SESSION_ID}`,
    ]);
    assert.equal(guideStep(state), "tap");
  });

  test("sharing twice is refused with the CLI wording", () => {
    let state = reduceAll(createDemoState(), [
      prefix,
      { type: "key", key: "s" },
      prefix,
      { type: "key", key: "s" },
    ]);
    assert.equal(lastLine(state)?.text, "already sharing…");
    state = tick(state, SHARE_LATENCY_MS);
    state = reduceAll(state, [prefix, { type: "key", key: "s" }]);
    assert.equal(lastLine(state)?.text, "already shared");
  });

  test("the viewer cannot attach before the host shares", () => {
    const state = reduceDemo(createDemoState(), { type: "tapSession" });
    assert.equal(state.viewer.screen, "list");
  });

  test("tapping the session requests a ticket, connects via relay, then upgrades to p2p", () => {
    let state = shareAndSettle(createDemoState());
    state = reduceDemo(state, { type: "tapSession" });
    assert.equal(state.viewer.screen, "ticket");
    assert.equal(guideStep(state), "connecting");

    state = tick(state, TICKET_LATENCY_MS);
    assert.equal(state.viewer.screen, "terminal");
    assert.equal(state.viewer.attached, true);
    assert.equal(state.viewer.link, "connecting");
    assert.equal(guideStep(state), "live");

    state = tick(state, RELAY_LATENCY_MS);
    assert.equal(state.viewer.link, "relay");
    assert.equal(hostTransport(state), "relay");

    state = tick(state, P2P_LATENCY_MS);
    assert.equal(state.viewer.link, "p2p");
    assert.equal(hostTransport(state), "p2p");
    assert.equal(hostTitle(state), `wrapper • host • ${DEMO_SESSION_TAG} • p2p x1`);
  });

  test("the join sheet reaches the same terminal", () => {
    let state = shareAndSettle(createDemoState());
    state = reduceDemo(state, { type: "openJoin" });
    assert.equal(state.viewer.screen, "join");
    state = reduceDemo(state, { type: "submitJoin" });
    state = tick(state, TICKET_LATENCY_MS);
    assert.equal(state.viewer.attached, true);
  });

  test("the settings sheet opens from the list only and closes back to it", () => {
    let state = createDemoState();
    state = reduceDemo(state, { type: "openSettings" });
    assert.equal(state.viewer.screen, "settings");
    // Sheets are modal: the join sheet cannot stack on top.
    assert.equal(reduceDemo(state, { type: "openJoin" }).viewer.screen, "settings");
    // The host sharing underneath does not disturb the sheet.
    state = shareAndSettle(state);
    assert.equal(state.viewer.screen, "settings");
    state = reduceDemo(state, { type: "closeSettings" });
    assert.equal(state.viewer.screen, "list");
    assert.equal(reduceDemo(state, { type: "closeSettings" }), state);
  });

  test("keystrokes are shared: the phone sees what the host types", () => {
    let state = attachAndSettle(shareAndSettle(createDemoState()));
    state = reduceAll(state, [{ type: "focus", device: "phone" }, ...type("bun test"), enter]);
    assert.ok(state.lines.some((line) => line.text === " 4 pass"));
    assert.equal(state.viewer.attached, true);
  });

  test("detaching from the phone drops the peer and the host falls back to relay", () => {
    let state = attachAndSettle(shareAndSettle(createDemoState()));
    state = reduceDemo(state, { type: "tapDetach" });
    assert.equal(state.viewer.screen, "list");
    assert.equal(state.viewer.attached, false);
    assert.equal(state.shared, true);
    assert.equal(hostTransport(state), "relay");
    assert.equal(guideStep(state), "tap");
  });

  test("unsharing while attached kicks the viewer to the not-connected screen", () => {
    let state = attachAndSettle(shareAndSettle(createDemoState()));
    state = reduceAll(state, [prefix, { type: "key", key: "u" }]);
    assert.equal(lastLine(state)?.text, "session unshared");
    assert.equal(state.shared, false);
    assert.equal(state.viewer.attached, false);
    assert.equal(state.viewer.screen, "notConnected");
    assert.equal(guideStep(state), "done");

    state = reduceDemo(state, { type: "tapRetry" });
    assert.equal(state.viewer.screen, "ticket");
    state = tick(state, TICKET_LATENCY_MS);
    assert.equal(state.viewer.screen, "denied");

    state = reduceDemo(state, { type: "tapCancel" });
    assert.equal(state.viewer.screen, "list");
    assert.equal(state.timers.length, 0);
  });

  test("unsharing when nothing is shared is a no-op with feedback", () => {
    const state = reduceAll(createDemoState(), [prefix, { type: "key", key: "u" }]);
    assert.equal(lastLine(state)?.text, "not currently shared");
  });

  test("a stale link upgrade never revives a detached viewer", () => {
    let state = shareAndSettle(createDemoState());
    state = reduceDemo(state, { type: "tapSession" });
    state = tick(state, TICKET_LATENCY_MS);
    state = reduceDemo(state, { type: "tapDetach" });
    state = tick(state, RELAY_LATENCY_MS + P2P_LATENCY_MS);
    assert.equal(state.viewer.attached, false);
    assert.equal(state.viewer.link, "offline");
  });

  test("reset returns to the opening scene", () => {
    const toured = attachAndSettle(shareAndSettle(createDemoState()));
    const state = reduceDemo(toured, { type: "reset" });
    assert.equal(state.shared, false);
    assert.equal(state.viewer.screen, "list");
    assert.equal(guideStep(state), "share");
    assert.ok(state.lines.some((line) => line.text === "git status" && line.kind === "command"));
  });
});
