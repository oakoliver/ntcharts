// Port of upstream linechart/{linechart,golden,axis,scale}_test.go.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newStyle } from '@oakoliver/lipgloss';
import type { Float64Point } from '../src/canvas/canvas.js';
import * as runes from '../src/canvas/runes/runes.js';
import { sprintfF, sprintV } from '../src/internal/format.js';
import { log10 } from '../src/internal/gomath.js';
import {
  type Axis,
  DefaultLabelFormatter,
  type LabelFormatter,
  type Model,
  New,
  ScaleLinear,
  ScaleLog,
  WithAutoXYRange,
  WithAutoYRange,
  WithStyles,
  WithXLabelFormatter,
  WithXScale,
  WithXYSteps,
  WithY2Axis,
  WithYLabelFormatter,
  WithYScale,
  XAxisUpdateHandler as linechartX,
  YAxisUpdateHandler as linechartY,
} from '../src/linechart/index.js';

const defaultStyle = newStyle();
const key = (s: string) => ({ _tag: 'KeyPressMsg', toString: () => s });

function golden(name: string, got: string): void {
  const want = readFileSync(join(import.meta.dir, 'testdata', 'linechart', name + '.golden'), 'utf8');
  expect(got).toBe(want);
}

// trimView returns the chart's view with trailing spaces removed per line.
function trimView(m: Model): string {
  return m
    .view()
    .split('\n')
    .map((l) => l.replace(/ +$/, ''))
    .join('\n');
}

function wantView(m: Model, want: string): void {
  expect(trimView(m)).toBe(want.replace(/^\n+|\n+$/g, ''));
}

const chars = (s: string) => Array.from(s);

// yTickRows returns label -> rows above the X axis for every Y label drawn.
function yTickRows(m: Model): Record<string, number> {
  const rows: Record<string, number> = {};
  m.view()
    .split('\n')
    .forEach((line, i) => {
      if (i > m.origin().y) return;
      const l = chars(line).slice(0, m.origin().x).join('').trim();
      if (l !== '') rows[l] = m.origin().y - i;
    });
  return rows;
}

function xLabels(m: Model): string[] {
  const lines = m.view().split('\n');
  return lines[lines.length - 1].split(/\s+/).filter((s) => s !== '');
}

// rows returns the view's lines with trailing spaces removed.
const rows = (m: Model) => trimView(m).split('\n');

// rightOf returns each line of the view from column x on.
const rightOf = (m: Model, x: number) =>
  m
    .view()
    .split('\n')
    .map((line) => chars(line).slice(x).join(''));

// y2TickRows returns label -> rows above the X axis for every right Y label.
function y2TickRows(m: Model): Record<string, number> {
  const got: Record<string, number> = {};
  m.view()
    .split('\n')
    .forEach((line, i) => {
      if (i > m.origin().y) return;
      const l = chars(line).slice(m.graphRight() + 1).join('').trim();
      if (l !== '') got[l] = m.origin().y - i;
    });
  return got;
}

const approx = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.abs(b);

// labels sorted bottom to top
const sortedLabels = (r: Record<string, number>) => Object.keys(r).sort((a, b) => r[a] - r[b]);

const fmtV: LabelFormatter = (_i, v) => sprintV(v);

const cell = (m: Model, x: number, y: number) => m.canvas.cell({ x, y }).rune;

describe('linechart_test.go', () => {
  test('TestNew', () => {
    const [w, h] = [30, 15];
    const lc = New(w, h, -5, 10, -5, 10, WithXYSteps(1, 2));
    expect(lc.width()).toBe(w);
    expect(lc.height()).toBe(h);
    expect(lc.graphWidth()).toBe(w - 3);
    expect(lc.graphHeight()).toBe(h - 2);
    expect([lc.minX(), lc.maxX(), lc.minY(), lc.maxY()]).toEqual([-5, 10, -5, 10]);
  });

  test('TestDrawYLabelDrawsTopLabelWhenGraphHeightNotDivisibleByStep', () => {
    const lc = New(20, 15, 0, 10, 0, 13, WithXYSteps(1, 2), WithYLabelFormatter((i) => (i === 13 ? 'T' : '_')));
    expect(lc.graphHeight()).toBe(13);
    lc.drawXYAxisAndLabel();
    expect(cell(lc, lc.origin().x - 1, lc.origin().y - lc.graphHeight())).toBe('T');
  });

  test('TestDrawXLabelDrawsRightmostLabelWhenGraphWidthNotDivisibleByStep', () => {
    const lc = New(19, 10, 0, 16, 0, 10, WithXYSteps(2, 2), WithYLabelFormatter(() => '_'));
    const last = lc.graphWidth() - 1;
    expect(last).toBeGreaterThan(0);
    lc.xLabelFormatter = (i) => (i === last ? 'R' : '_');
    lc.drawXYAxisAndLabel();
    expect(cell(lc, lc.origin().x + last, lc.origin().y + 1)).toBe('R');
  });

  test('TestDrawXLabelFinalTickUsesTrueAxisMaximum', () => {
    const lc = New(19, 10, 0, 9, 0, 10, WithXYSteps(2, 2), WithYLabelFormatter(() => '_'));
    const last = lc.graphWidth() - 1;
    expect(last).toBeGreaterThan(0);
    lc.drawXYAxisAndLabel();
    expect(cell(lc, lc.origin().x + last, lc.origin().y + 1)).toBe(sprintfF(lc.viewMaxX(), 0));
  });

  test('TestDrawXLabelFallbackPreservesEarlierLabels', () => {
    const m = New(20, 5, 0, 100, 0, 10, WithXYSteps(4, 0), WithXLabelFormatter((i, v) => (v === 100 ? 'FINAL_MAXIMUM' : String(i))));
    m.drawXYAxisAndLabel();
    for (const x of [8, 12, 16]) expect(cell(m, x, 4)).toBe(String(x)[0]);
  });

  describe('TestDrawXLabelEdgeCases', () => {
    for (const tc of [
      { name: 'one column', width: 1, min: 0, max: 9, format: DefaultLabelFormatter(), want: '9' },
      { name: 'negative maximum', width: 10, min: -100, max: -10, format: DefaultLabelFormatter(), want: '-100   -10' },
      { name: 'repeat', width: 10, min: 0, max: 10, format: () => 'same', want: 'same      ' },
      { name: 'too wide', width: 3, min: 0, max: 10, format: () => 'oversized', want: '   ' },
    ]) {
      test(tc.name, () => {
        const m = New(tc.width, 5, tc.min, tc.max, 0, 10, WithXYSteps(100, 0), WithXLabelFormatter(tc.format));
        m.drawXYAxisAndLabel();
        let row = '';
        for (let x = 0; x < tc.width; x++) {
          const r = cell(m, x, 4);
          row += runes.isNull(r) ? ' ' : r;
        }
        expect(row).toBe(tc.want);
      });
    }
  });

  test('TestDefaultLabelFormatterNoNegativeZero', () => {
    const f = DefaultLabelFormatter();
    for (const [v, want] of [
      [0, '0'],
      [-0, '0'],
      [-0.3, '0'],
      [-0.5, '0'],
      [0.3, '0'],
      [-0.6, '-1'],
      [-2, '-2'],
      [2.4, '2'],
    ] as [number, string][]) {
      expect(f(0, v)).toBe(want);
    }
  });

  test('TestTopYLabelReservesWidthBetweenSteps', () => {
    const lc = New(44, 15, 0, 6, 0, 1, WithXYSteps(1, 2), WithYLabelFormatter((i) => (i === 13 ? '100%' : '0%')));
    lc.drawXYAxisAndLabel();
    expect(lc.origin().x).toBe(4);
    chars('100%').forEach((want, x) => expect(cell(lc, x, 0)).toBe(want));
  });
});

