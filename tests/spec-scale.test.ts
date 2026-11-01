// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.
//
// Port of spec/build_scale_test.go and spec/build_y2_test.go.
import { describe, expect, test } from 'bun:test';
import { colorToRGB } from '@oakoliver/lipgloss';
import { log10, pow10 } from '../src/internal/gomath.js';
import * as linechart from '../src/linechart/index.js';
import * as tslc from '../src/linechart/timeserieslinechart/index.js';
import { axisLabelFormatter, logRange } from '../src/spec/scale.js';
import {
  Build,
  ChartTypeLine,
  ChartTypeOHLC,
  ChartTypeScatter,
  ChartTypeTimeSeries,
  ChartTypeBar,
  ChartTypeSparkline,
  FormatValue,
  MarshalJSON,
  ScaleLinear,
  ScaleLog,
  YAxisLeft,
  YAxisRight,
  type ChartType,
  type DataPoint,
  type Format,
  type Spec,
  type YAxis,
} from '../src/spec/index.js';
import {
  HOUR,
  addMs,
  barSpec,
  clone,
  golden,
  heatSpec,
  logSpec,
  ohlcSpec,
  rangeSpec,
  sparkSpec,
  strip,
  view,
  viewOf,
  wantBuildError,
} from './spec-helpers.js';

// logKinds are the chart types that honour a log Y axis.
const logKinds: ChartType[] = [ChartTypeLine, ChartTypeScatter, ChartTypeTimeSeries, ChartTypeOHLC];

/**
 * yLabels returns the non-empty Y tick labels of a view, top to bottom: the
 * text left of the first box-drawing or braille rune on each row.
 */
function yLabels(v: string): string[] {
  const labels: string[] = [];
  const lines = v.split('\n');
  for (const line of lines.slice(0, -1)) {
    // last row holds the X labels
    const i = [...line].findIndex((r) => r.codePointAt(0)! >= 0x2500);
    if (i < 0) continue;
    const l = [...line].slice(0, i).join('').trim();
    if (l !== '') labels.push(l);
  }
  return labels;
}

/** plotRows returns the view without its X label row. */
const plotRows = (v: string): string => v.slice(0, v.lastIndexOf('\n'));

interface Ranged {
  viewMinX(): number;
  viewMaxX(): number;
  viewMinY(): number;
  viewMaxY(): number;
}

function yRange(s: Spec): [number, number] {
  const m = Build(s) as unknown as Ranged;
  return [m.viewMinY(), m.viewMaxY()];
}

function wantTrimmedView(s: Spec, want: string): void {
  const got = viewOf(s)
    .split('\n')
    .map((l) => l.replace(/ +$/, ''))
    .join('\n');
  expect(got).toBe(want.replace(/^\n+|\n+$/g, ''));
}

// TestLogYDecadeLabels spans six decades on a 12-row graph, so every other
// row is a decade tick. Each must print its power of ten exactly, in every
// format, on every chart type that honours a log Y axis.
describe('TestLogYDecadeLabels', () => {
  for (const tc of [
    { name: 'default', format: {}, want: ['1M', '100k', '10k', '1k', '100', '10', '1'] },
    { name: 'number', format: { kind: 'number' }, want: ['1000000', '100000', '10000', '1000', '100', '10', '1'] },
    {
      name: 'currency',
      format: { kind: 'currency' },
      want: ['$1000000.00', '$100000.00', '$10000.00', '$1000.00', '$100.00', '$10.00', '$1.00'],
    },
    { name: 'si', format: { kind: 'si' }, want: ['1.0M', '100.0k', '10.0k', '1.0k', '100.0', '10.0', '1.0'] },
    {
      name: 'percent',
      format: { kind: 'percent' },
      want: ['100000000%', '10000000%', '1000000%', '100000%', '10000%', '1000%', '100%'],
    },
  ] as { name: string; format: Format; want: string[] }[]) {
    for (const kind of logKinds) {
      test(`${tc.name}/${kind}`, () => {
        const s = logSpec(kind, 1, 30, 2000, 1e6);
        s.y_axis!.format = tc.format;
        expect(yLabels(viewOf(s))).toEqual(tc.want);
      });
    }
  }
});

test('TestLogYDecadeLabelsBelowOne', () => {
  const s = logSpec(ChartTypeScatter, 0.001, 0.5, 40, 1000);
  s.y_axis!.format = { kind: 'number' };
  expect(yLabels(viewOf(s))).toEqual(['1000', '100', '10', '1', '0.1', '0.01', '0.001']);
});

