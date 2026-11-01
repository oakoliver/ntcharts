// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/** Package buffer contains buffers used with charts. */

import { Float64PointMul, Float64PointSub, type Float64Point } from '../canvas.js';

/**
 * Float64ScaleBuffer is a variable size buffer that stores number data values
 * and a scaled version of the data. Scaling is done by subtracting the offset
 * and multiplying incoming values by a constant scale factor.
 */
export class Float64ScaleBuffer {
  private buf: number[] = []; // original data
  private sbuf: number[] = []; // scaled data
  private _offset: number; // offset to subtract
  private _scale: number; // scaling factor

  constructor(o: number, sc: number) {
    this._offset = o;
    this._scale = sc;
  }

  /** Clear resets buffer contents. */
  clear(): void {
    this.buf = [];
    this.sbuf = [];
  }

  /** Length returns number of data in buffer. */
  length(): number {
    return this.buf.length;
  }

  /** Scale returns scaling factor. */
  scale(): number {
    return this._scale;
  }

  /** ScaleDatum returns a scaled number using internal buffer scaling. */
  scaleDatum(f: number): number {
    return (f - this._offset) * this._scale;
  }

  /** SetScale updates scaling factor and recomputes all scaled data. */
  setScale(sc: number): void {
    this._scale = sc;
    this.sbuf = this.buf.map((v) => this.scaleDatum(v));
  }

  /** Offset returns data value offset. */
  offset(): number {
    return this._offset;
  }

  /** SetOffset updates offset and recomputes all scaled data. */
  setOffset(o: number): void {
    this._offset = o;
    this.sbuf = this.buf.map((v) => this.scaleDatum(v));
  }

  /** Push adds data to the back of the buffer. */
  push(p: number): void {
    this.buf.push(p);
    this.sbuf.push(this.scaleDatum(p));
  }

  /** Pop erases the oldest datum from the buffer. */
  pop(): void {
    this.buf.shift();
    this.sbuf.shift();
  }

  /** SetData sets contents of internal buffer to given number[] and scales the data. */
  setData(d: number[]): void {
    this.buf = d.slice();
    this.sbuf = d.map((p) => this.scaleDatum(p));
  }

  /** ReadAll returns entire scaled data buffer. */
  readAll(): number[] {
    return this.sbuf;
  }

  /** ReadAllRaw returns entire original data buffer. */
  readAllRaw(): number[] {
    return this.buf;
  }

  /** At returns scaled data at index i of buffer. */
  at(i: number): number {
    return this.sbuf[i];
  }

  /** AtRaw returns original data at index i of buffer. */
  atRaw(i: number): number {
    return this.buf[i];
  }
}

/** NewFloat64ScaleBuffer returns a Float64ScaleBuffer with offset o and scale sc. */
export function NewFloat64ScaleBuffer(o: number, sc: number): Float64ScaleBuffer {
  return new Float64ScaleBuffer(o, sc);
}

/**
 * Float64ScaleRingBuffer is a fixed-size ring buffer that stores number data
 * values and a scaled version of the data. Scaling is done by first
 * subtracting the offset and then multiplying incoming values by a constant
 * scale factor. Unlike traditional ring buffers, pushing data to the buffer
 * while at full capacity will erase the oldest datum from the buffer to
 * create room for writing.
 */
export class Float64ScaleRingBuffer {
  private buf: number[]; // original data
  private sbuf: number[]; // scaled data
  private _offset: number; // offset to subtract
  private _scale: number; // scaling factor

  private _length = 0; // number of elements
  private sz: number; // capacity

  private wIdx = 0; // write index
  private rIdx = 0; // read index

  constructor(s: number, o: number, sc: number) {
    this.sz = Math.max(0, s);
    this.buf = new Array<number>(this.sz).fill(0);
    this.sbuf = new Array<number>(this.sz).fill(0);
    this._offset = o;
    this._scale = sc;
  }

  /** Clear resets buffer contents. */
  clear(): void {
    this._length = 0;
    this.wIdx = 0;
    this.rIdx = 0;
  }

  /** Length returns number of data in buffer. */
  length(): number {
    return this._length;
  }

  /** Size returns buffer capacity. */
  size(): number {
    return this.sz;
  }

  /** Scale returns scaling factor. */
  scale(): number {
    return this._scale;
  }

  /** ScaleDatum returns a scaled number using internal buffer scaling. */
  scaleDatum(f: number): number {
    return (f - this._offset) * this._scale;
  }

  /** SetScale updates scaling factor and recomputes all scaled data. */
  setScale(sc: number): void {
    this._scale = sc;
    for (let i = 0; i < this.buf.length; i++) this.sbuf[i] = this.scaleDatum(this.buf[i]);
  }

  /** Offset returns data value offset. */
  offset(): number {
    return this._offset;
  }

  /** SetOffset updates offset and recomputes all scaled data. */
  setOffset(o: number): void {
    this._offset = o;
    for (let i = 0; i < this.buf.length; i++) this.sbuf[i] = this.scaleDatum(this.buf[i]);
  }

