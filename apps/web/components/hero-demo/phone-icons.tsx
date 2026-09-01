import { type ReactNode, type SVGProps, useId } from "react";

/* Stand-ins for the SF Symbols the SwiftUI viewer uses, drawn on a 24-unit
   grid from the real glyphs (regular weight, ~1.8 stroke at this size) so they
   read the same at phone-mockup sizes. Filled symbols with a knocked-out
   detail (terminal.fill, checkmark.circle.fill, ...) use a mask, so the
   cut-out shows whatever is behind the icon instead of a hard-coded white. */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Stable, url()-safe id for in-SVG references. */
function useKnockout() {
  const id = `i${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return { id, mask: `url(#${id})` };
}

/**
 * Everything drawn inside is knocked out of whatever references the mask.
 * Strokes inside are the knock-out width.
 */
function Knockout({
  id,
  width = 1.9,
  children,
}: {
  id: string;
  width?: number;
  children: ReactNode;
}) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
      <rect width="24" height="24" fill="#fff" />
      <g fill="#000" stroke="#000" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </mask>
  );
}

/* gearshape: eight rounded teeth around a hole. */
function polar(radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return `${(12 + radius * Math.cos(radians)).toFixed(2)} ${(12 + radius * Math.sin(radians)).toFixed(2)}`;
}

const GEAR_PATH = (() => {
  const parts: string[] = [];
  for (let tooth = 0; tooth < 8; tooth += 1) {
    const angle = -90 + tooth * 45;
    parts.push(
      `${tooth === 0 ? "M" : "L"}${polar(10.4, angle - 11)}`,
      `L${polar(10.4, angle + 11)}`,
      `L${polar(7.9, angle + 18.5)}`,
      `L${polar(7.9, angle + 26.5)}`,
    );
  }
  return `${parts.join("")}Z`;
})();

export const Gear = (p: IconProps) => (
  <Icon {...p}>
    <path d={GEAR_PATH} strokeWidth="1.9" />
    <circle cx="12" cy="12" r="3.1" strokeWidth="1.9" />
  </Icon>
);

export const Plus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.5v15M4.5 12h15" strokeWidth="2.1" />
  </Icon>
);

/* bolt.horizontal.circle.fill */
export const BoltCircleFill = (p: IconProps) => {
  const k = useKnockout();
  return (
    <Icon {...p} stroke="none">
      <Knockout id={k.id}>
        <path d="M4.2 13.4 11.8 8.2l-1.2 3.6 9.2-1.4-7.6 5.4 1.2-3.6z" stroke="none" />
      </Knockout>
      <circle cx="12" cy="12" r="10.5" fill="currentColor" mask={k.mask} />
    </Icon>
  );
};

/* terminal.fill: the prompt sits top-left like the real glyph. */
export const TerminalFill = (p: IconProps) => {
  const k = useKnockout();
  return (
    <Icon {...p} stroke="none">
      <Knockout id={k.id} width={1.8}>
        <path d="m6.4 8.6 2.7 2.3-2.7 2.3M10.6 13.4h3.5" fill="none" />
      </Knockout>
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" fill="currentColor" mask={k.mask} />
    </Icon>
  );
};

export const Terminal = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.75" y="4.75" width="18.5" height="14.5" rx="2.9" />
    <path d="m6.4 8.6 2.7 2.3-2.7 2.3M10.6 13.4h3.5" strokeWidth="1.7" />
  </Icon>
);

export const CheckCircleFill = (p: IconProps) => {
  const k = useKnockout();
  return (
    <Icon {...p} stroke="none">
      <Knockout id={k.id} width={2.1}>
        <path d="m7.4 12.4 3.1 3.1 6.2-6.7" fill="none" />
      </Knockout>
      <circle cx="12" cy="12" r="10.5" fill="currentColor" mask={k.mask} />
    </Icon>
  );
};

export const ExclamationCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.6" />
    <path d="M12 7.4v5.8" strokeWidth="1.9" />
    <circle cx="12" cy="16.6" r="1.15" fill="currentColor" stroke="none" />
  </Icon>
);

export const ExclamationTriangleFill = (p: IconProps) => {
  const k = useKnockout();
  return (
    <Icon {...p} stroke="none">
      <Knockout id={k.id} width={2}>
        <path d="M12 9.2v5.2" fill="none" />
        <circle cx="12" cy="17.7" r="1.15" stroke="none" />
      </Knockout>
      <path
        d="M12 3.4 21.2 19.4a1.7 1.7 0 0 1-1.5 2.6H4.3a1.7 1.7 0 0 1-1.5-2.6Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        mask={k.mask}
      />
    </Icon>
  );
};

