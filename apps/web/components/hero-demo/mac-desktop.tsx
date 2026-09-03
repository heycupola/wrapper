import Image from "next/image";

/**
 * The parts of the macOS desktop that frame the demo: an abstract menu bar
 * (pills instead of legible menu titles, so it reads as chrome rather than
 * copy) and a Dock. Both are decorative.
 */
export function MacMenuBar() {
  return (
    <div className="macMenuBar isAbstract" aria-hidden="true">
      <svg className="macApple" viewBox="-1.06 -0.25 15.26 18.6">
        <path
          fill="currentColor"
          d="M11.4 9.4c0-2.2 1.8-3.2 1.9-3.3-1.1-1.6-2.7-1.8-3.3-1.8-1.4-.1-2.7.8-3.4.8s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 3 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-.9 2.8-2c.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.6zM9.4 2.9c.6-.8 1.1-1.9.9-3-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z"
        />
      </svg>
      <i className="macMenuPill isApp" />
      <i className="macMenuPill" data-w="2.3" />
      <i className="macMenuPill" data-w="1.9" />
      <i className="macMenuPill" data-w="2.1" />
      <i className="macMenuPill" data-w="2.9" />
      <i className="macMenuPill" data-w="3.1" />
      <i className="macMenuPill" data-w="2" />
      <span className="macMenuStatus">
        <i className="macMenuDot" />
        <i className="macMenuDot" />
        <i className="macMenuPill" data-w="1.6" />
        {/* The tile flips with the colour scheme like the pills around it. */}
        <Image
          src="/wrapper-icon-light.svg"
          alt=""
          width={20}
          height={20}
          className="macMenuIcon isLightScheme"
        />
        <Image
          src="/wrapper-icon-dark.svg"
          alt=""
          width={20}
          height={20}
          className="macMenuIcon isDarkScheme"
        />
        <i className="macMenuPill" data-w="3.4" />
      </span>
    </div>
  );
}

/**
 * Dock apps, in the order they appear. System icons are the real macOS
 * artwork (256px renders from the .icns files), with the same transparent
 * margin around the tile that macOS draws. Icons that ship as a plain square
 * (Claude's, our own) are clipped into the macOS tile shape so they sit on the
 * same grid; a "free" icon has no tile and is only scaled to the grid.
 */
type DockApp = {
  name: string;
  src: string;
  shape?: "tile" | "free";
  running?: boolean;
};
type DockItem = DockApp | { divider: string };

/* Four is enough to read as a Dock without competing with the terminal: the
   two system apps, then the agent tools people run inside it. Wrapper has no
   Dock icon of its own — it lives inside Terminal, which is what the running
   dot says (Finder's is always on, as on a real Mac). */
const DOCK_APPS: DockItem[] = [
  { name: "Finder", src: "/dock/finder.png", running: true },
  { name: "Terminal", src: "/dock/terminal.png", running: true },
  { divider: "system-apps" },
  { name: "Cursor", src: "/dock/cursor.png" },
  { name: "Claude", src: "/dock/claude.png", shape: "tile" },
];

/* macOS app-icon tile: 82% of the canvas, corners at ~22.5% of the tile. */
const TILE = { x: 9, size: 82, radius: 18.5 };

const slug = (name: string) => name.toLowerCase().replace(/\W+/g, "-");

export function MacDock() {
  return (
    <div className="macDock" aria-hidden="true">
      {DOCK_APPS.map((app) =>
        "divider" in app ? (
          <i key={app.divider} className="macDockDivider" />
        ) : (
          <span
            key={app.name}
            className={`macDockIcon ${app.shape === "free" ? "isFree" : ""}`}
            title={app.name}
          >
            {app.shape === "tile" ? (
              <svg viewBox="0 0 100 100">
                <clipPath id={`dock-tile-${slug(app.name)}`}>
                  <rect
                    x={TILE.x}
                    y={TILE.x}
                    width={TILE.size}
                    height={TILE.size}
                    rx={TILE.radius}
                  />
                </clipPath>
                <image
                  href={app.src}
                  x="9"
                  y="9"
                  width="82"
                  height="82"
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#dock-tile-${slug(app.name)})`}
                />
              </svg>
            ) : (
              <Image src={app.src} alt="" width={256} height={256} />
            )}
            {app.running ? <i className="macDockRunning" /> : null}
          </span>
        ),
      )}
    </div>
  );
}
