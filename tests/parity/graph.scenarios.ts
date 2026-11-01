// TypeScript twins of tests/parity/go/graph.go (graph and runes scenarios).
// Keep the two files in step.
import { newStyle, type Style } from '@oakoliver/lipgloss';
import * as canvas from '../../src/canvas/index.js';
import * as graph from '../../src/canvas/graph/graph.js';
import * as runes from '../../src/canvas/runes/runes.js';
import { register } from './registry.js';

type Pt = canvas.Point;
type Model = canvas.Model;

const grFg = (c: string): Style => newStyle().foreground(c);

const grPlain = newStyle();
const grRed = grFg('1');
const grGreen = grFg('2');
const grYellow = grFg('3');
const grBlue = grFg('4');
const grBgOnly = newStyle().background('5');
const grBoldBg = newStyle().bold(true).foreground('#ffffff').background('#0000ff');
const grHex = grFg('#ff8800');

const grCanvas = (w: number, h: number): Model => canvas.New(w, h);
const grP = (x: number, y: number): Pt => ({ x, y });

function grPts(ps: Pt[] | null): string {
  if (ps === null || ps.length === 0) return 'nil';
  let s = '';
  for (const p of ps) s += `${p.x},${p.y} `;
  return s;
}

function grPlot(c: Model, ps: Pt[] | null, r: string, s: Style): void {
  for (const p of ps ?? []) c.setRuneWithStyle(p, r, s);
}

const grJoin = (...parts: string[]): string => parts.join('\n--\n');
const lenOf = (ps: Pt[] | null): number => (ps ?? []).length;
const hex = (r: string): string => runes.codePoint(r).toString(16);
const b2i = (b: boolean): number => (b ? 1 : 0);
const goBools = (a: boolean[]): string => `[${a.join(' ')}]`;
const goSegs = (l: runes.LineSegments): string => `{${l.up} ${l.down} ${l.left} ${l.right}}`;

// ---- axes and straight lines ----------------------------------------------------
const axes: { name: string; fn: (m: Model, p: Pt, s: Style) => void }[] = [
  { name: 'xy', fn: graph.DrawXYAxis },
  { name: 'down', fn: graph.DrawXYAxisDown },
  { name: 'left', fn: graph.DrawXYAxisLeft },
  { name: 'all', fn: graph.DrawXYAxisAll },
];
for (const a of axes) {
  register(`graph/axes-${a.name}`, () => {
    const c = grCanvas(14, 8);
    a.fn(c, grP(5, 4), grRed);
    return c.view();
  });
}
register('graph/axes-edges', () => {
  const outs: string[] = [];
  for (const a of axes) {
    let c = grCanvas(9, 5);
    a.fn(c, grP(0, 0), grGreen);
    a.fn(c, grP(8, 4), grBlue);
    outs.push(c.view());
    c = grCanvas(9, 5);
    a.fn(c, grP(-1, 2), grGreen);
    a.fn(c, grP(12, 2), grBlue);
    a.fn(c, grP(4, -2), grRed);
    a.fn(c, grP(4, 9), grYellow);
    outs.push(c.view());
  }
  return grJoin(...outs);
});
register('graph/axes-overlap-styles', () => {
  const c = grCanvas(14, 8);
  graph.DrawXYAxisAll(c, grP(6, 4), grPlain);
  graph.DrawXYAxis(c, grP(3, 6), grBoldBg);
  graph.DrawXYAxisLeft(c, grP(9, 2), grHex);
  return c.view();
});
register('graph/lines-straight', () => {
  const c = grCanvas(14, 8);
  graph.DrawVerticalLineUp(c, grP(2, 5), grRed);
  graph.DrawVerticalLineDown(c, grP(4, 2), grGreen);
  graph.DrawHorizonalLineLeft(c, grP(9, 1), grBlue);
  graph.DrawHorizonalLineRight(c, grP(5, 6), grYellow);
  graph.DrawVerticalLineUp(c, grP(20, 5), grRed);
  graph.DrawVerticalLineDown(c, grP(-3, 2), grRed);
  graph.DrawHorizonalLineLeft(c, grP(5, 40), grRed);
  graph.DrawHorizonalLineRight(c, grP(5, -3), grRed);
  graph.DrawVerticalLineUp(c, grP(12, 40), grHex);
  return c.view();
});

