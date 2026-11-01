// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * Package linechart implements a canvas that displays
 * (X,Y) Cartesian coordinates as a line chart.
 *
 * The methods upstream defines in axis.go, scale.go and updatehandler.go
 * (YAxis, SetXScale, ZoomIn, ...) are methods of the Model class here.
 */

import { newStyle, type Style } from '@oakoliver/lipgloss';
import type { Cmd, Msg } from '@oakoliver/bubbletea';
import * as canvas from '../canvas/canvas.js';
import { goInt, roundHalfAway, type Float64Point, type Point } from '../canvas/canvas.js';
import * as graph from '../canvas/graph/graph.js';
import * as runes from '../canvas/runes/runes.js';
import type { LineStyle, Rune } from '../canvas/runes/runes.js';
import { sprintfF } from '../internal/format.js';
import { fma } from '../internal/gomath.js';
import { goLen } from '../internal/gostr.js';
import type { ZoneManager } from '../internal/zone.js';
import { axisWithDefaults, type Axis } from './axis.js';
import { ScaleLinear, ScaleLog, sanitizeView, type Scale } from './scale.js';
import { logAxis, type tick } from './ticks.js';
import { XYAxesUpdateHandler, type UpdateHandler } from './updatehandler.js';

const defaultStyle: Style = newStyle();

/**
 * LabelFormatter converts a number into text
 * for displaying the X and Y axis labels
 * given an index of label and numeric value.
 * Index increments from minimum value to maximum values.
 */
export type LabelFormatter = (i: number, v: number) => string;

/**
 * DefaultLabelFormatter returns a LabelFormatter
 * that convert numbers to integers.
 * Values that round to zero are always labeled "0", never "-0".
 */
export function DefaultLabelFormatter(): LabelFormatter {
  return (_i: number, v: number) => {
    const s = sprintfF(v, 0);
    if (s === '-0') return '0';
    return s;
  };
}

/** Option is used to set options when initializing a linechart. */
export type Option = (m: Model) => void;

/**
 * Model contains state of a linechart with an embedded canvas.Model.
 *
 * Go fields whose camelCase name collides with a method (minX, xStep,
 * origin, ...) are kept as `_`-prefixed private fields behind those methods.
 */
export class Model {
  updateHandler: UpdateHandler;
  canvas: canvas.Model;
  /** style applied when drawing runes */
  style: Style = defaultStyle;
  /** style applied when drawing X and Y axes */
  axisStyle: Style = defaultStyle;
  /** style applied when drawing X and Y number value */
  labelStyle: Style = defaultStyle;
  /** convert to X number values display string */
  xLabelFormatter: LabelFormatter;
  /** convert to Y number values display string */
  yLabelFormatter: LabelFormatter;
  protected _xStep = 2; // number of steps when displaying X axis values
  protected _yStep = 2; // number of steps when displaying Y axis values
  protected _xScale: Scale = ScaleLinear; // how X values are spaced along the X axis
  protected _yScale: Scale = ScaleLinear; // how Y values are spaced along the Y axis
  protected _focus = false;

  // the expected min and max values
  protected _minX: number;
  protected _maxX: number;
  protected _minY: number;
  protected _maxY: number;

  // current min and max axes values to display
  protected _viewMinX: number;
  protected _viewMaxX: number;
  protected _viewMinY: number;
  protected _viewMaxY: number;

  // whether to automatically set expected values
  // when a value appears beyond the existing bounds
  autoMinX = false;
  autoMaxX = false;
  autoMinY = false;
  autoMaxY = false;

  protected _origin: Point = { x: 0, y: 0 }; // start of X and Y axes lines on canvas for graphing area
  protected _graphWidth = 0; // width of graphing area - excludes X axis and labels
  protected _graphHeight = 0; // height of graphing area - excludes Y axis and labels

  /** maximum points to interpolate for lines/circles */
  maxInterpolationPoints = 0;
  // right Y axis; null when there is none. Never written through: Model copies share it.
  protected y2: Axis | null = null;

  protected _zoneManager: ZoneManager | null = null; // provides mouse functionality
  protected _zoneID = '';

  /** Use New(w, h, minX, maxX, minY, maxY, ...opts). */
  constructor(w: number, h: number, minX: number, maxX: number, minY: number, maxY: number) {
    this.updateHandler = XYAxesUpdateHandler(1, 1);
    this.canvas = canvas.New(w, h);
    this.xLabelFormatter = DefaultLabelFormatter();
    this.yLabelFormatter = DefaultLabelFormatter();
    this._minX = minX;
    this._maxX = maxX;
    this._minY = minY;
    this._maxY = maxY;
    this._viewMinX = minX;
    this._viewMaxX = maxX;
    this._viewMinY = minY;
    this._viewMaxY = maxY;
  }

  /**
   * clone returns a copy of the model, as Go copies a Model value (as
   * Bubble Tea does): the copy shares the canvas contents, the right axis
   * and any data sets, and has its own cursor and fields.
   */
  clone(): this {
    const m = Object.create(Object.getPrototypeOf(this)) as this;
    Object.assign(m, this);
    m.canvas = this.canvas.clone();
    return m;
  }

  /**
   * setLineChart replaces this model's linechart state with a copy of lc's,
   * as Go's `m.Model = *lc` does for the charts that embed a linechart.
   * @internal
   */
  setLineChart(lc: Model): void {
    for (const k of Object.keys(lc) as (keyof this)[]) {
      this[k] = (lc as unknown as this)[k];
    }
    this.canvas = lc.canvas.clone();
  }

  /**
   * UpdateGraphSizes updates the Model origin, graph width and graph height.
   * This method should be called whenever the X and Y axes values have changed,
   * for example when X and Y ranges have been adjusted by autoAdjustRange().
   */
  updateGraphSizes(): void {
    const [origin, gWidth0, gHeight] = getGraphSizeAndOrigin(
      this.canvas.width(),
      this.canvas.height(),
      this._viewMinY,
      this._viewMaxY,
      this._xStep,
      this._yStep,
      this._yScale,
      this.yLabelFormatter,
    );
    let gWidth = gWidth0;
    if (this.y2Drawn()) {
      // reserve the right Y axis column and the widest right label
      let w = 0;
      for (const t of this.y2Ticks(gHeight)) w = Math.max(w, goLen(t.label));
      gWidth = Math.max(0, gWidth - 1 - w);
    }
    this._origin = origin;
    this._graphWidth = gWidth;
    this._graphHeight = gHeight;
  }

