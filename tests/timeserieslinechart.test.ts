// Port of upstream linechart/timeserieslinechart/{golden,scale,y2,timeserieslinechart,
// candle_width,window}_test.go.
import * as tslcNs from '../src/linechart/timeserieslinechart/index.js';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newStyle } from '@oakoliver/lipgloss';
import * as runes from '../src/canvas/runes/runes.js';
import { sprintfF } from '../src/internal/format.js';
import * as linechart from '../src/linechart/index.js';
import {
  DateTimeLabelFormatter,
  DefaultDataSetName,
  type DrawCandleOpts,
  HourTimeLabelFormatter,
  type Model,
  New,
  type Option,
  WithDataSetYAxis,
  WithTimeRange,
  WithXYSteps,
  WithY2Axis,
  WithYLabelFormatter,
  WithYRange,
  WithYScale,
} from '../src/linechart/timeserieslinechart/index.js';

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const add = (t: Date, ms: number) => new Date(t.getTime() + ms);
const day0 = new Date(Date.UTC(2026, 0, 1));

function golden(name: string, got: string): void {
  const want = readFileSync(join(import.meta.dir, 'testdata', 'timeserieslinechart', name + '.golden'), 'utf8');
  expect(got).toBe(want);
}

const trimView = (view: string) =>
  view
    .split('\n')
    .map((l) => l.replace(/ +$/, ''))
    .join('\n');

const wantView = (got: string, want: string) => expect(trimView(got)).toBe(want.replace(/^\n+|\n+$/g, ''));

// pushTS pushes vs[i] to the data set n at day0 + i hours.
function pushTS(m: Model, n: string, vs: number[]): void {
  vs.forEach((v, i) => m.pushDataSet(n, { time: add(day0, i * HOUR), value: v }));
}

// newTS returns a 40x12 chart over day0..day0+10h and Y 0..10, then opts.
const newTS = (...opts: Option[]) => New(40, 12, WithTimeRange(day0, add(day0, 10 * HOUR)), WithYRange(0, 10), ...opts);

const tsA = [1, 3, 2, 6, 5, 8, 7, 9, 4, 6, 2];
const tsB = [9, 8, 8, 6, 7, 4, 5, 3, 3, 2, 1];

function pushCandles(m: Model): void {
  const base = new Date(Date.UTC(2026, 0, 5));
  const data = [
    { o: 100, h: 108, l: 97, c: 105 },
    { o: 105, h: 112, l: 103, c: 110 },
    { o: 110, h: 111, l: 98, c: 99 },
  ];
  data.forEach((d, i) => {
    const ts = add(base, i * DAY);
    m.pushDataSet('open', { time: ts, value: d.o });
    m.pushDataSet('high', { time: ts, value: d.h });
    m.pushDataSet('low', { time: ts, value: d.l });
    m.pushDataSet('close', { time: ts, value: d.c });
  });
}

function newCandleModel(): Model {
  const m = New(40, 12, WithTimeRange(new Date(Date.UTC(2026, 0, 5)), new Date(Date.UTC(2026, 0, 7))), WithYRange(95, 115));
  pushCandles(m);
  return m;
}

describe('golden_test.go', () => {
  const s = newStyle();
  const cases: Record<string, () => Model> = {
    draw: () => {
      const m = newTS();
      pushTS(m, DefaultDataSetName, tsA);
      m.draw();
      return m;
    },
    drawall: () => {
      const m = newTS();
      pushTS(m, 'a', tsA);
      pushTS(m, 'b', tsB);
      m.drawAll();
      return m;
    },
    braille: () => {
      const m = newTS();
      pushTS(m, 'a', tsA);
      pushTS(m, 'b', tsB);
      m.drawBrailleAll();
      return m;
    },
    candle: () => {
      const m = newCandleModel();
      m.drawCandle('open', 'high', 'low', 'close', s, s);
      return m;
    },
    candle_wide_block: () => {
      const m = newCandleModel();
      m.drawCandleWithOpts('open', 'high', 'low', 'close', s, s, { width: 3, block: true });
      return m;
    },
    fit: () => {
      const m = newTS();
      pushTS(m, 'a', tsA);
      m.fitYToView();
      m.drawAll();
      return m;
    },
    log: () => {
      const m = newTS(WithYScale(linechart.ScaleLog), WithYRange(1, 1000));
      pushTS(m, 'a', [1, 5, 30, 0, 200, 900, 50, 10, 400, 700, 2]);
      m.drawAll();
      return m;
    },
    no_x_axis: () => {
      const m = newTS(WithXYSteps(0, 2));
      pushTS(m, 'a', tsA);
      pushTS(m, 'b', tsB);
      m.drawAll();
      return m;
    },
    no_y_axis: () => {
      const m = newTS(WithXYSteps(4, 0));
      pushTS(m, 'a', tsA);
      m.drawAll();
      return m;
    },
  };
  for (const [name, build] of Object.entries(cases)) {
    test(`TestGoldenOneAxis/${name}`, () => golden('oneaxis_' + name, build().view()));
  }
});

