import { Fragment, type ReactNode } from "react";

/**
 * Renders an FAQ answer string: blank lines split paragraphs, backticks wrap
 * inline code. Kept deliberately tiny; anything richer belongs in the docs.
 */
export function AnswerText({ answer }: { answer: string }) {
  return (
    <>
      {answer.split(/\n{2,}/).map((paragraph) => (
        <p key={paragraph}>{renderInlineCode(paragraph)}</p>
      ))}
    </>
  );
}

function renderInlineCode(text: string): ReactNode {
  if (!text.includes("`")) return text;
  const nodes: ReactNode[] = [];
  let offset = 0;
  let inCode = false;
  for (const part of text.split("`")) {
    // The character offset is stable and unique per segment, unlike its text.
    const key = `${offset}:${inCode ? "c" : "t"}`;
    nodes.push(inCode ? <code key={key}>{part}</code> : <Fragment key={key}>{part}</Fragment>);
    offset += part.length + 1;
    inCode = !inCode;
  }
  return nodes;
}
