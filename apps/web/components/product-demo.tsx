"use client";

import { useCallback, useRef } from "react";
import { DemoGuide, KeycapTrail } from "./hero-demo/demo-guide";
import { MacDock, MacMenuBar } from "./hero-demo/mac-desktop";
import { type DemoAction, guideStep, hostTransport } from "./hero-demo/demo-session";
import { MacTerminal } from "./hero-demo/mac-terminal";
import { PhoneApp } from "./hero-demo/phone-app";
import { useWrapperAnnouncements } from "./hero-demo/terminal-view";
import { useCoarsePointer } from "./hero-demo/use-coarse-pointer";
import { useDemoAutoplay } from "./hero-demo/use-demo-autoplay";
import { useDemoSession } from "./hero-demo/use-demo-session";
import { useWindowDrag } from "./hero-demo/use-window-drag";

/**
 * The hero: a MacBook running the wrapped shell and an iPhone running the
 * viewer, both live. Everything on screen is rendered from one shared state
 * machine (`hero-demo/demo-session.ts`), so what the visitor types on the Mac
 * is what the phone shows, and sharing from the shell is what makes the
 * session appear in the app.
 *
 * With a keyboard the visitor types the loop. On touch the shell is display
 * only: the loop plays itself once when the stage comes into view, and the
 * guide's buttons and the phone let the visitor take over at any point.
 */
export function ProductDemo() {
  const { state, send, keycaps } = useDemoSession();
  const liveRef = useWrapperAnnouncements(state);
  const stageRef = useRef<HTMLElement>(null);
  const windowRef = useRef<HTMLElement>(null);
  const touch = useCoarsePointer();
  // The window's drag offset lives on the screen so the guide notes and the
  // keycap trail, which annotate the window, move with it.
  const drag = useWindowDrag(windowRef);
  const { stop } = useDemoAutoplay(stageRef, state, send, touch);
  // Anything the visitor does ends the scripted run before it is applied.
  const sendFromVisitor = useCallback(
    (action: DemoAction) => {
      stop();
      send(action);
    },
    [send, stop],
  );

  return (
    <figure
      ref={stageRef}
      className="productStage demoStage"
      aria-label="Interactive demo: Wrapper on a MacBook and the iOS viewer"
      data-demo-step={guideStep(state)}
      data-demo-transport={hostTransport(state)}
      data-demo-viewer={state.viewer.screen}
      data-demo-input={touch ? "touch" : "keyboard"}
      data-live=""
    >
      <div className="macbook">
        <div className="macbookLid">
          <div
            className="macbookScreen"
            style={drag.style}
            data-window-low={drag.low ? "" : undefined}
          >
            <div className="macWallpaper" aria-hidden="true" />
            <MacMenuBar />
            <MacTerminal
              state={state}
              send={sendFromVisitor}
              windowRef={windowRef}
              drag={drag}
              touch={touch}
            />
            <DemoGuide state={state} send={sendFromVisitor} />
            {touch ? null : <KeycapTrail keycaps={keycaps} />}
            <MacDock />
          </div>
          <div className="macbookNotch" aria-hidden="true">
            <i className="macbookCamera" />
          </div>
        </div>
        <div className="macbookBase" aria-hidden="true" />
      </div>

      <div className="iphone">
        <i className="iphoneKey isLeft isAction" aria-hidden="true" />
        <i className="iphoneKey isLeft isVolumeUp" aria-hidden="true" />
        <i className="iphoneKey isLeft isVolumeDown" aria-hidden="true" />
        <i className="iphoneKey isRight isPower" aria-hidden="true" />
        <div className="iphoneShell">
          <div className="iphoneRing">
            <div className="iphoneBezel">
              <div className="iphoneScreen">
                <PhoneApp state={state} send={sendFromVisitor} touch={touch} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p ref={liveRef} className="visuallyHidden" aria-live="polite" />
    </figure>
  );
}
