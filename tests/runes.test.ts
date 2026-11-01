// Port of canvas/runes/runes_test.go (ntcharts v2.9.0).
import { describe, expect, test } from 'bun:test';
import * as r from '../src/canvas/runes/runes.js';

describe('runes', () => {
  test('TestInverseLowerBlockElement', () => {
    const cases: [string, string][] = [
      [r.Null, r.FullBlock],
      [r.FullBlock, r.Null],
      [r.LowerBlockOne, r.LowerBlockSeven],
      [r.LowerBlockFour, r.LowerBlockFour],
      [r.LowerBlockSeven, r.LowerBlockOne],
      ['x', r.Null],
    ];
    for (const [input, want] of cases) {
      expect(r.InverseLowerBlockElement(input)).toBe(want);
    }
  });

  test('TestInverseLeftBlockElement', () => {
    const cases: [string, string][] = [
      [r.Null, r.FullBlock],
      [r.FullBlock, r.Null],
      [r.LeftBlockOne, r.LeftBlockSeven],
      [r.LeftBlockFour, r.LeftBlockFour],
      [r.LeftBlockSeven, r.LeftBlockOne],
      ['x', r.Null],
    ];
    for (const [input, want] of cases) {
      expect(r.InverseLeftBlockElement(input)).toBe(want);
    }
  });

  test('TestQuadrantBlock', () => {
    // index bits: upper-left=8, upper-right=4, lower-left=2, lower-right=1
    const want = [' ', '▗', '▖', '▄', '▝', '▐', '▞', '▟', '▘', '▚', '▌', '▙', '▀', '▜', '▛', '█'];
    want.forEach((w0, i) => {
      const w = w0 === ' ' ? r.Null : w0;
      const ul = (i & 8) !== 0;
      const ur = (i & 4) !== 0;
      const ll = (i & 2) !== 0;
      const lr = (i & 1) !== 0;
      expect(r.QuadrantBlock(ul, ur, ll, lr)).toBe(w);
    });
  });
});
