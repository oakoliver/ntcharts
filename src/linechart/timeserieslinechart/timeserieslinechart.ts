// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * Package timeserieslinechart implements a linechart that draws lines
 * for time series data points.
 *
 * Times are JavaScript Dates (millisecond precision, like upstream's
 * UnixMilli). Internally, as upstream, the X axis holds seconds since the
 * epoch as floating point numbers, so label formatters receive seconds.
 *
 * https://en.wikipedia.org/wiki/Moving_average
 */

import { newStyle, type Style } from '@oakoliver/lipgloss';
import type { Cmd, Msg } from '@oakoliver/bubbletea';
import {
  CanvasYCoordinates,
  NewPointFromFloat64Point,
  goInt,
  roundHalfAway,
  type Float64Point,
} from '../../canvas/canvas.js';
import { NewFloat64PointScaleBuffer, type Float64PointScaleBuffer } from '../../canvas/buffer/buffer.js';
import * as graph from '../../canvas/graph/graph.js';
import * as runes from '../../canvas/runes/runes.js';
import type { LineStyle } from '../../canvas/runes/runes.js';
import * as linechart from '../index.js';
import { DateUpdateHandler } from './updatehandler.js';
import type { FitYOpts } from './window.js';

export const DefaultDataSetName = 'default';

/** Seconds since the epoch of a Date, as upstream's float64(t.UnixMilli())/1e3. */
export function timeToX(t: Date): number {
  return t.getTime() / 1e3;
}

// unixMilliUTC returns the Date of upstream's time.UnixMilli(int64(math.Round(v * 1e3))).UTC().
function unixMilliUTC(v: number): Date {
  return new Date(goInt(roundHalfAway(v * 1e3)));
}

const pad2 = (n: number) => (n < 10 ? '0' : '') + String(n);

/**
 * DateTimeLabelFormatter returns a LabelFormatter that labels seconds since
 * the epoch with the UTC date ("01/02"), prefixed with the year ("'26 01/02")
 * the first time a year is seen in a pass over the axis.
 */
export function DateTimeLabelFormatter(): linechart.LabelFormatter {
  let yearLabel = '';
  return (i: number, v: number) => {
    if (i === 0) yearLabel = ''; // reset year labeling if redisplaying values
    const t = unixMilliUTC(v);
    const monthDay = `${pad2(t.getUTCMonth() + 1)}/${pad2(t.getUTCDate())}`;
    const year = `'${pad2(((t.getUTCFullYear() % 100) + 100) % 100)}`;
    if (yearLabel !== year) {
      // apply year label if first time seeing year
      yearLabel = year;
      return `${yearLabel} ${monthDay}`;
    }
    return monthDay;
  };
}

/** HourTimeLabelFormatter returns a LabelFormatter that labels seconds since the epoch with the UTC time ("15:04:05"). */
export function HourTimeLabelFormatter(): linechart.LabelFormatter {
  return (_i: number, v: number) => {
    const t = unixMilliUTC(v);
    return `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}:${pad2(t.getUTCSeconds())}`;
  };
}

/** TimePoint is a value at a point in time. */
export interface TimePoint {
  time: Date;
  value: number;
}

// cAverage tracks cumulative average
class cAverage {
  avg = 0;
  count = 0;

  // add adds a number to current cumulative average
  add(f: number): number {
    this.count += 1;
    this.avg += (f - this.avg) / this.count;
    return this.avg;
  }
}

interface dataSet {
  lineStyle: LineStyle; // type of line runes to draw
  style: Style;

  // stores TimePoints as Float64Point{x: seconds since epoch, y: value}
  // both time and value will be scaled to fit the graphing area
  tBuf: Float64PointScaleBuffer;
}

/** DrawCandleOpts configures candle drawing. */
export interface DrawCandleOpts {
  /** Width is the candle body width in columns; < 1 is treated as 1. */
  width?: number;
  /** Block renders solid block bodies (█ ▄ ▀) instead of line runes. */
  block?: boolean;
  /**
   * SnapTimeBounds retains boundary candles displaced by floating-point
   * rounding (within 1e-9 graph columns). The default preserves strict clipping.
   */
  snapTimeBounds?: boolean;
}

/** Option is used to set options when initializing a timeserieslinechart. */
export type Option = (m: Model) => void;

