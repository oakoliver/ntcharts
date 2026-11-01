// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/** Package wavelinechart implements a linechart that draws wave lines on the graph. */

import { newStyle, type Style } from '@oakoliver/lipgloss';
import type { Cmd, Msg } from '@oakoliver/bubbletea';
import { CanvasYCoordinate, goInt, roundHalfAway, type Float64Point } from '../../canvas/canvas.js';
import { NewFloat64PointScaleBuffer, type Float64PointScaleBuffer } from '../../canvas/buffer/buffer.js';
import * as graph from '../../canvas/graph/graph.js';
import * as runes from '../../canvas/runes/runes.js';
import type { LineStyle } from '../../canvas/runes/runes.js';
import * as linechart from '../index.js';

export const DefaultDataSetName = 'default';

interface dataSet {
  lineStyle: LineStyle; // type of line runes to draw
  style: Style;

  // stores data points from plot() and contains scaled data points
  pBuf: Float64PointScaleBuffer;
}

/** Option is used to set options when initializing a wavelinechart. */
export type Option = (m: Model) => void;

/**
 * Model contains state of a wavelinechart with an embedded linechart.Model
 * (here: it extends linechart.Model).
 * A data set is a list of (X,Y) Cartesian coordinates.
 * For each data set, wavelinecharts can only plot a single rune in each column
 * of the graph canvas by mapping (X,Y) data points values in Cartesian coordinates
 * to the (X,Y) canvas coordinates of the graph.
 * If multiple data points map to the same column, then the latest data point
 * will be used for that column.
 * By default, there is a line through the graph X axis without any plotted points.
 * Uses linechart Model UpdateHandler for processing keyboard and mouse messages.
 */
export class Model extends linechart.Model {
  private dLineStyle: LineStyle = runes.ArcLineStyle; // default data set LineStyle
  private dStyle: Style = newStyle(); // default data set Style
  private dSets = new Map<string, dataSet>(); // maps names to data sets
  private y2Sets: Map<string, boolean> | null = null; // names of data sets on the right Y axis; null until used

  /** Use New(w, h, ...opts). */
  constructor(w: number, h: number) {
    super(w, h, 0, 1, 0, 1);
    for (const opt of [
      linechart.WithAutoXYRange(), // automatically adjust value ranges
      linechart.WithUpdateHandler(linechart.XAxisUpdateHandler(1)), // only scroll on X axis
    ]) {
      opt(this);
    }
    this.updateGraphSizes();
  }

  // newDataSet returns a new initialized dataSet.
  private newDataSet(): dataSet {
    // use graphHeight() for y scale factor to align with y axis ticks.
    // origin().y is h-1 when xStep==0, which mis-scales by one row.
    const xs = this.graphWidth() / (this.viewMaxX() - this.viewMinX()); // X scale factor
    const ys = this.graphHeight() / (this.viewMaxY() - this.viewMinY()); // Y scale factor
    return {
      lineStyle: this.dLineStyle,
      style: this.dStyle,
      pBuf: NewFloat64PointScaleBuffer({ x: this.viewMinX(), y: this.viewMinY() }, { x: xs, y: ys }),
    };
  }

  // getLineSequence returns a sequence of Y values
  // to draw line runes from a given set of scaled Float64Points.
  // Columns without data rest on the left-axis value baseY.
  private getLineSequence(points: Float64Point[] | null, baseY: number): number[] {
    // Create a number[] storing canvas coordinates to draw line runes.
    // Each index corresponds to a canvas column
    // and the value of each index is the canvas row
    // I.E. (X,seqY[X]) coordinates will be used to draw the line runes
    const o = this.origin();
    const width = this.graphRight() - o.x; // lines can draw on Y axis
    const seqY = new Array<number>(Math.max(0, width)).fill(0);

    // initialize every index to the value such that
    // a horizontal line at Y = baseY will be drawn.
    // A log Y axis has no zero: Y = 0 scales to 0 there,
    // which puts the line along the bottom of the view range.
    const f = this.scaleFloat64Point({ x: 0.0, y: baseY });
    for (let i = 0; i < seqY.length; i++) {
      seqY[i] = CanvasYCoordinate(o.y, goInt(roundHalfAway(f.y)));
      // avoid drawing below X axis
      if (this.xStep() > 0 && seqY[i] > o.y) seqY[i] = o.y;
    }
    // map data set containing scaled Float64Point data points
    // onto graph row and column
    for (const p of points ?? []) this.setLineSequencePoint(seqY, p);
    return seqY;
  }

  // setLineSequencePoint will map a scaled Float64Point data point
  // on to a sequence of graph Y values. Points mapping onto
  // existing indices of the sequence will override the existing value.
  private setLineSequencePoint(seqY: number[], f: Float64Point): void {
    const x = goInt(roundHalfAway(f.x));
    // avoid drawing outside graphing area
    if (x >= 0 && x < seqY.length) {
      // avoid drawing below X axis
      const o = this.origin();
      seqY[x] = CanvasYCoordinate(o.y, goInt(roundHalfAway(f.y)));
      if (this.xStep() > 0 && seqY[x] > o.y) seqY[x] = o.y;
    }
  }

