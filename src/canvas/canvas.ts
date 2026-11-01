// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * Package canvas implements an abstract 2D area used to plot
 * arbitrary runes that can be displayed using the Bubble Tea framework,
 * or rendered to a plain string with `view()`.
 *
 * This file contains the Model representing the state of the canvas,
 * the coordinate system used by the canvas, and the canvas contents.
 */

import { Style, newStyle } from '@oakoliver/lipgloss';
import type { Cmd, Msg } from '@oakoliver/bubbletea';
import type { ZoneManager } from '../internal/zone.js';
import { Null, type Rune } from './runes/runes.js';
import { DefaultKeyMap, DefaultUpdateHandler, type KeyMap, type UpdateHandler } from './updatehandler.js';

/** Point is an integer (X,Y) coordinate, like Go's image.Point. */
export interface Point {
  x: number;
  y: number;
}

/** Float64Point represents a point in a coordinate system with floating point precision. */
export interface Float64Point {
  x: number;
  y: number;
}

/** Rectangle is an integer rectangle [min, max), like Go's image.Rectangle. */
export interface Rectangle {
  min: Point;
  max: Point;
}

/** Pt returns a Point (Go's image.Pt). */
export function Pt(x: number, y: number): Point {
  return { x, y };
}

/** Rect returns a canonical Rectangle (Go's image.Rect). */
export function Rect(x0: number, y0: number, x1: number, y1: number): Rectangle {
  if (x0 > x1) [x0, x1] = [x1, x0];
  if (y0 > y1) [y0, y1] = [y1, y0];
  return { min: { x: x0, y: y0 }, max: { x: x1, y: y1 } };
}

/** PointAdd returns p+q (Go's image.Point.Add). */
export function PointAdd(p: Point, q: Point): Point {
  return { x: p.x + q.x, y: p.y + q.y };
}

/** PointSub returns p-q (Go's image.Point.Sub). */
export function PointSub(p: Point, q: Point): Point {
  return { x: p.x - q.x, y: p.y - q.y };
}

/** PointIn reports whether p is in r (Go's image.Point.In). */
export function PointIn(p: Point, r: Rectangle): boolean {
  return r.min.x <= p.x && p.x < r.max.x && r.min.y <= p.y && p.y < r.max.y;
}

/** NewFloat64PointFromPoint returns a new Float64Point from a given Point. */
export function NewFloat64PointFromPoint(p: Point): Float64Point {
  return { x: p.x, y: p.y };
}

/** Float64PointMul returns a Float64Point with both X and Y values multiplied by those of f. */
export function Float64PointMul(p: Float64Point, f: Float64Point): Float64Point {
  return { x: p.x * f.x, y: p.y * f.y };
}

/** Float64PointAdd returns a Float64Point with both X and Y values added to those of f. */
export function Float64PointAdd(p: Float64Point, f: Float64Point): Float64Point {
  return { x: p.x + f.x, y: p.y + f.y };
}

/** Float64PointSub returns a Float64Point with both X and Y values subtracted by those of f. */
export function Float64PointSub(p: Float64Point, f: Float64Point): Float64Point {
  return { x: p.x - f.x, y: p.y - f.y };
}

/** Go's math.Round: half away from zero. */
export function roundHalfAway(v: number): number {
  return v < 0 ? -Math.round(-v) : Math.round(v);
}

/** NewPointFromFloat64Point returns a new Point from a given Float64Point (rounded). */
export function NewPointFromFloat64Point(f: Float64Point): Point {
  return { x: goInt(roundHalfAway(f.x)), y: goInt(roundHalfAway(f.y)) };
}

/**
 * Go's int(float64) conversion: truncation toward zero. Out-of-range values
 * are implementation-defined in Go; this follows arm64 (saturate, NaN is 0),
 * the platform the parity goldens are generated on.
 */
export function goInt(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v >= 9.223372036854776e18) return Number.MAX_SAFE_INTEGER;
  if (v <= -9.223372036854776e18) return Number.MIN_SAFE_INTEGER;
  return Math.trunc(v);
}

/**
 * CanvasYCoordinates returns a sequence of Y coordinates in the
 * canvas coordinates system (X,Y is top left) from a given sequence of Y coordinates
 * in the Cartesian coordinates system (X,Y is bottom left)
 * by passing the graph X axis in the canvas coordinates system.
 */
