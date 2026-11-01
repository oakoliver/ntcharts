import { newStyle, type Style } from '@oakoliver/lipgloss';
import * as runes from '../../src/canvas/runes/runes.js';
import { sprintfF, sprintV } from '../../src/internal/format.js';
import { fma } from '../../src/internal/gomath.js';
import * as linechart from '../../src/linechart/index.js';
import * as streamlinechart from '../../src/linechart/streamlinechart/index.js';
import { register } from './registry.js';

const slcFg = (c: string): Style => newStyle().foreground(c);
const slcKey = (k: string) => ({ _tag: 'KeyPressMsg', toString: () => k });
const slcWheel = (button: number) => ({ _tag: 'MouseWheelMsg', x: 0, y: 0, button });

// slcWave is a deterministic stand-in for upstream's random streaming example.
function slcWave(n: number, period: number, amp: number, offset: number): number[] {
  const r: number[] = [];
  for (let i = 0; i < n; i++) {
    // triangle wave: exact in float64, no transcendental functions
    let p = (i % Math.trunc(period)) / period;
    if (p > 0.5) p = 1 - p;
    r.push(fma(amp, fma(4, p, -1), offset)); // Go fuses offset + amp*(4*p-1)
  }
  return r;
}

// upstream examples/linechart/streaming
register('streamlinechart/streaming_styled', () => {
  const m = streamlinechart.New(
    40,
    12,
    streamlinechart.WithAxesStyles(slcFg('3'), slcFg('6')),
    streamlinechart.WithStyles(runes.ArcLineStyle, slcFg('4')),
    streamlinechart.WithYRange(-10, 10),
    streamlinechart.WithStream(slcWave(50, 12, 8, 0)),
  );
  m.draw();
  return m.view();
});

register('streamlinechart/thin_multi', () => {
  const m = streamlinechart.New(
    36,
    10,
    streamlinechart.WithYRange(0, 20),
    streamlinechart.WithStyles(runes.ThinLineStyle, slcFg('2')),
    streamlinechart.WithDataSetStyles('hi', runes.ArcLineStyle, slcFg('1')),
    streamlinechart.WithStream(slcWave(30, 10, 5, 6)),
    streamlinechart.WithDataSetStream('hi', slcWave(25, 8, 3, 15)),
  );
  m.drawAll();
  return m.view();
});

register('streamlinechart/draw_data_sets_order', () => {
  const m = streamlinechart.New(30, 9, streamlinechart.WithYRange(0, 10));
  m.setDataSetStyles('b', runes.ArcLineStyle, slcFg('5'));
  for (let i = 0; i < 20; i++) {
    m.pushDataSet('a', i % 10);
    m.pushDataSet('b', 9 - (i % 10));
  }
  m.drawDataSets(['b', 'a', 'missing']);
  return m.view();
});

register('streamlinechart/xy_steps', () => {
  const m = streamlinechart.New(
    34,
    12,
    streamlinechart.WithXYSteps(4, 3),
    streamlinechart.WithYRange(-5, 25),
    streamlinechart.WithStream(slcWave(40, 9, 12, 10)),
  );
  m.draw();
  return m.view();
});

register('streamlinechart/auto_range', () => {
  const m = streamlinechart.New(30, 10);
  for (const v of [3, 7, -4, 15, 9, 22, -8, 11, 5]) m.push(v);
  m.draw();
  return m.view() + `\n${sprintV(m.minY())} ${sprintV(m.maxY())}`;
});

register('streamlinechart/ring_wraps', () => {
  const m = streamlinechart.New(20, 8, streamlinechart.WithYRange(0, 30));
  for (let i = 0; i < 70; i++) m.push(i % 31);
  m.draw();
  return m.view();
});

register('streamlinechart/label_formatter', () => {
  const m = streamlinechart.New(36, 10, streamlinechart.WithYRange(0, 1));
  m.yLabelFormatter = (_i, v) => sprintfF(v * 100, 0) + '%';
  m.updateGraphSizes();
  for (const v of slcWave(40, 16, 0.4, 0.5)) m.push(v);
  m.draw();
  return m.view();
});

register('streamlinechart/log_scale', () => {
  const m = streamlinechart.New(
    40,
    10,
    streamlinechart.WithYScale(linechart.ScaleLog),
    streamlinechart.WithYRange(0.1, 1000),
    streamlinechart.WithStyles(runes.ArcLineStyle, slcFg('4')),
  );
  for (const v of [0.2, 0.5, 3, 8, 40, 0, 120, 600, 900, 300, -1, 50, 10, 2, 1, 0.4]) m.push(v);
  m.draw();
  return m.view();
});

register('streamlinechart/y2_axis', () => {
  const m = streamlinechart.New(
    40,
    12,
    streamlinechart.WithYRange(0, 10),
    streamlinechart.WithY2Axis({ min: 0, max: 1000, labelStyle: slcFg('1') }),
    streamlinechart.WithDataSetYAxis('rpm', linechart.YAxisRight),
    streamlinechart.WithDataSetStyles('rpm', runes.ThinLineStyle, slcFg('1')),
    streamlinechart.WithStream(slcWave(30, 10, 4, 5)),
    streamlinechart.WithDataSetStream('rpm', slcWave(30, 14, 400, 500)),
  );
  m.drawAll();
  return m.view();
});

