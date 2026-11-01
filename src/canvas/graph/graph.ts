// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * Package graph contains data structures and functions to help draw runes on to a canvas.
 *
 * https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
 * https://en.wikipedia.org/wiki/Midpoint_circle_algorithm
 */

import type { Style } from '@oakoliver/lipgloss';
import {
  CanvasPointFromFloat64Point,
  NewCellWithStyle,
  PointAdd,
  goInt,
  type Float64Point,
  type Model,
  type Point,
} from '../canvas.js';
import * as runes from '../runes/runes.js';
import type { LineSegments, LineStyle, Rune } from '../runes/runes.js';

/**
 * DefaultMaxPoints is the global sanity limit for point interpolation.
 * It is set high enough to cover massive terminals but low enough to
 * prevent OOM crashes on scaling errors or malformed data.
 * Apps may override it with SetDefaultMaxPoints before constructing models.
 */
export let DefaultMaxPoints = 10000;

/** Overrides DefaultMaxPoints (ES module exports cannot be assigned from outside). */
export function SetDefaultMaxPoints(n: number): void {
  DefaultMaxPoints = n;
}

/**
 * BrailleGrid wraps a runes.PatternDotsGrid to implement a 2D grid with
 * (X, Y) floating point coordinates used to display Braille Pattern runes.
 * Since Braille Pattern runes are 4 high and 2 wide, the BrailleGrid will
 * internally scale the width and height sizes to match those patterns.
 * BrailleGrid uses canvas coordinates system with (0,0) being top left.
 */
export class BrailleGrid {
  private cWidth: number; // canvas width
  private cHeight: number; // canvas height

  private minX: number;
  private maxX: number;
  private minY: number;
  private maxY: number;

  private gWidth: number; // grid width
  private gHeight: number; // grid height
  private grid: runes.PatternDotsGrid;

  constructor(w: number, h: number, minX: number, maxX: number, minY: number, maxY: number) {
    const gridW = w * 2;
    const gridH = h * 4;
    this.cWidth = w;
    this.cHeight = h;
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
    this.gWidth = gridW;
    this.gHeight = gridH;
    this.grid = runes.NewPatternDotsGrid(gridW, gridH);
    this.clear();
  }

  /** Clear will reset the internal grid. */
  clear(): void {
    this.grid.reset();
  }

  /**
   * GridPoint returns a canvas Point representing a point in the braille grid
   * in the canvas coordinates system from a Float64Point data point
   * in the Cartesian coordinates system.
   */
  gridPoint(f: Float64Point): Point {
    const sf = { x: 0, y: 0 };
    const dx = this.maxX - this.minX;
    const dy = this.maxY - this.minY;
    if (dx > 0) {
      const xs = (this.gWidth - 1) / dx;
      sf.x = (f.x - this.minX) * xs;
    }
    if (dy > 0) {
      const ys = (this.gHeight - 1) / dy;
      sf.y = (f.y - this.minY) * ys;
    }
    return CanvasPointFromFloat64Point({ x: 0, y: this.gHeight - 1 }, sf);
  }

  /** Set will set point on grid from given canvas Point. */
  set(p: Point): void {
    this.grid.set(p.x, p.y);
  }

  /** BraillePatterns returns Rune[][] containing braille pattern runes to draw on to the canvas. */
  braillePatterns(): Rune[][] {
    return this.grid.braillePatterns();
  }
}

/**
 * NewBrailleGrid returns a new initialized BrailleGrid with given canvas width,
 * canvas height and minimums and maximums X and Y values of the data points.
 */
export function NewBrailleGrid(w: number, h: number, minX: number, maxX: number, minY: number, maxY: number): BrailleGrid {
  return new BrailleGrid(w, h, minX, maxX, minY, maxY);
}

/**
 * DrawVerticalLineUp draws a vertical line going up starting from (X,Y) coordinates.
 * Applies given style to all runes. Coordinates (0,0) is top left of canvas.
 */
export function DrawVerticalLineUp(m: Model, p: Point, s: Style): void {
  const x = p.x;
  const r = NewCellWithStyle(runes.LineVertical, s);
  for (let i = p.y; i >= 0; i--) m.setCell({ x, y: i }, r);
}

/**
 * DrawVerticalLineDown draws a vertical line going down starting from (X,Y) coordinates.
 * Applies given style to all runes. Coordinates (0,0) is top left of canvas.
 */
export function DrawVerticalLineDown(m: Model, p: Point, s: Style): void {
  const x = p.x;
  const r = NewCellWithStyle(runes.LineVertical, s);
  for (let i = p.y; i < m.height(); i++) m.setCell({ x, y: i }, r);
}

/**
 * DrawHorizonalLineLeft draws a horizontal line going to the left starting from (X,Y) coordinates.
 * Applies given style to all runes. Coordinates (0,0) is top left of canvas.
 * (The misspelling is upstream's, kept for API parity.)
 */
export function DrawHorizonalLineLeft(m: Model, p: Point, s: Style): void {
  const y = p.y;
  const r = NewCellWithStyle(runes.LineHorizontal, s);
  for (let i = p.x; i >= 0; i--) m.setCell({ x: i, y }, r);
}

