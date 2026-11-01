// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * Package streamlinechart implements a linechart that draws lines
 * going from the right of the chart to the left of the chart.
 */

import { newStyle, type Style } from '@oakoliver/lipgloss';
import type { Cmd, Msg } from '@oakoliver/bubbletea';
import { CanvasYCoordinate, CanvasYCoordinates, goInt, roundHalfAway, type Float64Point } from '../../canvas/canvas.js';
import { NewFloat64ScaleRingBuffer, type Float64ScaleRingBuffer } from '../../canvas/buffer/buffer.js';
import * as graph from '../../canvas/graph/graph.js';
import * as runes from '../../canvas/runes/runes.js';
import type { LineStyle } from '../../canvas/runes/runes.js';
import * as linechart from '../index.js';

export const DefaultDataSetName = 'default';

interface dataSet {
  lineStyle: LineStyle; // type of line runes to draw
  style: Style;

  // stores Y data values used to draw line runes
  sBuf: Float64ScaleRingBuffer;
}

/** Option is used to set options when initializing a streamlinechart. */
export type Option = (m: Model) => void;

/**
 * Model contains state of a streamlinechart with an embedded linechart.Model
 * (here: it extends linechart.Model).
 * A data set consists of a sequence of Y data values.
 * For each data set, streamlinecharts can only plot a single rune in each column
 * of the graph canvas from right to left.
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
      linechart.WithXYSteps(0, 2), // hide X axis
      linechart.WithAutoYRange(), // automatically adjust Y value range
      linechart.WithUpdateHandler(linechart.YAxisUpdateHandler(1)), // only scroll on Y axis
    ]) {
      opt(this);
    }
    this.updateGraphSizes();
  }

  // newDataSet returns a new initialized dataSet.
  private newDataSet(): dataSet {
    // use graphHeight() for y scale factor to align with y axis ticks
    // note that graph width is not used since lines are able to overlap onto Y axis
    const ys = this.graphHeight() / (this.viewMaxY() - this.viewMinY()); // y scale factor
    return {
      lineStyle: this.dLineStyle,
      style: this.dStyle,
      sBuf: NewFloat64ScaleRingBuffer(this.graphRight() - this.origin().x, this.viewMinY(), ys),
    };
  }

  // rescaleData will scale all internally stored data with new scale factor.
  private rescaleData(): void {
    // rescale stream buffer
    const ys = this.graphHeight() / (this.viewMaxY() - this.viewMinY()); // y scale factor
    for (const ds of this.dSets.values()) {
      const width = this.graphRight() - this.origin().x; // width of graphing area includes Y axis
      // create new buffer with new size if the graphing area size has changed
      if (ds.sBuf.size() !== width) {
        const buf = NewFloat64ScaleRingBuffer(width, this.viewMinY(), ys);
        for (const f of ds.sBuf.readAllRaw()) buf.push(f);
        ds.sBuf = buf;
      } else {
        ds.sBuf.setScale(ys);
        ds.sBuf.setOffset(this.viewMinY());
      }
    }
  }

  /** ClearAllData will reset stored data values in all data sets. */
  clearAllData(): void {
    for (const ds of this.dSets.values()) ds.sBuf.clear();
    this.dSets.set(DefaultDataSetName, this.newDataSet());
  }

  /** ClearDataSet will erase stored data set given by name string. */
  clearDataSet(n: string): void {
    this.dSets.get(n)?.sBuf.clear();
  }

  /**
   * SetYScale sets the scale of the Y axis. See linechart.Model.setYScale.
   * On a log Y axis, values that are not greater than zero are not drawn:
   * the line breaks around them. Existing data will be rescaled.
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

  /** SetXRange updates the minimum and maximum expected X values. Existing data will be rescaled. */
  override setXRange(min: number, max: number): void {
    super.setXRange(min, max);
    this.rescaleData();
  }

  /** SetYRange updates the minimum and maximum expected Y values. Existing data will be rescaled. */
  override setYRange(min: number, max: number): void {
    super.setYRange(min, max);
    this.rescaleData();
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

  /** Resize will change streamlinechart display width and height. Existing data will be rescaled. */
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

  /** Push will push a Y data value to the default data set to be displayed with draw(). */
  push(f: number): void {
    this.pushDataSet(DefaultDataSetName, f);
  }

  /** PushDataSet will push a Y data value to the data set given by name string, to be displayed with draw(). */
  pushDataSet(n: string, f: number): void {
    // auto adjust x and y ranges if enabled
    if (this.autoAdjustRangeFor(n, { x: this.minX(), y: f })) {
      this.updateGraphSizes();
      this.rescaleData();
    }
    if (!this.dSets.has(n)) this.dSets.set(n, this.newDataSet());
    this.dSets.get(n)!.sBuf.push(f);
  }

  /** Draw will draw lines runes displayed from right to left of the graphing area of the canvas. Uses default data set. */
  draw(): void {
    this.drawDataSets([DefaultDataSetName]);
  }

  /** DrawAll will draw lines runes for all data sets from right to left of the graphing area of the canvas. */
  drawAll(): void {
    const names: string[] = [];
    for (const [n, ds] of this.dSets) if (ds.sBuf.length() > 0) names.push(n);
    names.sort();
    this.drawDataSets(names);
  }

  /**
   * DrawDataSets will draw lines runes from right to left
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
      if (this.y2Scale(n)[1] || this.yScale() === linechart.ScaleLog) {
        this.drawRawDataSet(n, ds);
        continue;
      }
      const s = ds.sBuf.readAll();
      const startX = this.graphRight() - s.length;
      // round data value to nearest integer to fit onto the canvas
      const l = s.map((v) => goInt(roundHalfAway(v)));
      // convert to canvas coordinates and avoid drawing below X axis
      const o = this.origin();
      const yCoords = CanvasYCoordinates(o.y, l);
      if (this.xStep() > 0) {
        for (let i = 0; i < yCoords.length; i++) if (yCoords[i] > o.y) yCoords[i] = o.y;
      }
      graph.DrawLineSequence(this.canvas, startX === o.x, startX, yCoords, ds.lineStyle, ds.style);
    }
  }

  // drawRawDataSet draws the data set's line from its raw values, for a log
  // Y axis or a data set on the right Y axis: the buffer scales linearly
  // against the left axis, so its raw values are scaled here instead. A
  // value with no place on its axis breaks the line: each run of drawable
  // values is drawn on its own.
  private drawRawDataSet(n: string, ds: dataSet): void {
    let [scale, right] = this.y2Scale(n);
    if (!right) scale = this.yScale();
    const raw = ds.sBuf.readAllRaw();
    const o = this.origin();
    const startX = this.graphRight() - raw.length;
    for (let from = 0; from < raw.length; from++) {
      const yCoords: number[] = [];
      let to = from;
      for (; to < raw.length && scale.valid(raw[to]); to++) {
        let y = raw[to];
        if (right) y = this.y2ToY(y);
        const f = this.scaleFloat64PointForLine({ x: this.viewMinX(), y });
        // convert to canvas coordinates and avoid drawing below X axis
        let cy = CanvasYCoordinate(o.y, goInt(roundHalfAway(f.y)));
        if (this.xStep() > 0 && cy > o.y) cy = o.y;
        yCoords.push(cy);
      }
      if (yCoords.length > 0) {
        graph.DrawLineSequence(this.canvas, startX + from === o.x, startX + from, yCoords, ds.lineStyle, ds.style);
      }
      from = to;
    }
  }

  /**
   * Update processes a Bubble Tea Msg by invoking the UpdateHandler
   * callback if the streamlinechart is focused.
   */
  override update(msg: Msg): [Model, Cmd] {
    if (!this.focused()) return [this, null];
    this.updateHandler(this, msg);
    this.rescaleData();
    return [this, null];
  }
}

/**
 * New returns a streamlinechart Model initialized from
 * width, height and various options.
 * By default, the chart will hide the X axis,
 * auto set Y value ranges, and only enable moving viewport on Y axis.
 */
export function New(w: number, h: number, ...opts: Option[]): Model {
  const m = new Model(w, h);
  for (const opt of opts) opt(m);
  m.updateGraphSizes();
  if (!m['dSets'].has(DefaultDataSetName)) m['dSets'].set(DefaultDataSetName, m['newDataSet']());
  return m;
}