  /** Push adds data to the back of the buffer, dropping the oldest datum when full. */
  push(f: number): void {
    if (this.sz === 0) return;
    this.buf[this.wIdx] = f;
    this.sbuf[this.wIdx] = this.scaleDatum(f);
    this.wIdx++;
    if (this.wIdx >= this.sz) this.wIdx = 0;
    if (this._length === this.sz) {
      // on full buffer, just increment read index
      this.rIdx++;
      if (this.rIdx >= this.sz) this.rIdx = 0;
    } else {
      this._length++;
    }
  }

  /** Pop erases the oldest datum from the buffer. */
  pop(): void {
    this.rIdx++;
    if (this.rIdx >= this.sz) this.rIdx = 0;
    this._length--;
  }

  /** ReadAll returns entire scaled data buffer, oldest first. */
  readAll(): number[] {
    return this.getBuffer(this.sbuf);
  }

  /** ReadAllRaw returns entire original data buffer, oldest first. */
  readAllRaw(): number[] {
    return this.getBuffer(this.buf);
  }

  private getBuffer(buf: number[]): number[] {
    const sz = this.sz;
    const ln = this._length;
    let idx = this.rIdx;
    const f: number[] = [];
    for (let i = 0; i < ln; i++) {
      f.push(buf[idx]);
      idx++;
      if (idx >= sz) idx = 0;
    }
    return f;
  }
}

/** NewFloat64ScaleRingBuffer returns a Float64ScaleRingBuffer of capacity s, offset o and scale sc. */
export function NewFloat64ScaleRingBuffer(s: number, o: number, sc: number): Float64ScaleRingBuffer {
  return new Float64ScaleRingBuffer(s, o, sc);
}

/**
 * Float64PointScaleBuffer is a variable size buffer that stores Float64Points
 * and a scaled version of the Float64Points. Scaling is done by subtracting
 * the offset and multiplying incoming (X,Y) coordinates by a constant scale factor.
 */
export class Float64PointScaleBuffer {
  private buf: Float64Point[] = []; // original data
  private sbuf: Float64Point[] = []; // scaled data
  private offsetP: Float64Point; // offset to subtract X,Y values from
  private _scale: Float64Point; // scaling factor for X,Y values

  constructor(o: Float64Point, sc: Float64Point) {
    this.offsetP = { x: o.x, y: o.y };
    this._scale = { x: sc.x, y: sc.y };
  }

  /** Clear resets buffer contents. */
  clear(): void {
    this.buf = [];
    this.sbuf = [];
  }

  /** Length returns number of data in buffer. */
  length(): number {
    return this.buf.length;
  }

  /** Scale returns the Float64Point used to multiply data points by. */
  scale(): Float64Point {
    return { ...this._scale };
  }

  /** ScaleDatum returns a scaled Float64Point using internal buffer scaling. */
  scaleDatum(f: Float64Point): Float64Point {
    return Float64PointMul(Float64PointSub(f, this.offsetP), this._scale);
  }

  /** SetScale updates scaling factor and recomputes all scaled data. */
  setScale(sc: Float64Point): void {
    this._scale = { x: sc.x, y: sc.y };
    this.sbuf = this.buf.map((v) => this.scaleDatum(v));
  }

  /** Offset returns the Float64Point used to subtract data points from. */
  offset(): Float64Point {
    return { ...this.offsetP };
  }

  /** SetOffset updates offsets and recomputes all scaled data. */
  setOffset(o: Float64Point): void {
    this.offsetP = { x: o.x, y: o.y };
    this.sbuf = this.buf.map((v) => this.scaleDatum(v));
  }

  /** Push adds Float64Point data to the back of the buffer. */
  push(p: Float64Point): void {
    this.buf.push(p);
    this.sbuf.push(this.scaleDatum(p));
  }

  /** Pop erases the oldest Float64Point from the buffer. */
  pop(): void {
    this.buf.shift();
    this.sbuf.shift();
  }

  /** SetData sets contents of internal buffer to given Float64Point[] and scales the data. */
  setData(d: Float64Point[]): void {
    this.buf = d.slice();
    this.sbuf = d.map((p) => this.scaleDatum(p));
  }

  /** ReadAll returns entire scaled data buffer. */
  readAll(): Float64Point[] {
    return this.sbuf;
  }

  /** ReadAllRaw returns entire original data buffer. */
  readAllRaw(): Float64Point[] {
    return this.buf;
  }

  /** At returns scaled Float64Point at index i of buffer. */
  at(i: number): Float64Point {
    return this.sbuf[i];
  }

  /** AtRaw returns original Float64Point at index i of buffer. */
  atRaw(i: number): Float64Point {
    return this.buf[i];
  }
}

/** NewFloat64PointScaleBuffer returns a Float64PointScaleBuffer with offset o and scale sc. */
export function NewFloat64PointScaleBuffer(o: Float64Point, sc: Float64Point): Float64PointScaleBuffer {
  return new Float64PointScaleBuffer(o, sc);
}
