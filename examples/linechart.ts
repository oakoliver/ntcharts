/**
 * linechart.ts: lines, circles and scatter points on linecharts.
 * Port of upstream examples/linechart/{lines,circles,scatter}.
 *
 *   bun examples/linechart.ts
 *
 * The left chart draws random lines (rune, arc and braille). The right chart
 * holds circles and a scatter plot you can zoom (pgup/pgdown, mouse wheel)
 * and move (arrow keys, mouse drag). q quits.
 */
import { NewProgram, NewView, Quit, MouseMode, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import { newStyle, normalBorder, joinHorizontal, Top } from '@oakoliver/lipgloss';
import * as zone from '@oakoliver/bubblezone';
import { linechart, runes } from '../src/index.js';

const boxStyle = newStyle().borderStyle(normalBorder()).borderForeground(63); // purple
const axisStyle = newStyle().foreground(3); // yellow
const labelStyle = newStyle().foreground(6); // cyan
const blue = newStyle().foreground(4);
const pink = newStyle().foreground(5);
const green = newStyle().foreground(10);
const helpStyle = newStyle().foreground(241);

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

// scatter points stay put while the right chart zooms and moves
const scatter = Array.from({ length: 60 }, () => ({ x: rand(-40, 90), y: rand(-40, 90) }));

class LinesModel implements Model {
  lines: linechart.Model;
  shapes: linechart.Model;

  constructor(public zm: zone.Manager) {
    const opts = [linechart.WithXYSteps(2, 2), linechart.WithStyles(axisStyle, labelStyle, pink)];
    this.lines = linechart.New(36, 14, -50, 100, -50, 100, ...opts);
    this.shapes = linechart.New(40, 14, -50, 100, -50, 100, ...opts, linechart.WithZoneManager(zm));
    this.shapes.focus();
    this.lines.drawXYAxisAndLabel();
    this.drawShapes();
  }

  // a linechart keeps no data: redraw everything after the view changes
  drawShapes(): void {
    const m = this.shapes;
    m.clear();
    m.drawXYAxisAndLabel();
    for (const p of scatter) m.drawRuneWithStyle(p, '•', green);
    m.drawRuneCircleWithStyle({ x: 0, y: 0 }, 30, '*', pink);
    m.drawBrailleCircleWithStyle({ x: 50, y: 50 }, 25, blue);
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
        case 'r':
          this.lines.clear();
          this.lines.drawXYAxisAndLabel();
          return [this, null];
        case 'space': {
          const a = { x: rand(-50, 100), y: rand(-50, 100) };
          const b = { x: rand(-50, 100), y: rand(-50, 100) };
          const c = { x: rand(-50, 100), y: rand(-50, 100) };
          this.lines.drawLineWithStyle(a, b, runes.ArcLineStyle, blue);
          this.lines.drawBrailleLineWithStyle(b, c, green);
          this.lines.drawRuneLineWithStyle(c, a, '·', pink);
          return [this, null];
        }
      }
    }
    // keys, wheel, click and drag go to the zoomable chart
    this.shapes.update(msg);
    this.drawShapes();
    return [this, null];
  }

  view(): View {
    const help = 'space: random lines · r: reset · pgup/pgdown/wheel: zoom · arrows/drag: move · q: quit';
    const s =
      joinHorizontal(
        Top,
        boxStyle.render('random lines\n' + this.lines.view()),
        boxStyle.render('circles & scatter (zoom me)\n' + this.shapes.view()),
      ) +
      '\n' +
      helpStyle.render(help);
    const v = NewView(this.zm.scan(s)); // the zone manager scans the root view
    v.altScreen = true;
    v.mouseMode = MouseMode.CellMotion;
    return v;
  }
}

await NewProgram(new LinesModel(zone.New())).run();