export function CanvasYCoordinates(xAxis: number, seq: number[]): number[] {
  return seq.map((v) => CanvasYCoordinate(xAxis, v));
}

/**
 * CanvasYCoordinate returns a Y coordinate in the
 * canvas coordinates system (X,Y is top left) from a Y coordinate
 * in the Cartesian coordinates system (X,Y is bottom left)
 * by passing the graph X axis in the canvas coordinates system.
 */
export function CanvasYCoordinate(xAxis: number, y: number): number {
  return xAxis - y;
}

/**
 * CanvasPoints returns a sequence of Points in the
 * canvas coordinates system (X,Y is top left) from a given sequence of Points
 * in the Cartesian coordinates system (X,Y is bottom left)
 * by passing the graph origin in the canvas coordinates system.
 */
export function CanvasPoints(origin: Point, seq: Point[]): Point[] {
  return seq.map((v) => CanvasPoint(origin, v));
}

/**
 * CanvasPoint returns a Point in the canvas coordinates system (X,Y is top left)
 * from a given Point in the Cartesian coordinates system (X,Y is bottom left)
 * by passing the graph origin in the canvas coordinates system.
 */
export function CanvasPoint(origin: Point, p: Point): Point {
  return { x: origin.x + p.x, y: origin.y - p.y };
}

/**
 * CanvasPointFromFloat64Point returns a Point in the canvas coordinates
 * system (X,Y is top left) from a Float64Point in the
 * Cartesian coordinates system (X,Y is bottom left)
 * by passing the graph origin in the canvas coordinates system.
 */
export function CanvasPointFromFloat64Point(origin: Point, f: Float64Point): Point {
  // round coordinates to nearest integer and
  // convert Cartesian coordinates to canvas coordinates
  return CanvasPoint(origin, NewPointFromFloat64Point(f));
}

/**
 * CanvasFloat64Point returns a Float64Point in the canvas coordinates
 * system (X,Y is top left) from a given Float64Point
 * in the Cartesian coordinates system (X,Y is bottom left)
 * by passing the graph origin in the canvas coordinates system.
 */
export function CanvasFloat64Point(origin: Point, p: Float64Point): Float64Point {
  return { x: origin.x + p.x, y: origin.y - p.y };
}

/** The default (empty) style used by cells. */
export const defaultStyle: Style = newStyle();

/** Cell contains a rune and lipgloss Style for rendering. Cells are treated as immutable. */
export interface Cell {
  readonly rune: Rune;
  readonly style: Style;
}

/** The zero Cell: Null rune and default style. */
export const EmptyCell: Cell = Object.freeze({ rune: Null, style: defaultStyle });

/** NewCell returns a Cell with given rune and default lipgloss Style. */
export function NewCell(r: Rune): Cell {
  return { rune: r, style: defaultStyle };
}

/** NewCellWithStyle returns a Cell with given rune and lipgloss Style. */
export function NewCellWithStyle(r: Rune, s: Style): Cell {
  return { rune: r, style: s };
}

/** CellLine is an array of Cells. */
export type CellLine = Cell[];

function newCellLine(w: number): CellLine {
  return new Array<Cell>(Math.max(0, w)).fill(EmptyCell);
}

// Styles from @oakoliver/lipgloss are immutable (every setter returns a copy),
// so a rendered rune can be cached per Style object. A canvas view renders
// every cell, and most cells share a handful of styles.
const renderCache = new WeakMap<Style, Map<string, string>>();

/** Renders one rune with a style, memoised per style object. */
export function renderRune(s: Style, r: string): string {
  let m = renderCache.get(s);
  if (m === undefined) {
    m = new Map();
    renderCache.set(s, m);
  }
  let out = m.get(r);
  if (out === undefined) {
    out = s.render(r);
    if (m.size < 4096) m.set(r, out);
  }
  return out;
}

/** Option is used to set options when initializing a canvas. */
export type Option = (m: Model) => void;

/** Model contains state of a canvas. */
export class Model {
  /** Default style applied to all cells. */
  style: Style = defaultStyle;
  /** KeyMap used for keyboard msgs during update(). */
  keyMap: KeyMap;
  /** Callback invoked during update(). */
  updateHandler: UpdateHandler;