/**
 * DrawHorizonalLineRight draws a horizontal line going to the right starting from (X,Y) coordinates.
 * Applies given style to all runes. Coordinates (0,0) is top left of canvas.
 */
export function DrawHorizonalLineRight(m: Model, p: Point, s: Style): void {
  const y = p.y;
  const r = NewCellWithStyle(runes.LineHorizontal, s);
  for (let i = p.x; i < m.width(); i++) m.setCell({ x: i, y }, r);
}

/**
 * DrawXYAxis draws X and Y axes with origin at (X,Y) coordinates with given style.
 * Y axis extends up, and X axis extends right.
 */
export function DrawXYAxis(m: Model, p: Point, s: Style): void {
  m.setCell(p, NewCellWithStyle(runes.LineUpRight, s));
  DrawVerticalLineUp(m, { x: p.x, y: p.y - 1 }, s);
  DrawHorizonalLineRight(m, { x: p.x + 1, y: p.y }, s);
}

/**
 * DrawXYAxisDown draws X and Y axes with origin at (X,Y) coordinates with given style.
 * Y axis extends up and down, and X axis extends right.
 */
export function DrawXYAxisDown(m: Model, p: Point, s: Style): void {
  m.setCell(p, NewCellWithStyle(runes.LineVerticalRight, s));
  DrawVerticalLineUp(m, { x: p.x, y: p.y - 1 }, s);
  DrawVerticalLineDown(m, { x: p.x, y: p.y + 1 }, s);
  DrawHorizonalLineRight(m, { x: p.x + 1, y: p.y }, s);
}

/**
 * DrawXYAxisLeft draws X and Y axes with origin at (X,Y) coordinates with given style.
 * Y axis extends up, and X axis extends left and right.
 */
export function DrawXYAxisLeft(m: Model, p: Point, s: Style): void {
  m.setCell(p, NewCellWithStyle(runes.LineHorizontalUp, s));
  DrawVerticalLineUp(m, { x: p.x, y: p.y - 1 }, s);
  DrawHorizonalLineRight(m, { x: p.x + 1, y: p.y }, s);
  DrawHorizonalLineLeft(m, { x: p.x - 1, y: p.y }, s);
}

/**
 * DrawXYAxisAll draws X and Y axes with origin at (X,Y) coordinates with given style.
 * Y axis extends up and down, and X axis extends left and right.
 */
export function DrawXYAxisAll(m: Model, p: Point, s: Style): void {
  m.setCell(p, NewCellWithStyle(runes.LineHorizontalVertical, s));
  DrawVerticalLineUp(m, { x: p.x, y: p.y - 1 }, s);
  DrawVerticalLineDown(m, { x: p.x, y: p.y + 1 }, s);
  DrawHorizonalLineRight(m, { x: p.x + 1, y: p.y }, s);
  DrawHorizonalLineLeft(m, { x: p.x - 1, y: p.y }, s);
}

/**
 * DrawBrailleRune draws a braille rune on to the canvas at given (X,Y) coordinates with given style.
 * The function checks for existing braille runes already on the canvas and
 * will draw a new braille pattern with the dot patterns of both the existing and given runes.
 * Does nothing if given rune is Null or is not a braille rune.
 */
export function DrawBrailleRune(m: Model, p: Point, r: Rune, s: Style): void {
  if (runes.isNull(r) || !runes.IsBraillePattern(r)) return;
  const cr = m.cell(p).rune;
  if (runes.isNull(cr)) {
    // set rune if nothing exists on canvas
    m.setCell(p, NewCellWithStyle(r, s));
    return;
  }
  m.setCell(p, NewCellWithStyle(runes.CombineBraillePatterns(cr, r), s));
}

/**
 * DrawBraillePatterns draws braille runes from a Rune[][] representing a 2D grid of
 * Braille Pattern runes. The runes will be drawn onto the canvas starting from top
 * left of the grid to the bottom right of the grid starting at the given canvas Point.
 * Given style will be applied to all runes drawn.
 * This function can be used with the output of PatternDotsGrid.braillePatterns().
 */
export function DrawBraillePatterns(m: Model, p: Point, b: Rune[][], s: Style): void {
  for (let y = 0; y < b.length; y++) {
    const row = b[y];
    for (let x = 0; x < row.length; x++) {
      const r = row[x];
      if (r !== runes.BrailleBlank) DrawBrailleRune(m, PointAdd(p, { x, y }), r, s);
    }
  }
}

/**
 * DrawLineSequence draws line runes on to the canvas starting
 * from a given X coordinate and a sequence of Y coordinates.
 * `startYAxis` should be true if `startX` is the Y axis.
 * Sequential Y coordinates will increment X coordinates.
 * Applies style to all line runes. Handles overlapping lines.
 * Handles X and Y axes drawn using DrawXYAxis functions.
 */