/**
 * Model contains state of a timeserieslinechart with an embedded linechart.Model
 * (here: it extends linechart.Model).
 * The X axis contains times and the Y axis contains number values.
 * A data set consists of a sequence of TimePoints in chronological order.
 * If multiple TimePoints map to the same column, then the average value of the time points
 * will be used as the Y value of the column.
 * The X axis contains a time range and the Y axis contains a numeric value range.
 * Uses linechart Model UpdateHandler for processing keyboard and mouse messages.
 */
export class Model extends linechart.Model {
  private dLineStyle: LineStyle = runes.ArcLineStyle; // default data set LineStyle
  private dStyle: Style = newStyle(); // default data set Style
  private dSets = new Map<string, dataSet>(); // maps names to data sets
  private y2Sets: Map<string, boolean> | null = null; // names of data sets on the right Y axis; null until used

  /** Use New(w, h, ...opts). */
  constructor(w: number, h: number) {
    const min = Date.now();
    const max = min + 1000;
    super(w, h, min / 1e3, max / 1e3, 0, 1);
    for (const opt of [
      linechart.WithXYSteps(4, 2),
      linechart.WithXLabelFormatter(DateTimeLabelFormatter()),
      linechart.WithAutoXYRange(), // automatically adjust value ranges
      linechart.WithUpdateHandler(DateUpdateHandler(1)), // only scroll on X axis, increments by 1 day
    ]) {
      opt(this);
    }
    this.updateGraphSizes();
  }

  // newDataSet returns a new initialized dataSet.
  private newDataSet(): dataSet {
    // use graphHeight() for y scale factor to align with y axis ticks.
    // origin().y is h-1 when xStep==0, which mis-scales by one row.
    const xs = this.graphWidth() / (this.viewMaxX() - this.viewMinX()); // x scale factor
    const ys = this.graphHeight() / (this.viewMaxY() - this.viewMinY()); // y scale factor
    return {
      lineStyle: this.dLineStyle,
      style: this.dStyle,
      tBuf: NewFloat64PointScaleBuffer({ x: this.viewMinX(), y: this.viewMinY() }, { x: xs, y: ys }),
    };
  }

  // rescaleData will reinitialize time chunks and
  // map time points into graph columns for display
  private rescaleData(): void {
    // rescale time points buffer; use graphHeight() for y scale factor
    // to align with y axis ticks (see newDataSet).
    const xs = this.graphWidth() / (this.viewMaxX() - this.viewMinX()); // x scale factor
    const ys = this.graphHeight() / (this.viewMaxY() - this.viewMinY()); // y scale factor
    const offset = { x: this.viewMinX(), y: this.viewMinY() };
    const scale = { x: xs, y: ys };
    for (const ds of this.dSets.values()) {
      const o = ds.tBuf.offset();
      if (!sameFloat(o.x, offset.x) || !sameFloat(o.y, offset.y)) ds.tBuf.setOffset(offset);
      const s = ds.tBuf.scale();
      if (!sameFloat(s.x, scale.x) || !sameFloat(s.y, scale.y)) ds.tBuf.setScale(scale);
    }
  }

  // graphPoints returns the data set's points scaled to the graphing area,
  // and on a log Y axis which of them can be drawn. Points of a data set on
  // the right Y axis are mapped onto the left axis first. On a log Y axis,
  // ok[i] is false for a point with no place on it, which must not be drawn;
  // ok is null when every point can be.
  private graphPoints(n: string, ds: dataSet): [Float64Point[], boolean[] | null] {
    let [scale, right] = this.y2Scale(n);
    if (!right) {
      scale = this.yScale();
      if (scale !== linechart.ScaleLog) return [ds.tBuf.readAll(), null];
    }
    // the buffer scales linearly against the left axis, so scale its raw
    // data points instead
    const raw = ds.tBuf.readAllRaw();
    const points: Float64Point[] = new Array(raw.length);
    const ok: boolean[] | null = scale === linechart.ScaleLog ? new Array(raw.length).fill(false) : null;
    for (let i = 0; i < raw.length; i++) {
      const p = { x: raw[i].x, y: raw[i].y };
      const valid = scale.valid(p.y);
      if (right) p.y = valid ? this.y2ToY(p.y) : this.viewMinY();
      points[i] = this.scaleFloat64PointForLine(p);
      if (ok !== null) ok[i] = valid;
    }
    return [points, ok];
  }

