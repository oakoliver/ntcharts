// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.
//
// Port of spec/example_test.go: each Example's printed output is compared
// here. The examples' mentions of spec/echarts (the web surface) are not ported.
import { expect, test } from 'bun:test';
import { stripAnsi } from '@oakoliver/lipgloss';
import * as barchart from '../src/barchart/index.js';
import * as heatmap from '../src/heatmap/index.js';
import * as linechart from '../src/linechart/index.js';
import * as tslc from '../src/linechart/timeserieslinechart/index.js';
import * as sparkline from '../src/sparkline/index.js';
import * as spec from '../src/spec/index.js';
import { DAY, HOUR, addMs } from './spec-helpers.js';

const trimmed = (v: string): string =>
  v
    .split('\n')
    .map((l) => l.replace(/ +$/, ''))
    .join('\n');

// ExampleBuild_bar shows how to describe a bar chart and render it to a terminal via Build.
test('ExampleBuild_bar', () => {
  const s: spec.Spec = {
    type: spec.ChartTypeBar,
    title: 'Quarterly Revenue',
    width: 60,
    height: 20,
    x_axis: { type: spec.XAxisCategory, labels: ['Q1', 'Q2', 'Q3', 'Q4'] },
    data: { series: [{ name: 'Revenue', color: '#22aadd', values: [{ y: 120 }, { y: 180 }, { y: 95 }, { y: 210 }] }] },
    options: { show_legend: true, show_grid: true },
  };
  expect(spec.Build(s)).toBeInstanceOf(barchart.Model); // ready to view()
});

// ExampleBuild_line shows describing a numeric-X line chart.
test('ExampleBuild_line', () => {
  const s: spec.Spec = {
    type: spec.ChartTypeLine,
    title: 'Two Series',
    width: 40,
    height: 10,
    data: {
      series: [
        { name: 'a', values: [{ x: 0.0, y: 1 }, { x: 1.0, y: 3 }, { x: 2.0, y: 2 }, { x: 3.0, y: 5 }] },
        { name: 'b', values: [{ x: 0.0, y: 4 }, { x: 1.0, y: 2 }, { x: 2.0, y: 4 }, { x: 3.0, y: 1 }] },
      ],
    },
  };
  const m = spec.Build(s) as linechart.Model;
  expect(trimmed(m.view())).toBe(
    `5│                                   ⢀⠤⠊
 │⢄⡀                      ⣀⢄       ⡠⠒⠁
4│ ⠈⠑⠢⢄⡀              ⣀⠤⠒⠉  ⠉⠢⣀ ⣀⠔⠉
 │     ⠈⠑⠢⢄⣀⡠⠔⠊⠑⠒⠢⣤⣤⣒⠉       ⢀⠤⠛⠤⡀
2│     ⢀⡠⠔⠊⠉⠑⠢⢄⠤⠒⠉   ⠉⠉⠒⠢⠤⢄⡠⠒⠁   ⠈⠒⢄
 │ ⢀⡠⠔⠊⠁                            ⠉⠢⣀
1│⠊⠁                                   ⠑
 │
0└──────────────────────────────────────
 0       1           2           3`,
  );
});

// ExampleBuild_logScale shows a logarithmic Y axis.
test('ExampleBuild_logScale', () => {
  const s: spec.Spec = {
    type: spec.ChartTypeLine,
    title: 'Signups',
    width: 40,
    height: 10,
    y_axis: { scale: spec.ScaleLog },
    data: {
      series: [
        {
          name: 'signups',
          values: [
            { x: 0.0, y: 3 },
            { x: 1.0, y: 40 },
            { x: 2.0, y: 150 },
            { x: 3.0, y: 2500 },
            { x: 4.0, y: 30000 },
            { x: 5.0, y: 1e6 },
          ],
        },
      ],
    },
  };
  expect(trimmed(spec.Build(s).view())).toBe(
    ` 1M│                                ⢀⡠⠔⠊
   │                             ⣀⠤⠒⠁
   │                        ⣀⡠⠔⠒⠉
10k│                   ⣀⠤⠒⠊⠉
   │               ⣀⠤⠒⠉
100│      ⢀⣀⡠⠤⠤⠒⠒⠉⠉
   │  ⣀⠤⠔⠊⠁
   │⠒⠉
  1└────────────────────────────────────
   0   1       2       3     4       5`,
  );
});

// ExampleBuild_scatter: points are drawn directly onto a base linechart canvas.
test('ExampleBuild_scatter', () => {
  const s: spec.Spec = {
    type: spec.ChartTypeScatter,
    title: 'Fuel Efficiency',
    width: 40,
    height: 12,
    data: {
      series: [
        { name: 'japan', values: [{ x: 2100.0, y: 31.5 }, { x: 1980.0, y: 33.1 }] },
        { name: 'usa', values: [{ x: 2875.0, y: 24.0 }, { x: 3200.0, y: 19.2 }, { x: 3600.0, y: 16.5 }] },
      ],
    },
  };
  const m = spec.Build(s);
  expect(m).toBeInstanceOf(linechart.Model);
  expect(trimmed(m.view())).toBe(
    `33│•
  │   •
30│
  │
26│
  │                    •
23│
  │
20│                           •
  │                                    •
16└─────────────────────────────────────
  1980  2243  2505  2768  3031  3294`,
  );
});