export function DrawLineSequence(m: Model, startYAxis: boolean, startX: number, seqY: number[], ls: LineStyle, s: Style): void {
  let prevY = 0;
  for (let i = 0; i < seqY.length; i++) {
    const y = seqY[i];
    if (i === 0) {
      // draw first point
      const p = { x: startX, y };
      const r = runes.LineHorizontal;
      if (startYAxis) {
        switch (m.cell(p).rune) {
          case runes.LineUpRight: // first point is origin
            m.setCell(p, NewCellWithStyle(runes.LineUpRight, s));
            break;
          case runes.LineVertical: // first point on Y axis
            m.setCell(p, NewCellWithStyle(runes.LineVerticalRight, s));
            break;
          case runes.LineVerticalRight: // first point on Y axis overlapping another line
            m.setCell(p, NewCellWithStyle(runes.LineVerticalRight, s));
            break;
          default:
            DrawLineRune(m, p, r, ls, s);
        }
      } else {
        DrawLineRune(m, p, r, ls, s);
      }
    } else {
      DrawLineSequenceLeftToRight(m, { x: i + startX - 1, y: prevY }, { x: i + startX, y }, ls, s);
    }
    prevY = y;
  }
}

/**
 * DrawLineSequenceLeftToRight draws line runes from point A to point B where B.X = A.X+1.
 * Assumes point A has already been drawn and does not draw point A.
 * Applies style to all line runes. Handles overlapping lines.
 * Handles X and Y axes drawn using DrawXYAxis functions.
 */
export function DrawLineSequenceLeftToRight(m: Model, a: Point, b: Point, ls: LineStyle, s: Style): void {
  if (a.x >= b.x) return;

  const prevY = a.y;
  const y = b.y;
  const x = b.x;
  let r = runes.LineHorizontal; // default: point A has same Y coordinate as point B

  // if not the same Y coordinates, draw vertical lines from point A to point B
  if (prevY > y) {
    // drawing line up
    r = runes.ArcDownRight;
    DrawLineRune(m, { x, y: prevY }, runes.ArcUpLeft, ls, s);
    for (let j = prevY - 1; j > y; j--) DrawLineRune(m, { x, y: j }, runes.LineVertical, ls, s);
  } else if (prevY < y) {
    // drawing line down
    r = runes.ArcUpRight;
    DrawLineRune(m, { x, y: prevY }, runes.ArcDownLeft, ls, s);
    for (let j = prevY + 1; j < y; j++) DrawLineRune(m, { x, y: j }, runes.LineVertical, ls, s);
  }

  DrawLineRune(m, b, r, ls, s);
}

/**
 * DrawLinePoints draws line runes on to the canvas from a Point[].
 * Each canvas Point is expected to be either adjacent or diagonal from each other.
 * At least two Points are required to draw any runes on to the canvas.
 * This function can be used with the Point[] output from GetLinePoints().
 */
export function DrawLinePoints(m: Model, points: Point[], ls: LineStyle, s: Style): void {
  if (points.length < 2) return;
  const extraPoints: Point[] = [];
  const extraRunes: Rune[] = []; // additional corner runes to draw
  const dir: LineSegments[] = points.map(() => runes.NewLineSegments());
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];

    if (p.x > prev.x) {
      if (p.y > prev.y) {
        // p down right of prev
        dir[i - 1].right = true;
        dir[i].up = true;
        extraPoints.push({ x: p.x, y: p.y - 1 });
        extraRunes.push(runes.ArcDownLeft);
      } else if (p.y < prev.y) {
        // p up right of prev
        dir[i - 1].right = true;
        dir[i].down = true;
        extraPoints.push({ x: p.x, y: p.y + 1 });
        extraRunes.push(runes.ArcUpLeft);
      } else {
        // p right of prev
        dir[i - 1].right = true;
        dir[i].left = true;
      }
    } else if (p.x < prev.x) {
      if (p.y > prev.y) {
        // p down left of prev
        dir[i - 1].left = true;
        dir[i].up = true;
        extraPoints.push({ x: p.x, y: p.y - 1 });
        extraRunes.push(runes.ArcDownRight);
      } else if (p.y < prev.y) {
        // p up left of prev
        dir[i - 1].left = true;
        dir[i].down = true;
        extraPoints.push({ x: p.x, y: p.y + 1 });
        extraRunes.push(runes.ArcUpRight);
      } else {
        // p left of prev
        dir[i - 1].left = true;
        dir[i].right = true;
      }
    } else {
      if (p.y > prev.y) {
        // p below prev
        dir[i - 1].down = true;
        dir[i].up = true;
      } else if (p.y < prev.y) {
        // p above prev
        dir[i - 1].up = true;
        dir[i].down = true;
      }
      // same point - do nothing
    }
  }
  for (let i = 0; i < dir.length; i++) {
    DrawLineRune(m, points[i], runes.ArcLineFromLineSegments(dir[i]), ls, s);
  }
  for (let i = 0; i < extraRunes.length; i++) {
    DrawLineRune(m, extraPoints[i], extraRunes[i], ls, s);
  }
}

/**
 * DrawLineRune draws a line rune on to the canvas at given (X,Y) coordinates with given style.
 * The given rune is used to check line directions, and the final output line rune
 * depends on the given LineStyle. The function checks for existing X,Y axis or line runes
 * already on the canvas and draws runes such that the lines appear overlapping.
 * Does nothing if given rune is empty or is not a line rune.
 */
export function DrawLineRune(m: Model, p: Point, r: Rune, ls: LineStyle, s: Style): void {
  if (runes.isNull(r) || !runes.IsLine(r)) return;
  m.setCell(p, NewCellWithStyle(runes.CombineLines(m.cell(p).rune, r, ls), s));
}