  /**
   * SetYScale sets the scale of the Y axis. See linechart.Model.setYScale.
   * On a log Y axis, values that are not greater than zero are not drawn:
   * lines break around them and their candles are left out.
   * Existing data will be rescaled.
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
   * the left axis. A data set on the right axis is drawn, auto-ranged and
   * fitted as a left one while the chart has no right axis (see setY2Axis).
   * Data sets drawn together by drawCandle should share one axis.
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

  /** ClearAllData will reset stored data values in all data sets. */
  clearAllData(): void {
    for (const ds of this.dSets.values()) ds.tBuf.clear();
    this.dSets.set(DefaultDataSetName, this.newDataSet());
  }

  /** ClearDataSet will erase stored data set given by name string. */
  clearDataSet(n: string): void {
    this.dSets.get(n)?.tBuf.clear();
  }

  /** SetTimeRange updates the minimum and maximum expected time values. Existing data will be rescaled. */
  setTimeRange(min: Date, max: Date): void {
    super.setXRange(timeToX(min), timeToX(max));
    this.rescaleData();
  }

  /** SetYRange updates the minimum and maximum expected Y values. Existing data will be rescaled. */
  override setYRange(min: number, max: number): void {
    super.setYRange(min, max);
    this.rescaleData();
  }

  /** SetViewTimeRange updates the displayed minimum and maximum time values. Existing data will be rescaled. */
  setViewTimeRange(min: Date, max: Date): void {
    super.setViewXRange(timeToX(min), timeToX(max));
    this.rescaleData();
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

  /** SetViewTimeAndYRange updates the displayed minimum and maximum time and Y values. Existing data will be rescaled. */
  setViewTimeAndYRange(minX: Date, maxX: Date, minY: number, maxY: number): void {
    super.setViewXRange(timeToX(minX), timeToX(maxX));
    super.setViewYRange(minY, maxY);
    this.rescaleData();
  }

  /** Resize will change timeserieslinechart display width and height. Existing data will be rescaled. */
  override resize(w: number, h: number): void {
    super.resize(w, h);
    this.rescaleData();
  }

  /** SetLineStyle will set the default line styles of data sets. */
  setLineStyle(ls: LineStyle): void {
    this.dLineStyle = ls;
    this.setDataSetLineStyle(DefaultDataSetName, ls);
  }

  /** SetStyle will set the default lipgloss styles of data sets. */
  setStyle(s: Style): void {
    this.dStyle = s;
    this.setDataSetStyle(DefaultDataSetName, s);
  }

  /** SetDataSetLineStyle will set the line style of the given data set by name string. */
  setDataSetLineStyle(n: string, ls: LineStyle): void {
    if (!this.dSets.has(n)) this.dSets.set(n, this.newDataSet());
    this.dSets.get(n)!.lineStyle = ls;
  }

  /** SetDataSetStyle will set the lipgloss style of the given data set by name string. */
  setDataSetStyle(n: string, s: Style): void {
    if (!this.dSets.has(n)) this.dSets.set(n, this.newDataSet());
    this.dSets.get(n)!.style = s;
  }

  /** Push will push a TimePoint data value to the default data set to be displayed with draw(). */
  push(t: TimePoint): void {
    this.pushDataSet(DefaultDataSetName, t);
  }

  /** PushDataSet will push a TimePoint data value to the data set given by name string, to be displayed with draw(). */
  pushDataSet(n: string, t: TimePoint): void {
    const f = { x: timeToX(t.time), y: t.value };
    // auto adjust x and y ranges if enabled
    if (this.autoAdjustRangeFor(n, f)) {
      this.updateGraphSizes();
      this.rescaleData();
    }
    if (!this.dSets.has(n)) this.dSets.set(n, this.newDataSet());
    this.dSets.get(n)!.tBuf.push(f);
  }

  /** Draw will draw lines runes displayed from left to right of the graphing area of the canvas. Uses default data set. */
  draw(): void {
    this.drawDataSets([DefaultDataSetName]);
  }

  /** DrawAll will draw lines runes for all data sets from left to right of the graphing area of the canvas. */
  drawAll(): void {
    this.drawDataSets(this.namesWithData());
  }

  // namesWithData returns the sorted names of the data sets holding points.
  private namesWithData(): string[] {
    const names: string[] = [];
    for (const [n, ds] of this.dSets) if (ds.tBuf.length() > 0) names.push(n);
    return names.sort();
  }

  /**
   * DrawDataSets will draw lines runes from left to right
   * of the graphing area of the canvas for each data set given
   * by name strings.
   */
  drawDataSets(names: string[]): void {
    if (names.length === 0) return;
    this.clear();
    this.drawXYAxisAndLabel();
    const o = this.origin();
    for (const n of names) {
      const ds = this.dSets.get(n);
      if (ds === undefined) continue;
      const [dataPoints, ok] = this.graphPoints(n, ds);
      if (dataPoints.length === 0) return;
      // get sequence of line values for graphing
      const [seqY, filled] = this.getLineSequence(dataPoints, ok);
      // convert to canvas coordinates and avoid drawing below X axis
      const yCoords = CanvasYCoordinates(o.y, seqY);
      if (this.xStep() > 0) {
        for (let i = 0; i < yCoords.length; i++) if (yCoords[i] > o.y) yCoords[i] = o.y;
      }
      const startX = this.graphRight() - yCoords.length;
      if (ok !== null) {
        // A column without data has no value to rest on: a log
        // axis has no zero. Draw each run of filled columns alone.
        for (let from = 0; from < yCoords.length; from++) {
          if (!filled[from]) continue;
          let to = from;
          while (to < yCoords.length && filled[to]) to++;
          graph.DrawLineSequence(this.canvas, startX + from === o.x, startX + from, yCoords.slice(from, to), ds.lineStyle, ds.style);
          from = to;
        }
        continue;
      }
      graph.DrawLineSequence(this.canvas, startX === o.x, startX, yCoords, ds.lineStyle, ds.style);
    }
  }

  /** DrawBraille will draw braille runes displayed from left to right of the graphing area of the canvas. Uses default data set. */
  drawBraille(): void {
    this.drawBrailleDataSets([DefaultDataSetName]);
  }

  /** DrawBrailleAll will draw braille runes for all data sets from left to right of the graphing area of the canvas. */
  drawBrailleAll(): void {
    this.drawBrailleDataSets(this.namesWithData());
  }

  /**
   * DrawCandleWithOpts draws candles with the given body width and style. The
   * body spans opts.width columns centered on the candle's time-scaled column,
   * the wick stays in the center column. Width < 1 is treated as 1.
   *
   * Side columns are clamped to the graph area: columns at or left of the
   * y-axis (origin().x when yStep() > 0, or left of origin().x when
   * yStep() == 0 since there is no axis line) are skipped so wide candles
   * never overdraw the y-axis or its tick labels, both of which live inside
   * the canvas.
   * Values outside the Y viewport are clipped before drawing so candles do
   * not overwrite the x-axis or its labels.
   *
   * The candle's center column is clamped so its whole body fits in the
   * drawable span (edge inset): edge candles shift inward up to half a body
   * from their true time position instead of rendering half-clipped. At
   * width 1 the inset is zero, so behavior reduces to the newest-candle clamp.
   *
   * Requires four data sets containing candlestick data open, high, low, close values.
   * Assumes that all data sets have the same number of TimePoints and
   * the TimePoint at the same index of each data set has the same time value.
   */
  drawCandleWithOpts(
    openName: string,
    highName: string,
    lowName: string,
    closeName: string,
    bullStyle: Style,
    bearStyle: Style,
    opts: DrawCandleOpts,
  ): void {
    if (openName.length === 0 || highName.length === 0 || lowName.length === 0 || closeName.length === 0) return;
    const od = this.dSets.get(openName);
    const hd = this.dSets.get(highName);
    const ld = this.dSets.get(lowName);
    const cd = this.dSets.get(closeName);
    if (od === undefined || hd === undefined || ld === undefined || cd === undefined) return;
    // only draws up to the number of candles of the data sets with the lowest
    // amount of data values if length if data is not the same across all data sets
    const [oData, oOK] = this.graphPoints(openName, od);
    const [hData, hOK] = this.graphPoints(highName, hd);
    const [lData, lOK] = this.graphPoints(lowName, ld);
    const [cData, cOK] = this.graphPoints(closeName, cd);
    const limit = Math.min(oData.length, hData.length, lData.length, cData.length);

    this.clear();
    this.drawXYAxisAndLabel();
    const width = opts.width ?? 0;
    for (let i = 0; i < limit; i++) {
      // assuming all time values are the same, can just any of the values to check
      // if data point is outside of the current graph view to ignore
      // Floating-point scaling can place the final timestamp a fraction
      // above graphWidth; retain it for the right-edge clamp.
      const epsilon = opts.snapTimeBounds ? 1e-9 : 0.0;
      if (oData[i].x < -epsilon || oData[i].x > this.graphWidth() + epsilon) continue;
      // a candle with a value that has no place on a log Y axis is not drawn
      if (oOK !== null && !(oOK[i] && hOK![i] && lOK![i] && cOK![i])) continue;
      let s: Style;
      let bl: number;
      let bh: number;
      if (oData[i].y > cData[i].y) {
        // check if bearish or bullish candle
        s = bearStyle;
        bl = cData[i].y;
        bh = oData[i].y;
      } else {
        s = bullStyle;
        bh = cData[i].y;
        bl = oData[i].y;
      }
      // Clip the value span as well as the time span. Canvas bounds alone
      // do not protect the x-axis and label rows below the graph area.
      let low = lData[i].y;
      let high = hData[i].y;
      const ceiling = this.graphHeight();
      if (ceiling <= 0 || high < 0 || low > ceiling) continue;
      low = Math.max(0, Math.min(low, ceiling));
      high = Math.max(0, Math.min(high, ceiling));
      bl = Math.max(0, Math.min(bl, ceiling));
      bh = Math.max(0, Math.min(bh, ceiling));
      const cw = Math.max(1, width);
      const drawX = this.candleColumn(oData[i].x, cw);
      let minCol = this.origin().x;
      if (this.yStep() > 0) minCol++;
      const half = Math.trunc((cw - 1) / 2);
      const left = drawX - half;
      const y = this.origin().y - 1;
      for (let x = left; x < left + cw; x++) {
        // a candle wider than the plot area is not clamped above, so
        // also stop at the right Y axis
        if (x < minCol || x >= this.graphRight()) continue;
        const q = { x, y };
        if (opts.block) {
          if (x === drawX) graph.DrawCandlestickBlockBottomToTop(this.canvas, q, low, bl, bh, high, s);
          else graph.DrawCandlestickBlockBottomToTop(this.canvas, q, bl, bl, bh, bh, s);
        } else if (x === drawX) {
          graph.DrawCandlestickBottomToTop(this.canvas, q, low, bl, bh, high, s);
        } else {
          graph.DrawCandlestickBottomToTop(this.canvas, q, bl, bl, bh, bh, s);
        }
      }
    }
  }

  /** DrawCandle draws single-column line-style candles. See drawCandleWithOpts. */
  drawCandle(openName: string, highName: string, lowName: string, closeName: string, bullStyle: Style, bearStyle: Style): void {
    this.drawCandleWithOpts(openName, highName, lowName, closeName, bullStyle, bearStyle, { width: 1 });
  }

  /**
   * DrawBrailleDataSets will draw braille runes from left to right
   * of the graphing area of the canvas for each data set given
   * by name strings.
   */
  drawBrailleDataSets(names: string[]): void {
    if (names.length === 0) return;
    this.clear();
    this.drawXYAxisAndLabel();
    for (const n of names) {
      const ds = this.dSets.get(n);
      if (ds === undefined) continue;
      const [dataPoints, ok] = this.graphPoints(n, ds);
      const dataLen = dataPoints.length;
      if (dataLen === 0) return;
      // draw lines from each point to the next point
      const gw = this.graphWidth();
      const gh = this.graphHeight();
      const bGrid = graph.NewBrailleGrid(gw, gh, 0, gw, 0, gh); // values already scaled to graph
      for (let i = 0; i < dataLen; i++) {
        if (ok !== null && !ok[i]) continue;
        let j = i + 1;
        if (j >= dataLen || (ok !== null && !ok[j])) {
          // Keep a valid point at the end of a run, even when
          // its next neighbour cannot sit on the log axis.
          j = i;
        }
        const p1 = dataPoints[i];
        const p2 = dataPoints[j];
        // ignore points that will not be displayed
        const bothBeforeMin = p1.x < 0 && p2.x < 0;
        const bothAfterMax = p1.x > gw && p2.x > gw;
        if (bothBeforeMin || bothAfterMax) continue;
        // get braille grid points from two Float64Point data points
        const gp1 = bGrid.gridPoint(p1);
        const gp2 = bGrid.gridPoint(p2);
        // set all points in the braille grid
        // between two points that approximates a line
        for (const p of graph.GetLinePointsWithLimit(gp1, gp2, this.maxInterpolationPoints) ?? []) bGrid.set(p);
      }

      // get all rune patterns for braille grid
      // and draw them on to the canvas
      let startX = 0;
      if (this.yStep() > 0) startX = this.origin().x + 1;
      graph.DrawBraillePatterns(this.canvas, { x: startX, y: 0 }, bGrid.braillePatterns(), ds.style);
    }
  }

  /**
   * SetColumnBackgroundStyle sets the background of the column of the given
   * time to the background of the given style.
   */
  setColumnBackgroundStyle(ts: Date, s: Style): void {
    const f = { x: timeToX(ts), y: 0 };
    if (f.x < this.viewMinX() || f.x > this.viewMaxX()) return;
    // use default dataset to scale the given time to the canvas (any dataset do)
    const sf = this.dSets.get(DefaultDataSetName)!.tBuf.scaleDatum(f);
    let drawX = goInt(sf.x) + this.origin().x;
    if (this.yStep() > 0) drawX += 1;
    for (let i = 0; i < this.origin().y; i++) {
      const p = { x: drawX, y: i };
      // copy cell foreground, set cell background to given style background
      const cs = this.canvas.cell(p).style.background(s.getBackground());
      this.canvas.setCellStyle(p, cs);
    }
  }

  // getLineSequence returns a sequence of Y values
  // to draw line runes from a given set of scaled Float64Points,
  // and whether each column of the sequence holds any data.
  // A non-null ok marks the points that can be drawn (see graphPoints).
  private getLineSequence(points: Float64Point[], ok: boolean[] | null): [number[], boolean[]] {
    const width = this.graphRight() - this.origin().x; // line runes can draw on axes
    if (width <= 0) return [[], []];
    const dataLen = points.length;
    // each index of the bucket corresponds to a graph column.
    // each index value is the average of data point values
    // that is mapped to that graph column.
    const buckets: cAverage[] = Array.from({ length: width }, () => new cAverage());
    for (let i = 0; i < dataLen; i++) {
      if (ok !== null && !ok[i]) continue;
      let j = i + 1;
      if (j >= dataLen || (ok !== null && !ok[j])) {
        // A valid point before a gap still contributes its own column.
        j = i;
      }
      const p1 = NewPointFromFloat64Point(points[i]);
      const p2 = NewPointFromFloat64Point(points[j]);
      // ignore points that will not be displayed on the graph
      const bothBeforeMin = p1.x < 0 && p2.x < 0;
      const bothAfterMax = p1.x > this.graphWidth() && p2.x > this.graphWidth();
      if (bothBeforeMin || bothAfterMax) continue;
      // place all points between two points
      // that approximates a line into buckets
      for (const p of graph.GetLinePointsWithLimit(p1, p2, this.maxInterpolationPoints) ?? []) {
        if (p.x >= 0 && p.x < width) buckets[p.x].add(p.y);
      }
    }
    // populate sequence of Y values for drawing lines
    const r = buckets.map((v) => goInt(roundHalfAway(v.avg)));
    const filled = buckets.map((v) => v.count > 0);
    return [r, filled];
  }

  /**
   * Update processes a Bubble Tea Msg by invoking the UpdateHandler
   * callback if the timeserieslinechart is focused.
   */
  override update(msg: Msg): [Model, Cmd] {
    if (!this.focused()) return [this, null];
    this.updateHandler(this, msg);
    this.rescaleData();
    return [this, null];
  }

  /**
   * CandleColumn maps a scaled graph X coordinate to a candle center column.
   * It includes the Y-axis gutter, right-edge clamp and wide-body edge inset.
   * Companion panels should use this with the same width as drawCandleWithOpts.
   */
  candleColumn(x: number, width: number): number {
    let start = this.origin().x;
    if (this.yStep() > 0) start++;
    let col = Math.min(goInt(x) + start, this.graphRight() - 1);
    width = Math.max(1, width);
    const half = Math.trunc((width - 1) / 2);
    const lo = start + half;
    const hi = this.graphRight() - 1 - (width - 1 - half);
    if (lo <= hi) col = Math.max(lo, Math.min(hi, col));
    return col;
  }

  // ── window.go (FitYOpts lives in window.ts) ─────────────────────────────

  /**
   * FitYToView fits the displayed Y range to all stored points whose timestamps
   * are inside the current time viewport, including both endpoints.
   * See fitYToViewWithOpts for dataset selection and a zero baseline.
   */
  fitYToView(): boolean {
    return this.fitYToViewWithOpts({});
  }

  /**
   * FitYToViewWithOpts fits the displayed left Y range to the selected data sets.
   * Data sets drawn against the right Y axis are never fitted, even if selected.
   * It ignores non-finite values and values invalid on the Y scale. If there
   * are no eligible points, it returns false and leaves the ranges unchanged.
   * Constant values get a nonzero range (5% or at least 1 on a linear axis,
   * half a decade on either side on a log axis). Expected Y bounds expand if
   * needed but never shrink, so retained history remains available for zooming.
   * autoMinY and autoMaxY are unchanged; this explicit fit overrides manual
   * Y zoom. Only stored points are considered, not interpolated boundary values.
   */
  fitYToViewWithOpts(opts: FitYOpts): boolean {
    const names = opts.dataSets ?? [...this.dSets.keys()];
    let lo = Infinity;
    let hi = -Infinity;
    for (const name of names) {
      const ds = this.dSets.get(name);
      if (ds === undefined) continue;
      if (this.y2Scale(name)[1]) continue;
      for (const p of ds.tBuf.readAllRaw()) {
        if (p.x < this.viewMinX() || p.x > this.viewMaxX() || !Number.isFinite(p.y) || !this.yScale().valid(p.y)) continue;
        lo = Math.min(lo, p.y);
        hi = Math.max(hi, p.y);
      }
    }
    if (lo > hi) return false;
    if (opts.includeZero && this.yScale() !== linechart.ScaleLog) {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, 0);
    }
    if (lo === hi) {
      if (this.yScale() === linechart.ScaleLog) {
        lo = Math.max(Number.MIN_VALUE, lo / Math.sqrt(10));
        hi = Math.min(Number.MAX_VALUE, hi * Math.sqrt(10));
      } else {
        const pad = Math.max(1, Math.abs(lo) * 0.05);
        lo = Math.max(-Number.MAX_VALUE, lo - pad);
        hi = Math.min(Number.MAX_VALUE, hi + pad);
        if (opts.includeZero && lo < 0 && hi > 0) lo = 0;
      }
    }
    super.setYRange(Math.min(this.minY(), lo), Math.max(this.maxY(), hi));
    super.setViewYRange(lo, hi);
    this.rescaleData();
    return true;
  }

