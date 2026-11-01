// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * Package sparkline implements a canvas that displays time series data
 * as a chart with columns moving from right to left.
 *
 * File contains a Model using the bubbletea framework
 * representing the state of the sparkline
 * and options used by the sparkline during initialization with New().
 */

import { Style, newStyle } from '@oakoliver/lipgloss';
import type { Cmd, Msg } from '@oakoliver/bubbletea';
import * as canvas from '../canvas/canvas.js';
import { goInt, roundHalfAway } from '../canvas/canvas.js';
import { Float64ScaleRingBuffer, NewFloat64ScaleRingBuffer } from '../canvas/buffer/buffer.js';
import * as graph from '../canvas/graph/graph.js';
import * as runes from '../canvas/runes/runes.js';

/** Option is used to set options when initializing a sparkline. */
export type Option = (m: Model) => void;

/** Model contains state of a sparkline. */
export class Model {
  /** whether to automatically set max value when adding data */
  autoMaxValue = true;
  /** style applied when drawing columns */
  style: Style = newStyle();
  canvas: canvas.Model;

  /** maximum points to interpolate for lines */
  maxInterpolationPoints = 0;

  private max = 1; // expected maximum data value
  private baseMax = 1; // the maximum last set explicitly: what resetMax() goes back to
  private buf: Float64ScaleRingBuffer; // buffer with size of twice the canvas width

  /** Use New(w, h, ...opts). */
  constructor(w: number, h: number) {
    this.canvas = canvas.New(w, h);
    this.buf = NewFloat64ScaleRingBuffer(2 * w, 0, h / 1);
  }

  /** Width returns sparkline width. */
  width(): number {
    return this.canvas.width();
  }

  /** Height returns sparkline height. */
  height(): number {
    return this.canvas.height();
  }

  /** MaxValue returns expected maximum data value. */
  maxValue(): number {
    return this.max;
  }

  /** Scale returns data scaling factor. */
  scale(): number {
    return this.buf.scale();
  }

  /**
   * SetMax will update the expected maximum values.
   * Existing values will be updated to new scaling.
   */
  setMax(f: number): void {
    this.baseMax = f;
    this.applyMax(f);
  }

  /**
   * ResetMax puts the expected maximum back to the value last set with setMax()
   * or WithMaxValue(), or to 1 if none was set, undoing the growth of the
   * automatic maximum. Existing values are updated to the new scaling.
   * This is an addition to upstream: there, neither Clear() nor anything else
   * lowers the maximum again, so a sparkline reused for new data keeps the
   * scale of the old. Call it after clear() to start over:
   * sl.clear(); sl.resetMax().
   */
  resetMax(): void {
    this.applyMax(this.baseMax);
  }

  // applyMax changes the expected maximum without making it the one resetMax() returns to.
  private applyMax(f: number): void {
    this.max = f;
    this.buf.setScale(this.canvas.height() / this.max);
  }

  /**
   * Resize will change sparkline display width and height.
   * Existing data values will be updated to new scaling.
   * If new width is less than previous width, then
   * older data will be lost after resize.
   */
  resize(w: number, h: number): void {
    this.canvas.resize(w, h);
    this.canvas.viewWidth = w;
    this.canvas.viewHeight = h;
    if (this.buf.size() !== 2 * w) {
      const buf = NewFloat64ScaleRingBuffer(2 * w, 0, h / this.max);
      for (const f of this.buf.readAllRaw()) buf.push(f);
      this.buf = buf;
    } else {
      this.buf.setScale(h / this.max);
    }
  }

  /**
   * Clear will reset sparkline canvas and data.
   * As upstream, it keeps the expected maximum, which grows with the data when
   * autoMaxValue is set: call resetMax() as well to reset the scale.
   */
  clear(): void {
    this.canvas.clear();
    this.buf.clear();
  }

  /**
   * Push adds a data value to sparkline data buffer.
   * Negative values will be treated as the value 0.
   * Data will be scaled using expected max value and sparkline height.
   */
  push(f: number): void {
    const v = Math.max(f, 0);
    if (this.autoMaxValue && v > this.max) this.applyMax(v);
    this.buf.push(v);
  }

  /**
   * PushAll adds all data values in number[] to sparkline data buffer.
   * Negative values will be treated as the value 0.
   * Data will be scaled using expected max value and sparkline height.
   */
  pushAll(f: number[]): void {
    for (const v of f) this.push(v);
  }

