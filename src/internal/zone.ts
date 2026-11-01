// Structural types for the parts of @oakoliver/bubblezone the charts use.
// ntcharts never imports bubblezone at runtime: you create the manager and
// hand it to a chart, so the package stays optional for string-only use.

/** Mouse message as seen by a zone (x/y are terminal cells). */
export interface ZoneMouse {
  x: number;
  y: number;
}

/** Bounds of a zone found by the manager's last scan. */
export interface ZoneInfo {
  /** Whether the mouse event falls inside the zone. */
  inBounds(msg: ZoneMouse): boolean;
  /** Mouse event position relative to the zone's top left corner, as [x, y]. */
  pos(msg: ZoneMouse): [number, number];
}

/** The subset of a bubblezone Manager that ntcharts uses. */
export interface ZoneManager {
  /** Returns a unique prefix for zone IDs. */
  newPrefix(): string;
  /** Wraps a string with zone markers. */
  mark(id: string, v: string): string;
  /** Returns the zone info for an ID, if it was found by the last scan. */
  get(id: string): ZoneInfo | null | undefined;
}
