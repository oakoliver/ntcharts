// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// File contains the tick generator for log axes. Linear axes label every
// xStep / yStep cells and do not use it. Nothing here is public API.

import { goInt, roundHalfAway } from '../canvas/canvas.js';
import { LOG10E, fma, log, log10 } from '../internal/gomath.js';
import { goLen } from '../internal/gostr.js';
import type { LabelFormatter } from './linechart.js';
import { ScaleLog, logSnap } from './scale.js';

/**
 * tick is one axis label: a value, the row or column it falls on (counted
 * from the axis origin), and its formatted text.
 * @internal
 */
export interface tick {
  pos: number;
  value: number;
  label: string;
}

/**
 * endSlack is how far, in cells, a tick may be from an end of the axis and
 * still be labelled on the end cell. The end cells read as the range's
 * minimum and maximum, so a value that merely rounds onto one is left out.
 */
const endSlack = 0.25;

/** logValue returns digit * 10^exp, exactly as its decimal literal parses. */
function logValue(digit: number, exp: number): number {
  return Number(`${digit}e${exp}`);
}

/**
 * logAxis describes a log axis to label: the displayed range min..max
 * (sanitized, min < max), laid out over size cells with labels allowed on
 * positions 0..last and at least step cells apart.
 * @internal
 */
export class logAxis {
  min: number;
  max: number;
  size: number;
  last: number;
  step: number;
  format: LabelFormatter;
  /**
   * labelCells reports whether labels run along the axis (X) and so take
   * len(label) cells plus a gap, rather than one row each (Y).
   */
  labelCells: boolean;

  constructor(a: {
    min: number;
    max: number;
    size: number;
    last: number;
    step: number;
    format: LabelFormatter;
    labelCells?: boolean;
  }) {
    this.min = a.min;
    this.max = a.max;
    this.size = a.size;
    this.last = a.last;
    this.step = a.step;
    this.format = a.format;
    this.labelCells = a.labelCells ?? false;
  }

  /**
   * tick returns the label for value v on the cell it falls on, or null if
   * that would put it on an end cell without being at that end.
   */
  tick(v: number): tick | null {
    const exact = (ScaleLog.span(this.min, v) / ScaleLog.span(this.min, this.max)) * this.size;
    const p = Math.max(0, Math.min(goInt(roundHalfAway(exact)), this.last));
    if ((p === 0 && exact > endSlack) || (p === this.last && exact < this.size - endSlack)) {
      return null;
    }
    const t: tick = { pos: p, value: v, label: this.format(p, v) };
    // A label that would run off the end of the axis is never drawn where
    // it falls. On the last cell it is kept for the caller's final-label
    // rule (see overflows); elsewhere it is left out.
    if (this.overflows(t) && p !== this.last) return null;
    return t;
  }

  /**
   * overflows reports whether a label running along the axis would be cut
   * off at the far end if drawn from its own cell.
   */
  overflows(t: tick): boolean {
    return this.labelCells && t.pos + goLen(t.label) > this.size + 1;
  }

  /** clear reports whether tick hi can be drawn after tick lo. */
  clear(lo: tick, hi: tick): boolean {
    let gap = Math.max(this.step, 1);
    if (this.labelCells) gap = Math.max(gap, goLen(lo.label) + 1);
    return hi.pos - lo.pos >= gap;
  }

  /** inRange reports whether v lies in the axis range, allowing for drift at the bounds. */
  inRange(v: number): boolean {
    const p = log10(v);
    // Go fuses the +/- logSnap with the multiply inside math.Log10 on arm64
    return p >= fma(log(this.min), LOG10E, -logSnap) && p <= fma(log(this.max), LOG10E, logSnap);
  }

