// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// File contains the axis scales of a linechart and the transform between
// data values and positions along an axis. The Model methods of upstream
// scale.go (XScale, SetXScale, ...) live on the Model class in linechart.ts.

import { roundHalfAway } from '../canvas/canvas.js';
import { LOG10E, fma, log, pow, pow10 } from '../internal/gomath.js';

/**
 * logSnap is how close (in decades) a position must be to a whole number
 * to count as a power of ten. It absorbs floating-point drift:
 * Log10(1000) can be 2.9999999999999996, and Pow(10, that) 999.9999999999991.
 */
export const logSnap = 1e-9;

/**
 * Scale selects how values are spaced along a linechart axis.
 * Ranges, data points and label formatter values are in data units on
 * every scale; only the mapping from value to row or column changes.
 *
 * Go's `type Scale int` with methods: here the two values are the
 * singletons ScaleLinear and ScaleLog, compared by identity.
 */
export class Scale {
  /** @internal Use ScaleLinear or ScaleLog. */
  constructor(readonly value: number) {}

  /** String returns "linear" or "log". */
  string(): string {
    return this === ScaleLog ? 'log' : 'linear';
  }

  toString(): string {
    return this.string();
  }

  /**
   * Valid reports whether v has a place on an axis of this scale.
   * Every value is valid on a linear axis; a log axis takes only finite
   * values greater than zero.
   */
  valid(v: number): boolean {
    if (this === ScaleLog) return v > 0 && v !== Infinity;
    return true;
  }

  /**
   * @internal forward maps a valid data value to scale space: its base-10
   * logarithm on a log axis (exact for powers of ten), itself on a linear axis.
   */
  forward(v: number): number {
    if (this !== ScaleLog) return v;
    const l = log(v);
    const p = l * LOG10E; // math.Log10(v), inlined
    const r = roundHalfAway(p);
    // Go fuses p - r with the multiply inside math.Log10 on arm64
    if (Math.abs(fma(l, LOG10E, -r)) < logSnap) return r;
    return p;
  }

  /**
   * @internal inverse maps a scale-space position back to a data value. On a
   * log axis a position within logSnap of a whole number is exactly that power of ten.
   */
  inverse(p: number): number {
    if (this !== ScaleLog) return p;
    const r = roundHalfAway(p);
    if (Math.abs(p - r) < logSnap) return pow10(r);
    return pow(10, p);
  }

  /** @internal span returns the scale-space distance from a to b. */
  span(a: number, b: number): number {
    if (this !== ScaleLog) return b - a;
    return this.forward(b) - this.forward(a);
  }

  /** @internal shift moves v by d in scale space: v+d on a linear axis, v*10^d on a log axis. */
  shift(v: number, d: number): number {
    if (this !== ScaleLog) return v + d;
    return this.inverse(this.forward(v) + d);
  }

  /**
   * @internal sanitize returns a range that an axis of this scale can show. A
   * linear axis takes any range. On a log axis a minimum that is not valid
   * becomes one decade below the maximum, a maximum that is not valid becomes
   * one decade above the minimum, and if neither is valid the range is 1..10.
   */
  sanitize(min: number, max: number): [number, number] {
    if (this !== ScaleLog) return [min, max];
    const okMin = this.valid(min);
    const okMax = this.valid(max);
    if (okMin && okMax) return [min, max];
    if (okMax) return [max / 10, max];
    if (okMin) return [min, min * 10];
    return [1, 10];
  }
}

/** ScaleLinear spaces values evenly along the axis. It is the zero value and the default. */
export const ScaleLinear: Scale = new Scale(0);

/**
 * ScaleLog spaces values by their base-10 logarithm, so each decade
 * takes the same length of axis. Only values greater than zero have a
 * place on a log axis.
 */
export const ScaleLog: Scale = new Scale(1);

/**
 * sanitizeView sanitizes a displayed range and keeps it inside the
 * expected range min..max, falling back to the whole expected range.
 * @internal
 */
export function sanitizeView(s: Scale, viewMin: number, viewMax: number, min: number, max: number): [number, number] {
  if (s !== ScaleLog) return [viewMin, viewMax];
  [viewMin, viewMax] = s.sanitize(viewMin, viewMax);
  viewMin = Math.max(min, viewMin);
  viewMax = Math.min(max, viewMax);
  if (viewMin < viewMax) return [viewMin, viewMax];
  return [min, max];
}

