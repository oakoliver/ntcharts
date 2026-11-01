/**
 * quickstart.ts: a time series chart with two data sets, zoomed and moved
 * with the keyboard and the mouse. Port of upstream examples/quickstart.
 *
 *   bun examples/quickstart.ts
 *
 * Keys: pgup/pgdown or the mouse wheel zoom · ←/→ (or a mouse drag) move ·
 * q quits.
 */
import { NewProgram, NewView, Quit, MouseMode, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import { newStyle, normalBorder } from '@oakoliver/lipgloss';
import * as zone from '@oakoliver/bubblezone';
import { timeserieslinechart as tslc } from '../src/index.js';

class Quickstart implements Model {
  constructor(public chart: tslc.Model, public zm: zone.Manager) {}

  init(): Cmd {
    return null;
  }

  update(msg: Msg): [Model, Cmd] {
    if (msg?._tag === 'KeyPressMsg' && ['q', 'ctrl+c'].includes(msg.toString())) return [this, Quit];
    // forward the message to the chart, then draw all data sets with braille runes
    this.chart.update(msg);
    this.chart.drawBrailleAll();
    return [this, null];
  }

  view(): View {
    // call the zone manager's scan() at the root model
    const v = NewView(this.zm.scan(newStyle().borderStyle(normalBorder()).borderForeground(63).render(this.chart.view())));
    v.altScreen = true;
    v.mouseMode = MouseMode.CellMotion;
    return v;
  }
}

// a time series chart, 30 columns by 12 rows
const chart = tslc.New(30, 12);

// the default data set: one value a day
const day = 24 * 60 * 60 * 1000;
const start = Date.now();
[0, 2, 4, 6, 8, 10, 8, 6, 4, 2, 0].forEach((v, i) => chart.push({ time: new Date(start + i * day), value: v }));
chart.setStyle(newStyle().foreground(9)); // red

// a second data set, by name
[10, 8, 6, 4, 2, 0, 2, 4, 6, 8, 10].forEach((v, i) => chart.pushDataSet('dataSet2', { time: new Date(start + i * day), value: v }));
chart.setDataSetStyle('dataSet2', newStyle().foreground(10)); // green

// the default update handler zooms with the mouse wheel and pgup/pgdown, and
// moves the chart left and right with the arrow keys or by dragging
const zm = zone.New();
chart.setZoneManager(zm);
chart.focus(); // only a focused chart handles keyboard and mouse messages
chart.drawBrailleAll();

await NewProgram(new Quickstart(chart, zm)).run();