// ---- line sequences ---------------------------------------------------------------
const lineStyles = [
  { name: 'thin', ls: runes.ThinLineStyle },
  { name: 'arc', ls: runes.ArcLineStyle },
];
for (const ls of lineStyles) {
  register(`graph/line-seq-${ls.name}-yaxis`, () => {
    const c = grCanvas(18, 10);
    graph.DrawXYAxis(c, grP(1, 8), grGreen);
    const seq = canvas.CanvasYCoordinates(8, [0, 1, 3, 2, 5, 5, 4, 7, 1, 0, 2, 6]);
    graph.DrawLineSequence(c, true, 1, seq, ls.ls, grRed);
    return c.view();
  });
  register(`graph/line-seq-${ls.name}-first-on-axis`, () => {
    const c = grCanvas(18, 10);
    graph.DrawXYAxis(c, grP(1, 8), grGreen);
    graph.DrawLineSequence(c, true, 1, canvas.CanvasYCoordinates(8, [3, 4, 2, 6, 6, 1]), ls.ls, grRed);
    graph.DrawLineSequence(c, true, 1, canvas.CanvasYCoordinates(8, [3, 5, 5, 0, 2]), ls.ls, grBlue);
    return c.view();
  });
  register(`graph/line-seq-${ls.name}-axis-down`, () => {
    const c = grCanvas(18, 11);
    graph.DrawXYAxisDown(c, grP(2, 5), grGreen);
    graph.DrawLineSequence(c, true, 2, canvas.CanvasYCoordinates(5, [0, 2, -3, -3, 4, 1, -2]), ls.ls, grRed);
    graph.DrawLineSequence(c, true, 2, canvas.CanvasYCoordinates(5, [-4, -1, 3]), ls.ls, grBlue);
    return c.view();
  });
  register(`graph/line-seq-${ls.name}-axis-all`, () => {
    const c = grCanvas(18, 11);
    graph.DrawXYAxisAll(c, grP(6, 5), grGreen);
    graph.DrawLineSequence(c, false, 2, canvas.CanvasYCoordinates(5, [2, 2, 3, -1, -1, -3, 0, 4, 4, 1]), ls.ls, grRed);
    graph.DrawLineSequence(c, false, 3, canvas.CanvasYCoordinates(5, [-2, 0, 0, 2, 5, 1]), ls.ls, grBlue);
    return c.view();
  });
  register(`graph/line-seq-${ls.name}-no-yaxis`, () => {
    const c = grCanvas(18, 8);
    graph.DrawLineSequence(c, false, 3, [5, 5, 2, 6, 1, 1, 4, 3, 3, 0], ls.ls, grYellow);
    graph.DrawLineSequence(c, false, 0, [0, 3, 6, 7, 2], ls.ls, grHex);
    return c.view();
  });
  register(`graph/line-seq-${ls.name}-ltr`, () => {
    const c = grCanvas(14, 8);
    graph.DrawLineSequenceLeftToRight(c, grP(1, 3), grP(2, 3), ls.ls, grRed);
    graph.DrawLineSequenceLeftToRight(c, grP(2, 3), grP(3, 6), ls.ls, grRed);
    graph.DrawLineSequenceLeftToRight(c, grP(3, 6), grP(4, 1), ls.ls, grGreen);
    graph.DrawLineSequenceLeftToRight(c, grP(8, 1), grP(8, 5), ls.ls, grBlue);
    graph.DrawLineSequenceLeftToRight(c, grP(9, 1), grP(7, 5), ls.ls, grBlue);
    graph.DrawLineSequenceLeftToRight(c, grP(10, 2), grP(11, 2), ls.ls, grYellow);
    return c.view();
  });
}
register('graph/line-seq-empty-single', () => {
  const c = grCanvas(8, 4);
  graph.DrawLineSequence(c, false, 1, [], runes.ThinLineStyle, grRed);
  graph.DrawLineSequence(c, true, 1, [], runes.ArcLineStyle, grRed);
  graph.DrawLineSequence(c, false, 2, [2], runes.ThinLineStyle, grBlue);
  graph.DrawLineSequence(c, false, 5, [9], runes.ThinLineStyle, grBlue);
  return c.view();
});
register('graph/line-seq-overlap-mixed-styles', () => {
  const c = grCanvas(16, 9);
  graph.DrawLineSequence(c, false, 0, [4, 4, 4, 4, 4, 4, 4, 4, 4, 4], runes.ThinLineStyle, grGreen);
  graph.DrawLineSequence(c, false, 0, [0, 2, 4, 6, 8, 6, 4, 2, 0], runes.ArcLineStyle, grRed);
  graph.DrawLineSequence(c, false, 2, [8, 6, 4, 2, 0, 2, 4, 6, 8], runes.ThinLineStyle, grBlue);
  return c.view();
});

// ---- line points ---------------------------------------------------------------------
const linePairs: [Pt, Pt][] = [
  [grP(1, 1), grP(14, 6)],
  [grP(14, 1), grP(2, 7)],
  [grP(3, 8), grP(3, 1)],
  [grP(1, 4), grP(15, 4)],
  [grP(5, 0), grP(7, 8)],
  [grP(12, 8), grP(9, 0)],
];
for (const ls of lineStyles) {
  register(`graph/line-points-${ls.name}`, () => {
    const c = grCanvas(18, 10);
    linePairs.forEach((lp, i) => {
      const st = [grRed, grGreen, grBlue, grYellow, grHex, grBoldBg][i];
      graph.DrawLinePoints(c, graph.GetLinePoints(lp[0], lp[1]) ?? [], ls.ls, st);
    });
    return c.view();
  });
}
register('graph/get-line-points', () => {
  let s = '';
  for (const lp of linePairs) s += grPts(graph.GetLinePoints(lp[0], lp[1])) + '\n';
  s += grPts(graph.GetLinePoints(grP(2, 2), grP(2, 2))) + '\n';
  s += grPts(graph.GetLinePoints(grP(-3, -3), grP(3, 2))) + '\n';
  s += grPts(graph.GetLinePoints(grP(0, 0), grP(10, 1))) + '\n';
  s += grPts(graph.GetLinePoints(grP(0, 0), grP(1, 10))) + '\n';
  s += grPts(graph.GetLinePoints(grP(0, 0), grP(20000, 3))) + '\n';
  s += grPts(graph.GetLinePointsWithLimit(grP(0, 0), grP(9, 3), 9)) + '\n';
  s += grPts(graph.GetLinePointsWithLimit(grP(0, 0), grP(9, 3), 10)) + '\n';
  s += grPts(graph.GetLinePointsWithLimit(grP(0, 0), grP(0, 12), 0)) + '\n';
  s += grPts(graph.GetLinePointsWithLimit(grP(0, 0), grP(0, 12), -5)) + '\n';
  return s;
});
register('graph/line-points-degenerate', () => {
  const c = grCanvas(10, 5);
  graph.DrawLinePoints(c, [], runes.ThinLineStyle, grRed);
  graph.DrawLinePoints(c, [grP(1, 1)], runes.ThinLineStyle, grRed);
  graph.DrawLinePoints(c, [grP(1, 1), grP(1, 1), grP(2, 1), grP(2, 1)], runes.ThinLineStyle, grGreen);
  graph.DrawLinePoints(c, [grP(2, 3), grP(3, 3), grP(3, 2), grP(4, 2), grP(4, 3), grP(4, 4), grP(3, 4)], runes.ArcLineStyle, grBlue);
  graph.DrawLinePoints(c, [grP(7, 0), grP(8, 1), grP(7, 2), grP(8, 3), grP(9, 4)], runes.ThinLineStyle, grYellow);
  graph.DrawLinePoints(c, [grP(9, 0), grP(8, 1), grP(9, 2), grP(8, 3)], runes.ArcLineStyle, grHex);
  return c.view();
});

