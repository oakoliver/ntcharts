// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * Package heatmap implements a canvas that displays a heatmap,
 * color-mapped data over a grid.
 *
 * Points are drawn as single canvas cells by default. For an index grid,
 * where X and Y are whole cell numbers, WithCellSize(1, 1) draws each point
 * as a block that fills its share of the plot so the blocks tile it, and
 * WithXLabels / WithYLabels name the columns and rows.
 *
 * File contains a Model using the BubbleTea framework
 * representing the state of the heatmap
 * and options used by the heatmap during initialization with New().
 *
 * Upstream's yield_js.go / yield_other.go only give the Go WASM event loop a
 * slice every 4096 points while drawing (a time.Sleep under GOOS=js, a no-op
 * natively). JavaScript has no goroutines to starve and draw() is
 * synchronous, so nothing from them is needed here.
 */

import { Style, newStyle, type Color } from '@oakoliver/lipgloss';
import type { Cmd, Msg } from '@oakoliver/bubbletea';
import * as canvas from '../canvas/canvas.js';
import { goInt } from '../canvas/canvas.js';
import * as linechart from '../linechart/index.js';
import * as cells from './cells.js';
import { clamp } from './util.js';

// ─────────────────────────────────────────────────────────────────────────────

// default color scale is a 0->1 gradient from black to white
let defaultColorScale: Color[] = [
  '#000000', // black
  '#111111',
  '#222222',
  '#333333',
  '#444444',
  '#555555',
  '#666666',
  '#777777',
  '#888888',
  '#999999',
  '#AAAAAA',
  '#BBBBBB',
  '#CCCCCC',
  '#DDDDDD',
  '#EEEEEE',
  '#FFFFFF', // white
];

/** GetDefaultColorScale returns the current default color scale used by all heatmaps. */
export function GetDefaultColorScale(): Color[] {
  return defaultColorScale;
}

/**
 * SetDefaultColorScale sets the default color scale used by all heatmaps.
 * Returns the previous color scale.
 */
export function SetDefaultColorScale(cs: Color[]): Color[] {
  const old = defaultColorScale;
  defaultColorScale = cs;
  return old;
}

// ─────────────────────────────────────────────────────────────────────────────

/** The fields of a HeatPoint: a cartesian X,Y and a Value. Plain objects work wherever a HeatPoint is expected. */
export interface HeatPointLike {
  x: number;
  y: number;
  v: number;
}

/** HeatPoint has a cartesian X,Y and a Value. */
export class HeatPoint implements HeatPointLike {
  constructor(
    public x: number,
    public y: number,
    public v: number,
  ) {}

  /** AsFloat64Point returns the X,Y of the point as a canvas Float64Point. */
  asFloat64Point(): canvas.Float64Point {
    return { x: this.x, y: this.y };
  }
}

/** NewHeatPoint returns a HeatPoint with the given coordinates and value. */
export function NewHeatPoint(x: number, y: number, value: number): HeatPoint {
  return new HeatPoint(x, y, value);
}

/** NewHeatPointInt returns a HeatPoint with the given integer coordinates and value. */
export function NewHeatPointInt(x: number, y: number, value: number): HeatPoint {
  return new HeatPoint(Math.trunc(x), Math.trunc(y), value);
}

// ─────────────────────────────────────────────────────────────────────────────

/** Option is used to set options when initializing a heatmap. */
export type Option = (m: Model) => void;

/**
 * Model contains state of a heatmap.
 * It embeds a linechart.Model, for the graph view, but renders maps instead.
 * (Go embedding is inheritance here: every linechart method and field is
 * available on the heatmap.)
 */
export class Model extends linechart.Model {
  /** Color gradient user for heatmap */
  colorScale: Color[];
  // The state below is private upstream; it is public here only because
  // cells.ts (upstream's cells.go) works on it from outside the class.
  /** @internal default style for heatmap cells */
  cellStyle: Style = newStyle();