// math.Log10(1000) is 2.9999999999999996; its floor must not start the axis
// a decade low. Ranges that are already whole decades stay put, in data units.
test('TestLogDecadesAreExact', () => {
  for (let exp = -12; exp <= 15; exp++) {
    const v = pow10(exp);
    expect(logRange(v, v * 1000, false, false)).toEqual([v, pow10(exp + 3)]);
  }
  for (const kind of logKinds) expect(yRange(logSpec(kind, 1000, 1e6))).toEqual([1000, 1e6]);
});

test('TestLogDefaultLabels', () => {
  const label = axisLabelFormatter({}, ScaleLog)!;
  for (const [v, want] of [
    [1, '1'],
    [10, '10'],
    [100, '100'],
    [1000, '1k'],
    [1e6, '1M'],
    [1e9, '1G'],
    [1e12, '1T'],
    [0.1, '0.1'],
    [0.001, '0.001'],
    [0.0001, '0.0001'],
    [1e-5, '1e-05'],
    [1e14, '100T'],
    [1e15, '1e+15'],
    [Math.sqrt(10), '3.16'],
    [31.6227766, '31.6'],
    [316.227766, '316'],
    [3162.27766, '3.16k'],
    [31622.7766, '31.6k'],
    [0.0316227766, '0.0316'],
    [999.6, '1k'],
    [999600, '1M'],
    [2.5e6, '2.5M'],
    [50, '50'],
  ] as [number, string][]) {
    expect([v, label(0, v)]).toEqual([v, want]);
  }
});

function revenueSpec(width: number, ys: number[]): Spec {
  return {
    type: ChartTypeTimeSeries,
    width,
    height: 9,
    y_axis: { scale: ScaleLog, format: { kind: 'currency' } },
    data: { series: [{ name: 'revenue', values: ys.map((y, i) => ({ x: new Date(Date.UTC(2026, 0, 1 + i)), y })) }] },
  };
}

// TestLogTicksAtUnevenHeight: 4 decades on 7 rows; the ticks sit on powers
// of ten (every second one, since adjacent decades are under two rows apart).
test('TestLogTicksAtUnevenHeight', () => {
  const s = revenueSpec(44, [2.5, 4, 9, 30, 55, 180, 700, 1500, 4200, 9800]);
  wantTrimmedView(
    s,
    `$10000.00│                             ⢀⣀⠤⠒⠉
         │                       ⢀⣀⡠⠤⠒⠊⠁
         │                   ⢀⡠⠔⠊⠁
  $100.00│              ⢀⣀⠤⠒⠉⠁
         │         ⣀⠤⠒⠊⠉⠁
         │  ⣀⣀⣀⠤⠤⠒⠉
         │⠉⠉
    $1.00└──────────────────────────────────
         '26 01/01   01/04   01/06   01/08`,
  );
  // The same holds at every height: only powers of ten are labelled.
  for (let h = 5; h <= 30; h++) {
    s.height = h;
    const labels = yLabels(viewOf(s));
    for (const l of labels) expect(['$1.00', '$10.00', '$100.00', '$1000.00', '$10000.00']).toContain(l);
    expect(labels.length).toBeGreaterThanOrEqual(2);
  }
});

// When decades are too close to label each one, the kept labels count from
// the ends of the axis, so the range can be read off the chart.
test('TestLogThinnedTicksLabelTheEnds', () => {
  let s = revenueSpec(56, [12, 30, 25, 140, 600, 450, 3000, 9000, 20000, 85000]);
  wantTrimmedView(
    s,
    `
$100000.00│                                         ⢀⡠⠔⠊
          │                                  ⣀⣀⠤⠤⠔⠒⠊⠁
          │                            ⢀⡠⠔⠒⠊⠉
  $1000.00│                   ⢀⣀⣀⡀  ⣀⠤⠊⠁
          │               ⣀⠤⠒⠊⠁  ⠈⠉⠉
          │           ⣀⠤⠒⠉
          │⠤⠔⠒⠒⠉⠉⠉⠉⠉⠉⠉
    $10.00└─────────────────────────────────────────────
          '26 01/01   01/03   01/05   01/06   01/08
`,
  );
  expect(yRange(s)).toEqual([10, 1e5]);

  // Scatter, both axes log: Y spans 0.1 .. 100k on ten rows.
  s = {
    type: ChartTypeScatter,
    width: 44,
    height: 12,
    x_axis: { scale: ScaleLog },
    y_axis: { scale: ScaleLog },
    data: {
      series: [
        {
          name: 'a',
          values: [
            { x: 2.0, y: 0.3 },
            { x: 9.0, y: 4 },
            { x: 40.0, y: 2 },
            { x: 150.0, y: 90 },
            { x: 700.0, y: 1200 },
            { x: 3000.0, y: 800 },
            { x: 8000.0, y: 60000 },
          ],
        },
      ],
    },
  };
  wantTrimmedView(
    s,
    `
100k│                                     •
    │
    │
  1k│                           •     •
    │
    │                     •
    │
  10│         •     •
    │   •
    │
 0.1└───────────────────────────────────────
    1         10        100      1k      10k
`,
  );
  expect(yRange(s)).toEqual([0.1, 1e5]);
});

