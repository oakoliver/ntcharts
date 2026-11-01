// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * Package barchart implements a canvas that displays a bar chart
 * with bars going either horizontally or vertically.
 */

import { Style, newStyle } from '@oakoliver/lipgloss';
import type { Cmd, Msg } from '@oakoliver/bubbletea';
import * as canvas from '../canvas/canvas.js';
import { goInt, roundHalfAway } from '../canvas/canvas.js';
import { Float64ScaleBuffer, NewFloat64ScaleBuffer } from '../canvas/buffer/buffer.js';
import * as graph from '../canvas/graph/graph.js';
import { goLen, goSliceBytes } from '../internal/gostr.js';
import type { ZoneManager } from '../internal/zone.js';

const defaultStyle = newStyle();

/**
 * BarValue contain bar segment name, value and style for drawing.
 * A negative Value draws away from the axis in the opposite direction
 * of positive values: within one bar, positive segments stack up (or
 * right) from zero and negative segments stack down (or left) from zero.
 * (Go's zero values apply when `name` or `style` are omitted.)
 */
export interface BarValue {
  name?: string;
  value: number;
  style?: Style;
}

/**
 * BarData contains a label for the bar and a list of BarValues.
 * If displaying vertical bars, the length of the label string will be
 * bounded by the width of each bar.
 * If displaying horizontal bars, the length of the label string
 * will not be bounded and will affect where the vertical axis line starts.
 */
export interface BarData {
  label: string;
  values: BarValue[];
}

interface DataSet {
  bd: BarData;
  buf: Float64ScaleBuffer; // contains bar values
}

/** Option is used to set options when initializing a barchart. */
export type Option = (m: Model) => void;

/** Model contains state of a barchart. */
export class Model {
  canvas: canvas.Model;
  /** style applied when drawing axis */
  axisStyle: Style = defaultStyle;
  /** style applied when drawing axis labels */
  labelStyle: Style = defaultStyle;
  /** whether to automatically set max value when adding data */
  autoMaxValue = true;
  /** whether to automatically set bar width */
  autoBarWidth = true;

  // Private Go fields that collide with their getter methods carry an
  // underscore prefix (showAxis(), horizontal(), barWidth(), barGap(),
  // data(), zoneManager(), zoneID()).
  private _showAxis = true; // whether to display axis and labels
  private _horizontal = false; // whether to display bars horizontally
  private origin: canvas.Point; // start of axis line on canvas for graphing area

  private _barWidth = 1; // width of each bar on the canvas
  private _barGap = 1; // number of empty spaces between each bar on the canvas
  private barIndices: number[]; // size of graphing area, index value is which bar will be drawn
  private labelWidth = 0; // columns reserved for labels when horizontal with axis

  private max = 1; // expected maximum data value (>= 0)
  private min = 0; // expected minimum data value (<= 0); 0 unless data goes negative
  private posCells = 0; // cells of graph length for values above zero
  private negCells = 0; // cells of graph length for values below zero
  private sf = 1; // scale factor
  private _data: DataSet[] = []; // each index is a unique bar

  private _zoneManager: ZoneManager | null = null; // provides mouse functionality
  private _zoneID = '';

  /** Use New(w, h, ...opts). */
  constructor(w: number, h: number) {
    this.canvas = canvas.New(w, h);
    this.origin = { x: 0, y: h - 2 };
    this.barIndices = new Array<number>(Math.max(0, w)).fill(0);
    this.resetScale();
  }

  // newDataSet returns a new initialized DataSet.
  private newDataSet(lv: BarData): DataSet {
    const ds: DataSet = {
      bd: lv,
      buf: NewFloat64ScaleBuffer(0, this.sf),
    };
    for (const v of lv.values) ds.buf.push(v.value);
    return ds;
  }

  // graphLength returns the number of cells available for bars along the
  // value direction: canvas height less the axis and label rows for vertical
  // bars, or canvas width less the label columns and axis column for
  // horizontal bars.
  private graphLength(): number {
    let l: number;
    if (this._horizontal) {
      l = this.canvas.width() - this.labelWidth;
      if (this._showAxis) l--;
    } else {
      l = this.canvas.height();
      if (this._showAxis) l -= 2;
    }
    return Math.max(l, 0);
  }

