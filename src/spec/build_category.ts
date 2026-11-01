// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import type { Cmd, Msg } from '@oakoliver/bubbletea';
import type { Float64Point } from '../canvas/canvas.js';
import * as graph from '../canvas/graph/graph.js';
import { Quote } from '../internal/strconv.js';
import * as linechart from '../linechart/index.js';
import { buildLine, buildScatter, seriesStyle } from './build.js';
import { categoryCenters, drawCategoryLabels } from './category_layout.js';
import { PointX, isWindowSizeMsg } from './helpers.js';
import {
  ChartTypeLine,
  ChartTypeScatter,
  ScaleLog,
  XAxisValue,
  YAxisRight,
  normFormat,
  type NDataPoint,
  type NSeries,
  type NSpec,
} from './spec.js';

/**
 * CategoricalModel renders line or scatter data on ordered category slots.
 * The extended linechart supplies Y scales and formatting. Missing
 * categories retain their slots and break lines. Numeric pan/zoom is
 * disabled.
 */
export class CategoricalModel extends linechart.Model {
  private labels: string[] = [];
  private data!: NSpec; // copied, with each point's X replaced by its category index

  /** @internal Use Build. */
  constructor() {
    super(0, 0, 0, 0, 0, 0);
  }

  /** Resize redraws category slots and labels without discarding the data. */
  override resize(w: number, h: number): void {
    super.resize(Math.max(0, w), Math.max(0, h));
    this.draw();
  }

  /** Update accepts window sizes without allowing numeric category-axis pan/zoom. */
  override update(msg: Msg): [CategoricalModel, Cmd] {
    if (isWindowSizeMsg(msg)) this.resize(msg.width, msg.height);
    return [this, null];
  }

  /**
   * Draw recomputes slot centers from the current plot width. Declared empty
   * categories consume space; dense labels are truncated or skipped, never moved.
   */
  draw(): void {
    this.clear();
    const w = this.graphWidth();
    const h = this.graphHeight();
    if (w < 1 || h < 1) return;
    this.drawXYAxisAndLabel();
    const centers = categoryCenters(w, this.labels.length);
    drawCategoryLabels(this, this.labels, centers);
    const series = this.data.data.series ?? [];
    for (let i = 0; i < series.length; i++) {
      const ser = series[i];
      const style = seriesStyle(ser, i, this.data.theme);
      const y = (v: number): number => (ser.y_axis === YAxisRight ? this.y2ToY(v) : v);
      const values = ser.values ?? [];
      if (this.data.type === ChartTypeScatter) {
        for (const p of values) {
          const center = centers[p.x as number];
          const x = (this.labels.length * center) / Math.max(1, w - 1);
          this.drawRuneWithStyle({ x, y: y(p.y) }, '•', style);
        }
        continue;
      }
      const g = graph.NewBrailleGrid(w, h, 0, 2 * w - 1, 0, 4 * h - 1);
      const point = (p: NDataPoint): Float64Point => {
        const scaled = this.scaleFloat64Point({ x: 0, y: y(p.y) });
        return { x: 2 * centers[p.x as number], y: 4 * scaled.y };
      };
      for (let j = 0; j < values.length; j++) {
        const p = values[j];
        let a = point(p);
        let b = point(p);
        if (j + 1 < values.length && (values[j + 1].x as number) === (p.x as number) + 1) b = point(values[j + 1]);
        const low = 0;
        const high = 4 * h - 1;
        if ((a.y < low && b.y < low) || (a.y > high && b.y > high)) continue;
        const origA = a;
        const origB = b;
        const clip = (q: Float64Point): Float64Point => {
          const v = Math.max(low, Math.min(high, q.y));
          if (v !== q.y) return { x: origA.x + ((origB.x - origA.x) * (v - origA.y)) / (origB.y - origA.y), y: v };
          return q;
        };
        a = clip(a);
        b = clip(b);
        for (const q of graph.GetLinePoints(g.gridPoint(a), g.gridPoint(b)) ?? []) g.set(q);
      }
      graph.DrawBraillePatterns(this.canvas, { x: this.origin().x + 1, y: 0 }, g.braillePatterns(), style);
    }
  }
}

/** @internal buildCategorical builds a line or scatter spec with a category X axis. */
export function buildCategorical(s: NSpec): CategoricalModel {
  if (s.x_axis.scale === ScaleLog) throw new Error('spec: categorical X axis cannot be logarithmic');
  const labels = [...(s.x_axis.labels ?? [])];
  const shared = s.data.x_axis_data ?? [];
  if (labels.length === 0 && shared.length > 0) {
    for (const v of shared) {
      if (typeof v !== 'string') throw new Error('spec: categorical x_axis_data must contain strings');
      labels.push(v);
    }
  }
  if (labels.length === 0) {
    const seen = new Set<string>();
    for (const ser of s.data.series ?? []) {
      for (const p of ser.values ?? []) {
        if (typeof p.x !== 'string') throw new Error('spec: categorical points require string X values or explicit labels');
        if (!seen.has(p.x)) {
          labels.push(p.x);
          seen.add(p.x);
        }
      }
    }
  }
  if (labels.length === 0) throw new Error('spec: categorical chart requires category labels');
  const indexes = new Map<string, number>();
  labels.forEach((label, i) => {
    if (indexes.has(label)) throw new Error(`spec: duplicate category ${Quote(label)}`);
    indexes.set(label, i);
  });
  const series: NSeries[] = [];
  for (const ser of s.data.series ?? []) {
    const values = ser.values ?? [];
    const points: NDataPoint[] = new Array(values.length);
    const used = new Set<number>();
    for (let j = 0; j < values.length; j++) {
      const p = values[j];
      if (!Number.isFinite(p.y)) throw new Error('spec: categorical Y values must be finite; omit missing points');
      let idx = j;
      const x = PointX(p, j, s.data.x_axis_data);
      if (x !== null) {
        if (typeof x !== 'string') throw new Error('spec: categorical point X must be a string');
        const k = indexes.get(x);
        if (k === undefined) throw new Error(`spec: unknown category ${Quote(x)}`);
        idx = k;
      }
      if (idx >= labels.length) throw new Error('spec: more positional points than categories');
      if (s.type === ChartTypeLine && used.has(idx)) {
        throw new Error(`spec: duplicate line point for category ${Quote(labels[idx])} in series ${Quote(ser.name)}`);
      }
      used.add(idx);
      points[j] = { ...p, x: idx };
    }
    // a stable sort, as Go's sort.SliceStable
    if (s.type === ChartTypeLine) points.sort((a, b) => (a.x as number) - (b.x as number));
    series.push({ ...ser, values: ser.values === null ? null : points });
  }
  const data: NSpec = {
    ...s,
    x_axis: { ...s.x_axis, type: XAxisValue, labels: null, format: normFormat(null) },
    data: { series, x_axis_data: null },
  };
  const base = s.type === ChartTypeLine ? buildLine(data) : buildScatter(data);
  base.xLabelFormatter = () => '';
  base.setXRange(0, labels.length);
  base.setViewXRange(0, labels.length);
  const m = new CategoricalModel();
  m.setLineChart(base);
  m['labels'] = labels;
  m['data'] = data;
  m.draw();
  return m;
}
