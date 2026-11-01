import { newStyle, type Style } from '@oakoliver/lipgloss';
import type { Float64Point } from '../../src/canvas/canvas.js';
import * as runes from '../../src/canvas/runes/runes.js';
import { sprintfF, sprintV } from '../../src/internal/format.js';
import { fma } from '../../src/internal/gomath.js';
import * as linechart from '../../src/linechart/index.js';
import * as wavelinechart from '../../src/linechart/wavelinechart/index.js';
import { register } from './registry.js';

const wlcFg = (c: string): Style => newStyle().foreground(c);
const wlcKey = (k: string) => ({ _tag: 'KeyPressMsg', toString: () => k });
const wlcWheel = (button: number) => ({ _tag: 'MouseWheelMsg', x: 0, y: 0, button });
const wlcViews = (m: wavelinechart.Model) =>
  `\n${sprintV(m.viewMinX())} ${sprintV(m.viewMaxX())} ${sprintV(m.viewMinY())} ${sprintV(m.viewMaxY())}`;

// wlcTri returns n points of a triangle wave over x in [x0, x0+n*dx).
function wlcTri(n: number, x0: number, dx: number, amp: number): Float64Point[] {
  const r: Float64Point[] = [];
  for (let i = 0; i < n; i++) {
    let p = (i % 8) / 8;
    if (p > 0.5) p = 1 - p;
    // Go fuses x0 + i*dx; amp*(4*p-1) has no add after the outer multiply
    r.push({ x: fma(i, dx, x0), y: amp * fma(4, p, -1) });
  }
  return r;
}

// upstream examples/linechart/wavelines
register('wavelinechart/wavelines_styled', () => {
  const m = wavelinechart.New(
    40,
    14,
    wavelinechart.WithXYRange(0, 20, -10, 10),
    wavelinechart.WithAxesStyles(wlcFg('3'), wlcFg('6')),
    wavelinechart.WithStyles(runes.ArcLineStyle, wlcFg('4')),
    wavelinechart.WithDataSetStyles('b', runes.ThinLineStyle, wlcFg('9')),
    wavelinechart.WithPoints(wlcTri(21, 0, 1, 8)),
    wavelinechart.WithDataSetPoints('b', wlcTri(11, 0.5, 2, 5)),
  );
  m.drawAll();
  return m.view();
});

register('wavelinechart/sparse_points', () => {
  const m = wavelinechart.New(36, 10, wavelinechart.WithXRange(0, 100), wavelinechart.WithYRange(0, 50));
  for (const p of [
    { x: 5, y: 10 },
    { x: 30, y: 45 },
    { x: 31, y: 2 },
    { x: 70, y: 25 },
    { x: 99, y: 50 },
  ]) {
    m.plot(p);
  }
  m.draw();
  return m.view();
});

register('wavelinechart/draw_all_includes_default', () => {
  const m = wavelinechart.New(
    30,
    10,
    wavelinechart.WithXYRange(0, 10, -5, 5),
    wavelinechart.WithDataSetPoints('x', [
      { x: 2, y: 4 },
      { x: 6, y: -4 },
    ]),
  );
  m.drawAll();
  return m.view();
});

register('wavelinechart/auto_range', () => {
  const m = wavelinechart.New(36, 12);
  for (const p of wlcTri(16, -3, 1.5, 30)) m.plot(p);
  m.draw();
  return m.view() + `\n${sprintV(m.minX())} ${sprintV(m.maxX())} ${sprintV(m.minY())} ${sprintV(m.maxY())}`;
});

register('wavelinechart/xy_steps_formatters', () => {
  const m = wavelinechart.New(40, 12, wavelinechart.WithXYSteps(6, 2), wavelinechart.WithXYRange(0, 2, -1, 1), wavelinechart.WithPoints(wlcTri(17, 0, 0.125, 0.9)));
  m.xLabelFormatter = (_i, v) => sprintfF(v, 2) + 'π';
  m.yLabelFormatter = (_i, v) => {
    const s = sprintfF(v, 1); // Go's %+.1f
    return s[0] === '-' || s[0] === '+' ? s : '+' + s;
  };
  m.updateGraphSizes();
  m.draw();
  return m.view();
});

register('wavelinechart/no_axes', () => {
  const m = wavelinechart.New(30, 8, wavelinechart.WithXYSteps(0, 0), wavelinechart.WithXYRange(0, 10, -5, 5), wavelinechart.WithPoints(wlcTri(11, 0, 1, 4)));
  m.draw();
  return m.view();
});

register('wavelinechart/log_x', () => {
  const m = wavelinechart.New(40, 10, wavelinechart.WithXScale(linechart.ScaleLog), wavelinechart.WithXYRange(1, 1e4, 0, 10));
  for (const p of [
    { x: 1, y: 2 },
    { x: 5, y: 9 },
    { x: 30, y: 4 },
    { x: 200, y: 7 },
    { x: 0, y: 5 },
    { x: 1500, y: 1 },
    { x: 9000, y: 10 },
  ]) {
    m.plot(p);
  }
  m.draw();
  return m.view();
});