const linearPath: Float64Point[] = [
  { x: -5, y: -3 },
  { x: 0, y: 4 },
  { x: 4, y: 1 },
  { x: 10, y: 7 },
];
const logPath: Float64Point[] = [
  { x: 1, y: 1 },
  { x: 10, y: 50 },
  { x: 100, y: 20 },
  { x: 1000, y: 1000 },
];

// drawPath draws the axes, then line runes through pts.
function drawPath(m: Model, pts: Float64Point[]): void {
  m.drawXYAxisAndLabel();
  for (let i = 1; i < pts.length; i++) m.drawLine(pts[i - 1], pts[i], runes.ArcLineStyle);
}

describe('golden_test.go', () => {
  const cases: Record<string, () => Model> = {
    linear: () => {
      const m = New(30, 12, -5, 10, -3, 7, WithXYSteps(2, 2));
      drawPath(m, linearPath);
      m.drawRune({ x: 2, y: 2 }, 'x');
      return m;
    },
    no_x_axis: () => {
      const m = New(30, 12, -5, 10, -3, 7, WithXYSteps(0, 2));
      drawPath(m, linearPath);
      return m;
    },
    no_y_axis: () => {
      const m = New(30, 12, -5, 10, -3, 7, WithXYSteps(2, 0));
      drawPath(m, linearPath);
      return m;
    },
    odd_height: () => {
      const m = New(30, 10, -5, 10, -3, 7, WithXYSteps(2, 3)); // graphHeight 8
      drawPath(m, linearPath);
      return m;
    },
    log_y: () => {
      const m = New(30, 12, 1, 1000, 1, 1000, WithXYSteps(2, 2), WithYScale(ScaleLog));
      drawPath(m, logPath);
      return m;
    },
    log_x: () => {
      const m = New(40, 12, 1, 1000, 1, 1000, WithXYSteps(2, 2), WithXScale(ScaleLog));
      drawPath(m, logPath);
      return m;
    },
    zoom_in: () => {
      const m = New(30, 12, -5, 10, -3, 7, WithXYSteps(2, 2));
      m.zoomIn(1, 1);
      drawPath(m, linearPath);
      return m;
    },
    move_up: () => {
      const m = New(30, 12, -5, 10, -3, 7, WithXYSteps(2, 2));
      m.setViewYRange(-3, 3);
      m.moveUp(2);
      drawPath(m, linearPath);
      return m;
    },
    auto_range: () => {
      const m = New(30, 12, 0, 1, 0, 1, WithXYSteps(2, 2), WithAutoXYRange());
      for (const p of linearPath) m.autoAdjustRange(p);
      m.updateGraphSizes();
      drawPath(m, linearPath);
      return m;
    },
    braille: () => {
      const m = New(30, 12, -5, 10, -3, 7, WithXYSteps(2, 2));
      m.drawXYAxisAndLabel();
      for (let i = 1; i < linearPath.length; i++) m.drawBrailleLine(linearPath[i - 1], linearPath[i]);
      return m;
    },
    circles: () => {
      const m = New(30, 12, -10, 10, -10, 10, WithXYSteps(2, 2));
      m.drawXYAxisAndLabel();
      m.drawRuneCircle({ x: 0, y: 0 }, 5, 'o');
      m.drawBrailleCircle({ x: 3, y: 3 }, 4);
      return m;
    },
  };
  for (const [name, build] of Object.entries(cases)) {
    test(`TestGoldenOneAxis/${name}`, () => golden('oneaxis_' + name, build().view()));
  }
});

