// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * File contains filled cells and axis labels for index-grid heatmaps: data
 * whose X and Y are cell indices, drawn as a grid of coloured blocks with a
 * name for each row and column.
 *
 * Upstream defines these as methods on the heatmap Model; TypeScript classes
 * cannot span files, so they are functions of the model here and heatmap.ts
 * exposes them as methods.
 */

import { fma } from '../internal/gomath.js';
import type { Color } from '@oakoliver/lipgloss';
import { goInt } from '../canvas/canvas.js';
import { goLen } from '../internal/gostr.js';
import type { HeatPointLike, Model } from './heatmap.js';
import { clamp } from './util.js';

/**
 * graphBox returns the canvas cell of the graphing area's left column and
 * bottom row. The area is GraphWidth() columns by GraphHeight() rows: it
 * runs right from left and up from bottom. The Y axis column and the X axis
 * rows of the underlying linechart are not part of it.
 */
export function graphBox(m: Model): { left: number; bottom: number } {
  let left = m.origin().x;
  let bottom = m.origin().y;
  if (m.yStep() > 0) left++; // the column the Y axis would occupy
  if (m.xStep() > 0) bottom--; // the row the X axis would occupy
  return { left, bottom };
}

/**
 * span returns the half-open range of graph cells [from, to) that the data
 * interval [lo, hi] covers on an axis showing min..max over n cells. Both
 * edges round to the nearest cell boundary, so adjacent data cells tile with
 * neither gap nor overlap, and every data cell covers at least one cell.
 */
export function span(lo: number, hi: number, min: number, max: number, n: number): [number, number] {
  if (max <= min || n <= 0 || hi <= min || lo >= max) return [0, 0];
  // Go on arm64 fuses `x*n + 0.5` into one FMADD (single rounding); gomath.fma reproduces it.
  const f = (v: number): number => clamp(goInt(Math.floor(fma((v - min) / (max - min), n, 0.5))), 0, n);
  let from = f(lo);
  let to = f(hi);
  if (to <= from) {
    to = min1(from + 1, n);
    from = to - 1;
  }
  return [from, to];
}

export function min1(a: number, b: number): number {
  return a < b ? a : b;
}

/**
 * cellSpans returns the graph columns and rows, counted from the left and
 * from the bottom, covered by the data cell centred on (x, y) with the
 * given data-unit size.
 */
export function cellSpans(
  m: Model,
  x: number,
  y: number,
  w: number,
  h: number,
): { c0: number; c1: number; r0: number; r1: number } {
  const [c0, c1] = span(x - w / 2, x + w / 2, m.viewMinX(), m.viewMaxX(), m.graphWidth());
  const [r0, r1] = span(y - h / 2, y + h / 2, m.viewMinY(), m.viewMaxY(), m.graphHeight());
  return { c0, c1, r0, r1 };
}

/** fillCell colours every canvas cell covered by the data cell at pt. */
export function fillCell(m: Model, pt: HeatPointLike, c: Color): void {
  const { left, bottom } = graphBox(m);
  const { c0, c1, r0, r1 } = cellSpans(m, pt.x, pt.y, m.cellW, m.cellH);
  for (let r = r0; r < r1; r++) {
    for (let col = c0; col < c1; col++) {
      const cp = { x: left + col, y: bottom - r };
      const old = m.canvas.getCellStyle(cp);
      if (old == null) continue; // out of bounds
      m.canvas.setCellStyle(cp, old.background(c));
    }
  }
}

/**
 * unit returns the data-unit cell size labels are placed with: the cell
 * size, or one data unit per cell when drawing single-cell points.
 */
export function unit(m: Model): [number, number] {
  let w = m.cellW;
  let h = m.cellH;
  if (w <= 0) w = 1;
  if (h <= 0) h = 1;
  return [w, h];
}

/**
 * drawLabels writes the row labels right-aligned in the margin left of the
 * graph, each on the middle row of its cells, and the column labels on the
 * row under the graph, each starting at the left edge of its cells. A label
 * that would land on the same row as one already drawn, or run into the
 * previous column label, is left out rather than overdrawn.
 */
export function drawLabels(m: Model): void {
  const [w, h] = unit(m);
  const { left, bottom } = graphBox(m);

  const used = new Set<number>();
  m._yLabels.forEach((label, i) => {
    if (label === '') return;
    const { r0, r1 } = cellSpans(m, 0, i, w, h);
    if (r0 === r1) return;
    const row = bottom - Math.trunc((r0 + r1 - 1) / 2);
    const x = m.origin().x - goLen(label);
    if (used.has(row) || x < 0 || row < 0) return;
    used.add(row);
    m.canvas.setStringWithStyle({ x, y: row }, label, m.labelStyle);
  });

  // column labels need the row under the graph, which the X axis rows provide
  if (m.xStep() === 0) return;
  const row = bottom + 1;
  let end = left - 1; // last column used by a drawn label, plus the gap before the next
  m._xLabels.forEach((label, i) => {
    if (label === '') return;
    const { c0, c1 } = cellSpans(m, i, 0, w, h);
    if (c0 === c1) return;
    const x = left + c0;
    if (x <= end || x + goLen(label) > m.width()) return;
    m.canvas.setStringWithStyle({ x, y: row }, label, m.labelStyle);
    end = x + goLen(label);
  });
}

/** SetXLabels names the cell columns; see WithXLabels. */
export function setXLabels(m: Model, labels: string[]): void {
  m._xLabels = labels;
  if (labels.length === 0) return;
  m.autoMinX = false;
  m.autoMaxX = false;
  m.setXRange(-0.5, labels.length - 0.5);
  // upstream calls the embedded linechart's method (m.Model.SetViewXRange) to skip
  // the heatmap's rescale; the heatmap's rescaleData() is a no-op, so this is equivalent
  m.setViewXRange(-0.5, labels.length - 0.5);
  m.updateGraphSizes();
}

/** SetYLabels names the cell rows; see WithYLabels. */
export function setYLabels(m: Model, labels: string[]): void {
  m._yLabels = labels;
  if (labels.length === 0) return;
  m.autoMinY = false;
  m.autoMaxY = false;
  m.setYRange(-0.5, labels.length - 0.5);
  m.setViewYRange(-0.5, labels.length - 0.5);
  // The linechart samples its formatter to size the margin. Heatmap row
  // labels are placed independently of numeric ticks, so reserve the longest
  // label at every sample, including after resizing or changing axis steps.
  let longest = '';
  for (const label of labels) {
    if (goLen(label) > goLen(longest)) longest = label;
  }
  m.yLabelFormatter = () => longest;
  m.updateGraphSizes();
}
