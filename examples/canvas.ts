/**
 * canvas.ts: two canvases with viewports smaller than their contents.
 * Port of upstream examples/canvas/logo.
 *
 *   bun examples/canvas.ts
 *
 * Click a canvas (or press enter) to focus it, then move its viewport with the
 * arrow keys, the mouse wheel, or by dragging. q quits.
 */
import { NewProgram, NewView, Quit, MouseMode, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import { newStyle, normalBorder, joinHorizontal, Top } from '@oakoliver/lipgloss';
import * as zone from '@oakoliver/bubblezone';
import { canvas } from '../src/index.js';

const highlightStyle = newStyle().foreground(1).background(2); // red on green
const c1Style = newStyle().borderStyle(normalBorder()).borderForeground(63); // purple
const c2Style = newStyle()
  .borderStyle(normalBorder())
  .borderForeground(14) // cyan
  .foreground(212) // pink
  .background(227); // yellow

function exampleCanvas1(): canvas.Model {
  const c1 = canvas.New(20, 10);

  // set all contents at once with string[]
  c1.setLines([
    '   ', // line 0 - missing characters are displayed as ' ' up to the canvas width
    ' ██████████████████ ',
    ' █                █ ',
    ' █ ██████████████ █ ',
    ' █ █                ',
    '                █ █ ',
    ' █ ██████████████ █ ',
    ' █                █ ',
    ' ██████████████████ ',
    // line 9 - a missing line is displayed as ' ' up to the canvas width
  ]);

  // the canvas coordinate system has (0,0) at the top left
  c1.setString({ x: 7, y: 4 }, ' IMBLE   █ █ this will be dropped');
  // runes are one-character strings
  c1.setRunes({ x: 1, y: 5 }, ['█', ' ', String.fromCodePoint(0x2588), ' ', ' ', ' ', 'M', 'A', 'R', 'K', 'E', 'T', 'S']);
  // a single styled cell, and a style change on an existing cell
  c1.setCell({ x: 7, y: 4 }, canvas.NewCellWithStyle('N', highlightStyle));
  c1.setCellStyle({ x: 7, y: 5 }, highlightStyle); // 'M'

  c1.viewHeight = 6;
  c1.viewWidth = 18;
  return c1;
}

function exampleCanvas2(zm: zone.Manager): canvas.Model {
  const contents = [
    ' ███████████████████  ',
    '  ███████████████████ ',
    '     ███       ███    ',
    '     ███       ███    ',
    '   ███████████████    ',
    '    ██████████████    ',
    '      ██       ███    ',
    '       █       ███    ',
    '                ██    ',
    '                 █    ',
  ];
  // creating a canvas with options
  return canvas.New(30, 10,
    canvas.WithZoneManager(zm),
    canvas.WithViewHeight(6),
    canvas.WithViewWidth(24),
    canvas.WithContent(contents));
}

class LogoModel implements Model {
  constructor(public c1: canvas.Model, public c2: canvas.Model, public zm: zone.Manager) {}

  init(): Cmd {
    return null;
  }

  update(msg: Msg): [Model, Cmd] {
    if (msg?._tag === 'KeyPressMsg') {
      switch (msg.toString()) {
        case 'enter':
          if (this.c1.focused()) {
            this.c1.blur();
            this.c2.focus();
          } else {
            this.c1.focus();
            this.c2.blur();
          }
          break;
        case 'q':
        case 'ctrl+c':
          return [this, Quit];
      }
    } else if (msg?._tag === 'MouseClickMsg') {
      if (this.zm.get(this.c1.zoneID()).inBounds(msg)) {
        this.c2.blur();
        this.c1.focus();
      } else if (this.zm.get(this.c2.zoneID()).inBounds(msg)) {
        this.c1.blur();
        this.c2.focus();
      } else {
        this.c1.blur();
        this.c2.blur();
      }
    }
    if (this.c1.focused()) this.c1.update(msg);
    else this.c2.update(msg);
    return [this, null];
  }

  view(): View {
    let s = 'left click to select canvas, or `enter` to toggle between canvas\n';
    s += 'click and drag, mouse wheel scroll or arrow keys to move viewport around\n';
    s += '`q/ctrl+c` to quit\n';
    s += joinHorizontal(Top, c1Style.render(this.c1.view()), c2Style.render(this.c2.view())) + '\n';
    const v = NewView(this.zm.scan(s)); // call the zone manager's scan() at the root model
    v.altScreen = true;
    v.mouseMode = MouseMode.CellMotion;
    return v;
  }
}

// Mouse support uses @oakoliver/bubblezone:
// 1. create a manager with zone.New()
// 2. give it to the canvas with setZoneManager() or WithZoneManager()
// 3. enable mouse reporting in the view (mouseMode)
// 4. wrap the root view with the manager's scan()
const zm = zone.New();
const m = new LogoModel(exampleCanvas1(), exampleCanvas2(zm), zm);
m.c1.setZoneManager(zm);
m.c1.focus();
await NewProgram(m).run();