describe('scale_test.go', () => {
  for (const [name, draw] of [
    ['runes', (m: Model) => m.draw()],
    ['braille', (m: Model) => m.drawBraille()],
  ] as [string, (m: Model) => void][]) {
    test(`TestLogYAxisKeepsIsolatedPoints/${name}`, () => {
      const m = New(40, 10, WithYScale(linechart.ScaleLog), WithYRange(1, 1000), WithTimeRange(day0, add(day0, 4 * HOUR)));
      [10, 0, 100].forEach((v, i) => m.push({ time: add(day0, (i + 1) * HOUR), value: v }));
      draw(m);
      // Inspect only the plot, excluding axes. Each valid point should
      // occupy its own column, with no connection across the zero.
      const left = m.origin().x + 1;
      let seenLeft = false;
      let seenRight = false;
      const middle = left + Math.trunc(m.graphWidth() / 2);
      for (let y = 0; y < m.origin().y; y++) {
        for (let x = left; x < m.width(); x++) {
          const r = m.canvas.cell({ x, y }).rune;
          if (runes.isNull(r) || r === ' ' || r === '⠀') continue;
          expect(x).not.toBe(middle); // line connected across the invalid point
          seenLeft ||= x < middle;
          seenRight ||= x > middle;
        }
      }
      expect(seenLeft && seenRight).toBe(true);
    });
  }

  // logSeries is ten days growing from 3 to a million, with a zero on day 3
  // and a negative value on day 7.
  const logSeries = (...opts: Option[]) => {
    const m = New(44, 11, ...opts, WithTimeRange(day0, add(day0, 9 * DAY)), WithYRange(1, 1e6));
    // a fixed range: auto-ranging would follow the non-positive values
    // while linear, and a log axis could not keep that range
    m.autoMinY = false;
    m.autoMaxY = false;
    [3, 20, 150, 0, 900, 4000, 30000, -1, 200000, 1e6].forEach((v, i) => m.push({ time: add(day0, i * DAY), value: v }));
    return m;
  };

  test('TestLogYAxisBraille', () => {
    const m = logSeries(WithYScale(linechart.ScaleLog));
    m.drawBraille();
    wantView(
      m.view(),
      `
1000000│                                ⢀⡠⠔⠊
       │                               ⠈⠁
       │                      ⡠⠔
  10000│                  ⢀⡠⠒⠉
       │                ⠔⠊⠁
       │       ⣀⠄
    100│    ⡠⠔⠊
       │⢀⡠⠔⠉
       │⠁
      1└────────────────────────────────────
       '26 01/01   01/04   01/06   01/08
`,
    );
    expect([m.yScale(), m.viewMinY(), m.viewMaxY()]).toEqual([linechart.ScaleLog, 1, 1e6]);
  });

  test('TestLogYAxisLineRunes', () => {
    const m = logSeries(WithYScale(linechart.ScaleLog));
    m.draw();
    wantView(
      m.view(),
      `
1000000│                                  ╭─
       │                               ───╯
       │                       ╭
  10000│                     ╭─╯
       │                  ╭──╯
       │               ───╯
    100│      ╭─
       │  ╭───╯
       ├──╯
      1└────────────────────────────────────
       '26 01/01   01/04   01/06   01/08
`,
    );
  });

  test('TestLogYAxisCandles', () => {
    const m = New(44, 11, WithYScale(linechart.ScaleLog), WithTimeRange(day0, add(day0, 5 * DAY)), WithYRange(1, 1e4));
    [
      [2, 30, 1.5, 20],
      [20, 400, 10, 300],
      [300, 500, 0, 40],
      [40, 9000, 30, 5000],
      [5000, 8000, 800, 1000],
    ].forEach((c, i) => {
      const ts = add(day0, (i + 1) * 20 * HOUR);
      m.pushDataSet('open', { time: ts, value: c[0] });
      m.pushDataSet('high', { time: ts, value: c[1] });
      m.pushDataSet('low', { time: ts, value: c[2] });
      m.pushDataSet('close', { time: ts, value: c[3] });
    });
    m.drawCandleWithOpts('open', 'high', 'low', 'close', newStyle(), newStyle(), { width: 3 });
    wantView(
      m.view(),
      `
10000│                        ╻╽╻   ╻╽╻
     │                        ┃┃┃   ┃┃┃
 1000│                        ┃┃┃   ╹╹╹
     │           ┃┃┃          ┃┃┃
  100│           ┃┃┃          ┃┃┃
     │      ╷    ┃┃┃          ╹╿╹
     │     ┃┃┃   ╹╿╹
   10│     ┃┃┃
     │     ╹╿╹
    1└──────────────────────────────────────
     '26 01/01   01/02   01/03   01/04 01/06
`,
    );
  });

  test('TestLogYAxisAutoRange', () => {
    const m = New(44, 11, WithYScale(linechart.ScaleLog));
    [5, 0, -3, 5000].forEach((v, i) => m.push({ time: add(day0, i * HOUR), value: v }));
    // the default 0..1 range becomes 0.1..1, and only positive values widen it
    expect([m.minY(), m.maxY()]).toEqual([0.1, 5000]);
    m.drawBraille(); // must not throw on the values it cannot place
    m.draw();
  });

  test('TestScaleCanChangeAfterPushing', () => {
    for (const draw of [(m: Model) => m.drawBraille(), (m: Model) => m.draw()]) {
      const linear = logSeries();
      draw(linear);

      const explicit = logSeries(WithYScale(linechart.ScaleLinear));
      draw(explicit);
      expect(explicit.view()).toBe(linear.view());

      const log = logSeries(WithYScale(linechart.ScaleLog));
      draw(log);

      const m = logSeries();
      m.setYScale(linechart.ScaleLog);
      draw(m);
      expect(m.view()).toBe(log.view());
      expect(log.view()).not.toBe(linear.view());
      m.setYScale(linechart.ScaleLinear);
      draw(m);
      expect(m.view()).toBe(linear.view());
    }
  });
});