  /** Width returns linechart width. */
  width(): number {
    return this.canvas.width();
  }

  /** Height returns linechart height. */
  height(): number {
    return this.canvas.height();
  }

  /** GraphWidth returns linechart graphing area width. */
  graphWidth(): number {
    return this._graphWidth;
  }

  /** GraphHeight returns linechart graphing area height. */
  graphHeight(): number {
    return this._graphHeight;
  }

  /** MinX returns linechart expected minimum X value. */
  minX(): number {
    return this._minX;
  }

  /** MaxX returns linechart expected maximum X value. */
  maxX(): number {
    return this._maxX;
  }

  /** MinY returns linechart expected minimum Y value. */
  minY(): number {
    return this._minY;
  }

  /** MaxY returns linechart expected maximum Y value. */
  maxY(): number {
    return this._maxY;
  }

  /** ViewMinX returns linechart displayed minimum X value. */
  viewMinX(): number {
    return this._viewMinX;
  }

  /** ViewMaxX returns linechart displayed maximum X value. */
  viewMaxX(): number {
    return this._viewMaxX;
  }

  /** ViewMinY returns linechart displayed minimum Y value. */
  viewMinY(): number {
    return this._viewMinY;
  }

  /** ViewMaxY returns linechart displayed maximum Y value. */
  viewMaxY(): number {
    return this._viewMaxY;
  }

  /** XStep returns number of steps when displaying X axis values. */
  xStep(): number {
    return this._xStep;
  }

  /** YStep returns number of steps when displaying Y axis values. */
  yStep(): number {
    return this._yStep;
  }

  /** Origin returns a canvas Point with the coordinates of the linechart graph (X,Y) origin. */
  origin(): Point {
    return { x: this._origin.x, y: this._origin.y };
  }

  /** Clear will reset linechart canvas including axes and labels. */
  clear(): void {
    this.canvas.clear();
  }

  /** SetXStep updates the number of steps when displaying X axis values. */
  setXStep(xStep: number): void {
    this._xStep = xStep;
    this.updateGraphSizes();
  }

  /** SetYStep updates the number of steps when displaying Y axis values. */
  setYStep(yStep: number): void {
    this._yStep = yStep;
    this.updateGraphSizes();
  }

  /**
   * SetXRange updates the minimum and maximum expected X values.
   *
   * A log X axis (see setXScale) cannot show a bound that is not greater than
   * zero, so such a range is sanitized: a non-positive minimum becomes one
   * decade below the maximum (max/10), a non-positive maximum one decade
   * above the minimum, and if neither bound is positive the range becomes
   * 1..10. The same applies to setViewXRange.
   */
  setXRange(min: number, max: number): void {
    [min, max] = this._xScale.sanitize(min, max);
    this._minX = min;
    this._maxX = max;
  }

  /**
   * SetYRange updates the minimum and maximum expected Y values.
   *
   * A log Y axis (see setYScale) cannot show a bound that is not greater than
   * zero, so such a range is sanitized: a non-positive minimum becomes one
   * decade below the maximum (max/10), a non-positive maximum one decade
   * above the minimum, and if neither bound is positive the range becomes
   * 1..10. The same applies to setViewYRange.
   *
   * The right Y axis's displayed range follows the left view within this
   * range (see Axis), so the layout is recomputed.
   */
  setYRange(min: number, max: number): void {
    [min, max] = this._yScale.sanitize(min, max);
    this._minY = min;
    this._maxY = max;
    this.updateGraphSizes();
  }

  /** SetXYRange updates the minimum and maximum expected X and Y values. */
  setXYRange(minX: number, maxX: number, minY: number, maxY: number): void {
    // Go calls the linechart methods: no dispatch to a chart that embeds it
    Model.prototype.setXRange.call(this, minX, maxX);
    Model.prototype.setYRange.call(this, minY, maxY);
  }

  /**
   * SetViewXRange updates the displayed minimum and maximum X values.
   * Minimum and maximum values will be bounded by the expected X values.
   * Returns whether the displayed X values have updated.
   * On a log X axis the range is first sanitized as described on setXRange.
   */
  setViewXRange(min: number, max: number): boolean {
    [min, max] = this._xScale.sanitize(min, max);
    const vMin = Math.max(this._minX, min);
    const vMax = Math.min(this._maxX, max);
    if (vMin < vMax) {
      this._viewMinX = vMin;
      this._viewMaxX = vMax;
      this.updateGraphSizes();
      return true;
    }
    return false;
  }

  /**
   * SetViewYRange updates the displayed minimum and maximum Y values.
   * Minimum and maximum values will be bounded by the expected Y values.
   * Returns whether the displayed Y values have updated.
   * On a log Y axis the range is first sanitized as described on setYRange.
   */
  setViewYRange(min: number, max: number): boolean {
    [min, max] = this._yScale.sanitize(min, max);
    const vMin = Math.max(this._minY, min);
    const vMax = Math.min(this._maxY, max);
    if (vMin < vMax) {
      this._viewMinY = vMin;
      this._viewMaxY = vMax;
      this.updateGraphSizes();
      return true;
    }
    return false;
  }

  /**
   * SetViewXYRange updates the displayed minimum and maximum X and Y values.
   * Minimum and maximum values will be bounded by the expected values.
   */
  setViewXYRange(minX: number, maxX: number, minY: number, maxY: number): void {
    Model.prototype.setViewXRange.call(this, minX, maxX);
    Model.prototype.setViewYRange.call(this, minY, maxY);
  }

  /**
   * Resize will change linechart display width and height.
   * Existing runes on the linechart will not be redrawn.
   */
  resize(w: number, h: number): void {
    this.canvas.resize(w, h);
    this.canvas.viewWidth = w;
    this.canvas.viewHeight = h;
    this.updateGraphSizes();
  }

