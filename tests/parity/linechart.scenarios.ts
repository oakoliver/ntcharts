import { newStyle, type Style } from '@oakoliver/lipgloss';
import type { Float64Point } from '../../src/canvas/canvas.js';
import * as runes from '../../src/canvas/runes/runes.js';
import { sprintfF, sprintV } from '../../src/internal/format.js';
import * as linechart from '../../src/linechart/index.js';
import { register } from './registry.js';

const lcFg = (c: string): Style => newStyle().foreground(c);

const lcAxis = lcFg('3');
const lcLabel = lcFg('6');
const lcLine = lcFg('4');
const lcRed = lcFg('9');
const lcGreen = lcFg('10');

const lcPt = (x: number, y: number): Float64Point => ({ x, y });

function lcPath(m: linechart.Model, ls: runes.LineStyle, s: Style, ...pts: Float64Point[]): void {
  for (let i = 1; i < pts.length; i++) m.drawLineWithStyle(pts[i - 1], pts[i], ls, s);
}

const lcZigzag = [lcPt(0, 2), lcPt(3, 9), lcPt(6, 4), lcPt(9, 13), lcPt(12, 1), lcPt(15, 11), lcPt(18, 7), lcPt(20, 15)];

const lcKey = (k: string) => ({ _tag: 'KeyPressMsg', toString: () => k });
const lcWheel = (button: number) => ({ _tag: 'MouseWheelMsg', x: 0, y: 0, button });
const WheelUp = 4;
const WheelDown = 5;
const WheelRight = 7;

const lcViews = (m: linechart.Model) => `\n${sprintV(m.viewMinX())} ${sprintV(m.viewMaxX())} ${sprintV(m.viewMinY())} ${sprintV(m.viewMaxY())}`;

// upstream examples/linechart/lines: arc and thin lines with styles
register('linechart/lines_styled', () => {
  const m = linechart.New(40, 14, 0, 20, 0, 16, linechart.WithXYSteps(3, 3), linechart.WithStyles(lcAxis, lcLabel, lcLine));
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, ...lcZigzag);
  lcPath(m, runes.ThinLineStyle, lcRed, lcPt(0, 14), lcPt(10, 3), lcPt(20, 9));
  return m.view();
});

register('linechart/thin_lines_overlap', () => {
  const m = linechart.New(32, 12, -10, 10, -10, 10);
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ThinLineStyle, lcGreen, lcPt(-10, -10), lcPt(10, 10));
  lcPath(m, runes.ThinLineStyle, lcRed, lcPt(-10, 10), lcPt(10, -10));
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(-10, 0), lcPt(10, 0));
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0, -10), lcPt(0, 10));
  return m.view();
});

// upstream examples/linechart/circles
register('linechart/circles', () => {
  const m = linechart.New(44, 18, -20, 20, -20, 20, linechart.WithXYSteps(4, 4), linechart.WithStyles(lcAxis, lcLabel, lcLine));
  m.drawXYAxisAndLabel();
  m.drawRuneCircle(lcPt(0, 0), 10, '*');
  m.drawRuneCircleWithStyle(lcPt(-8, 6), 5, 'o', lcRed);
  m.drawBrailleCircle(lcPt(8, -6), 7);
  m.drawBrailleCircleWithStyle(lcPt(12, 12), 4, lcGreen);
  return m.view();
});

// upstream examples/linechart/scatter
register('linechart/scatter', () => {
  const m = linechart.New(36, 14, 0, 100, 0, 100, linechart.WithXYSteps(4, 2), linechart.WithStyles(lcAxis, lcLabel, lcRed));
  m.drawXYAxisAndLabel();
  for (let i = 0; i < 40; i++) {
    const x = ((i * 37) % 100) + 0.5;
    const y = ((i * 61 + 13) % 100) * 0.97;
    m.drawRune(lcPt(x, y), i % 3 === 0 ? 'x' : '•');
  }
  return m.view();
});