  // overall canvas size, 0,0 is top left of canvas
  private area: Rectangle;
  private content: CellLine[];
  private _focus = false;

  /** Viewport width used to display contents of the canvas. */
  viewWidth: number;
  /** Viewport height used to display contents of the canvas. */
  viewHeight: number;

  // internal coordinates tracking viewport cursor; 0,0 is top left of canvas
  private _cursor: Point = { x: 0, y: 0 };

  // bubblezone Manager used to handle mouse events during update()
  private _zoneManager: ZoneManager | null = null;
  private _zoneID = '';

  /** Use New(w, h, ...opts). */
  constructor(w: number, h: number) {
    w = Math.max(0, w);
    h = Math.max(0, h);
    this.keyMap = DefaultKeyMap();
    this.updateHandler = DefaultUpdateHandler();
    this.area = Rect(0, 0, w, h);
    this.content = new Array(h);
    for (let i = 0; i < h; i++) this.content[i] = newCellLine(w);
    this.viewWidth = w;
    this.viewHeight = h;
  }

  /** Returns a copy of the model that shares the contents (like copying the Go struct). */
  clone(): Model {
    const m = Object.create(Model.prototype) as Model;
    Object.assign(m, this);
    m._cursor = { ...this._cursor };
    return m;
  }

  /** Width returns canvas width. */
  width(): number {
    return this.area.max.x - this.area.min.x;
  }

  /** Height returns canvas height. */
  height(): number {
    return this.area.max.y - this.area.min.y;
  }

  /** Cursor returns Point containing (X,Y) coordinates pointing to top left of viewport. */
  cursor(): Point {
    return { ...this._cursor };
  }

  /**
   * SetCursor sets (X,Y) coordinates of cursor pointing to top left of viewport.
   * Coordinates will be bounded by canvas if x, y coordinates are out of bound.
   */
  setCursor(p: Point): void {
    this._cursor.x = p.x;
    this._cursor.y = p.y;
    if (this._cursor.x < 0) this._cursor.x = 0;
    else if (this._cursor.x >= this.width()) this._cursor.x = this.width() - 1;
    if (this._cursor.y < 0) this._cursor.y = 0;
    else if (this._cursor.y >= this.height()) this._cursor.y = this.height() - 1;
  }

  /**
   * Resize will resize canvas to new height and width, and resets cursor.
   * Will truncate existing content if canvas size shrinks. Does not change
   * viewport for displaying contents. Negative w or h are clamped to 0.
   */
  resize(w: number, h: number): void {
    if (w < 0) w = 0;
    if (h < 0) h = 0;
    const newLines: CellLine[] = new Array(h);
    const oldH = this.height();
    for (let i = 0; i < h; i++) {
      const line = newCellLine(w);
      // copy over previous line
      if (i < oldH) {
        const old = this.content[i];
        for (let j = 0; j < old.length && j < w; j++) line[j] = old[j];
      }
      newLines[i] = line;
    }
    this.area = Rect(0, 0, w, h);
    this._cursor.x = 0;
    this._cursor.y = 0;
    this.content = newLines;
  }

  /** Clear will reset canvas contents. */
  clear(): void {
    const dx = this.width();
    for (let i = 0; i < this.content.length; i++) this.content[i] = newCellLine(dx);
  }

  /**
   * SetLines copies string[] into canvas as contents.
   * Each string element represents a line in the canvas starting from top to bottom.
   * Truncates contents if contents are greater than canvas height and width.
   */
  setLines(lines: string[]): boolean {
    return this.setLinesWithStyle(lines, this.style);
  }

  /**
   * SetLinesWithStyle copies string[] into canvas as contents with style applied to all Cells.
   * Truncates contents if contents are greater than canvas height and width.
   */
  setLinesWithStyle(lines: string[], s: Style): boolean {
    for (let y = 0; y < lines.length; y++) {
      if (y >= this.height()) break;
      if (!this.setStringWithStyle({ x: 0, y }, lines[y], s)) return false; // should not happen
    }
    return true;
  }

  /**
   * SetString copies string as rune values into canvas CellLine starting at coordinates (X, Y).
   * Truncates values exceeding the canvas width.
   */
  setString(p: Point, l: string): boolean {
    return this.setStringWithStyle(p, l, this.style);
  }

