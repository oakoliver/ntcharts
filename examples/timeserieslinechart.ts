/**
 * timeserieslinechart.ts: daily prices as lines, braille or candlesticks.
 * Port of upstream examples/linechart/timeseries.
 *
 *   bun examples/timeserieslinechart.ts
 *
 * Ninety days of generated prices. Move a day at a time with left/right or
 * a mouse drag, zoom with pgup/pgdown or the mouse wheel. c cycles lines,
 * braille and candles; f fits the Y axis to the visible days; q quits.
 */
import { NewProgram, NewView, Quit, MouseMode, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import { newStyle, normalBorder } from '@oakoliver/lipgloss';
import * as zone from '@oakoliver/bubblezone';
import { timeserieslinechart as tslc } from '../src/index.js';

const DAY = 24 * 3600 * 1000;
const boxStyle = newStyle().borderStyle(normalBorder()).borderForeground(63); // purple
const helpStyle = newStyle().foreground(241);
const bull = newStyle().foreground(10); // green
const bear = newStyle().foreground(9); // red
const modes = ['lines', 'braille', 'candles'] as const;

class TimeSeriesModel implements Model {
  chart: tslc.Model;
  mode = 0;

  constructor(public zm: zone.Manager) {
    const start = new Date(Date.UTC(2026, 0, 1));
    const end = new Date(start.getTime() + 89 * DAY);
    this.chart = tslc.New(
      72,
      16,
      tslc.WithTimeRange(start, end),
      tslc.WithYRange(60, 140),
      tslc.WithAxesStyles(newStyle().foreground(3), newStyle().foreground(6)),
      tslc.WithStyle(newStyle().foreground(4)),
      tslc.WithDataSetStyle('high', newStyle().foreground(8)),
      tslc.WithZoneManager(zm),
    );
    // a random walk of daily open, high, low and close prices
    let price = 100;
    for (let i = 0; i < 90; i++) {
      const time = new Date(start.getTime() + i * DAY);
      const open = price;
      const close = Math.max(65, Math.min(135, open + (Math.random() - 0.48) * 6));
      const high = Math.max(open, close) + Math.random() * 3;
      const low = Math.min(open, close) - Math.random() * 3;
      this.chart.push({ time, value: close }); // the default data set draws as a line
      this.chart.pushDataSet('open', { time, value: open });
      this.chart.pushDataSet('high', { time, value: high });
      this.chart.pushDataSet('low', { time, value: low });
      this.chart.pushDataSet('close', { time, value: close });
      price = close;
    }
    // show the last month; arrows and drag move by a day
    this.chart.setViewTimeRange(new Date(end.getTime() - 30 * DAY), end);
    this.chart.focus();
    this.draw();
  }

  draw(): void {
    switch (modes[this.mode]) {
      case 'lines':
        this.chart.drawDataSets([tslc.DefaultDataSetName, 'high']);
        break;
      case 'braille':
        this.chart.drawBraille();
        break;
      case 'candles':
        this.chart.drawCandleWithOpts('open', 'high', 'low', 'close', bull, bear, { width: 1, snapTimeBounds: true });
        break;
    }
  }

  init(): Cmd {
    return null;
  }

  update(msg: Msg): [Model, Cmd] {
    if (msg?._tag === 'KeyPressMsg') {
      switch (msg.toString()) {
        case 'q':
        case 'ctrl+c':
          return [this, Quit];
        case 'c':
          this.mode = (this.mode + 1) % modes.length;
          this.draw();
          return [this, null];
        case 'f':
          this.chart.fitYToViewWithOpts({ dataSets: ['low', 'high'] });
          this.draw();
          return [this, null];
      }
    }
    // DateUpdateHandler: left/right/drag move a day, pgup/pgdown/wheel zoom
    this.chart.update(msg);
    this.draw();
    return [this, null];
  }

  view(): View {
    const title = `daily prices (${modes[this.mode]})`;
    const help = 'c: lines/braille/candles · f: fit Y · left/right/drag: move · pgup/pgdown/wheel: zoom · q: quit';
    const v = NewView(this.zm.scan(boxStyle.render(title + '\n' + this.chart.view()) + '\n' + helpStyle.render(help)));
    v.altScreen = true;
    v.mouseMode = MouseMode.CellMotion;
    return v;
  }
}

await NewProgram(new TimeSeriesModel(zone.New())).run();