// newY2Model returns a chart with left Y 0..1, right Y 5..20 and the data
// set "r" on the right axis, then opts.
const newY2Model = (...opts: Option[]) =>
  New(
    40,
    12,
    WithTimeRange(day0, add(day0, 10 * HOUR)),
    WithYRange(0, 1),
    WithY2Axis({ min: 5, max: 20 }),
    WithDataSetYAxis('r', linechart.YAxisRight),
    ...opts,
  );

describe('y2_test.go', () => {
  test('TestSetDataSetYAxis', () => {
    const m = New(40, 12);
    m.setDataSetYAxis('r', linechart.YAxisRight);
    expect(m['dSets'].has('r') && m['y2Sets']?.get('r')).toBe(true);
    m.setDataSetYAxis('r', linechart.YAxisLeft);
    expect(m['y2Sets']?.get('r')).toBeFalsy();
  });

  test('TestRightPushAutoRangesRightAxisOnly', () => {
    const m = newY2Model(WithY2Axis({ min: 5, max: 20, autoMax: true }));
    m.pushDataSet('r', { time: add(day0, HOUR), value: 30 });
    expect([m.y2Axis()[0].max, m.maxY()]).toEqual([30, 1]);
  });

  test('TestRightDataSetWithoutRightAxisIsLeft', () => {
    const vals = [1, 3, 2, 6, 5];
    const a = newTS(WithDataSetYAxis('s', linechart.YAxisRight));
    const b = newTS();
    pushTS(a, 's', vals);
    pushTS(b, 's', vals);
    a.drawAll();
    b.drawAll();
    expect(a.view()).toBe(b.view());
    expect(a.fitYToView()).toBe(true);
    expect([a.viewMinY(), a.viewMaxY()]).toEqual([1, 6]);
  });

  test('TestClearY2AxisKeepsAssignment', () => {
    const m = newY2Model();
    m.clearY2Axis();
    expect(m['y2Scale']('r')[1]).toBe(false);
    expect(m['y2Sets']?.get('r')).toBe(true);
    m.setY2Axis({ min: 5, max: 20 });
    expect(m['y2Scale']('r')[1]).toBe(true);
  });

  test('TestRightDataSetFollowsLeftZoom', () => {
    const m = newY2Model();
    m.pushDataSet('r', { time: add(day0, HOUR), value: 12.5 }); // middle of 5..20
    let [p] = m['graphPoints']('r', m['dSets'].get('r')!);
    expect(Math.abs(p[0].y - m.graphHeight() / 2)).toBeLessThanOrEqual(1e-9);
    m.setViewYRange(0, 0.5); // right view 5..12.5
    [p] = m['graphPoints']('r', m['dSets'].get('r')!);
    expect(Math.abs(p[0].y - m.graphHeight())).toBeLessThanOrEqual(1e-9);
  });

  test('TestFitYToViewIgnoresRightDataSets', () => {
    const m = newY2Model();
    pushTS(m, 'l', [0.2, 0.4, 0.3]);
    pushTS(m, 'r', [6, 19, 7]);
    expect(m.fitYToView()).toBe(true);
    expect([m.viewMinY(), m.viewMaxY()]).toEqual([0.2, 0.4]);
    expect(m.fitYToViewWithOpts({ dataSets: ['r'] })).toBe(false);
  });

  test('TestLogRightAxisSkipsNonPositive', () => {
    const m = newY2Model(WithY2Axis({ min: 1, max: 1000, scale: linechart.ScaleLog }));
    pushTS(m, 'r', [10, 0, 100]);
    expect(m['graphPoints']('r', m['dSets'].get('r')!)[1]).toEqual([true, false, true]);
    m.drawAll();
    m.drawBrailleAll();
  });

  test('TestTwoAxisLinesStayLeftOfRightAxis', () => {
    const m = newY2Model();
    pushTS(m, 'l', [0.1, 0.9, 0.5, 1, 0.2, 0.7, 0.4, 0.8, 0.3, 0.6, 1]);
    pushTS(m, 'r', [20, 5, 12, 19, 6, 15, 9, 18, 7, 11, 20]);
    for (const draw of [() => m.drawAll(), () => m.drawBrailleAll()]) {
      draw();
      const x = m.graphRight();
      for (let y = 0; y < m.origin().y; y++) expect(m.canvas.cell({ x, y }).rune).toBe(runes.LineVertical);
    }
  });

  test('TestGoldenTwoAxes', () => {
    const m = newY2Model(WithYLabelFormatter((_i, v) => sprintfF(v, 1)));
    pushTS(m, 'l', [0.1, 0.3, 0.2, 0.6, 0.5, 0.8, 0.7, 0.9, 0.4, 0.6, 0.2]);
    pushTS(m, 'r', [19, 17, 18, 14, 15, 11, 12, 8, 9, 6, 5]);
    m.drawAll();
    golden('twoaxes_lines', m.view());
    m.drawBrailleAll();
    golden('twoaxes_braille', m.view());
  });

  test('TestWideCandleStaysLeftOfRightAxis', () => {
    // 13 columns: left labels "115" + axis + 5 plot columns + axis + "100"
    const m = New(
      13,
      12,
      WithTimeRange(new Date(Date.UTC(2026, 0, 5)), new Date(Date.UTC(2026, 0, 7))),
      WithYRange(95, 115),
      WithY2Axis({ min: 0, max: 100 }),
    );
    pushCandles(m);
    expect(m.graphWidth()).toBe(5);
    const rightOf = () =>
      m
        .view()
        .split('\n')
        .map((line) => Array.from(line).slice(m.graphRight()).join(''));
    m.drawXYAxisAndLabel();
    const want = rightOf();
    const s = newStyle();
    m.drawCandleWithOpts('open', 'high', 'low', 'close', s, s, { width: 9 });
    expect(rightOf()).toEqual(want);
  });
});