/**
 * DrawColumns draws columns going upwards on to canvas starting from a given
 * (X,Y) coordinate and a sequence of column lengths. Columns will be drawn from
 * left to right and sequential column lengths will increment X coordinates.
 * Handles overlapping columns of different rune heights.
 */
export function DrawColumns(m: Model, p: Point, seqLen: number[], s: Style): void {
  const y = p.y;
  const x = p.x;
  for (let i = 0; i < seqLen.length; i++) DrawColumnBottomToTop(m, { x: x + i, y }, seqLen[i], s);
}

/**
 * DrawColumnBottomToTop draws block element runes going up from given point.
 * The value is the number of characters to draw going up.
 * A fractional value is used since there are 1/8th lower block elements and
 * fractional values will map to the nearest 1/8th block for the last rune drawn.
 * Handles overlapping columns of different rune heights.
 * If there exists an existing column at given Point with same height as new column,
 * then the existing column will be replaced.
 */
export function DrawColumnBottomToTop(m: Model, p: Point, v: number, s: Style): void {
  if (!(v > 0)) return;
  const x = p.x;
  const y = p.y;

  const h = getColumnHeight(m, p); // height of existing column on canvas
  const n = Math.floor(v); // number of full blocks to show
  let nh = goInt(n); // height of new column to draw on canvas

  const r = runes.LowerBlockElementFromFloat64(v - n);
  if (r !== runes.Null) nh++;

  const fb = NewCellWithStyle(runes.FullBlock, s);
  const end = goInt(n);
  if (h === 0 || nh === h) {
    // replace entire column if same height or no existing column
    for (let i = 0; i < end; i++) m.setCell({ x, y: y - i }, fb);
    // set column top rune
    DrawColumnRune(m, { x, y: y - end }, r, s);
  } else if (nh < h) {
    // new column shorter than old column: replace existing full blocks with new full blocks
    for (let i = 0; i < end; i++) m.setCell({ x, y: y - i }, fb);
    // overlap new column top rune on top of old full block
    DrawColumnRune(m, { x, y: y - end }, r, s);
  } else if (nh > h) {
    // new column taller than old column
    let oc = h - 1; // index of existing column top
    if (oc <= 0) oc = 0;
    // overlap existing column top rune on top of new full block
    DrawColumnRune(m, { x, y: y - oc }, runes.FullBlock, s);
    // draw new full blocks above existing columns
    for (let i = h; i < end; i++) m.setCell({ x, y: y - i }, fb);
    // set new column top rune
    m.setCell({ x, y: y - end }, NewCellWithStyle(r, s));
  }
}

/**
 * DrawColumnTopToBottom draws block element runes going down from given point,
 * for bars that extend below an axis. Full blocks are drawn for the integer part.
 * The fractional part is drawn in the last cell as the inverse lower block
 * element in reverse video, so the bar color fills the top of that cell.
 * If that last cell already holds a full block from a longer column drawn
 * earlier (stacked segments), the two foreground colors are combined
 * instead: the new color fills the top and the existing color the bottom.
 * If both segments end in the same fractional cell, its total extent is
 * preserved using the larger segment's color (the new segment wins ties).
 */
export function DrawColumnTopToBottom(m: Model, p: Point, v: number, s: Style): void {
  if (!(v > 0)) return;
  const n = Math.floor(v);
  const fb = NewCellWithStyle(runes.FullBlock, s);
  const end = goInt(n);
  for (let i = 0; i < end; i++) m.setCell({ x: p.x, y: p.y + i }, fb);
  const r = runes.LowerBlockElementFromFloat64(v - n);
  if (r === runes.Null) return;
  const last = { x: p.x, y: p.y + end };
  if (r === runes.FullBlock) {
    m.setCell(last, fb);
    return;
  }
  drawInverseEndRune(m, last, runes.InverseLowerBlockElement(r), s);
}

/**
 * DrawRowRightToLeft draws block element runes going left from given point,
 * for bars that extend left of an axis. Full blocks are drawn for the integer part.
 * The fractional part is drawn in the last cell as the inverse left block
 * element in reverse video, so the bar color fills the right of that cell.
 * Stacked segments are combined as in DrawColumnTopToBottom.
 */
export function DrawRowRightToLeft(m: Model, p: Point, v: number, s: Style): void {
  if (!(v > 0)) return;
  const n = Math.floor(v);
  const fb = NewCellWithStyle(runes.FullBlock, s);
  const end = goInt(n);
  for (let i = 0; i < end; i++) m.setCell({ x: p.x - i, y: p.y }, fb);
  const r = runes.LeftBlockElementFromFloat64(v - n);
  if (r === runes.Null) return;
  const last = { x: p.x - end, y: p.y };
  if (r === runes.FullBlock) {
    m.setCell(last, fb);
    return;
  }
  drawInverseEndRune(m, last, runes.InverseLeftBlockElement(r), s);
}