  /**
   * AutoAdjustRange automatically adjusts both the expected X and Y values
   * and the displayed X and Y values if enabled and the given Float64Point
   * is outside of expected ranges.
   * It returns whether or not the display X and Y ranges have been adjusted.
   * With a right Y axis, widening the expected Y range counts as adjusting
   * the display, since the right axis's view follows the left range.
   * A point with a non-positive coordinate on a log axis has no place on the
   * chart and is ignored.
   */
  autoAdjustRange(f: Float64Point): boolean {
    if (!this.drawable(f)) return false;
    // adjusts both expected range and
    // the display range (if not zoomed in)
    let b = this.autoAdjustX(f.x);
    const minY = this._minY;
    const maxY = this._maxY;
    if (this.autoMinY && f.y < this._minY) {
      if (this._minY === this._viewMinY) {
        this._viewMinY = f.y;
        b = true;
      }
      this._minY = f.y;
    }
    if (this.autoMaxY && f.y > this._maxY) {
      if (this._maxY === this._viewMaxY) {
        this._viewMaxY = f.y;
        b = true;
      }
      this._maxY = f.y;
    }
    if (this.y2 !== null && (this._minY !== minY || this._maxY !== maxY)) b = true;
    return b;
  }

  // autoAdjustX widens the expected X range to x if enabled, and the
  // displayed X range with it unless zoomed in. It reports whether the
  // displayed range changed.
  private autoAdjustX(x: number): boolean {
    let b = false;
    if (this.autoMinX && x < this._minX) {
      if (this._minX === this._viewMinX) {
        this._viewMinX = x;
        b = true;
      }
      this._minX = x;
    }
    if (this.autoMaxX && x > this._maxX) {
      if (this._maxX === this._viewMaxX) {
        this._viewMaxX = x;
        b = true;
      }
      this._maxX = x;
    }
    return b;
  }

  /**
   * SetZoneManager enables mouse functionality
   * by setting a bubblezone Manager to the linechart.
   * The Manager can check Bubble Tea mouse event Msgs
   * passed to the UpdateHandler handler during an update().
   * The root Bubble Tea model must wrap the view() string with
   * the manager's scan() to enable mouse functionality.
   * To disable mouse functionality after enabling, call setZoneManager(null).
   */
  setZoneManager(zm: ZoneManager | null): void {
    this._zoneManager = zm;
    if (zm != null && this._zoneID === '') this._zoneID = zm.newPrefix();
  }

  /** ZoneManager will return linechart zone Manager. */
  zoneManager(): ZoneManager | null {
    return this._zoneManager;
  }

  /** ZoneID will return linechart zone ID used by zone Manager. */
  zoneID(): string {
    return this._zoneID;
  }

  // drawYLabel draws Y axis values left of the Y axis every n step.
  // Repeating values will be hidden.
  // Does nothing if n <= 0.
  private drawYLabel(n: number): void {
    // from origin going up, draw data value left of the Y axis every n steps
    // origin X coordinates already set such that there is space available
    if (n <= 0) return;
    const o = this._origin;
    if (this._yScale === ScaleLog) {
      for (const t of yTicks(this._viewMinY, this._viewMaxY, this._graphHeight, n, this.yLabelFormatter)) {
        this.canvas.setStringWithStyle({ x: o.x - goLen(t.label), y: o.y - t.pos }, t.label, this.labelStyle);
      }
      return;
    }
    let lastVal = '';
    const rangeSz = this._viewMaxY - this._viewMinY; // range of possible expected values
    const increment = rangeSz / this._graphHeight;
    for (let i = 0; i <= this._graphHeight; ) {
      const v = fma(increment, i, this._viewMinY); // value to set left of Y axis
      const s = this.yLabelFormatter(i, v);
      if (lastVal !== s) {
        this.canvas.setStringWithStyle({ x: o.x - goLen(s), y: o.y - i }, s, this.labelStyle);
        lastVal = s;
      }
      if (i === this._graphHeight) break;
      i = Math.min(i + n, this._graphHeight);
    }
  }

  // drawXLabel draws X axis values below the X axis every n step.
  // Repeating values will be hidden.
  // Does nothing if n <= 0.
  private drawXLabel(n: number): void {
    // from origin going right, draw data value left of the Y axis every n steps
    if (n <= 0) return;
    if (this._xScale === ScaleLog) {
      this.drawXTicks(n);
      return;
    }
    const o = this._origin;
    let lastVal = '';
    const rangeSz = this._viewMaxX - this._viewMinX; // range of possible expected values
    const increment = rangeSz / this._graphWidth;
    const last = this._graphWidth - 1;
    for (let i = 0; i < this._graphWidth; ) {
      // can only set if rune to the left of target coordinates is empty
      if (runes.isNull(this.canvas.cell({ x: o.x + i - 1, y: o.y + 1 }).rune)) {
        let v = fma(increment, i, this._viewMinX); // value to set under X axis
        if (i === last) {
          // The per-column interpolation above is always exactly one
          // increment short of viewMaxX — scalePoint plots the rightmost
          // data point using graphWidth-1 as its denominator, one less than
          // the denominator used for this per-column v — so use the true
          // axis-end value for the final tick instead, feeding both the
          // left-anchored path below and the right-align fallback.
          v = this._viewMaxX;
        }
        const s = this.xLabelFormatter(i, v);
        // dont display if number will be cut off or value repeats
        const sLen = goLen(s) + o.x + i;
        if (s !== lastVal && sLen <= this.canvas.width()) {
          this.canvas.setStringWithStyle({ x: o.x + i, y: o.y + 1 }, s, this.labelStyle);
          lastVal = s;
        } else if (i === last && s !== lastVal) {
          // Final tick doesn't fit left-anchored: right-align it into
          // remaining width if it does not overlap an earlier label.
          if (this.rightAlignFinal(s)) lastVal = s;
        }
      }
      if (i === last) break;
      i = Math.min(i + n, last);
    }
  }

  // rightAlignFinal draws the final X label right-aligned on the label row
  // if it starts right of the Y axis and does not touch an earlier label.
  private rightAlignFinal(s: string): boolean {
    const o = this._origin;
    const x = this.canvas.width() - goLen(s);
    if (x > o.x) {
      for (let col = x - 1; col < this.canvas.width(); col++) {
        if (!runes.isNull(this.canvas.cell({ x: col, y: o.y + 1 }).rune)) return false;
      }
      this.canvas.setStringWithStyle({ x, y: o.y + 1 }, s, this.labelStyle);
      return true;
    }
    return false;
  }