// TestLogYMatchesLinearPlotOfLogs draws each chart type twice: with a log Y
// axis, and with a linear Y axis over the same data's base-10 logs. The
// plotted cells must be identical.
describe('TestLogYMatchesLinearPlotOfLogs', () => {
  for (const kind of logKinds) {
    test(kind, () => {
      const logged = logSpec(kind, 3, 400, 20, 9000, 70);
      logged.y_axis!.format = { kind: 'currency', precision: 0 };

      const linear = logSpec(kind, 3, 400, 20, 9000, 70);
      linear.y_axis = { min: 0, max: 4, format: { kind: 'number', precision: 4 } };
      const ser = linear.data!.series![0];
      for (const p of ser.values!) p.y = log10(p.y);
      for (const o of ser.ohlc!) {
        o.o = log10(o.o);
        o.h = log10(o.h);
        o.l = log10(o.l);
        o.c = log10(o.c);
      }

      const got = viewOf(logged);
      const want = viewOf(linear);
      const stripCols = (v: string) =>
        plotRows(v)
          .split('\n')
          .map((line) => [...line].slice(6).join('') + '\n')
          .join('');
      expect(stripCols(got)).toBe(stripCols(want));
      const labels = yLabels(got);
      expect([labels[0], labels[labels.length - 1]]).toEqual(['$10000', '$1']);
    });
  }
});

// TestLogXMatchesLinearPlotOfLogs is the X-axis counterpart for the two
// numeric-X chart types. X runs 1..1000, so the decade range is 0..3 in both.
describe('TestLogXMatchesLinearPlotOfLogs', () => {
  for (const kind of [ChartTypeLine, ChartTypeScatter]) {
    test(kind, () => {
      const points: DataPoint[] = [
        { x: 1.0, y: 2 },
        { x: 4.0, y: 5 },
        { x: 30.0, y: 1 },
        { x: 250.0, y: 4 },
        { x: 1000.0, y: 3 },
      ];
      const logged: Spec = { type: kind, width: 40, height: 10, x_axis: { scale: ScaleLog }, data: { series: [{ name: 'a', values: points }] } };
      const linear: Spec = {
        type: kind,
        width: 40,
        height: 10,
        data: { series: [{ name: 'a', values: points.map((p) => ({ ...p, x: log10(p.x as number) })) }] },
      };
      const got = viewOf(logged);
      expect(plotRows(got)).toBe(plotRows(viewOf(linear)));
      expect(got.slice(got.lastIndexOf('\n')).trim().split(/\s+/)).toEqual(['1', '10', '100', '1k']);
      const x = Build(logged) as unknown as Ranged;
      expect([x.viewMinX(), x.viewMaxX()]).toEqual([1, 1000]);
    });
  }
});

test('TestLogXExpandsToDecadesAndFormats', () => {
  for (const kind of [ChartTypeLine, ChartTypeScatter]) {
    const s: Spec = {
      type: kind,
      width: 40,
      height: 10,
      x_axis: { scale: ScaleLog, format: { kind: 'si', precision: 0 } },
      y_axis: { scale: ScaleLog },
      data: {
        series: [
          {
            name: 'a',
            values: [
              { x: 20.0, y: 5 },
              { x: 700.0, y: 50 },
              { x: 30000.0, y: 500 },
            ],
          },
        ],
      },
    };
    const m = Build(s) as unknown as Ranged & { view(): string };
    expect([m.viewMinX(), m.viewMaxX(), m.viewMinY(), m.viewMaxY()]).toEqual([10, 1e5, 1, 1000]);
    const v = m.view();
    expect(v.slice(v.lastIndexOf('\n')).trim().split(/\s+/)).toEqual(['10', '100', '1k', '10k', '100k']);
  }
});