describe('timeserieslinechart_test.go', () => {
  test('TestHourTimeLabelFormatterRoundsToNearestMillisecond', () => {
    const f = HourTimeLabelFormatter();
    const base = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
    // base.Add(-400µs).UnixMilli() is one millisecond before base
    const v = (base.getTime() - 1) / 1e3 + 0.0006;
    expect(f(0, v)).toBe('03:04:05');
  });

  test('TestDateTimeLabelFormatterRoundsToNearestMillisecond', () => {
    const f = DateTimeLabelFormatter();
    const base = new Date(Date.UTC(2026, 0, 1));
    const v = (base.getTime() - 1) / 1e3 + 0.0006;
    expect(f(0, v)).toBe("'26 01/01");
  });

  test('TestNewDataSet_YScaleUsesGraphHeight_WhenXStepZero', () => {
    const h = 10;
    const m = New(20, h, WithXYSteps(0, 2));
    expect(m.graphHeight()).toBe(h);
    expect(m.origin().y).toBe(h - 1);
    const want = m.graphHeight() / (m.viewMaxY() - m.viewMinY());
    expect(m['dSets'].get(DefaultDataSetName)!.tBuf.scale().y).toBe(want);
  });

  test('TestRescaleData_YScaleUsesGraphHeight_WhenXStepZero', () => {
    const h = 10;
    const m = New(20, h, WithXYSteps(0, 2), WithYRange(0, 10));
    m.setViewYRange(0, 5);
    const want = m.graphHeight() / (m.viewMaxY() - m.viewMinY());
    expect(m['dSets'].get(DefaultDataSetName)!.tBuf.scale().y).toBe(want);
  });

  test('TestPushPreservesMillisecondResolution', () => {
    const m = New(40, 10);
    const start = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
    const end = add(start, 20);
    m.setTimeRange(start, end);
    m.setViewTimeRange(start, end);
    m.push({ time: add(start, 1), value: 1 });
    m.push({ time: add(start, 2), value: 2 });
    const raw = m['dSets'].get(DefaultDataSetName)!.tBuf.readAllRaw();
    expect(raw.length).toBe(2);
    expect(Math.round(raw[1].x * 1e3) - Math.round(raw[0].x * 1e3)).toBe(1);
  });
});