// ---- circles -----------------------------------------------------------------------------
register('graph/circle-points', () => {
  let s = '';
  for (let r = -1; r <= 7; r++) s += `r=${r}: ${grPts(graph.GetCirclePoints(grP(5, 5), r))}\n`;
  s += grPts(graph.GetCirclePoints(grP(100, -3), 20)) + '\n';
  return s;
});
register('graph/full-circle-points', () => {
  let s = '';
  for (let r = 0; r <= 6; r++) s += `r=${r}: ${grPts(graph.GetFullCirclePoints(grP(7, 7), r))}\n`;
  return s;
});
register('graph/circle-draw', () => {
  const c = grCanvas(24, 14);
  grPlot(c, graph.GetFullCirclePoints(grP(6, 6), 5), '#', grBlue);
  grPlot(c, graph.GetCirclePoints(grP(16, 6), 5), 'o', grRed);
  grPlot(c, graph.GetFullCirclePoints(grP(16, 6), 2), '*', grYellow);
  grPlot(c, graph.GetLinePoints(grP(0, 13), grP(23, 8)), '+', grGreen);
  return c.view();
});
register('graph/circle-line-points', () => {
  const c = grCanvas(24, 14);
  graph.DrawLinePoints(c, graph.GetCirclePoints(grP(7, 7), 5) ?? [], runes.ThinLineStyle, grRed);
  graph.DrawLinePoints(c, graph.GetFullCirclePoints(grP(17, 7), 4) ?? [], runes.ArcLineStyle, grBlue);
  return c.view();
});
register('graph/circle-limits', () => {
  const old = graph.DefaultMaxPoints;
  try {
    let s = '';
    s += grPts(graph.GetCirclePointsWithLimit(grP(5, 5), 10, 30)) + '\n';
    s += `${lenOf(graph.GetCirclePointsWithLimit(grP(5, 5), 10, 64))}\n`;
    s += `${lenOf(graph.GetCirclePointsWithLimit(grP(5, 5), 10, 40))}\n`;
    s += `${lenOf(graph.GetCirclePointsWithLimit(grP(5, 5), 10, 0))}\n`;
    s += grPts(graph.GetFullCirclePointsWithLimit(grP(5, 5), 4, 40)) + '\n';
    s += `${lenOf(graph.GetFullCirclePointsWithLimit(grP(5, 5), 4, 200))}\n`;
    s += `${lenOf(graph.GetFullCirclePointsWithLimit(grP(5, 5), 4, 60))}\n`;
    s += `${lenOf(graph.GetFullCirclePointsWithLimit(grP(5, 5), 4, 0))}\n`;
    graph.SetDefaultMaxPoints(25);
    s += grPts(graph.GetCirclePoints(grP(0, 0), 8)) + '\n';
    s += `${lenOf(graph.GetCirclePoints(grP(0, 0), 3))}\n`;
    s += grPts(graph.GetLinePoints(grP(0, 0), grP(30, 1))) + '\n';
    s += `${lenOf(graph.GetLinePoints(grP(0, 0), grP(24, 1)))}\n`;
    s += `${lenOf(graph.GetLinePoints(grP(0, 0), grP(25, 1)))}\n`;
    s += grPts(graph.GetFullCirclePoints(grP(0, 0), 3)) + '\n';
    return s;
  } finally {
    graph.SetDefaultMaxPoints(old);
  }
});

// ---- braille -------------------------------------------------------------------------------
register('graph/braille-grid-basic', () => {
  const c = grCanvas(14, 7);
  const g = graph.NewBrailleGrid(12, 5, 0, 10, 0, 5);
  for (let i = 0; i <= 10; i++) g.set(g.gridPoint({ x: i, y: (i * i) / 20.0 }));
  graph.DrawBraillePatterns(c, grP(1, 1), g.braillePatterns(), grRed);
  return c.view();
});
register('graph/braille-grid-lines', () => {
  const c = grCanvas(20, 8);
  graph.DrawXYAxis(c, grP(0, 7), grGreen);
  const g = graph.NewBrailleGrid(18, 6, 0, 9, -2, 7);
  const ys = [-1.5, 2.25, 6, 0.5, 3.75, 3.75, -2, 7, 1];
  let prev: Pt = grP(0, 0);
  ys.forEach((y, i) => {
    const p = g.gridPoint({ x: i, y });
    if (i > 0) for (const lp of graph.GetLinePoints(prev, p) ?? []) g.set(lp);
    prev = p;
  });
  graph.DrawBraillePatterns(c, grP(1, 0), g.braillePatterns(), grBlue);
  return c.view();
});
register('graph/braille-overlap', () => {
  const c = grCanvas(10, 4);
  const g1 = graph.NewBrailleGrid(8, 3, 0, 15, 0, 11);
  const g2 = graph.NewBrailleGrid(8, 3, 0, 15, 0, 11);
  for (let i = 0; i <= 15; i++) {
    g1.set(g1.gridPoint({ x: i, y: (i * 11.0) / 15.0 }));
    g2.set(g2.gridPoint({ x: i, y: 11 - (i * 11.0) / 15.0 }));
  }
  c.setString(grP(0, 3), 'xxxxxxxxxx');
  graph.DrawBraillePatterns(c, grP(1, 0), g1.braillePatterns(), grRed);
  graph.DrawBraillePatterns(c, grP(1, 0), g2.braillePatterns(), grBlue);
  graph.DrawBraillePatterns(c, grP(1, 3), g2.braillePatterns(), grGreen);
  graph.DrawBraillePatterns(c, grP(-2, -1), g1.braillePatterns(), grYellow);
  return c.view();
});
register('graph/braille-runes', () => {
  const c = grCanvas(10, 3);
  graph.DrawBrailleRune(c, grP(0, 0), '⠁', grRed);
  graph.DrawBrailleRune(c, grP(0, 0), '⠈', grBlue);
  graph.DrawBrailleRune(c, grP(1, 0), runes.Null, grRed);
  graph.DrawBrailleRune(c, grP(2, 0), 'a', grRed);
  graph.DrawBrailleRune(c, grP(3, 0), '⣿', grGreen);
  graph.DrawBrailleRune(c, grP(3, 0), '⠀', grYellow);
  c.setRune(grP(4, 0), 'Z');
  graph.DrawBrailleRune(c, grP(4, 0), '⠒', grHex);
  c.setRune(grP(5, 0), runes.LineVertical);
  graph.DrawBrailleRune(c, grP(5, 0), '⡇', grHex);
  graph.DrawBrailleRune(c, grP(20, 0), '⠁', grRed);
  graph.DrawBrailleRune(c, grP(0, 1), '⠀', grRed);
  graph.DrawBraillePatterns(c, grP(0, 2), [['⠁', '⠀', '⠃'], ['⠿']], grBlue);
  return c.view();
});
register('graph/braille-gridpoint', () => {
  let s = '';
  const grids = [
    graph.NewBrailleGrid(10, 5, 0, 10, 0, 5),
    graph.NewBrailleGrid(10, 5, -5, 5, -2.5, 2.5),
    graph.NewBrailleGrid(10, 5, 3, 3, 1, 1),
    graph.NewBrailleGrid(4, 2, 0, 1, 0, 1),
    graph.NewBrailleGrid(7, 3, 100, 160, -3, 33),
  ];
  const fs = [
    { x: 0, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 2.5 }, { x: -3, y: 8 }, { x: 0.5, y: 0.25 },
    { x: 2.49, y: 1.01 }, { x: 1.0 / 3.0, y: 2.0 / 3.0 }, { x: 130, y: 15 }, { x: 0.05, y: 0.95 },
  ];
  for (const g of grids) {
    for (const f of fs) {
      const p = g.gridPoint(f);
      s += `${p.x},${p.y} `;
    }
    s += '\n';
  }
  return s;
});
register('graph/braille-clear-circle', () => {
  const c = grCanvas(14, 6);
  const g = graph.NewBrailleGrid(12, 5, 0, 23, 0, 19);
  for (const p of graph.GetCirclePoints(grP(11, 9), 8) ?? []) g.set(p);
  g.clear();
  for (const p of graph.GetCirclePoints(grP(11, 9), 7) ?? []) g.set(p);
  g.set(grP(-1, 0));
  g.set(grP(24, 19));
  graph.DrawBraillePatterns(c, grP(1, 0), g.braillePatterns(), grGreen);
  return c.view();
});