// A single X value (or a flat Y series) on a power of ten has no decade to
// round out to, so the range widens by one decade on each side.
test('TestLogFlatRangesWiden', () => {
  for (const kind of logKinds) {
    expect(yRange(logSpec(kind, 100, 100))).toEqual([10, 1000]);
    expect(yRange(logSpec(kind, 50, 50))).toEqual([10, 100]);
  }
  for (const kind of [ChartTypeLine, ChartTypeScatter]) {
    const s = logSpec(kind, 5);
    s.x_axis = { scale: ScaleLog };
    s.data!.series![0].values![0].x = 100.0;
    const x = Build(s) as unknown as Ranged;
    expect([x.viewMinX(), x.viewMaxX()]).toEqual([10, 1000]);
  }
});

// TestLogYPins applies the one-sided pin rule on a log axis. The data spans 2..5000.
describe('TestLogYPins', () => {
  for (const kind of logKinds) {
    for (const tc of [
      { name: 'none', min: null, max: null, lo: 1, hi: 1e4 },
      { name: 'min', min: 0.5, max: null, lo: 0.5, hi: 1e4 },
      { name: 'max', min: null, max: 20000, lo: 1, hi: 20000 },
      { name: 'both', min: 1, max: 1e5, lo: 1, hi: 1e5 },
      { name: 'both off-decade', min: 3, max: 300, lo: 3, hi: 300 },
      { name: 'min inside data', min: 50, max: null, lo: 50, hi: 1e4 },
      { name: 'min at data max', min: 5000, max: null, lo: 5000, hi: 1e4 },
      { name: 'max at data min', min: null, max: 2, lo: 1, hi: 2 },
    ]) {
      test(`${kind}/${tc.name}`, () => {
        const s = logSpec(kind, 2, 40, 5000);
        s.y_axis!.min = tc.min;
        s.y_axis!.max = tc.max;
        expect(yRange(s)).toEqual([tc.lo, tc.hi]);
      });
    }
    // A lone pin on the same power of ten as the data's opposite extreme
    // leaves no decade to round to: only the unpinned side widens.
    test(`${kind}/min at decade data max`, () => {
      const s = logSpec(kind, 10, 1000);
      s.y_axis!.min = 1000;
      expect(yRange(s)).toEqual([1000, 1e4]);
    });
    test(`${kind}/max at decade data min`, () => {
      const s = logSpec(kind, 10, 1000);
      s.y_axis!.max = 10;
      expect(yRange(s)).toEqual([1, 10]);
    });
    test(`${kind}/equal pins`, () => {
      const s = logSpec(kind, 2, 40, 5000);
      s.y_axis!.min = 30;
      s.y_axis!.max = 30;
      wantBuildError(s, 'spec: y_axis min and max must differ');
    });
    test(`${kind}/inverted pins`, () => {
      const s = logSpec(kind, 2, 40, 5000);
      s.y_axis!.min = 300;
      s.y_axis!.max = 30;
      wantBuildError(s, 'spec: y_axis min 300 exceeds max 30');
    });
    test(`${kind}/min above data`, () => {
      const s = logSpec(kind, 2, 40, 5000);
      s.y_axis!.min = 6000;
      wantBuildError(s, 'spec: y_axis min 6000 exceeds max 5000');
    });
    test(`${kind}/max below data`, () => {
      const s = logSpec(kind, 2, 40, 5000);
      s.y_axis!.max = 1.5;
      wantBuildError(s, 'spec: y_axis min 2 exceeds max 1.5');
    });
  }
});

// Off-decade pins bound the axis, but the labels stay on the round values inside them.
test('TestLogYPinnedBoundLabels', () => {
  const s = logSpec(ChartTypeScatter, 2, 40, 5000);
  s.y_axis!.min = 0.5;
  s.y_axis!.max = 20000;
  expect(yLabels(viewOf(s))).toEqual(['10k', '1k', '100', '10', '1']);
});

test('TestLogRejectsNonPositivePins', () => {
  for (const kind of logKinds) {
    for (const v of [0, -5]) {
      let s = logSpec(kind, 2, 40, 5000);
      s.y_axis!.min = v;
      wantBuildError(s, 'spec: y_axis scale "log" requires a positive finite min; got ' + FormatValue({}, v));
      s = logSpec(kind, 2, 40, 5000);
      s.y_axis!.max = v;
      wantBuildError(s, 'spec: y_axis scale "log" requires a positive finite max; got ' + FormatValue({}, v));
    }
  }
});