  // axisOffset returns 1 when an axis line occupies a cell between the
  // positive and negative bar regions, otherwise 0.
  private axisOffset(): number {
    return this._showAxis ? 1 : 0;
  }

  // resetScale splits the graph length between values above and below zero,
  // recomputes the scale factor so both extremes fit, places the origin
  // (the axis cell, or the first positive cell when no axis is shown), and
  // rescales all existing data sets.
  // With only one drawable cell, the larger side receives it (positive wins
  // ties); the other side is clipped without reducing the shared scale to zero.
  private resetScale(): void {
    const length = this.graphLength();
    this.posCells = length;
    this.negCells = 0;
    const rng = this.max - this.min;
    if (this.min < 0 && rng > 0) {
      this.posCells = goInt(roundHalfAway((length * this.max) / rng));
      if (this.max > 0 && this.posCells === 0 && length > 1) this.posCells = 1;
      this.negCells = length - this.posCells;
      if (this.negCells === 0 && length > 1) {
        this.negCells = 1;
        this.posCells--;
      }
    }
    if (this.min < 0 && this.max > 0 && this.posCells > 0 && this.negCells > 0) {
      this.sf = Math.min(this.posCells / this.max, this.negCells / -this.min);
    } else if (this.min < 0 && this.negCells > 0) {
      this.sf = this.negCells / -this.min;
    } else if (this.max > 0) {
      this.sf = this.posCells / this.max;
    } else {
      this.sf = 0;
    }
    if (this._horizontal) {
      this.origin = { x: this.labelWidth + this.negCells, y: 0 };
    } else {
      this.origin = { x: 0, y: this.posCells };
    }
    for (const ds of this._data) ds.buf.setScale(this.sf);
  }

  // resetOrigin recomputes the space reserved for labels. The origin itself
  // is placed by resetScale, which callers invoke next.
  private resetOrigin(): void {
    this.labelWidth = 0;
    if (this._showAxis && this._horizontal) {
      for (const ds of this._data) {
        const lw = goLen(ds.bd.label);
        if (lw > this.labelWidth) this.labelWidth = lw;
      }
    }
  }

  // resetBarWidth will recalculate the width of each bar such that
  // the bars will fill up the graph if autoBarWidth is enabled.
  private resetBarWidth(): void {
    if (this.autoBarWidth) {
      let graphSize = this.canvas.width();
      if (this._horizontal) graphSize = this.canvas.height();
      const dLen = this._data.length;
      const gaps = (dLen - 1) * this._barGap; // total space used by gaps
      const size = graphSize - gaps; // total available space for bars
      if (dLen > 0) this._barWidth = Math.trunc(size / dLen); // each bar width
    }
  }

  // resetBarIndices will reset the barIndices
  // containing with bar to display for that row or column.
  // If autoBarWidth is enabled, then will recompute
  // the bar widths such that the bars are as wide as possible
  // to fit the graph with the given bar gap.
  // It is possible that the bar widths and bar gap is such
  // that the bars do not all fit on the graph.
  private resetBarIndices(): void {
    this.resetBarWidth();
    if (this._horizontal) {
      if (this.barIndices.length !== this.canvas.height()) {
        this.barIndices = new Array<number>(this.canvas.height()).fill(0);
      }
    } else if (this.barIndices.length !== this.canvas.width()) {
      this.barIndices = new Array<number>(this.canvas.width()).fill(0);
    }
    this.barIndices.fill(-1); // reset indices; -1 indicates no bar
    let barIdx = 0;
    const barCount = this._data.length; // number of bars to display
    const end = this.barIndices.length;
    for (let i = 0; i < end; i += this._barWidth) {
      let j = i;
      const jEnd = i + this._barWidth;
      while (j < jEnd) {
        this.barIndices[j] = barIdx;
        j++;
        if (j >= end) break;
      }
      barIdx++;
      if (barIdx >= barCount) break;
      i += this._barGap;
    }
  }

  /**
   * Resize will change barchart display width and height.
   * Existing data values will be updated to new scaling.
   */
  resize(w: number, h: number): void {
    this.canvas.resize(w, h);
    this.canvas.viewWidth = w;
    this.canvas.viewHeight = h;
    this.resetOrigin();
    this.resetScale();
    this.resetBarIndices();
  }