register('streamlinechart/y2_log_auto', () => {
  const m = streamlinechart.New(
    40,
    12,
    streamlinechart.WithYRange(0, 100),
    streamlinechart.WithY2Axis({ min: 1, max: 100, scale: linechart.ScaleLog, autoMax: true }),
    streamlinechart.WithDataSetYAxis('r', linechart.YAxisRight),
  );
  for (const v of [2, 5, 30, 0, 200, 4000, 80, 9]) {
    m.pushDataSet('r', v);
    m.push(v / 50);
  }
  m.drawAll();
  const [a] = m.y2Axis();
  return m.view() + `\n${sprintV(a.min)} ${sprintV(a.max)}`;
});

register('streamlinechart/clear_y2', () => {
  const m = streamlinechart.New(
    36,
    10,
    streamlinechart.WithYRange(0, 10),
    streamlinechart.WithY2Axis({ min: 0, max: 100 }),
    streamlinechart.WithDataSetYAxis('r', linechart.YAxisRight),
    streamlinechart.WithDataSetStream('r', [10, 30, 80, 50, 90]),
  );
  m.clearY2Axis();
  m.drawAll();
  return m.view();
});

register('streamlinechart/keys_zoom_move', () => {
  let m = streamlinechart.New(36, 12, streamlinechart.WithYRange(0, 40), streamlinechart.WithStream(slcWave(40, 10, 15, 20)));
  m.focus();
  for (const k of ['pgup', 'pgup', 'up', 'k', 'left']) [m] = m.update(slcKey(k));
  m.draw();
  return m.view() + `\n${sprintV(m.viewMinY())} ${sprintV(m.viewMaxY())}`;
});

register('streamlinechart/wheel_zoom', () => {
  let m = streamlinechart.New(36, 10, streamlinechart.WithYRange(-20, 20), streamlinechart.WithStream(slcWave(36, 12, 18, 0)));
  m.focus();
  [m] = m.update(slcWheel(4));
  [m] = m.update(slcWheel(4));
  [m] = m.update(slcWheel(4));
  [m] = m.update(slcWheel(5));
  m.draw();
  return m.view();
});

register('streamlinechart/view_range', () => {
  const m = streamlinechart.New(36, 10, streamlinechart.WithYRange(0, 100), streamlinechart.WithStream(slcWave(40, 20, 45, 50)));
  m.setViewYRange(25, 75);
  m.draw();
  return m.view();
});

register('streamlinechart/set_view_xy_range', () => {
  const m = streamlinechart.New(
    36,
    10,
    streamlinechart.WithXYRange(0, 10, 0, 100),
    streamlinechart.WithXYSteps(2, 2),
    streamlinechart.WithStream(slcWave(40, 20, 45, 50)),
  );
  m.setViewXYRange(2, 8, 10, 60);
  m.draw();
  return m.view();
});

register('streamlinechart/resize', () => {
  const m = streamlinechart.New(24, 8, streamlinechart.WithYRange(0, 10), streamlinechart.WithStream(slcWave(30, 6, 4, 5)));
  m.draw();
  const before = m.view();
  m.resize(40, 12);
  m.draw();
  const mid = m.view();
  m.resize(16, 6);
  m.draw();
  return before + '\n--\n' + mid + '\n--\n' + m.view();
});

register('streamlinechart/clear_data', () => {
  const m = streamlinechart.New(
    30,
    8,
    streamlinechart.WithYRange(0, 10),
    streamlinechart.WithStream([1, 2, 3, 4, 5]),
    streamlinechart.WithDataSetStream('x', [9, 8, 7]),
  );
  m.clearDataSet('x');
  m.drawAll();
  const a = m.view();
  m.clearAllData();
  m.push(6);
  m.push(2);
  m.drawAll();
  return a + '\n--\n' + m.view();
});

register('streamlinechart/with_linechart', () => {
  const lc = linechart.New(
    30,
    10,
    0,
    1,
    -5,
    5,
    linechart.WithXYSteps(3, 3),
    linechart.WithStyles(slcFg('3'), slcFg('6'), slcFg('2')),
    linechart.WithUpdateHandler(linechart.YAxisNoZoomUpdateHandler(1)),
  );
  let m = streamlinechart.New(30, 10, streamlinechart.WithLineChart(lc), streamlinechart.WithStream(slcWave(30, 8, 4, 0)));
  m.focus();
  [m] = m.update(slcWheel(4));
  m.draw();
  return m.view();
});

register('streamlinechart/set_y_axis', () => {
  const m = streamlinechart.New(36, 10, streamlinechart.WithStream(slcWave(30, 10, 40, 50)));
  m.setYAxis({ min: 0, max: 100, viewMin: 10, viewMax: 90, labelFormatter: (_i, v) => sprintfF(v, 1) });
  m.draw();
  return m.view();
});