  /** @internal data points */
  points: HeatPointLike[] = [];

  /** autoMinValue true will automatically adjust minimum data value */
  autoMinValue = false;
  /** autoMaxValue true will automatically adjust minimum data value */
  autoMaxValue = false;
  /** @internal minimum data value */
  minValue = +Number.MAX_VALUE;
  /** @internal expected maximum data value */
  maxValue = -Number.MAX_VALUE;

  /** @internal data-unit size of one cell; > 0 draws cells as filled blocks */
  cellW = 0;
  /** @internal */
  cellH = 0;
  /**
   * @internal xLabels[i] names the cell column at X = i; yLabels[i] names the
   * cell row at Y = i. (Prefixed because xLabels() / yLabels() are the upstream getters.)
   */
  _xLabels: string[] = [];
  /** @internal */
  _yLabels: string[] = [];

  /** Use New(w, h, ...opts). */
  constructor(w: number, h: number) {
    super(w, h, 0, 1, 0, 1);
    // Model: linechart.New(w, h, 0, 1, 0, 1, linechart.WithAutoXYRange())
    Object.assign(this, linechart.New(w, h, 0, 1, 0, 1, linechart.WithAutoXYRange())); // automatically adjust value ranges
    this.colorScale = GetDefaultColorScale();
  }

  /**
   * SetViewXRange updates the displayed minimum and maximum X values.
   * Existing data will be rescaled.
   * (Upstream returns nothing; the linechart's boolean is kept so the
   * override stays type compatible with the embedded model.)
   */
  override setViewXRange(min: number, max: number): boolean {
    const b = super.setViewXRange(min, max);
    this.rescaleData();
    return b;
  }

  /**
   * SetViewYRange updates the displayed minimum and maximum Y values.
   * Existing data will be rescaled.
   */
  override setViewYRange(min: number, max: number): boolean {
    const b = super.setViewYRange(min, max);
    this.rescaleData();
    return b;
  }

  /**
   * SetViewXYRange updates the displayed minimum and maximum X and Y values.
   * Existing data will be rescaled.
   */
  override setViewXYRange(minX: number, maxX: number, minY: number, maxY: number): void {
    super.setViewXRange(minX, maxX);
    super.setViewYRange(minY, maxY);
    this.rescaleData();
  }

  /**
   * SetValueRange updates the displayed minimum and maximum Y values.
   * Existing data will be rescaled.
   */
  setValueRange(minVal: number, maxVal: number): void {
    this.minValue = minVal;
    this.maxValue = maxVal;
    this.rescaleData();
  }

  /**
   * Resize will change wavelinechart display width and height.
   * Existing data will be rescaled.
   */
  override resize(w: number, h: number): void {
    super.resize(w, h);
    this.rescaleData();
  }

  // rescaleData will scale all internally stored data with new scale factor.
  // Upstream leaves this as a TODO: points are kept raw and scaled while drawing.
  private rescaleData(): void {}

  /**
   * AutoAdjustValueRange automatically adjusts the heatmap's value range based on the passed value.
   * It returns whether or not the display range has been adjusted.
   */
  autoAdjustValueRange(value: number): boolean {
    let b = false;
    if (this.autoMinValue && value < this.minValue) {
      this.minValue = value;
      b = true;
    }
    if (this.autoMaxValue && value > this.maxValue) {
      this.maxValue = value;
      b = true;
    }
    return b;
  }

  /** ClearData will clear heatmap data. */
  clearData(): void {
    this.canvas.clear();
    this.points = [];
  }

  /**
   * Push adds a heat point to the heat data buffer.
   * Data will be scaled using expected max value and sparkline height.
   */
  push(p: HeatPointLike): void {
    this.autoAdjustRange({ x: p.x, y: p.y });
    this.autoAdjustValueRange(p.v);
    this.points.push(p);
  }

  /** PushAll adds all data values the heatmap. */
  pushAll(pts: HeatPointLike[]): void {
    for (const pt of pts) this.push(pt);
  }

