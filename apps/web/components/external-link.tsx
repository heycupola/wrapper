import type { AnchorHTMLAttributes, ReactNode } from "react";

/**
 * Anchor that opens in a new tab and says so. The disclosure is read by
 * screen readers only; sighted users get the browser's own tab change.
 */
export function ExternalLink({
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
      <NewTabNote />
    </a>
  );
}

export function NewTabNote() {
  return <span className="visuallyHidden"> (opens in a new tab)</span>;
}