// drawInverseEndRune draws the fractional end cell of a column or row that
// grows away from an axis in the downward or leftward direction. The rune
// is the inverse block element, so its glyph covers the part of the cell
// that is NOT the bar. Over an existing full block the glyph takes the
// existing color and the background takes the new color; over anything
// else the glyph is drawn in reverse video so the terminal background
// shows through the glyph and the bar color fills the rest.
// When two segments and the background share a fractional cell, only two
// colors can be represented. Preserve the existing extent and use the
// segment occupying more of that extent (the new segment wins ties).
function drawInverseEndRune(m: Model, p: Point, r: Rune, s: Style): void {
  const c = m.cell(p);
  if (c.rune === runes.FullBlock) {
    const rs = s.foreground(c.style.getForeground()).background(s.getForeground());
    m.setCell(p, NewCellWithStyle(r, rs));
    return;
  }
  const sameDirection =
    (runes.IsLowerBlockElement(r) && runes.IsLowerBlockElement(c.rune)) ||
    (runes.IsLeftBlockElement(r) && runes.IsLeftBlockElement(c.rune));
  if (sameDirection) {
    if (!c.style.getReverse()) {
      // This cell already joins two segments. Retain the outer color
      // instead of replacing it with the terminal background.
      const rs = s.foreground(c.style.getForeground()).background(s.getForeground()).reverse(false);
      m.setCell(p, NewCellWithStyle(r, rs));
      return;
    }
    const full = runes.codePoint(runes.FullBlock);
    const filled = (block: Rune): number => {
      if (runes.IsLowerBlockElement(block)) return full - runes.codePoint(block);
      return runes.codePoint(block) - full;
    };
    const oldFill = filled(c.rune);
    const newFill = filled(r);
    if (newFill < oldFill) {
      if (newFill * 2 >= oldFill) m.setCell(p, NewCellWithStyle(c.rune, s.reverse(true)));
      return;
    }
  }
  m.setCell(p, NewCellWithStyle(r, s.reverse(true)));
}

/**
 * DrawColumnRune draws a column rune on to the canvas at given (X,Y) coordinates with given style.
 * The function checks for existing column runes already on the canvas and attempts to
 * draw runes such that the runes appear overlapping.
 * Does nothing if given rune is Null or is not a column rune.
 *
 * Upstream (lipgloss v2) computes a combined style for overlapping runes but
 * discards it, because lipgloss v2 setters return a new Style; the cell is
 * drawn with the given style `s`. This port keeps that behavior.
 */
export function DrawColumnRune(m: Model, p: Point, r: Rune, s: Style): void {
  if (runes.isNull(r) || !runes.IsLowerBlockElement(r)) return;
  const c = m.cell(p);
  if (runes.IsLowerBlockElement(c.rune)) {
    if (r === runes.FullBlock && c.rune !== runes.FullBlock) {
      // existing rune on top of new full block
      r = c.rune;
    }
  }
  m.setCell(p, NewCellWithStyle(r, s));
}

// getColumnHeight obtains number of runes drawn by DrawColumnBottomToTop at given Point.
function getColumnHeight(m: Model, p: Point): number {
  const x = p.x;
  const y = p.y;
  let i = 0;
  let c = m.cell({ x, y });
  while (runes.IsLowerBlockElement(c.rune)) {
    i++;
    c = m.cell({ x, y: y - i });
  }
  return i;
}

/**
 * DrawRows draws rows going right on to canvas starting from a given (X,Y)
 * coordinate and a sequence of row widths. Rows will be drawn from top to
 * bottom and sequential row widths will increment Y coordinates for drawing.
 * Handles overlapping rows of different rune widths.
 */
export function DrawRows(m: Model, p: Point, seqLen: number[], s: Style): void {
  const y = p.y;
  const x = p.x;
  for (let i = 0; i < seqLen.length; i++) DrawRowLeftToRight(m, { x, y: y + i }, seqLen[i], s);
}

/**
 * DrawRowLeftToRight draws block element runes going right from given point.
 * The value is the number of characters to draw going right.
 * A fractional value is used since there are 1/8th left block elements and
 * fractional values will map to the nearest 1/8th block for the last rune drawn.
 * Handles overlapping rows of different rune widths.
 */
export function DrawRowLeftToRight(m: Model, p: Point, v: number, s: Style): void {
  if (!(v > 0)) return;
  const x = p.x;
  const y = p.y;

  const w = getRowWidth(m, p); // width of existing row on canvas
  const n = Math.floor(v); // number of full blocks to show
  let nw = goInt(n); // width of new row to draw on canvas

  const r = runes.LeftBlockElementFromFloat64(v - n);
  if (r !== runes.Null) nw++;

  const fb = NewCellWithStyle(runes.FullBlock, s);
  const end = goInt(n);
  if (w === 0 || nw === w) {
    // replace entire row if same width or no existing row
    for (let i = 0; i < end; i++) m.setCell({ x: x + i, y }, fb);
    // set row rightmost rune
    DrawRowRune(m, { x: x + end, y }, r, s);
  } else if (nw < w) {
    // new row thinner than old row
    for (let i = 0; i < end; i++) m.setCell({ x: x + i, y }, fb);
    // overlap new row rightmost rune on top of old full block
    DrawRowRune(m, { x: x + end, y }, r, s);
  } else if (nw > w) {
    // new row wider than old row
    let oc = w - 1; // index of existing row rightmost rune
    if (oc <= 0) oc = 0;
    // overlap existing row rightmost rune on top of new full block
    DrawRowRune(m, { x: x + oc, y }, runes.FullBlock, s);
    // draw new full blocks above existing rows
    for (let i = w; i < end; i++) m.setCell({ x: x + i, y }, fb);
    // set new row rightmost rune
    m.setCell({ x: x + end, y }, NewCellWithStyle(r, s));
  }
}

