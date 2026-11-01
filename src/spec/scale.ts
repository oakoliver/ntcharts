// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// A log axis is drawn by the chart models themselves (linechart.ScaleLog).
// This file holds what the spec adds on top: which chart types may have
// one, the hard errors for values a log axis cannot place, the whole-decade
// range, and the default label format.

import { roundHalfAway } from '../canvas/canvas.js';
import { LOG10E, fma, log, pow10 } from '../internal/gomath.js';
import { sprintV } from '../internal/format.js';
import { FormatFloat, ParseFloat, Quote } from '../internal/strconv.js';
import type { LabelFormatter } from '../linechart/linechart.js';
import { resolveXFloat, yBounds, type yAxisRef } from './build.js';
import { labelFormatter, siSuffixes } from './format.js';
import {
  ChartTypeBar,
  ChartTypeHeatmap,
  ChartTypeOHLC,
  ChartTypeSparkline,
  ChartTypeTimeSeries,
  IsZero,
  ScaleLog,
  type Format,
  type NSpec,
} from './spec.js';

/**
 * @internal checkScaleSupport rejects a log axis on chart types that cannot
 * draw one. Drawing those charts linearly would misrepresent the data.
 */
export function checkScaleSupport(s: NSpec): Error | null {
  const axes = [
    { name: 'x_axis', log: s.x_axis.scale === ScaleLog },
    { name: 'y_axis', log: s.y_axis.scale === ScaleLog },
    { name: 'y2_axis', log: s.y2_axis !== null && s.y2_axis.scale === ScaleLog },
  ];
  for (const axis of axes) {
    if (!axis.log) continue;
    let why: string;
    switch (s.type) {
      case ChartTypeBar:
        why = 'bars are measured linearly from a zero baseline';
        break;
      case ChartTypeHeatmap:
        why = 'its axes are cell indices, not scaled values';
        break;
      case ChartTypeSparkline:
        why = 'columns are measured linearly from zero and it draws no axis';
        break;
      case ChartTypeTimeSeries:
      case ChartTypeOHLC:
        if (axis.name !== 'x_axis') continue;
        why = 'its X axis is time';
        break;
      default:
        continue;
    }
    return new Error(`spec: ${s.type} chart cannot draw ${axis.name} scale ${Quote(ScaleLog)}: ${why}`);
  }
  return null;
}

/** @internal logOK reports whether v can sit on a log axis. */
export function logOK(v: number): boolean {
  return v > 0 && v !== Infinity;
}

/**
 * @internal logValueError names a value a log axis cannot place. where
 * describes it, e.g. `series "a" point 3 has y`.
 */
export function logValueError(axis: string, where: string, v: number): Error {
  return new Error(`spec: ${axis} scale ${Quote(ScaleLog)} requires positive finite values; ${where} = ${sprintV(v)}`);
}

/**
 * @internal logYBounds is yBounds for a log Y axis: it returns the observed
 * minimum and maximum Y of the axis's series, or throws an error naming the
 * first value the axis cannot place.
 */
export function logYBounds(a: yAxisRef): [number, number, boolean] {
  for (const ser of a.series) {
    const values = ser.values ?? [];
    for (let i = 0; i < values.length; i++) {
      if (!logOK(values[i].y)) {
        throw logValueError(a.name, `series ${Quote(ser.name)} point ${i} has y`, values[i].y);
      }
    }
  }
  return yBounds(a.series);
}

/**
 * @internal logXBounds is the X counterpart of logYBounds, over each point's
 * resolved numeric X (see resolveXFloat).
 */
export function logXBounds(s: NSpec): [number, number, boolean] {
  let min = Infinity;
  let max = -Infinity;
  for (const ser of s.data.series ?? []) {
    const values = ser.values ?? [];
    for (let i = 0; i < values.length; i++) {
      const x = resolveXFloat(s, values[i], i);
      if (!logOK(x)) throw logValueError('x_axis', `series ${Quote(ser.name)} point ${i} has x`, x);
      min = goMin(min, x);
      max = goMax(max, x);
    }
  }
  return [min, max, min !== Infinity];
}

/** @internal Go's math.Min: NaN if either is NaN, -0 below +0. */
export function goMin(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  if (a === 0 && b === 0) return Object.is(a, -0) ? a : b;
  return a < b ? a : b;
}