// ExampleBuild_timeSeries shows describing a time-indexed line chart.
test('ExampleBuild_timeSeries', () => {
  const start = new Date(Date.UTC(2026, 0, 1));
  const s: spec.Spec = {
    type: spec.ChartTypeTimeSeries,
    title: 'Daily Active Users',
    width: 80,
    height: 24,
    x_axis: { type: spec.XAxisTime },
    data: { series: [{ name: 'DAU', values: Array.from({ length: 7 }, (_, i) => ({ x: addMs(start, i * DAY), y: 10 + i * 3 })) }] },
    options: { show_legend: true },
  };
  expect(spec.Build(s)).toBeInstanceOf(tslc.Model);
});

// ExampleBuild_sparkline: plain runes with no color styling.
test('ExampleBuild_sparkline', () => {
  const s: spec.Spec = {
    type: spec.ChartTypeSparkline,
    title: 'CPU Usage',
    width: 30,
    height: 4,
    data: { series: [{ name: 'cpu', values: [{ y: 1 }, { y: 4 }, { y: 2 }, { y: 7 }, { y: 5 }, { y: 9 }, { y: 3 }] }] },
  };
  const m = spec.Build(s);
  expect(m).toBeInstanceOf(sparkline.Model);
  expect(trimmed(m.view())).toBe(
    `                          ▁ █
                          █▂█
                        ▆ ███▃
                       ▄█▇████`,
  );
});

// ExampleBuild_heatmap shows a heatmap with a custom gradient color scale.
test('ExampleBuild_heatmap', () => {
  const s: spec.Spec = {
    type: spec.ChartTypeHeatmap,
    title: 'Correlation Matrix',
    width: 30,
    height: 10,
    heat: {
      cells: [
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 0, z: 5 },
        { x: 2, y: 0, z: 9 },
        { x: 0, y: 1, z: 3 },
        { x: 1, y: 1, z: 7 },
        { x: 2, y: 1, z: 2 },
      ],
    },
    theme: { gradient: ['#000044', '#ff4400'] },
  };
  const m = spec.Build(s);
  expect(m).toBeInstanceOf(heatmap.Model);
  expect(m.view().trim() !== '').toBe(true);
});

// ExampleBuild_ohlc: candles at time-scaled X positions with auto body width.
test('ExampleBuild_ohlc', () => {
  const s: spec.Spec = {
    type: spec.ChartTypeOHLC,
    title: 'Daily Close',
    width: 40,
    height: 12,
    data: {
      series: [
        {
          name: 'px',
          ohlc: [
            { t: '2026-01-05', o: 100, h: 108, l: 97, c: 105 },
            { t: '2026-01-06', o: 105, h: 112, l: 103, c: 110 },
            { t: '2026-01-07', o: 110, h: 111, l: 98, c: 99 },
            { t: '2026-01-08', o: 99, h: 106, l: 96, c: 104 },
          ],
        },
      ],
    },
  };
  const m = spec.Build(s);
  expect(m).toBeInstanceOf(tslc.Model);
  expect(m.view().trim() !== '').toBe(true);
});

// ExampleBuild_heatmapLabels: each block of blank cells is one coloured cell,
// and the first row label (Mon) is the top row.
test('ExampleBuild_heatmapLabels', () => {
  const days = ['Mon', 'Tue', 'Wed'];
  const hours = ['09', '12', '15', '18'];
  const cells: spec.HeatCell[] = [];
  days.forEach((_, y) => hours.forEach((_, x) => cells.push({ x, y, z: x + y * 4 })));
  const s: spec.Spec = {
    type: spec.ChartTypeHeatmap,
    width: 28,
    height: 9,
    x_axis: { labels: hours },
    y_axis: { labels: days },
    heat: { cells },
    theme: { gradient: ['#000044', '#ff4400'] },
  };
  const lines = stripAnsi(spec.Build(s).view())
    .split('\n')
    .map((l) => l.replace(/ +$/, '') + '|'); // | marks each row's end, so blank rows show
  expect(lines.join('\n')).toBe(`|
Mon|
|
Tue|
|
|
Wed|
    09    12    15    18|
|`);
});

// ExampleBuild_dualAxes shows a second, right-hand Y axis.
test('ExampleBuild_dualAxes', () => {
  const start = new Date(Date.UTC(2026, 0, 1));
  const load = [0.2, 0.5, 0.4, 0.9, 0.7, 0.3, 0.6];
  const temp = [8, 9, 12, 15, 19, 17, 14];
  const s: spec.Spec = {
    type: spec.ChartTypeTimeSeries,
    width: 60,
    height: 12,
    y_axis: { min: 0, max: 1 },
    // a second, right-hand Y axis with its own range; series choose it with y_axis: YAxisRight
    y2_axis: { min: 5, max: 20, title: 'Temperature' },
    data: {
      series: [
        { name: 'load', values: load.map((y, i) => ({ x: addMs(start, i * HOUR), y })) },
        { name: 'temp', y_axis: spec.YAxisRight, values: temp.map((y, i) => ({ x: addMs(start, i * HOUR), y })) },
      ],
    },
  };
  const m = spec.Build(s) as tslc.Model;
  const [axis] = m.y2Axis();
  expect(`left ${m.minY()}..${m.maxY()}, right ${axis.min}..${axis.max}`).toBe('left 0..1, right 5..20');
});