describe('axis_test.go', () => {
  test('TestYAxisReflectsLeftAxis', () => {
    const label = newStyle().foreground(6);
    const m = New(30, 12, 0, 10, -5, 5, WithAutoYRange(), WithStyles(defaultStyle, label, defaultStyle));
    m.setViewYRange(-2, 3);
    const a = m.yAxis();
    expect([a.min, a.max, a.viewMin, a.viewMax, a.scale, a.autoMin, a.autoMax]).toEqual([-5, 5, -2, 3, ScaleLinear, true, true]);
    expect(a.labelFormatter!(0, 2)).toBe('2');
    expect(String(a.labelStyle.getForeground())).toBe(String(label.getForeground()));
  });

  test('TestSetYAxisRoundTrip', () => {
    const m = New(30, 12, 0, 10, 1, 1000, WithXYSteps(2, 2), WithYScale(ScaleLog));
    m.setViewYRange(10, 100);
    m.drawXYAxisAndLabel();
    const before = m.view();
    const width = m.graphWidth();
    m.setYAxis(m.yAxis());
    expect([m.viewMinY(), m.viewMaxY(), m.yScale(), m.graphWidth()]).toEqual([10, 100, ScaleLog, width]);
    m.clear();
    m.drawXYAxisAndLabel();
    expect(m.view()).toBe(before);
  });

  test('TestSetYAxis', () => {
    const m = New(30, 12, 0, 10, 0, 1);
    m.setYAxis({ min: 0, max: 100, viewMin: 20, viewMax: 40, autoMax: true });
    expect([m.minY(), m.maxY(), m.viewMinY(), m.viewMaxY(), m.autoMinY, m.autoMaxY]).toEqual([0, 100, 20, 40, false, true]);
    expect(m.yLabelFormatter(0, -0.3)).toBe('0');
    // viewMin == viewMax means the whole range
    m.setYAxis({ min: 0, max: 50 });
    expect([m.viewMinY(), m.viewMaxY()]).toEqual([0, 50]);
  });

  describe('TestSetY2AxisSanitizes', () => {
    for (const c of [
      { name: 'empty range', in: { min: 5, max: 5 }, min: 0, max: 1 },
      { name: 'reversed', in: { min: 9, max: 1 }, min: 0, max: 1 },
      { name: 'nan', in: { min: NaN, max: 1 }, min: 0, max: 1 },
      { name: 'log bad min', in: { scale: ScaleLog, min: -1, max: 100 }, min: 10, max: 100 },
      { name: 'log bad both', in: { scale: ScaleLog }, min: 1, max: 10 },
      { name: 'log reversed', in: { scale: ScaleLog, min: 100, max: 10 }, min: 1, max: 10 },
      { name: 'view ignored', in: { min: 0, max: 100, viewMin: 10, viewMax: 20 }, min: 0, max: 100 },
    ] as { name: string; in: Partial<Axis>; min: number; max: number }[]) {
      test(c.name, () => {
        const m = New(30, 12, 0, 10, 0, 10);
        m.setY2Axis(c.in);
        const [a, ok] = m.y2Axis();
        expect([ok, a.min, a.max, a.viewMin, a.viewMax]).toEqual([true, c.min, c.max, c.min, c.max]);
      });
    }
  });

  test('TestY2AxisDefaultsAndClear', () => {
    const m = New(30, 12, 0, 10, 0, 10);
    expect(m.y2Axis()[1]).toBe(false);
    m.drawXYAxisAndLabel();
    const want = m.view();
    const width = m.graphWidth();
    m.setY2Axis({ max: 100 });
    const [a, ok] = m.y2Axis();
    expect(ok).toBe(true);
    expect(a.labelFormatter!(0, -0.2)).toBe('0');
    m.clearY2Axis();
    expect(m.y2Axis()[1]).toBe(false);
    m.clear();
    m.drawXYAxisAndLabel();
    expect(m.view()).toBe(want);
    expect(m.graphWidth()).toBe(width);
  });

  test('TestWithY2Axis', () => {
    const m = New(30, 12, 0, 10, 0, 10, WithY2Axis({ min: 5, max: 20 }));
    const [a, ok] = m.y2Axis();
    expect([ok, a.min, a.max]).toEqual([true, 5, 20]);
  });

  describe('TestY2ViewFollowsLeftView', () => {
    for (const c of [
      { name: 'unzoomed', left: { min: 0, max: 10, viewMin: 0, viewMax: 10 }, right: { min: 0, max: 100 }, wantMin: 0, wantMax: 100 },
      { name: 'linear', left: { min: 0, max: 10, viewMin: 2, viewMax: 6 }, right: { min: 0, max: 100 }, wantMin: 20, wantMax: 60 },
      { name: 'log right', left: { min: 0, max: 10, viewMin: 5, viewMax: 10 }, right: { min: 1, max: 1e4, scale: ScaleLog }, wantMin: 100, wantMax: 1e4 },
      { name: 'log left', left: { min: 1, max: 1000, viewMin: 10, viewMax: 100, scale: ScaleLog }, right: { min: 0, max: 300 }, wantMin: 100, wantMax: 200 },
      { name: 'both log', left: { min: 1, max: 100, viewMin: 10, viewMax: 100, scale: ScaleLog }, right: { min: 10, max: 1e5, scale: ScaleLog }, wantMin: 1000, wantMax: 1e5 },
    ] as { name: string; left: Partial<Axis>; right: Partial<Axis>; wantMin: number; wantMax: number }[]) {
      test(c.name, () => {
        const m = New(30, 12, 0, 10, 0, 1);
        m.setYAxis(c.left);
        m.setY2Axis(c.right);
        const [a] = m.y2Axis();
        expect(approx(a.viewMin, c.wantMin) && approx(a.viewMax, c.wantMax)).toBe(true);
      });
    }
  });

  test('TestY2ViewFollowsZoomAndMove', () => {
    const m = New(30, 12, 0, 10, 0, 10, WithY2Axis({ min: 0, max: 100 }));
    const check = (lo: number, hi: number) => {
      const [a] = m.y2Axis();
      expect(approx(a.viewMin, lo) && approx(a.viewMax, hi)).toBe(true);
    };
    m.zoomIn(0, 2); // left 2..8
    check(20, 80);
    m.moveUp(1); // left 3..9
    check(30, 90);
    m.moveDown(1);
    m.zoomOut(0, 2); // left 0..10
    for (let i = 0; i < 50; i++) {
      m.zoomIn(0, 1);
      m.zoomOut(0, 1);
    }
    const [a] = m.y2Axis();
    expect([a.viewMin, a.viewMax]).toEqual([0, 100]);
  });

  test('TestY2ToY', () => {
    let m = New(30, 12, 0, 10, 0, 10);
    expect(m.y2ToY(42)).toBe(42);
    const check = (want: [number, number][]) => {
      for (const [v, w] of want) expect(approx(m.y2ToY(v), w)).toBe(true);
    };
    m.setY2Axis({ min: 0, max: 100 });
    check([
      [0, 0],
      [50, 5],
      [100, 10],
      [150, 15],
    ]);
    m.setViewYRange(2, 6); // right view 20..60
    check([
      [20, 2],
      [40, 4],
      [60, 6],
    ]);

    m = New(30, 12, 0, 10, 0, 30, WithY2Axis({ min: 1, max: 1000, scale: ScaleLog }));
    check([
      [1, 0],
      [10, 10],
      [100, 20],
      [1000, 30],
    ]);
    expect(m.y2ToY(0)).toBeNaN();

    m = New(30, 12, 0, 10, 1, 1000, WithYScale(ScaleLog), WithY2Axis({ min: 0, max: 3 }));
    check([
      [0, 1],
      [1, 10],
      [2, 100],
      [3, 1000],
    ]);
  });

  test('TestY2AxisLayout', () => {
    const m = New(20, 7, 0, 10, 0, 5, WithXYSteps(2, 2));
    expect([m.graphWidth(), m.graphRight()]).toEqual([18, 20]);
    m.setY2Axis({ min: 0, max: 100 });
    expect(m.graphWidth()).toBe(14); // 18 - 1 - len("100")
    expect(m.origin()).toEqual({ x: 1, y: 5 });
    expect(m.graphRight()).toBe(16);
    m.drawXYAxisAndLabel();
    expect(rows(m).slice(0, 6)).toEqual([
      '5│              │100',
      '4│              │80',
      ' │              │',
      '2│              │40',
      ' │              │',
      '0└──────────────┘0',
    ]);
  });

  test('TestY2AxisWithoutXAxis', () => {
    const m = New(20, 5, 0, 10, 0, 5, WithXYSteps(0, 2), WithY2Axis({ min: 0, max: 100 }));
    m.drawXYAxisAndLabel();
    expect(rows(m)).toEqual(['4│              │80', ' │              │', '2│              │40', ' │              │', '0│              │0']);
  });

  test('TestY2LogAxisLabelsOwnRows', () => {
    const m = New(30, 9, 0, 10, 0, 7, WithXYSteps(2, 2), WithY2Axis({ min: 1, max: 1000, scale: ScaleLog }));
    m.drawXYAxisAndLabel();
    expect(y2TickRows(m)).toEqual({ '1': 0, '10': 2, '100': 5, '1000': 7 });
  });

  test('TestY2LabelStyle', () => {
    const red = newStyle().foreground(9);
    const m = New(20, 7, 0, 10, 0, 5, WithXYSteps(2, 2), WithY2Axis({ min: 0, max: 100, labelStyle: red }));
    m.drawXYAxisAndLabel();
    const right = m.canvas.cell({ x: 17, y: 0 }); // "1" of "100"
    const left = m.canvas.cell({ x: 0, y: 0 }); // "5"
    expect(right.rune).toBe('1');
    expect(String(right.style.getForeground())).toBe(String(red.getForeground()));
    expect(left.rune).toBe('5');
    expect(String(left.style.getForeground())).not.toBe(String(red.getForeground()));
  });

  test('TestY2AxisHiddenWithoutYStep', () => {
    const m = New(20, 7, 0, 10, 0, 5, WithXYSteps(2, 0));
    m.drawXYAxisAndLabel();
    const want = m.view();
    const width = m.graphWidth();
    m.setY2Axis({ min: 0, max: 100 });
    m.clear();
    m.drawXYAxisAndLabel();
    expect([m.view(), m.graphWidth(), m.graphRight()]).toEqual([want, width, m.width()]);
  });

  test('TestY2AxisNarrowCanvas', () => {
    for (let w = 1; w <= 8; w++) {
      const m = New(w, 7, 0, 10, 0, 5, WithXYSteps(2, 2), WithY2Axis({ min: 0, max: 100 }));
      expect(m.graphWidth()).toBeGreaterThanOrEqual(0);
      m.drawXYAxisAndLabel();
      m.drawLine({ x: 0, y: 0 }, { x: 10, y: 5 }, runes.ArcLineStyle);
      m.drawRune({ x: 5, y: 2 }, 'x');
      m.view();
    }
  });

  test('TestDrawStaysLeftOfY2Axis', () => {
    const m = New(20, 7, 0, 10, 0, 5, WithXYSteps(2, 2), WithY2Axis({ min: 0, max: 100 }));
    m.drawXYAxisAndLabel();
    const want = rightOf(m, m.graphRight());
    m.drawRune({ x: 12, y: 3 }, 'x');
    m.drawRuneLine({ x: 5, y: 1 }, { x: 20, y: 4 }, '*');
    m.drawLine({ x: 5, y: 1 }, { x: 20, y: 4 }, runes.ArcLineStyle);
    m.drawRuneCircle({ x: 10, y: 2 }, 3, 'o');
    expect(rightOf(m, m.graphRight())).toEqual(want);
  });

  test('TestAutoAdjustY2Range', () => {
    const m = New(30, 12, 0, 10, 0, 1);
    expect(m.autoAdjustY2Range({ x: 5, y: 50 })).toBe(false);
    m.setY2Axis({ min: 0, max: 10, autoMax: true });
    const width = m.graphWidth();
    expect(m.autoAdjustY2Range({ x: 5, y: 500 })).toBe(true);
    const [a] = m.y2Axis();
    expect([a.min, a.max, a.viewMax, m.minY(), m.maxY()]).toEqual([0, 500, 500, 0, 1]);
    expect(m.graphWidth()).toBeLessThan(width);
    expect(m.autoAdjustY2Range({ x: 5, y: -1 })).toBe(false);
    m.autoMaxX = true;
    expect(m.autoAdjustY2Range({ x: 20, y: 1 })).toBe(true);
    expect(m.maxX()).toBe(20);
    m.setY2Axis({ min: 1, max: 10, scale: ScaleLog, autoMin: true });
    expect(m.autoAdjustY2Range({ x: 5, y: 0 })).toBe(false);
  });

  test('TestY2AxisCopiesAreIndependent', () => {
    const m = New(30, 12, 0, 10, 0, 1, WithY2Axis({ min: 0, max: 10, autoMax: true }));
    const c = m.clone(); // as Bubble Tea copies a model
    c.autoAdjustY2Range({ x: 5, y: 50 });
    expect(m.y2Axis()[0].max).toBe(10);
  });

  test('TestAutoAdjustRangeReportsRightViewChange', () => {
    let m = New(30, 12, 0, 10, 0, 10, WithAutoYRange());
    m.setViewYRange(0, 5);
    expect(m.autoAdjustRange({ x: 1, y: 20 })).toBe(false);
    m = New(30, 12, 0, 10, 0, 10, WithAutoYRange(), WithY2Axis({ min: 0, max: 100 }));
    m.setViewYRange(0, 5);
    const [before] = m.y2Axis();
    expect(m.autoAdjustRange({ x: 1, y: 20 })).toBe(true);
    expect(m.y2Axis()[0].viewMax).not.toBe(before.viewMax);
  });

  test('TestSetYRangeRecomputesRightAxisLayout', () => {
    const m = New(30, 10, 0, 10, 0, 1, WithXYSteps(2, 2), WithY2Axis({ min: 0, max: 1000 }));
    m.setViewYRange(0, 0.01); // right view 0..10: narrow labels
    m.setYRange(0, 0.01); // left view is now the whole range: right view 0..1000 again
    m.drawXYAxisAndLabel();
    expect(y2TickRows(m)['1000']).toBe(m.graphHeight());
  });
});

