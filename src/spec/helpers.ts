// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import { Parse, goInt64, unixMilli, type GoTime } from '../internal/gotime.js';
import type { DataPoint, GoAny, NDataPoint, XValue } from './spec.js';

/**
 * PointX returns p.x, falling back to shared[index] when p.x is null or
 * absent. If index is outside shared, an omitted X remains null. Neither p
 * nor shared is modified.
 */
export function PointX(p: DataPoint | NDataPoint, index: number, shared: readonly (XValue | null)[] | readonly GoAny[] | null | undefined): XValue | null {
  const x = (p.x ?? null) as XValue | null;
  if (x === null && shared != null && index >= 0 && index < shared.length) return (shared[index] ?? null) as XValue | null;
  return x;
}

// Go's zero time.Time (January 1, year 1, 00:00:00 UTC) as Unix milliseconds.
const zeroTimeMs = -62135596800000;

/**
 * PointTime extracts a time from a DataPoint.x value, accepting a Date, a
 * string (RFC 3339, with or without fractional seconds, or a date
 * "2006-01-02") or numeric milliseconds since the epoch. The boolean result
 * reports whether a time was successfully extracted; on failure the Date is
 * Go's zero time.
 *
 * Strings are parsed exactly as Go's time.Parse parses them with the
 * layouts time.RFC3339Nano, time.RFC3339 and "2006-01-02", in that order.
 * A JavaScript Date keeps milliseconds: fractional seconds below a
 * millisecond are dropped (floored, as Go's UnixMilli does).
 */
export function PointTime(x: unknown): [Date, boolean] {
  const t = pointGoTime(x);
  if (t === null) return [new Date(zeroTimeMs), false];
  return [new Date(t.ms), true];
}

/** @internal pointGoTime is PointTime with Go's nanosecond resolution, or null. */
export function pointGoTime(x: unknown): GoTime | null {
  if (x instanceof Date) return { ms: x.getTime(), ns: 0 };
  if (typeof x === 'string') {
    return Parse('2006-01-02T15:04:05.999999999Z07:00', x) ?? Parse('2006-01-02T15:04:05Z07:00', x) ?? Parse('2006-01-02', x);
  }
  if (typeof x === 'number') return unixMilli(goInt64(x));
  return null;
}

/**
 * @internal pointFloat coerces a DataPoint.x value into a number when the X
 * axis is numeric ("value"). Returns false if x is not a number.
 */
export function pointFloat(x: unknown): [number, boolean] {
  if (typeof x === 'number') return [x, true];
  return [0, false];
}

/** @internal pointString coerces a DataPoint.x value into a string (category axis). */
export function pointString(x: unknown): [string, boolean] {
  if (typeof x === 'string') return [x, true];
  return ['', false];
}

/**
 * @internal isWindowSizeMsg recognises a Bubble Tea WindowSizeMsg by its
 * _tag (see src/internal/msg.ts), with Go's tea.WindowSizeMsg fields.
 */
export function isWindowSizeMsg(msg: unknown): msg is { width: number; height: number } {
  return msg != null && typeof msg === 'object' && (msg as { _tag?: string })._tag === 'WindowSizeMsg';
}