// ---- columns ----------------------------------------------------------------------------------
register('graph/columns-basic', () => {
  const c = grCanvas(18, 10);
  graph.DrawColumns(c, grP(0, 9), [0.5, 1, 1.25, 2.75, 3.9, 4, 0, -1, 0.06, 0.04, 8, 9.4, 0.0625, 0.9999, 5.5, 0.1875], grRed);
  return c.view();
});
const colPairs = [
  { name: 'taller', a: [1, 1.5, 2, 2.25, 3.5, 0.4, 1, 4], b: [2, 2.5, 3.5, 4.75, 5, 3, 1.5, 7.5] },
  { name: 'shorter', a: [2, 2.5, 3.5, 4.75, 5, 3, 1.5, 7.5], b: [1, 1.5, 2, 2.25, 3.5, 0.4, 1, 4] },
  { name: 'same', a: [2, 2.5, 3.25, 1.9, 4, 1, 3.5, 0.5], b: [2, 2.3, 3.3, 1.6, 4, 1.5, 3.2, 0.3] },
];
for (const pr of colPairs) {
  register(`graph/columns-overlap-${pr.name}`, () => {
    const c = grCanvas(10, 10);
    graph.DrawColumns(c, grP(0, 9), pr.a, grRed);
    graph.DrawColumns(c, grP(0, 9), pr.b, grBlue);
    return c.view();
  });
}
register('graph/columns-overlap-layers', () => {
  const c = grCanvas(10, 10);
  graph.DrawColumns(c, grP(0, 9), [6, 5.5, 3.25, 2, 7.8, 1, 4, 4], grRed);
  graph.DrawColumns(c, grP(0, 9), [3, 5.5, 4.5, 1.25, 2.4, 1, 4.5, 3.75], grBlue);
  graph.DrawColumns(c, grP(0, 9), [1.5, 2.5, 6, 0.6, 8.9, 0.25, 2, 4], grBoldBg);
  return c.view();
});
register('graph/columns-overlap-background-styles', () => {
  const c = grCanvas(8, 8);
  graph.DrawColumns(c, grP(0, 7), [5, 5.5, 3.25, 6.5], grBgOnly);
  graph.DrawColumns(c, grP(0, 7), [3.5, 3, 4.75, 2], grHex);
  graph.DrawColumns(c, grP(4, 7), [2.5, 5, 3.25, 6.5], grBoldBg);
  graph.DrawColumns(c, grP(4, 7), [3.5, 6, 3.25, 0.5], grPlain);
  return c.view();
});
register('graph/column-single-and-rune', () => {
  const c = grCanvas(12, 8);
  graph.DrawColumnBottomToTop(c, grP(0, 7), 3.5, grRed);
  graph.DrawColumnBottomToTop(c, grP(1, 7), 0, grRed);
  graph.DrawColumnBottomToTop(c, grP(2, 7), 20, grGreen);
  graph.DrawColumnBottomToTop(c, grP(3, 7), 2, grBlue);
  graph.DrawColumnBottomToTop(c, grP(30, 7), 2, grBlue);
  graph.DrawColumnBottomToTop(c, grP(4, 12), 2, grBlue);
  graph.DrawColumnRune(c, grP(5, 7), runes.LowerBlockThree, grRed);
  graph.DrawColumnRune(c, grP(5, 7), runes.FullBlock, grBlue);
  graph.DrawColumnRune(c, grP(6, 7), runes.FullBlock, grRed);
  graph.DrawColumnRune(c, grP(6, 7), runes.LowerBlockFive, grBlue);
  graph.DrawColumnRune(c, grP(7, 7), runes.LowerBlockTwo, grRed);
  graph.DrawColumnRune(c, grP(7, 7), runes.LowerBlockSeven, grBlue);
  graph.DrawColumnRune(c, grP(8, 7), runes.Null, grRed);
  graph.DrawColumnRune(c, grP(9, 7), 'x', grRed);
  graph.DrawColumnRune(c, grP(10, 7), runes.LeftBlockFour, grRed);
  c.setRune(grP(11, 7), 'q');
  graph.DrawColumnRune(c, grP(11, 7), runes.FullBlock, grRed);
  return c.view();
});

// ---- rows ----------------------------------------------------------------------------------------
register('graph/rows-basic', () => {
  const c = grCanvas(12, 18);
  graph.DrawRows(c, grP(0, 0), [0.5, 1, 1.25, 2.75, 3.9, 4, 0, -1, 0.06, 0.04, 8, 13.4, 0.0625, 0.9999, 5.5, 0.1875], grRed);
  return c.view();
});
for (const pr of colPairs) {
  register(`graph/rows-overlap-${pr.name}`, () => {
    const c = grCanvas(10, 8);
    graph.DrawRows(c, grP(0, 0), pr.a, grRed);
    graph.DrawRows(c, grP(0, 0), pr.b, grBlue);
    return c.view();
  });
}
register('graph/rows-overlap-layers', () => {
  const c = grCanvas(10, 8);
  graph.DrawRows(c, grP(0, 0), [6, 5.5, 3.25, 2, 7.8, 1, 4, 4], grRed);
  graph.DrawRows(c, grP(0, 0), [3, 5.5, 4.5, 1.25, 2.4, 1, 4.5, 3.75], grBlue);
  graph.DrawRows(c, grP(0, 0), [1.5, 2.5, 6, 0.6, 8.9, 0.25, 2, 4], grBoldBg);
  return c.view();
});
register('graph/rows-overlap-background-styles', () => {
  const c = grCanvas(8, 8);
  graph.DrawRows(c, grP(0, 0), [5, 5.5, 3.25, 6.5], grBgOnly);
  graph.DrawRows(c, grP(0, 0), [3.5, 3, 4.75, 2], grHex);
  graph.DrawRows(c, grP(0, 4), [2.5, 5, 3.25, 6.5], grBoldBg);
  graph.DrawRows(c, grP(0, 4), [3.5, 6, 3.25, 0.5], grPlain);
  return c.view();
});
register('graph/row-single-and-rune', () => {
  const c = grCanvas(8, 12);
  graph.DrawRowLeftToRight(c, grP(0, 0), 3.5, grRed);
  graph.DrawRowLeftToRight(c, grP(0, 1), 0, grRed);
  graph.DrawRowLeftToRight(c, grP(0, 2), 20, grGreen);
  graph.DrawRowLeftToRight(c, grP(0, 3), 2, grBlue);
  graph.DrawRowLeftToRight(c, grP(0, 30), 2, grBlue);
  graph.DrawRowLeftToRight(c, grP(10, 4), 2, grBlue);
  graph.DrawRowRune(c, grP(0, 5), runes.LeftBlockThree, grRed);
  graph.DrawRowRune(c, grP(0, 5), runes.FullBlock, grBlue);
  graph.DrawRowRune(c, grP(0, 6), runes.FullBlock, grRed);
  graph.DrawRowRune(c, grP(0, 6), runes.LeftBlockFive, grBlue);
  graph.DrawRowRune(c, grP(0, 7), runes.LeftBlockTwo, grRed);
  graph.DrawRowRune(c, grP(0, 7), runes.LeftBlockSeven, grBlue);
  graph.DrawRowRune(c, grP(0, 8), runes.Null, grRed);
  graph.DrawRowRune(c, grP(0, 9), 'x', grRed);
  graph.DrawRowRune(c, grP(0, 10), runes.LowerBlockFour, grRed);
  c.setRune(grP(0, 11), 'q');
  graph.DrawRowRune(c, grP(0, 11), runes.FullBlock, grRed);
  return c.view();
});

