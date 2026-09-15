import type { ReactNode } from "react";

/** Space-separated keycaps, e.g. "⌃ \\" renders Control then backslash. */
export function Keys({ caps, label }: { caps: string; label?: string }) {
  return (
    <span className="demoKeys" aria-label={label ?? caps}>
      {caps.split(" ").map((cap) => (
        <kbd key={cap}>{keycapLegend(cap)}</kbd>
      ))}
    </span>
  );
}

/* The control glyph is drawn at cap height in every system font, so on a key
   it floats above letters and symbols that hang from the baseline. Tagging it
   lets CSS pull it down to the face's optical centre. One wrapper keeps the
   legend a single grid item so multi-glyph labels stay on one line. */
export function keycapLegend(label: string): ReactNode {
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
