// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.
//
// Port of spec/build_category_test.go and spec/build_combo_test.go.
import { describe, expect, test } from 'bun:test';
import { stripAnsi } from '@oakoliver/lipgloss';
import * as barchart from '../src/barchart/index.js';
import * as runes from '../src/canvas/runes/runes.js';
import { categoryCenters } from '../src/spec/category_layout.js';
import {
  Build,
  CategoricalModel,
  ChartTypeBar,
  ChartTypeLine,
  ChartTypeScatter,
  ComboModel,
  MarshalJSON,
  OrientationHorizontal,
  ResolveCategoricalCombo,
  ScaleLog,
  XAxisCategory,
  XAxisValue,
  YAxisLeft,
  YAxisRight,
  type ChartType,
  type Spec,
} from '../src/spec/index.js';
import { clone } from './spec-helpers.js';

const winSize = (width: number, height: number) => ({ _tag: 'WindowSizeMsg', width, height });

function buildErr(s: Spec): string | null {
  try {
    Build(s);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const cp = (r: string): number => r.codePointAt(0) ?? 0;

// ── build_category_test.go ──────────────────────────────────────────────────

function categoricalSpec(kind: ChartType): Spec {
  return {
    type: kind,
    width: 44,
    height: 15,
    x_axis: { type: XAxisCategory, labels: ['Before', 'Middle', 'After'] },
    y_axis: { min: 0, max: 10 },
    data: {
      series: [
        {
          name: 'sample',
          values: [
            { x: 'After', y: 5 },
            { x: 'Before', y: 5 },
          ],
        },
      ],
    },
  };
}

test('TestCategoricalSlotsAndSparseLine', () => {
  const s = categoricalSpec(ChartTypeLine);
  const before = s.data!.series![0].values![0].x;
  let m = Build(s) as CategoricalModel;
  expect(s.data!.series![0].values![0].x).toBe(before); // Build mutated input
  for (const label of s.x_axis!.labels!) expect(stripAnsi(m.view())).toContain(label);
  const centers = categoryCenters(m.graphWidth(), 3);
  const x = m.origin().x + 1 + centers[1];
  for (let y = 0; y < m.graphHeight(); y++) {
    const r = m.canvas.cell({ x, y }).rune;
    expect(r === '\u0000' || r === '' || r === ' ').toBe(true); // line bridged empty slot
  }
  s.data!.series![0].values!.push({ x: 'Middle', y: 5 });
  m = Build(s) as CategoricalModel;
  let found = false;
  for (let y = 0; y < m.graphHeight(); y++) {
    const r = cp(m.canvas.cell({ x, y }).rune);
    found = found || (r >= 0x2801 && r <= 0x28ff);
  }
  expect(found).toBe(true); // full line not drawn through middle slot
});

test('TestCategoricalScatterRepeatsAndResize', () => {
  const s = categoricalSpec(ChartTypeScatter);
  s.data!.series![0].values!.push({ x: 'Before', y: 8 });
  let m = Build(s) as CategoricalModel;
  for (const [w, h] of [
    [80, 24],
    [12, 6],
    [44, 15],
    [0, 0],
    [44, 15],
  ]) {
    [m] = m.update(winSize(w, h));
    if (w < 20) continue;
    const fresh = clone(s);
    fresh.width = w;
    fresh.height = h;
    expect(m.view()).toBe(Build(fresh).view()); // resize differs from fresh build
  }
  expect(stripAnsi(m.view()).split('•').length - 1).toBe(3);
});

test('TestCategoricalOrderSources', () => {
  const s = categoricalSpec(ChartTypeLine);
  s.x_axis!.labels = null;
  let m = Build(s) as CategoricalModel;
  expect(m['labels']).toEqual(['After', 'Before']); // first appearance order lost
  s.data!.x_axis_data = ['Before', 'Middle', 'After'];
  s.data!.series![0].values = [{ y: 2 }, { y: 4 }, { y: 6 }];
  m = Build(s) as CategoricalModel;
  expect(m['labels']).toEqual(['Before', 'Middle', 'After']); // shared order lost
});

describe('TestCategoricalValidation', () => {
  const cases: Record<string, (s: Spec) => void> = {
    'log X': (s) => (s.x_axis!.scale = ScaleLog),
    'duplicate labels': (s) => (s.x_axis!.labels = ['Before', 'Before']),
    'unknown category': (s) => (s.data!.series![0].values![0].x = 'unknown'),
    'numeric category': (s) => (s.data!.series![0].values![0].x = 42),
    'duplicate line': (s) => s.data!.series![0].values!.push(clone(s.data!.series![0].values![0])),
  };
  for (const [name, change] of Object.entries(cases)) {
    test(name, () => {
      const s = categoricalSpec(ChartTypeLine);
      change(s);
      expect(buildErr(s)).not.toBeNull();
    });
  }
});

test('TestCategoricalDualLogY', () => {
  const s = categoricalSpec(ChartTypeScatter);
  s.y_axis = { scale: ScaleLog, min: 1, max: 10 };
  s.y2_axis = { scale: ScaleLog, min: 100, max: 1000 };
  s.data!.series!.push({ name: 'right', y_axis: YAxisRight, values: [{ x: 'Middle', y: 300 }] });
  const m = Build(s) as CategoricalModel;
  expect(stripAnsi(m.view()).split('•').length - 1).toBe(3);
});

// ── build_combo_test.go ─────────────────────────────────────────────────────

function comboSpec(): Spec {
  return {
    type: ChartTypeBar,
    width: 64,
    height: 16,
    x_axis: { type: XAxisCategory, labels: ['C', 'A', 'B'] },
    y_axis: { format: { kind: 'currency' } },
    y2_axis: { format: { kind: 'percent' } },
    data: {
      series: [
        {
          name: 'sales',
          type: 'bar',
          y_axis: YAxisLeft,
          values: [
            { x: 'B', y: -20 },
            { x: 'C', y: 40 },
          ],
        },
        {
          name: 'rate',
          type: 'line',
          y_axis: YAxisRight,
          values: [
            { x: 'B', y: 0.3 },
            { x: 'C', y: 0.1 },
            { x: 'A', y: 0.2 },
          ],
        },
      ],
    },
  };
}

test('TestComboResolution', () => {
  const s = comboSpec();
  const before = MarshalJSON(s);
  let c = ResolveCategoricalCombo(s);
  expect(c.labels).toEqual(['C', 'A', 'B']);
  expect([c.bars[0], c.bars[1], c.bars[2]]).toEqual([40, null, -20]); // categories/values shifted
  expect([c.min, c.max, c.min2, c.max2]).toEqual([-20, 40, 0.1, 0.3]); // scales not independent
  const m = Build(s) as ComboModel;
  expect(m.view()).toContain('$');
  expect(m.view()).toContain('%'); // independent axis formats missing
  expect(MarshalJSON(s)).toBe(before); // Build mutated input
  // Shared categories and reversed series order retain the same category order.
  s.data!.x_axis_data = ['C', 'A', 'B'];
  s.x_axis!.labels = null;
  s.data!.series = [s.data!.series![1], s.data!.series![0]];
  c = ResolveCategoricalCombo(s);
  expect([c.lineIndex, c.barIndex, c.bars[2]]).toEqual([0, 1, -20]); // series order changed semantics
});

function comboCenter(m: ComboModel, i: number): number {
  const w = m.graphWidth();
  const n = m['data'].labels.length;
  const left = Math.trunc((i * w) / n);
  const right = Math.trunc(((i + 1) * w) / n);
  return m.origin().x + 1 + Math.min(w - 1, Math.trunc((left + Math.max(left, right - 1)) / 2));
}
const isBraille = (r: string): boolean => cp(r) > runes.BrailleBlockOffset && cp(r) <= runes.BrailleBlockOffset + 255;

test('TestComboMissingAndOverlay', () => {
  const s = comboSpec();
  s.y_axis = {};
  s.y2_axis = {};
  s.data!.series![0].values = [{ y: 10 }, { y: 10 }, { y: 10 }];
  s.data!.series![1].values = [
    { x: 'C', y: 100 },
    { x: 'B', y: 100 },
  ];
  let m = Build(s) as ComboModel;
  for (const [w, h] of [
    [64, 16],
    [30, 8],
    [80, 20],
  ]) {
    m.resize(w, h);
    for (const i of [0, 2]) {
      const x = comboCenter(m, i);
      let found = false;
      for (let y = 0; y < m.graphHeight(); y++) {
        const cell = m.canvas.cell({ x, y });
        if (isBraille(cell.rune)) {
          found = true;
          expect(cell.style.getForeground()).toEqual(m['lineStyle'].getForeground()); // line did not replace bar colour
        }
      }
      expect(found).toBe(true); // line not visible over bar center
    }
    const x = comboCenter(m, 1);
    for (let y = 0; y < m.graphHeight(); y++) expect(isBraille(m.canvas.cell({ x, y }).rune)).toBe(false);
  }
  // A present middle value connects the line across the plot.
  s.data!.series![1].values = [{ y: 100 }, { y: 100 }, { y: 100 }];
  m = Build(s) as ComboModel;
  const x = Math.trunc((comboCenter(m, 0) + comboCenter(m, 1)) / 2);
  let found = false;
  for (let y = 0; y < m.graphHeight(); y++) found = found || isBraille(m.canvas.cell({ x, y }).rune);
  expect(found).toBe(true); // adjacent points were not connected
});

test('TestComboNegativeBarsAndZero', () => {
  const s = comboSpec();
  s.y_axis = {};
  s.data!.series![0].values = [{ y: 10 }, { y: 0 }, { y: -10 }];
  s.data!.series![1].values = null;
  const m = Build(s) as ComboModel;
  for (const tc of [
    { i: 0, y: 0, want: '█' },
    { i: 0, y: m.graphHeight() - 1, want: '' },
    { i: 1, y: 0, want: '' },
    { i: 2, y: 0, want: '' },
    { i: 2, y: m.graphHeight() - 1, want: '█' },
  ]) {
    const r = m.canvas.cell({ x: comboCenter(m, tc.i), y: tc.y }).rune;
    expect(r === '█').toBe(tc.want === '█');
  }
  for (const v of [-10, 0, 10]) {
    s.data!.series![0].values = [{ y: v }];
    const c = ResolveCategoricalCombo(s);
    expect(c.min <= 0 && c.max >= 0 && c.min < c.max).toBe(true); // zero baseline lost
  }
});

test('TestComboNarrowAndWindowResize', () => {
  const s = comboSpec();
  const m = Build(s) as ComboModel;
  for (let w = 0; w < 25; w++) {
    for (let h = 0; h < 6; h++) {
      m.resize(w, h);
      expect([m.width(), m.height()]).toEqual([w, h]);
    }
  }
  const [updated] = m.update(winSize(64, 16));
  expect(updated.view()).toBe(Build(s).view()); // resize failed to restore chart
  s.width = 1;
  s.height = 1;
  expect(buildErr(s)).not.toBeNull(); // expected too-small build error
});

describe('TestComboPinsAndRejections', () => {
  test('pins', () => {
    const s = comboSpec();
    s.y_axis!.min = -50;
    s.y_axis!.max = 50;
    s.y2_axis!.min = 0;
    s.y2_axis!.max = 1;
    const c = ResolveCategoricalCombo(s);
    expect([c.min, c.max, c.min2, c.max2]).toEqual([-50, 50, 0, 1]); // pins ignored
  });
  const cases: Record<string, (s: Spec) => void> = {
    'no right axis': (s) => (s.y2_axis = null),
    'wrong line axis': (s) => (s.data!.series![1].y_axis = YAxisLeft),
    'wrong bar axis': (s) => (s.data!.series![0].y_axis = YAxisRight),
    'extra series': (s) => s.data!.series!.push({ name: 'extra' }),
    stacked: (s) => (s.options = { stacked: true }),
    horizontal: (s) => (s.options = { orientation: OrientationHorizontal }),
    'numeric x': (s) => (s.x_axis!.type = XAxisValue),
    log: (s) => (s.y2_axis!.scale = ScaleLog),
    'no labels': (s) => (s.x_axis!.labels = null),
    'duplicate labels': (s) => (s.x_axis!.labels![1] = 'C'),
    'duplicate points': (s) => s.data!.series![0].values!.push({ x: 'B', y: 1 }),
    'unknown category': (s) => (s.data!.series![0].values![0].x = 'other'),
    nonfinite: (s) => (s.data!.series![0].values![0].y = NaN),
    'nonfinite pin': (s) => (s.y2_axis!.min = -Infinity),
    'exclude zero': (s) => (s.y_axis!.min = 1),
    inverted: (s) => (s.y2_axis!.min = 2),
    'equal pins': (s) => {
      s.y2_axis!.min = 1;
      s.y2_axis!.max = 1;
    },
    'unsupported mark': (s) => (s.data!.series![1].type = 'scatter'),
  };
  for (const [name, edit] of Object.entries(cases)) {
    test(name, () => {
      const s = comboSpec();
      edit(s);
      expect(buildErr(s)).not.toBeNull();
    });
  }
});

test('TestComboDoesNotChangePlainBars', () => {
  const s = comboSpec();
  s.data!.series = s.data!.series!.slice(0, 1);
  s.y2_axis = null;
  expect(Build(s)).toBeInstanceOf(barchart.Model); // plain bars became a combo
  s.type = ChartTypeLine;
  expect(buildErr(s)).not.toBeNull(); // silently rendered a bar series as a line
});

test('TestComboAxisLimitsAndClipping', () => {
  const s = comboSpec();
  s.y2_axis = { min: 0, max: 1 };
  s.data!.series![1].values = [
    { x: 'C', y: 0 },
    { x: 'B', y: 1 },
  ];
  let m = Build(s) as ComboModel;
  for (const tc of [
    { i: 0, y: m.graphHeight() - 1 },
    { i: 2, y: 0 },
  ]) {
    expect(isBraille(m.canvas.cell({ x: comboCenter(m, tc.i), y: tc.y }).rune)).toBe(true); // lost endpoint at axis limit
  }
  s.data!.series![1].values = [{ y: -1 }, { y: 0.5 }, { y: 2 }];
  m = Build(s) as ComboModel;
  let found = false;
  for (let y = 0; y < m.graphHeight(); y++) found = found || isBraille(m.canvas.cell({ x: comboCenter(m, 1), y }).rune);
  expect(found).toBe(true); // crossing segments were lost during clipping
  // Positional trailing omissions keep slots, and explicit X beats shared X.
  s.data!.x_axis_data = ['C', 'A', 'B'];
  s.data!.series![0].values = [{ y: 0 }, { x: 'B', y: 3 }];
  const c = ResolveCategoricalCombo(s);
  expect([c.bars[0], c.bars[1], c.bars[2]]).toEqual([0, null, 3]); // zero, omission, or explicit category precedence lost
});

test('TestComboOverlayPreservesBarBackground', () => {
  const s = comboSpec();
  s.y_axis = { min: -10, max: 10 };
  s.y2_axis = { min: -10, max: 10 };
  s.data!.series![0].color = '#123abc';
  s.data!.series![0].values = [{ y: 10 }, { y: -10 }, { y: 10 }];
  s.data!.series![1].color = '#ff9900';
  s.data!.series![1].values = [{ y: 5 }, { y: -5 }, { y: 5 }];
  const overlay = Build(s) as ComboModel;
  s.data!.series![1].values = null;
  const bars = Build(s) as ComboModel;
  for (const [w, h] of [
    [64, 16],
    [30, 8],
    [80, 20],
  ]) {
    overlay.resize(w, h);
    bars.resize(w, h);
    let onBar = 0;
    let offBar = 0;
    for (let y = 0; y < overlay.graphHeight(); y++) {
      for (let x = 0; x < overlay.width(); x++) {
        const cell = overlay.canvas.cell({ x, y });
        if (!isBraille(cell.rune)) continue;
        const under = bars.canvas.cell({ x, y });
        expect(cell.style.getForeground()).toEqual(overlay['lineStyle'].getForeground()); // line foreground changed
        if (under.rune === '█') {
          onBar++;
          expect(cell.style.getBackground()).toEqual(under.style.getForeground()); // line punched a hole
        } else {
          offBar++;
          expect(cell.style.getBackground()).toEqual(overlay['lineStyle'].getBackground()); // bar background leaked
        }
      }
    }
    expect(onBar).toBeGreaterThan(0);
    expect(offBar).toBeGreaterThan(0);
  }
});