  /** Clear will reset barchart canvas and data. */
  clear(): void {
    this.canvas.clear();
    this._data = [];
    if (this.autoMaxValue) {
      this.max = 1;
      this.min = 0;
      this.resetScale();
    }
  }

  /**
   * SetZoneManager enables mouse functionality
   * by setting a bubblezone Manager to the barchart.
   * To disable mouse functionality after enabling, call setZoneManager(null).
   */
  setZoneManager(zm: ZoneManager | null): void {
    this._zoneManager = zm;
    if (zm != null && this._zoneID === '') this._zoneID = zm.newPrefix();
  }

  /** ZoneManager will return barchart zone Manager. */
  zoneManager(): ZoneManager | null {
    return this._zoneManager;
  }

  /** ZoneID will return barchart zone ID used by zone Manager. */
  zoneID(): string {
    return this._zoneID;
  }

  /**
   * SetZoneID sets the zone ID the barchart marks its view with, instead of the
   * unique prefix the zone Manager hands out by default. This is an addition to
   * upstream: with a fixed ID, code that shares zone IDs between sessions or
   * programs needs no mapping. The ID is used as is, so it must be unique among
   * the zones of one Manager, and it works in either order with setZoneManager().
   * An empty ID goes back to a generated prefix once a Manager is set.
   */
  setZoneID(id: string): void {
    this._zoneID = id;
    if (id === '' && this._zoneManager != null) this._zoneID = this._zoneManager.newPrefix();
  }

  /** Width returns barchart width. */
  width(): number {
    return this.canvas.width();
  }

  /** Height returns barchart height. */
  height(): number {
    return this.canvas.height();
  }

  /**
   * Data returns a copy of the bar data currently stored in the model, in the
   * order the bars were pushed. Modifying the returned array does not affect
   * the model's internal state.
   */
  data(): BarData[] {
    return this._data.map((ds) => ({
      ...ds.bd,
      values: ds.bd.values.map((v) => ({ ...v })),
    }));
  }

  /** MaxValue returns expected maximum data value. */
  maxValue(): number {
    return this.max;
  }

  /**
   * MinValue returns expected minimum data value.
   * It is 0 unless negative values were pushed or setMin was called.
   */
  minValue(): number {
    return this.min;
  }

  /** Scale returns data scaling factor. */
  scale(): number {
    return this.sf;
  }

  /** BarGap returns number of empty spaces between bars. */
  barGap(): number {
    return this._barGap;
  }

  /** BarWidth returns the bar width drawn for each bar. */
  barWidth(): number {
    return this._barWidth;
  }

  /** ShowAxis returns whether drawing axis and labels on to the barchart canvas. */
  showAxis(): boolean {
    return this._showAxis;
  }

  /** Horizontal returns whether displaying bars horizontally. */
  horizontal(): boolean {
    return this._horizontal;
  }

  /**
   * BarDataFromPoint returns a possible BarData containing
   * all BarValues drawn for the rune on the barchart canvas
   * at the given Point. Points on the positive side of the axis
   * match positive segments; points on the negative side match
   * negative segments.
   */
  barDataFromPoint(p: canvas.Point): BarData {
    const r: BarData = { label: '', values: [] };
    if (p.x < 0 || p.x >= this.canvas.width() || p.y < 0 || p.y >= this.canvas.height()) return r;
    let bIdx: number;
    let posIdx: number;
    let negIdx: number; // which bar; distance into the positive / negative stack
    if (this._horizontal) {
      bIdx = p.y;
      posIdx = p.x - (this.origin.x + this.axisOffset());
      negIdx = this.origin.x - 1 - p.x;
    } else {
      bIdx = p.x;
      posIdx = this.origin.y - 1 - p.y;
      negIdx = p.y - (this.origin.y + this.axisOffset());
    }
    if (bIdx < 0 || bIdx >= this.barIndices.length) return r;
    const idx = this.barIndices[bIdx];
    if (idx < 0 || idx >= this._data.length) return r;
    r.label = this._data[idx].bd.label;
    const negative = posIdx < 0;
    let want = posIdx;
    let limit = this.posCells;
    if (negative) {
      want = negIdx;
      limit = this.negCells;
    }
    if (want < 0 || want >= limit) return r; // axis, labels, or outside the drawable region
    // walk the scaled values on the selected side of the axis and
    // return all values that can be drawn onto that point on the canvas
    const v = this._data[idx].bd.values;
    const sv = this._data[idx].buf.readAll();
    let sum = 0;
    for (let i = 0; i < sv.length; i++) {
      const f = sv[i];
      if (f < 0 !== negative) continue;
      const newSum = sum + Math.abs(f);
      // Match the drawers' nearest-eighth rounding and exclude the cell
      // immediately beyond an exact integer endpoint.
      const start = roundHalfAway(sum * 8) / 8;
      const end = roundHalfAway(newSum * 8) / 8;
      if (start < end && start < want + 1 && want < end) r.values.push(v[i]);
      sum = newSum;
    }
    return r;
  }