register('linechart/braille_lines', () => {
  const m = linechart.New(40, 12, 0, 20, 0, 16, linechart.WithStyles(lcAxis, lcLabel, lcLine));
  m.drawXYAxisAndLabel();
  for (let i = 1; i < lcZigzag.length; i++) m.drawBrailleLine(lcZigzag[i - 1], lcZigzag[i]);
  m.drawBrailleLineWithStyle(lcPt(0, 16), lcPt(20, 0), lcRed);
  return m.view();
});

register('linechart/rune_lines', () => {
  const m = linechart.New(30, 10, 0, 10, 0, 10, linechart.WithMaxInterpolationPoints(100));
  m.drawXYAxisAndLabel();
  m.drawRuneLine(lcPt(0, 0), lcPt(10, 10), '#');
  m.drawRuneLineWithStyle(lcPt(0, 10), lcPt(10, 0), '+', lcGreen);
  return m.view();
});

register('linechart/label_formatters', () => {
  const m = linechart.New(
    44,
    12,
    0.5,
    3.25,
    -0.4,
    1.1,
    linechart.WithXYSteps(5, 2),
    linechart.WithXLabelFormatter((_i, v) => sprintfF(v, 2) + 's'),
    linechart.WithYLabelFormatter((_i, v) => sprintfF(v * 100, 1) + '%'),
    linechart.WithStyles(lcAxis, lcLabel, lcLine),
  );
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0.5, 0), lcPt(1.2, 1.1), lcPt(2.1, -0.4), lcPt(3.25, 0.7));
  return m.view();
});

// fractional ranges exercise Go's fused multiply-add in the label walk
register('linechart/fractional_labels', () => {
  const m = linechart.New(
    50,
    16,
    0.1,
    0.7,
    0.3,
    1.9,
    linechart.WithXYSteps(4, 1),
    linechart.WithXLabelFormatter((_i, v) => sprintfF(v, 3)),
    linechart.WithYLabelFormatter((_i, v) => sprintfF(v, 4)),
  );
  m.drawXYAxisAndLabel();
  return m.view();
});

register('linechart/default_labels_repeat', () => {
  const m = linechart.New(30, 14, 0, 3, 0, 2, linechart.WithXYSteps(1, 1));
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(1.5, 2), lcPt(3, 0.5));
  return m.view();
});

register('linechart/negative_ranges', () => {
  const m = linechart.New(36, 12, -100, -10, -50, -5, linechart.WithXYSteps(3, 2));
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(-100, -50), lcPt(-70, -5), lcPt(-40, -30), lcPt(-10, -12));
  m.drawRune(lcPt(-55, -20), 'o');
  return m.view();
});

register('linechart/no_axes', () => {
  const m = linechart.New(24, 8, 0, 10, 0, 10, linechart.WithXYSteps(0, 0));
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(5, 10), lcPt(10, 3));
  m.drawRune(lcPt(2, 8), '*');
  return m.view();
});

register('linechart/log_y_styled', () => {
  const m = linechart.New(40, 14, 0, 10, 1, 1e5, linechart.WithYScale(linechart.ScaleLog), linechart.WithStyles(lcAxis, lcLabel, lcLine));
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0, 1), lcPt(2, 30), lcPt(4, 7), lcPt(6, 900), lcPt(8, 2e4), lcPt(10, 1e5));
  return m.view();
});

register('linechart/log_xy', () => {
  const m = linechart.New(48, 14, 0.01, 1e4, 0.5, 5000, linechart.WithXScale(linechart.ScaleLog), linechart.WithYScale(linechart.ScaleLog));
  m.drawXYAxisAndLabel();
  for (const v of [0.01, 0.05, 0.3, 2, 15, 80, 600, 4000, 1e4]) m.drawRune(lcPt(v, v / 2 + 0.5), '*');
  m.drawBrailleLine(lcPt(0.01, 5000), lcPt(1e4, 0.5));
  return m.view();
});

