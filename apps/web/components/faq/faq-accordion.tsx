"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { FAQ_ITEMS } from "../../lib/faq-content";
import { Button } from "../ui/button";
import { AnswerText } from "./answer-text";

/**
 * Six questions as a hairline list, one open at a time. No frame and no
 * chrome: the questions sit directly under the scene title the way the steps
 * sit under the connection title. The docs carry anything longer.
 *
 * Follows the WAI-ARIA accordion pattern: each header is a real button that
 * owns `aria-expanded` and `aria-controls`, the panel is a labelled region,
 * and Up / Down / Home / End move between headers so a keyboard user does not
 * have to tab through every open answer to reach the next question.
 */
export function FaqAccordion({ className }: { className?: string }) {
  const baseId = useId();
  const [openId, setOpenId] = useState<string>(FAQ_ITEMS[0]?.id ?? "");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function focusHeader(index: number) {
    const count = FAQ_ITEMS.length;
    buttons.current[(index + count) % count]?.focus();
  }

  function onHeaderKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowDown":
        focusHeader(index + 1);
        break;
      case "ArrowUp":
        focusHeader(index - 1);
        break;
      case "Home":
        focusHeader(0);
        break;
      case "End":
        focusHeader(FAQ_ITEMS.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <ul className={["faqList", className].filter(Boolean).join(" ")}>
      {FAQ_ITEMS.map((item, index) => {
        const open = item.id === openId;
        const buttonId = `${baseId}-${item.id}-q`;
        const panelId = `${baseId}-${item.id}-a`;
        return (
          <li key={item.id} className={`faqItem ${open ? "isOpen" : ""}`}>
            <h3 className="faqQuestion">
              <button
                type="button"
                id={buttonId}
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? "" : item.id)}
                onKeyDown={(event) => onHeaderKeyDown(event, index)}
              >
                <span>{item.question}</span>
                <span className="faqMark" aria-hidden="true">
                  {open ? "−" : "+"}
                </span>
              </button>
            </h3>
            <section id={panelId} aria-labelledby={buttonId} className="faqAnswer" hidden={!open}>
              <AnswerText answer={item.answer} />
              {item.link ? (
                <Button
                  variant="link"
                  size="sm"
                  href={item.link.href}
                  external={item.link.external}
                >
                  {item.link.label}
                </Button>
              ) : null}
            </section>
          </li>
        );
      })}
    </ul>
  );
}
