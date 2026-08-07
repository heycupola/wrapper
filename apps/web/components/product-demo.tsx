"use client";

import { useEffect, useRef, useState } from "react";

const demoVideoUrl = process.env.NEXT_PUBLIC_WRAPPER_DEMO_VIDEO_URL;
const demoPosterUrl = process.env.NEXT_PUBLIC_WRAPPER_DEMO_POSTER_URL;

export function ProductDemo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduceMotion) {
      video.pause();
      setVideoReady(false);
      return;
    }
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      void video.play().then(
        () => setVideoReady(true),
        () => setVideoReady(false),
      );
    }
  }, [reduceMotion]);

  return (
    <div className="productStage" aria-label="Wrapper host and viewer terminal preview">
      <div className="hostTerminal">
        <div className="terminalChrome">
          <div className="terminalDots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span>host · zsh · ~/wrapper</span>
          <span className="terminalSecure">local</span>
        </div>
        <div className="terminalBody">
          <p>
            <span className="prompt">❯</span> wrapper shell-host
          </p>
          <p className="terminalMuted">session 4J8K2P · listening on 127.0.0.1</p>
          <p>
            <span className="prompt">❯</span> <span className="keycap">Ctrl+\</span>{" "}
            <span className="keycap">s</span>
          </p>
          <p>
            <span className="terminalAccent">shared</span> · invite code <strong>7N4K-WQ2M</strong>
          </p>
          <p className="terminalMuted">waiting for an authorized viewer…</p>
        </div>
        <div className="terminalStatus">
          <span>host · 4J8K2P</span>
          <span className="statusLive">
            <i />
            p2p ready
          </span>
        </div>
      </div>

      <div className="connectionPath" aria-hidden="true">
        <span className="connectionPulse" />
      </div>

      <div className="viewerTerminal">
        <div className="viewerNotch" aria-hidden="true" />
        <div className="viewerHeader">
          <span>4J8K2P</span>
          <span className="statusLive">
            <i />
            p2p
          </span>
        </div>
        <div className="viewerBody">
          <p className="terminalMuted">connected securely</p>
          <p>
            <span className="prompt">❯</span> git status
          </p>
          <p>On branch dev</p>
          <p className="terminalAccent">nothing to commit</p>
          <span className="terminalCursor" aria-hidden="true" />
        </div>
        <div className="viewerKeyBar" aria-hidden="true">
          <span>esc</span>
          <span>ctrl</span>
          <span>tab</span>
          <span>↑</span>
          <span>detach</span>
        </div>
      </div>

      {demoVideoUrl ? (
        <video
          ref={videoRef}
          className={`heroVideo ${videoReady ? "isReady" : ""}`}
          autoPlay={!reduceMotion}
          muted
          loop
          playsInline
          poster={demoPosterUrl}
          aria-label="Wrapper product demonstration"
          onCanPlay={() => {
            if (!reduceMotion) setVideoReady(true);
          }}
          onError={() => setVideoReady(false)}
        >
          <source src={demoVideoUrl} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