describe('candle_width_test.go', () => {
  const all: DrawCandleOpts[] = [{ width: 1 }, { width: 5 }, { width: 5, block: true }];

  test('TestDrawCandleClipsTimesOutsideViewport', () => {
    const base = new Date(0);
    for (const opts of all) {
      const m = New(30, 10, WithTimeRange(base, add(base, 20e3)), WithYRange(0, 10));
      for (const seconds of [0, 20]) {
        for (const name of ['o', 'h', 'l', 'c']) m.pushDataSet(name, { time: add(base, seconds * 1e3), value: 5 });
      }
      m.setViewTimeRange(add(base, 5e3), add(base, 10e3));
      m.drawCandleWithOpts('o', 'h', 'l', 'c', newStyle(), newStyle(), opts);
      for (let y = 0; y < m.origin().y; y++) {
        for (let x = m.origin().x + 1; x < m.width(); x++) expect(runes.isNull(m.canvas.cell({ x, y }).rune)).toBe(true);
      }
      // The inclusive viewport endpoint must still draw after clipping.
      for (const name of ['o', 'h', 'l', 'c']) m.pushDataSet(name, { time: add(base, 10e3), value: 5 });
      m.drawCandleWithOpts('o', 'h', 'l', 'c', newStyle(), newStyle(), opts);
      let found = false;
      for (let y = 0; y < m.origin().y; y++) if (!runes.isNull(m.canvas.cell({ x: m.width() - 1, y }).rune)) found = true;
      expect(found).toBe(true);
    }
  });

  test('TestDrawCandleClipsValuesToProtectXAxis', () => {
    for (const opts of all) {
      const m = newCandleModel();
      m.setViewYRange(100, 108);
      m.clear();
      m.drawXYAxisAndLabel();
      const want: string[] = [];
      for (let y = m.origin().y; y < m.height(); y++) for (let x = 0; x < m.width(); x++) want.push(m.canvas.cell({ x, y }).rune);
      m.drawCandleWithOpts('open', 'high', 'low', 'close', newStyle(), newStyle(), opts);
      const got: string[] = [];
      for (let y = m.origin().y; y < m.height(); y++) for (let x = 0; x < m.width(); x++) got.push(m.canvas.cell({ x, y }).rune);
      expect(got).toEqual(want);
    }
  });

  test('TestDrawCandleDelegatesAtWidthOne', () => {
    const s = newStyle();
    const a = newCandleModel();
    a.drawCandle('open', 'high', 'low', 'close', s, s);
    const b = newCandleModel();
    b.drawCandleWithOpts('open', 'high', 'low', 'close', s, s, { width: 1 });
    expect(a.view()).toBe(b.view());
  });

  test('TestDrawCandleWithOptsPreservesAxisAndClampsNewest', () => {
    const s = newStyle();
    const m = newCandleModel();
    m.drawCandleWithOpts('open', 'high', 'low', 'close', s, s, { width: 7 });
    const lines = m.view().split('\n').map((l) => Array.from(l));
    const axisCol = m.origin().x;
    expect(lines.some((r) => r[axisCol] === '│')).toBe(true);
    const lastCol = m.canvas.width() - 1;
    const newestFound = lines.some((r) => r.slice(Math.max(0, lastCol - 3), Math.min(lastCol + 1, r.length)).some((c) => '┃╽╿│'.includes(c)));
    expect(newestFound).toBe(true);
  });

  test('TestDrawCandleWithOptsWidensBodies', () => {
    const s = newStyle();
    const countBodyCols = (view: string) => Array.from(view).filter((c) => c === '┃').length;
    const a = newCandleModel();
    a.drawCandleWithOpts('open', 'high', 'low', 'close', s, s, { width: 1 });
    const b = newCandleModel();
    b.drawCandleWithOpts('open', 'high', 'low', 'close', s, s, { width: 3 });
    expect(countBodyCols(b.view())).toBeGreaterThan(countBodyCols(a.view()));
  });

  const body = (c: string) => '┃╽╿█▄▀'.includes(c);

  test('TestDrawCandleInsetsEdgeBodies', () => {
    const s = newStyle();
    const m = newCandleModel();
    const w = 5;
    m.drawCandleWithOpts('open', 'high', 'low', 'close', s, s, { width: w });
    const minCol = m.origin().x + 1; // axis column + 1
    const lastCol = m.canvas.width() - 1;
    let fullLeft = false;
    let fullRight = false;
    for (const row of m.view().split('\n')) {
      const r = Array.from(row);
      if (r.length <= lastCol) continue;
      let leftRun = 0;
      let rightRun = 0;
      for (let x = minCol; x < minCol + w && x < r.length; x++) if (body(r[x])) leftRun++;
      for (let x = lastCol; x > lastCol - w && x >= 0; x--) if (body(r[x])) rightRun++;
      if (leftRun === w) fullLeft = true;
      if (rightRun === w) fullRight = true;
    }
    expect(fullLeft).toBe(true);
    expect(fullRight).toBe(true);
  });

  test('TestDrawCandleInsetsEdgeBodiesEvenWidth', () => {
    const s = newStyle();
    const m = newCandleModel();
    const w = 4;
    m.drawCandleWithOpts('open', 'high', 'low', 'close', s, s, { width: w });
    const minCol = m.origin().x + 1;
    let fullLeft = false;
    for (const row of m.view().split('\n')) {
      const r = Array.from(row);
      let leftRun = 0;
      for (let x = minCol; x < minCol + w && x < r.length; x++) if (body(r[x])) leftRun++;
      if (leftRun === w) fullLeft = true;
    }
    expect(fullLeft).toBe(true);
  });

  test('TestDrawCandleBlockStyle', () => {
    const s = newStyle();
    const a = newCandleModel();
    a.drawCandleWithOpts('open', 'high', 'low', 'close', s, s, { width: 3 });
    const b = newCandleModel();
    b.drawCandleWithOpts('open', 'high', 'low', 'close', s, s, { width: 3, block: true });
    expect(a.view().includes('█')).toBe(false);
    expect(b.view().includes('█')).toBe(true);
  });
});