  // drawXTicks draws the labels of a log X axis below it, at least n columns
  // apart, each on the column where its value falls. The collision and
  // final-label rules are those of drawXLabel.
  private drawXTicks(n: number): void {
    const o = this._origin;
    let lastVal = '';
    const last = this._graphWidth - 1;
    const axis = new logAxis({
      min: this._viewMinX,
      max: this._viewMaxX,
      size: this._graphWidth,
      last,
      step: n,
      format: this.xLabelFormatter,
      labelCells: true,
    });
    for (const t of axis.ticks()) {
      const i = t.pos;
      const s = t.label;
      // can only set if rune to the left of target coordinates is empty
      if (!runes.isNull(this.canvas.cell({ x: o.x + i - 1, y: o.y + 1 }).rune)) continue;
      // dont display if label will be cut off or repeats
      if (s === lastVal) continue;
      if (goLen(s) + o.x + i <= this.canvas.width()) {
        this.canvas.setStringWithStyle({ x: o.x + i, y: o.y + 1 }, s, this.labelStyle);
        lastVal = s;
      } else if (i === last) {
        // Final tick doesn't fit left-anchored: right-align it into
        // remaining width if it does not overlap an earlier label.
        if (this.rightAlignFinal(s)) lastVal = s;
      }
    }
  }

  /** DrawXYAxisAndLabel draws the X and Y axes, the right Y axis if any, and their labels. */
  drawXYAxisAndLabel(): void {
    const drawY = this._yStep > 0;
    const drawX = this._xStep > 0;
    if (drawY && drawX) {
      graph.DrawXYAxis(this.canvas, this._origin, this.axisStyle);
    } else {
      if (drawY) graph.DrawVerticalLineUp(this.canvas, this._origin, this.axisStyle); // draw Y axis
      if (drawX) graph.DrawHorizonalLineRight(this.canvas, this._origin, this.axisStyle); // draw X axis
    }
    this.drawY2Axis();
    this.drawYLabel(this._yStep);
    this.drawY2Label();
    this.drawXLabel(this._xStep);
  }

  // scalePoint returns a Float64Point scaled to the graph size
  // of the linechart from a Float64Point data point, width and height.
  // Distances are measured in scale space, so on a log axis equal ratios
  // are equal distances. A coordinate with no place on its axis scales to 0.
  private scalePoint(f: Float64Point, w: number, h: number): Float64Point {
    const r = { x: 0, y: 0 };
    const dx = this._xScale.span(this._viewMinX, this._viewMaxX);
    const dy = this._yScale.span(this._viewMinY, this._viewMaxY);
    if (dx > 0 && this._xScale.valid(f.x)) {
      const xs = w / dx;
      r.x = this._xScale.span(this._viewMinX, f.x) * xs;
    }
    if (dy > 0 && this._yScale.valid(f.y)) {
      const ys = h / dy;
      r.y = this._yScale.span(this._viewMinY, f.y) * ys;
    }
    return r;
  }

  // brailleGrid returns a BrailleGrid over the graphing area and the
  // expected X and Y ranges, in scale space; map data points onto it with
  // brailleGridPoint.
  private brailleGrid(): graph.BrailleGrid {
    return graph.NewBrailleGrid(
      this._graphWidth,
      this._graphHeight,
      this._xScale.forward(this._minX),
      this._xScale.forward(this._maxX),
      this._yScale.forward(this._minY),
      this._yScale.forward(this._maxY),
    );
  }

  // brailleGridPoint returns the braille grid point of a drawable data point.
  private brailleGridPoint(g: graph.BrailleGrid, f: Float64Point): Point {
    return g.gridPoint({ x: this._xScale.forward(f.x), y: this._yScale.forward(f.y) });
  }

  /**
   * ScaleFloat64Point returns a Float64Point scaled to the graph size
   * of the linechart from a Float64Point data point.
   * A coordinate with no place on a log axis (see Scale.valid) scales to 0.
   */
  scaleFloat64Point(f: Float64Point): Float64Point {
    // Need to use one less width and height, otherwise values rounded to the nearest
    // integer would be between 0 to graph width/height,
    // and indexing the full graph width/height would be outside of the canvas
    return this.scalePoint(f, this._graphWidth - 1, this._graphHeight - 1);
  }

  /**
   * ScaleFloat64PointForLine returns a Float64Point scaled to the graph size
   * of the linechart from a Float64Point data point. Used when drawing line runes
   * with line styles that can combine with the axes.
   * A coordinate with no place on a log axis (see Scale.valid) scales to 0.
   */
  scaleFloat64PointForLine(f: Float64Point): Float64Point {
    // Full graph height and can be used since LineStyle runes
    // can be combined with axes instead of overriding them
    return this.scalePoint(f, this._graphWidth, this._graphHeight);
  }

  /** DrawRune draws the rune on to the linechart from a given Float64Point data point. */
  drawRune(f: Float64Point, r: Rune): void {
    this.drawRuneWithStyle(f, r, this.style);
  }

  /**
   * DrawRuneWithStyle draws the rune with style on to the linechart
   * from a given Float64Point data point.
   * On a log axis a point with a non-positive coordinate is not drawn, nor is
   * a line with such an endpoint; this holds for every draw method.
   */
  drawRuneWithStyle(f: Float64Point, r: Rune, s: Style): void {
    if (!this.drawable(f)) return;
    if (this.autoAdjustRange(f)) this.updateGraphSizes(); // auto adjust x and y ranges if enabled
    const sf = this.scaleFloat64Point(f); // scale Cartesian coordinates data point to graphing area
    const p = canvas.CanvasPointFromFloat64Point(this._origin, sf);
    // draw rune avoiding the axes
    if (this._yStep > 0) p.x++;
    if (this._xStep > 0) p.y--;
    if (!this.inPlot(p)) return;
    this.canvas.setCell(p, canvas.NewCellWithStyle(r, s));
  }

  /**
   * DrawRuneLine draws the rune on to the linechart
   * such that there is an approximate straight line between the two given
   * Float64Point data points.
   */
  drawRuneLine(f1: Float64Point, f2: Float64Point, r: Rune): void {
    this.drawRuneLineWithStyle(f1, f2, r, this.style);
  }

