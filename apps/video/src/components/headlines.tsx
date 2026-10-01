import type { CSSProperties } from "react";
import type { Layout } from "../layout";
import { font, usePalette } from "../theme";
import { HEADLINES, type Headline } from "../timeline";
import { mix, progress } from "../timing";

const WORD_STAGGER = 0.065;
const WORD_ENTER = 0.55;

function placement(line: Headline, layout: Layout): { style: CSSProperties; rows: string[] } {
  if (line.closeUp) {
    const side = layout.closeUpHeadline;
    return {
      rows: line.text.split("\n"),
      style: {
        left: `calc(50% + ${side.x}px)`,
        top: `calc(50% + ${side.y}px)`,
        textAlign: side.align,
        fontSize: side.size,
        whiteSpace: "nowrap",
        ...(side.align === "center" ? { translate: "-50% 0" } : null),
      },
    };
  }
  const { y, size, maxWidth } = layout.headline;
  return {
    rows: [line.text.replaceAll("\n", " ")],
    style: {
      left: "50%",
      top: `calc(50% + ${y}px)`,
      width: maxWidth,
      marginLeft: -maxWidth / 2,
      textAlign: "center",
      fontSize: size,
    },
  };
}

/* Headlines arrive one word at a time and leave together. */
export function Headlines({ t, layout }: { t: number; layout: Layout }) {
  const color = usePalette();

  return (
    <>
      {HEADLINES.map((line) => {
        if (t < line.start || t > line.end + 0.4) return null;
        const exit = progress(t, line.end, 0.32);
        const { style, rows } = placement(line, layout);
        let index = 0;
        return (
          <div
            key={line.text}
            style={{
              position: "absolute",
              ...style,
              transform: `translateY(-50%) translateY(${-exit * 10}px)`,
              filter: `blur(${exit * 5}px)`,
              opacity: 1 - exit,
              fontFamily: font.sans,
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-0.028em",
              color: color.ink,
            }}
          >
            {rows.map((row) => {
              const words = row.split(" ");
              return (
                <div key={row}>
                  {words.map((word, i) => {
                    const p = progress(t, line.start + index++ * WORD_STAGGER, WORD_ENTER);
                    return (
                      <span
                        key={`${word}-${i}`}
                        style={{
                          display: "inline-block",
                          whiteSpace: "pre",
                          opacity: p,
                          transform: `translateY(${mix(0.32, 0, p)}em)`,
                          filter: `blur(${(1 - p) * 10}px)`,
                        }}
                      >
                        {i < words.length - 1 ? `${word} ` : word}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