// ---- inverse (top-to-bottom, right-to-left) bars ----------------------------------------------------
const fracs = [0.01, 0.0625, 0.1, 0.125, 0.2, 0.25, 0.3, 0.375, 0.4, 0.5, 0.55, 0.625, 0.7, 0.75, 0.8, 0.875, 0.95, 0.99, 1, 1.5, 2.25, 3.9];
register('graph/columns-down-basic', () => {
  const c = grCanvas(24, 6);
  fracs.forEach((f, i) => graph.DrawColumnTopToBottom(c, grP(i, 0), f, grRed));
  graph.DrawColumnTopToBottom(c, grP(0, 5), 3, grBlue);
  graph.DrawColumnTopToBottom(c, grP(30, 0), 3, grBlue);
  graph.DrawColumnTopToBottom(c, grP(1, -2), 3.5, grBlue);
  graph.DrawColumnTopToBottom(c, grP(2, 0), -1, grBlue);
  return c.view();
});
register('graph/rows-left-basic', () => {
  const c = grCanvas(6, 24);
  fracs.forEach((f, i) => graph.DrawRowRightToLeft(c, grP(5, i), f, grGreen));
  graph.DrawRowRightToLeft(c, grP(0, 5), 3, grBlue);
  graph.DrawRowRightToLeft(c, grP(5, 30), 3, grBlue);
  graph.DrawRowRightToLeft(c, grP(7, 2), 3.5, grBlue);
  graph.DrawRowRightToLeft(c, grP(5, 3), -1, grBlue);
  return c.view();
});
const inners = [1.25, 1.5, 1.375, 1.75, 0.5, 0.1, 2.5, 3, 4, 1.0, 2.0, 1.9];
register('graph/columns-down-stacked', () => {
  const c = grCanvas(inners.length * 2, 6);
  inners.forEach((inn, i) => {
    graph.DrawColumnTopToBottom(c, grP(i * 2, 0), 1.75, grRed);
    graph.DrawColumnTopToBottom(c, grP(i * 2, 0), inn, grBlue);
    graph.DrawColumnTopToBottom(c, grP(i * 2 + 1, 0), 3, grRed);
    graph.DrawColumnTopToBottom(c, grP(i * 2 + 1, 0), 1.75, grGreen);
    graph.DrawColumnTopToBottom(c, grP(i * 2 + 1, 0), inn, grBlue);
  });
  return c.view();
});
register('graph/rows-left-stacked', () => {
  const c = grCanvas(6, inners.length * 2);
  inners.forEach((inn, i) => {
    graph.DrawRowRightToLeft(c, grP(5, i * 2), 1.75, grRed);
    graph.DrawRowRightToLeft(c, grP(5, i * 2), inn, grBlue);
    graph.DrawRowRightToLeft(c, grP(5, i * 2 + 1), 3, grRed);
    graph.DrawRowRightToLeft(c, grP(5, i * 2 + 1), 1.75, grGreen);
    graph.DrawRowRightToLeft(c, grP(5, i * 2 + 1), inn, grBlue);
  });
  return c.view();
});
register('graph/columns-down-styles-and-existing', () => {
  const c = grCanvas(10, 6);
  graph.DrawColumnTopToBottom(c, grP(0, 0), 2.5, grBoldBg);
  graph.DrawColumnTopToBottom(c, grP(1, 0), 3, grBoldBg);
  graph.DrawColumnTopToBottom(c, grP(1, 0), 2.5, grHex);
  graph.DrawColumnTopToBottom(c, grP(2, 0), 3, grBgOnly);
  graph.DrawColumnTopToBottom(c, grP(2, 0), 1.5, grPlain);
  c.setRune(grP(3, 2), 'x');
  graph.DrawColumnTopToBottom(c, grP(3, 0), 2.5, grRed);
  graph.DrawColumnBottomToTop(c, grP(4, 5), 3.5, grGreen);
  graph.DrawColumnTopToBottom(c, grP(4, 0), 2.5, grRed);
  graph.DrawColumnTopToBottom(c, grP(5, 0), 2.6, grRed);
  graph.DrawColumnTopToBottom(c, grP(5, 0), 2.3, grBlue);
  graph.DrawColumnTopToBottom(c, grP(5, 0), 2.1, grGreen);
  graph.DrawColumnTopToBottom(c, grP(6, 0), 1.9, grGreen);
  graph.DrawColumnTopToBottom(c, grP(6, 0), 2.1, grBlue);
  graph.DrawColumnTopToBottom(c, grP(7, 0), 2.2, grBgOnly);
  graph.DrawColumnTopToBottom(c, grP(7, 0), 2.2, grBoldBg);
  return c.view();
});
register('graph/rows-left-styles-and-existing', () => {
  const c = grCanvas(6, 10);
  graph.DrawRowRightToLeft(c, grP(5, 0), 2.5, grBoldBg);
  graph.DrawRowRightToLeft(c, grP(5, 1), 3, grBoldBg);
  graph.DrawRowRightToLeft(c, grP(5, 1), 2.5, grHex);
  graph.DrawRowRightToLeft(c, grP(5, 2), 3, grBgOnly);
  graph.DrawRowRightToLeft(c, grP(5, 2), 1.5, grPlain);
  c.setRune(grP(3, 3), 'x');
  graph.DrawRowRightToLeft(c, grP(5, 3), 2.5, grRed);
  graph.DrawRowLeftToRight(c, grP(0, 4), 3.5, grGreen);
  graph.DrawRowRightToLeft(c, grP(5, 4), 2.5, grRed);
  graph.DrawRowRightToLeft(c, grP(5, 5), 2.6, grRed);
  graph.DrawRowRightToLeft(c, grP(5, 5), 2.3, grBlue);
  graph.DrawRowRightToLeft(c, grP(5, 5), 2.1, grGreen);
  graph.DrawRowRightToLeft(c, grP(5, 6), 1.9, grGreen);
  graph.DrawRowRightToLeft(c, grP(5, 6), 2.1, grBlue);
  graph.DrawRowRightToLeft(c, grP(5, 7), 2.2, grBgOnly);
  graph.DrawRowRightToLeft(c, grP(5, 7), 2.2, grBoldBg);
  return c.view();
});
register('graph/columns-bidirectional', () => {
  const c = grCanvas(12, 11);
  graph.DrawXYAxisDown(c, grP(0, 5), grPlain);
  const pos = [1.5, 3.25, 4.9, 0.4, 2, 4.5];
  const neg = [0.5, 2.25, 0.9, 4.4, 1, 3.5];
  for (let i = 0; i < pos.length; i++) {
    graph.DrawColumnBottomToTop(c, grP(2 + i * 2, 4), pos[i], grGreen);
    graph.DrawColumnTopToBottom(c, grP(2 + i * 2, 6), neg[i], grRed);
  }
  return c.view();
});
register('graph/rows-bidirectional', () => {
  const c = grCanvas(21, 12);
  graph.DrawXYAxisAll(c, grP(10, 5), grPlain);
  const pos = [1.5, 3.25, 4.9, 0.4, 2, 4.5];
  const neg = [0.5, 2.25, 0.9, 4.4, 1, 3.5];
  for (let i = 0; i < pos.length; i++) {
    graph.DrawRowLeftToRight(c, grP(11, 1 + i), pos[i], grGreen);
    graph.DrawRowRightToLeft(c, grP(9, 1 + i), neg[i], grRed);
  }
  return c.view();
});

