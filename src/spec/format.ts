// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import { roundHalfAway } from '../canvas/canvas.js';
import { formatUnixMilliUTC, goInt64 } from '../internal/gotime.js';
import { FormatFloat } from '../internal/strconv.js';
import type { LabelFormatter } from '../linechart/linechart.js';
import { IsZero, normFormat, type Format } from './spec.js';

/**
 * FormatValue renders v according to f. Zero-valued fields fall back to
 * per-kind defaults; an empty kind renders a plain minimal float.
 */
export function FormatValue(f: Format, v: number): string {
  const n = normFormat(f);
  let prec = n.precision ?? -1;
  switch (n.kind) {
    case 'percent':
      if (prec < 0) prec = 0;
      return FormatFloat(v * 100, 'f', prec) + '%';
    case 'currency': {
      if (prec < 0) prec = 2;
      const sym = n.currency === '' ? '$' : n.currency;
      return sym + FormatFloat(v, 'f', prec);
    }
    case 'si':
      return formatSI(v, prec);
    case 'time': {
      const layout = n.layout === '' ? '2006-01-02' : n.layout;
      return formatUnixMilliUTC(goInt64(roundHalfAway(v)), layout);
    }
    default: // "" or "number"
      return FormatFloat(v, 'f', prec);
  }
}

/** @internal */
export const siSuffixes: { factor: number; suffix: string }[] = [
  { factor: 1e12, suffix: 'T' },
  { factor: 1e9, suffix: 'G' },
  { factor: 1e6, suffix: 'M' },
  { factor: 1e3, suffix: 'k' },
];

function formatSI(v: number, prec: number): string {
  if (prec < 0) prec = 1;
  const abs = Math.abs(v);
  for (const s of siSuffixes) {
    if (abs >= s.factor) return FormatFloat(v / s.factor, 'f', prec) + s.suffix;
  }
  return FormatFloat(v, 'f', prec);
}

/**
 * @internal labelFormatter bridges a Format to the linechart label-formatter
 * hook (Go's Format.labelFormatter). A zero Format returns null so charts
 * keep their own defaults.
 */
export function labelFormatter(f: Format): LabelFormatter | null {
  if (IsZero(f)) return null;
  return (_i: number, v: number) => FormatValue(f, v);
}