register('wavelinechart/log_y_styled', () => {
  const m = wavelinechart.New(
    40,
    12,
    wavelinechart.WithYScale(linechart.ScaleLog),
    wavelinechart.WithXYRange(0, 10, 1, 1e4),
    wavelinechart.WithStyles(runes.ThinLineStyle, wlcFg('2')),
    wavelinechart.WithAxesStyles(wlcFg('8'), wlcFg('7')),
  );
  [3, 50, 1, 700, 20, 9000, 0, 150, 4, 1e4].forEach((v, i) => m.plot({ x: i + 0.5, y: v }));
  m.draw();
  return m.view();
});

register('wavelinechart/y2_axis', () => {
  const m = wavelinechart.New(
    42,
    12,
    wavelinechart.WithXYRange(0, 10, 0, 10),
    wavelinechart.WithY2Axis({ min: -100, max: 100, labelStyle: wlcFg('1') }),
    wavelinechart.WithDataSetYAxis('r', linechart.YAxisRight),
    wavelinechart.WithDataSetStyles('r', runes.ThinLineStyle, wlcFg('1')),
    wavelinechart.WithPoints([
      { x: 1, y: 8 },
      { x: 4, y: 3 },
      { x: 8, y: 9 },
    ]),
    wavelinechart.WithDataSetPoints('r', [
      { x: 2, y: -80 },
      { x: 5, y: 60 },
      { x: 9, y: -20 },
    ]),
  );
  m.drawAll();
  return m.view();
});

register('wavelinechart/y2_log', () => {
  const m = wavelinechart.New(
    42,
    12,
    wavelinechart.WithXYRange(0, 10, 0, 10),
    wavelinechart.WithY2Axis({ min: 1, max: 1000, scale: linechart.ScaleLog, autoMax: true }),
    wavelinechart.WithDataSetYAxis('r', linechart.YAxisRight),
    wavelinechart.WithDataSetPoints('r', [
      { x: 1, y: 5 },
      { x: 3, y: 0 },
      { x: 5, y: 400 },
      { x: 7, y: 5000 },
      { x: 9, y: 20 },
    ]),
  );
  m.drawAll();
  return m.view();
});

register('wavelinechart/view_and_zoom', () => {
  const m = wavelinechart.New(40, 12, wavelinechart.WithXYRange(0, 20, -10, 10), wavelinechart.WithPoints(wlcTri(21, 0, 1, 9)));
  m.setViewXYRange(4, 16, -6, 6);
  m.draw();
  return m.view();
});

register('wavelinechart/keys', () => {
  let m = wavelinechart.New(40, 12, wavelinechart.WithXYRange(0, 20, -10, 10), wavelinechart.WithPoints(wlcTri(21, 0, 1, 9)));
  m.focus();
  for (const k of ['pgup', 'pgup', 'right', 'right', 'h', 'up']) [m] = m.update(wlcKey(k));
  m.draw();
  return m.view() + `\n${sprintV(m.viewMinX())} ${sprintV(m.viewMaxX())}`;
});

register('wavelinechart/wheel_xy_handler', () => {
  let m = wavelinechart.New(
    40,
    12,
    wavelinechart.WithXYRange(0, 20, -10, 10),
    wavelinechart.WithPoints(wlcTri(21, 0, 1, 9)),
    wavelinechart.WithUpdateHandler(linechart.XYAxesUpdateHandler(2, 1)),
  );
  m.focus();
  [m] = m.update(wlcWheel(4));
  [m] = m.update(wlcWheel(4));
  [m] = m.update(wlcKey('down'));
  m.draw();
  return m.view() + wlcViews(m);
});

register('wavelinechart/resize', () => {
  const m = wavelinechart.New(30, 10, wavelinechart.WithXYRange(0, 10, -5, 5), wavelinechart.WithPoints(wlcTri(11, 0, 1, 4)));
  m.draw();
  const before = m.view();
  m.resize(46, 14);
  m.draw();
  return before + '\n--\n' + m.view();
});

register('wavelinechart/clear_data', () => {
  const m = wavelinechart.New(
    30,
    9,
    wavelinechart.WithXYRange(0, 10, -5, 5),
    wavelinechart.WithPoints(wlcTri(11, 0, 1, 4)),
    wavelinechart.WithDataSetPoints('b', [{ x: 3, y: 3 }]),
  );
  m.clearDataSet('b');
  m.drawAll();
  const a = m.view();
  m.clearAllData();
  m.plot({ x: 5, y: 2 });
  m.drawAll();
  return a + '\n--\n' + m.view();
});

register('wavelinechart/set_scales_after_plot', () => {
  const m = wavelinechart.New(40, 12, wavelinechart.WithXYRange(1, 1000, 1, 1000));
  m.autoMinX = m.autoMaxX = m.autoMinY = m.autoMaxY = false;
  for (const v of [1, 4, 20, 90, 300, 1000]) m.plot({ x: v, y: v });
  m.setXScale(linechart.ScaleLog);
  m.setYScale(linechart.ScaleLog);
  m.draw();
  return m.view();
});