  /**
   * ticks returns the labels for a log axis, in increasing order:
   *
   *   - every power of ten in the range, thinned to every 2nd, 3rd, ... decade
   *     until neighbours are clear of each other, counting from the maximum
   *     (else the minimum) when that end of the range is a power of ten;
   *   - plus 2x and 5x of each decade where they fit, when unthinned decades
   *     alone give fewer than three labels;
   *   - a value is never labelled on the first or last cell unless it is
   *     within endSlack of that end of the range;
   *   - or, if that leaves fewer than two labels (a narrow range inside one
   *     decade), evenly spaced positions every step cells as on a linear axis.
   */
  ticks(): tick[] {
    if (this.step <= 0 || this.size <= 0 || this.last < 0) return [];
    const lo = goInt(Math.ceil(ScaleLog.forward(this.min) - logSnap));
    const hi = goInt(Math.floor(ScaleLog.forward(this.max) + logSnap));

    // A power of ten on the end of the range is worth labelling: the ends
    // are what tell the reader the range.
    const endMax = Math.abs(ScaleLog.forward(this.max) - hi) < logSnap;
    const endMin = Math.abs(ScaleLog.forward(this.min) - lo) < logSnap;

    // Thin to every stride-th decade, taking the smallest stride that
    // leaves two or more labels clear of each other. final is a last-cell
    // label too long to draw from its own cell. It takes no part in
    // spacing: the caller right-aligns it if there is room left once the
    // other labels are drawn, as for a linear axis.
    let ticks: tick[] = [];
    let final: tick | null = null;
    let stride = 1;
    for (; stride <= Math.max(hi - lo + 1, 1); stride++) {
      // Which decades are kept is a choice of phase. Prefer the one that
      // labels the maximum, then the minimum, then gives the most
      // labels; ties go to exponents that are multiples of the stride.
      let best = -1;
      for (let phase = 0; phase < stride; phase++) {
        const d = this.decades(lo, hi, stride, phase);
        if (d === null) continue;
        const [t, f] = d;
        let score = t.length;
        if (endMax && (hi - phase) % stride === 0 && (f !== null || (t.length > 0 && t[t.length - 1].pos === this.last))) {
          score += 4 * (hi - lo + 2);
        }
        if (endMin && (lo - phase) % stride === 0 && t.length > 0 && t[0].pos === 0) {
          score += 2 * (hi - lo + 2);
        }
        if (score > best) {
          best = score;
          ticks = t;
          final = f;
        }
      }
      // an unthinned axis may fill in with 2x and 5x below
      if (best >= 0 && (stride === 1 || ticks.length >= 2)) break;
    }

    if (stride === 1 && ticks.length < 3) {
      for (let k = lo - 1; k <= hi; k++) {
        for (const digit of [2, 5]) {
          const v = logValue(digit, k);
          if (!this.inRange(v)) continue;
          const t = this.tick(v);
          if (t === null || this.overflows(t)) continue;
          // insert in order if clear of both neighbours
          let i = 0;
          while (i < ticks.length && ticks[i].value < v) i++;
          if ((i > 0 && !this.clear(ticks[i - 1], t)) || (i < ticks.length && !this.clear(t, ticks[i]))) continue;
          ticks.splice(i, 0, t);
        }
      }
    }

    if (final !== null) ticks.push(final);
    if (ticks.length >= 2) return ticks;
    return this.evenTicks();
  }

  /**
   * decades returns the labels for the powers of ten 10^k, lo <= k <= hi,
   * with k = phase modulo stride, and the final label as described in ticks;
   * or null if two of them are not clear of each other.
   */
  decades(lo: number, hi: number, stride: number, phase: number): [tick[], tick | null] | null {
    const ticks: tick[] = [];
    let final: tick | null = null;
    for (let k = lo; k <= hi; k++) {
      if ((k - phase) % stride !== 0) continue;
      const t = this.tick(logValue(1, k));
      if (t === null) continue;
      if (this.overflows(t)) {
        final = t;
        continue;
      }
      const n = ticks.length;
      if (n > 0 && !this.clear(ticks[n - 1], t)) return null;
      ticks.push(t);
    }
    return [ticks, final];
  }

  /**
   * evenTicks labels every step cells from the origin, ending on the last
   * position, with the value the log scale puts there.
   */
  evenTicks(): tick[] {
    const ticks: tick[] = [];
    const increment = ScaleLog.span(this.min, this.max) / this.size;
    for (let i = 0; ; i = Math.min(i + this.step, this.last)) {
      // Go fuses forward(min) + increment*i into one multiply-add on arm64
      let v = ScaleLog.inverse(fma(increment, i, ScaleLog.forward(this.min)));
      if (i === 0) v = this.min;
      else if (i === this.last) v = this.max;
      ticks.push({ pos: i, value: v, label: this.format(i, v) });
      if (i >= this.last) break;
    }
    return ticks;
  }
}
