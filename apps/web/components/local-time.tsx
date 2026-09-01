"use client";

import { useEffect, useState } from "react";

const SERVER_FORMAT = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
  timeZoneName: "short",
});

/**
 * A timestamp that renders in UTC on the server (so the markup is stable and
 * says which zone it is), then re-renders in the reader's own locale and time
 * zone once on the client.
 */
export function LocalTime({ timestamp }: { timestamp: number }) {
  const date = new Date(timestamp);
  const [label, setLabel] = useState(() => SERVER_FORMAT.format(date));

  useEffect(() => {
    setLabel(
      new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(timestamp),
      ),
    );
  }, [timestamp]);

  return <time dateTime={date.toISOString()}>{label}</time>;
}