  /**
   * SetStringWithStyle copies string as rune values into canvas CellLine starting at coordinates (X, Y).
   * Style will be applied to all Cells. Truncates values exceeding the canvas width.
   */
  setStringWithStyle(p: Point, l: string, s: Style): boolean {
    return this.setRunesWithStyle(p, Array.from(l), s);
  }

  /**
   * SetRunes copies rune values into canvas CellLine starting at coordinates (X, Y).
   * Truncates values exceeding the canvas width.
   */
  setRunes(p: Point, l: Rune[] | string): boolean {
    return this.setRunesWithStyle(p, l, this.style);
  }

  /**
   * SetRunesWithStyle copies rune values into canvas CellLine starting at coordinates (X, Y).
   * Style will be applied to all Cells. Truncates values exceeding the canvas width.
   */
  setRunesWithStyle(p: Point, l: Rune[] | string, s: Style): boolean {
    if (!this.insideYBounds(p.y)) return false;
    const rs = typeof l === 'string' ? Array.from(l) : l;
    let xIdx = p.x;
    const line = this.content[p.y];
    for (const r of rs) {
      if (this.insideXBounds(xIdx)) line[xIdx] = NewCellWithStyle(r, s);
      xIdx += 1;
    }
    return true;
  }

  /** SetCell sets a Cell using (X,Y) coordinates of canvas. */
  setCell(p: Point, c: Cell): boolean {
    if (!PointIn(p, this.area)) return false;
    this.content[p.y][p.x] = c;
    return true;
  }

  /** SetCellStyle sets Cell.style using (X,Y) coordinates of canvas. */
  setCellStyle(p: Point, s: Style): boolean {
    if (!PointIn(p, this.area)) return false;
    const c = this.content[p.y][p.x];
    this.content[p.y][p.x] = { rune: c.rune, style: s };
    return true;
  }

  /** GetCellStyle gets the Style at (X,Y) coordinates of canvas. Returns null if out of bounds. */
  getCellStyle(p: Point): Style | null {
    if (!PointIn(p, this.area)) return null;
    return this.content[p.y][p.x].style;
  }

  /** SetRune sets Cell.rune using (X,Y) coordinates of canvas using the default style. */
  setRune(p: Point, r: Rune): boolean {
    if (!PointIn(p, this.area)) return false;
    this.content[p.y][p.x] = NewCellWithStyle(r, this.style);
    return true;
  }

  /** SetRuneWithStyle sets Cell.rune using (X,Y) coordinates of canvas using the given style. */
  setRuneWithStyle(p: Point, r: Rune, style: Style): boolean {
    if (!PointIn(p, this.area)) return false;
    this.content[p.y][p.x] = NewCellWithStyle(r, style);
    return true;
  }

  /** Cell returns Cell located at (X,Y) coordinates of canvas. Returns the empty Cell if out of bounds. */
  cell(p: Point): Cell {
    if (!PointIn(p, this.area)) return EmptyCell;
    return this.content[p.y][p.x];
  }

  /** Fill sets all content in canvas to Cell. */
  fill(c: Cell): void {
    for (const line of this.content) line.fill(c);
  }

  /** FillLine sets all Cells in a CellLine y away from origin to given Cell. */
  fillLine(y: number, c: Cell): void {
    if (!this.insideYBounds(y)) return;
    this.content[y].fill(c);
  }

  /** SetStyle applies a lipgloss.Style to all Cells to change visual elements of each rune in the canvas. */
  setStyle(s: Style): void {
    for (const line of this.content) {
      for (let j = 0; j < line.length; j++) line[j] = { rune: line[j].rune, style: s };
    }
  }

  /**
   * SetZoneManager enables mouse functionality by setting a bubblezone Manager to the canvas.
   * The Manager can check Bubble Tea mouse messages passed to the UpdateHandler during update().
   * The root Bubble Tea model must wrap its view with the manager's scan() to enable mouse
   * functionality. To disable mouse functionality after enabling, pass null.
   */
  setZoneManager(zm: ZoneManager | null): void {
    this._zoneManager = zm;
    if (zm != null && this._zoneID === '') this._zoneID = zm.newPrefix();
  }

  /** ZoneManager returns the canvas zone Manager. */
  zoneManager(): ZoneManager | null {
    return this._zoneManager;
  }

  /** ZoneID returns the canvas zone ID used by the zone Manager. */
  zoneID(): string {
    return this._zoneID;
  }

