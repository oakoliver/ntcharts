// Port of upstream linechart/wavelinechart/{golden,scale,y2,wavelinechart}_test.go.
import * as wlcNs from '../src/linechart/wavelinechart/index.js';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CanvasYCoordinate, type Float64Point } from '../src/canvas/canvas.js';
import * as runes from '../src/canvas/runes/runes.js';
import * as linechart from '../src/linechart/index.js';
import {
  DefaultDataSetName,
  type Model,
  New,
  type Option,
  WithDataSetPoints,
  WithDataSetYAxis,
  WithPoints,
  WithXRange,
  WithXScale,
  WithXYSteps,
  WithY2Axis,
  WithYRange,
  WithYScale,
} from '../src/linechart/wavelinechart/index.js';

function golden(name: string, got: string): void {
  const want = readFileSync(join(import.meta.dir, 'testdata', 'wavelinechart', name + '.golden'), 'utf8');
  expect(got).toBe(want);
}

const trimView = (view: string) =>
  view
    .split('\n')
    .map((l) => l.replace(/ +$/, ''))
    .join('\n');

const wantView = (got: string, want: string) => expect(trimView(got)).toBe(want.replace(/^\n+|\n+$/g, ''));

const wavePts: Float64Point[] = [
  { x: 1, y: 2 },
  { x: 3, y: -2 },
  { x: 5, y: 4 },
  { x: 7, y: -4 },
  { x: 9, y: 1 },
];
const wavePtsB: Float64Point[] = [
  { x: 2, y: -1 },
  { x: 6, y: 3 },
  { x: 10, y: 0 },
];

describe('golden_test.go', () => {
  const cases: Record<string, () => Model> = {
    draw: () => {
      const m = New(30, 12, WithXRange(0, 10), WithYRange(-5, 5), WithPoints(wavePts));
      m.draw();
      return m;
    },
    drawall: () => {
      const m = New(30, 12, WithXRange(0, 10), WithYRange(-5, 5), WithPoints(wavePts), WithDataSetPoints('b', wavePtsB));
      m.drawAll();
      return m;
    },
    log: () => {
      const m = New(34, 11, WithYScale(linechart.ScaleLog), WithXRange(0, 6), WithYRange(0.01, 1000));
      [0.02, 0.5, 0, 30, -4, 1000].forEach((v, i) => m.plot({ x: i + 1, y: v }));
      m.draw();
      return m;
    },
    view: () => {
      const m = New(30, 12, WithXRange(0, 10), WithYRange(-5, 5), WithPoints(wavePts));
      m.setViewXRange(2, 8);
      m.draw();
      return m;
    },
    no_x_axis: () => {
      const m = New(30, 12, WithXYSteps(0, 2), WithXRange(0, 10), WithYRange(-5, 5), WithPoints(wavePts));
      m.draw();
      return m;
    },
  };
  for (const [name, build] of Object.entries(cases)) {
    test(`TestGoldenOneAxis/${name}`, () => golden('oneaxis_' + name, build().view()));
  }
});

describe('scale_test.go', () => {
  test('TestLogYAxis', () => {
    const m = New(34, 11, WithYScale(linechart.ScaleLog), WithXRange(0, 6), WithYRange(0.01, 1000));
    [0.02, 0.5, 0, 30, -4, 1000].forEach((v, i) => m.plot({ x: i + 1, y: v }));
    m.draw();
    wantView(
      m.view(),
      `
1000│                            ╭
    │                            │
    │                            │
    │                  ╭╮        │
  10│                  ││        │
    │                  ││        │
    │         ╭╮       ││        │
   0│         ││       ││        │
    │    ╭╮   ││       ││        │
    └────┴┴───┴┴───────┴┴────────┴
    0   1   2     3   4   5     6
`,
    );
    expect([m.yScale(), m.xScale()]).toEqual([linechart.ScaleLog, linechart.ScaleLinear]);
    expect([m.viewMinY(), m.viewMaxY()]).toEqual([0.01, 1000]);
  });

  test('TestLogXYAxesAutoRange', () => {
    const m = New(34, 11, WithXScale(linechart.ScaleLog), WithYScale(linechart.ScaleLog));
    // the default 0..1 ranges cannot start at zero on a log axis
    expect([m.minX(), m.maxX(), m.minY(), m.maxY()]).toEqual([0.1, 1, 0.1, 1]);
    for (const p of [
      { x: 1, y: 1 },
      { x: 10, y: 100 },
      { x: 100, y: 10 },
      { x: 1000, y: 5000 },
      { x: 0, y: 9e9 },
      { x: 9e9, y: -1 }, // no place on the axes: ignored
    ]) {
      m.plot(p);
    }
    m.draw();
    expect([m.minX(), m.maxX(), m.minY(), m.maxY()]).toEqual([0.1, 1000, 0.1, 5000]);
    wantView(
      m.view(),
      `
    │                            ╭
1000│                            │
    │                            │
 100│              ╭╮            │
    │              ││            │
  10│              ││     ╭╮     │
    │              ││     ││     │
   1│      ╭╮      ││     ││     │
    │      ││      ││     ││     │
   0└──────┴┴──────┴┴─────┴┴─────┴
    0      1       10     100 1000
`,
    );
  });

  test('TestScaleCanChangeAfterPlotting', () => {
    const plot = (...opts: Option[]) => {
      const m = New(34, 11, ...opts, WithXRange(0, 6), WithYRange(0.01, 1000));
      // a fixed range: auto-ranging would follow the non-positive values
      // while linear, and a log axis could not keep that range
      m.autoMinY = false;
      m.autoMaxY = false;
      [0.02, 0.5, 0, 30, -4, 1000].forEach((v, i) => m.plot({ x: i + 1, y: v }));
      return m;
    };
    const linear = plot();
    linear.draw();

    const explicit = plot(WithXScale(linechart.ScaleLinear), WithYScale(linechart.ScaleLinear));
    explicit.draw();
    expect(explicit.view()).toBe(linear.view());

    const log = plot(WithYScale(linechart.ScaleLog));
    log.draw();

    const m = plot();
    m.setYScale(linechart.ScaleLog);
    m.draw();
    expect(m.view()).toBe(log.view());
    expect(log.view()).not.toBe(linear.view());
    m.setYScale(linechart.ScaleLinear);
    m.draw();
    expect(m.view()).toBe(linear.view());
  });
});

