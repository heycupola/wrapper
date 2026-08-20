// Card illustrations. Each one is a small piece of the product drawn the way the
// hero devices are drawn: layered faces, hairlines, soft shadows, real monospace
// text. Structure comes from the text colour at low opacity so both colour
// schemes work from one set of shapes, and the accent is reserved for whatever is
// actually happening. Motion lives in globals.css and stays parked until the
// scene is on screen.

// The shared shadow filter is defined once and referenced by every card.
export function ArtDefs() {
  return (
    <svg className="artDefs" aria-hidden="true" focusable="false">
      <defs>
        <filter id="artDrop" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.8" floodOpacity="0.16" />
        </filter>
      </defs>
    </svg>
  );
}

export function LoopbackArt() {
  return (
    <svg className="cardArt" viewBox="0 0 200 100" data-live aria-hidden="true">
      <rect className="artBoundary" x="8.5" y="10.5" width="183" height="79" rx="18" />
      <text className="artMicro" x="19" y="25">
        your machine
      </text>
      <g filter="url(#artDrop)">
        <rect className="artFace" x="22" y="32" width="90" height="48" rx="10" />
      </g>
      <path className="artHair" d="M22 46h90" />
      <circle className="artTraffic" cx="32" cy="39" r="2.1" />
      <circle className="artTraffic" cx="40" cy="39" r="2.1" />
      <circle className="artTraffic" cx="48" cy="39" r="2.1" />
      <text className="artMono" x="31" y="67">
        127.0.0.1
      </text>
      {/* One pipe out of the socket, around, and straight back into it. The packet
          rides at the pipe's own weight, so it reads as light inside the tube. */}
      <path className="artLoopTrack" d="M112 52h18a12 12 0 0 1 0 24h-18" />
      <path className="artLoopGlow" d="M112 52h18a12 12 0 0 1 0 24h-18" />
      <path className="artLoopFlow" d="M112 52h18a12 12 0 0 1 0 24h-18" />
      <circle className="artPort" cx="112" cy="52" r="1.9" />
      <circle className="artPort" cx="112" cy="76" r="1.9" />
      {/* The one route it never takes, kept clear of the boundary it stops at. */}
      <g className="artBlocked">
        <path d="M150 64h9" />
        <path d="m155.5 60.5 3.5 3.5-3.5 3.5" />
        <path d="m167 60 8 8M175 60l-8 8" />
      </g>
    </svg>
  );
}

export function ShareArt() {
  return (
    <svg className="cardArt" viewBox="0 0 200 100" data-live aria-hidden="true">
      <g className="artKey artKeyFirst">
        <rect className="artKeyEdge" x="50" y="21" width="56" height="31" rx="9" />
        <g className="artKeyPress">
          <rect className="artKeyCap" x="50" y="18" width="56" height="30" rx="9" />
          <text className="artKeyLabel" x="78" y="38" textAnchor="middle">
            ⌃\
          </text>
        </g>
      </g>
      <g className="artKey artKeySecond">
        <rect className="artKeyEdge" x="112" y="21" width="38" height="31" rx="9" />
        <g className="artKeyPress">
          <rect className="artKeyCap" x="112" y="18" width="38" height="30" rx="9" />
          <text className="artKeyLabel" x="131" y="38" textAnchor="middle">
            s
          </text>
        </g>
      </g>
      <g className="artCodeChip">
        <rect className="artChipGlow" x="44" y="62" width="112" height="26" rx="13" />
        <rect className="artChipFace" x="44" y="62" width="112" height="26" rx="13" />
        <text className="artChipText" x="100" y="79" textAnchor="middle">
          4J8K-WQ2M
        </text>
      </g>
    </svg>
  );
}

