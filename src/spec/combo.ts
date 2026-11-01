// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import { leftAxis, resolvePinnedYRange, resolveYRange, rightAxis, yBounds } from './build.js';
import { PointX } from './helpers.js';
import { goMax, goMin } from './scale.js';
import {
  ChartTypeBar,
  OrientationHorizontal,
  ScaleLinear,
  XAxisCategory,
  YAxisRight,
  normalize,
  type NSpec,
  type Spec,
} from './spec.js';

/**
 * IsCategoricalCombo reports whether a bar spec requests a series type
 * override. ResolveCategoricalCombo validates that the override is supported.
 */
export function IsCategoricalCombo(s: Spec): boolean {
  return isCategoricalCombo(normalize(s));
}

/** @internal */
export function isCategoricalCombo(s: NSpec): boolean {
  if (s.type !== ChartTypeBar) return false;
  return (s.data.series ?? []).some((ser) => ser.type !== '' && ser.type !== 'bar');
}

/**
 * CategoricalCombo is the resolved, shared input for terminal and web
 * renderers. Values are indexed by labels; null means missing, not zero.
 * Series indexes refer to the original spec, preserving palette order even
 * if the line comes first.
 */
export interface CategoricalCombo {
  labels: string[];
  bars: (number | null)[];
  line: (number | null)[];
  barIndex: number;
  lineIndex: number;
  min: number;
  max: number;
  min2: number;
  max2: number;
}

/**
 * ResolveCategoricalCombo accepts a parent bar chart with exactly one left
 * bar and one right line, a y2_axis, and linear categorical axes. Labels are
 * required explicitly (x_axis.labels or data.x_axis_data); sparse points
 * name their category. It does not mutate s. Callers should Validate s
 * first. Throws (Go returns an error) when the combo is unsupported.
 */
export function ResolveCategoricalCombo(s: Spec): CategoricalCombo {
  return resolveCategoricalCombo(normalize(s));
}

/** @internal */
export function resolveCategoricalCombo(s: NSpec): CategoricalCombo {
  const c: CategoricalCombo = { labels: [], bars: [], line: [], barIndex: -1, lineIndex: -1, min: 0, max: 0, min2: 0, max2: 0 };
  const fail = (reason: string): never => {
    throw new Error(`spec: categorical combo: ${reason}`);
  };
  const series = s.data.series ?? [];
  if (s.type !== ChartTypeBar || series.length !== 2 || s.y2_axis === null) {
    fail('requires a bar spec, one left bar, one right line, and y2_axis');
  }
  const y2 = s.y2_axis!;
  if (s.x_axis.type !== '' && s.x_axis.type !== XAxisCategory) fail('x_axis must be category');
  if (s.options.stacked || s.options.orientation === OrientationHorizontal) fail('stacking and horizontal bars are unsupported');
  for (const scale of [s.x_axis.scale, s.y_axis.scale, y2.scale]) {
    if (scale !== '' && scale !== ScaleLinear) fail('only linear scales are supported');
  }
  for (let i = 0; i < series.length; i++) {
    const ser = series[i];
    const typ = ser.type === '' ? s.type : ser.type;
    if (typ === 'bar' && ser.y_axis !== YAxisRight && c.barIndex < 0) c.barIndex = i;
    else if (typ === 'line' && ser.y_axis === YAxisRight && c.lineIndex < 0) c.lineIndex = i;
    else fail('requires exactly one left bar and one right line');
  }
  if (c.barIndex < 0 || c.lineIndex < 0) fail('requires exactly one left bar and one right line');
  c.labels = [...(s.x_axis.labels ?? [])];
  if (c.labels.length === 0) {
    for (const x of s.data.x_axis_data ?? []) {
      if (typeof x !== 'string') fail('shared categories must be strings');
      c.labels.push(x as string);
    }
  }
  if (c.labels.length === 0) fail('requires ordered x_axis.labels or data.x_axis_data');
  const indexes = new Map<string, number>();
  c.labels.forEach((label, i) => {
    if (indexes.has(label)) fail('duplicate category ' + label);
    indexes.set(label, i);
  });
  const values: (number | null)[][] = [[], []];
  for (let i = 0; i < series.length; i++) {
    values[i] = new Array(c.labels.length).fill(null);
    const points = series[i].values ?? [];
    for (let j = 0; j < points.length; j++) {
      const p = points[j];
      if (!Number.isFinite(p.y)) fail('Y values must be finite; omit a point to represent missing data');
      let idx = j;
      const x = PointX(p, j, s.data.x_axis_data);
      if (x !== null) {
        if (typeof x !== 'string') fail('point categories must be strings');
        const k = indexes.get(x as string);
        if (k === undefined) fail('unknown category ' + (x as string));
        idx = k!;
      }
      if (idx >= c.labels.length) fail('more positional values than categories');
      if (values[i][idx] !== null) fail('duplicate point for category ' + c.labels[idx]);
      values[i][idx] = p.y;
    }
  }
  c.bars = values[c.barIndex];
  c.line = values[c.lineIndex];
  for (const a of [leftAxis(s), rightAxis(s)]) {
    for (const pin of [a.axis.min, a.axis.max]) {
      if (pin !== null && !Number.isFinite(pin)) fail('axis bounds must be finite');
    }
  }
  let [lo, hi, ok] = yBounds(leftAxis(s).series);
  if (!ok) {
    lo = 0;
    hi = 0;
  }
  [c.min, c.max] = resolvePinnedYRange(leftAxis(s), goMin(0, lo), goMax(0, hi));
  if (c.min > 0 || c.max < 0) fail('bar range must include zero');
  [c.min2, c.max2] = resolveYRange(rightAxis(s));
  if (Math.abs(c.max - c.min) === Infinity || Math.abs(c.max2 - c.min2) === Infinity) fail('axis span must be finite');
  return c;
}

/**
 * ComboSeriesColor returns a series colour, using the palette in input
 * order and distinct defaults when no colour is supplied.
 */
export function ComboSeriesColor(s: Spec, index: number): string {
  return comboSeriesColor(normalize(s), index);
}

/** @internal */
export function comboSeriesColor(s: NSpec, index: number): string {
  const ser = s.data.series![index];
  if (ser.color !== '') return ser.color;
  const palette = s.theme.palette ?? [];
  if (index < palette.length && palette[index] !== '') return palette[index];
  if (ser.type === 'line') return '#f6ad55';
  return '#63b3ed';
}