/**
 * DrawRowRune draws a row rune on to the canvas at given (X,Y) coordinates with given style.
 * See DrawColumnRune for how overlapping runes are handled.
 * Does nothing if given rune is Null or is not a row rune.
 */
export function DrawRowRune(m: Model, p: Point, r: Rune, s: Style): void {
  if (runes.isNull(r) || !runes.IsLeftBlockElement(r)) return;
  const c = m.cell(p);
  if (runes.IsLeftBlockElement(c.rune)) {
    if (r === runes.FullBlock && c.rune !== runes.FullBlock) {
      // existing rune on top of new full block
      r = c.rune;
    }
  }
  m.setCell(p, NewCellWithStyle(r, s));
}

// getRowWidth obtains number of runes drawn by DrawRowLeftToRight at given Point.
function getRowWidth(m: Model, p: Point): number {
  const x = p.x;
  const y = p.y;
  let i = 0;
  let c = m.cell({ x, y });
  while (runes.IsLeftBlockElement(c.rune)) {
    i++;
    c = m.cell({ x: x + i, y });
  }
  return i;
}

/**
 * GetFullCirclePoints returns a Point[] containing points that approximate a
 * filled circle of radius r for center Point c.
 * If more than DefaultMaxPoints are produced, null is returned.
 */
export function GetFullCirclePoints(c: Point, r: number): Point[] | null {
  return GetFullCirclePointsWithLimit(c, r, DefaultMaxPoints);
}

/**
 * GetFullCirclePointsWithLimit returns a Point[] containing points that
 * approximate a filled circle of radius r for center Point c.
 * If limit is <= 0, DefaultMaxPoints is used. Returns null if limit is exceeded.
 */
export function GetFullCirclePointsWithLimit(c: Point, r: number, limit: number): Point[] | null {
  const p: Point[] = [];
  if (r <= 0) return p;
  if (limit <= 0) limit = DefaultMaxPoints;

  // Fast fail: area of a circle is approx pi * r^2.
  // Using 3 * r^2 as a conservative lower bound for the check.
  if (3 * r * r > limit) return null;

  const cPoints = GetCirclePointsWithLimit(c, r, limit);
  if (cPoints === null) return null;
  // sort points (stable sort, as Go's sort.Slice result for distinct keys)
  cPoints.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  // set all cells between first and last point of a row
  let f = cPoints[0];
  let l = cPoints[0];
  for (const v of cPoints) {
    // if new row, draw line between previous row first and last points
    if (v.y !== l.y) {
      for (let i = f.x; i < l.x; i++) {
        if (p.length >= limit) return null;
        p.push({ x: i, y: l.y });
      }
      f = v;
    }
    l = v;
    if (p.length >= limit) return null;
    p.push(v);
  }
  return p;
}

/**
 * GetCirclePoints returns a Point[] containing points that approximate a
 * circle of radius r for center Point c.
 * If more than DefaultMaxPoints are produced, null is returned.
 */
export function GetCirclePoints(c: Point, r: number): Point[] | null {
  return GetCirclePointsWithLimit(c, r, DefaultMaxPoints);
}

/**
 * GetCirclePointsWithLimit returns a Point[] containing points that
 * approximate a circle of radius r for center Point c.
 * If limit is <= 0, DefaultMaxPoints is used. Returns null if limit is exceeded.
 */
export function GetCirclePointsWithLimit(c: Point, r: number, limit: number): Point[] | null {
  const p: Point[] = [];
  if (r <= 0) return p;
  if (limit <= 0) limit = DefaultMaxPoints;

  // Fast fail: Bresenham's 8-way symmetry produces ~5.66*r points
  // (8 per iteration over ~r/sqrt(2) iterations). 4*r is a conservative
  // lower bound on the actual count.
  if (4 * r > limit) return null;

  let t1 = Math.trunc(r / 16);
  let t2 = 0;
  let x = r;
  let y = 0;
  while (x >= y) {
    if (p.length + 8 > limit) return null;
    p.push(
      PointAdd(c, { x, y }),
      PointAdd(c, { x, y: -y }),
      PointAdd(c, { x: -x, y }),
      PointAdd(c, { x: -x, y: -y }),
      PointAdd(c, { x: y, y: x }),
      PointAdd(c, { x: y, y: -x }),
      PointAdd(c, { x: -y, y: x }),
      PointAdd(c, { x: -y, y: -x }),
    );
    y++;
    t1 += y;
    t2 = t1 - x;
    if (t2 >= 0) {
      t1 = t2;
      x--;
    }
  }
  return p;
}

/**
 * GetLinePoints returns a Point[] containing points that approximate a line
 * between points p1 and p2. If more than DefaultMaxPoints are produced, null is returned.
 */
