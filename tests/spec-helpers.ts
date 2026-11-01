// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.
//
// Shared fixtures of the spec tests (the Go package's test helpers).
import { expect } from 'bun:test';
import { colorToRGB, stripAnsi } from '@oakoliver/lipgloss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as heatmap from '../src/heatmap/index.js';
import { pow10 } from '../src/internal/gomath.js';
import { Build, ChartTypeBar, ChartTypeHeatmap, ChartTypeOHLC, ChartTypeSparkline, ScaleLog, type ChartType, type Spec } from '../src/spec/index.js';

/** A deep copy, as assigning a Go struct value copies it. */
export const clone = <T>(x: T): T => structuredClone(x);

/** stripAnsi removes SGR escape sequences so rune positions equal columns. */
export const strip = (s: string): string => s.replace(/\x1b\[[0-9;:]*m/g, '');

export function view(s: Spec): string {
  return Build(s).view();
}

/** viewOf is the view with ANSI styling removed. */
export function viewOf(s: Spec): string {
  return strip(view(s));
}

/** plainRows strips the styling from a model's view, one string per row. */
export function plainRows(m: { view(): string }): string[] {
  return stripAnsi(m.view()).split('\n');
}

/** bgRGB returns a canvas cell's background as RGB, or null if it has none. */
export function bgRGB(m: heatmap.Model, x: number, y: number): { r: number; g: number; b: number } | null {
  return colorToRGB(m.canvas.cell({ x, y }).style.getBackground());
}

/** wantBuildError expects Build(s) to throw exactly want. */
export function wantBuildError(s: Spec, want: string): void {
  let got: string | null = null;
  try {
    Build(s);
  } catch (e) {
    got = (e as Error).message;
  }
  expect(got).toBe(want);
}

/** golden compares got with tests/testdata/spec/<name>.golden. */
export function golden(name: string, got: string): void {
  const want = readFileSync(join(import.meta.dir, 'testdata', 'spec', name + '.golden'), 'utf8');
  expect(got).toBe(want);
}

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;
export const addMs = (t: Date, ms: number): Date => new Date(t.getTime() + ms);

export function barSpec(nSeries: number): Spec {
  const s: Spec = { type: ChartTypeBar, width: 40, height: 10, x_axis: { labels: ['Q1', 'Q2', 'Q3'] }, data: { series: [] } };
  const names = ['rev', 'cost'];
  for (let i = 0; i < nSeries; i++) s.data!.series!.push({ name: names[i], values: [{ y: 3 }, { y: 5 }, { y: 2 }] });
  return s;
}

export function sparkSpec(): Spec {
  return {
    type: ChartTypeSparkline,
    width: 30,
    height: 4,
    data: { series: [{ name: 'cpu', values: [{ y: 1 }, { y: 4 }, { y: 2 }, { y: 7 }, { y: 5 }, { y: 9 }, { y: 3 }] }] },
  };
}

export function heatSpec(): Spec {
  return {
    type: ChartTypeHeatmap,
    width: 30,
    height: 10,
    heat: {
      cells: [
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 0, z: 5 },
        { x: 2, y: 0, z: 9 },
        { x: 0, y: 1, z: 3 },
        { x: 1, y: 1, z: 7 },
        { x: 2, y: 1, z: 2 },
      ],
    },
    theme: { gradient: ['#000044', '#ff4400'] },
  };
}

export function ohlcSpec(): Spec {
  return {
    type: ChartTypeOHLC,
    width: 40,
    height: 12,
    data: {
      series: [
        {
          name: 'px',
          ohlc: [
            { t: '2026-01-05', o: 100, h: 108, l: 97, c: 105 },
            { t: '2026-01-06', o: 105, h: 112, l: 103, c: 110 },
            { t: '2026-01-07', o: 110, h: 111, l: 98, c: 99 },
            { t: '2026-01-08', o: 99, h: 106, l: 96, c: 104 },
          ],
        },
      ],
    },
  };
}

export function rangeSpec(kind: ChartType): Spec {
  return {
    type: kind,
    width: 40,
    height: 10,
    data: {
      series: [
        {
          name: 'price',
          values: [
            { x: 0.0, y: 1 },
            { x: 1000.0, y: 5 },
          ],
          ohlc: [
            { t: 0.0, o: 2, h: 5, l: 1, c: 4 },
            { t: 1000.0, o: 3, h: 5, l: 1, c: 2 },
          ],
        },
      ],
    },
  };
}

/**
 * logSpec returns a chart of the given kind whose Y values (and OHLC
 * low/high) are ys, at X = 1, 10, 100, ... (ms-since-epoch on time axes).
 */
export function logSpec(kind: ChartType, ...ys: number[]): Spec {
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const values = ys.map((y, i) => ({ x: pow10(i), y }));
  const ohlc = ys.map((y, i) => ({ t: pow10(i), o: y, h: hi, l: lo, c: y }));
  return { type: kind, width: 40, height: 14, y_axis: { scale: ScaleLog }, data: { series: [{ name: 'a', values, ohlc }] } };
}
