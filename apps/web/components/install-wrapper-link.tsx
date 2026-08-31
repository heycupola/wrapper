"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  INSTALL_SCENE_ID,
  OPEN_INSTALL_SCENE_EVENT,
  rememberLandingScene,
} from "../lib/landing-scene";

export function InstallWrapperLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      className={className}
      href="/#start"
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
    </Link>
  );
}
