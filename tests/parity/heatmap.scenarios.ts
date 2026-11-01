import { newStyle, type Color } from '@oakoliver/lipgloss';
import * as heatmap from '../../src/heatmap/index.js';
import * as linechart from '../../src/linechart/index.js';
import { register } from './registry.js';

// hmRamp returns n colours from blue to red through integer steps.
const hmRamp = (n: number): Color[] =>
  Array.from({ length: n }, (_, i) => {
    const r = Math.trunc((i * 255) / (n - 1));
    const hex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(40)}${hex(255 - r)}`;
  });

const hmDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hmHours = ['00', '03', '06', '09', '12', '15', '18', '21'];

// hmVisits is a deterministic day/time table: values 0..99 without trig.
const hmVisits = (d: number, h: number): number => (d * 31 + h * 17 + d * h * 7) % 100;

// hmGridPoints returns a cols x rows grid with value f(x, y), Y up.
function hmGridPoints(cols: number, rows: number, f: (x: number, y: number) => number): heatmap.HeatPoint[] {
  const pts: heatmap.HeatPoint[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) pts.push(heatmap.NewHeatPointInt(x, y, f(x, y)));
  return pts;
}

const hmDays2Labels = (): string[] => [...hmDays].reverse();

// hmWeek builds the upstream "labels" example: a day x time-of-day grid.
function hmWeek(w: number, h: number, labels: boolean, ...opts: heatmap.Option[]): heatmap.Model {
  const m = heatmap.New(w, h, heatmap.WithColorScale(hmRamp(24)), heatmap.WithValueRange(0, 100), heatmap.WithCellSize(1, 1), ...opts);
  if (labels) {
    m.setXLabels(hmHours);
    m.setYLabels(hmDays2Labels());
  } else {
    m.setXStep(0);
    m.setYStep(0);
    m.setXYRange(-0.5, hmHours.length - 0.5, -0.5, hmDays.length - 0.5);
    m.setViewXYRange(-0.5, hmHours.length - 0.5, -0.5, hmDays.length - 0.5);
  }
  hmDays.forEach((_, d) => {
    hmHours.forEach((_, hh) => m.push(heatmap.NewHeatPointInt(hh, hmDays.length - 1 - d, hmVisits(d, hh))));
  });
  m.draw();
  return m;
}

const key = (k: string) => ({ _tag: 'KeyPressMsg', toString: () => k });

register('heatmap/week-labels', () => hmWeek(48, 12, true).view());
register('heatmap/week-labels-styled', () => {
  const m = hmWeek(48, 12, true);
  m.labelStyle = newStyle().foreground('6').bold(true);
  m.canvas.clear();
  m.draw();
  return m.view();
});
register('heatmap/week-no-labels', () => hmWeek(48, 12, false).view());
register('heatmap/week-small-drops-labels', () => hmWeek(16, 5, true).view());
register('heatmap/week-large', () => hmWeek(96, 25, true).view());
register('heatmap/week-resize', () => {
  const m = hmWeek(48, 12, true);
  const out = m.view();
  m.resize(24, 9);
  m.canvas.clear();
  m.draw();
  return out + '\n--\n' + m.view();
});
register('heatmap/simple-radial', () => {
  const m = heatmap.New(20, 20, heatmap.WithValueRange(0, 1));
  m.setXYRange(-1, 1, -1, 1);
  for (let x = -1; x < 1.0; x += 1.0 / m.graphWidth()) {
    for (let y = -1; y < 1.0; y += 1.0 / m.graphHeight()) {
      m.push(heatmap.NewHeatPoint(x, y, Math.sqrt(x * x + y * y) / Math.SQRT2));
    }
  }
  m.draw();
  return m.view();
});
register('heatmap/single-cells-default-scale', () => {
  const m = heatmap.New(24, 8, heatmap.WithValueRange(0, 20));
  m.pushAll(hmGridPoints(6, 4, (x, y) => x + y * 6));
  m.draw();
  return m.view();
});
register('heatmap/single-cells-custom-scale', () => {
  const m = heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(8)), heatmap.WithValueRange(0, 29));
  m.pushAll(hmGridPoints(10, 3, (x, y) => x + y * 10));
  m.draw();
  return m.view();
});
register('heatmap/auto-value-range', () => {
  const m = heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(12)), heatmap.WithAutoValueRange());
  m.pushAll(hmGridPoints(8, 4, (x, y) => x * x - y * 3));
  m.draw();
  return m.view();
});
register('heatmap/fixed-value-range-clamps', () => {
  const m = heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(12)), heatmap.WithValueRange(10, 20));
  m.pushAll(hmGridPoints(8, 4, (x, y) => x * 3 + y * 2));
  m.draw();
  return m.view();
});
register('heatmap/set-value-range-after-push', () => {
  const m = heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(12)), heatmap.WithValueRange(0, 10));
  m.pushAll(hmGridPoints(8, 4, (x, y) => x + y * 8));
  m.draw();
  const out = m.view();
  m.setValueRange(0, 40);
  m.canvas.clear();
  m.draw();
  return out + '\n--\n' + m.view();
});
register('heatmap/matrix-rows', () => {
  const m = heatmap.New(26, 9, heatmap.WithColorScale(hmRamp(10)), heatmap.WithValueRange(0, 9));
  m.pushAllMatrixRow([
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [9, 8, 7, 6, 5],
    [4, 3, 2, 1, 0],
  ]);
  m.draw();
  return m.view();
});
register('heatmap/cell-size-wide', () => {
  const m = heatmap.New(40, 10, heatmap.WithColorScale(hmRamp(16)), heatmap.WithValueRange(0, 11), heatmap.WithCellSize(2, 1));
  m.setXYRange(-1, 7, -0.5, 2.5);
  m.setViewXYRange(-1, 7, -0.5, 2.5);
  m.pushAll(hmGridPoints(4, 3, (x, y) => x + y * 4));
  m.draw();
  return m.view();
});
register('heatmap/cell-size-fractional', () => {
  const m = heatmap.New(30, 8, heatmap.WithColorScale(hmRamp(16)), heatmap.WithValueRange(0, 8), heatmap.WithCellSize(0.5, 0.5));
  m.setXYRange(0, 4, 0, 4);
  m.setViewXYRange(0, 4, 0, 4);
  for (let i = 0; i < 8; i++) m.push(heatmap.NewHeatPoint(i / 2, i % 4, i));
  m.draw();
  return m.view();
});
register('heatmap/only-x-labels', () => {
  const m = heatmap.New(
    36,
    8,
    heatmap.WithColorScale(hmRamp(24)),
    heatmap.WithValueRange(0, 100),
    heatmap.WithCellSize(1, 1),
    heatmap.WithXLabels(['jan', 'feb', 'mar', 'apr', 'may', 'jun']),
  );
  m.setYRange(-0.5, 2.5);
  m.setViewYRange(-0.5, 2.5);
  m.pushAll(hmGridPoints(6, 3, (x, y) => hmVisits(y, x)));
  m.draw();
  return m.view();
});
register('heatmap/only-y-labels', () => {
  const m = heatmap.New(
    30,
    9,
    heatmap.WithColorScale(hmRamp(24)),
    heatmap.WithValueRange(0, 100),
    heatmap.WithCellSize(1, 1),
    heatmap.WithYLabels(['low', 'medium', 'high']),
  );
  m.setXRange(-0.5, 5.5);
  m.setViewXRange(-0.5, 5.5);
  m.pushAll(hmGridPoints(6, 3, (x, y) => hmVisits(y, x)));
  m.draw();
  return m.view();
});
register('heatmap/long-y-labels-margin', () => {
  const m = heatmap.New(
    40,
    10,
    heatmap.WithColorScale(hmRamp(24)),
    heatmap.WithValueRange(0, 100),
    heatmap.WithCellSize(1, 1),
    heatmap.WithXLabels(['a', 'b', 'c']),
    heatmap.WithYLabels(['x', 'a much longer row name', 'y']),
  );
  m.pushAll(hmGridPoints(3, 3, (x, y) => hmVisits(y, x)));
  m.draw();
  return m.view();
});
register('heatmap/dense-y-labels', () => {
  const labels: string[] = [];
  for (let i = 0; i < 30; i++) labels.push(String.fromCharCode(97 + (i % 26)) + String.fromCharCode(48 + Math.trunc(i / 26)));
  const m = heatmap.New(30, 8, heatmap.WithColorScale(hmRamp(24)), heatmap.WithValueRange(0, 100), heatmap.WithCellSize(1, 1), heatmap.WithYLabels(labels));
  m.setXRange(-0.5, 2.5);
  m.setViewXRange(-0.5, 2.5);
  m.pushAll(hmGridPoints(3, 30, (x, y) => (x * 13 + y * 7) % 100));
  m.draw();
  return m.view();
});
register('heatmap/zoom-view-range', () => {
  const m = hmWeek(48, 12, true);
  m.setViewXYRange(1.5, 5.5, 1.5, 4.5);
  m.canvas.clear();
  m.draw();
  return m.view();
});
register('heatmap/clear-data', () => {
  const m = hmWeek(48, 12, true);
  m.clearData();
  m.draw();
  const out = m.view();
  m.push(heatmap.NewHeatPointInt(2, 3, 80));
  m.draw();
  return out + '\n--\n' + m.view();
});
register('heatmap/axis-drawn-with-points', () => {
  const m = heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(12)), heatmap.WithValueRange(0, 20));
  m.setXYRange(0, 10, 0, 5);
  m.setViewXYRange(0, 10, 0, 5);
  m.drawXYAxisAndLabel();
  m.pushAll(hmGridPoints(10, 5, (x, y) => x + y * 2));
  m.draw();
  return m.view();
});
register('heatmap/auto-xy-range-single-cells', () => {
  const m = heatmap.New(30, 10, heatmap.WithColorScale(hmRamp(12)), heatmap.WithAutoValueRange());
  for (let i = -5; i <= 5; i++) m.push(heatmap.NewHeatPointInt(i, Math.trunc((i * i) / 3) - 4, i * i));
  m.drawXYAxisAndLabel();
  m.draw();
  return m.view();
});
register('heatmap/with-linechart-style', () => {
  const lm = linechart.New(28, 9, 0, 6, 0, 3, linechart.WithAutoXYRange(), linechart.WithStyles(newStyle().foreground('3'), newStyle().foreground('2'), newStyle()));
  const m = heatmap.New(28, 9, heatmap.WithStyle(lm), heatmap.WithColorScale(hmRamp(12)), heatmap.WithValueRange(0, 20));
  m.drawXYAxisAndLabel();
  m.pushAll(hmGridPoints(7, 4, (x, y) => x + y * 3));
  m.draw();
  return m.view();
});
register('heatmap/default-scale-swap', () => {
  const old = heatmap.SetDefaultColorScale(hmRamp(4));
  try {
    const m = heatmap.New(20, 6, heatmap.WithValueRange(0, 9));
    m.pushAll(hmGridPoints(5, 3, (x, y) => x + y * 5));
    m.draw();
    return m.view() + `\nscale=${m.colorScale.length}`;
  } finally {
    heatmap.SetDefaultColorScale(old);
  }
});
register('heatmap/empty-scale-draws-nothing', () => {
  const m = heatmap.New(20, 6, heatmap.WithColorScale([]), heatmap.WithValueRange(0, 9));
  m.pushAll(hmGridPoints(5, 3, (x, y) => x + y * 5));
  m.draw();
  return m.view();
});
register('heatmap/hit-labels-api', () => {
  const m = hmWeek(48, 12, true);
  return `${m.xLabels().join(',')}|${m.yLabels().join(',')}|${m.graphWidth()},${m.graphHeight()}|${m.origin().x},${m.origin().y}`;
});
register('heatmap/viewport-update', () => {
  const m = hmWeek(48, 12, true);
  m.canvas.viewWidth = 20;
  m.canvas.viewHeight = 6;
  m.canvas.focus();
  const out = m.view();
  for (const k of ['right', 'right', 'down', 'l']) m.update(key(k));
  return out + '\n--\n' + m.view();
});
