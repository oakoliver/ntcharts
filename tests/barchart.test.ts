// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.
//
// Port of barchart/barchart_test.go and barchart/barchart_bidirectional_test.go.
import * as barchartNs from '../src/barchart/index.js';
import { describe, expect, test } from 'bun:test';
import { newStyle } from '@oakoliver/lipgloss';
import * as canvas from '../src/canvas/index.js';
import * as runes from '../src/canvas/runes/runes.js';
import {
  New,
  WithHorizontalBars,
  WithMaxValue,
  WithMinValue,
  WithNoAutoBarWidth,
  WithNoAutoMaxValue,
  WithNoAxis,
  WithBarWidth,
  type BarData,
} from '../src/barchart/index.js';

const posStyle = newStyle().foreground(2);
const negStyle = newStyle().foreground(1);

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

// origin is private upstream too (tests are in the same package there).
function origin(bc: ReturnType<typeof New>): canvas.Point {
  return bc['origin'];
}

describe('barchart', () => {
  test('TestBarchart', () => {
    const w = 6;
    const h = 10;
    const bw = 3; // will be auto updated
    let max = 50.0;
    // scale is calculated using origin.Y which is h - 2 when showAxis is true (default)
    let scale = (h - 2) / max;
    const bc = New(w, h, WithMaxValue(max), WithBarWidth(bw));

    expect(bc.width()).toBe(w);
    expect(bc.height()).toBe(h);
    expect(bc.maxValue()).toBe(max);
    expect(bc.scale()).toBe(scale);
    expect(bc.barWidth()).toBe(1);
    expect(bc.barGap()).toBe(1);

    bc.push({
      label: 'LesserThanMaxValue',
      values: [
        { value: 11.1, style: newStyle() },
        { value: 22.1, style: newStyle() },
      ],
    });
    expect(bc.maxValue()).toBe(max); // MaxValue changed when max value did not
    expect(bc.scale()).toBe(scale);
    expect(bc.barWidth()).toBe(w); // BarWidth expected to be graph width when only 1 bar

    max = 66.6;
    scale = (h - 2) / max;
    bc.push({
      label: 'GreaterThanMaxValue',
      values: [
        { value: 11.1, style: newStyle() },
        { value: 22.2, style: newStyle() },
        { value: 33.3, style: newStyle() },
      ],
    });
    expect(bc.maxValue()).toBe(max);
    expect(bc.scale()).toBe(scale);
    expect(bc.barWidth()).toBe(2); // 2 bars w/ 1 gap = [0][0][-1][1][1][-1] graph indices

    bc.push({
      label: 'EqualToMaxValue',
      values: [
        { value: 11.1, style: newStyle() },
        { value: 22.2, style: newStyle() },
        { value: 33.3, style: newStyle() },
      ],
    });
    expect(bc.maxValue()).toBe(max);
    expect(bc.scale()).toBe(scale);
    expect(bc.barWidth()).toBe(1); // 3 bars w/ 1 gap = [0][-1][1][-1][2][-1] graph indices
  });

  test('TestBarNoAutoMaxValue', () => {
    const w = 6;
    const h = 10;
    const max = 50.0;
    const scale = (h - 2) / max;
    const bc = New(w, h, WithMaxValue(max), WithNoAutoMaxValue());

    bc.push({
      label: 'LesserThanMaxValue',
      values: [
        { value: 11.1, style: newStyle() },
        { value: 22.1, style: newStyle() },
      ],
    });
    expect(bc.maxValue()).toBe(max);
    expect(bc.scale()).toBe(scale);

    bc.push({
      label: 'GreaterThanMaxValue',
      values: [
        { value: 11.1, style: newStyle() },
        { value: 22.2, style: newStyle() },
        { value: 33.3, style: newStyle() },
      ],
    });
    expect(bc.maxValue()).toBe(max); // MaxValue changed with AutoMaxValue disabled
    expect(bc.scale()).toBe(scale);
  });

  test('TestBarNoAutoBarWidth', () => {
    const w = 6;
    const h = 10;
    const bw = 3;
    const bc = New(w, h, WithNoAutoBarWidth(), WithBarWidth(bw));

    bc.push({
      label: 'LesserThanMaxValue',
      values: [
        { value: 11.1, style: newStyle() },
        { value: 22.1, style: newStyle() },
      ],
    });
    expect(bc.barWidth()).toBe(bw); // 1 bars w/ 3 bar width and w/ 1 gap = [0][0][0][-1][-1][-1] graph indices

    bc.push({
      label: 'GreaterThanMaxValue',
      values: [
        { value: 11.1, style: newStyle() },
        { value: 22.2, style: newStyle() },
        { value: 33.3, style: newStyle() },
      ],
    });
    expect(bc.barWidth()).toBe(bw); // 2 bars w/ 3 bar width and w/ 1 gap = [0][0][0][-1][1][1] graph indices
  });

  test('TestModelData', () => {
    const bd: BarData[] = [
      { label: 'A', values: [{ name: 'v', value: 10 }] },
      { label: 'B', values: [{ name: 'v', value: 20 }] },
    ];
    const m = New(20, 10);
    m.pushAll(bd);

    const got = m.data();
    expect(got.length).toBe(2);
    expect([got[0].label, got[1].label]).toEqual(['A', 'B']);
    expect([got[0].values[0].value, got[1].values[0].value]).toEqual([10, 20]);

    // Modifying the returned copy does not affect the model.
    got[0].values[0].value = 99;
    got.pop();
    expect(m.data().length).toBe(2);
    expect(m.data()[0].values[0].value).toBe(10);
  });
});