/** @internal Go's math.Max: NaN if either is NaN, +0 above -0. */
export function goMax(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  if (a === 0 && b === 0) return Object.is(a, -0) ? b : a;
  return a > b ? a : b;
}

/**
 * @internal logRange widens a range of positive data values for a log axis.
 * A pinned bound is used exactly; an unpinned one moves out to a power of
 * ten, so the axis ends on a whole decade. If that leaves no range (every
 * value on one power of ten), each unpinned bound moves out a further decade.
 */
export function logRange(min: number, max: number, pinMin: boolean, pinMax: boolean): [number, number] {
  // math.Log10(1000) is 2.9999999999999996: snap before taking the floor
  const decade = (v: number): number => {
    const l = log(v);
    const p = l * LOG10E; // math.Log10(v), inlined
    const r = roundHalfAway(p);
    // Go fuses p - r with the multiply inside math.Log10 on arm64
    if (Math.abs(fma(l, LOG10E, -r)) < 1e-9) return r;
    return p;
  };
  let lo = decade(min);
  let hi = decade(max);
  if (!pinMin) lo = Math.floor(lo);
  if (!pinMax) hi = Math.ceil(hi);
  if (lo >= hi) {
    if (!pinMin) lo--;
    if (!pinMax) hi++;
  }
  if (!pinMin) min = pow10(Math.trunc(lo));
  if (!pinMax) max = pow10(Math.trunc(hi));
  return [min, max];
}

/**
 * @internal resolveLogYRange is resolvePinnedYRange for a log axis. min and
 * max are the data's extremes and the pins are data values, so the
 * one-sided pin rule and its errors are evaluated on real values, and so is
 * the returned range (see logRange). With no data (ok false) an unpinned
 * bound sits one decade from the pinned one, or the range is 1..10.
 */
export function resolveLogYRange(a: yAxisRef, min: number, max: number, ok: boolean): [number, number] {
  const axis = a.axis;
  if (axis.min !== null && !logOK(axis.min)) {
    throw new Error(`spec: ${a.name} scale ${Quote(ScaleLog)} requires a positive finite min; got ${sprintV(axis.min)}`);
  }
  if (axis.max !== null && !logOK(axis.max)) {
    throw new Error(`spec: ${a.name} scale ${Quote(ScaleLog)} requires a positive finite max; got ${sprintV(axis.max)}`);
  }
  if (!ok) {
    min = 1;
    max = 10;
    if (axis.min !== null) max = axis.min * 10;
    else if (axis.max !== null) min = axis.max / 10;
  }
  if (axis.min !== null) min = axis.min;
  if (axis.max !== null) max = axis.max;
  if (min > max) throw new Error(`spec: ${a.name} min ${sprintV(min)} exceeds max ${sprintV(max)}`);
  if (min === max && axis.min !== null && axis.max !== null) throw new Error(`spec: ${a.name} min and max must differ`);
  return logRange(min, max, axis.min !== null, axis.max !== null);
}

/**
 * @internal axisLabelFormatter returns the label formatter for an axis:
 * labelFormatter(f), which is null for a zero Format so charts keep their
 * own default — except on a log axis, where the default is formatLogValue,
 * since the charts' own (a whole number) would print every tick below 1 as 0.
 */
export function axisLabelFormatter(f: Format, scale: string): LabelFormatter | null {
  if (scale === ScaleLog && IsZero(f)) return (_i: number, v: number) => formatLogValue(v);
  return labelFormatter(f);
}

/**
 * @internal formatLogValue is the default label for a log axis, kept short
 * across many decades: three significant digits, trailing zeros dropped,
 * with a k/M/G/T suffix from 1000 up ("1", "31.6", "0.001", "1k", "3.16M").
 * Values under 0.0001 or from 1e15 up fall back to exponent notation ("1e-05").
 */
export function formatLogValue(v: number): string {
  v = ParseFloat(FormatFloat(v, 'e', 2));
  const abs = Math.abs(v);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e15)) return FormatFloat(v, 'g', -1);
  for (const s of siSuffixes) {
    if (abs >= s.factor) return FormatFloat(v / s.factor, 'f', -1) + s.suffix;
  }
  return FormatFloat(v, 'f', -1);
}