test('TestLogRejectsNonPositiveValues', () => {
  for (const kind of [ChartTypeLine, ChartTypeScatter, ChartTypeTimeSeries]) {
    for (const [v, text] of [
      [0, '0'],
      [-3, '-3'],
      [NaN, 'NaN'],
      [Infinity, '+Inf'],
    ] as [number, string][]) {
      wantBuildError(
        logSpec(kind, 2, v, 5000),
        'spec: y_axis scale "log" requires positive finite values; series "a" point 1 has y = ' + text,
      );
    }
  }

  for (const tc of [
    { set: (p: { o: number }) => (p.o = 0), field: 'open = 0' },
    { set: (p: { h: number }) => (p.h = -1), field: 'high = -1' },
    { set: (p: { l: number }) => (p.l = -0.5), field: 'low = -0.5' },
    { set: (p: { c: number }) => (p.c = 0), field: 'close = 0' },
  ] as { set: (p: { o: number; h: number; l: number; c: number }) => void; field: string }[]) {
    const s = logSpec(ChartTypeOHLC, 2, 40, 5000);
    tc.set(s.data!.series![0].ohlc![2]);
    wantBuildError(s, 'spec: y_axis scale "log" requires positive finite values; ohlc point 2 has ' + tc.field);
  }

  for (const kind of [ChartTypeLine, ChartTypeScatter]) {
    let s = logSpec(kind, 2, 40, 5000);
    s.x_axis = { scale: ScaleLog };
    s.data!.series![0].values![1].x = -10.0;
    wantBuildError(s, 'spec: x_axis scale "log" requires positive finite values; series "a" point 1 has x = -10');

    // An omitted X falls back to the point index, and index 0 has no log.
    s = logSpec(kind, 2, 40, 5000);
    s.x_axis = { scale: ScaleLog };
    for (const p of s.data!.series![0].values!) p.x = null;
    wantBuildError(s, 'spec: x_axis scale "log" requires positive finite values; series "a" point 0 has x = 0');

    // The same values are fine while the axis is linear.
    s.x_axis = { scale: ScaleLinear };
    expect(() => Build(s)).not.toThrow();
  }
});

test('TestLogXRejectedOnTimeAxes', () => {
  for (const kind of [ChartTypeTimeSeries, ChartTypeOHLC]) {
    const s = logSpec(kind, 2, 40, 5000);
    s.y_axis!.scale = '';
    s.x_axis = { scale: ScaleLog };
    wantBuildError(s, `spec: ${kind} chart cannot draw x_axis scale "log": its X axis is time`);
  }
});

test('TestLogRejectedByChartsWithoutAValueAxis', () => {
  for (const tc of [
    { spec: barSpec(1), why: 'bars are measured linearly from a zero baseline' },
    { spec: heatSpec(), why: 'its axes are cell indices, not scaled values' },
    { spec: sparkSpec(), why: 'columns are measured linearly from zero and it draws no axis' },
  ]) {
    const s = tc.spec;
    expect(() => Build(s)).not.toThrow();
    s.y_axis = { ...s.y_axis, scale: ScaleLog };
    wantBuildError(s, `spec: ${s.type} chart cannot draw y_axis scale "log": ${tc.why}`);
    s.y_axis.scale = ScaleLinear;
    s.x_axis = { ...s.x_axis, scale: ScaleLog };
    wantBuildError(s, `spec: ${s.type} chart cannot draw x_axis scale "log": ${tc.why}`);
  }
});

// TestLinearScaleUnchanged checks that an explicit "linear" scale draws
// exactly what an empty one does.
test('TestLinearScaleUnchanged', () => {
  const lineSpec: Spec = {
    type: ChartTypeLine,
    width: 40,
    height: 10,
    data: {
      series: [
        { name: 'a', color: '#ff0000', values: [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 5 }] },
        { name: 'b', values: [{ x: 0, y: 4 }, { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 1 }] },
      ],
    },
  };
  const scatterSpec: Spec = { ...clone(lineSpec), type: ChartTypeScatter, x_axis: { format: { kind: 'si' } } };
  for (const s of [lineSpec, scatterSpec, rangeSpec(ChartTypeTimeSeries), ohlcSpec(), barSpec(1), heatSpec(), sparkSpec()]) {
    const want = view(s); // styled: heatmap cells differ only in colour
    s.x_axis = { ...s.x_axis, scale: ScaleLinear };
    s.y_axis = { ...s.y_axis, scale: ScaleLinear };
    expect(view(s)).toBe(want);
  }
});