  /**
   * SetHorizontal will either enable or disable drawing
   * bars horizontally on to the barchart canvas.
   */
  setHorizontal(b: boolean): void {
    this._horizontal = b;
    this.resetOrigin();
    this.resetScale();
    this.resetBarIndices();
  }

  /**
   * SetShowAxis will either enable or disable drawing
   * axis and labels on to the barchart canvas.
   */
  setShowAxis(b: boolean): void {
    this._showAxis = b;
    this.resetOrigin();
    this.resetScale();
  }

  /**
   * SetBarWidth will set the bar width drawn of each bar.
   * If autoBarWidth is enabled, then this method will do nothing.
   */
  setBarWidth(w: number): void {
    if (this.autoBarWidth) return;
    this._barWidth = w;
    if (this._barWidth < 1) this._barWidth = 1;
    this.resetBarIndices();
  }

  /** SetBarGap will set the number of empty spaces between each bar. */
  setBarGap(g: number): void {
    this._barGap = g;
    if (this._barGap < 0) this._barGap = 0;
    this.resetBarIndices();
  }

  /**
   * SetMax will update the expected maximum values and scale factor.
   * Existing values will be updated to new scaling.
   */
  setMax(f: number): void {
    this.max = f;
    this.resetScale();
  }

  /**
   * SetMin will update the expected minimum value and scale factor.
   * Values above 0 are clamped to 0 so the axis always sits at zero.
   * Existing values will be updated to new scaling.
   */
  setMin(f: number): void {
    this.min = Math.min(f, 0);
    this.resetScale();
  }

  /**
   * Push adds given BarData to barchart data set.
   * Positive values stack away from the axis in one direction and negative
   * values in the other. If autoMaxValue is enabled, the expected maximum
   * and minimum grow to fit the bar's positive and negative sums.
   * Data will be scaled using the expected range and barchart size.
   */
  push(lv: BarData): void {
    let posSum = 0;
    let negSum = 0; // assumes no overflow
    for (const v of lv.values) {
      if (v.value < 0) negSum += v.value;
      else posSum += v.value;
    }
    if (this.autoMaxValue) {
      let rescale = false;
      if (posSum > this.max) {
        this.max = posSum;
        rescale = true;
      }
      if (negSum < this.min) {
        this.min = negSum;
        rescale = true;
      }
      if (rescale) this.resetScale();
    }
    this._data.push(this.newDataSet(lv));
    this.resetBarIndices();
  }

  /**
   * PushAll adds all data values in BarData[] to barchart data set.
   * See push for how negative values are handled.
   * Data will be scaled using the expected range and barchart size.
   */
  pushAll(lv: BarData[]): void {
    for (const v of lv) this.push(v);
  }

  /**
   * Draw will display the the scaled data values as bars on to the barchart canvas.
   * The order of the bars will be displayed from left to right, or from top to bottom
   * in the same order as the data was inserted.
   */
  draw(): void {
    this.canvas.clear();
    this.drawAxisAndLabels();
    this.drawBars();
  }

  // drawBars draws each bar's positive segments away from the axis in one
  // direction (up, or right) and its negative segments in the other (down,
  // or left). Vertical bars are laid out left to right and horizontal bars
  // top to bottom, in insertion order.
  private drawBars(): void {
    const dLen = this._data.length;
    for (let i = 0; i < this.barIndices.length; i++) {
      const b = this.barIndices[i];
      if (b < 0 || b >= dLen) continue;
      const v = this._data[b].buf.readAll();
      const pos: number[] = [];
      const neg: number[] = []; // indices of segments on each side of the axis
      for (let j = 0; j < v.length; j++) {
        if (v[j] < 0) neg.push(j);
        else pos.push(j);
      }
      this.drawStack(i, pos, v, this._data[b].bd.values, false);
      this.drawStack(i, neg, v, this._data[b].bd.values, true);
    }
  }