register('linechart/log_minor_ticks', () => {
  const m = linechart.New(
    40,
    14,
    1,
    10,
    20,
    500,
    linechart.WithXScale(linechart.ScaleLog),
    linechart.WithYScale(linechart.ScaleLog),
    linechart.WithXLabelFormatter((_i, v) => sprintV(v)),
    linechart.WithYLabelFormatter((_i, v) => sprintV(v)),
  );
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ThinLineStyle, lcLine, lcPt(1, 20), lcPt(3, 300), lcPt(10, 45));
  return m.view();
});

register('linechart/log_narrow_even', () => {
  const m = linechart.New(
    36,
    10,
    30,
    40,
    30,
    40,
    linechart.WithXScale(linechart.ScaleLog),
    linechart.WithYScale(linechart.ScaleLog),
    linechart.WithXLabelFormatter((_i, v) => sprintfF(v, 1)),
    linechart.WithYLabelFormatter((_i, v) => sprintfF(v, 2)),
  );
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(30, 31), lcPt(35, 39), lcPt(40, 33));
  return m.view();
});

register('linechart/log_zoom_pan', () => {
  const m = linechart.New(40, 12, 1, 1e6, 1, 1e6, linechart.WithXScale(linechart.ScaleLog), linechart.WithYScale(linechart.ScaleLog));
  m.zoomIn(1, 0.5);
  m.moveRight(0.7);
  m.moveUp(0.3);
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(1, 1), lcPt(1e3, 1e5), lcPt(1e6, 30));
  return m.view() + lcViews(m);
});

register('linechart/y2_linear', () => {
  const red = lcFg('1');
  const m = linechart.New(44, 14, 0, 10, 0, 50, linechart.WithStyles(lcAxis, lcLabel, lcLine), linechart.WithY2Axis({ min: -200, max: 600, labelStyle: red }));
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0, 5), lcPt(3, 40), lcPt(6, 20), lcPt(10, 48));
  const r = [-150, 400, 100, 550, -50];
  for (let i = 1; i < r.length; i++) {
    m.drawLineWithStyle(lcPt((i - 1) * 2.5, m.y2ToY(r[i - 1])), lcPt(i * 2.5, m.y2ToY(r[i])), runes.ThinLineStyle, red);
  }
  return m.view();
});

register('linechart/y2_log_zoomed', () => {
  const m = linechart.New(46, 14, 0, 10, 0, 100, linechart.WithY2Axis({ min: 1, max: 1e5, scale: linechart.ScaleLog }));
  m.setViewYRange(20, 80);
  m.drawXYAxisAndLabel();
  for (const v of [3, 40, 900, 2e4]) m.drawRune(lcPt(v / 2e3, m.y2ToY(v)), 'o');
  m.drawBrailleLine(lcPt(0, 20), lcPt(10, 80));
  const [a] = m.y2Axis();
  return m.view() + `\n${sprintV(a.viewMin)} ${sprintV(a.viewMax)}`;
});

register('linechart/y2_set_axes', () => {
  const m = linechart.New(40, 12, 0, 10, 0, 1);
  m.setYAxis({
    min: 0,
    max: 1000,
    viewMin: 100,
    viewMax: 900,
    scale: linechart.ScaleLinear,
    labelStyle: lcLabel,
    labelFormatter: (_i, v) => sprintfF(v / 100, 0) + 'k',
  });
  m.setY2Axis({ min: 0, max: 1, labelFormatter: (_i, v) => sprintfF(v, 2) });
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(5, 1000), lcPt(10, 500));
  return m.view();
});

register('linechart/auto_range_draw', () => {
  const m = linechart.New(36, 12, 0, 1, 0, 1, linechart.WithAutoXYRange());
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(-4, 3), lcPt(2, 12), lcPt(9, -6));
  m.clear();
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(-4, 3), lcPt(2, 12), lcPt(9, -6));
  return m.view();
});

