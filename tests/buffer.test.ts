// Port of canvas/buffer/buffer_test.go (ntcharts v2.9.0).
import { describe, expect, test } from 'bun:test';
import { Float64PointMul, type Float64Point } from '../src/canvas/index.js';
import {
  NewFloat64PointScaleBuffer,
  NewFloat64ScaleBuffer,
  NewFloat64ScaleRingBuffer,
} from '../src/canvas/buffer/buffer.js';

const tolerance = 1e-9;

// floatEquals checks if two numbers are equal within tolerance (relative to their mean).
function floatEquals(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const mean = Math.abs(a + b) / 2.0;
  return diff / mean < tolerance;
}

const rand = (max: number): number => Math.random() * max;

describe('buffer', () => {
  test('TestFloat64ScaleRingBuffer', () => {
    const offset = 10.0;
    const sz = 5;
    const scale = 0.5;
    const buf = NewFloat64ScaleRingBuffer(sz, offset, scale);
    expect(buf.size()).toBe(5);
    expect(buf.length()).toBe(0);
    expect(buf.offset()).toBe(offset);
    expect(buf.scale()).toBe(scale);
    const n = 23;
    const max = 100.0;
    const seq: number[] = [];
    for (let i = 0; i < n; i++) seq.push(rand(max));
    // fill before reaching capacity
    for (let i = 0; i < 2; i++) buf.push(seq[i]);
    expect(buf.length()).toBe(2);
    buf.readAllRaw().forEach((v, i) => expect(v).toBe(seq[i]));
    buf.readAll().forEach((v, i) => expect(floatEquals(v, (seq[i] - offset) * scale)).toBe(true));
    buf.pop();
    expect(buf.length()).toBe(1);
    // fill reaching capacity
    for (let i = 2; i < 6; i++) buf.push(seq[i]);
    expect(buf.length()).toBe(5);
    buf.readAllRaw().forEach((v, i) => expect(v).toBe(seq[i + 1]));
    buf.readAll().forEach((v, i) => expect(floatEquals(v, (seq[i + 1] - offset) * scale)).toBe(true));
    // fill rest
    for (let i = 5; i < n; i++) buf.push(seq[i]);
    expect(buf.length()).toBe(5);
    const seqIdx = n - buf.length();
    buf.readAllRaw().forEach((v, i) => expect(v).toBe(seq[seqIdx + i]));
    buf.readAll().forEach((v, i) => expect(floatEquals(v, (seq[seqIdx + i] - offset) * scale)).toBe(true));
    // empty after clear
    buf.clear();
    expect(buf.readAllRaw().length).toBe(0);
    // contains values after clear
    for (let i = 0; i < buf.size(); i++) buf.push(seq[i]);
    buf.readAllRaw().forEach((v, i) => expect(v).toBe(seq[i]));
    buf.readAll().forEach((v, i) => expect(floatEquals(v, (seq[i] - offset) * scale)).toBe(true));
    buf.pop();
    buf.pop();
    buf.readAllRaw().forEach((v, i) => expect(v).toBe(seq[i + 2]));
    buf.readAll().forEach((v, i) => expect(floatEquals(v, (seq[i + 2] - offset) * scale)).toBe(true));
  });

  test('TestFloat64ScaleRingBufferRescale', () => {
    const sz = 5;
    const scale = 0.5;
    const buf = NewFloat64ScaleRingBuffer(sz, 0, scale);

    const n = 15;
    const max = 1000.0;
    const seq: number[] = [];
    for (let i = 0; i < n; i++) {
      seq.push(rand(max));
      buf.push(seq[i]);
    }
    const seqIdx = n - buf.length();
    buf.readAllRaw().forEach((v, i) => expect(v).toBe(seq[seqIdx + i]));
    buf.readAll().forEach((v, i) => expect(floatEquals(v, seq[seqIdx + i] * scale)).toBe(true));

    let newScale = 0.1235;
    buf.setScale(newScale);
    buf.readAll().forEach((v, i) => expect(floatEquals(v, seq[seqIdx + i] * newScale)).toBe(true));

    newScale = 1.8;
    buf.setScale(newScale);
    buf.readAll().forEach((v, i) => expect(floatEquals(v, seq[seqIdx + i] * newScale)).toBe(true));
  });

  test('TestFloat64ScaleBuffer', () => {
    const offset = -10.0;
    const scale = 0.5;
    const buf = NewFloat64ScaleBuffer(offset, scale);
    expect(buf.length()).toBe(0);

    const n = 100;
    const max = 100.0;
    const seq: number[] = [];
    for (let i = 0; i < n; i++) {
      const y = rand(max);
      seq.push(y);
      buf.push(y);
    }
    expect(buf.length()).toBe(n);
    expect(buf.offset()).toBe(offset);
    expect(buf.scale()).toBe(scale);
    seq.forEach((v, i) => {
      expect(floatEquals((v - offset) * scale, buf.at(i))).toBe(true);
      expect(buf.atRaw(i)).toBe(v);
    });
    buf.pop();
    expect(buf.length()).toBe(n - 1);
    for (let bufIdx = 0; bufIdx < buf.length(); bufIdx++) {
      const seqf = seq[bufIdx + 1];
      expect(floatEquals((seqf - offset) * scale, buf.at(bufIdx))).toBe(true);
      expect(buf.atRaw(bufIdx)).toBe(seqf);
    }

    buf.clear();
    expect(buf.length()).toBe(0);
    buf.setData(seq);
    expect(buf.length()).toBe(n);
    seq.forEach((v, i) => {
      expect(floatEquals((v - offset) * scale, buf.at(i))).toBe(true);
      expect(buf.atRaw(i)).toBe(v);
    });
    for (let i = 0; i < 10; i++) buf.pop();
    for (let bufIdx = 0; bufIdx < buf.length(); bufIdx++) {
      const seqf = seq[bufIdx + 10];
      expect(floatEquals((seqf - offset) * scale, buf.at(bufIdx))).toBe(true);
      expect(buf.atRaw(bufIdx)).toBe(seqf);
    }
  });

  test('TestFloat64ScaleBufferRescale', () => {
    const offset = 20.0;
    const scale = 0.22;
    const buf = NewFloat64ScaleBuffer(offset, scale);

    const n = 100;
    const max = 560.0;
    const seq: number[] = [];
    for (let i = 0; i < n; i++) {
      const y = rand(max);
      seq.push(y);
      buf.push(y);
    }
    seq.forEach((v, i) => {
      expect(floatEquals((v - offset) * scale, buf.at(i))).toBe(true);
      expect(buf.atRaw(i)).toBe(v);
    });

    let newScale = 2.34;
    buf.setScale(newScale);
    seq.forEach((v, i) => {
      expect(floatEquals((v - offset) * newScale, buf.at(i))).toBe(true);
      expect(buf.atRaw(i)).toBe(v);
    });

    newScale = 0.25;
    buf.setScale(newScale);
    seq.forEach((v, i) => {
      expect(floatEquals((v - offset) * newScale, buf.at(i))).toBe(true);
      expect(buf.atRaw(i)).toBe(v);
    });
  });

  test('TestFloat64PointScaleBuffer', () => {
    const sf = 0.5;
    const scale: Float64Point = { x: sf, y: sf };
    const add: Float64Point = { x: 0, y: 0 };
    const buf = NewFloat64PointScaleBuffer(add, scale);
    expect(buf.length()).toBe(0);

    const n = 100;
    const max = 100.0;
    const seq: Float64Point[] = [];
    for (let i = 0; i < n; i++) {
      const f = { x: rand(max), y: rand(max) };
      seq.push(f);
      buf.push(f);
    }
    expect(buf.length()).toBe(n);
    seq.forEach((v, i) => {
      expect(buf.at(i)).toEqual(Float64PointMul(v, scale));
      expect(buf.atRaw(i)).toEqual(v);
    });
    buf.pop();
    expect(buf.length()).toBe(n - 1);
    for (let bufIdx = 0; bufIdx < buf.length(); bufIdx++) {
      const seqf = seq[bufIdx + 1];
      expect(buf.at(bufIdx)).toEqual(Float64PointMul(seqf, scale));
      expect(buf.atRaw(bufIdx)).toEqual(seqf);
    }

    buf.clear();
    expect(buf.length()).toBe(0);
    buf.setData(seq);
    expect(buf.length()).toBe(n);
    seq.forEach((v, i) => {
      expect(buf.at(i)).toEqual(Float64PointMul(v, scale));
      expect(buf.atRaw(i)).toEqual(v);
    });
    for (let i = 0; i < 10; i++) buf.pop();
    for (let bufIdx = 0; bufIdx < buf.length(); bufIdx++) {
      const seqf = seq[bufIdx + 10];
      expect(buf.at(bufIdx)).toEqual(Float64PointMul(seqf, scale));
      expect(buf.atRaw(bufIdx)).toEqual(seqf);
    }
  });

  test('TestFloat64PointScaleBufferRescale', () => {
    const sf = 0.22;
    const scale: Float64Point = { x: sf, y: sf };
    const add: Float64Point = { x: 0, y: 0 };
    const buf = NewFloat64PointScaleBuffer(add, scale);

    const n = 100;
    const max = 560.0;
    const seq: Float64Point[] = [];
    for (let i = 0; i < n; i++) {
      const f = { x: rand(max), y: rand(max) };
      seq.push(f);
      buf.push(f);
    }
    seq.forEach((v, i) => {
      expect(buf.at(i)).toEqual(Float64PointMul(v, scale));
      expect(buf.atRaw(i)).toEqual(v);
    });

    let nsf = 2.34;
    let newScale: Float64Point = { x: nsf, y: nsf };
    buf.setScale(newScale);
    seq.forEach((v, i) => {
      expect(buf.at(i)).toEqual(Float64PointMul(v, newScale));
      expect(buf.atRaw(i)).toEqual(v);
    });

    nsf = 0.25;
    newScale = { x: nsf, y: nsf };
    buf.setScale(newScale);
    seq.forEach((v, i) => {
      expect(buf.at(i)).toEqual(Float64PointMul(v, newScale));
      expect(buf.atRaw(i)).toEqual(v);
    });
  });

  test('TestFloat64PointScaleBufferOffset', () => {
    let offset: Float64Point = { x: 10, y: 20 };
    const scale: Float64Point = { x: 2, y: 3 };
    const b = NewFloat64PointScaleBuffer(offset, scale);
    expect(b.offset()).toEqual(offset);
    offset = { x: 15, y: offset.y };
    b.setOffset(offset);
    expect(b.offset()).toEqual(offset);
    expect(b.scale()).toEqual(scale);
  });
});