describe('barchart bidirectional', () => {
  test('TestNegativeValuesTrackMin', () => {
    const bc = New(6, 10); // axis shown: graph length is 8 rows
    expect(bc.minValue()).toBe(0);
    bc.push({
      label: 'A',
      values: [
        { value: 30, style: posStyle },
        { value: -20, style: negStyle },
      ],
    });
    expect([bc.minValue(), bc.maxValue()]).toEqual([-20, 30]);
    // 8 rows split 5 positive / 3 negative; scale is the tighter of 5/30 and 3/20.
    expect(near(bc.scale(), 0.15)).toBe(true);
    expect(origin(bc).y).toBe(5); // axis row below 5 positive rows
  });

  test('TestNoAutoMaxValueLeavesMinAlone', () => {
    const bc = New(6, 10, WithNoAutoMaxValue(), WithMaxValue(50), WithMinValue(-30));
    bc.push({ label: 'A', values: [{ value: -100, style: negStyle }] });
    expect(bc.minValue()).toBe(-30);
    // 8 rows split 5/3 for [-30, 50]; scale is min(5/50, 3/30) = 0.1
    expect(near(bc.scale(), 0.1)).toBe(true);
  });

  test('TestSetMinClampsToZero', () => {
    const bc = New(6, 10, WithMinValue(10));
    expect(bc.minValue()).toBe(0); // min cannot exceed zero
  });

  test('TestPositiveOnlyDataIsUnchanged', () => {
    // The existing contract: with only positive data the axis sits at the
    // bottom and scale is (h-2)/max.
    const bc = New(6, 10, WithMaxValue(50));
    bc.push({ label: 'A', values: [{ value: 25, style: posStyle }] });
    expect(near(bc.scale(), 8.0 / 50)).toBe(true);
    expect(origin(bc).y).toBe(8);
    expect(bc.minValue()).toBe(0);
  });

  test('TestDrawVerticalBidirectional', () => {
    const bc = New(1, 10, WithMaxValue(50), WithMinValue(-30), WithNoAutoMaxValue());
    bc.push({
      label: 'A',
      values: [
        { value: 20, style: posStyle },
        { value: -14, style: negStyle },
      ],
    });
    bc.draw();
    // scale 0.1: +20 -> 2 rows above the axis (rows 4,3); -14 -> 1.4 rows below (row 6 full, row 7 partial)
    const x = 0;
    expect(bc.canvas.cell({ x, y: 5 }).rune).toBe(runes.LineHorizontal); // axis row
    for (const y of [4, 3]) expect(bc.canvas.cell({ x, y }).rune).toBe(runes.FullBlock);
    expect(runes.IsLowerBlockElement(bc.canvas.cell({ x, y: 2 }).rune)).toBe(false); // row 2 should be empty
    expect(bc.canvas.cell({ x, y: 6 }).rune).toBe(runes.FullBlock);
    const c7 = bc.canvas.cell({ x, y: 7 });
    expect(c7.style.getReverse()).toBe(true);
    expect(c7.rune).toBe(runes.InverseLowerBlockElement(runes.LowerBlockElementFromFloat64(0.4)));
    expect(runes.IsLowerBlockElement(bc.canvas.cell({ x, y: 8 }).rune)).toBe(false); // row 8 should be empty
    expect(bc.canvas.cell({ x, y: 9 }).rune).toBe('A'); // labels stay on the bottom row
  });

  test('TestDrawVerticalNoAxisBidirectional', () => {
    const bc = New(1, 8, WithNoAxis(), WithMaxValue(50), WithMinValue(-30), WithNoAutoMaxValue());
    bc.push({
      label: 'A',
      values: [
        { value: 50, style: posStyle },
        { value: -30, style: negStyle },
      ],
    });
    bc.draw();
    // 8 rows split 5/3 with no axis row: rows 0-4 positive, rows 5-7 negative.
    for (let y = 0; y < 8; y++) expect(bc.canvas.cell({ x: 0, y }).rune).toBe(runes.FullBlock);
    expect(bc.canvas.cell({ x: 0, y: 4 }).style.getForeground()).toEqual(posStyle.getForeground());
    expect(bc.canvas.cell({ x: 0, y: 5 }).style.getForeground()).toEqual(negStyle.getForeground());
  });

  test('TestDrawHorizontalBidirectional', () => {
    const bc = New(12, 1, WithHorizontalBars(), WithMaxValue(50), WithMinValue(-30), WithNoAutoMaxValue());
    bc.push({
      label: 'A',
      values: [
        { value: 25, style: posStyle },
        { value: -20, style: negStyle },
      ],
    });
    bc.resize(12, 1); // recompute label width from data, as callers do today
    bc.draw();
    // label col 0, graph length 10 split 6 positive / 4 negative, axis at x=5, scale 0.12
    expect(near(bc.scale(), 0.12)).toBe(true);
    expect(origin(bc).x).toBe(5);
    expect(bc.canvas.cell({ x: 0, y: 0 }).rune).toBe('A');
    expect(bc.canvas.cell({ x: 5, y: 0 }).rune).toBe(runes.LineVertical);
    for (const x of [6, 7, 8]) expect(bc.canvas.cell({ x, y: 0 }).rune).toBe(runes.FullBlock); // +25 -> 3 cells right of the axis
    for (const x of [4, 3]) expect(bc.canvas.cell({ x, y: 0 }).rune).toBe(runes.FullBlock); // -20 -> 2.4 cells left of the axis
    const c2 = bc.canvas.cell({ x: 2, y: 0 });
    expect(c2.style.getReverse()).toBe(true);
    expect(c2.rune).toBe(runes.InverseLeftBlockElement(runes.LeftBlockElementFromFloat64(0.4)));
  });

  test('TestBarDataFromPointBothSides', () => {
    const bc = New(1, 10, WithMaxValue(50), WithMinValue(-30), WithNoAutoMaxValue());
    bc.push({
      label: 'A',
      values: [
        { name: 'up', value: 20, style: posStyle },
        { name: 'down', value: -14, style: negStyle },
      ],
    });
    bc.draw();
    let r = bc.barDataFromPoint({ x: 0, y: 4 });
    expect(r.values.map((v) => v.name)).toEqual(['up']); // above axis
    r = bc.barDataFromPoint({ x: 0, y: 7 });
    expect(r.values.map((v) => v.name)).toEqual(['down']); // below axis
    expect(bc.barDataFromPoint({ x: 0, y: 8 }).values.length).toBe(0); // beyond bar

    const hc = New(12, 1, WithHorizontalBars(), WithMaxValue(50), WithMinValue(-30), WithNoAutoMaxValue());
    hc.push({
      label: 'A',
      values: [
        { name: 'right', value: 25, style: posStyle },
        { name: 'left', value: -20, style: negStyle },
      ],
    });
    hc.resize(12, 1);
    hc.draw();
    expect(hc.barDataFromPoint({ x: 7, y: 0 }).values.map((v) => v.name)).toEqual(['right']);
    expect(hc.barDataFromPoint({ x: 3, y: 0 }).values.map((v) => v.name)).toEqual(['left']);
  });

  test('TestBidirectionalOneDrawableCell', () => {
    for (const horizontal of [false, true]) {
      for (const axis of [false, true]) {
        for (const tc of [
          { name: 'positive', max: 2, min: -1, negative: false },
          { name: 'negative', max: 1, min: -2, negative: true },
          { name: 'tie', max: 1, min: -1, negative: false },
        ]) {
          const bc = New(1, 1, WithMaxValue(tc.max), WithMinValue(tc.min), WithNoAutoMaxValue());
          bc.setHorizontal(horizontal);
          bc.setShowAxis(axis);
          let w = 1;
          let h = 1;
          if (axis) {
            if (horizontal) w = 2;
            else h = 3;
          }
          bc.resize(w, h);
          bc.push({
            label: '',
            values: [
              { value: tc.max, style: posStyle },
              { value: tc.min, style: negStyle },
            ],
          });
          bc.draw();
          const where = `${tc.name} horizontal=${horizontal} axis=${axis}`;
          expect(near(bc.scale(), 1 / Math.max(tc.max, -tc.min))).toBe(true);
          const p: canvas.Point = { x: 0, y: 0 };
          if (axis) {
            if (horizontal && !tc.negative) p.x = 1;
            if (!horizontal && tc.negative) p.y = 1;
          }
          const want = tc.negative ? negStyle.getForeground() : posStyle.getForeground();
          const c = bc.canvas.cell(p);
          expect([where, c.rune, c.style.getForeground()]).toEqual([where, runes.FullBlock, want]);
          const hit = bc.barDataFromPoint(p);
          expect(hit.values.length).toBe(1);
          expect(hit.values[0].value < 0).toBe(tc.negative);
        }
      }
    }
  });

  test('TestBidirectionalHitBounds', () => {
    for (const horizontal of [false, true]) {
      const bc = New(1, 7, WithMaxValue(2), WithMinValue(-2), WithNoAutoMaxValue());
      bc.setHorizontal(horizontal);
      bc.push({ label: 'A', values: [{ value: 20 }, { value: -20 }] });
      let w = 1;
      let h = 7;
      if (horizontal) [w, h] = [7, 1];
      bc.resize(w, h);
      bc.draw();
      for (let y = -1; y <= h; y++) {
        for (let x = -1; x <= w; x++) {
          const p = { x, y };
          const c = bc.canvas.cell(p);
          const want = c.rune === runes.FullBlock ? 1 : 0;
          expect([horizontal, x, y, bc.barDataFromPoint(p).values.length]).toEqual([horizontal, x, y, want]);
        }
      }
      bc.clear();
      expect(bc.barDataFromPoint({ x: 0, y: 0 }).values.length).toBe(0);
    }
  });

  test('TestBidirectionalHitRoundedEndpoints', () => {
    for (const value of [1, 1.01, 1.0625, 1.9375, 2]) {
      for (const horizontal of [false, true]) {
        const bc = New(1, 10, WithMaxValue(4), WithMinValue(-4), WithNoAutoMaxValue());
        bc.setHorizontal(horizontal);
        bc.push({ label: '', values: [{ value }, { value: -value }] });
        if (horizontal) bc.resize(9, 1);
        bc.draw();
        for (let y = 0; y < bc.height(); y++) {
          for (let x = 0; x < bc.width(); x++) {
            const p = { x, y };
            const r = bc.canvas.cell(p).rune;
            const want = runes.IsLowerBlockElement(r) || runes.IsLeftBlockElement(r) ? 1 : 0;
            expect([value, horizontal, x, y, bc.barDataFromPoint(p).values.length]).toEqual([value, horizontal, x, y, want]);
          }
        }
      }
    }
  });
});

// Not upstream tests: WithZoneID/setZoneID are an addition.
describe('barchart zone ID', () => {
  const zm = () => {
    let n = 0;
    return { newPrefix: () => `gen${++n}`, mark: (id: string, v: string) => `<${id}>${v}`, get: () => null };
  };

  test('WithZoneID sets a stable ID in either order and skips the generated prefix', () => {
    const a = barchartNs.New(10, 4, barchartNs.WithZoneID('chart'), barchartNs.WithZoneManager(zm()));
    const b = barchartNs.New(10, 4, barchartNs.WithZoneManager(zm()), barchartNs.WithZoneID('chart'));
    expect(a.zoneID()).toBe('chart');
    expect(b.zoneID()).toBe('chart');
    expect(a.view().startsWith('<chart>')).toBe(true);
  });

  test('an empty ID goes back to a generated prefix once there is a manager', () => {
    const m = barchartNs.New(10, 4, barchartNs.WithZoneManager(zm()), barchartNs.WithZoneID(''));
    expect(m.zoneID()).not.toBe(''); // a new prefix, as the manager would hand out
  });
});
