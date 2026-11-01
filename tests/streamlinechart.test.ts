// Port of upstream linechart/streamlinechart/{golden,scale,y2}_test.go.
import * as slcNs from '../src/linechart/streamlinechart/index.js';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as runes from '../src/canvas/runes/runes.js';
import * as linechart from '../src/linechart/index.js';
import {
  type Model,
  New,
  type Option,
  WithDataSetStream,
  WithDataSetYAxis,
  WithStream,
  WithXYSteps,
  WithY2Axis,
  WithYRange,
  WithYScale,
} from '../src/linechart/streamlinechart/index.js';

function golden(name: string, got: string): void {
  const want = readFileSync(join(import.meta.dir, 'testdata', 'streamlinechart', name + '.golden'), 'utf8');
  expect(got).toBe(want);
}

const trimView = (view: string) =>
  view
    .split('\n')
    .map((l) => l.replace(/ +$/, ''))
    .join('\n');

const streamA = [1, 3, 2, 6, 5, 8, 7, 9, 4, 6, 2, 5];
const stream = [1, 1, 10, 10, 100, 100, 0, 0, 1000, 1000, 1e4, 1e4, 30, 30, -5, 300, 300, 3, 3];

describe('golden_test.go', () => {
  const cases: Record<string, () => Model> = {
    draw: () => {
      const m = New(30, 10, WithYRange(0, 10), WithStream(streamA));
      m.draw();
      return m;
    },
    drawall: () => {
      const m = New(30, 10, WithYRange(0, 10), WithStream(streamA), WithDataSetStream('b', [9, 8, 6, 7, 4, 3, 2]));
      m.drawAll();
      return m;
    },
    log: () => {
      const m = New(30, 9, WithYScale(linechart.ScaleLog), WithYRange(1, 1e4), WithStream(stream));
      m.draw();
      return m;
    },
    xy_steps: () => {
      const m = New(30, 10, WithXYSteps(2, 2), WithYRange(0, 10), WithStream(streamA));
      m.draw();
      return m;
    },
    view: () => {
      const m = New(30, 10, WithYRange(0, 10), WithStream(streamA));
      m.setViewYRange(2, 8);
      m.draw();
      return m;
    },
  };
  for (const [name, build] of Object.entries(cases)) {
    test(`TestGoldenOneAxis/${name}`, () => golden('oneaxis_' + name, build().view()));
  }
});

describe('scale_test.go', () => {
  // On a log Y axis each decade takes the same height, and values that are
  // not above zero break the line instead of dropping to the bottom.
  test('TestLogYAxis', () => {
    const m = New(30, 9, WithYScale(linechart.ScaleLog), WithYRange(1, 1e4), WithStream(stream));
    m.draw();
    const want = `
     │               │ │
 1000│             ──╯ │
     │                 │  ──╮
  100│         ╭─      │    │
     │         │       │    │
     │         │       ╰─   │
   10│       ╭─╯            │
     │       │              ╰─
    1│     ──╯
`.replace(/^\n+|\n+$/g, '');
    expect(trimView(m.view())).toBe(want);
    expect([m.yScale(), m.viewMinY(), m.viewMaxY()]).toEqual([linechart.ScaleLog, 1, 1e4]);
  });

  test('TestLogYAxisAutoRange', () => {
    const m = New(30, 9, WithYScale(linechart.ScaleLog));
    for (const v of [5, 0, -3, 5000]) m.push(v);
    // the default 0..1 range becomes 0.1..1, and only positive values widen it
    expect([m.minY(), m.maxY()]).toEqual([0.1, 5000]);
    m.draw(); // must not throw on the values it cannot place
  });

  // Data is kept in data units, so the scale can change after pushing.
  test('TestScaleCanChangeAfterPushing', () => {
    // a fixed range: auto-ranging would follow the non-positive values
    // while linear, and a log axis could not keep that range
    const push = (...opts: Option[]) => {
      const m = New(30, 9, ...opts, WithYRange(1, 1e4));
      m.autoMinY = false;
      m.autoMaxY = false;
      for (const v of stream) m.push(v);
      return m;
    };
    const linear = push();
    linear.draw();

    const explicit = push(WithYScale(linechart.ScaleLinear));
    explicit.draw();
    expect(explicit.view()).toBe(linear.view());

    const log = push(WithYScale(linechart.ScaleLog));
    log.draw();

    const m = push();
    m.setYScale(linechart.ScaleLog);
    m.draw();
    expect(m.view()).toBe(log.view());
    expect(log.view()).not.toBe(linear.view());
    m.setYScale(linechart.ScaleLinear);
    m.draw();
    expect(m.view()).toBe(linear.view());
  });
});

