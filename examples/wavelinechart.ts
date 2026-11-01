/**
 * wavelinechart.ts: sine and cosine waves, one value per column.
 * Port of upstream examples/linechart/wavelines.
 *
 *   bun examples/wavelinechart.ts
 *
 * Zoom along X with pgup/pgdown or the mouse wheel, move with left/right or
 * a mouse drag. s switches arc and thin line runes, q quits.
 */
import { NewProgram, NewView, Quit, MouseMode, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import { newStyle, normalBorder } from '@oakoliver/lipgloss';
import * as zone from '@oakoliver/bubblezone';
import { runes, wavelinechart } from '../src/index.js';

const boxStyle = newStyle().borderStyle(normalBorder()).borderForeground(63); // purple
const helpStyle = newStyle().foreground(241);
const sinStyle = newStyle().foreground(4); // blue
const cosStyle = newStyle().foreground(10); // green
const COS = 'cos';

class WaveModel implements Model {
  chart: wavelinechart.Model;
  thin = false;

  constructor(public zm: zone.Manager) {
    this.chart = wavelinechart.New(
      70,
      16,
      wavelinechart.WithXYRange(0, 4 * Math.PI, -1.2, 1.2),
      wavelinechart.WithXYSteps(4, 2),
      wavelinechart.WithAxesStyles(newStyle().foreground(3), newStyle().foreground(6)),
      wavelinechart.WithStyles(runes.ArcLineStyle, sinStyle),
      wavelinechart.WithDataSetStyles(COS, runes.ArcLineStyle, cosStyle),
      wavelinechart.WithZoneManager(zm),
    );
    this.chart.xLabelFormatter = (_i, v) => `${(v / Math.PI).toFixed(1)}π`;
    this.chart.yLabelFormatter = (_i, v) => v.toFixed(1);
    this.chart.updateGraphSizes();
    for (let i = 0; i <= 200; i++) {
      const x = (i / 200) * 4 * Math.PI;
      this.chart.plot({ x, y: Math.sin(x) });
      this.chart.plotDataSet(COS, { x, y: 0.6 * Math.cos(2 * x) });
    }
    this.chart.focus();
    this.chart.drawAll();
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
        case 's': {
          this.thin = !this.thin;
          const ls = this.thin ? runes.ThinLineStyle : runes.ArcLineStyle;
          this.chart.setStyles(ls, sinStyle);
          this.chart.setDataSetStyles(COS, ls, cosStyle);
          this.chart.drawAll();
          return [this, null];
        }
      }
    }
    // XAxisUpdateHandler: left/right/drag move, pgup/pgdown/wheel zoom
    this.chart.update(msg);
    this.chart.drawAll();
    return [this, null];
  }

  view(): View {
    const title = `sin(x) and 0.6·cos(2x) (${this.thin ? 'thin' : 'arc'} lines)`;
    const help = 's: arc/thin · pgup/pgdown/wheel: zoom · left/right/drag: move · q: quit';
    const v = NewView(this.zm.scan(boxStyle.render(title + '\n' + this.chart.view()) + '\n' + helpStyle.render(help)));
    v.altScreen = true;
    v.mouseMode = MouseMode.CellMotion;
    return v;
  }
}

await NewProgram(new WaveModel(zone.New())).run();