export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 5.5 6.5 6.5L9 18.5" strokeWidth="2.4" />
  </Icon>
);

export const ChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 5.5-6.5 6.5 6.5 6.5" strokeWidth="2.4" />
  </Icon>
);

/* rectangle.portrait.and.arrow.right */
export const Detach = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 4.5H6.8a2.3 2.3 0 0 0-2.3 2.3v10.4a2.3 2.3 0 0 0 2.3 2.3h6.7a2.3 2.3 0 0 0 2.3-2.3V15.6M15.8 8.4V6.8a2.3 2.3 0 0 0-2.3-2.3" />
    <path d="M10.2 12h11.3M18.2 8.7l3.3 3.3-3.3 3.3" />
  </Icon>
);

/* network */
export const Network = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.5" strokeWidth="1.7" />
    <path
      d="M12 2.5c-3 2.6-4.5 5.8-4.5 9.5s1.5 6.9 4.5 9.5M12 2.5c3 2.6 4.5 5.8 4.5 9.5s-1.5 6.9-4.5 9.5M3.4 9h17.2M3.4 15h17.2"
      strokeWidth="1.5"
    />
  </Icon>
);

/* arrow.triangle.2.circlepath */
export const ArrowsCycle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.2 10.2a7.3 7.3 0 0 1 13.2-2.3M18.9 4.2v4.1h-4.1" strokeWidth="1.9" />
    <path d="M18.8 13.8a7.3 7.3 0 0 1-13.2 2.3M5.1 19.8v-4.1h4.1" strokeWidth="1.9" />
  </Icon>
);

/* point.3.connected.trianglepath.dotted */
export const PeerToPeer = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5.5" cy="6.5" r="2.4" strokeWidth="1.7" />
    <circle cx="18.5" cy="6.5" r="2.4" strokeWidth="1.7" />
    <circle cx="12" cy="18" r="2.4" strokeWidth="1.7" />
    <path
      d="M8.4 6.5h7.2M6.8 8.7l3.9 6.9M17.2 8.7l-3.9 6.9"
      strokeWidth="1.7"
      strokeDasharray="1 2.4"
    />
  </Icon>
);

export const WifiSlash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.3 10.6a10 10 0 0 1 15.4 0M6.9 12.8a6.6 6.6 0 0 1 10.2 0" strokeWidth="1.9" />
    <circle cx="12" cy="16.4" r="1.5" fill="currentColor" stroke="none" />
    <path d="m4.2 4.2 15.6 15.6" strokeWidth="1.9" />
  </Icon>
);

export const Keyboard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="6" width="20" height="12" rx="2.6" strokeWidth="1.7" />
    <path
      d="M5.6 9.6h.01M8.2 9.6h.01M10.8 9.6h.01M13.4 9.6h.01M16 9.6h.01M18.6 9.6h.01M5.6 12.4h.01M8.2 12.4h.01M10.8 12.4h.01M13.4 12.4h.01M16 12.4h.01M18.6 12.4h.01M5.6 15.2h.01M18.6 15.2h.01M8.2 15.2h7.8"
      strokeWidth="1.6"
    />
  </Icon>
);

export const Ellipsis = (p: IconProps) => (
  <Icon {...p} stroke="none">
    <circle cx="5.5" cy="12" r="1.9" fill="currentColor" />
    <circle cx="12" cy="12" r="1.9" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.9" fill="currentColor" />
  </Icon>
);

export const ArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19.5 12h-15M10.5 6l-6 6 6 6" strokeWidth="2" />
  </Icon>
);
export const ArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" strokeWidth="2" />
  </Icon>
);
export const ArrowUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19.5v-15M6 10.5l6-6 6 6" strokeWidth="2" />
  </Icon>
);
export const ArrowDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.5v15M6 13.5l6 6 6-6" strokeWidth="2" />
  </Icon>
);

