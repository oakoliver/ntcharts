// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import type { RGBColor } from '@oakoliver/lipgloss';
import { goLen } from '../internal/gostr.js';
import { fma } from '../internal/gomath.js';
import { Quote } from '../internal/strconv.js';

/** @internal gradientSteps is the resolution of an interpolated color scale. */
export const gradientSteps = 32;

/**
 * @internal gradientScale linearly interpolates ordered "#rrggbb" stops into a
 * gradientSteps-long color scale for heatmap rendering. null/empty stops
 * return null so callers fall back to the chart default. An invalid stop
 * throws.
 */
export function gradientScale(stops: readonly string[] | null | undefined): RGBColor[] | null {
  if (stops == null || stops.length === 0) return null;
  const rgbs = stops.map(parseHexColor);
  if (rgbs.length === 1) rgbs.push(rgbs[0]);
  const out: RGBColor[] = [];
  const segs = rgbs.length - 1;
  for (let i = 0; i < gradientSteps; i++) {
    const q = i / (gradientSteps - 1);
    const t = q * segs;
    let seg = Math.trunc(t);
    if (seg >= segs) seg = segs - 1;
    const frac = fma(q, segs, -seg); // t - seg, fused by Go on arm64
    const a = rgbs[seg];
    const b = rgbs[seg + 1];
    // a + (b-a)*frac, fused by Go on arm64; uint8() truncates
    out.push({
      r: Math.trunc(fma(b[0] - a[0], frac, a[0])) & 0xff,
      g: Math.trunc(fma(b[1] - a[1], frac, a[1])) & 0xff,
      b: Math.trunc(fma(b[2] - a[2], frac, a[2])) & 0xff,
      a: 0xff,
    });
  }
  return out;
}

function parseHexColor(s: string): [number, number, number] {
  const h = s.startsWith('#') ? s.slice(1) : s;
  // strconv.ParseUint(h, 16, 32) on a 6-byte string: hex digits only
  if (goLen(h) !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`spec: gradient stop ${Quote(s)} is not #rrggbb`);
  }
  const v = parseInt(h, 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}
