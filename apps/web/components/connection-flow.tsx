import type { CSSProperties } from "react";

const DESCRIPTION =
  "Connection diagram: your viewer and your shell connect directly over WebRTC with DTLS " +
  "encryption. When a direct path is unavailable, traffic falls back to an authenticated " +
  "WebSocket through the Fly relay, encrypted with TLS in transit.";

const DIRECT_ROUTE = "M126 148 C 276 148, 520 148, 674 148";
const RELAY_ROUTE_IN = "M126 155 C 286 185, 274 288, 400 288";
const RELAY_ROUTE_OUT = "M400 288 C 526 288, 514 185, 674 155";

/* Keystrokes go up to the host, frames come back down: the stream is duplex,
   so packets run both ways on each route. `--i` staggers them along it. */
const DIRECT_PACKETS = [
  { i: 0, back: false },
  { i: 1, back: true },
  { i: 2, back: false },
  { i: 3, back: true },
];
const RELAY_PACKETS = [
  { i: 0, back: false },
  { i: 1, back: true },
  { i: 2, back: false },
];

/**
 * The diagram loops the copy's three steps on one clock while its scene is on
 * screen: the ticket is checked and both ends answer, the direct path comes up
 * and carries traffic both ways, the direct path drops and the relay carries
 * it instead, and the direct path comes back. The timeline lives in
 * landing.css (`--conn-story`); every element here is a keyframe track on that
 * clock, paused by `data-live` until the section is active. With motion off it
 * rests on "direct".
 */
export function ConnectionFlow() {
  return (
    <>
      <p className="visuallyHidden">{DESCRIPTION}</p>
      <div className="connectionFlow" data-live aria-hidden="true">
        <div className="connectionStatus">
          <i className="connectionStatusDot" />
          <b className="connectionStatusLabel isChecking">checking ticket</b>
          <b className="connectionStatusLabel isDirect">direct · DTLS · 14 ms</b>
          <b className="connectionStatusLabel isRelay">relay · WSS · 41 ms</b>
        </div>

        <svg className="connectionRoutes" viewBox="0 0 800 360" preserveAspectRatio="none">
          <path className="connectionRouteBase" d={DIRECT_ROUTE} />
          <path className="connectionRouteFallback" d={RELAY_ROUTE_IN} />
          <path className="connectionRouteFallback" d={RELAY_ROUTE_OUT} />
          <path className="connectionRouteGlow" d={DIRECT_ROUTE} />
          <path className="connectionRouteLive" d={DIRECT_ROUTE} />
          <path className="connectionRouteRelayLive" d={`${RELAY_ROUTE_IN} ${RELAY_ROUTE_OUT}`} />
          <g className="connectionStream connectionStreamDirect">
            {DIRECT_PACKETS.map(({ i, back }) => (
              <circle
                key={i}
                className={back ? "connectionPacket isBack" : "connectionPacket"}
                r={back ? 3.5 : 4.5}
                style={{ "--i": i } as CSSProperties}
              />
            ))}
          </g>
          <g className="connectionStream connectionStreamRelay">
            {RELAY_PACKETS.map(({ i, back }) => (
              <circle
                key={i}
                className={back ? "connectionPacket isBack" : "connectionPacket"}
                r={back ? 3.5 : 4.5}
                style={{ "--i": i } as CSSProperties}
              />
            ))}
          </g>
        </svg>

        <div className="connectionNode connectionViewer">
          <span className="connectionDevice connectionPhone">
            <i />
          </span>
          <small>viewer</small>
          <strong>your viewer</strong>
        </div>

        <div className="connectionNode connectionHost">
          <span className="connectionDevice connectionLaptop">
            <i />
          </span>
          <small>host</small>
          <strong>your shell</strong>
        </div>

        <div className="connectionRelay">
          <strong>Fly relay</strong>
          <span>authenticated WSS · TLS</span>
        </div>

        <span className="connectionDirectLabel">
          <b className="connectionDirectText isUp">WebRTC · DTLS</b>
          <b className="connectionDirectText isDown">no direct path</b>
        </span>
      </div>
    </>
  );
}