test('TestLogBuildDoesNotMutateSpec', () => {
  for (const kind of logKinds) {
    const s = logSpec(kind, 2, 40, 5000);
    s.y_axis!.min = 1;
    if (kind === ChartTypeLine || kind === ChartTypeScatter) s.x_axis = { scale: ScaleLog };
    const before = MarshalJSON(s);
    Build(s);
    expect(MarshalJSON(s)).toBe(before);
  }
});

// ── build_y2_test.go ────────────────────────────────────────────────────────

const y2Start = new Date(Date.UTC(2026, 0, 1));

function line4(kind: ChartType): Spec {
  return {
    type: kind,
    width: 40,
    height: 12,
    data: { series: [{ name: 'a', color: '#00ff00', values: [{ x: 0.0, y: 1 }, { x: 1.0, y: 3 }, { x: 2.0, y: 2 }, { x: 3.0, y: 5 }] }] },
  };
}

// leftOnlySpecs are one-series specs of every chart type that will learn a
// right axis. Their renders must never change.
function leftOnlySpecs(): Record<string, Spec> {
  const load = [0.1, 0.3, 0.2, 0.6, 0.5, 0.8, 0.7, 0.9, 0.4, 0.6, 0.2];
  const l = load.map((y, i) => ({ x: addMs(y2Start, i * HOUR), y }));
  return {
    timeseries: {
      type: ChartTypeTimeSeries,
      width: 44,
      height: 12,
      y_axis: { min: 0, max: 1, format: { precision: 1 } },
      data: { series: [{ name: 'load', color: '#00ff00', values: l }] },
    },
    line: line4(ChartTypeLine),
    scatter: line4(ChartTypeScatter),
  };
}

// TestGoldenLeftOnly pins the renders of specs without a right Y axis.
describe('TestGoldenLeftOnly', () => {
  for (const [name, s] of Object.entries(leftOnlySpecs())) {
    test(name, () => golden('leftonly_' + name, view(s)));
  }
});

test('TestBuildRejectsY2AxisOnUnsupportedTypes', () => {
  for (const kind of [ChartTypeBar, ChartTypeOHLC, ChartTypeSparkline]) {
    const s = rangeSpec(kind);
    s.y2_axis = {};
    wantBuildError(s, `spec: y2_axis is not supported for chart type "${kind}"`);
  }
  const h = heatSpec();
  h.y2_axis = {};
  wantBuildError(h, 'spec: y2_axis is not supported for chart type "heatmap"');
});

// y2TimeSeriesSpec has a load series on the left axis (0..1) and a
// temperature series on the right axis (5..20 C).
function y2TimeSeriesSpec(): Spec {
  const load = [0.1, 0.3, 0.2, 0.6, 0.5, 0.8, 0.7, 0.9, 0.4, 0.6, 0.2];
  const temp = [19, 17, 18, 14, 15, 11, 12, 8, 9, 6, 5];
  const l: DataPoint[] = [];
  const r: DataPoint[] = [];
  for (let i = 0; i < load.length; i++) {
    const x = addMs(y2Start, i * HOUR);
    l.push({ x, y: load[i] });
    r.push({ x, y: temp[i] });
  }
  return {
    type: ChartTypeTimeSeries,
    width: 44,
    height: 12,
    y_axis: { min: 0, max: 1, format: { precision: 1 } },
    y2_axis: { min: 5, max: 20 },
    data: {
      series: [
        { name: 'load', color: '#00ff00', values: l },
        { name: 'temp', color: '#ff0000', y_axis: YAxisRight, values: r },
      ],
    },
  };
}

/** rightLabels returns the non-empty text right of the chart's right axis column, top to bottom. */
function rightLabels(m: linechart.Model): string[] {
  const labels: string[] = [];
  strip(m.view())
    .split('\n')
    .forEach((line, i) => {
      if (i > m.origin().y) return;
      const r = [...line];
      if (m.graphRight() + 1 >= r.length) return;
      const l = r.slice(m.graphRight() + 1).join('').trim();
      if (l !== '') labels.push(l);
    });
  return labels;
}

