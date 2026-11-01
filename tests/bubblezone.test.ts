// Mouse support with the real @oakoliver/bubblezone: the chart marks its view,
// the manager scans the root view, and clicks and drags reach the chart.
import { expect, test } from 'bun:test';
import * as zone from '@oakoliver/bubblezone';
import * as canvas from '../src/canvas/index.js';
import * as tslc from '../src/linechart/timeserieslinechart/index.js';

const click = (x: number, y: number) => ({ _tag: 'MouseClickMsg', x, y, button: 1, mod: 0 });
const drag = (x: number, y: number) => ({ _tag: 'MouseMotionMsg', x, y, button: 1, mod: 0 });

test('a bubblezone Manager is a canvas ZoneManager', () => {
  const zm: canvas.ZoneManager = zone.New();
  const c = canvas.New(4, 2, canvas.WithZoneManager(zm));
  expect(c.zoneID()).not.toBe('');
});

test('dragging inside a scanned canvas moves its viewport', () => {
  const zm = zone.New();
  const c = canvas.New(40, 20, canvas.WithZoneManager(zm), canvas.WithViewWidth(10), canvas.WithViewHeight(5), canvas.WithFocus());
  // the canvas sits below a one-line header in the root view
  const root = 'header\n' + c.view();
  expect(zm.scan(root)).not.toContain('\x1b[');
  c.update(click(3, 3));
  c.update(drag(4, 4)); // right and down
  expect(c.cursor()).toEqual({ x: 1, y: 1 });
  c.update(drag(10, 30)); // outside the zone: ignored
  expect(c.cursor()).toEqual({ x: 1, y: 1 });
});

test('dragging a time series chart moves its time window', () => {
  const zm = zone.New();
  const day = 86_400_000;
  const start = Date.UTC(2026, 0, 1);
  const chart = tslc.New(40, 10, tslc.WithZoneManager(zm));
  for (let i = 0; i < 30; i++) chart.push({ time: new Date(start + i * day), value: i });
  chart.setViewTimeRange(new Date(start + 10 * day), new Date(start + 20 * day));
  chart.focus();
  chart.drawBraille();
  zm.scan(chart.view());
  const before = chart.viewMinX();
  chart.update(click(20, 5));
  chart.update(drag(15, 5)); // drag left: the window moves to earlier dates, as upstream
  expect(chart.viewMinX()).toBeLessThan(before);
});

test('a fixed zone ID is the same in every manager and program', () => {
  const ids = [zone.New(), zone.New()].map((zm) => {
    const c = canvas.New(4, 2, canvas.WithZoneManager(zm), canvas.WithZoneID('station/map'));
    return c.zoneID();
  });
  expect(ids).toEqual(['station/map', 'station/map']);
  // generated prefixes keep coming from the global counter
  const g1 = canvas.New(4, 2, canvas.WithZoneManager(zone.New())).zoneID();
  const g2 = canvas.New(4, 2, canvas.WithZoneManager(zone.New())).zoneID();
  expect(g1).not.toBe(g2);
});

test('clicks reach a chart that has a fixed zone ID', () => {
  const zm = zone.New();
  const c = canvas.New(40, 20, canvas.WithZoneManager(zm), canvas.WithZoneID('fixed'), canvas.WithViewWidth(10), canvas.WithViewHeight(5), canvas.WithFocus());
  zm.scan('header\n' + c.view());
  expect(zm.get('fixed')).toBeTruthy();
  c.update(click(3, 3));
  c.update(drag(4, 4));
  expect(c.cursor()).toEqual({ x: 1, y: 1 });
});
