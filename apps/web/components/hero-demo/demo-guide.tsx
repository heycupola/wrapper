"use client";

import type { ReactNode } from "react";
import { type DemoState, type GuideStep, guideStep } from "./demo-session";
import type { DemoSend, Keycap } from "./use-demo-session";

/**
 * Handwritten margin notes that nudge the visitor through the loop. Each
 * note is also the fallback for people who cannot type the prefix (keyboard
 * layouts where `\` needs AltGr): clicking it performs the same action the
 * keys would, and the keycap trail still shows the keys.
 *
 * Every note carries two phrasings. With a keyboard it names the chord and
 * offers the button as a shortcut; on touch there are no keys to press, so the
 * chord goes and the button, drawn as a pill, becomes the one way through.
 * Which phrasing shows is decided by CSS (`.demoWhenKeys` / `.demoWhenTouch`
 * in hero-demo.css) on the same pointer query the scripts use, so the note is
 * right from the first paint rather than after hydration. The container is a
 * polite live region so each new note is read out as the loop advances.
 */
export function DemoGuide({ state, send }: { state: DemoState; send: DemoSend }) {
  const step = guideStep(state);
  return (
    <div className="demoGuide" data-step={step} aria-live="polite">
      <Note key={step} step={step} send={send} />
    </div>
  );
}

function Note({ step, send }: { step: GuideStep; send: DemoSend }) {
  switch (step) {
    case "share":
      return (
        <p className="demoNote">
          <HandArrow />
          <Keyboard>
            share this session: press <Keys caps={"⌃ \\"} /> then <Keys caps="s" /> or{" "}
          </Keyboard>
          <Touch>nothing leaves the Mac until you share it </Touch>
          <Action
            onClick={() => send({ type: "hostCommand", command: "share" })}
            keyboard="share for me"
            touch="Share this session"
          />
        </p>
      );
    case "sharing":
      return (
        <p className="demoNote isQuiet">
          <HandArrow />
          opening an authenticated relay tunnel…
        </p>
      );
    case "tap":
      return (
        <p className="demoNote">
          <Keyboard>it just showed up on the phone — tap the session </Keyboard>
          {/* On touch the pill takes its own line, so the arrow at the phone
              closes the sentence instead of trailing the button. */}
          <Touch>
            it just showed up on the phone — tap the session, or <HandArrow trailing />
          </Touch>
          <Action
            onClick={() => send({ type: "tapSession" })}
            keyboard="or tap it for me"
            touch="Open it for me"
          />
          <Keyboard>
            <HandArrow trailing />
          </Keyboard>
        </p>
      );
    case "connecting":
      return (
        <p className="demoNote isQuiet">
          single-use ticket, then relay, then peer to peer…
          <HandArrow trailing />
        </p>
      );
    case "live":
      return (
        <p className="demoNote">
          <HandArrow />
          <Keyboard>
            keep typing — it&apos;s live on both.{" "}
            <span className="demoNoteChord">
              <Keys caps={"⌃ \\ u"} />{" "}
            </span>
          </Keyboard>
          <Touch>it&apos;s live on both — the same shell, keystroke for keystroke. </Touch>
          <Action
            onClick={() => send({ type: "hostCommand", command: "unshare" })}
            keyboard="closes the share"
            touch="Close the share"
          />
        </p>
      );
    case "done":
      return (
        <p className="demoNote">
          that&apos;s the whole loop — nothing left the Mac until you said so.{" "}
          <Action
            onClick={() => send({ type: "reset" })}
            keyboard="start over ↺"
            touch="Start over ↺"
          />
        </p>
      );
  }
}

/** Shown only when a keyboard and a fine pointer are at hand. */
function Keyboard({ children }: { children: ReactNode }) {
  return <span className="demoWhenKeys">{children}</span>;
}

/** Shown only on touch. */
function Touch({ children }: { children: ReactNode }) {
  return <span className="demoWhenTouch">{children}</span>;
}

/**
 * The note's one control. A single button so there is one tab stop; the two
 * labels inside it are toggled by the same CSS as the surrounding text, so a
 * screen reader only ever meets the one that is showing.
 */
function Action({
  onClick,
  keyboard,
  touch,
}: {
  onClick: () => void;
  keyboard: string;
  touch: string;
}) {
  return (
    <button type="button" className="demoNoteAction" onClick={onClick}>
      <Keyboard>{keyboard}</Keyboard>
      <Touch>{touch}</Touch>
    </button>
  );
}

/**
 * A sketched arrow, drawn with a slightly bowed shaft and an open head so it
 * matches the handwritten notes. Leading arrows point up-left at the window;
 * trailing ones are mirrored to point up-right at the phone (and turned to
 * point down-right where the phone sits below the panel, see hero-demo.css).
 */
function HandArrow({ trailing = false }: { trailing?: boolean }) {
  return (
    <svg
      className={`demoNoteArrow ${trailing ? "isTrailing" : ""}`}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M28.5 27.5C23.8 24.6 14.6 19.4 8.2 8.6" />
      <path d="M6.9 6.4c.7 3.6 1 6.6 1.3 10.2" />
      <path d="M6.9 6.4c3.5.4 6.6.9 10.1 1.9" />
    </svg>
  );
}

/** Space-separated keycaps, e.g. "⌃ \\" renders two keys. */
function Keys({ caps }: { caps: string }) {
  return (
    <span className="demoKeys" aria-label={caps}>
      {caps.split(" ").map((cap) => (
        <kbd key={cap}>{legend(cap)}</kbd>
      ))}
    </span>
  );
}

/* The control glyph is drawn at cap height in every system font, so on a key
   it floats above letters and symbols that hang from the baseline. Tagging it
   lets CSS pull it down to the face's optical centre. One wrapper keeps the
   legend a single grid item so multi-glyph labels stay on one line. */
function legend(label: string) {
  return (
    <span>
      {[...label].map((glyph, index) =>
        glyph === "⌃" ? (
          // eslint-disable-next-line react/no-array-index-key -- glyphs repeat and never reorder
          <span key={index} className="demoCapControl">
            {glyph}
          </span>
        ) : (
          glyph
        ),
      )}
    </span>
  );
}

export function KeycapTrail({ keycaps }: { keycaps: readonly Keycap[] }) {
  if (keycaps.length === 0) return null;
  return (
    <div className="demoKeycapTrail" aria-hidden="true">
      {keycaps.map((cap) => (
        <kbd key={cap.id} className="demoKeycap">
          {legend(cap.label)}
        </kbd>
      ))}
    </div>
  );
}