  /**
   * DrawRuneLineWithStyle draws the rune with style on to the linechart
   * such that there is an approximate straight line between the two given
   * Float64Point data points.
   */
  drawRuneLineWithStyle(f1: Float64Point, f2: Float64Point, r: Rune, s: Style): void {
    if (!this.drawable(f1) || !this.drawable(f2)) return;
    // auto adjust x and y ranges if enabled
    const r1 = this.autoAdjustRange(f1);
    const r2 = this.autoAdjustRange(f2);
    if (r1 || r2) this.updateGraphSizes();

    // scale Cartesian coordinates data point to graphing area
    const sf1 = this.scaleFloat64Point(f1);
    const sf2 = this.scaleFloat64Point(f2);

    // convert scaled points to canvas points
    const p1 = canvas.CanvasPointFromFloat64Point(this._origin, sf1);
    const p2 = canvas.CanvasPointFromFloat64Point(this._origin, sf2);

    // draw rune on all canvas coordinates between
    // the two canvas points that approximates a line
    const points = graph.GetLinePointsWithLimit(p1, p2, this.maxInterpolationPoints) ?? [];
    for (const q of points) {
      const p = { x: q.x, y: q.y };
      if (this._yStep > 0) p.x++;
      if (this._xStep > 0) p.y--;
      if (!this.inPlot(p)) continue;
      this.canvas.setCell(p, canvas.NewCellWithStyle(r, s));
    }
  }

  /**
   * DrawRuneCircle draws the rune on to the linechart
   * such that there is an approximate circle of radius f around
   * the center of a circle at Float64Point data point.
   */
  drawRuneCircle(c: Float64Point, f: number, r: Rune): void {
    this.drawRuneCircleWithStyle(c, f, r, this.style);
  }

  /**
   * DrawRuneCircleWithStyle draws the rune with style on to the linechart
   * such that there is an approximate circle of radius f around
   * the center of a circle at Float64Point data point.
   */
  drawRuneCircleWithStyle(c: Float64Point, f: number, r: Rune, s: Style): void {
    const center = canvas.NewPointFromFloat64Point(c); // round center to nearest integers
    const radius = goInt(roundHalfAway(f)); // round radius to nearest integer

    const points = graph.GetCirclePointsWithLimit(center, radius, this.maxInterpolationPoints) ?? [];
    for (const v of points) {
      const np = canvas.NewFloat64PointFromPoint(v);
      // auto adjust x and y ranges if enabled
      if (this.autoAdjustRange(np)) this.updateGraphSizes();
      if (!this.drawable(np)) continue;
      // scale Cartesian coordinates data point to graphing area
      const sf = this.scaleFloat64Point(np);
      // convert scaled points to canvas points
      const p = canvas.CanvasPointFromFloat64Point(this._origin, sf);
      // draw rune while avoiding drawing outside of graphing area
      // or on the X and Y axes
      let ok = p.x >= this._origin.x && p.y <= this._origin.y && this.inPlot(p);
      if (this._yStep > 0 && p.x === this._origin.x) ok = false;
      if (this._xStep > 0 && p.y === this._origin.y) ok = false;
      if (ok) this.canvas.setCell(p, canvas.NewCellWithStyle(r, s));
    }
  }

  /**
   * DrawLine draws line runes of a given LineStyle on to the linechart
   * such that there is an approximate straight line between the two given Float64Point data points.
   */
  drawLine(f1: Float64Point, f2: Float64Point, ls: LineStyle): void {
    this.drawLineWithStyle(f1, f2, ls, this.style);
  }

  /**
   * DrawLineWithStyle draws line runes of a given LineStyle and style on to the linechart
   * such that there is an approximate straight line between the two given Float64Point data points.
   */
  drawLineWithStyle(f1: Float64Point, f2: Float64Point, ls: LineStyle, s: Style): void {
    if (!this.drawable(f1) || !this.drawable(f2)) return;
    // auto adjust x and y ranges if enabled
    const r1 = this.autoAdjustRange(f1);
    const r2 = this.autoAdjustRange(f2);
    if (r1 || r2) this.updateGraphSizes();

    // scale Cartesian coordinates data points to graphing area
    const sf1 = this.scaleFloat64PointForLine(f1);
    const sf2 = this.scaleFloat64PointForLine(f2);

    // convert scaled points to canvas points
    const p1 = canvas.CanvasPointFromFloat64Point(this._origin, sf1);
    const p2 = canvas.CanvasPointFromFloat64Point(this._origin, sf2);

    // draw line runes on all canvas coordinates between
    // the two canvas points that approximates a line
    let points = graph.GetLinePointsWithLimit(p1, p2, this.maxInterpolationPoints) ?? [];
    if (this.y2Drawn()) {
      // a straight line leaves the plot area at one end only, so the
      // points kept stay contiguous
      points = points.filter((p) => this.inPlot(p));
    }
    if (points.length <= 0) return;
    graph.DrawLinePoints(this.canvas, points, ls, s);
  }

  /**
   * DrawBrailleLine draws braille line runes on to the linechart
   * such that there is an approximate straight line between the two given Float64Point data points.
   * Braille runes will not overlap the axes.
   */
  drawBrailleLine(f1: Float64Point, f2: Float64Point): void {
    this.drawBrailleLineWithStyle(f1, f2, this.style);
  }

  /**
   * DrawBrailleLineWithStyle draws braille line runes with style on to the linechart
   * such that there is an approximate straight line between the two given Float64Point data points.
   * Braille runes will not overlap the axes.
   */
  drawBrailleLineWithStyle(f1: Float64Point, f2: Float64Point, s: Style): void {
    if (!this.drawable(f1) || !this.drawable(f2)) return;
    // auto adjust x and y ranges if enabled
    const r1 = this.autoAdjustRange(f1);
    const r2 = this.autoAdjustRange(f2);
    if (r1 || r2) this.updateGraphSizes();

    const bGrid = this.brailleGrid();

    // get braille grid points from two Float64Point data points
    const p1 = this.brailleGridPoint(bGrid, f1);
    const p2 = this.brailleGridPoint(bGrid, f2);

    // set all points in the braille grid between two points that approximates a line
    const points = graph.GetLinePointsWithLimit(p1, p2, this.maxInterpolationPoints) ?? [];
    for (const p of points) bGrid.set(p);

    // get all rune patterns for braille grid and draw them on to the canvas
    let startX = 0;
    if (this._yStep > 0) startX = this._origin.x + 1;
    const patterns = bGrid.braillePatterns();
    graph.DrawBraillePatterns(this.canvas, { x: startX, y: 0 }, patterns, s);
  }

  /**
   * DrawBrailleCircle draws braille runes on to the linechart
   * such that there is an approximate circle of given radius
   * around the center of a circle at Float64Point data point.
   * Braille runes will not overlap the axes.
   */
  drawBrailleCircle(p: Float64Point, f: number): void {
    this.drawBrailleCircleWithStyle(p, f, this.style);
  }