describe('scale_test.go', () => {
  test('TestScaleZeroValueIsLinear', () => {
    expect(ScaleLinear.string()).toBe('linear');
    expect(ScaleLog.string()).toBe('log');
    let m = New(20, 10, 0, 10, 0, 10);
    expect([m.xScale(), m.yScale()]).toEqual([ScaleLinear, ScaleLinear]);
    m = New(20, 10, 1, 10, 1, 10, WithXScale(ScaleLog), WithYScale(ScaleLog));
    expect(m.xScale() === ScaleLog && m.yScale() === ScaleLog).toBe(true);
    m.setXScale(ScaleLinear);
    m.setYScale(ScaleLinear);
    expect(m.xScale() === ScaleLinear && m.yScale() === ScaleLinear).toBe(true);
  });

  test('TestScaleValid', () => {
    for (const v of [-1, 0, 1, Infinity, -Infinity]) expect(ScaleLinear.valid(v)).toBe(true);
    for (const [v, want] of [
      [-1, false],
      [0, false],
      [1e-300, true],
      [5, true],
      [Infinity, false],
    ] as [number, boolean][]) {
      expect(ScaleLog.valid(v)).toBe(want);
    }
    expect(ScaleLog.valid(NaN)).toBe(false);
  });

  test('TestLogScalePointsDecadesEvenly', () => {
    const m = New(34, 14, 1, 1000, 1, 1e6, WithXScale(ScaleLog), WithYScale(ScaleLog));
    expect([m.graphWidth(), m.graphHeight()]).toEqual([26, 12]);
    for (let k = 0; k <= 6; k++) {
      const f = m.scaleFloat64PointForLine({ x: 1, y: 10 ** k });
      expect([f.x, f.y]).toEqual([0, 2 * k]);
    }
    expect(m.scaleFloat64PointForLine({ x: 1000, y: 1 }).x).toBe(26);
    // A coordinate with no place on a log axis scales to 0, never NaN.
    for (const v of [0, -3, NaN]) expect(m.scaleFloat64Point({ x: v, y: v })).toEqual({ x: 0, y: 0 });
  });

  describe('TestLogYTicksFallOnDecades', () => {
    for (const tc of [
      { graphHeight: 12, want: ['1', '10', '100', '1000', '10000', '100000', '1000000'] },
      { graphHeight: 13, want: ['1', '10', '100', '1000', '10000', '100000', '1000000'] },
      { graphHeight: 17, want: ['1', '10', '100', '1000', '10000', '100000', '1000000'] },
      { graphHeight: 11, want: ['1', '100', '10000', '1000000'] },
      { graphHeight: 8, want: ['1', '100', '10000', '1000000'] },
      { graphHeight: 7, want: ['1', '100', '10000', '1000000'] },
      { graphHeight: 5, want: ['1', '1000', '1000000'] },
      { graphHeight: 3, want: ['100', '1000000'] },
      { graphHeight: 2, want: ['1', '1000000'] },
    ]) {
      test(String(tc.graphHeight), () => {
        const m = New(30, tc.graphHeight + 2, 0, 10, 1, 1e6, WithYScale(ScaleLog));
        expect(m.graphHeight()).toBe(tc.graphHeight);
        m.drawXYAxisAndLabel();
        const r = yTickRows(m);
        expect(Object.keys(r).length).toBe(tc.want.length);
        let prev = -m.yStep();
        for (const label of tc.want) {
          const v = Number(label);
          const want = Math.round((log10(v) / 6) * tc.graphHeight);
          expect(r[label]).toBe(want);
          expect(r[label] - prev).toBeGreaterThanOrEqual(m.yStep());
          prev = r[label];
        }
        if (tc.graphHeight === 2) return; // one decade tick at most: evenly spaced fallback
        expect(m.origin().x).toBe(tc.want[tc.want.length - 1].length);
      });
    }
  });

  describe('TestLogThinnedTicksLabelTheEnds', () => {
    for (const tc of [
      // 4 decades on 7 rows: 10, 1000, 100000 rather than 100, 10000.
      { name: 'both ends', min: 10, max: 1e5, height: 9, want: ['10', '1000', '100000'] },
      // 5 decades on 7 rows: only one end can be kept, and the maximum wins.
      { name: 'maximum first', min: 1, max: 1e5, height: 9, want: ['10', '1000', '100000'] },
      // The maximum is not a power of ten: count from the minimum.
      { name: 'minimum', min: 10, max: 3e5, height: 9, want: ['10', '1000', '100000'] },
      // Neither end is: the most labels (100 and 10000 would be only two),
      { name: 'neither', min: 3, max: 3e5, height: 9, want: ['10', '1000', '100000'] },
      // and on a tie, exponents that are multiples of the stride.
      { name: 'neither, tie', min: 3, max: 3e4, height: 9, want: ['100', '10000'] },
    ]) {
      test(tc.name, () => {
        const m = New(30, tc.height, 0, 10, tc.min, tc.max, WithYScale(ScaleLog), WithYLabelFormatter(fmtV));
        m.drawXYAxisAndLabel();
        expect(sortedLabels(yTickRows(m))).toEqual(tc.want);
      });
    }
    // X axis: the maximum's label is the best-effort final one, and the
    // thinned decades still count from it.
    test('x axis', () => {
      const m = New(23, 6, 10, 1e5, 0, 10, WithXScale(ScaleLog), WithXYSteps(8, 2));
      m.drawXYAxisAndLabel();
      expect(xLabels(m)).toEqual(['10', '1000', '100000']);
    });
  });

  test('TestLogYTicksGoldenUnevenHeight', () => {
    const m = New(30, 9, 0, 7, 1, 1e6, WithYScale(ScaleLog));
    m.drawXYAxisAndLabel();
    for (let k = 0; k <= 6; k++) {
      const v = 10 ** k;
      m.drawLine({ x: k, y: v }, { x: k + 1, y: v }, runes.ThinLineStyle);
    }
    wantView(
      m,
      `
1000000│                  ╶──╴
       │               ╶──╴
  10000│            ╶──╴
       │        ╶───╴
       │
    100│     ╶──╴
       │  ╶──╴
      1└──────────────────────
       0 1   2 3   4   5 6  7
`,
    );
  });

  describe('TestLogYMinorTicks', () => {
    for (const tc of [
      // Two decade ticks leave room for 2x and 5x.
      { name: 'one decade', min: 1, max: 10, height: 10, want: ['1', '2', '5', '10'] },
      // ... but not on a plot too short to space them.
      { name: 'one decade, short', min: 1, max: 10, height: 6, want: ['1', '10'] },
      // One decade tick inside the range.
      { name: 'around a decade', min: 20, max: 500, height: 12, want: ['20', '50', '100', '200', '500'] },
      // Three decade ticks are enough: no minor ticks.
      { name: 'two decades', min: 1, max: 100, height: 14, want: ['1', '10', '100'] },
      { name: 'below one', min: 0.01, max: 0.1, height: 10, want: ['0.01', '0.02', '0.05', '0.1'] },
    ]) {
      test(tc.name, () => {
        const m = New(30, tc.height, 0, 10, tc.min, tc.max, WithYScale(ScaleLog), WithYLabelFormatter(fmtV));
        m.drawXYAxisAndLabel();
        const r = yTickRows(m);
        expect(sortedLabels(r)).toEqual(tc.want);
        for (const l of sortedLabels(r)) {
          const v = Number(l);
          const frac = (log10(v) - log10(tc.min)) / (log10(tc.max) - log10(tc.min));
          expect(r[l]).toBe(Math.round(frac * m.graphHeight()));
        }
      });
    }
  });

  test('TestLogYTicksNarrowRangeFallback', () => {
    const m = New(30, 10, 0, 10, 30, 40, WithYScale(ScaleLog), WithYLabelFormatter((_i, v) => sprintfF(v, 2)));
    m.drawXYAxisAndLabel();
    const r = yTickRows(m);
    expect(Object.keys(r).length).toBe(5);
    expect(r['30.00']).toBe(0);
    expect(r['40.00']).toBe(8);
    expect(r[sprintfF(Math.sqrt(30 * 40), 2)]).toBe(4); // halfway up a log axis
  });

  test('TestLogXTicks', () => {
    let m = New(44, 8, 1, 1e6, 0, 10, WithXScale(ScaleLog));
    m.drawXYAxisAndLabel();
    wantView(
      m,
      `
10│
  │
 7│
  │
 3│
  │
 0└─────────────────────────────────────────
  1      10     100    1000  10000  100000
`,
    );

    // Room to right-align the final label once the others are drawn.
    m = New(90, 6, 1, 1e6, 0, 10, WithXScale(ScaleLog));
    m.drawXYAxisAndLabel();
    expect(xLabels(m)).toEqual(['1', '10', '100', '1000', '10000', '100000', '1000000']);
    expect(m.view().endsWith('1000000')).toBe(true);

    // Too narrow for every decade: every second one, never a 2x or 5x.
    m = New(20, 6, 1, 1e6, 0, 10, WithXScale(ScaleLog));
    m.drawXYAxisAndLabel();
    expect(xLabels(m)).toEqual(['1', '100', '10000']);

    // One decade: 2x and 5x fill in, and the final label keeps its rules.
    m = New(30, 6, 1, 10, 0, 10, WithXScale(ScaleLog));
    m.drawXYAxisAndLabel();
    expect(xLabels(m)).toEqual(['1', '2', '5', '10']);

    // Narrow range: evenly spaced columns, under the linear axis's rules.
    m = New(30, 6, 30, 40, 0, 10, WithXScale(ScaleLog));
    m.drawXYAxisAndLabel();
    const linear = New(30, 6, 30, 40, 0, 10);
    linear.drawXYAxisAndLabel();
    expect(xLabels(m)[0]).toBe('30');
    expect(xLabels(m).length).toBe(xLabels(linear).length);

    // A step of 0 still hides the axis.
    m = New(30, 6, 1, 1000, 1, 1000, WithXScale(ScaleLog), WithYScale(ScaleLog), WithXYSteps(0, 0));
    m.drawXYAxisAndLabel();
    expect(m.view().trim()).toBe('');
    expect([m.graphWidth(), m.graphHeight()]).toEqual([30, 6]);
  });

  test('TestLogTickFormatterSeesDataUnits', () => {
    let seen: number[] = [];
    const m = New(30, 14, 0, 10, 1, 1e6, WithYScale(ScaleLog), WithYLabelFormatter((_i, v) => {
      seen.push(v);
      return 'x';
    }));
    seen = [];
    m.drawXYAxisAndLabel();
    expect(seen).toEqual([1, 10, 100, 1000, 1e4, 1e5, 1e6]);
  });

  test('TestLogRangeSanitized', () => {
    for (const tc of [
      [2, 500, 2, 500],
      [0, 500, 50, 500],
      [-5, 500, 50, 500],
      [0, 0, 1, 10],
      [-8, -2, 1, 10],
      [5, -2, 5, 50],
      [NaN, 500, 50, 500],
    ]) {
      const [min, max, wantMin, wantMax] = tc;
      const check = (m: Model) => {
        expect([m.minY(), m.maxY(), m.viewMinY(), m.viewMaxY()]).toEqual([wantMin, wantMax, wantMin, wantMax]);
        expect([m.minX(), m.maxX(), m.viewMinX(), m.viewMaxX()]).toEqual([wantMin, wantMax, wantMin, wantMax]);
      };
      // when the scale is set ...
      let m = New(30, 10, min, max, min, max, WithXScale(ScaleLog), WithYScale(ScaleLog));
      check(m);
      // ... and when the range is.
      m = New(30, 10, 3, 4, 3, 4, WithXScale(ScaleLog), WithYScale(ScaleLog));
      m.setXYRange(min, max, min, max);
      m.setViewXYRange(min, max, min, max);
      check(m);
    }
    // Linear ranges are left alone.
    const m = New(30, 10, -5, 0, -8, -2);
    m.setYRange(-9, 0);
    expect([m.minX(), m.maxX(), m.minY(), m.maxY()]).toEqual([-5, 0, -9, 0]);
  });

  test('TestLogAutoRange', () => {
    const m = New(30, 10, 10, 100, 10, 100, WithXScale(ScaleLog), WithYScale(ScaleLog), WithAutoXYRange());
    // A point with no place on a log axis is ignored whole.
    for (const f of [
      { x: 5000, y: 0 },
      { x: -1, y: 5000 },
      { x: NaN, y: 1 },
    ]) {
      expect(m.autoAdjustRange(f)).toBe(false);
    }
    expect([m.minX(), m.maxX(), m.minY(), m.maxY()]).toEqual([10, 100, 10, 100]);
    expect(m.autoAdjustRange({ x: 0.5, y: 2e4 })).toBe(true);
    expect([m.minX(), m.viewMinX(), m.maxY(), m.viewMaxY(), m.maxX(), m.minY()]).toEqual([0.5, 0.5, 2e4, 2e4, 100, 10]);
  });

  test('TestLogZoomAndPan', () => {
    let m = New(30, 10, 1, 1e6, 1, 1e6, WithXScale(ScaleLog), WithYScale(ScaleLog));
    const view = (minX: number, maxX: number, minY: number, maxY: number) => {
      expect([m.viewMinX(), m.viewMaxX(), m.viewMinY(), m.viewMaxY()].every((v, i) => approx(v, [minX, maxX, minY, maxY][i]))).toBe(true);
    };
    m.zoomIn(1, 2);
    view(10, 1e5, 100, 1e4);
    expect([m.viewMinX(), m.viewMaxY()]).toEqual([10, 1e4]); // zoom to a decade is exact
    m.moveRight(0.5);
    view(10 * Math.sqrt(10), 1e5 * Math.sqrt(10), 100, 1e4);
    m.moveRight(3); // clamps at the expected maximum, keeping the 4-decade window
    view(100, 1e6, 100, 1e4);
    m.moveLeft(1);
    view(10, 1e5, 100, 1e4);
    m.moveLeft(9);
    view(1, 1e4, 100, 1e4);
    m.moveUp(1);
    view(1, 1e4, 1000, 1e5);
    m.moveUp(5);
    view(1, 1e4, 1e4, 1e6);
    m.moveDown(1.5);
    view(1, 1e4, 1e4 / 10 ** 1.5, 1e6 / 10 ** 1.5);
    m.moveDown(7);
    view(1, 1e4, 1, 100);
    m.zoomOut(1, 1); // limited by the expected range
    view(1, 1e5, 1, 1000);
    m.zoomIn(3, 3); // bounds would cross: ignored
    view(1, 1e5, 1, 1000);

    // The update handlers drive the same methods.
    m = New(30, 10, 1, 1e6, 1, 1e6, WithXScale(ScaleLog), WithYScale(ScaleLog));
    m.focus();
    [m] = m.update(key('pgup'));
    view(10, 1e5, 10, 1e5);
    [m] = m.update(key('right'));
    view(100, 1e6, 10, 1e5);
  });

  test('TestLinearZoomAndPanUnchanged', () => {
    const m = New(30, 10, -10, 10, 0, 100);
    m.zoomIn(2, 10);
    m.moveRight(1.5);
    m.moveUp(100);
    m.moveLeft(0.25);
    m.moveDown(3);
    expect([m.viewMinX(), m.viewMaxX(), m.viewMinY(), m.viewMaxY()]).toEqual([-6.75, 9.25, 17, 97]);
  });

  // drawEverything exercises every drawing path with the given points.
  function drawEverything(m: Model, a: Float64Point, b: Float64Point): void {
    m.drawXYAxisAndLabel();
    m.drawRune(a, 'a');
    m.drawRune(b, 'b');
    m.drawRuneLine(a, b, '+');
    m.drawLine(a, b, runes.ArcLineStyle);
    m.drawBrailleLine(a, b);
    m.drawRuneCircle(a, 2, 'o');
    m.drawBrailleCircle(b, 2);
  }

  test('TestLogSkipsNonPositivePoints', () => {
    const newChart = () => {
      const m = New(30, 12, 1, 1000, 1, 1000, WithXScale(ScaleLog), WithYScale(ScaleLog), WithAutoXYRange());
      m.drawXYAxisAndLabel();
      return m;
    };
    const blank = newChart();
    const good = { x: 10, y: 100 };
    for (const bad of [
      { x: 10, y: 0 },
      { x: 10, y: -5 },
      { x: 0, y: 100 },
      { x: -2, y: -2 },
      { x: 10, y: NaN },
      { x: Infinity, y: 100 },
    ]) {
      const m = newChart();
      m.drawRune(bad, 'x');
      m.drawRuneLine(good, bad, '+');
      m.drawRuneLine(bad, good, '+');
      m.drawLine(good, bad, runes.ArcLineStyle);
      m.drawLine(bad, good, runes.ArcLineStyle);
      m.drawBrailleLine(good, bad);
      m.drawBrailleLine(bad, good);
      expect(m.view()).toBe(blank.view());
      expect([m.minX(), m.maxX(), m.minY(), m.maxY()]).toEqual([1, 1000, 1, 1000]);
    }

    // Circles are traced in data units; the part at or below zero is left out.
    const m = newChart();
    m.drawRuneCircle({ x: 3, y: 3 }, 5, 'o');
    m.drawBrailleCircle({ x: 3, y: 3 }, 5);
    expect(m.view()).not.toBe(blank.view());
    m.view()
      .split('\n')
      .forEach((line, i) => {
        if (line.includes('o')) expect(i).toBeLessThanOrEqual(m.origin().y);
      });
  });

  test('TestLogDrawingPathsGolden', () => {
    let m = New(30, 12, 1, 1000, 1, 1000, WithXScale(ScaleLog), WithYScale(ScaleLog));
    m.drawXYAxisAndLabel();
    // y = x is a straight diagonal on log-log axes. (drawRune keeps points
    // off the axes, so 1 sits one row above the X axis, as on a linear chart.)
    for (const v of [1, 3, 10, 30, 100, 300, 1000]) m.drawRune({ x: v, y: v }, '*');
    wantView(
      m,
      `
1000│                        *
    │
    │                    *
 100│                *
    │
    │            *
    │        *
  10│
    │    *
    │*
   1└─────────────────────────
    1       10       100  1000
`,
    );

    m = New(30, 12, 1, 1000, 1, 1000, WithXScale(ScaleLog), WithYScale(ScaleLog));
    m.drawXYAxisAndLabel();
    m.drawRuneLine({ x: 1, y: 1000 }, { x: 1000, y: 1 }, '+');
    m.drawBrailleLine({ x: 1, y: 1 }, { x: 1000, y: 1000 });
    wantView(
      m,
      `
1000│++                    ⢀⠤⠊
    │  +++               ⡠⠔⠁
    │     ++          ⢀⠤⠊
 100│       +++     ⡠⠔⠁
    │          ++⢀⠤⠊
    │          ⡠⠒⠁++
    │       ⢀⠔⠊     +++
  10│     ⡠⠒⠁          +++
    │  ⢀⠔⠊                ++
    │⡠⠒⠁                    ++
   1└─────────────────────────
    1       10       100  1000
`,
    );
  });

  test('TestExplicitLinearScaleIsIdentical', () => {
    const a = { x: -3, y: 2 };
    const b = { x: 14, y: 61 };
    const plain = New(40, 16, -5, 10, 0, 50, WithAutoXYRange());
    drawEverything(plain, a, b);

    const opt = New(40, 16, -5, 10, 0, 50, WithAutoXYRange(), WithXScale(ScaleLinear), WithYScale(ScaleLinear));
    drawEverything(opt, a, b);

    const set = New(40, 16, 1, 10, 1, 50, WithAutoXYRange(), WithXScale(ScaleLog), WithYScale(ScaleLog));
    set.setXScale(ScaleLinear);
    set.setYScale(ScaleLinear);
    set.setXYRange(-5, 10, 0, 50);
    set.setViewXYRange(-5, 10, 0, 50);
    drawEverything(set, a, b);

    expect(opt.view()).toBe(plain.view());
    expect(set.view()).toBe(plain.view());
    for (const m of [plain, opt, set]) {
      m.zoomIn(1, 5);
      m.moveLeft(2);
    }
    expect([opt.viewMinX(), opt.viewMaxY()]).toEqual([plain.viewMinX(), plain.viewMaxY()]);
  });
});