test('TestBuildTimeSeriesTwoAxes', () => {
  const m = Build(y2TimeSeriesSpec()) as tslc.Model;
  const [a, ok] = m.y2Axis();
  expect([ok, a.min, a.max]).toEqual([true, 5, 20]);
  expect([m.minY(), m.maxY()]).toEqual([0, 1]);
  const v = strip(m.view());
  const left = yLabels(v);
  expect([left[0], left[left.length - 1]]).toEqual(['1.0', '0.0']);
  const right = rightLabels(m);
  expect(right.length).toBeGreaterThanOrEqual(2);
  expect([right[0], right[right.length - 1]]).toEqual(['20', '5']);
  // the temperature line falls from top-left to bottom-right
  const rows = v.split('\n');
  const ink = (x: number): [number, number] => {
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < m.origin().y; y++) {
      const r = [...rows[y]];
      const c = x < r.length ? r[x].codePointAt(0)! : 0;
      if (c > 0x2800 && c <= 0x28ff) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    return [top, bottom];
  };
  expect(ink(m.origin().x + 1)[0]).toBeLessThanOrEqual(m.origin().y / 3);
  expect(ink(m.graphRight() - 1)[1]).toBeGreaterThanOrEqual((2 * m.origin().y) / 3);
});

test('TestBuildTimeSeriesLeftOnlyUnchanged', () => {
  const s = y2TimeSeriesSpec();
  s.y2_axis = null;
  s.data!.series = s.data!.series!.slice(0, 1);
  const want = view(s);
  // the same spec with an explicit left axis must render exactly as before
  const s2 = clone(s);
  s2.data!.series![0].y_axis = YAxisLeft;
  expect(view(s2)).toBe(want);
});

test('TestBuildTimeSeriesY2AxisWithoutRightSeries', () => {
  const s = y2TimeSeriesSpec();
  s.data!.series = s.data!.series!.slice(0, 1);
  const m = Build(s) as tslc.Model;
  const [a, ok] = m.y2Axis();
  expect([ok, a.min, a.max]).toEqual([true, 5, 20]);
  const right = rightLabels(m);
  expect(right.length).toBeGreaterThan(0);
  expect(right[0]).toBe('20');
});

test('TestBuildTimeSeriesY2Pins', () => {
  for (const tc of [
    { axis: { min: 6 }, min: 6, max: 19 },
    { axis: { max: 18 }, min: 5, max: 18 },
    { axis: { min: 6, max: 18 }, min: 6, max: 18 },
    { axis: { min: 19 }, min: 19, max: 20 },
  ] as { axis: YAxis; min: number; max: number }[]) {
    const s = y2TimeSeriesSpec();
    s.y2_axis = tc.axis;
    const [a] = (Build(s) as tslc.Model).y2Axis();
    expect([a.min, a.max]).toEqual([tc.min, tc.max]);
  }
  const s = y2TimeSeriesSpec();
  s.y2_axis = { min: 30 };
  wantBuildError(s, 'spec: y2_axis min 30 exceeds max 19');
  s.y2_axis = { min: 7, max: 7 };
  wantBuildError(s, 'spec: y2_axis min and max must differ');
});

test('TestBuildTimeSeriesY2AutoRangesWhenUnpinned', () => {
  const s = y2TimeSeriesSpec();
  s.y2_axis = {};
  const [a] = (Build(s) as tslc.Model).y2Axis();
  expect([a.min, a.max, a.autoMin, a.autoMax]).toEqual([0, 19, true, true]);
});

test('TestBuildTimeSeriesY2Log', () => {
  let s = y2TimeSeriesSpec();
  s.y2_axis = { scale: ScaleLog };
  s.data!.series![1].values!.forEach((p, i) => (p.y = (i + 1) * 3));
  const [a] = (Build(s) as tslc.Model).y2Axis();
  expect(a.scale).toBe(linechart.ScaleLog);
  expect([a.min, a.max, a.autoMin, a.autoMax]).toEqual([1, 100, false, false]);
  s.data!.series![1].values![2].y = 0;
  wantBuildError(s, 'spec: y2_axis scale "log" requires positive finite values; series "temp" point 2 has y = 0');
  s = y2TimeSeriesSpec(); // positive values again, so the pin is what fails
  s.y2_axis = { scale: ScaleLog, min: 0 };
  wantBuildError(s, 'spec: y2_axis scale "log" requires a positive finite min; got 0');
});

test('TestBuildTimeSeriesY2LabelStyleFollowsFirstRightSeries', () => {
  const [a] = (Build(y2TimeSeriesSpec()) as tslc.Model).y2Axis();
  expect(colorToRGB(a.labelStyle.getForeground())).toEqual(colorToRGB('#ff0000'));
});