  /**
   * TrimBefore removes points strictly before t from every data set and returns
   * the number removed. Points exactly at t are retained. Like push, timestamps
   * are compared at millisecond resolution, and data must be chronological.
   * Surviving points are copied to new buffers so discarded storage is released.
   * Styles, expected ranges and viewports are unchanged; call fitYToView to
   * refit Y afterwards. To preserve interpolation at the left edge, trim at an
   * earlier timestamp than the viewport's start to keep a preceding sample.
   */
  trimBefore(t: Date): number {
    const cutoff = timeToX(t);
    let removed = 0;
    for (const ds of this.dSets.values()) {
      const raw = ds.tBuf.readAllRaw();
      // sort.Search: the first index whose point is at or after the cutoff
      let lo = 0;
      let hi = raw.length;
      while (lo < hi) {
        const h = (lo + hi) >>> 1;
        if (!(raw[h].x >= cutoff)) lo = h + 1;
        else hi = h;
      }
      if (lo > 0) {
        ds.tBuf.setData(raw.slice(lo));
        removed += lo;
      }
    }
    return removed;
  }
}

// sameFloat is Go's == on float64 (NaN is never equal).
function sameFloat(a: number, b: number): boolean {
  return a === b;
}

/**
 * New returns a timeserieslinechart Model initialized from
 * width, height and various options.
 * By default, the chart will set the current time as the minimum time,
 * enable auto set X and Y value ranges,
 * and only allow moving viewport on X axis.
 */
export function New(w: number, h: number, ...opts: Option[]): Model {
  const m = new Model(w, h);
  for (const opt of opts) opt(m);
  m.updateGraphSizes();
  m['rescaleData']();
  if (!m['dSets'].has(DefaultDataSetName)) m['dSets'].set(DefaultDataSetName, m['newDataSet']());
  return m;
}