export function RevokeArt() {
  return (
    <svg className="cardArt" viewBox="0 0 200 100" data-live aria-hidden="true">
      {/* Host on the left, viewer on the right. */}
      <g filter="url(#artDrop)">
        <rect className="artFace" x="10" y="48" width="38" height="26" rx="5" />
        <path className="artFace" d="M6 80h46l-3-5H9Z" />
        <rect className="artFace" x="158" y="42" width="28" height="40" rx="7" />
      </g>
      <rect className="artFace artPhoneNotch" x="167" y="45.5" width="10" height="2.6" rx="1.3" />
      <path className="artHair" d="M167 78.5h10" />
      <path className="artLinkTrack" d="M52 64h102" />
      <path className="artLinkLive artLinkLeft" d="M52 64h51" />
      <path className="artLinkLive artLinkRight" d="M103 64h51" />
      <circle className="artSpark" cx="103" cy="64" r="4" />
      {/* The legs run deep enough to stay seated through the whole swing, and the
          clip cuts them under the body's top hairline so they never show through
          its face. The clip sits on the parent so it stays put while the shackle
          swings, and the shackle takes no shadow of its own: a shadow cast from
          the cut would smear across the body right below the edge. */}
      <clipPath id="artShackleClip">
        <rect x="70" y="0" width="66" height="30.4" />
      </clipPath>
      <g clipPath="url(#artShackleClip)">
        {/* The legs sit inside the body's flat top (x 91–115), so their cut ends
            never overhang the rounded shoulders. */}
        <path className="artShackle" d="M95 42v-18a8 8 0 0 1 16 0v18" />
      </g>
      <g filter="url(#artDrop)">
        <rect className="artLockBody" x="83" y="30" width="40" height="28" rx="8" />
      </g>
      <circle className="artKeyhole" cx="103" cy="42" r="2.6" />
      <path className="artKeyholeStem" d="M103 44v5" />
      <g className="artKey artKeyFirst">
        <rect className="artKeyEdge" x="12" y="17" width="26" height="23" rx="7" />
        <g className="artKeyPress">
          <rect className="artKeyCap" x="12" y="14" width="26" height="22" rx="7" />
          <text className="artKeyLabel" x="25" y="29" textAnchor="middle">
            u
          </text>
        </g>
      </g>
    </svg>
  );
}

export function TicketArt() {
  return (
    <svg className="cardArt" viewBox="0 0 200 100" data-live aria-hidden="true">
      <g className="artTicket">
        <g filter="url(#artDrop)">
          <path
            className="artFace"
            d="M44 22h112a7 7 0 0 1 7 7v13a9 9 0 0 0 0 18v13a7 7 0 0 1-7 7H44a7 7 0 0 1-7-7V60a9 9 0 0 0 0-18V29a7 7 0 0 1 7-7Z"
          />
        </g>
        <path className="artPerf" d="M126 29v42" />
        <text className="artMono artTicketSerial" x="50" y="46">
          TKT-7N4K
        </text>
        <path className="artMeterTrack" d="M50 58h62" />
        <path className="artMeter" d="M50 58h62" />
        {/* Kept short of x=154, where the notch bites into the stub. */}
        <g className="artBars">
          <path d="M132 40v22M136.5 40v22M141 40v22M145.5 40v22M150 40v22" />
        </g>
        {/* Stamped over the print, the way a spent ticket looks. */}
        <g className="artStamp">
          <rect x="50" y="39" width="62" height="24" rx="5" />
          <text x="81" y="55" textAnchor="middle">
            USED
          </text>
        </g>
      </g>
    </svg>
  );
}

export function ShellArt() {
  return (
    <svg className="cardArt cardArtWide" viewBox="0 0 180 84" data-live aria-hidden="true">
      <g filter="url(#artDrop)">
        <rect className="artFace" x="5" y="6" width="170" height="72" rx="12" />
      </g>
      <path className="artHair" d="M5 26h170" />
      <circle className="artLightRed" cx="18" cy="16" r="3" />
      <circle className="artLightAmber" cx="28" cy="16" r="3" />
      <circle className="artLightGreen" cx="38" cy="16" r="3" />
      <text className="artWindowTitle" x="90" y="19.5" textAnchor="middle">
        wrapper
      </text>
      {/* The prompt changes shell, the command does not. */}
      <text className="artShellPrompt artShellZsh" x="16" y="47">
        ➜ ~
      </text>
      <text className="artShellPrompt artShellBash" x="16" y="47">
        bash$
      </text>
      <text className="artShellPrompt artShellFish" x="16" y="47">
        ~ ❯
      </text>
      {/* A real command revealed a character at a time by a growing clip. */}
      <clipPath id="artTypeClip">
        <rect className="artTypeMask" x="52" y="36" width="0" height="16" />
      </clipPath>
      <text className="artCommand" x="52" y="47" clipPath="url(#artTypeClip)">
        wrapper attach
      </text>
      <rect className="artCaret" x="52" y="39" width="2.5" height="10" />
      <text className="artMono artOutput" x="16" y="65">
        attached · 127.0.0.1
      </text>
    </svg>
  );
}