// y2LineSpec: "a" on the left (1..5), "b" on the right (100..500).
function y2LineSpec(kind: ChartType): Spec {
  return {
    type: kind,
    width: 40,
    height: 12,
    y2_axis: {},
    data: {
      series: [
        { name: 'a', color: '#00ff00', values: [{ x: 0.0, y: 1 }, { x: 1.0, y: 3 }, { x: 2.0, y: 2 }, { x: 3.0, y: 5 }] },
        {
          name: 'b',
          color: '#ff0000',
          y_axis: YAxisRight,
          values: [{ x: 0.0, y: 500 }, { x: 1.0, y: 300 }, { x: 2.0, y: 400 }, { x: 3.0, y: 100 }],
        },
      ],
    },
  };
}

describe('TestBuildLineAndScatterTwoAxes', () => {
  for (const kind of [ChartTypeLine, ChartTypeScatter]) {
    test(kind, () => {
      const m = Build(y2LineSpec(kind)) as linechart.Model;
      const [a, ok] = m.y2Axis();
      expect(ok).toBe(true);
      // line: 0..1 widened around the data, as the left axis is; scatter: the data's extremes
      expect([a.min, a.max]).toEqual(kind === ChartTypeLine ? [0, 500] : [100, 500]);
      const right = rightLabels(m);
      expect(right.length).toBeGreaterThanOrEqual(2);
      expect(right[0]).toBe('500');
      // series b's last point is low on the right axis: the lowest ink in
      // the last plot column is b's.
      const rows = strip(m.view()).split('\n');
      const x = m.graphRight() - 1;
      let bottom = -1;
      for (let y = 0; y < m.origin().y; y++) {
        const r = [...rows[y]];
        if (x < r.length && r[x] !== ' ' && r[x] !== '⠀') bottom = y;
      }
      const wantBelow = kind === ChartTypeScatter ? m.origin().y - 2 : Math.trunc(m.origin().y / 2);
      expect(bottom).toBeGreaterThanOrEqual(wantBelow);
    });
  }
});

test('TestBuildLineLeftOnlyUnchanged', () => {
  for (const kind of [ChartTypeLine, ChartTypeScatter]) {
    const s = y2LineSpec(kind);
    s.y2_axis = null;
    s.data!.series = s.data!.series!.slice(0, 1);
    const want = view(s);
    const s2 = clone(s);
    s2.data!.series![0].y_axis = YAxisLeft;
    expect(view(s2)).toBe(want);
  }
});

test('TestBuildLineY2Pins', () => {
  for (const kind of [ChartTypeLine, ChartTypeScatter]) {
    const s = y2LineSpec(kind);
    s.y2_axis = { min: 200 };
    const [a] = (Build(s) as linechart.Model).y2Axis();
    expect([a.min, a.max]).toEqual([200, 500]);
    s.y2_axis = { min: 900 };
    wantBuildError(s, 'spec: y2_axis min 900 exceeds max 500');
  }
});

test('TestBuildLineY2LogRejectsNonPositive', () => {
  for (const kind of [ChartTypeLine, ChartTypeScatter]) {
    const s = y2LineSpec(kind);
    s.y2_axis = { scale: ScaleLog };
    const [a] = (Build(s) as linechart.Model).y2Axis();
    expect(a.scale).toBe(linechart.ScaleLog);
    expect([a.min, a.max]).toEqual([100, 1000]);
    s.data!.series![1].values![3].y = -1;
    wantBuildError(s, 'spec: y2_axis scale "log" requires positive finite values; series "b" point 3 has y = -1');
  }
});

test('TestBuildLineMixedScales', () => {
  const s = y2LineSpec(ChartTypeLine);
  s.y_axis = { scale: ScaleLog };
  const m = Build(s) as linechart.Model;
  const [a] = m.y2Axis();
  expect(m.yScale()).toBe(linechart.ScaleLog);
  expect(a.scale).toBe(linechart.ScaleLinear);
});

test('TestBuildScatterEmptyLogLeftAxisWithPin', () => {
  const s = y2LineSpec(ChartTypeScatter);
  s.y_axis = { scale: ScaleLog, min: 5 };
  s.data!.series = s.data!.series!.slice(1); // every series on the right
  const m = Build(s) as linechart.Model;
  expect([m.minY(), m.maxY()]).toEqual([5, 100]); // as line and timeseries give
});

test('TestBuildRejectsSameNameOnDifferentYAxes', () => {
  const s = y2TimeSeriesSpec();
  s.data!.series!.push({
    name: 'temp',
    values: [
      { x: y2Start, y: 2 },
      { x: addMs(y2Start, HOUR), y: 3 },
    ],
  });
  wantBuildError(s, 'spec: series[2] "temp" is also series[1] but on a different y_axis');
});