  /**
   * DrawBrailleCircleWithStyle draws braille runes with style on to the linechart
   * such that there is an approximate circle of given radius
   * around the center of a circle at Float64Point data point.
   * Braille runes will not overlap the axes.
   */
  drawBrailleCircleWithStyle(c: Float64Point, f: number, s: Style): void {
    const center = canvas.NewPointFromFloat64Point(c); // round center to nearest integer
    const radius = goInt(roundHalfAway(f)); // round radius to nearest integer

    // set braille grid points from computed circle points around center
    const bGrid = this.brailleGrid();
    const points = graph.GetCirclePointsWithLimit(center, radius, this.maxInterpolationPoints) ?? [];
    for (const p of points) {
      const np = canvas.NewFloat64PointFromPoint(p);
      if (!this.drawable(np)) continue;
      if (this.autoAdjustRange(np)) this.updateGraphSizes();
      bGrid.set(this.brailleGridPoint(bGrid, np));
    }

    // get all rune patterns for braille grid and draw them on to the canvas
    let startX = 0;
    if (this._yStep > 0) startX = this._origin.x + 1;
    const patterns = bGrid.braillePatterns();
    graph.DrawBraillePatterns(this.canvas, { x: startX, y: 0 }, patterns, s);
  }

  /** Focused returns whether the linechart is being focused. */
  focused(): boolean {
    return this._focus;
  }

  /** Focus enables update() events processing. */
  focus(): void {
    this._focus = true;
  }

  /** Blur disables update() events processing. */
  blur(): void {
    this._focus = false;
  }

  /** Init initializes the linechart. */
  init(): Cmd {
    return this.canvas.init();
  }

  /**
   * Update processes a Bubble Tea Msg by invoking
   * the UpdateHandler callback if the linechart is focused.
   */
  update(msg: Msg): [Model, Cmd] {
    if (!this._focus) return [this, null];
    this.updateHandler(this, msg);
    return [this, null];
  }

  /** View returns a string used by the Bubble Tea framework to display the linechart. */
  view(): string {
    let r = this.canvas.view();
    if (this._zoneManager != null) r = this._zoneManager.mark(this._zoneID, r);
    return r;
  }

  /** Alias of view(). */
  toString(): string {
    return this.view();
  }

  // ── axis.go ─────────────────────────────────────────────────────────────

  /** YAxis returns the left Y axis. */
  yAxis(): Axis {
    return {
      min: this._minY,
      max: this._maxY,
      viewMin: this._viewMinY,
      viewMax: this._viewMaxY,
      scale: this._yScale,
      autoMin: this.autoMinY,
      autoMax: this.autoMaxY,
      labelFormatter: this.yLabelFormatter,
      labelStyle: this.labelStyle,
    };
  }

  /**
   * SetYAxis sets the left Y axis. It has the effect of setYScale,
   * setYRange and setViewYRange, in that order, then sets autoMinY,
   * autoMaxY, yLabelFormatter and labelStyle. labelStyle also styles the X
   * axis labels.
   */
  setYAxis(axis: Partial<Axis>): void {
    const a = axisWithDefaults(axis);
    Model.prototype.setYScale.call(this, a.scale);
    Model.prototype.setYRange.call(this, a.min, a.max);
    this._viewMinY = this._minY;
    this._viewMaxY = this._maxY;
    if (a.viewMin !== a.viewMax) Model.prototype.setViewYRange.call(this, a.viewMin, a.viewMax);
    this.autoMinY = a.autoMin;
    this.autoMaxY = a.autoMax;
    this.yLabelFormatter = a.labelFormatter ?? DefaultLabelFormatter();
    this.labelStyle = a.labelStyle;
    this.updateGraphSizes();
  }

  /**
   * Y2Axis returns the right Y axis and true, or false if the chart has
   * none. viewMin and viewMax are the displayed range derived from the left
   * axis (see Axis).
   */
  y2Axis(): [Axis, boolean] {
    if (this.y2 === null) return [axisWithDefaults({}), false];
    const a = { ...this.y2 };
    [a.viewMin, a.viewMax] = this.y2View();
    return [a, true];
  }

  /**
   * SetY2Axis adds a right Y axis to the chart, or replaces it. The range is
   * sanitized as for the left axis (see setYRange); a range that is not
   * min < max becomes 0..1 on a linear axis or 1..10 on a log axis. viewMin
   * and viewMax are ignored, since the right axis's view follows the left
   * (see Axis). A null labelFormatter means DefaultLabelFormatter().
   *
   * Draw right-axis values with any draw method by mapping them with y2ToY,
   * and auto-range them with autoAdjustY2Range. The data-set charts do both
   * for data sets assigned to the right axis. With a Y step of 0 the right
   * axis is not drawn and reserves no space, but right-axis data still maps
   * through y2ToY.
   */
  setY2Axis(axis: Partial<Axis>): void {
    const a = axisWithDefaults(axis);
    [a.min, a.max] = a.scale.sanitize(a.min, a.max);
    if (!(a.min < a.max)) {
      a.min = 0;
      a.max = 1;
      if (a.scale === ScaleLog) {
        a.min = 1;
        a.max = 10;
      }
    }
    a.viewMin = 0;
    a.viewMax = 0;
    if (a.labelFormatter === null) a.labelFormatter = DefaultLabelFormatter();
    this.y2 = a;
    this.updateGraphSizes();
  }

  /** ClearY2Axis removes the right Y axis. The chart then renders as if it never had one. */
  clearY2Axis(): void {
    this.y2 = null;
    this.updateGraphSizes();
  }

  // y2View returns the displayed range of the right axis: the part of its
  // range at the same relative position, in each axis's scale space, as the
  // left view within the left range. Requires this.y2 !== null.
  private y2View(): [number, number] {
    const a = this.y2!;
    const d = this._yScale.span(this._minY, this._maxY);
    if (!(d > 0)) return [a.min, a.max];
    const r0 = a.scale.forward(a.min);
    const dr = a.scale.span(a.min, a.max);
    const at = (v: number): number => {
      const f = this._yScale.span(this._minY, v) / d;
      if (f === 0) return a.min;
      if (f === 1) return a.max;
      return a.scale.inverse(fma(f, dr, r0)); // r0 + f*dr, fused by Go on arm64
    };
    return [at(this._viewMinY), at(this._viewMaxY)];
  }

