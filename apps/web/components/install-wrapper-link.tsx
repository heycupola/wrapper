"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { INSTALL_SCENE_ID, rememberLandingScene } from "../lib/landing-scene";

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
      href="/"
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
        if (window.location.pathname !== "/") {
          event.preventDefault();
          window.location.assign("/");
        }
      }}
    >
      {children}
    </Link>
  );
}