export function GetLinePoints(p1: Point, p2: Point): Point[] | null {
  return GetLinePointsWithLimit(p1, p2, DefaultMaxPoints);
}

/**
 * GetLinePointsWithLimit returns a Point[] containing points that approximate
 * a line between points p1 and p2.
 * If limit is <= 0, DefaultMaxPoints is used. Returns null if limit is exceeded.
 */
export function GetLinePointsWithLimit(p1: Point, p2: Point, limit: number): Point[] | null {
  if (limit <= 0) limit = DefaultMaxPoints;

  // Fast fail: Bresenham's line algorithm produces exactly one point
  // per unit of the longest axis.
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  let count = dx;
  if (dy > dx) count = dy;
  if (!(count + 1 <= limit)) return null;

  if (dy < dx) {
    return p1.x > p2.x ? getLinePointsLow(p2, p1) : getLinePointsLow(p1, p2);
  }
  return p1.y > p2.y ? getLinePointsHigh(p2, p1) : getLinePointsHigh(p1, p2);
}

// getLinePointsLow returns points approximating a line between p1 and p2 for slopes between -1 and 1.
function getLinePointsLow(p1: Point, p2: Point): Point[] {
  const r: Point[] = [];
  const dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  let yi = 1;
  if (dy < 0) {
    yi = -1;
    dy = -dy;
  }
  let D = 2 * dy - dx;
  let y = p1.y;

  let start = p1.x;
  let end = p2.x;
  if (start > end) {
    start = p2.x;
    end = p1.x;
  }
  for (let x = start; x <= end; x++) {
    r.push({ x, y });
    if (D > 0) {
      y += yi;
      D += 2 * (dy - dx);
    } else {
      D += 2 * dy;
    }
  }
  return r;
}

// getLinePointsHigh returns points approximating a line between p1 and p2 for slopes <= -1 or >= 1.
function getLinePointsHigh(p1: Point, p2: Point): Point[] {
  const r: Point[] = [];
  let dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let xi = 1;
  if (dx < 0) {
    xi = -1;
    dx = -dx;
  }
  let D = 2 * dx - dy;
  let x = p1.x;

  let start = p1.y;
  let end = p2.y;
  if (start > end) {
    start = p2.y;
    end = p1.y;
  }
  for (let y = start; y <= end; y++) {
    r.push({ x, y });
    if (D > 0) {
      x += xi;
      D += 2 * (dx - dy);
    } else {
      D += 2 * dx;
    }
  }
  return r;
}

/**
 * DrawCandlestickBottomToTop draws candlestick line runes going up from given point.
 * `h` and `l` are the candlestick high and low values.
 * `bh` and `bl` are the candlestick body high and low values.
 * These values represent the height of the runes drawn going up.
 * Fractional values are used since there are 1/2th candlestick line segment runes and
 * top and bottom fractional values will map to the nearest 1/2th candlestick line segment runes.
 * Assumes all high values >= all low values, `h` >= `bh`, and `l` <= `bl`.
 */
export function DrawCandlestickBottomToTop(m: Model, p: Point, l: number, bl: number, bh: number, h: number, s: Style): void {
  // bottom wick
  const lf = Math.floor(l);
  let lr = runes.LineUp;
  if (l - lf < 0.5) lr = runes.LineDown;
  DrawCandlestickRune(m, { x: p.x, y: p.y - goInt(lf) }, lr, s);

  // bottom body
  const blf = Math.floor(bl);
  let blr = runes.LineUpHeavy;
  if (bl - blf < 0.5) blr = runes.LineDownHeavy;
  if (lf < blf) {
    // add upper segment to bottom wick if bottom wick is below body
    DrawCandlestickRune(m, { x: p.x, y: p.y - goInt(lf) }, runes.LineUp, s);
    // add bottom segment to bottom body if bottom wick is below bottom body rune that has a top segment
    if (blr === runes.LineUpHeavy) blr = runes.LineUpHeavyDown;
  }
  for (let i = goInt(lf + 1); i < goInt(blf); i++) {
    // fill in spots between bottom of wick and bottom of body
    DrawCandlestickRune(m, { x: p.x, y: p.y - i }, runes.LineVertical, s);
  }
  DrawCandlestickRune(m, { x: p.x, y: p.y - goInt(blf) }, blr, s);

  // top body
  const bhf = Math.floor(bh);
  let bhr = runes.LineDownHeavy;
  if (bh - bhf >= 0.5) bhr = runes.LineUpHeavy;
  if (blf < bhf) {
    // add upper segment to bottom body if bottom body is below top body
    DrawCandlestickRune(m, { x: p.x, y: p.y - goInt(blf) }, runes.LineUpHeavy, s);
    // add bottom segment to top body if bottom body is below top body that has a top segment
    if (bhr === runes.LineUpHeavy) bhr = runes.LineVerticalHeavy;
  }
  for (let i = goInt(blf + 1); i < goInt(bhf); i++) {
    // fill in spots between top and bottom of body
    DrawCandlestickRune(m, { x: p.x, y: p.y - i }, runes.LineVerticalHeavy, s);
  }
  DrawCandlestickRune(m, { x: p.x, y: p.y - goInt(bhf) }, bhr, s);

  // top wick
  const hf = Math.floor(h);
  let hr = runes.LineDown;
  if (h - hf >= 0.5) hr = runes.LineUp;
  if (bhf < hf) {
    // add upper segment to top body if top body is below top wick
    DrawCandlestickRune(m, { x: p.x, y: p.y - goInt(bhf) }, runes.LineUp, s);
    // add bottom segment to top wick if top body is below top wick that has a top segment
    if (hr === runes.LineUp) hr = runes.LineVertical;
  }
  for (let i = goInt(bhf + 1); i < goInt(hf); i++) {
    // fill in spots between top of body and top of wick
    DrawCandlestickRune(m, { x: p.x, y: p.y - i }, runes.LineVertical, s);
  }
  DrawCandlestickRune(m, { x: p.x, y: p.y - goInt(hf) }, hr, s);
}