  /** ShiftUp moves all Cells up once. Last CellLine will be set to a new CellLine. */
  shiftUp(): void {
    const c = this.content;
    if (c.length === 0) return;
    for (let i = 0; i < c.length - 1; i++) c[i] = c[i + 1];
    c[c.length - 1] = newCellLine(this.width());
  }

  /** ShiftDown moves all Cells down once. First CellLine will be set to a new CellLine. */
  shiftDown(): void {
    const c = this.content;
    if (c.length === 0) return;
    for (let i = c.length - 1; i > 0; i--) c[i] = c[i - 1];
    c[0] = newCellLine(this.width());
  }

  /** ShiftLeft moves all Cells left once. Last cell in each CellLine will be a new default Cell. */
  shiftLeft(): void {
    for (const cl of this.content) {
      if (cl.length === 0) continue;
      cl.copyWithin(0, 1);
      cl[cl.length - 1] = EmptyCell;
    }
  }

  /** ShiftRight moves all Cells right once. First cell in each CellLine will be a new default Cell. */
  shiftRight(): void {
    for (const cl of this.content) {
      if (cl.length === 0) continue;
      cl.copyWithin(1, 0, cl.length - 1);
      cl[0] = EmptyCell;
    }
  }

  /** Focused returns whether canvas is being focused. */
  focused(): boolean {
    return this._focus;
  }

  /** Focus enables update() event processing. */
  focus(): void {
    this._focus = true;
  }

  /** Blur disables update() event processing. */
  blur(): void {
    this._focus = false;
  }

  /** Init initializes the canvas. */
  init(): Cmd {
    return null;
  }

  /** Update processes a Bubble Tea Msg by invoking the UpdateHandler callback if canvas is focused. */
  update(msg: Msg): [Model, Cmd] {
    if (!this._focus) return [this, null];
    this.updateHandler(this, msg);
    return [this, null];
  }

  /** View returns the canvas as a string, for Bubble Tea or for printing. */
  view(): string {
    const parts: string[] = [];
    const endY = this._cursor.y + this.viewHeight - 1;
    const endX = this._cursor.x + this.viewWidth - 1;
    const h = this.height();
    const w = this.width();
    for (let i = this._cursor.y; i <= endY; i++) {
      if (i >= h) break;
      const line = this.content[i];
      for (let j = this._cursor.x; j <= endX; j++) {
        if (j >= w) break;
        const cell = line[j];
        const r = cell.rune === Null || cell.rune === '' ? ' ' : cell.rune;
        parts.push(renderRune(cell.style, r));
      }
      if (i !== endY) parts.push('\n');
    }
    let r = parts.join('');
    if (this._zoneManager != null) r = this._zoneManager.mark(this._zoneID, r);
    return r;
  }

  /** Alias of view(): a canvas prints as its rendered contents. */
  toString(): string {
    return this.view();
  }

  // ── viewport movement ──────────────────────────────────────────────────

  /** MoveUp moves cursor up if possible. */
  moveUp(i: number): void {
    this._cursor.y -= i;
    if (this._cursor.y < 0) this._cursor.y = 0;
  }

  /** MoveDown moves cursor down if possible. */
  moveDown(i: number): void {
    const endY = this._cursor.y + this.viewHeight + i;
    if (endY <= this.height()) this._cursor.y += i;
  }

  /** MoveLeft moves cursor left if possible. */
  moveLeft(i: number): void {
    this._cursor.x -= i;
    if (this._cursor.x < 0) this._cursor.x = 0;
  }

  /** MoveRight moves cursor right if possible. */
  moveRight(i: number): void {
    const endX = this._cursor.x + this.viewWidth + 1;
    if (endX <= this.width()) this._cursor.x += i;
  }

  // insideXBounds returns whether X coordinate is within canvas bounds.
  private insideXBounds(x: number): boolean {
    return !(x < 0 || x >= this.width());
  }

  // insideYBounds returns whether Y coordinate is within canvas bounds.
  private insideYBounds(y: number): boolean {
    return !(y < 0 || y >= this.height());
  }
}

/** New returns a canvas Model initialized with given width, height and various options. */
export function New(w: number, h: number, ...opts: Option[]): Model {
  const m = new Model(w, h);
  for (const opt of opts) opt(m);
  return m;
}
