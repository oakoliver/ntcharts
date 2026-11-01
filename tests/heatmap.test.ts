// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.
//
// Port of heatmap/heatmap_test.go.
import { describe, expect, test } from 'bun:test';
import type { Color } from '@oakoliver/lipgloss';
import {
  New,
  NewHeatPoint,
  NewHeatPointInt,
  WithCellSize,
  WithColorScale,
  WithValueRange,
  WithXLabels,
  WithYLabels,
  type HeatPoint,
  type Model,
  type Option,
} from '../src/heatmap/index.js';

// a 24-step ramp so each distinct value in the tests below (at most 24 cells,
// value 0..cols*rows) lands on its own colour
const testScale: Color[] = Array.from({ length: 24 }, (_, i) => `#${(i * 10).toString(16).padStart(2, '0')}0000`);

// bg returns the background colour of a canvas cell, or null if it has none
// (lipgloss reports an unset background as NoColor, not nil).
function bg(m: Model, x: number, y: number): Color | null {
  const c = m.canvas.cell({ x, y }).style.getBackground();
  if (c == null || typeof c === 'symbol') return null;
  return c;
}

// rowText returns the runes drawn on canvas row y, with unset cells as spaces.
function rowText(m: Model, y: number): string {
  let b = '';
  for (let x = 0; x < m.width(); x++) {
    let r = m.canvas.cell({ x, y }).rune;
    if (r === '\u0000') r = ' ';
    b += r;
  }
  return b;
}

// grid fills a cols x rows index grid whose value is x+y*cols, Y up.
function grid(cols: number, rows: number): HeatPoint[] {
  const pts: HeatPoint[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) pts.push(NewHeatPointInt(x, y, x + y * cols));
  return pts;
}

function gridModel(w: number, h: number, cols: number, rows: number, ...opts: Option[]): Model {
  const all: Option[] = [WithColorScale(testScale), WithValueRange(0, cols * rows), WithCellSize(1, 1), ...opts];
  const m = New(w, h, ...all);
  // expected range first, then the displayed range (a SetView*Range outside the expected one fails)
  m.setXYRange(-0.5, cols - 0.5, -0.5, rows - 0.5);
  m.setViewXYRange(-0.5, cols - 0.5, -0.5, rows - 0.5);
  m.pushAll(grid(cols, rows));
  m.draw();
  return m;
}

// private upstream too (the Go tests live in the same package)
const graphBox = (m: Model): { left: number; bottom: number } => m['graphBox']();
const cellSpans = (m: Model, x: number, y: number, w: number, h: number) => m['cellSpans'](x, y, w, h);

