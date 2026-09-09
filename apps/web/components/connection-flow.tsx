const DESCRIPTION =
  "Connection diagram: your viewer and your shell connect directly over WebRTC with DTLS " +
  "encryption. When a direct path is unavailable, traffic falls back to an authenticated " +
  "WebSocket through the Fly relay, encrypted with TLS in transit.";

const DIRECT_ROUTE = "M126 148 C 276 148, 520 148, 674 148";
const RELAY_ROUTE_IN = "M126 155 C 286 185, 274 288, 400 288";
const RELAY_ROUTE_OUT = "M400 288 C 526 288, 514 185, 674 155";

/**
 * The diagram tells the copy's three steps once, in order, the first time its
 * scene is on screen: the ticket is checked, the direct path comes up and
 * carries a packet, the direct path drops and the relay carries one instead,
 * and the direct path comes back. Then it rests on "direct", which is also the
 * state it is drawn in when motion is off. The timeline lives in landing.css
 * (`--conn-story`); every element here is a keyframe track on that one clock,
 * parked by `data-live` until the section is active.
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
          <path className="connectionRouteLive" d={DIRECT_ROUTE} />
          <path className="connectionRouteRelayLive" d={`${RELAY_ROUTE_IN} ${RELAY_ROUTE_OUT}`} />
          {/* Two packets, one per route, each riding its own offset-path for its
              part of the story (see landing.css). */}
          <circle className="connectionPacket connectionPacketDirect" r="5" />
          <circle className="connectionPacket connectionPacketRelay" r="5" />
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

        <span className="connectionDirectLabel">WebRTC · DTLS</span>
      </div>
    </>
  );
}