  // latest returns up to the n most recent scaled data values.
  private latest(n: number): number[] {
    let d = this.buf.readAll();
    if (d.length > n) d = d.slice(d.length - n);
    return d;
  }

  /**
   * Draw will display the the scaled data values on to the sparkline canvas
   * using columns.
   * Sparkline style will be applied across entire canvas.
   * Columns representing the data will be displayed going from
   * from the bottom to the top and coming from the left to the right of the canvas.
   */
  draw(): void {
    this.drawColumnsOnly();
    this.canvas.setStyle(this.style);
  }

  /**
   * DrawColumnsOnly is the same as Draw except the the style will only be applied
   * to the columns and not to the entire canvas.
   */
  drawColumnsOnly(): void {
    this.canvas.clear();
    const d = this.latest(this.width());
    graph.DrawColumns(this.canvas, { x: this.canvas.width() - d.length, y: this.canvas.height() - 1 }, d, this.style);
  }

  /**
   * DrawBraille will display the the scaled data values on to the sparkline canvas
   * using braille lines.
   * Sparkline style will be applied across entire canvas.
   * Braille lines representing the data will be displayed going from
   * from the bottom to the top and coming from the left to the right of the canvas.
   */
  drawBraille(): void {
    this.canvas.clear();
    const d = this.latest(this.width());
    const dLen = d.length;
    const grid = graph.NewBrailleGrid(this.width(), this.height(), 0, this.width(), 0, this.height()); // Y values already scaled from buffer
    const startX = this.canvas.width() - d.length;
    for (let i = 0; i < dLen; i++) {
      let j = i + 1;
      if (j >= dLen) j = i;
      const gp1 = grid.gridPoint({ x: startX + i, y: d[i] });
      const gp2 = grid.gridPoint({ x: startX + j, y: d[j] });
      const points = graph.GetLinePointsWithLimit(gp1, gp2, this.maxInterpolationPoints);
      for (const p of points ?? []) grid.set(p);
    }
    graph.DrawBraillePatterns(this.canvas, { x: 0, y: 0 }, grid.braillePatterns(), this.style);
    this.canvas.setStyle(this.style);
  }

  /**
   * DrawQuadrants will display the scaled data values on to the sparkline canvas
   * using columns of quadrant block elements, two data values per column.
   * Each value fills the left or right half of a column in steps of half a row.
   * Sparkline style will be applied across entire canvas.
   * Columns representing the data will be displayed going from
   * from the bottom to the top and coming from the left to the right of the canvas.
   */
  drawQuadrants(): void {
    this.drawQuadrantsColumnsOnly();
    this.canvas.setStyle(this.style);
  }

  /**
   * DrawQuadrantsColumnsOnly is the same as DrawQuadrants except the style
   * will only be applied to the columns and not to the entire canvas.
   */
  drawQuadrantsColumnsOnly(): void {
    this.canvas.clear();
    const w = this.width();
    const h = this.height();
    const d = this.latest(2 * w);
    // half rows filled by each half column, with the latest value on the right
    const n: number[] = new Array<number>(Math.max(0, 2 * w)).fill(0);
    for (let i = 0; i < d.length; i++) {
      n[2 * w - d.length + i] = Math.min(goInt(roundHalfAway(d[i] * 2)), 2 * h);
    }
    for (let x = 0; x < w; x++) {
      const l = n[2 * x];
      const r = n[2 * x + 1];
      for (let row = 0; row < h; row++) {
        // row 0 is the bottom row
        const q = runes.QuadrantBlock(l > 2 * row + 1, r > 2 * row + 1, l > 2 * row, r > 2 * row);
        if (q === runes.Null) continue;
        this.canvas.setCell({ x, y: h - 1 - row }, canvas.NewCellWithStyle(q, this.style));
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

  /** View returns a string used by the bubbletea framework to display the sparkline. */
  view(): string {
    return this.canvas.view();
  }

  /** Alias of view(). */
  toString(): string {
    return this.view();
  }
}

/**
 * New returns a sparkline Model initialized with given width, height
 * and various options.
 * By default, sparkline will automatically scale bars to new maximum data values.
 */
export function New(w: number, h: number, ...opts: Option[]): Model {
  const m = new Model(w, h);
  for (const opt of opts) opt(m);
  return m;
}