// ---- candlesticks ------------------------------------------------------------------------------------
interface Candle { l: number; bl: number; bh: number; h: number }
const candles: Candle[] = [
  [0, 1, 3, 4], [0.4, 1.6, 3.2, 4.8], [0.5, 2.5, 2.5, 3.5], [1, 1, 1, 1],
  [0.2, 0.7, 4.7, 5.2], [2.5, 3.5, 5.5, 7.5], [0, 0, 6, 6], [1.99, 2.01, 2.49, 2.5],
  [3, 3.5, 3.5, 3], [0.75, 1.25, 6.25, 6.75],
].map(([l, bl, bh, h]) => ({ l, bl, bh, h }));
register('graph/candle-basic', () => {
  const c = grCanvas(24, 11);
  candles.forEach((cd, i) => {
    graph.DrawCandlestickBottomToTop(c, grP(1 + i * 2, 9), cd.l, cd.bl, cd.bh, cd.h, [grRed, grGreen][i % 2]);
  });
  graph.DrawCandlestickBottomToTop(c, grP(30, 9), 1, 2, 3, 4, grRed);
  graph.DrawCandlestickBottomToTop(c, grP(22, 3), 0, 1, 3, 4, grRed);
  return c.view();
});
register('graph/candle-overlap', () => {
  const c = grCanvas(12, 10);
  graph.DrawCandlestickBottomToTop(c, grP(2, 9), 0, 1, 3, 4, grRed);
  graph.DrawCandlestickBottomToTop(c, grP(2, 9), 2, 3, 5, 7, grBlue);
  graph.DrawCandlestickBottomToTop(c, grP(4, 9), 1, 2, 4, 5, grRed);
  graph.DrawCandlestickBottomToTop(c, grP(4, 9), 1.5, 2.5, 3.5, 4.5, grGreen);
  graph.DrawCandlestickBottomToTop(c, grP(6, 9), 0.5, 1.5, 5.5, 6.5, grRed);
  graph.DrawCandlestickBottomToTop(c, grP(6, 9), 0.2, 1.7, 2.2, 8, grBlue);
  graph.DrawCandlestickBottomToTop(c, grP(8, 9), 0, 3, 3, 6, grHex);
  graph.DrawCandlestickBottomToTop(c, grP(8, 9), 0, 4, 4, 5, grYellow);
  return c.view();
});
register('graph/candle-wide', () => {
  const outs: string[] = [];
  for (let w = -1; w <= 7; w++) {
    const c = grCanvas(12, 9);
    graph.DrawCandlestickBottomToTopWide(c, grP(5, 8), w, 0.3, 1.4, 4.6, 6.2, grRed);
    outs.push(c.view());
  }
  return grJoin(...outs);
});
register('graph/candle-wide-overlap-clip', () => {
  const c = grCanvas(14, 9);
  graph.DrawCandlestickBottomToTopWide(c, grP(0, 8), 5, 0, 1, 4, 6, grRed);
  graph.DrawCandlestickBottomToTopWide(c, grP(13, 8), 4, 0.5, 2.5, 5.5, 7.5, grGreen);
  graph.DrawCandlestickBottomToTopWide(c, grP(5, 8), 3, 0, 2, 4, 6, grBlue);
  graph.DrawCandlestickBottomToTopWide(c, grP(7, 8), 3, 1, 3, 5, 8, grYellow);
  graph.DrawCandlestickBottomToTopWide(c, grP(6, 8), 1, 2, 3, 3, 4, grHex);
  return c.view();
});
register('graph/candle-block-basic', () => {
  const c = grCanvas(24, 11);
  candles.forEach((cd, i) => {
    graph.DrawCandlestickBlockBottomToTop(c, grP(1 + i * 2, 9), cd.l, cd.bl, cd.bh, cd.h, [grRed, grGreen][i % 2]);
  });
  graph.DrawCandlestickBlockBottomToTop(c, grP(30, 9), 1, 2, 3, 4, grRed);
  graph.DrawCandlestickBlockBottomToTop(c, grP(22, 3), 0, 1, 3, 4, grRed);
  return c.view();
});
const fractionGrid = (draw: (c: Model, x: number, l: number, bl: number, bh: number, h: number) => void): string => {
  const c = grCanvas(18, 14);
  const fr = [0, 0.25, 0.5, 0.75];
  let n = 0;
  for (const fl of fr) {
    for (const fh of fr) {
      draw(c, 1 + n, 0.3 + fl, 2 + fl, 7 + fh, 9.5 + fh);
      n++;
    }
  }
  return c.view();
};
register('graph/candle-block-fractions', () =>
  fractionGrid((c, x, l, bl, bh, h) => graph.DrawCandlestickBlockBottomToTop(c, grP(x, 12), l, bl, bh, h, grBlue)),
);
register('graph/candle-fractions-line', () =>
  fractionGrid((c, x, l, bl, bh, h) => graph.DrawCandlestickBottomToTop(c, grP(x, 12), l, bl, bh, h, grBlue)),
);
register('graph/candle-block-degenerate', () => {
  const c = grCanvas(16, 8);
  graph.DrawCandlestickBlockBottomToTop(c, grP(1, 7), 1, 1.2, 1.8, 2, grRed);
  graph.DrawCandlestickBlockBottomToTop(c, grP(3, 7), 2, 2, 2, 2, grGreen);
  graph.DrawCandlestickBlockBottomToTop(c, grP(5, 7), 0, 0, 5, 5, grBlue);
  graph.DrawCandlestickBlockBottomToTop(c, grP(7, 7), 0, 3, 3, 6, grRed);
  graph.DrawCandlestickBlockBottomToTop(c, grP(9, 7), 1.5, 1.5, 1.6, 1.6, grGreen);
  graph.DrawCandlestickBlockBottomToTop(c, grP(11, 7), 3, 3.2, 4.8, 3, grHex);
  graph.DrawCandlestickBlockBottomToTop(c, grP(13, 7), 0, 1, 2, 3, grBoldBg);
  graph.DrawCandlestickBlockBottomToTop(c, grP(15, 7), 0, 1, 2, 3, grBlue);
  graph.DrawCandlestickBlockBottomToTop(c, grP(-1, 7), 0, 1, 2, 3, grBlue);
  graph.DrawCandlestickBlockBottomToTop(c, grP(2, 9), 2, 3, 5, 9, grBlue);
  return c.view();
});
register('graph/candle-block-over-line', () => {
  const c = grCanvas(8, 10);
  graph.DrawCandlestickBottomToTop(c, grP(1, 9), 0, 1, 5, 7, grRed);
  graph.DrawCandlestickBlockBottomToTop(c, grP(1, 9), 2, 3, 4, 8, grBlue);
  graph.DrawCandlestickBlockBottomToTop(c, grP(4, 9), 0, 1, 5, 7, grBlue);
  graph.DrawCandlestickBottomToTop(c, grP(4, 9), 2, 3, 4, 8, grRed);
  return c.view();
});
register('graph/candle-rune', () => {
  const c = grCanvas(10, 3);
  const all = [
    runes.LineVertical, runes.LineVerticalHeavy, runes.LineUp, runes.LineDown,
    runes.LineUpHeavy, runes.LineDownHeavy, runes.LineUpDownHeavy, runes.LineUpHeavyDown,
  ];
  all.forEach((r, i) => {
    graph.DrawCandlestickRune(c, grP(i, 0), r, grRed);
    graph.DrawCandlestickRune(c, grP(i, 0), all[(i * 3 + 1) % 8], grBlue);
  });
  graph.DrawCandlestickRune(c, grP(0, 1), runes.Null, grRed);
  graph.DrawCandlestickRune(c, grP(1, 1), 'x', grRed);
  graph.DrawCandlestickRune(c, grP(2, 1), runes.LineHorizontal, grRed);
  c.setRune(grP(3, 1), 'x');
  graph.DrawCandlestickRune(c, grP(3, 1), runes.LineUp, grRed);
  c.setRune(grP(4, 1), runes.LineHorizontal);
  graph.DrawCandlestickRune(c, grP(4, 1), runes.LineVerticalHeavy, grBlue);
  graph.DrawCandlestickRune(c, grP(20, 1), runes.LineUp, grRed);
  return c.view();
});
register('graph/line-rune', () => {
  const c = grCanvas(18, 6);
  const all = [
    runes.LineHorizontal, runes.LineVertical, runes.LineDownRight, runes.LineDownLeft, runes.LineUpRight, runes.LineUpLeft,
    runes.LineVerticalRight, runes.LineVerticalLeft, runes.LineHorizontalUp, runes.LineHorizontalDown, runes.LineHorizontalVertical,
    runes.LineLeft, runes.LineUp, runes.LineRight, runes.LineDown, runes.ArcDownRight, runes.ArcDownLeft, runes.ArcUpLeft,
  ];
  all.forEach((r, i) => {
    graph.DrawLineRune(c, grP(i, 0), r, runes.ThinLineStyle, grRed);
    graph.DrawLineRune(c, grP(i, 1), r, runes.ArcLineStyle, grGreen);
    graph.DrawLineRune(c, grP(i, 2), r, runes.ThinLineStyle, grRed);
    graph.DrawLineRune(c, grP(i, 2), all[(i + 5) % all.length], runes.ThinLineStyle, grBlue);
    graph.DrawLineRune(c, grP(i, 3), r, runes.ArcLineStyle, grRed);
    graph.DrawLineRune(c, grP(i, 3), all[(i + 7) % all.length], runes.ArcLineStyle, grBlue);
    graph.DrawLineRune(c, grP(i, 4), r, runes.ThinLineStyle, grRed);
    graph.DrawLineRune(c, grP(i, 4), all[(i + 3) % all.length], runes.ArcLineStyle, grBlue);
  });
  graph.DrawLineRune(c, grP(0, 5), runes.Null, runes.ThinLineStyle, grRed);
  graph.DrawLineRune(c, grP(1, 5), 'x', runes.ThinLineStyle, grRed);
  graph.DrawLineRune(c, grP(2, 5), runes.LineUpHeavy, runes.ThinLineStyle, grRed);
  graph.DrawLineRune(c, grP(3, 5), runes.FullBlock, runes.ArcLineStyle, grRed);
  c.setRune(grP(4, 5), 'x');
  graph.DrawLineRune(c, grP(4, 5), runes.LineHorizontal, runes.ThinLineStyle, grRed);
  c.setRune(grP(5, 5), runes.LineVertical);
  graph.DrawLineRune(c, grP(5, 5), 'x', runes.ThinLineStyle, grRed);
  graph.DrawLineRune(c, grP(40, 5), runes.LineHorizontal, runes.ThinLineStyle, grRed);
  return c.view();
});

