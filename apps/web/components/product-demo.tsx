"use client";

import Image from "next/image";
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
    <figure className="productStage" aria-label="Wrapper on a MacBook and iOS viewer">
      <div className="macbook">
        <div className="macbookLid" aria-hidden="true" />
        <div className="macbookScreen">
          <Image
            src="/hero-wallpaper.png"
            alt=""
            width={2253}
            height={815}
            className="macWallpaper"
            priority
            quality={90}
            sizes="(max-width: 1023px) 140vw, 62vw"
          />
          <div className="macMenuBar" aria-hidden="true">
            <svg className="macApple" viewBox="-1.06 -0.25 15.26 18.6">
              <path
                fill="currentColor"
                d="M11.4 9.4c0-2.2 1.8-3.2 1.9-3.3-1.1-1.6-2.7-1.8-3.3-1.8-1.4-.1-2.7.8-3.4.8s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 3 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-.9 2.8-2c.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.6zM9.4 2.9c.6-.8 1.1-1.9.9-3-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z"
              />
            </svg>
            <span className="macMenuApp">Finder</span>
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Go</span>
            <span>Window</span>
            <span>Help</span>
            <strong>Mon Jun 10 9:41 AM</strong>
          </div>
          <section className="macWindow" aria-label="wrapper window">
            <header className="macTitlebar">
              <span className="macTraffic" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <h3>wrapper</h3>
            </header>
            <div className="macContent">
              <p>❯ wrapper shell-host</p>
              <p className="isMuted">session 4J8K2P · listening on 127.0.0.1</p>
              <p>❯ ctrl+\ s</p>
              <p>
                shared · invite code <strong>7N4K-WQ2M</strong>
              </p>
              <p className="isMuted">waiting for an authorized viewer…</p>
            </div>
          </section>
        </div>
        <div className="macbookNotch" aria-hidden="true" />
        <div className="macbookCamera" aria-hidden="true" />
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
                <div className="iosStatus" aria-hidden="true">
                  <span>9:41</span>
                  <span className="iosIsland" />
                  <span className="iosStatusIcons">
                    <svg className="iosSignal" viewBox="0 0 17.5 10.7" fill="currentColor">
                      <rect x="0" y="6.5" width="3" height="4.2" rx="0.85" />
                      <rect x="4.83" y="4.47" width="3" height="6.23" rx="0.85" />
                      <rect x="9.67" y="2.23" width="3" height="8.47" rx="0.85" />
                      <rect x="14.5" y="0" width="3" height="10.7" rx="0.85" />
                    </svg>
                    <svg
                      className="iosWifi"
                      viewBox="0 0 13.585 8.697"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    >
                      <path d="M.875 3.24a8.6 8.6 0 0 1 11.835 0" />
                      <path d="M3.046 5.531a5.44 5.44 0 0 1 7.493 0" />
                      <path d="M5.221 7.822a2.28 2.28 0 0 1 3.138 0" />
                    </svg>
                    <svg className="iosBattery" viewBox="0 0 24.7 11.6" fill="currentColor">
                      <rect
                        x="0.5"
                        y="0.5"
                        width="21.8"
                        height="10.6"
                        rx="3.4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        opacity="0.36"
                      />
                      <rect x="2" y="2" width="18.8" height="7.6" rx="2" />
                      <rect x="23.1" y="3.85" width="1.6" height="3.9" rx="0.8" opacity="0.4" />
                    </svg>
                  </span>
                </div>
                <div className="iosTopBar">
                  <span className="iosGlass iosBack" aria-hidden="true">
                    <svg viewBox="0 0 9 16">
                      <path
                        d="M8 1 1.4 8 8 15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <b>2</b>
                  </span>
                  <div className="iosIdentity">
                    <span className="iosAvatar" aria-hidden="true">
                      <Image src="/wrapper-icon-light.svg" alt="" width={54} height={54} />
                    </span>
                    <span className="iosGlass iosName">
                      Wrapper
                      <svg viewBox="0 0 7 12" aria-hidden="true">
                        <path
                          d="M1 1.5 5.5 6 1 10.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                  <span className="iosGlass iosRound" aria-hidden="true">
                    <svg viewBox="0 0 22 14">
                      <rect
                        x="0.8"
                        y="2.2"
                        width="14.5"
                        height="9.6"
                        rx="2.2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <path d="M16.2 5.1 21 2.8v8.4l-4.8-2.3V5.1Z" fill="currentColor" />
                    </svg>
                  </span>
                </div>
                <div className="iosTranscript">
                  <p className="iosTime">
                    <strong>Today</strong> 8:30 AM
                  </p>
                  <p className="iosBubble isIn">session 4J8K2P is live on your Mac</p>
                  <p className="iosBubble isIn">
                    the shell keeps running at home. this device is only a viewer — peer to peer,
                    encrypted with DTLS, and it sees nothing but the pane you shared.
                  </p>
                  <p className="iosBubble isIn">
                    invite code 7N4K-WQ2M is still open. want me to attach?
                  </p>
                  <p className="iosBubble isOut">attach</p>
                  <p className="iosBubble isIn">attached · detach any time with Ctrl+\ d</p>
                </div>
                <div className="iosCompose" aria-hidden="true">
                  <span className="iosGlass iosRound">
                    <svg viewBox="0 0 16 16">
                      <path
                        d="M8 2.2v11.6M2.2 8h11.6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="iosField">iMessage</span>
                </div>
              </div>
            </div>
          </div>
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
    </figure>
  );
}
