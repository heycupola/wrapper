"use client";

import { type DemoState, type GuideStep, guideStep } from "./demo-session";
import type { DemoSend, Keycap } from "./use-demo-session";

/**
 * Handwritten margin notes that nudge the visitor through the loop. Each
 * note is also the fallback for people who cannot type the prefix (touch
 * screens, keyboard layouts where `\` needs AltGr): clicking it performs the
 * same action the keys would, and the keycap trail still shows the keys. The
 * container is a polite live region so each new note is read out as the loop
 * advances, not only seen.
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
          share this session: press <Keys caps={"⌃ \\"} /> then <Keys caps="s" /> or{" "}
          <button
            type="button"
            className="demoNoteAction"
            onClick={() => send({ type: "hostCommand", command: "share" })}
          >
            share for me
          </button>
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
          it just showed up on the phone — tap the session{" "}
          <button
            type="button"
            className="demoNoteAction"
            onClick={() => send({ type: "tapSession" })}
          >
            or tap it for me
          </button>
          <HandArrow trailing />
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
          keep typing — it&apos;s live on both.{" "}
          <span className="demoNoteChord">
            <Keys caps={"⌃ \\ u"} />{" "}
            <button
              type="button"
              className="demoNoteAction"
              onClick={() => send({ type: "hostCommand", command: "unshare" })}
            >
              closes the share
            </button>
          </span>
        </p>
      );
    case "done":
      return (
        <p className="demoNote">
          that&apos;s the whole loop — nothing left the Mac until you said so.{" "}
          <button type="button" className="demoNoteAction" onClick={() => send({ type: "reset" })}>
            start over ↺
          </button>
        </p>
      );
  }
}

/**
 * A sketched arrow, drawn with a slightly bowed shaft and an open head so it
 * matches the handwritten notes. Leading arrows point up-left at the window;
 * trailing ones are mirrored to point up-right at the phone.
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
