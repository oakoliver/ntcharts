/**
 * graph.ts: the drawing helpers of the graph package on plain canvases.
 * Ports upstream examples/graph/{lines,circles,braille,columns,rows,candlesticks}
 * as six pages of one program.
 *
 *   bun examples/graph.ts
 *
 * Keys: 1-6 or tab switch page · arrow keys move the origin (lines, circles,
 * braille, candlesticks) or the viewport (columns, rows) · click moves the
 * origin on the lines page · q quits.
 */
import { NewProgram, NewView, Quit, MouseMode, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import { newStyle, normalBorder, joinHorizontal, Top, type Style } from '@oakoliver/lipgloss';
import * as zone from '@oakoliver/bubblezone';
import { canvas, graph, runes } from '../src/index.js';

const box = newStyle().borderStyle(normalBorder()).borderForeground(63); // purple
const blue = newStyle().foreground(4);
const pink = newStyle().foreground(5);
const yellow = newStyle().foreground(3);
const cyan = newStyle().foreground(6);
const red = newStyle().foreground(9);
const title = newStyle().bold(true).foreground(212);
const dim = newStyle().foreground(244);

const W = 20;
const H = 11;
const pages = ['lines', 'circles', 'braille', 'columns', 'rows', 'candlesticks'] as const;
type Page = (typeof pages)[number];

// Cartesian Y values (0 is the bottom) turned into canvas Y values (0 is the top).
const xAxis = 10;
const coords1 = canvas.CanvasYCoordinates(xAxis, [7, 3, 0, 6, 5, 9, 1, 2, 4, 8, 8, 9, 4, 0, 0, 5]);
const coords2 = canvas.CanvasYCoordinates(xAxis, [9, 3, 1, 8, 9, 7, 2, 4, 5, 4, 0, 4, 0, 5, 7, 8, 5]);

const columnLens1 = [1, 1.891, 2, 2.694, 1.561, 2.109, 0.889, 6.836, 0, 12, 6.708, 8.943, 1.066, 2.55, 8.242, 3.513, 9.768, 9.989, 4.372];
const columnLens2 = [2.907, 1.382, 7.086, 5.401, 8.561, 4.848, 2.398, 4.302, 8.822, 1.149, 0, 6.733, 2.805, 5, 7.138, 10.385, 2, 3.707, 9.529, 4.272];
const rowLens1 = [1 + 1.891, 2 + 2.694, 1.561 + 2.109, 5.889 + 6.836, 0, 6.708 + 8.943, 1.066 + 2.55, 8.242 + 3.513, 9.768 + 9.989, 4.372];
const rowLens2 = [1, 8.561 + 4.848, 2.398 + 4.302, 8.822 + 1.149, 6.733 + 2.805, 0, 5 + 7.138, 10.385 + 2, 3.707 + 9.529, 4.272];

class GraphModel implements Model {
  page: Page = 'lines';
  cursor: canvas.Point = { x: 0, y: xAxis };
  zm = zone.New();
  small = [0, 1, 2].map(() => canvas.New(W, H, canvas.WithZoneManager(this.zm)));
  // columns and rows draw on 100x100 canvases seen through a 20x11 viewport
  big = [0, 1, 2].map(() => canvas.New(100, 100, canvas.WithViewWidth(W), canvas.WithViewHeight(H), canvas.WithFocus()));

  constructor() {
    this.setPage('lines');
  }

  init(): Cmd {
    return null;
  }

  private setPage(p: Page): void {
    this.page = p;
    if (p === 'lines') this.cursor = { x: 0, y: xAxis };
    else if (p === 'candlesticks') this.cursor = { x: 0, y: H - 1 };
    else this.cursor = { x: Math.trunc(W / 2), y: Math.trunc(H / 2) };
    if (p === 'columns' || p === 'rows') this.drawBig();
    else this.draw();
  }

  update(msg: Msg): [Model, Cmd] {
    if (msg?._tag === 'KeyPressMsg') {
      const k = msg.toString();
      if (k === 'q' || k === 'ctrl+c') return [this, Quit];
      const n = Number(k);
      if (n >= 1 && n <= pages.length) {
        this.setPage(pages[n - 1]);
        return [this, null];
      }
      if (k === 'tab') {
        this.setPage(pages[(pages.indexOf(this.page) + 1) % pages.length]);
        return [this, null];
      }
    }
    if (this.page === 'columns' || this.page === 'rows') {
      // the canvases move their own viewport with the arrow keys and the wheel
      for (const c of this.big) c.update(msg);
      return [this, null];
    }
    if (msg?._tag === 'KeyPressMsg') {
      switch (msg.toString()) {
        case 'up': this.cursor.y = Math.max(0, this.cursor.y - 1); break;
        case 'down': this.cursor.y = Math.min(H - 1, this.cursor.y + 1); break;
        case 'left': this.cursor.x = Math.max(0, this.cursor.x - 1); break;
        case 'right': this.cursor.x = Math.min(W - 1, this.cursor.x + 1); break;
      }
    } else if (this.page === 'lines' && msg?._tag === 'MouseClickMsg') {
      for (const c of this.small) {
        const z = this.zm.get(c.zoneID());
        if (z.inBounds(msg)) {
          const [x, y] = z.pos(msg);
          this.cursor = { x, y };
        }
      }
    }
    this.draw();
    return [this, null];
  }

  private draw(): void {
    const [c1, c2, c3] = this.small;
    for (const c of this.small) c.clear();
    const at = (dx: number, dy: number) => canvas.PointAdd(this.cursor, { x: dx, y: dy });
    switch (this.page) {
      case 'lines': {
        const startX = 1; // start drawing at X = 1 for the demo, usually the Y axis
        graph.DrawXYAxis(c1, this.cursor, yellow);
        graph.DrawLineSequence(c1, true, startX, coords1, runes.ThinLineStyle, blue);
        graph.DrawXYAxisDown(c2, this.cursor, yellow);
        graph.DrawLineSequence(c2, true, startX, coords2, runes.ArcLineStyle, pink);
        graph.DrawXYAxisAll(c3, this.cursor, yellow);
        graph.DrawLineSequence(c3, true, startX, coords1, runes.ThinLineStyle, blue);
        graph.DrawLineSequence(c3, true, startX, coords2, runes.ArcLineStyle, pink);
        break;
      }
      case 'circles': {
        graph.DrawXYAxis(c1, this.cursor, yellow);
        for (const p of graph.GetCirclePoints(this.cursor, 3) ?? []) c1.setCell(p, canvas.NewCellWithStyle(runes.FullBlock, blue));
        graph.DrawXYAxisDown(c2, this.cursor, yellow);
        for (const p of graph.GetFullCirclePoints(this.cursor, 3) ?? []) c2.setCell(p, canvas.NewCellWithStyle(runes.FullBlock, blue));
        graph.DrawXYAxisAll(c3, this.cursor, yellow);
        const left = graph.GetFullCirclePoints(at(-1, -1), 3) ?? [];
        const right = graph.GetFullCirclePoints(at(1, 1), 3) ?? [];
        const key = (p: canvas.Point) => `${p.x},${p.y}`;
        const leftSet = new Set(left.map(key));
        const rightSet = new Set(right.map(key));
        for (const p of left) if (!rightSet.has(key(p))) c3.setCell(p, canvas.NewCellWithStyle(runes.FullBlock, blue));
        for (const p of right) if (!leftSet.has(key(p))) c3.setCell(p, canvas.NewCellWithStyle(runes.FullBlock, pink));
        break;
      }
      case 'braille': {
        // braille pattern dots are 4 high and 2 wide
        const grid1 = runes.NewPatternDotsGrid(4, 4);
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) grid1.set(x, y);
        const pattern1 = grid1.braillePatterns();
        graph.DrawXYAxisAll(c1, this.cursor, yellow);
        for (const [dx, dy] of [[1, -1], [-2, -1], [1, 1], [-2, 1]]) graph.DrawBraillePatterns(c1, at(dx, dy), pattern1, blue);

        // a 3x3 box of braille runes with only the outer dots set
        const grid2 = runes.NewPatternDotsGrid(6, 12);
        for (let y = 0; y < 12; y++) for (let x = 0; x < 6; x++) if (y < 1 || y > 10 || x < 1 || x > 4) grid2.set(x, y);
        graph.DrawXYAxisAll(c2, this.cursor, yellow);
        graph.DrawBraillePatterns(c2, at(-1, -1), grid2.braillePatterns(), pink);

        // two braille lines crossing: the runes combine where they meet
        const hLine = runes.NewPatternDots();
        hLine[1] = true;
        hLine[4] = true;
        const hLineR = runes.BraillePatternFromPatternDots(hLine);
        const vLineR = String.fromCodePoint(runes.BrailleBlockOffset | 0x08 | 0x10 | 0x20 | 0x80);
        graph.DrawXYAxisAll(c3, this.cursor, yellow);
        for (let i = 0; i < 10; i++) {
          const p = at(i - 5, -1);
          graph.DrawBrailleRune(c3, p, runes.CombineBraillePatterns(c3.cell(p).rune, hLineR), blue);
        }
        for (let i = 0; i < 6; i++) {
          const p = at(2, i - 3);
          graph.DrawBrailleRune(c3, p, runes.CombineBraillePatterns(c3.cell(p).rune, vLineR), pink);
        }
        break;
      }
      case 'candlesticks': {
        // bodies and wicks: [low, body low, body high, high] per column
        const candles1: [number, number, number, number, number][] = [
          [1, 0.3, 1.3, 2, 6.3], [2, 0.3, 1.6, 4, 6.3], [3, 0.6, 1.3, 4, 6.3], [4, 0.6, 1.6, 4, 6.3],
          [6, 1.6, 1.6, 4, 4], [7, 1.6, 2.6, 4, 4], [8, 1.6, 2.3, 4, 5], [9, 1.3, 4, 4.3, 5], [10, 1.6, 4, 4.6, 5],
        ];
        graph.DrawXYAxis(c1, this.cursor, yellow);
        for (const [x, l, bl, bh, h] of candles1) graph.DrawCandlestickBottomToTop(c1, at(x, -1), l, bl, bh, h, blue);
        // half-cell steps: every combination of short wicks and bodies
        const candles2: [number, number, number, number, number][] = [
          [1, 0.3, 0.3, 0.3, 0.3], [2, 0.3, 0.3, 0.3, 0.6], [3, 0.3, 0.3, 0.6, 0.6], [4, 0.3, 0.6, 0.6, 0.6], [5, 0.6, 0.6, 0.6, 0.6],
          [7, 0.3, 0.3, 0.3, 0.3], [8, 0.3, 0.3, 0.3, 2.3], [9, 0.3, 0.3, 2.3, 2.3], [10, 0.3, 2.3, 2.3, 2.3], [11, 2.3, 2.3, 2.3, 2.3],
          [13, 0.3, 0.3, 0.3, 0.3], [14, 0.3, 0.3, 0.3, 2.6], [15, 0.3, 0.3, 2.6, 2.6], [16, 0.3, 2.6, 2.6, 2.6], [17, 2.6, 2.6, 2.6, 2.6],
        ];
        graph.DrawXYAxis(c2, this.cursor, yellow);
        for (const [x, l, bl, bh, h] of candles2) graph.DrawCandlestickBottomToTop(c2, at(x, -1), l, bl, bh, h, pink);
        // the same candles as blocks, and wide ones
        graph.DrawXYAxis(c3, this.cursor, yellow);
        candles1.slice(0, 4).forEach(([, l, bl, bh, h], i) => graph.DrawCandlestickBlockBottomToTop(c3, at(2 + i * 2, -1), l, bl, bh, h, blue));
        graph.DrawCandlestickBottomToTopWide(c3, at(12, -1), 3, 0.3, 1.6, 4, 6.3, pink);
        graph.DrawCandlestickBottomToTopWide(c3, at(16, -1), 3, 1.6, 2.3, 4, 5, pink);
        break;
      }
    }
  }

  private drawBig(): void {
    const [c1, c2, c3] = this.big;
    const origin = { x: 0, y: xAxis };
    for (const c of this.big) {
      c.clear();
      c.setCursor({ x: 0, y: 0 });
      graph.DrawXYAxisLeft(c, origin, pink); // demo X axis extending left
    }
    if (this.page === 'columns') {
      const p = canvas.PointAdd(origin, { x: 1, y: -1 });
      graph.DrawColumns(c1, p, columnLens1, cyan);
      graph.DrawColumns(c2, p, columnLens2, red);
      graph.DrawColumns(c3, p, columnLens1, cyan);
      graph.DrawColumns(c3, p, columnLens2, red);
    } else {
      graph.DrawRows(c1, canvas.PointAdd(origin, { x: 1, y: -rowLens1.length }), rowLens1, cyan);
      graph.DrawRows(c2, canvas.PointAdd(origin, { x: 1, y: -rowLens2.length }), rowLens2, red);
      graph.DrawRows(c3, canvas.PointAdd(origin, { x: 1, y: -rowLens1.length }), rowLens1, cyan);
      graph.DrawRows(c3, canvas.PointAdd(origin, { x: 1, y: -rowLens2.length }), rowLens2, red);
    }
  }

  view(): View {
    const tabs = pages.map((p, i) => (p === this.page ? title.render(`${i + 1} ${p}`) : dim.render(`${i + 1} ${p}`))).join('  ');
    const cs: canvas.Model[] = this.page === 'columns' || this.page === 'rows' ? this.big : this.small;
    const help = this.page === 'columns' || this.page === 'rows'
      ? 'arrows/wheel move the viewport'
      : this.page === 'lines' ? 'arrows/click move the origin' : 'arrows move the origin';
    let s = `${tabs}\n`;
    s += joinHorizontal(Top, ...cs.map((c) => box.render(c.view()))) + '\n';
    s += dim.render(`${help} · 1-6/tab page · q quit`) + '\n';
    const v = NewView(this.zm.scan(s));
    v.altScreen = true;
    v.mouseMode = MouseMode.CellMotion;
    return v;
  }
}

await NewProgram(new GraphModel()).run();