/* link.badge.plus: two chain links with the plus badge knocked out of them. */
export const LinkBadgePlus = (p: IconProps) => {
  const gap = useKnockout();
  const plus = useKnockout();
  return (
    <Icon {...p}>
      {/* The badge sits in a gap knocked out of the chain. */}
      <Knockout id={gap.id}>
        <circle cx="18.4" cy="18.2" r="5.6" stroke="none" />
      </Knockout>
      <Knockout id={plus.id} width={1.5}>
        <path d="M18.4 16v4.4M16.2 18.2h4.4" fill="none" />
      </Knockout>
      <g mask={gap.mask}>
        <rect x="5.3" y="7.4" width="7" height="12.4" rx="3.5" transform="rotate(-45 8.8 13.6)" />
        <rect x="10.5" y="2.2" width="7" height="12.4" rx="3.5" transform="rotate(-45 14 8.4)" />
      </g>
      <circle cx="18.4" cy="18.2" r="4.3" fill="currentColor" stroke="none" mask={plus.mask} />
    </Icon>
  );
};

/* lock.shield.fill */
export const LockShieldFill = (p: IconProps) => {
  const k = useKnockout();
  return (
    <Icon {...p} stroke="none">
      <Knockout id={k.id} width={1.5}>
        <path d="M9.4 11.2V9.6a2.6 2.6 0 0 1 5.2 0v1.6" fill="none" />
        <rect x="8.2" y="11" width="7.6" height="5.6" rx="1.3" stroke="none" />
      </Knockout>
      <path
        d="M12 2.4 4.4 5.3v6.4c0 4.9 3.3 8.6 7.6 10 4.3-1.4 7.6-5.1 7.6-10V5.3z"
        fill="currentColor"
        mask={k.mask}
      />
    </Icon>
  );
};

export const ArrowRightCircleFill = (p: IconProps) => {
  const k = useKnockout();
  return (
    <Icon {...p} stroke="none">
      <Knockout id={k.id} width={2}>
        <path d="M7.2 12h9.4M12.8 8.2l3.8 3.8-3.8 3.8" fill="none" />
      </Knockout>
      <circle cx="12" cy="12" r="10.5" fill="currentColor" mask={k.mask} />
    </Icon>
  );
};

/* hand.raised */
export const HandRaised = (p: IconProps) => (
  <Icon {...p}>
    <path
      d="M8.4 12.6V5.4a1.3 1.3 0 0 1 2.6 0v5.8M11 11.2V3.9a1.3 1.3 0 0 1 2.6 0v7.3M13.6 11.2V5a1.3 1.3 0 0 1 2.6 0v7.3M16.2 12.3V8.6a1.3 1.3 0 0 1 2.6 0v6.3c0 3.9-2.9 6.7-6.6 6.7-2.7 0-4.5-1.2-5.8-3.3l-2.6-4.2a1.35 1.35 0 0 1 2.2-1.5l2.4 2.9"
      strokeWidth="1.7"
    />
  </Icon>
);

/* doc.text */
export const DocText = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3.5H7.2a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V8.3z" strokeWidth="1.7" />
    <path d="M14 3.5v4.8h4.8M8.6 13h6.8M8.6 16.4h6.8" strokeWidth="1.7" />
  </Icon>
);

export const QuestionmarkCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.6" />
    <path d="M9.5 9.5a2.6 2.6 0 1 1 3.8 2.3c-.9.5-1.3 1.1-1.3 2.1v.2" strokeWidth="1.9" />
    <circle cx="12" cy="16.9" r="1.15" fill="currentColor" stroke="none" />
  </Icon>
);

export const Trash = (p: IconProps) => (
  <Icon {...p}>
    <path
      d="M4.5 6.5h15M9.6 6.5V4.8a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v1.7M6.6 6.5l.9 12.2a1.8 1.8 0 0 0 1.8 1.7h5.4a1.8 1.8 0 0 0 1.8-1.7l.9-12.2M10.1 10l.3 7.4M13.9 10l-.3 7.4"
      strokeWidth="1.7"
    />
  </Icon>
);

/* rectangle.connected.to.line.below */
export const RectangleConnected = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="3.5" width="16" height="11" rx="2" strokeWidth="1.7" />
    <path d="M12 14.5v3.4M4.5 20.6h15" strokeWidth="1.7" />
    <circle cx="12" cy="19.5" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);

export const Spinner = (p: IconProps) => (
  <Icon {...p} className={`iosSpinner ${p.className ?? ""}`} stroke="none">
    {Array.from({ length: 8 }, (_, index) => (
      <rect
        key={index}
        x="11"
        y="2.5"
        width="2"
        height="5.5"
        rx="1"
        fill="currentColor"
        opacity={(index + 1) / 8}
        transform={`rotate(${index * 45} 12 12)`}
      />
    ))}
  </Icon>
);