describe('window_test.go', () => {
  test('TestFitYToViewSpikeLeavesWindow', () => {
    const base = new Date(Date.UTC(2026, 0, 1));
    const m = New(60, 15, WithTimeRange(base, add(base, 2 * 60e3)));
    m.push({ time: base, value: 3500 });
    m.push({ time: add(base, 60e3), value: 80 });
    m.pushDataSet('other', { time: add(base, 2 * 60e3), value: 100 });
    m.setViewTimeRange(add(base, 60e3), add(base, 2 * 60e3));
    expect(m.viewMaxY()).toBe(3500); // changing X does not fit Y
    expect(m.fitYToViewWithOpts({ includeZero: true })).toBe(true);
    expect([m.viewMinY(), m.viewMaxY()]).toEqual([0, 100]);
    expect([m.maxY(), m.autoMinY, m.autoMaxY]).toEqual([3500, true, true]);
    for (const name of [DefaultDataSetName, 'other']) {
      const ds = m['dSets'].get(name)!;
      ds.tBuf.readAllRaw().forEach((p, i) => expect(ds.tBuf.at(i)).toEqual(m.scaleFloat64PointForLine(p)));
    }
    // Fitting still works when automatic growth is disabled.
    m.autoMinY = false;
    m.autoMaxY = false;
    m.setViewTimeRange(base, add(base, 2 * 60e3));
    expect(m.fitYToView()).toBe(true);
    expect([m.viewMinY(), m.viewMaxY()]).toEqual([80, 3500]);
  });

  test('TestFitYToViewSelectionAndEmptyWindow', () => {
    const base = new Date(0);
    const m = New(40, 12, WithTimeRange(base, add(base, 10e3)));
    m.push({ time: base, value: -10 });
    m.push({ time: add(base, 1e3), value: 10 });
    m.pushDataSet('hidden', { time: base, value: 1000 });
    expect(m.fitYToViewWithOpts({ dataSets: [DefaultDataSetName, 'missing'] })).toBe(true);
    expect([m.viewMinY(), m.viewMaxY()]).toEqual([-10, 10]);
    expect(m.fitYToViewWithOpts({ dataSets: [] })).toBe(false);
    m.setViewTimeRange(add(base, 2e3), add(base, 10e3));
    expect(m.fitYToView()).toBe(false);
    expect([m.viewMinY(), m.viewMaxY()]).toEqual([-10, 10]);
  });

  describe('TestFitYToViewConstantAndInvalidValues', () => {
    for (const tc of [
      { name: 'linear', scale: linechart.ScaleLinear, value: 80, zero: false },
      { name: 'zero', scale: linechart.ScaleLinear, value: 0, zero: false },
      { name: 'zero baseline', scale: linechart.ScaleLinear, value: 0, zero: true },
      { name: 'negative baseline', scale: linechart.ScaleLinear, value: -80, zero: true },
      { name: 'log', scale: linechart.ScaleLog, value: 80, zero: true },
      { name: 'tiny log', scale: linechart.ScaleLog, value: Number.MIN_VALUE, zero: false },
      { name: 'large log', scale: linechart.ScaleLog, value: Number.MAX_VALUE, zero: false },
    ]) {
      test(tc.name, () => {
        const base = new Date(0);
        const m = New(40, 12, WithTimeRange(base, add(base, 1e3)), WithYScale(tc.scale));
        // Insert raw points to isolate fitting from push's automatic growth.
        const ds = m['dSets'].get(DefaultDataSetName)!;
        for (const v of [tc.value, NaN, Infinity, -Infinity]) ds.tBuf.push({ x: base.getTime() / 1e3, y: v });
        expect(m.fitYToViewWithOpts({ includeZero: tc.zero })).toBe(true);
        const lo = m.viewMinY();
        const hi = m.viewMaxY();
        expect(lo < hi && lo <= tc.value && hi >= tc.value && Number.isFinite(lo) && Number.isFinite(hi)).toBe(true);
        if (tc.scale === linechart.ScaleLog) expect(lo).toBeGreaterThan(0);
        if (tc.zero && tc.scale === linechart.ScaleLinear) expect(lo <= 0 && hi >= 0).toBe(true);
      });
    }
  });

  test('TestFitYToViewIgnoresNonPositiveLogValues', () => {
    const base = new Date(0);
    const m = New(40, 12, WithTimeRange(base, add(base, 1e3)), WithYScale(linechart.ScaleLog));
    m.push({ time: base, value: -10 });
    m.push({ time: base, value: 0 });
    const lo = m.viewMinY();
    const hi = m.viewMaxY();
    expect(m.fitYToView()).toBe(false);
    expect([m.viewMinY(), m.viewMaxY()]).toEqual([lo, hi]);
  });

  test('TestTrimBefore', () => {
    const base = new Date(0);
    const m = New(40, 12, WithTimeRange(base, add(base, 2e3)));
    for (const name of [DefaultDataSetName, 'other']) {
      for (let i = 0; i < 3; i++) m.pushDataSet(name, { time: add(base, i * 1e3), value: i });
    }
    m.setViewTimeRange(add(base, 1e3), add(base, 2e3));
    const view = [m.viewMinX(), m.viewMaxX(), m.viewMinY(), m.viewMaxY()];
    const old = m['dSets'].get(DefaultDataSetName)!.tBuf.readAllRaw();
    // base + 1s + 400µs: a Date holds milliseconds, as UnixMilli does
    expect(m.trimBefore(add(base, 1000.4))).toBe(2);
    for (const ds of m['dSets'].values()) {
      expect(ds.tBuf.length()).toBe(2);
      expect([ds.tBuf.atRaw(0).x, ds.tBuf.atRaw(0).y]).toEqual([1, 1]);
      ds.tBuf.readAllRaw().forEach((raw, i) => expect(ds.tBuf.at(i)).toEqual(ds.tBuf.scaleDatum(raw)));
    }
    // trim does not retain the discarded backing storage
    expect(m['dSets'].get(DefaultDataSetName)!.tBuf.readAllRaw()).not.toBe(old);
    expect([m.viewMinX(), m.viewMaxX(), m.viewMinY(), m.viewMaxY()]).toEqual(view);
    expect(m.trimBefore(base)).toBe(0);
    expect(m.trimBefore(add(base, 3e3))).toBe(4);
    expect(m.trimBefore(add(base, 3e3))).toBe(0);
    m.push({ time: add(base, 3e3), value: 5 });
    expect(m['dSets'].get(DefaultDataSetName)!.tBuf.length()).toBe(1);
  });
});

// Not upstream tests: WithZoneID/setZoneID are an addition.
describe('timeserieslinechart zone ID', () => {
  const zm = () => {
    let n = 0;
    return { newPrefix: () => `gen${++n}`, mark: (id: string, v: string) => `<${id}>${v}`, get: () => null };
  };

  test('WithZoneID sets a stable ID in either order and skips the generated prefix', () => {
    const a = tslcNs.New(10, 4, tslcNs.WithZoneID('chart'), tslcNs.WithZoneManager(zm()));
    const b = tslcNs.New(10, 4, tslcNs.WithZoneManager(zm()), tslcNs.WithZoneID('chart'));
    expect(a.zoneID()).toBe('chart');
    expect(b.zoneID()).toBe('chart');
    expect(a.view().startsWith('<chart>')).toBe(true);
  });

  test('an empty ID goes back to a generated prefix once there is a manager', () => {
    const m = tslcNs.New(10, 4, tslcNs.WithZoneManager(zm()), tslcNs.WithZoneID(''));
    expect(m.zoneID()).not.toBe(''); // a new prefix, as the manager would hand out
  });
});
