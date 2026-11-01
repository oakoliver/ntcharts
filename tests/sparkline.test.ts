// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.
//
// Port of sparkline/sparkline_test.go.
import { describe, expect, test } from 'bun:test';
import { newStyle } from '@oakoliver/lipgloss';
import * as runes from '../src/canvas/runes/runes.js';
import { New, WithMaxValue, WithNoAutoMaxValue, WithStyle } from '../src/sparkline/index.js';

describe('sparkline', () => {
  test('TestNew', () => {
    const w = 30;
    const h = 15;
    const max = 100.0;
    const scale = h / max;

    const sl = New(w, h, WithMaxValue(max));

    expect(sl.width()).toBe(w);
    expect(sl.height()).toBe(h);
    expect(sl.maxValue()).toBe(max);
    expect(sl.scale()).toBe(scale);
  });

  test('TestAutoMaxValue', () => {
    const w = 30;
    const h = 15;
    let max = 81.4;

    const sl = New(w, h);

    sl.push(max / 2);
    let scale = h / (max / 2);
    expect(sl.scale()).toBe(scale); // Scale not correct with AutoMaxValue true after greater value than max

    max = 99.2;
    scale = h / max;
    sl.push(max);
    expect(sl.scale()).toBe(scale);

    sl.push(max / 2);
    scale = h / (max / 2);
    expect(sl.scale()).not.toBe(scale); // Scale changed after lesser value than max

    sl.autoMaxValue = false;
    max = 104.7;
    scale = h / max;
    sl.push(max);
    expect(sl.scale()).not.toBe(scale); // Scale changed with AutoMaxValue false after greater value than max
  });

  test('TestNoAutoMaxValue', () => {
    const w = 30;
    const h = 15;
    const max = 100.0;
    const newMax = 150.0;
    let scale = h / max;

    const sl = New(w, h, WithMaxValue(max), WithNoAutoMaxValue());

    sl.push(max / 2);
    expect(sl.scale()).toBe(scale);

    sl.push(newMax);
    expect(sl.scale()).toBe(scale); // Scale changed with AutoMaxValue false after greater value than max

    sl.autoMaxValue = true;
    scale = h / newMax;
    sl.push(newMax);
    expect(sl.scale()).toBe(scale); // Scale failed to change with AutoMaxValue true after greater value than max
  });
});

// halves returns data values for a sparkline of height h with max value h,
// so each value is measured in rows and halves[i]/2 rows tall.
function halves(...hs: number[]): number[] {
  return hs.map((n) => n / 2);
}

function lines(s: string): string[] {
  return s.split('\n').map((l) => l.replace(/ +$/, ''));
}

function assertView(got: string, want: string[]): void {
  expect(lines(got)).toEqual(want);
}

describe('sparkline quadrants', () => {
  // Example from issue #8: 14 values in 7 columns.
  test('TestDrawQuadrants', () => {
    const sl = New(7, 4, WithMaxValue(4));
    sl.pushAll(halves(8, 7, 7, 5, 7, 5, 3, 7, 7, 8, 1, 5, 3, 3));
    sl.drawQuadrants();
    assertView(sl.view(), ['▙▖▖▗▟', '█▙▙▐█▗', '███▟█▐▄', '█████▟█']);
  });

  test('TestDrawQuadrantsOddCount', () => {
    const sl = New(2, 1, WithMaxValue(1));
    sl.pushAll(halves(2, 1, 2)); // first column only has its right half
    sl.drawQuadrants();
    assertView(sl.view(), ['▐▟']);
  });

  test('TestDrawQuadrantsRoundsToHalfRow', () => {
    const sl = New(1, 1, WithMaxValue(1));
    sl.pushAll([0.2, 0.3]);
    sl.drawQuadrants();
    assertView(sl.view(), ['▗']);
  });

  test('TestDrawQuadrantsColumnsOnly', () => {
    const sl = New(2, 1, WithMaxValue(1), WithStyle(newStyle().foreground(1)));
    sl.pushAll(halves(2, 1));
    sl.drawQuadrantsColumnsOnly();
    const c0 = sl.canvas.cell({ x: 0, y: 0 });
    expect(c0.rune).toBe(runes.Null);
    expect(c0.style.getForeground()).not.toEqual(sl.style.getForeground()); // empty cell styled or filled
    expect(sl.canvas.cell({ x: 1, y: 0 }).rune).toBe(runes.QuadUpperLeftLowerAll);
  });

  // Keeping twice the width of data must not change the existing draw modes.
  test('TestDrawShowsLatestWidthValues', () => {
    const full = New(3, 2, WithMaxValue(2));
    full.pushAll([2, 2, 2, 0.5, 1, 1.5]);
    const recent = New(3, 2, WithMaxValue(2));
    recent.pushAll([0.5, 1, 1.5]);

    full.draw();
    recent.draw();
    expect(full.view()).toBe(recent.view());
    full.drawBraille();
    recent.drawBraille();
    expect(full.view()).toBe(recent.view());
  });

  test('TestResizeKeepsTwiceWidthValues', () => {
    const sl = New(1, 1, WithMaxValue(1));
    sl.resize(2, 1);
    sl.pushAll(halves(1, 2, 1, 2));
    sl.drawQuadrants();
    assertView(sl.view(), ['▟▟']);
  });
});