  /**
   * Y2ToY maps a right-axis value to the left-axis value at the same height
   * on the chart, so it can be drawn with any draw method. Both scales are
   * taken into account. It returns v if the chart has no right axis, and NaN
   * if v has no place on the right axis (see Scale.valid); check for NaN
   * before drawing, since the draw methods accept it on a linear left axis and
   * draw a stray stroke at the baseline. The draw methods auto-range the left
   * axis with the value they are given, so call autoAdjustY2Range on the raw
   * right-axis point first, or a value outside the right range widens the left
   * axis. After any range change, redraw: earlier mappings were made against
   * the old view.
   */
  y2ToY(v: number): number {
    if (this.y2 === null) return v;
    if (!this.y2.scale.valid(v)) return NaN;
    const [lo, hi] = this.y2View();
    const d = this.y2.scale.span(lo, hi);
    if (!(d > 0)) return this._viewMinY;
    const f = this.y2.scale.span(lo, v) / d;
    if (f === 0) return this._viewMinY;
    if (f === 1) return this._viewMaxY;
    return this._yScale.inverse(
      fma(f, this._yScale.span(this._viewMinY, this._viewMaxY), this._yScale.forward(this._viewMinY)),
    );
  }

  // y2Drawn reports whether the right axis is drawn: the chart has one and
  // shows Y axes (yStep > 0).
  private y2Drawn(): boolean {
    return this.y2 !== null && this._yStep > 0;
  }

  /**
   * GraphRight returns the canvas column just right of the graphing area:
   * the right Y axis's column when one is drawn, else the canvas width.
   * Line runes drawn by the data-set charts span origin().x to graphRight()-1.
   */
  graphRight(): number {
    if (this.y2Drawn()) return this._origin.x + this._graphWidth + 1;
    return this.canvas.width();
  }

  // inPlot reports whether canvas point p is left of the right Y axis, if
  // one is drawn.
  private inPlot(p: Point): boolean {
    return !this.y2Drawn() || p.x <= this._origin.x + this._graphWidth;
  }

  // y2Ticks returns the labels of the right axis over its displayed range
  // and graphHeight rows. Requires this.y2 !== null.
  private y2Ticks(graphHeight: number): tick[] {
    const [lo, hi] = this.y2View();
    const fmter = this.y2!.labelFormatter ?? DefaultLabelFormatter();
    if (this.y2!.scale === ScaleLog) return yTicks(lo, hi, graphHeight, this._yStep, fmter);
    return linearYTicks(lo, hi, graphHeight, this._yStep, fmter);
  }

  // drawY2Axis draws the right axis line, meeting the X axis with a corner.
  // The X axis stops at the right axis.
  private drawY2Axis(): void {
    if (!this.y2Drawn()) return;
    const o = this._origin;
    const x = o.x + this._graphWidth + 1;
    if (this._xStep <= 0) {
      graph.DrawVerticalLineUp(this.canvas, { x, y: o.y }, this.axisStyle);
      return;
    }
    for (let c = x + 1; c < this.canvas.width(); c++) this.canvas.setCell({ x: c, y: o.y }, canvas.EmptyCell);
    this.canvas.setCell({ x, y: o.y }, canvas.NewCellWithStyle(runes.LineUpLeft, this.axisStyle));
    graph.DrawVerticalLineUp(this.canvas, { x, y: o.y - 1 }, this.axisStyle);
  }

  // drawY2Label draws the right axis labels, left-aligned right of its line.
  private drawY2Label(): void {
    if (!this.y2Drawn()) return;
    const o = this._origin;
    const x = o.x + this._graphWidth + 2;
    for (const t of this.y2Ticks(this._graphHeight)) {
      this.canvas.setStringWithStyle({ x, y: o.y - t.pos }, t.label, this.y2!.labelStyle);
    }
  }

  /**
   * AutoAdjustY2Range is autoAdjustRange for a point whose Y is a right-axis
   * value: it widens the X range as autoAdjustRange does, and the right
   * axis's min or max if its autoMin or autoMax is set. The left axis is
   * untouched. It returns whether the displayed ranges changed, and if so
   * recomputes the layout. Without a right axis, or for a point with no
   * place on the X or right axis, it does nothing and returns false.
   */
  autoAdjustY2Range(f: Float64Point): boolean {
    if (this.y2 === null || !this._xScale.valid(f.x) || !this.y2.scale.valid(f.y)) return false;
    let b = this.autoAdjustX(f.x);
    const a = { ...this.y2 }; // copy: Model copies share this.y2
    let changed = false;
    if (a.autoMin && f.y < a.min) {
      a.min = f.y;
      changed = true;
    }
    if (a.autoMax && f.y > a.max) {
      a.max = f.y;
      changed = true;
    }
    if (changed) {
      this.y2 = a;
      b = true;
    }
    if (b) this.updateGraphSizes();
    return b;
  }

  // ── scale.go ────────────────────────────────────────────────────────────

  // drawable reports whether both coordinates of f have a place on the
  // linechart's axes.
  protected drawable(f: Float64Point): boolean {
    return this._xScale.valid(f.x) && this._yScale.valid(f.y);
  }

  /** XScale returns the scale of the X axis. */
  xScale(): Scale {
    return this._xScale;
  }

  /** YScale returns the scale of the Y axis. */
  yScale(): Scale {
    return this._yScale;
  }

  /**
   * SetXScale sets the scale of the X axis. Ranges stay in data units.
   * A log axis cannot show a non-positive bound, so on ScaleLog the expected
   * and displayed X ranges are sanitized as described on setXRange.
   */
  setXScale(s: Scale): void {
    this._xScale = s;
    [this._minX, this._maxX] = s.sanitize(this._minX, this._maxX);
    [this._viewMinX, this._viewMaxX] = sanitizeView(s, this._viewMinX, this._viewMaxX, this._minX, this._maxX);
    this.updateGraphSizes();
  }

  /**
   * SetYScale sets the scale of the Y axis. Ranges stay in data units.
   * A log axis cannot show a non-positive bound, so on ScaleLog the expected
   * and displayed Y ranges are sanitized as described on setYRange.
   */
  setYScale(s: Scale): void {
    this._yScale = s;
    [this._minY, this._maxY] = s.sanitize(this._minY, this._maxY);
    [this._viewMinY, this._viewMaxY] = sanitizeView(s, this._viewMinY, this._viewMaxY, this._minY, this._maxY);
    this.updateGraphSizes();
  }

  // ── updatehandler.go ───────────────────────────────────────────────────