describe('heatmap', () => {
  // Without a cell size each point is a single canvas cell, as before.
  test('TestPointsStaySingleCellsWithoutCellSize', () => {
    const m = New(40, 12, WithColorScale(testScale), WithValueRange(0, 20));
    m.pushAll(grid(5, 4));
    m.draw();
    let coloured = 0;
    for (let y = 0; y < m.height(); y++) for (let x = 0; x < m.width(); x++) if (bg(m, x, y) !== null) coloured++;
    expect(coloured).toBe(20); // exactly one per point
  });

  // With a cell size the cells tile the graph area: no gaps inside it,
  // nothing outside it, and every canvas cell of a block shares its colour.
  test('TestCellSizeTilesTheGraph', () => {
    const m = gridModel(40, 12, 5, 4);
    let left = m.origin().x + 1;
    if (m.yStep() === 0) left = m.origin().x;
    const bottom = m.origin().y - 1;
    const top = bottom - m.graphHeight() + 1;
    for (let y = 0; y < m.height(); y++) {
      for (let x = 0; x < m.width(); x++) {
        const inside = x >= left && x < left + m.graphWidth() && y >= top && y <= bottom;
        const got = bg(m, x, y) !== null;
        if (got !== inside) {
          throw new Error(`cell (${x},${y}): coloured=${got}, want ${inside} (graph x ${left}..${left + m.graphWidth() - 1}, y ${top}..${bottom})`);
        }
      }
    }
    // five columns across graphWidth cells: block widths differ by at most one
    const widths = new Map<number, number>();
    let run = 1;
    for (let x = left + 1; x <= left + m.graphWidth(); x++) {
      if (x < left + m.graphWidth() && bg(m, x, bottom) === bg(m, x - 1, bottom)) {
        run++;
        continue;
      }
      widths.set(run, (widths.get(run) ?? 0) + 1);
      run = 1;
    }
    let total = 0;
    const lo = Math.trunc(m.graphWidth() / 5);
    for (const [w, n] of widths) {
      total += n;
      expect(w >= lo && w <= lo + 1).toBe(true); // block width outside lo..lo+1
    }
    expect(total).toBe(5); // blocks across the bottom row
  });

  // Y=0 is the bottom row of blocks, X=0 the left column.
  test('TestCellOrientation', () => {
    const m = gridModel(40, 12, 5, 4);
    const left = m.origin().x + 1;
    const bottom = m.origin().y - 1;
    const top = bottom - m.graphHeight() + 1;
    const right = left + m.graphWidth() - 1;
    // values: (0,0)=0 lowest -> first colour; (4,3)=19 highest -> int(19/20*24) = 22
    expect(bg(m, left, bottom)).toBe(testScale[0]);
    expect(bg(m, right, top)).toBe(testScale[22]);
  });

  test('TestYLabelsAreCentredOnTheirRowsAndSizeTheMargin', () => {
    const m = gridModel(40, 12, 3, 3, WithYLabels(['Mon', 'Tuesday', 'Wed']));
    // the margin is the longest label
    expect(m.origin().x).toBe('Tuesday'.length);
    const { bottom } = graphBox(m);
    ['Mon', 'Tuesday', 'Wed'].forEach((label, i) => {
      // Y=i counts up from the bottom; the label sits on a row of its own block
      const { r0, r1 } = cellSpans(m, 0, i, 1, 1);
      let found = false;
      for (let r = r0; r < r1; r++) {
        const line = rowText(m, bottom - r);
        const want = ' '.repeat(m.origin().x - label.length) + label;
        if (line.startsWith(want)) found = true;
      }
      expect([label, found]).toEqual([label, true]); // drawn right-aligned in its block
    });
  });

  test('TestXLabelsSitUnderTheirColumns', () => {
    const m = gridModel(40, 12, 3, 2, WithXLabels(['09', '12', '15']));
    const { left, bottom } = graphBox(m);
    const line = rowText(m, bottom + 1);
    ['09', '12', '15'].forEach((label, i) => {
      const { c0 } = cellSpans(m, i, 0, 1, 1);
      expect(line.slice(left + c0, left + c0 + label.length)).toBe(label);
    });
  });

  // More categories than rows: labels that would share a row are dropped, never overdrawn.
  test('TestDenseYLabelsDoNotCollide', () => {
    const labels: string[] = [];
    for (let i = 0; i < 30; i++) labels.push(String.fromCharCode('a'.charCodeAt(0) + (i % 26)) + String.fromCharCode('0'.charCodeAt(0) + Math.trunc(i / 26)));
    const m = gridModel(30, 8, 3, 30, WithYLabels(labels));
    let seen = 0;
    for (let y = 0; y < m.height(); y++) {
      if (rowText(m, y).slice(0, m.origin().x).trim() !== '') seen++;
    }
    expect(seen).toBeGreaterThan(0);
    expect(seen).toBeLessThanOrEqual(m.graphHeight());
  });

  test('TestLabelsDefineTheGridRange', () => {
    const m = New(40, 12, WithXLabels(['a', 'b', 'c', 'd']), WithYLabels(['p', 'q']));
    expect([m.viewMinX(), m.viewMaxX()]).toEqual([-0.5, 3.5]);
    expect([m.viewMinY(), m.viewMaxY()]).toEqual([-0.5, 1.5]);
  });

  test('TestFilledCellsOutsideViewAreNotDrawn', () => {
    for (const pt of [
      NewHeatPoint(-100, 1, 1),
      NewHeatPoint(100, 1, 1),
      NewHeatPoint(1, -100, 1),
      NewHeatPoint(1, 100, 1),
      NewHeatPoint(-1, 1, 1),
      NewHeatPoint(3, 1, 1),
    ]) {
      const m = New(20, 8, WithCellSize(1, 1), WithColorScale(testScale), WithValueRange(0, 1), WithXLabels(['A', 'B', 'C']), WithYLabels(['a', 'b', 'c']));
      m.drawPoint(pt);
      for (let y = 0; y < m.height(); y++) {
        for (let x = 0; x < m.width(); x++) {
          if (bg(m, x, y) !== null) throw new Error(`offscreen point ${JSON.stringify(pt)} painted cell (${x},${y})`);
        }
      }
    }
  });

  test('TestPartiallyVisibleFilledCellIsClipped', () => {
    const m = New(20, 8, WithCellSize(1, 1), WithColorScale(testScale), WithValueRange(0, 1), WithXLabels(['A', 'B', 'C']), WithYLabels(['a', 'b', 'c']));
    m.drawPoint(NewHeatPoint(-0.75, 1, 1));
    const { left, bottom } = graphBox(m);
    let coloured = 0;
    for (let y = 0; y < m.height(); y++) {
      for (let x = 0; x < m.width(); x++) {
        if (bg(m, x, y) === null) continue;
        coloured++;
        // A quarter data unit remains visible: at this chart size it
        // rounds to the first two canvas columns.
        if (x < left || x >= left + 2 || y > bottom || y <= bottom - m.graphHeight()) {
          throw new Error(`partially visible cell painted outside its clipped columns: (${x},${y})`);
        }
      }
    }
    expect(coloured).toBeGreaterThan(0); // partially visible cell was discarded
  });

  test('TestShortHeatmapReservesLongestRowLabel', () => {
    const m = New(30, 12, WithCellSize(1, 1), WithXLabels(['A']), WithYLabels(['a', 'Tuesday', 'c']));
    m.resize(30, 5);
    m.draw();
    expect(m.origin().x).toBe('Tuesday'.length);
    expect(rowText(m, 1)).toContain('Tuesday'); // middle row label
  });
});