  // rescaleData will scale all internally stored data with new scale factor.
  private rescaleData(): void {
    // rescale all data set graph points; use graphHeight() for y scale factor
    // to align with y axis ticks (see newDataSet).
    const xs = this.graphWidth() / (this.viewMaxX() - this.viewMinX()); // X scale factor
    const ys = this.graphHeight() / (this.viewMaxY() - this.viewMinY()); // Y scale factor
    for (const ds of this.dSets.values()) {
      ds.pBuf.setOffset({ x: this.viewMinX(), y: this.viewMinY() });
      ds.pBuf.setScale({ x: xs, y: ys }); // buffer rescales all raw data points
    }
  }

  // graphPoints returns the data set's points scaled to the graphing area.
  // Points of a data set on the right Y axis are mapped onto the left axis
  // first. On a log axis, points with no place on it are left out.
  private graphPoints(n: string, ds: dataSet): Float64Point[] {
    let [yScale, right] = this.y2Scale(n);
    if (!right) {
      yScale = this.yScale();
      if (this.xScale() !== linechart.ScaleLog && yScale !== linechart.ScaleLog) return ds.pBuf.readAll();
    }
    // the buffer scales linearly against the left axis, so scale its raw
    // data points instead
    const points: Float64Point[] = [];
    for (const r of ds.pBuf.readAllRaw()) {
      const p = { x: r.x, y: r.y };
      if (!this.xScale().valid(p.x) || !yScale.valid(p.y)) continue;
      if (right) p.y = this.y2ToY(p.y);
      points.push(this.scaleFloat64PointForLine(p));
    }
    return points;
  }

  /** SetXScale sets the scale of the X axis. See linechart.Model.setXScale. Existing data will be rescaled. */
  override setXScale(s: linechart.Scale): void {
    super.setXScale(s);
    this.rescaleData();
  }

  /**
   * SetYScale sets the scale of the Y axis. See linechart.Model.setYScale.
   * On a log Y axis, columns without a data point rest on the bottom of the
   * displayed range instead of on Y = 0. Existing data will be rescaled.
   */
  override setYScale(s: linechart.Scale): void {
    super.setYScale(s);
    this.rescaleData();
  }

  /** SetYAxis sets the left Y axis. See linechart.Model.setYAxis. Existing data will be rescaled. */
  override setYAxis(a: Partial<linechart.Axis>): void {
    super.setYAxis(a);
    this.rescaleData();
  }

  /**
   * SetY2Axis adds a right Y axis, or replaces it. See
   * linechart.Model.setY2Axis. Put data sets on it with setDataSetYAxis.
   * Data pushed to right-assigned sets before this call was auto-ranged
   * against the left axis, and that left range is not undone.
   * Existing data will be rescaled.
   */
  override setY2Axis(a: Partial<linechart.Axis>): void {
    super.setY2Axis(a);
    this.rescaleData();
  }

  /**
   * ClearY2Axis removes the right Y axis. Data sets keep their axis
   * assignment, and those on the right are drawn against the left axis until
   * a right axis is set again. Existing data will be rescaled.
   */
  override clearY2Axis(): void {
    super.clearY2Axis();
    this.rescaleData();
  }

  /**
   * SetDataSetYAxis puts the data set given by name string on the left or
   * right Y axis, creating the data set if needed. All data sets start on
   * the left axis. A data set on the right axis is drawn and auto-ranged as
   * a left one while the chart has no right axis (see setY2Axis).
   */
  setDataSetYAxis(n: string, side: linechart.YAxisSide): void {
    if (!this.dSets.has(n)) this.dSets.set(n, this.newDataSet());
    if (side === linechart.YAxisRight) {
      if (this.y2Sets === null) this.y2Sets = new Map();
      this.y2Sets.set(n, true);
    } else {
      this.y2Sets?.delete(n);
    }
  }

  // y2Scale returns the right Y axis's scale and true if the data set given
  // by name is drawn against the right axis: it is assigned to it and the
  // chart has one.
  private y2Scale(n: string): [linechart.Scale, boolean] {
    if (!this.y2Sets?.get(n)) return [linechart.ScaleLinear, false];
    const [a, ok] = this.y2Axis();
    return [a.scale, ok];
  }

  // autoAdjustRangeFor auto-ranges f against the Y axis the data set given by
  // name is drawn against (upstream's unexported autoAdjustRange).
  private autoAdjustRangeFor(n: string, f: Float64Point): boolean {
    if (this.y2Scale(n)[1]) return this.autoAdjustY2Range(f);
    return this.autoAdjustRange(f);
  }

  // baseline returns the left-axis value that the data set's columns
  // without data rest on: Y = 0 on its own axis, or the bottom of the view
  // on a log axis, which has no zero.
  private baseline(n: string): number {
    const [scale, right] = this.y2Scale(n);
    if (!right) return 0; // scaleFloat64Point puts it on the bottom of a log axis
    if (scale === linechart.ScaleLog) return this.viewMinY();
    return this.y2ToY(0);
  }