  /**
   * ZoomIn will update display X and Y values to simulate
   * zooming into the linechart by given increments.
   * Increments are distances in scale space: data units on a linear axis,
   * decades on a log axis, where each bound moves by a factor of 10^increment.
   */
  zoomIn(x: number, y: number): void {
    Model.prototype.setViewXYRange.call(
      this,
      this._xScale.shift(this._viewMinX, x),
      this._xScale.shift(this._viewMaxX, -x),
      this._yScale.shift(this._viewMinY, y),
      this._yScale.shift(this._viewMaxY, -y),
    );
  }

  /**
   * ZoomOut will update display X and Y values to simulate
   * zooming out of the linechart by given increments.
   * Increments are distances in scale space, as for zoomIn.
   */
  zoomOut(x: number, y: number): void {
    Model.prototype.setViewXYRange.call(
      this,
      this._xScale.shift(this._viewMinX, -x),
      this._xScale.shift(this._viewMaxX, x),
      this._yScale.shift(this._viewMinY, -y),
      this._yScale.shift(this._viewMaxY, y),
    );
  }

  /**
   * MoveLeft will update display X values to simulate
   * moving left on the linechart by given increment.
   * The increment is a distance in scale space: data units on a linear axis,
   * decades on a log axis, where the view shifts by a factor of 10^increment.
   * The same holds for moveRight, moveUp and moveDown.
   */
  moveLeft(i: number): void {
    if (this._xScale.shift(this._viewMinX, -i) < this._minX) i = this._xScale.span(this._minX, this._viewMinX);
    Model.prototype.setViewXRange.call(this, this._xScale.shift(this._viewMinX, -i), this._xScale.shift(this._viewMaxX, -i));
  }

  /** MoveRight will update display X values to simulate moving right on the linechart by given increment. */
  moveRight(i: number): void {
    if (this._xScale.shift(this._viewMaxX, i) > this._maxX) i = this._xScale.span(this._viewMaxX, this._maxX);
    Model.prototype.setViewXRange.call(this, this._xScale.shift(this._viewMinX, i), this._xScale.shift(this._viewMaxX, i));
  }

  /** MoveUp will update display Y values to simulate moving up on the linechart by given increment. */
  moveUp(i: number): void {
    if (this._yScale.shift(this._viewMaxY, i) > this._maxY) i = this._yScale.span(this._viewMaxY, this._maxY);
    Model.prototype.setViewYRange.call(this, this._yScale.shift(this._viewMinY, i), this._yScale.shift(this._viewMaxY, i));
  }

  /** MoveDown will update display Y values to simulate moving down on the linechart by given increment. */
  moveDown(i: number): void {
    if (this._yScale.shift(this._viewMinY, -i) < this._minY) i = this._yScale.span(this._minY, this._viewMinY);
    Model.prototype.setViewYRange.call(this, this._yScale.shift(this._viewMinY, -i), this._yScale.shift(this._viewMaxY, -i));
  }
}

/**
 * New returns a linechart Model initialized with given width, height,
 * expected data value ranges and various options.
 * Width and height includes area used for chart labeling.
 * If xStep is 0, then will not draw X axis or values below X axis.
 * If yStep is 0, then will not draw Y axis or values left of Y axis.
 */
export function New(w: number, h: number, minX: number, maxX: number, minY: number, maxY: number, ...opts: Option[]): Model {
  const m = new Model(w, h, minX, maxX, minY, maxY);
  for (const opt of opts) opt(m);
  m.updateGraphSizes();
  return m;
}

// getGraphSizeAndOrigin calculates and returns the linechart origin and graph width and height
function getGraphSizeAndOrigin(
  w: number,
  h: number,
  minY: number,
  maxY: number,
  xStep: number,
  yStep: number,
  yScale: Scale,
  yFmter: LabelFormatter,
): [Point, number, number] {
  // graph width and height exclude area used by axes
  // origin point is canvas coordinates of where axes are drawn
  const origin = { x: 0, y: h - 1 };
  let gWidth = w;
  let gHeight = h;
  if (xStep > 0) {
    // use last 2 rows of canvas to plot X axis and tick values
    origin.y -= 1;
    gHeight -= 2;
  }
  if (yStep > 0) {
    // find out how many spaces left of the Y axis
    // to reserve for axis tick value by checking the string length
    // of all values to be displayed
    let lastVal = '';
    let valueLen = 0;
    if (yScale === ScaleLog) {
      // a log axis labels round values where they fall,
      // so measure the labels that will be drawn
      for (const t of yTicks(minY, maxY, gHeight, yStep, yFmter)) {
        if (goLen(t.label) > valueLen) valueLen = goLen(t.label);
      }
    } else {
      const rangeSz = maxY - minY; // range of possible expected values
      const increment = rangeSz / gHeight;
      for (let i = 0; i <= gHeight; ) {
        const v = fma(increment, i, minY); // value to set left of Y axis
        const s = yFmter(i, v);
        if (lastVal !== s) {
          if (goLen(s) > valueLen) valueLen = goLen(s);
          lastVal = s;
        }
        if (i === gHeight) break;
        i = Math.min(i + yStep, gHeight);
      }
    }
    origin.x += valueLen;
    gWidth -= valueLen + 1; // ignore Y axis and tick values
  }
  return [origin, gWidth, gHeight];
}

// yTicks returns the labels of a log Y axis showing min..max over
// graphHeight rows, at least n rows apart.
function yTicks(min: number, max: number, graphHeight: number, n: number, fmter: LabelFormatter): tick[] {
  [min, max] = ScaleLog.sanitize(min, max);
  return new logAxis({ min, max, size: graphHeight, last: graphHeight, step: n, format: fmter }).ticks();
}

// linearYTicks returns the labels of a linear Y axis showing lo..hi over
// graphHeight rows: every n rows from the bottom plus the top row,
// skipping a label equal to the one below it.
function linearYTicks(lo: number, hi: number, graphHeight: number, n: number, fmter: LabelFormatter): tick[] {
  if (n <= 0) return [];
  const ticks: tick[] = [];
  let last = '';
  const increment = (hi - lo) / graphHeight;
  for (let i = 0; i <= graphHeight; ) {
    let v = lo;
    if (i > 0) v = fma(increment, i, lo);
    const s = fmter(i, v);
    if (s !== last) {
      ticks.push({ pos: i, value: v, label: s });
      last = s;
    }
    if (i === graphHeight) break;
    i = Math.min(i + n, graphHeight);
  }
  return ticks;
}
