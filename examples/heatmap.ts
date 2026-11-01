/**
 * heatmap.ts: two heatmaps. Ports upstream examples/heatmap/{labels,simple}.
 *
 *   bun examples/heatmap.ts
 *
 * "week" is a grid of filled cells with row and column names (visits by day
 * and time of day); "radial" plots single-cell points on a numeric plane.
 * Keys: tab switches heatmap · l toggles the labels · +/- resizes the chart
 * (labels drop out when the cells get too small to name) · q quits.
 */
import { NewProgram, NewView, Quit, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import type { Color } from '@oakoliver/lipgloss';
import { heatmap } from '../src/index.js';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hours = ['00', '03', '06', '09', '12', '15', '18', '21'];
const [minW, maxW, stepW] = [16, 96, 8];
const [minH, maxH, stepH] = [5, 25, 2];

// visits returns the value of the cell for day d and time-of-day bucket h:
// a workday peak around midday and an evening peak at the weekend.
function visits(d: number, h: number): number {
  const weekend = d >= 5;
  const peak = weekend ? 6 : 4; // bucket of the busiest time
  const scale = weekend ? 70 : 100;
  // a little day-to-day and hour-to-hour variation, so rows differ
  const wobble = 0.82 + 0.18 * Math.sin(d * 5 + h * 2);
  return scale * wobble * Math.exp(-Math.pow(h - peak, 2) / 4.5);
}

// colorScale is a ramp from deep blue through green to yellow.
function colorScale(): Color[] {
  const stops = [[12, 20, 90], [20, 130, 140], [120, 200, 90], [250, 235, 90]];
  const scale: Color[] = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 23) * (stops.length - 1);
    const lo = Math.min(Math.trunc(t), stops.length - 2);
    const f = t - lo;
    const c = [0, 1, 2].map((k) => Math.trunc(stops[lo][k] + (stops[lo + 1][k] - stops[lo][k]) * f));
    scale.push('#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''));
  }
  return scale;
}

// week builds the heatmap as an index grid: column x and row y are whole
// numbers and each is drawn as a block (WithCellSize). The model counts rows
// up from the bottom, so to read Mon at the top the rows, and their labels,
// are mirrored.
function week(w: number, h: number, labels: boolean): heatmap.Model {
  const hm = heatmap.New(w, h, heatmap.WithColorScale(colorScale()), heatmap.WithValueRange(0, 100), heatmap.WithCellSize(1, 1));
  if (labels) {
    hm.setXLabels(hours);
    hm.setYLabels([...days].reverse());
  } else {
    // no labels: reserve no margin or label rows, and fix the grid range
    hm.setXStep(0);
    hm.setYStep(0);
    hm.setXYRange(-0.5, hours.length - 0.5, -0.5, days.length - 0.5);
    hm.setViewXYRange(-0.5, hours.length - 0.5, -0.5, days.length - 0.5);
  }
  days.forEach((_, d) => hours.forEach((_, h) => hm.push(heatmap.NewHeatPointInt(h, days.length - 1 - d, visits(d, h)))));
  hm.draw();
  return hm;
}

// radial plots sin(distance from the centre) as single-cell points.
function radial(w: number, h: number): heatmap.Model {
  const hm = heatmap.New(w, h, heatmap.WithValueRange(0, 1));
  hm.setXYRange(-1, 1, -1, 1);
  for (let x = -1; x < 1.0; x += 1.0 / hm.graphWidth()) {
    for (let y = -1; y < 1.0; y += 1.0 / hm.graphHeight()) hm.push(heatmap.NewHeatPoint(x, y, Math.sin(Math.sqrt(x * x + y * y))));
  }
  hm.draw();
  return hm;
}

class HeatModel implements Model {
  page: 'week' | 'radial' = 'week';
  constructor(public w = 48, public h = 12, public labels = true) {}

  init(): Cmd {
    return null;
  }

  update(msg: Msg): [Model, Cmd] {
    if (msg?._tag !== 'KeyPressMsg') return [this, null];
    switch (msg.toString()) {
      case 'q':
      case 'ctrl+c':
        return [this, Quit];
      case 'tab':
        this.page = this.page === 'week' ? 'radial' : 'week';
        break;
      case 'l':
        this.labels = !this.labels;
        break;
      case '+':
      case '=':
        this.w = Math.min(this.w + stepW, maxW);
        this.h = Math.min(this.h + stepH, maxH);
        break;
      case '-':
      case '_':
        this.w = Math.max(this.w - stepW, minW);
        this.h = Math.max(this.h - stepH, minH);
        break;
    }
    return [this, null];
  }

  view(): View {
    const hm = this.page === 'week' ? week(this.w, this.h, this.labels) : radial(this.w > 40 ? 40 : this.w, this.h * 2 > 40 ? 40 : this.h * 2);
    let s = this.page === 'week' ? `Visits by day and time   labels: ${this.labels ? 'on' : 'off'}   size: ${this.w}x${this.h}\n` : 'sin(distance from the centre)\n';
    s += '(tab: switch heatmap, l: toggle labels, +/-: resize, q: quit)\n\n';
    s += hm.view();
    const v = NewView(s);
    v.altScreen = true;
    return v;
  }
}

await NewProgram(new HeatModel()).run();