  /** ClearAllData will reset stored data values in all data sets. */
  clearAllData(): void {
    for (const n of [...this.dSets.keys()]) this.clearDataSet(n);
    this.dSets.set(DefaultDataSetName, this.newDataSet());
  }

  /** ClearDataSet will erase stored data set given by name string. */
  clearDataSet(n: string): void {
    this.dSets.delete(n);
  }

  /**
   * SetViewXRange updates the displayed minimum and maximum X values.
   * Existing data will be rescaled. (Upstream returns nothing; the result
   * of linechart.Model.setViewXRange is passed through.)
   */
  override setViewXRange(min: number, max: number): boolean {
    const b = super.setViewXRange(min, max);
    this.rescaleData();
    return b;
  }

  /**
   * SetViewYRange updates the displayed minimum and maximum Y values.
   * Existing data will be rescaled. (Upstream returns nothing; the result
   * of linechart.Model.setViewYRange is passed through.)
   */
  override setViewYRange(min: number, max: number): boolean {
    const b = super.setViewYRange(min, max);
    this.rescaleData();
    return b;
  }

  /** SetViewXYRange updates the displayed minimum and maximum X and Y values. Existing data will be rescaled. */
  override setViewXYRange(minX: number, maxX: number, minY: number, maxY: number): void {
    super.setViewXRange(minX, maxX);
    super.setViewYRange(minY, maxY);
    this.rescaleData();
  }

  /** Resize will change wavelinechart display width and height. Existing data will be rescaled. */
  override resize(w: number, h: number): void {
    super.resize(w, h);
    this.rescaleData();
  }

  /** SetStyles will set the default styles of data sets. */
  setStyles(ls: LineStyle, s: Style): void {
    this.dLineStyle = ls;
    this.dStyle = s;
    this.setDataSetStyles(DefaultDataSetName, ls, s);
  }

  /** SetDataSetStyles will set the styles of the given data set by name string. */
  setDataSetStyles(n: string, ls: LineStyle, s: Style): void {
    if (!this.dSets.has(n)) this.dSets.set(n, this.newDataSet());
    const ds = this.dSets.get(n)!;
    ds.lineStyle = ls;
    ds.style = s;
  }

  /** Plot will map a Float64Point data value to canvas coordinates to be displayed with draw(). Uses default data set. */
  plot(f: Float64Point): void {
    this.plotDataSet(DefaultDataSetName, f);
  }

  /**
   * PlotDataSet will map a Float64Point data value to canvas coordinates
   * to be displayed with draw(). Uses given data set by name string.
   */
  plotDataSet(n: string, f: Float64Point): void {
    if (this.autoAdjustRangeFor(n, f)) {
      // auto adjust x and y ranges if enabled
      this.updateGraphSizes();
      this.rescaleData();
    }
    if (!this.dSets.has(n)) this.dSets.set(n, this.newDataSet());
    this.dSets.get(n)!.pBuf.push({ x: f.x, y: f.y });
  }

  /** Draw will draw lines runes for each column of the graphing area of the canvas. Uses default data set. */
  draw(): void {
    this.drawDataSets([DefaultDataSetName]);
  }

  /**
   * DrawAll will draw lines runes for each column
   * of the graphing area of the canvas for all data sets.
   * Will always draw default data set.
   */
  drawAll(): void {
    const names: string[] = [];
    for (const [n, ds] of this.dSets) if (n === DefaultDataSetName || ds.pBuf.length() > 0) names.push(n);
    names.sort();
    this.drawDataSets(names);
  }

  /**
   * DrawDataSets will draw lines runes for each column
   * of the graphing area of the canvas for each data set given
   * by name strings.
   */
  drawDataSets(names: string[]): void {
    if (names.length === 0) return;
    this.clear();
    this.drawXYAxisAndLabel();
    for (const n of names) {
      const ds = this.dSets.get(n);
      if (ds === undefined) continue;
      const startX = this.origin().x;
      const seqY = this.getLineSequence(this.graphPoints(n, ds), this.baseline(n));
      graph.DrawLineSequence(this.canvas, true, startX, seqY, ds.lineStyle, ds.style);
    }
  }

  /**
   * Update processes a Bubble Tea Msg by invoking the UpdateHandler
   * callback if the wavelinechart is focused.
   */
  override update(msg: Msg): [Model, Cmd] {
    if (!this.focused()) return [this, null];
    this.updateHandler(this, msg);
    this.rescaleData(); // rescale data points to new viewing window
    return [this, null];
  }
}

/**
 * New returns a wavelinechart Model initialized
 * with given width, height and various options.
 * By default, the chart will auto set X and Y value ranges,
 * and only enable moving viewport on X axis.
 */
export function New(w: number, h: number, ...opts: Option[]): Model {
  const m = new Model(w, h);
  for (const opt of opts) opt(m);
  m.updateGraphSizes();
  if (!m['dSets'].has(DefaultDataSetName)) m['dSets'].set(DefaultDataSetName, m['newDataSet']());
  return m;
}
