import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { NewTabNote } from "../external-link";

/**
 * How much the control asserts itself, from the one action a screen is about
 * down to a plain underlined word. Colour comes from `tone`, so a destructive
 * action can be filled (`primary`) or quiet (`secondary`) without a variant
 * of its own.
 */
export type ButtonVariant = "primary" | "ink" | "secondary" | "ghost" | "link";

export type ButtonTone = "default" | "danger";

/** Heights: 36px in dense chrome, 44px default, 50px for a hero moment. */
export type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  /** Shows a spinner, sets `aria-busy` and blocks interaction. */
  loading?: boolean;
  /** Stretches to the container width. */
  block?: boolean;
  className?: string;
  children: ReactNode;
};

type NativeButtonProps = CommonProps & {
  href?: undefined;
} & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">;

type LinkButtonProps = CommonProps & {
  href: string;
  /** Opens in a new tab and appends the screen-reader disclosure. */
  external?: boolean;
} & Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">;

export type ButtonProps = NativeButtonProps | LinkButtonProps;

/**
 * The one control for every action on the site. Renders a `<button>` by
 * default, a Next `<Link>` when given `href`, and a plain new-tab anchor when
 * `external` is set. Styling lives in `app/controls.css` and is keyed by the
 * `data-variant`, `data-tone` and `data-size` attributes so it can be shared
 * by anything that needs to look like a button without being one.
 */
export function Button(props: ButtonProps) {
  const {
    variant = "secondary",
    tone = "default",
    size = "md",
    loading = false,
    block = false,
    className,
    children,
  } = props;

  const shared = {
    className: ["btn", className].filter(Boolean).join(" "),
    "data-variant": variant,
    "data-tone": tone === "default" ? undefined : tone,
    "data-size": size === "md" ? undefined : size,
    "data-loading": loading ? "" : undefined,
    "data-block": block ? "" : undefined,
    "aria-busy": loading || undefined,
  };

  if (props.href !== undefined) {
    const {
      href,
      external = false,
      variant: _variant,
      tone: _tone,
      size: _size,
      loading: _loading,
      block: _block,
      className: _className,
      children: _children,
      ...linkProps
    } = props;

    // Same-page anchors stay plain <a>s: the landing story listens for the
    // hash change itself and the router has nothing to add.
    if (external || href.startsWith("#")) {
      // Link-only props have no meaning on a raw anchor.
      const { scroll: _scroll, prefetch: _prefetch, replace: _replace, ...anchorProps } = linkProps;
      return (
        <a
          {...anchorProps}
          {...shared}
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
        >
          {children}
          {external ? <NewTabNote /> : null}
        </a>
      );
    }

    return (
      <Link
        {...linkProps}
        {...shared}
        href={href}
        aria-disabled={loading || undefined}
        tabIndex={loading ? -1 : linkProps.tabIndex}
      >
        {children}
      </Link>
    );
  }

  const {
    href: _href,
    variant: _variant,
    tone: _tone,
    size: _size,
    loading: _loading,
    block: _block,
    className: _className,
    children: _children,
    type = "button",
    disabled,
    ...buttonProps
  } = props;

  return (
    <button {...buttonProps} {...shared} type={type} disabled={disabled || loading}>
      {children}
    </button>
  );
}