/**
 * DrawCandlestickBottomToTopWide draws a candle whose body spans `width`
 * columns centered on p.x; the wick renders only in the center column.
 * Side columns are drawn as body-only candles (l=bl, h=bh). width < 1 is
 * treated as 1; width 1 is exactly DrawCandlestickBottomToTop. Even widths
 * render as the next lower odd width plus one extra column on the right.
 * Columns outside the canvas are clipped by the underlying rune drawing.
 */
export function DrawCandlestickBottomToTopWide(
  m: Model, p: Point, width: number, l: number, bl: number, bh: number, h: number, s: Style,
): void {
  if (width < 1) width = 1;
  const left = p.x - Math.trunc((width - 1) / 2);
  for (let x = left; x < left + width; x++) {
    const q = { x, y: p.y };
    if (x === p.x) DrawCandlestickBottomToTop(m, q, l, bl, bh, h, s);
    else DrawCandlestickBottomToTop(m, q, bl, bl, bh, bh, s);
  }
}

/**
 * DrawCandlestickBlockBottomToTop draws a candle with a solid block body:
 * interior body cells are FullBlock, and each body boundary cell renders
 * the same post-merge rune the line style would render at that junction:
 * a half block (▄/▀) where the line style keeps a half-tip, or FullBlock
 * where the line style upgrades the junction to a full heavy line (┃),
 * so multi-cell bodies never show a half-cell slit against the interior.
 * Wick cells use the light line runes (│ ╵ ╷), again matching the line
 * style's post-merge rune where a wick tip adjoins the body. Where a body
 * boundary and a wick would share a cell, the block wins and the wick
 * continues in the adjacent cell. A body confined to a single cell renders
 * as one FullBlock. Value semantics of l, bl, bh, h match DrawCandlestickBottomToTop.
 */
export function DrawCandlestickBlockBottomToTop(
  m: Model, p: Point, l: number, bl: number, bh: number, h: number, s: Style,
): void {
  const set = (row: number, r: Rune) => {
    m.setCell({ x: p.x, y: p.y - row }, NewCellWithStyle(r, s));
  };
  const lf = goInt(Math.floor(l));
  const blf = goInt(Math.floor(bl));
  const bhf = goInt(Math.floor(bh));
  const hf = goInt(Math.floor(h));

  // bottom wick: only rows below the body (the block wins shared cells).
  if (lf < blf) {
    let lr = runes.LineUp;
    if (l - Math.floor(l) < 0.5) lr = runes.LineVertical; // merged ╷ → │
    set(lf, lr);
    for (let i = lf + 1; i < blf; i++) set(i, runes.LineVertical);
  }

  // body
  if (blf === bhf) {
    set(blf, runes.FullBlock);
  } else {
    let blr = runes.UpperHalfBlock; // line style ╹
    if (bl - Math.floor(bl) < 0.5) blr = runes.FullBlock; // merged ╻ → ┃
    set(blf, blr);
    for (let i = blf + 1; i < bhf; i++) set(i, runes.FullBlock);
    let bhr = runes.LowerBlockFour; // line style ╻ → ▄
    if (bh - Math.floor(bh) >= 0.5) bhr = runes.FullBlock; // merged ╹ → ┃
    set(bhf, bhr);
  }

  // top wick: only rows above the body.
  if (bhf < hf) {
    let hr = runes.LineDown;
    if (h - Math.floor(h) >= 0.5) hr = runes.LineVertical; // merged ╵ → │
    for (let i = bhf + 1; i < hf; i++) set(i, runes.LineVertical);
    set(hf, hr);
  }
}

/**
 * DrawCandlestickRune draws a candlestick rune on to the canvas at given (X,Y)
 * coordinates with given style. The function checks for existing candlestick
 * runes already on the canvas and attempts to draw runes such that the
 * candlestick lines appear combined. If the runes cannot be combined, the
 * existing rune will be replaced.
 * Does nothing if given rune is Null or is not a candlestick rune.
 */
export function DrawCandlestickRune(m: Model, p: Point, r: Rune, s: Style): void {
  if (runes.isNull(r) || !runes.IsCandlestick(r)) return;
  let nr = r;
  const cr = m.cell(p).rune;
  if (runes.IsCandlestick(cr)) nr = runes.CombineCandlesticks(cr, r);
  m.setCell(p, NewCellWithStyle(nr, s));
}
