"use client";

import type { ReactNode } from "react";
import {
  INSTALL_SCENE_ID,
  OPEN_INSTALL_SCENE_EVENT,
  rememberLandingScene,
} from "../lib/landing-scene";
import { Button, type ButtonSize, type ButtonVariant } from "./ui/button";

export function InstallWrapperLink({
  variant = "primary",
  size,
  className,
  children,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      href={`/#${INSTALL_SCENE_ID}`}
      scroll={false}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        rememberLandingScene(INSTALL_SCENE_ID);
        event.preventDefault();
        if (window.location.pathname !== "/") {
          window.location.assign("/");
          return;
        }
        window.dispatchEvent(new Event(OPEN_INSTALL_SCENE_EVENT));
      }}
    >
      {children}
    </Button>
  );
}
