// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import { newStyle, type Style } from '@oakoliver/lipgloss';
import type { Cmd, Msg } from '@oakoliver/bubbletea';
import { NewCellWithStyle, goInt, roundHalfAway, type Float64Point } from '../canvas/canvas.js';
import * as graph from '../canvas/graph/graph.js';
import * as runes from '../canvas/runes/runes.js';
import { fma } from '../internal/gomath.js';
import * as linechart from '../linechart/index.js';
import { checkGraphSize } from './build.js';
import { categoryCenters, drawCategoryLabels } from './category_layout.js';
import { comboSeriesColor, resolveCategoricalCombo, type CategoricalCombo } from './combo.js';
import { isWindowSizeMsg } from './helpers.js';
import { axisLabelFormatter } from './scale.js';
import type { NSpec } from './spec.js';

/**
 * ComboModel renders a resolved categorical bar/line combo. The extended
 * linechart supplies axes, formatting, canvas and view(). draw() and
 * resize() retain the resolved data. Panning/zooming are not supported.
 */
export class ComboModel extends linechart.Model {
  private data!: CategoricalCombo;
  private barStyle!: Style;
  private lineStyle!: Style;

  /** @internal Use Build. */
  constructor() {
    super(0, 0, 0, 0, 0, 0);
  }

  /**
   * Resize recomputes category slots and redraws. Windows too small for the
   * axes have an empty canvas and recover when resized larger.
   */
  override resize(w: number, h: number): void {
    super.resize(Math.max(0, w), Math.max(0, h));
    this.draw();
  }

  /** Update handles window resizing without enabling numeric-axis pan/zoom. */
  override update(msg: Msg): [ComboModel, Cmd] {
    if (isWindowSizeMsg(msg)) this.resize(msg.width, msg.height);
    return [this, null];
  }

  /**
   * Draw paints bars first, then the line, using the same integer category
   * centers. Missing values keep their slots; a missing line value breaks
   * the connection.
   */
  draw(): void {
    this.clear();
    const w = this.graphWidth();
    const h = this.graphHeight();
    if (w < 1 || h < 1) return;
    this.drawXYAxisAndLabel();
    const c = this.data;
    const cv = this.canvas;
    const start = this.origin().x + 1;
    const n = c.labels.length;
    const centers = categoryCenters(w, n);
    const row = (v: number): number => goInt(roundHalfAway(((c.max - v) / (c.max - c.min)) * h));
    const baseline = row(0);
    for (let x = 0; x < w; x++) cv.setCell({ x: start + x, y: baseline }, NewCellWithStyle('─', this.axisStyle));
    drawCategoryLabels(this, c.labels, centers);
    for (let i = 0; i < n; i++) {
      // Partition the entire plot into slots; collisions in dense charts remain
      // deterministic rather than dropping categories or shifting later points.
      const left = Math.trunc((i * w) / n);
      const right = Math.trunc(((i + 1) * w) / n);
      const center = centers[i];
      let width = Math.max(1, Math.trunc(((right - left) * 3) / 4));
      if (width % 2 === 0) width--;
      width = Math.min(width, 2 * Math.min(center, w - 1 - center) + 1);
      const value = c.bars[i];
      if (value !== null && value !== 0) {
        const top = row(Math.max(c.min, Math.min(c.max, value)));
        for (let y = Math.max(0, Math.min(top, baseline)); y <= Math.min(h - 1, Math.max(top, baseline)); y++) {
          for (let x = center - Math.trunc((width - 1) / 2); x <= center + Math.trunc(width / 2); x++) {
            cv.setCell({ x: start + x, y }, NewCellWithStyle('█', this.barStyle));
          }
        }
      }
    }
    // Work in braille-pixel coordinates, anchored to the exact bar centers.
    const g = graph.NewBrailleGrid(w, h, 0, 2 * w - 1, 0, 4 * h - 1);
    const point = (i: number): Float64Point => {
      const v = c.line[i]!;
      // (v-min2)/(max2-min2)*4h - 1, fused by Go on arm64
      let y = fma((v - c.min2) / (c.max2 - c.min2), 4 * h, -1);
      // The lower axis limit sits on the X axis; keep an in-range point
      // in the last plot pixel instead of losing it beneath that axis.
      if (v >= c.min2 && v <= c.max2) y = Math.max(0, Math.min(4 * h - 1, y));
      return { x: 2 * centers[i], y };
    };
    for (let i = 0; i < c.line.length; i++) {
      if (c.line[i] === null) continue;
      let a = point(i);
      let b = point(i);
      if (i + 1 < n && c.line[i + 1] !== null) b = point(i + 1);
      // Clip before interpolation, including segments crossing a pinned range.
      const low = 0;
      const high = 4 * h - 1;
      if ((a.y < low && b.y < low) || (a.y > high && b.y > high)) continue;
      const originalA = a;
      const originalB = b;
      const clip = (p: Float64Point): Float64Point => {
        const y = Math.max(low, Math.min(high, p.y));
        if (y !== p.y) {
          return { x: originalA.x + ((originalB.x - originalA.x) * (y - originalA.y)) / (originalB.y - originalA.y), y };
        }
        return p;
      };
      a = clip(a);
      b = clip(b);
      for (const p of graph.GetLinePoints(g.gridPoint(a), g.gridPoint(b)) ?? []) g.set(p);
    }
    const patterns = g.braillePatterns();
    for (let y = 0; y < patterns.length; y++) {
      const prow = patterns[y];
      for (let x = 0; x < prow.length; x++) {
        const r = prow[x];
        if (r === runes.BrailleBlank) continue;
        const p = { x: start + x, y };
        let style = this.lineStyle;
        const under = cv.cell(p);
        if (under.rune === '█') {
          // A braille rune replaces the entire cell. Carry the solid
          // bar into its background so the line doesn't punch holes.
          style = style.background(under.style.getForeground());
        }
        cv.setCell(p, NewCellWithStyle(r, style));
      }
    }
  }
}

/** @internal buildCombo builds the ComboModel of a categorical bar/line combo spec. */
export function buildCombo(s: NSpec): ComboModel {
  const c = resolveCategoricalCombo(s);
  const barStyle = newStyle().foreground(comboSeriesColor(s, c.barIndex));
  const lineStyle = newStyle().foreground(comboSeriesColor(s, c.lineIndex));
  const opts: linechart.Option[] = [
    linechart.WithXLabelFormatter(() => ''),
    linechart.WithY2Axis({
      min: c.min2,
      max: c.max2,
      labelFormatter: axisLabelFormatter(s.y2_axis!.format, ''),
      labelStyle: lineStyle,
    }),
  ];
  const f = axisLabelFormatter(s.y_axis.format, '');
  if (f !== null) opts.push(linechart.WithYLabelFormatter(f));
  const m = new ComboModel();
  m.setLineChart(linechart.New(s.width, s.height, 0, c.labels.length, c.min, c.max, ...opts));
  m['data'] = c;
  m['barStyle'] = barStyle;
  m['lineStyle'] = lineStyle;
  m.labelStyle = barStyle;
  if (s.theme.foreground !== '') m.axisStyle = newStyle().foreground(s.theme.foreground);
  checkGraphSize(m);
  m.draw();
  return m;
}
