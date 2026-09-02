const DESCRIPTION =
  "Connection diagram: your viewer and your shell connect directly over WebRTC with DTLS " +
  "encryption. When a direct path is unavailable, traffic falls back to an authenticated " +
  "WebSocket through the Fly relay, encrypted with TLS in transit.";

export function ConnectionFlow() {
  return (
    <>
      <p className="visuallyHidden">{DESCRIPTION}</p>
      <div className="connectionFlow" data-live aria-hidden="true">
        <div className="connectionStatus">
          <span />
          direct · DTLS · 14 ms
        </div>

        <svg className="connectionRoutes" viewBox="0 0 800 360" preserveAspectRatio="none">
          <path className="connectionRouteBase" d="M126 148 C 276 148, 520 148, 674 148" />
          <path className="connectionRouteLive" d="M126 148 C 276 148, 520 148, 674 148" />
          <path className="connectionRouteFallback" d="M126 155 C 286 185, 274 288, 400 288" />
          <path className="connectionRouteFallback" d="M400 288 C 526 288, 514 185, 674 155" />
          {/* Moves along the live route with CSS offset-path (see landing.css), so
            it pauses off-scene and stops under reduced motion like everything else. */}
          <circle className="connectionPacket" r="5" />
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
