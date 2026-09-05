"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The ticket card, on a real clock. Viewer tickets live for sixty seconds in
 * the relay, so the meter here drains over sixty actual seconds rather than a
 * stylised loop: a visitor who waits sees the same ticket expire that the copy
 * describes. The clock is wall time, not frames, so it keeps counting while
 * the tab is hidden and shows the truth on return. A fresh ticket is issued
 * once the spent one has sat there long enough to read.
 */

/** Mirrors the viewer-ticket TTL enforced by the relay. */
export const TICKET_TTL_S = 60;
const EXPIRED_HOLD_MS = 2400;
/** The meter stops short of the seconds that sit at its end. */
const METER_LENGTH = 40;
const METER_PATH = `M50 58h${METER_LENGTH}`;
/** Same alphabet the share code uses: no 0/O or 1/I to misread. */
const SERIAL_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const FIRST_SERIAL = "7N4K";

interface Ticket {
  serial: string;
  expiresAt: number;
}

export function TicketArt() {
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [remaining, setRemaining] = useState(TICKET_TTL_S);
  // Both in one batch so a fresh ticket never paints a frame as expired.
  const reissue = useCallback((serial?: string) => {
    setTicket(issue(serial));
    setRemaining(TICKET_TTL_S);
  }, []);

  // Only run the clock while the card can be seen.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The first ticket is issued the first time the card is seen, so the sixty
  // seconds start when the visitor can watch them, not at page load.
  useEffect(() => {
    if (visible && ticket === null) reissue(FIRST_SERIAL);
  }, [visible, ticket, reissue]);

  useEffect(() => {
    if (!ticket || !visible) return;
    const tick = () => setRemaining(secondsLeft(ticket));
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [ticket, visible]);

  useEffect(() => {
    if (!ticket || !visible || remaining > 0) return;
    const handle = window.setTimeout(() => reissue(), EXPIRED_HOLD_MS);
    return () => window.clearTimeout(handle);
  }, [ticket, visible, remaining, reissue]);

  const serial = ticket?.serial ?? FIRST_SERIAL;
  const expired = ticket !== null && remaining === 0;
  const drained = METER_LENGTH * (1 - remaining / TICKET_TTL_S);

  return (
    <svg ref={ref} className="cardArt" viewBox="0 0 200 100" data-live aria-hidden="true">
      {/* Keyed by serial so a fresh ticket drops in rather than morphing. */}
      <g key={serial} className="artTicket" data-phase={expired ? "expired" : "live"}>
        <g filter="url(#artDrop)">
          <path
            className="artFace"
            d="M44 22h112a7 7 0 0 1 7 7v13a9 9 0 0 0 0 18v13a7 7 0 0 1-7 7H44a7 7 0 0 1-7-7V60a9 9 0 0 0 0-18V29a7 7 0 0 1 7-7Z"
          />
        </g>
        <path className="artPerf" d="M126 29v42" />
        <text className="artMono artTicketSerial" x="50" y="46">
          TKT-{serial}
        </text>
        {/* The seconds sit at the end of the meter they count down, not beside
            the serial: the two would overlap on that line. */}
        <path className="artMeterTrack" d={METER_PATH} />
        <path className="artMeter" d={METER_PATH} strokeDashoffset={drained} />
        <text className="artMono artTicketClock" x="112" y="61" textAnchor="end">
          {remaining}s
        </text>
        {/* Kept short of x=154, where the notch bites into the stub. */}
        <g className="artBars">
          <path d="M132 40v22M136.5 40v22M141 40v22M145.5 40v22M150 40v22" />
        </g>
        {/* Stamped over the print once the sixty seconds are gone. */}
        <g className="artStamp">
          <rect x="50" y="39" width="62" height="24" rx="5" />
          <text x="81" y="55" textAnchor="middle">
            EXPIRED
          </text>
        </g>
      </g>
    </svg>
  );
}

function issue(serial = randomSerial()): Ticket {
  return { serial, expiresAt: Date.now() + TICKET_TTL_S * 1000 };
}

function secondsLeft(ticket: Ticket): number {
  return Math.max(0, Math.ceil((ticket.expiresAt - Date.now()) / 1000));
}

function randomSerial(): string {
  let serial = "";
  for (let index = 0; index < 4; index += 1) {
    serial += SERIAL_ALPHABET[Math.floor(Math.random() * SERIAL_ALPHABET.length)];
  }
  return serial;
}