  /**
   * PushAllMatrixRow adds all data in a matrix to the heatmap, using its X,Y indices
   * Matrix is row-major, with rows representing the data.
   */
  pushAllMatrixRow(dataRows: number[][]): void {
    dataRows.forEach((row, x) => {
      row.forEach((val, y) => this.push(NewHeatPoint(x, y, val)));
    });
  }

  /**
   * DrawPoint draws a HeatPoint on the heatmap Canvas.
   * It does so by adjusting the background: of one canvas cell, or, when a
   * cell size is set (see WithCellSize), of every canvas cell the data cell covers.
   */
  drawPoint(pt: HeatPointLike): void {
    if (this.colorScale.length === 0) return;

    // linear map value to color
    const rangeV = this.maxValue - this.minValue;
    const s = (pt.v - this.minValue) / rangeV;
    const csi = clamp(goInt(s * this.colorScale.length), 0, this.colorScale.length - 1);
    const color = this.colorScale[csi];

    if (this.cellW > 0 && this.cellH > 0) {
      this.fillCell(pt, color);
      return;
    }

    // plot on canvas
    const sf = this.scaleFloat64PointForLine({ x: pt.x, y: pt.y });
    const cp = canvas.CanvasPointFromFloat64Point(this.origin(), sf);

    // we just assign the background
    const oldStyle = this.canvas.getCellStyle(cp) ?? this.cellStyle; // null when out of bounds
    this.canvas.setCellStyle(cp, oldStyle.background(color));
  }

  /**
   * Draw will display the data on the canvas, then any axis labels.
   * Rows representing the data will be displayed going from
   * from the bottom to the top and coming from the left to the right of the canvas.
   */
  draw(): void {
    for (const pt of this.points) this.drawPoint(pt);
    this.drawLabels();
  }

  // ─── cells.go ──────────────────────────────────────────────────────────────

  // graphBox returns the canvas cell of the graphing area's left column and bottom row.
  private graphBox(): { left: number; bottom: number } {
    return cells.graphBox(this);
  }

  // cellSpans returns the graph columns and rows covered by the data cell centred on (x, y).
  private cellSpans(x: number, y: number, w: number, h: number): { c0: number; c1: number; r0: number; r1: number } {
    return cells.cellSpans(this, x, y, w, h);
  }

  // fillCell colours every canvas cell covered by the data cell at pt.
  private fillCell(pt: HeatPointLike, c: Color): void {
    cells.fillCell(this, pt, c);
  }

  // drawLabels writes the row and column labels.
  private drawLabels(): void {
    cells.drawLabels(this);
  }

  /** SetXLabels names the cell columns; see WithXLabels. */
  setXLabels(labels: string[]): void {
    cells.setXLabels(this, labels);
  }

  /** SetYLabels names the cell rows; see WithYLabels. */
  setYLabels(labels: string[]): void {
    cells.setYLabels(this, labels);
  }

  /** XLabels returns the cell column labels. */
  xLabels(): string[] {
    return this._xLabels;
  }

  /** YLabels returns the cell row labels. */
  yLabels(): string[] {
    return this._yLabels;
  }

  // ─── bubbletea.Model interface ─────────────────────────────────────────────

  override init(): Cmd {
    return this.canvas.init();
  }

  /** Update forwards bubbletea Msg to underlying canvas. */
  override update(msg: Msg): [Model, Cmd] {
    const [, cmd] = this.canvas.update(msg);
    return [this, cmd];
  }

  /** View returns a string used by the bubbletea framework to display the heatmap. */
  override view(): string {
    return this.canvas.view();
  }
}

/**
 * New returns a heatmap Model initialized with given width, height
 * and various options.
 * By default, heatmap will automatically scale bars to new maximum data values.
 */
export function New(w: number, h: number, ...opts: Option[]): Model {
  const m = new Model(w, h);
  for (const opt of opts) opt(m);
  return m;
}