// newY2Model returns a chart with X 0..10, left Y 0..10, right Y -50..50
// and the data set "r" on the right axis, then opts.
const newY2Model = (...opts: Option[]) =>
  New(30, 12, WithXRange(0, 10), WithYRange(0, 10), WithY2Axis({ min: -50, max: 50 }), WithDataSetYAxis('r', linechart.YAxisRight), ...opts);

describe('y2_test.go', () => {
  test('TestRightBaselineIsRightZero', () => {
    const m = newY2Model();
    const seq: number[] = m['getLineSequence'](null, m['baseline']('r'));
    const want = CanvasYCoordinate(m.origin().y, Math.round(m.scaleFloat64Point({ x: 0, y: 5 }).y)); // right 0 is left 5
    expect(seq.length).toBe(m.graphRight() - m.origin().x);
    for (const y of seq) expect(y).toBe(want);
  });

  test('TestRightPlotAutoRangesRightAxisOnly', () => {
    const m = newY2Model(WithY2Axis({ min: -50, max: 50, autoMax: true }));
    m.plotDataSet('r', { x: 5, y: 80 });
    expect([m.y2Axis()[0].max, m.maxY()]).toEqual([80, 10]);
  });

  test('TestClearDataSetKeepsAssignment', () => {
    const m = newY2Model();
    m.plotDataSet('r', { x: 5, y: 10 });
    m.clearDataSet('r');
    expect(m['y2Sets']?.get('r')).toBe(true);
  });

  test('TestLogRightAxisSkipsNonPositive', () => {
    const m = newY2Model(WithY2Axis({ min: 1, max: 1000, scale: linechart.ScaleLog }));
    [10, 0, 100].forEach((v, i) => m.plotDataSet('r', { x: i + 1, y: v }));
    expect(m['graphPoints']('r', m['dSets'].get('r')!).length).toBe(2);
    m.drawAll();
  });

  test('TestTwoAxisLinesStayLeftOfRightAxis', () => {
    const m = newY2Model(WithPoints(wavePts));
    for (const p of [
      { x: 0, y: -50 },
      { x: 5, y: 50 },
      { x: 10, y: 40 },
    ]) {
      m.plotDataSet('r', p);
    }
    m.drawAll();
    const x = m.graphRight();
    for (let y = 0; y < m.origin().y; y++) expect(m.canvas.cell({ x, y }).rune).toBe(runes.LineVertical);
  });

  test('TestGoldenTwoAxes', () => {
    const m = newY2Model(
      WithPoints([
        { x: 1, y: 2 },
        { x: 3, y: 8 },
        { x: 5, y: 4 },
        { x: 7, y: 9 },
        { x: 9, y: 1 },
      ]),
    );
    for (const p of [
      { x: 2, y: -40 },
      { x: 4, y: 30 },
      { x: 6, y: -10 },
      { x: 8, y: 45 },
    ]) {
      m.plotDataSet('r', p);
    }
    m.drawAll();
    golden('twoaxes', m.view());
  });
});

describe('wavelinechart_test.go', () => {
  test('TestNewDataSet_YScaleUsesGraphHeight_WhenXStepZero', () => {
    const h = 10;
    const m = New(20, h, WithXYSteps(0, 2));
    expect(m.graphHeight()).toBe(h);
    expect(m.origin().y).toBe(h - 1);
    const want = m.graphHeight() / (m.viewMaxY() - m.viewMinY());
    expect(m['dSets'].get(DefaultDataSetName)!.pBuf.scale().y).toBe(want);
  });

  test('TestRescaleData_YScaleUsesGraphHeight_WhenXStepZero', () => {
    const h = 10;
    const m = New(20, h, WithXYSteps(0, 2), WithYRange(0, 10));
    // Trigger rescaleData by narrowing the view range.
    m.setViewYRange(0, 5);
    const want = m.graphHeight() / (m.viewMaxY() - m.viewMinY());
    expect(m['dSets'].get(DefaultDataSetName)!.pBuf.scale().y).toBe(want);
  });
});

// Not upstream tests: WithZoneID/setZoneID are an addition.
describe('wavelinechart zone ID', () => {
  const zm = () => {
    let n = 0;
    return { newPrefix: () => `gen${++n}`, mark: (id: string, v: string) => `<${id}>${v}`, get: () => null };
  };

  test('WithZoneID sets a stable ID in either order and skips the generated prefix', () => {
    const a = wlcNs.New(10, 4, wlcNs.WithZoneID('chart'), wlcNs.WithZoneManager(zm()));
    const b = wlcNs.New(10, 4, wlcNs.WithZoneManager(zm()), wlcNs.WithZoneID('chart'));
    expect(a.zoneID()).toBe('chart');
    expect(b.zoneID()).toBe('chart');
    expect(a.view().startsWith('<chart>')).toBe(true);
  });

  test('an empty ID goes back to a generated prefix once there is a manager', () => {
    const m = wlcNs.New(10, 4, wlcNs.WithZoneManager(zm()), wlcNs.WithZoneID(''));
    expect(m.zoneID()).not.toBe(''); // a new prefix, as the manager would hand out
  });
});
