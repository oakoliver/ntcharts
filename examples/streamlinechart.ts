/**
 * streamlinechart.ts: live data streaming from right to left.
 * Port of upstream examples/linechart/{streaming,throughput}.
 *
 *   bun examples/streamlinechart.ts
 *
 * Two data sets stream in on a timer: a signal on the left Y axis and its
 * load on a right Y axis. The chart fills the terminal width. Zoom along Y
 * with pgup/pgdown or the mouse wheel, move with up/down or a mouse drag.
 * space pauses, r clears, q quits.
 */
import { NewProgram, NewView, Quit, Tick, MouseMode, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import { newStyle, normalBorder } from '@oakoliver/lipgloss';
import * as zone from '@oakoliver/bubblezone';
import { linechart, runes, streamlinechart } from '../src/index.js';

const boxStyle = newStyle().borderStyle(normalBorder()).borderForeground(63); // purple
const helpStyle = newStyle().foreground(241);
const signalStyle = newStyle().foreground(4); // blue
const loadStyle = newStyle().foreground(10); // green
const LOAD = 'load';

const tick = (): Cmd => Tick(150, () => ({ type: 'tick' }));

class StreamModel implements Model {
  chart: streamlinechart.Model;
  t = 0;
  paused = false;

  constructor(public zm: zone.Manager) {
    this.chart = streamlinechart.New(
      60,
      14,
      streamlinechart.WithYRange(-50, 100),
      streamlinechart.WithAxesStyles(newStyle().foreground(3), newStyle().foreground(6)),
      streamlinechart.WithStyles(runes.ArcLineStyle, signalStyle),
      streamlinechart.WithY2Axis({ min: 0, max: 100, labelStyle: loadStyle, labelFormatter: (_i, v) => `${v.toFixed(0)}%` }),
      streamlinechart.WithDataSetYAxis(LOAD, linechart.YAxisRight),
      streamlinechart.WithDataSetStyles(LOAD, runes.ThinLineStyle, loadStyle),
      streamlinechart.WithZoneManager(zm),
    );
    this.chart.focus();
    this.chart.drawXYAxisAndLabel();
  }

  init(): Cmd {
    return tick();
  }

  update(msg: Msg): [Model, Cmd] {
    if (msg?.type === 'tick') {
      if (!this.paused) {
        this.t++;
        const signal = 25 + 60 * Math.sin(this.t / 7) * Math.cos(this.t / 23) + (Math.random() - 0.5) * 10;
        const load = 50 + 40 * Math.sin(this.t / 11) + (Math.random() - 0.5) * 6;
        this.chart.push(signal);
        this.chart.pushDataSet(LOAD, Math.max(0, Math.min(100, load)));
        this.chart.drawAll();
      }
      return [this, tick()];
    }
    switch (msg?._tag) {
      case 'WindowSizeMsg':
        this.chart.resize(Math.max(20, msg.width - 2), Math.max(8, msg.height - 5));
        this.chart.drawAll();
        return [this, null];
      case 'KeyPressMsg':
        switch (msg.toString()) {
          case 'q':
          case 'ctrl+c':
            return [this, Quit];
          case 'space':
            this.paused = !this.paused;
            return [this, null];
          case 'r':
            this.chart.clearAllData();
            this.chart.clear();
            this.chart.drawXYAxisAndLabel();
            return [this, null];
        }
    }
    // keys, wheel and drag zoom and move the Y axis
    this.chart.update(msg);
    this.chart.drawAll();
    return [this, null];
  }

  view(): View {
    const title = `signal (left) and load (right)${this.paused ? ' (paused)' : ''}  view ${this.chart.viewMinY().toFixed(1)}..${this.chart.viewMaxY().toFixed(1)}`;
    const help = 'space: pause · r: clear · pgup/pgdown/wheel: zoom · up/down/drag: move · q: quit';
    const v = NewView(this.zm.scan(boxStyle.render(title + '\n' + this.chart.view()) + '\n' + helpStyle.render(help)));
    v.altScreen = true;
    v.mouseMode = MouseMode.CellMotion;
    return v;
  }
}

await NewProgram(new StreamModel(zone.New())).run();