// newY2Model returns a chart with left Y 0..10, right Y 0..100 and the
// data set "r" on the right axis, then opts.
const newY2Model = (...opts: Option[]) =>
  New(30, 10, WithYRange(0, 10), WithY2Axis({ min: 0, max: 100 }), WithDataSetYAxis('r', linechart.YAxisRight), ...opts);

// stayLeft fails if anything but the right axis line is in its column.
function stayLeft(m: Model): void {
  const x = m.graphRight();
  for (let y = 0; y <= m.origin().y; y++) expect(m.canvas.cell({ x, y }).rune).toBe(runes.LineVertical);
}

describe('y2_test.go', () => {
  test('TestBuffersEndAtRightAxis', () => {
    const m = newY2Model();
    const want = m.graphRight() - m.origin().x;
    for (const ds of m['dSets'].values()) expect(ds.sBuf.size()).toBe(want);
  });

  test('TestRightPushAutoRangesRightAxisOnly', () => {
    const m = newY2Model(WithY2Axis({ min: 0, max: 100, autoMax: true }));
    m.pushDataSet('r', 500);
    expect([m.y2Axis()[0].max, m.maxY()]).toEqual([500, 10]);
  });

  test('TestTwoAxisLinesStayLeftOfRightAxis', () => {
    const m = newY2Model(WithStream(streamA));
    for (const v of [10, 90, 40, 100, 0, 70, 20, 80, 30, 60, 50, 100]) m.pushDataSet('r', v);
    m.drawAll();
    stayLeft(m);
  });

  test('TestLogRightAxisDraws', () => {
    const m = newY2Model(WithY2Axis({ min: 1, max: 1000, scale: linechart.ScaleLog }));
    for (const v of [10, 0, 100, 1000]) m.pushDataSet('r', v);
    m.drawAll();
    stayLeft(m);
  });

  test('TestGoldenTwoAxes', () => {
    const m = newY2Model(WithStream(streamA));
    for (const v of [95, 90, 80, 85, 60, 70, 40, 50, 20, 30, 5, 10]) m.pushDataSet('r', v);
    m.drawAll();
    golden('twoaxes', m.view());
  });
});

// Not upstream tests: WithZoneID/setZoneID are an addition.
describe('streamlinechart zone ID', () => {
  const zm = () => {
    let n = 0;
    return { newPrefix: () => `gen${++n}`, mark: (id: string, v: string) => `<${id}>${v}`, get: () => null };
  };

  test('WithZoneID sets a stable ID in either order and skips the generated prefix', () => {
    const a = slcNs.New(10, 4, slcNs.WithZoneID('chart'), slcNs.WithZoneManager(zm()));
    const b = slcNs.New(10, 4, slcNs.WithZoneManager(zm()), slcNs.WithZoneID('chart'));
    expect(a.zoneID()).toBe('chart');
    expect(b.zoneID()).toBe('chart');
    expect(a.view().startsWith('<chart>')).toBe(true);
  });

  test('an empty ID goes back to a generated prefix once there is a manager', () => {
    const m = slcNs.New(10, 4, slcNs.WithZoneManager(zm()), slcNs.WithZoneID(''));
    expect(m.zoneID()).not.toBe(''); // a new prefix, as the manager would hand out
  });
});