// ---- runes tables ----------------------------------------------------------------------------------------
register('runes/lower-left-block-from-float', () => {
  let s = '';
  const vals = [-0.5, 0, 0.0624, 0.0625, 0.0626, 0.9999, 1, 1.5, 0.125, 0.1875, 0.18749, 0.4375, 0.4374, 0.9375, 0.93749, 0.9374];
  for (let i = 0; i <= 70; i++) vals.push(i / 64.0, i * 0.017);
  for (const f of vals) {
    s += `${f}:${runes.codePoint(runes.LowerBlockElementFromFloat64(f))},${runes.codePoint(runes.LeftBlockElementFromFloat64(f))}\n`;
  }
  return s;
});
register('runes/inverse-and-predicates', () => {
  let s = '';
  for (let c = 0x2578; c <= 0x2592; c++) {
    const r = runes.fromCodePoint(c);
    s += `${c.toString(16)}:${b2i(runes.IsLowerBlockElement(r))}${b2i(runes.IsLeftBlockElement(r))}${b2i(runes.IsLine(r))}${b2i(runes.IsCandlestick(r))}${b2i(runes.IsBraillePattern(r))}${0}${0},${hex(runes.InverseLowerBlockElement(r))},${hex(runes.InverseLeftBlockElement(r))}\n`;
  }
  for (const c of [0, 0x78, 0x27ff, 0x2800, 0x2801, 0x28ff, 0x2900, 0x2500, 0x253c, 0x253d, 0x256c, 0x256d, 0x2570, 0x2571, 0x2574, 0x2577, 0x2578]) {
    const r = runes.fromCodePoint(c);
    s += `${c.toString(16)}:${b2i(runes.IsLowerBlockElement(r))}${b2i(runes.IsLeftBlockElement(r))}${b2i(runes.IsLine(r))}${b2i(runes.IsCandlestick(r))}${b2i(runes.IsBraillePattern(r))},${hex(runes.InverseLowerBlockElement(r))},${hex(runes.InverseLeftBlockElement(r))}\n`;
  }
  return s;
});
register('runes/quadrant-blocks', () => {
  let s = '';
  for (let i = 0; i < 16; i++) s += `${i}:${hex(runes.QuadrantBlock((i & 8) !== 0, (i & 4) !== 0, (i & 2) !== 0, (i & 1) !== 0))} `;
  return s;
});
register('runes/braille-patterns', () => {
  let s = '';
  for (let i = 0; i < 256; i++) {
    const r = runes.fromCodePoint(0x2800 + i);
    const d = runes.NewPatternDots();
    runes.SetPatternDots(r, d);
    const back = runes.BraillePatternFromPatternDots(d);
    s += `${hex(r)}:${goBools(d)}:${hex(back)}:${hex(runes.CombineBraillePatterns(r, runes.fromCodePoint(0x2800 + (255 - i))))}:${hex(runes.CombineBraillePatterns(r, runes.fromCodePoint(0x2800 + ((i * 7) % 256))))}\n`;
  }
  s += `${hex(runes.CombineBraillePatterns('a', '⠁'))} ${hex(runes.CombineBraillePatterns('⠁', 'b'))} ${hex(runes.CombineBraillePatterns('a', 'b'))}\n`;
  const d = runes.NewPatternDots();
  runes.SetPatternDots('x', d);
  s += `${goBools(d)}\n`;
  return s;
});
register('runes/pattern-dots-grid', () => {
  let s = '';
  for (const [w, h] of [[4, 4], [5, 5], [3, 7], [1, 1], [2, 8], [0, 0]]) {
    const g = runes.NewPatternDotsGrid(w, h);
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        // Go's % keeps the sign of the dividend, like JavaScript's.
        if ((x * 3 + y * 5) % 3 !== 0) g.set(x, y);
      }
    }
    g.unset(0, 0);
    g.unset(-5, 40);
    s += `${w}x${h}:`;
    for (const row of g.braillePatterns()) s += row.join('') + '|';
    g.reset();
    s += ` reset:${g.braillePatterns().length}\n`;
  }
  return s;
});
register('runes/combine-lines', () => {
  let s = '';
  const all = [
    runes.Null, 'x', runes.LineHorizontal, runes.LineVertical, runes.LineDownRight, runes.LineDownLeft, runes.LineUpRight, runes.LineUpLeft,
    runes.LineVerticalRight, runes.LineVerticalLeft, runes.LineHorizontalUp, runes.LineHorizontalDown, runes.LineHorizontalVertical,
    runes.LineLeft, runes.LineUp, runes.LineRight, runes.LineDown, runes.ArcDownRight, runes.ArcDownLeft, runes.ArcUpLeft, runes.ArcUpRight,
    runes.LineVerticalHeavy, runes.LineUpHeavy,
  ];
  for (const ls of [runes.ThinLineStyle, runes.ArcLineStyle]) {
    for (const a of all) {
      for (const b of all) s += `${hex(runes.CombineLines(a, b, ls))} `;
      s += '\n';
    }
  }
  s += `${hex(runes.CombineLines(runes.LineHorizontal, runes.LineVertical, 7 as runes.LineStyle))}\n`;
  return s;
});
register('runes/line-segments', () => {
  let s = '';
  for (let i = 0; i < 16; i++) {
    const l = { up: (i & 8) !== 0, down: (i & 4) !== 0, left: (i & 2) !== 0, right: (i & 1) !== 0 };
    s += `${i}:${hex(runes.ArcLineFromLineSegments(l))},${hex(runes.ThinLineFromLineSegments(l))}\n`;
  }
  for (const r of [runes.LineHorizontal, runes.LineVerticalHeavy, runes.ArcUpLeft, runes.LineUpRight, runes.LineHorizontalDown, runes.LineLeft, 'x']) {
    const l = runes.NewLineSegments();
    runes.SetLineSegments(r, l);
    s += `${hex(r)}:${goSegs(l)}\n`;
  }
  return s;
});
register('runes/candlesticks', () => {
  let s = '';
  const all = [
    runes.Null, 'x', runes.LineHorizontal, runes.LineVertical, runes.LineVerticalHeavy, runes.LineUp, runes.LineDown, runes.LineUpHeavy,
    runes.LineDownHeavy, runes.LineUpDownHeavy, runes.LineUpHeavyDown,
  ];
  for (const a of all) {
    for (const b of all) s += `${hex(runes.CombineCandlesticks(a, b))} `;
    s += '\n';
  }
  for (let i = 0; i < 16; i++) {
    const c = { up: (i & 8) !== 0, down: (i & 4) !== 0, upHeavy: (i & 2) !== 0, downHeavy: (i & 1) !== 0 };
    s += `${hex(runes.CandlestickFromCandlestickSegments(c))} `;
  }
  return s;
});