// Not an upstream test: the update handlers' mouse paths, driven through a
// stand-in for a bubblezone manager (the canvas zone is the whole screen).
describe('update handlers with a zone manager', () => {
  const zm = {
    newPrefix: () => 'zone1',
    mark: (_id: string, v: string) => v,
    get: () => ({ inBounds: () => true, pos: (m: { x: number; y: number }) => [m.x, m.y] as [number, number] }),
  };
  const mouse = (tag: string, x: number, y: number, button = 1) => ({ _tag: tag, x, y, button });

  test('XYAxesUpdateHandler drag moves both axes', () => {
    let m = New(30, 10, 0, 100, 0, 100, WithXYSteps(2, 2));
    m.setZoneManager(zm);
    m.setViewXYRange(20, 60, 20, 60);
    m.focus();
    [m] = m.update(mouse('MouseClickMsg', 5, 5));
    [m] = m.update(mouse('MouseMotionMsg', 7, 3)); // right and up
    expect([m.viewMinX(), m.viewMaxX(), m.viewMinY(), m.viewMaxY()]).toEqual([21, 61, 21, 61]);
    [m] = m.update(mouse('MouseMotionMsg', 6, 4, 0)); // no button: ignored
    expect([m.viewMinX(), m.viewMinY()]).toEqual([21, 21]);
    [m] = m.update(mouse('MouseMotionMsg', 6, 4)); // left and down
    expect([m.viewMinX(), m.viewMinY()]).toEqual([20, 20]);
  });

  test('XAxisUpdateHandler and YAxisUpdateHandler drag one axis', () => {
    const m = New(30, 10, 0, 100, 0, 100, WithXYSteps(2, 2));
    m.setZoneManager(zm);
    m.setViewXYRange(20, 60, 20, 60);
    m.focus();
    m.updateHandler = linechartX(5);
    m.update(mouse('MouseClickMsg', 5, 5));
    m.update(mouse('MouseMotionMsg', 4, 9));
    expect([m.viewMinX(), m.viewMinY()]).toEqual([15, 20]);
    m.updateHandler = linechartY(5);
    m.update(mouse('MouseClickMsg', 5, 5));
    m.update(mouse('MouseMotionMsg', 9, 4));
    expect([m.viewMinX(), m.viewMinY()]).toEqual([15, 25]);
  });

  test('zone ID and view marking', () => {
    const marked: string[] = [];
    const m = New(10, 4, 0, 1, 0, 1, WithXYSteps(0, 0));
    m.setZoneManager({ ...zm, mark: (id: string, v: string) => (marked.push(id), `[${v}]`) });
    expect(m.zoneID()).toBe('zone1');
    expect(m.view().startsWith('[')).toBe(true);
    expect(marked).toEqual(['zone1']);
  });
});