register('linechart/keys_zoom_move', () => {
  let m = linechart.New(40, 12, 0, 40, 0, 40);
  m.focus();
  for (const k of ['pgup', 'pgup', 'up', 'left', 'l', 'pgdown']) [m] = m.update(lcKey(k));
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(20, 40), lcPt(40, 10));
  return m.view() + lcViews(m);
});

register('linechart/wheel_x_handler', () => {
  let m = linechart.New(40, 10, 0, 100, 0, 10, linechart.WithUpdateHandler(linechart.XAxisUpdateHandler(10)));
  m.focus();
  [m] = m.update(lcWheel(WheelUp));
  [m] = m.update(lcWheel(WheelUp));
  [m] = m.update(lcKey('right'));
  [m] = m.update(lcKey('up')); // ignored: X only
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(50, 10), lcPt(100, 2));
  return m.view();
});

register('linechart/nozoom_handlers', () => {
  let m = linechart.New(40, 10, 0, 100, 0, 100, linechart.WithUpdateHandler(linechart.XAxisNoZoomUpdateHandler(5)));
  m.setViewXYRange(20, 60, 10, 50);
  m.focus();
  [m] = m.update(lcWheel(WheelDown));
  [m] = m.update(lcWheel(WheelRight));
  [m] = m.update(lcKey('pgup')); // ignored: no zoom
  m.updateHandler = linechart.YAxisNoZoomUpdateHandler(7);
  [m] = m.update(lcWheel(WheelUp));
  [m] = m.update(lcKey('down'));
  [m] = m.update(lcKey('down'));
  m.updateHandler = linechart.YAxisUpdateHandler(4);
  [m] = m.update(lcWheel(WheelUp));
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ThinLineStyle, lcLine, lcPt(0, 0), lcPt(100, 100));
  return m.view() + lcViews(m);
});

register('linechart/blurred_ignores_update', () => {
  let m = linechart.New(30, 8, 0, 10, 0, 10);
  [m] = m.update(lcKey('pgup'));
  m.drawXYAxisAndLabel();
  return m.view();
});

register('linechart/resize', () => {
  const m = linechart.New(30, 10, 0, 10, 0, 100);
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(10, 100));
  const before = m.view();
  m.resize(44, 14);
  m.clear();
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(0, 0), lcPt(10, 100));
  return before + '\n--\n' + m.view();
});

register('linechart/set_steps_and_ranges', () => {
  const m = linechart.New(40, 12, 0, 10, 0, 10);
  m.setXStep(6);
  m.setYStep(4);
  m.setXYRange(-50, 50, -1000, 1000);
  m.setViewXYRange(-20, 40, -500, 800);
  m.drawXYAxisAndLabel();
  lcPath(m, runes.ArcLineStyle, lcLine, lcPt(-50, -1000), lcPt(0, 900), lcPt(50, 0));
  return m.view();
});

// labels printed with their shortest float representation expose the
// last bit of each label value, where Go's fused multiply-add rounds once
register('linechart/fma_label_values', () => {
  const m = linechart.New(
    120,
    14,
    0.1,
    0.7,
    0.3,
    1.9,
    linechart.WithXYSteps(20, 1),
    linechart.WithXLabelFormatter((_i, v) => sprintV(v)),
    linechart.WithYLabelFormatter((_i, v) => sprintV(v)),
    linechart.WithY2Axis({ min: 0.7, max: 2.3, labelFormatter: (_i, v) => sprintV(v) }),
  );
  m.setViewYRange(0.35, 1.7);
  m.drawXYAxisAndLabel();
  const [a] = m.y2Axis();
  return m.view() + `\n${sprintV(a.viewMin)} ${sprintV(a.viewMax)} ${sprintV(m.y2ToY(1.3))}`;
});