  // drawStack draws one side of a bar. Segments are drawn from the outermost
  // (the full stacked length, in the last segment's style) to the innermost,
  // so each shorter draw overlays the previous one and the boundary cells
  // blend the two adjacent colors.
  private drawStack(i: number, idx: number[], v: number[], s: BarValue[], negative: boolean): void {
    const limit = negative ? this.negCells : this.posCells;
    let sum = 0;
    for (const j of idx) sum += Math.abs(v[j]);
    const last = idx.length - 1;
    for (let k = last; k >= 0; k--) {
      const j = idx[k];
      // Upstream, for k+1 < last on the positive side, calls
      // style.Background(prev.GetForeground()) "to avoid a gap in the
      // column". lipgloss v2 setters return a new Style, so that result is
      // discarded and has no effect; the port keeps it a no-op.
      const style = s[j].style ?? defaultStyle;
      const length = Math.min(sum, limit);
      if (this._horizontal && negative) {
        graph.DrawRowRightToLeft(this.canvas, { x: this.origin.x - 1, y: i }, length, style);
      } else if (this._horizontal) {
        graph.DrawRowLeftToRight(this.canvas, { x: this.origin.x + this.axisOffset(), y: i }, length, style);
      } else if (negative) {
        graph.DrawColumnTopToBottom(this.canvas, { x: i, y: this.origin.y + this.axisOffset() }, length, style);
      } else {
        graph.DrawColumnBottomToTop(this.canvas, { x: i, y: this.origin.y - 1 }, length, style);
      }
      sum -= Math.abs(v[j]);
    }
  }

  // drawAxisAndLabels will draw axis and labels
  // on to the barchart for horizontal or vertical bars
  private drawAxisAndLabels(): void {
    if (!this._showAxis) return;
    if (this._horizontal) {
      graph.DrawVerticalLineDown(this.canvas, this.origin, this.axisStyle);
    } else {
      graph.DrawHorizonalLineRight(this.canvas, this.origin, this.axisStyle);
    }
    // attempt to draw the label under the axis for each bar
    // the label string width will be bound by the bar width
    let lastIdx = -1;
    const dLen = this._data.length;
    for (let i = 0; i < this.barIndices.length; i++) {
      const b = this.barIndices[i];
      if (b >= 0 && b < dLen) {
        if (b !== lastIdx) {
          let l = this._data[b].bd.label;
          let p: canvas.Point = { x: i, y: this.canvas.height() - 1 }; // labels sit on the bottom row
          if (this._horizontal) {
            if (goLen(l) > this.labelWidth) l = goSliceBytes(l, this.labelWidth);
            p = { x: 0, y: i };
          } else if (goLen(l) > this._barWidth) {
            l = goSliceBytes(l, this._barWidth);
          }
          this.canvas.setStringWithStyle(p, l, this.labelStyle);
          lastIdx = b;
        }
      }
    }
  }

  init(): Cmd {
    return this.canvas.init();
  }

  /** Update forwards bubbletea Msg to underlying canvas. */
  update(msg: Msg): [Model, Cmd] {
    const [, cmd] = this.canvas.update(msg);
    return [this, cmd];
  }

  /** View returns a string used by the bubbletea framework to display the barchart. */
  view(): string {
    let r = this.canvas.view();
    if (this._zoneManager != null) r = this._zoneManager.mark(this._zoneID, r);
    return r;
  }

  /** Alias of view(). */
  toString(): string {
    return this.view();
  }
}

/**
 * New returns a barchart Model initialized with given width, height
 * and various options.
 * By default, barchart will automatically scale bar to new maximum
 * (and minimum, when values are negative) data values,
 * bar width to fill up the canvas and have one gap between bars, and display
 * bars vertically. When any value is negative the axis moves away from the
 * edge so that bars can extend both above and below (or right and left of) it.
 * If the given data values are too small compared to the max value,
 * then it is possible that the rendering of the bars will not be accurate
 * in terms of proportions due to the limitations of the block element runes.
 */
export function New(w: number, h: number, ...opts: Option[]): Model {
  const m = new Model(w, h);
  for (const opt of opts) opt(m);
  return m;
}
