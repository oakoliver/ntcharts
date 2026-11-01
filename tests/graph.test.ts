// Port of canvas/graph/graph_test.go, candlestick_wide_test.go and
// candlestick_block_test.go (ntcharts v2.9.0).
import { describe, expect, test } from 'bun:test';
import { newStyle, type Style } from '@oakoliver/lipgloss';
import { New, type Model, type Point } from '../src/canvas/index.js';
import {
  DrawCandlestickBlockBottomToTop,
  DrawCandlestickBottomToTop,
  DrawCandlestickBottomToTopWide,
  DrawColumnTopToBottom,
  DrawRowRightToLeft,
} from '../src/canvas/graph/graph.js';
import * as runes from '../src/canvas/runes/runes.js';

const red = newStyle().foreground('1');
const blue = newStyle().foreground('4');

type Color = ReturnType<Style['getForeground']>;

// expectCell mirrors the Go helper: bg === null means "unset" (lipgloss.NoColor).
function expectCell(m: Model, p: Point, r: string, fg: Color, bg: Color, reverse: boolean): void {
  const c = m.cell(p);
  expect(c.rune).toBe(r);
  expect(c.style.getForeground()).toEqual(fg);
  expect(c.style.getBackground()).toEqual(bg);
  expect(c.style.getReverse()).toBe(reverse);
}

describe('graph', () => {
  test('TestDrawColumnTopToBottom', () => {
    const m = New(1, 5);
    DrawColumnTopToBottom(m, { x: 0, y: 0 }, 2.25, red);
    expectCell(m, { x: 0, y: 0 }, runes.FullBlock, red.getForeground(), null, false);
    expectCell(m, { x: 0, y: 1 }, runes.FullBlock, red.getForeground(), null, false);
    // far end: top quarter in bar color, drawn as the inverse block in reverse video
    expectCell(m, { x: 0, y: 2 }, runes.LowerBlockSix, red.getForeground(), null, true);
    const c = m.cell({ x: 0, y: 3 });
    expect(c.rune === runes.Null || c.rune === ' ').toBe(true); // cell beyond column was drawn
  });

  test('TestDrawColumnTopToBottomZeroAndTiny', () => {
    const m = New(1, 3);
    DrawColumnTopToBottom(m, { x: 0, y: 0 }, 0, red);
    DrawColumnTopToBottom(m, { x: 0, y: 0 }, 0.01, red);
    expect(runes.IsLowerBlockElement(m.cell({ x: 0, y: 0 }).rune)).toBe(false); // zero-length column drew
    DrawColumnTopToBottom(m, { x: 0, y: 0 }, 1, red);
    expectCell(m, { x: 0, y: 0 }, runes.FullBlock, red.getForeground(), null, false);
  });

  test('TestDrawColumnTopToBottomStackedBoundary', () => {
    // Outer (longer) segment first, then the inner segment over it: the
    // boundary cell shows the inner color on top and the outer color below.
    const m = New(1, 5);
    DrawColumnTopToBottom(m, { x: 0, y: 0 }, 3, red);
    DrawColumnTopToBottom(m, { x: 0, y: 0 }, 1.5, blue);
    expectCell(m, { x: 0, y: 0 }, runes.FullBlock, blue.getForeground(), null, false);
    expectCell(m, { x: 0, y: 1 }, runes.LowerBlockFour, red.getForeground(), blue.getForeground(), false);
    expectCell(m, { x: 0, y: 2 }, runes.FullBlock, red.getForeground(), null, false);
  });

  test('TestDrawRowRightToLeft', () => {
    const m = New(5, 1);
    DrawRowRightToLeft(m, { x: 4, y: 0 }, 2.25, red);
    expectCell(m, { x: 4, y: 0 }, runes.FullBlock, red.getForeground(), null, false);
    expectCell(m, { x: 3, y: 0 }, runes.FullBlock, red.getForeground(), null, false);
    // far end: right quarter in bar color, drawn as the inverse block in reverse video
    expectCell(m, { x: 2, y: 0 }, runes.LeftBlockSix, red.getForeground(), null, true);
    const c = m.cell({ x: 1, y: 0 });
    expect(c.rune === runes.Null || c.rune === ' ').toBe(true); // cell beyond row was drawn
  });

  test('TestDrawRowRightToLeftStackedBoundary', () => {
    const m = New(5, 1);
    DrawRowRightToLeft(m, { x: 4, y: 0 }, 3, red);
    DrawRowRightToLeft(m, { x: 4, y: 0 }, 1.5, blue);
    expectCell(m, { x: 4, y: 0 }, runes.FullBlock, blue.getForeground(), null, false);
    expectCell(m, { x: 3, y: 0 }, runes.LeftBlockFour, red.getForeground(), blue.getForeground(), false);
    expectCell(m, { x: 2, y: 0 }, runes.FullBlock, red.getForeground(), null, false);
  });

  describe('TestInverseStackSharedFractionalCell', () => {
    const directions = [
      { name: 'down', draw: DrawColumnTopToBottom, origin: { x: 0, y: 0 }, end: { x: 0, y: 1 }, outerRune: runes.LowerBlockTwo },
      { name: 'left', draw: DrawRowRightToLeft, origin: { x: 2, y: 0 }, end: { x: 1, y: 0 }, outerRune: runes.LeftBlockTwo },
    ];
    const cases = [
      { name: 'outer dominates', inner: 1.25, want: red },
      { name: 'inner dominates', inner: 1.5, want: blue },
      { name: 'tie', inner: 1.375, want: blue },
      { name: 'same extent', inner: 1.75, want: blue },
    ];
    for (const direction of directions) {
      for (const tc of cases) {
        test(`${direction.name}/${tc.name}`, () => {
          const m = New(3, 3);
          direction.draw(m, direction.origin, 1.75, red);
          direction.draw(m, direction.origin, tc.inner, blue);
          expectCell(m, direction.end, direction.outerRune, tc.want.getForeground(), null, true);
          expectCell(m, direction.origin, runes.FullBlock, blue.getForeground(), null, false);
        });
      }
    }
  });

  describe('TestInverseStackThreeSegmentsInFullCell', () => {
    const green = newStyle().foreground('2');
    const cases = [
      { name: 'down', draw: DrawColumnTopToBottom, origin: { x: 0, y: 0 }, end: { x: 0, y: 1 }, want: runes.LowerBlockSix },
      { name: 'left', draw: DrawRowRightToLeft, origin: { x: 2, y: 0 }, end: { x: 1, y: 0 }, want: runes.LeftBlockSix },
    ];
    for (const tc of cases) {
      test(tc.name, () => {
        const m = New(3, 3);
        tc.draw(m, tc.origin, 3, red);
        tc.draw(m, tc.origin, 1.75, green);
        tc.draw(m, tc.origin, 1.25, blue);
        expectCell(m, tc.end, tc.want, red.getForeground(), blue.getForeground(), false);
      });
    }
  });
});

describe('candlestick wide', () => {
  // Width 1 must be exactly the single-column primitive.
  test('TestDrawCandlestickWideWidthOneIdentical', () => {
    const s = newStyle();
    const a = New(5, 5);
    const b = New(5, 5);
    DrawCandlestickBottomToTop(a, { x: 2, y: 4 }, 0.0, 1.0, 3.0, 4.0, s);
    DrawCandlestickBottomToTopWide(b, { x: 2, y: 4 }, 1, 0.0, 1.0, 3.0, 4.0, s);
    expect(a.view()).toBe(b.view());
  });

  // Width 3: side columns carry body rows only; wick rows stay empty there.
  test('TestDrawCandlestickWideThreeColumns', () => {
    const s = newStyle();
    const c = New(5, 5);
    // l=0 -> row 4 (lower wick), body 1..3 -> rows 3..1, h=4 -> row 0 (upper wick)
    DrawCandlestickBottomToTopWide(c, { x: 2, y: 4 }, 3, 0.0, 1.0, 3.0, 4.0, s);

    for (const x of [1, 3]) {
      // side columns
      for (const y of [1, 2, 3]) {
        // body rows
        expect(c.cell({ x, y }).rune).not.toBe(runes.Null);
      }
      for (const y of [0, 4]) {
        // pure wick rows
        expect(c.cell({ x, y }).rune).toBe(runes.Null);
      }
    }
    for (let y = 0; y <= 4; y++) {
      // center column: full candle
      expect(c.cell({ x: 2, y }).rune).not.toBe(runes.Null);
    }
  });

  // Even width renders as next-lower-odd plus one extra column on the right.
  test('TestDrawCandlestickWideEvenWidth', () => {
    const s = newStyle();
    const c = New(6, 5);
    DrawCandlestickBottomToTopWide(c, { x: 2, y: 4 }, 4, 0.0, 1.0, 3.0, 4.0, s);
    // columns 1,2,3,4 covered; column 0 and 5 empty at body row 2
    for (const x of [1, 2, 3, 4]) expect(c.cell({ x, y: 2 }).rune).not.toBe(runes.Null);
    for (const x of [0, 5]) expect(c.cell({ x, y: 2 }).rune).toBe(runes.Null);
  });
});

describe('candlestick block', () => {
  // Block style: body interior full block, boundary cells render the line
  // style's POST-MERGE rune at each junction (full block where the line style
  // upgrades to a full heavy line, half block where it keeps a half-tip), wick
  // cells light line runes (also post-merge where a tip adjoins the body).
  test('TestDrawCandlestickBlockRunes', () => {
    const s = newStyle();
    const c = New(3, 6);
    // l=0.0 -> wick end row 0-from-bottom; body bl=1.0..bh=4.0; h=5.0
    DrawCandlestickBlockBottomToTop(c, { x: 1, y: 5 }, 0.0, 1.0, 4.0, 5.0, s);

    const get = (row: number) => c.cell({ x: 1, y: 5 - row }).rune;
    expect(get(0)).toBe(runes.LineVertical); // frac(l)=0 < 0.5, adjoins body: merged ╷→│
    expect(get(1)).toBe(runes.FullBlock); // body bottom frac 0 < 0.5: merged ╻→┃ → █
    for (const row of [2, 3]) expect(get(row)).toBe(runes.FullBlock);
    expect(get(4)).toBe(runes.LowerBlockFour); // body top frac 0 < 0.5, not merged: ▄ (line ╻)
    expect(get(5)).toBe(runes.LineDown); // top wick end frac 0 < 0.5, not merged: ╷
  });

  // Regression: within a multi-cell body span, a half-block boundary cell
  // must never sit directly below or above a full block in a way that
  // leaves a half-cell slit.
  test('TestDrawCandlestickBlockNoJunctionSlit', () => {
    const s = newStyle();
    const check = (bl: number, bh: number) => {
      const c = New(3, 8);
      const p = { x: 1, y: 7 };
      DrawCandlestickBlockBottomToTop(c, p, bl, bl, bh, bh, s);
      const blf = Math.floor(bl);
      const bhf = Math.floor(bh);
      const get = (row: number) => c.cell({ x: 1, y: p.y - row }).rune;
      for (let row = blf; row <= bhf; row++) {
        if (get(row) !== runes.FullBlock) continue;
        if (row - 1 >= blf) expect(get(row - 1)).not.toBe(runes.LowerBlockFour);
        if (row + 1 <= bhf) expect(get(row + 1)).not.toBe(runes.UpperHalfBlock);
      }
    };
    check(1.2, 3.7); // merged_boundaries
    check(1.7, 3.2); // half_tip_boundaries
  });

  // Same inputs, cell occupancy must match the line primitive exactly: the
  // block style changes glyphs, never geometry.
  test('TestDrawCandlestickBlockOccupancyMatchesLine', () => {
    const s = newStyle();
    const a = New(3, 6);
    const b = New(3, 6);
    DrawCandlestickBottomToTop(a, { x: 1, y: 5 }, 0.4, 1.6, 3.2, 4.8, s);
    DrawCandlestickBlockBottomToTop(b, { x: 1, y: 5 }, 0.4, 1.6, 3.2, 4.8, s);
    for (let row = 0; row <= 5; row++) {
      const la = a.cell({ x: 1, y: 5 - row }).rune !== runes.Null;
      const lb = b.cell({ x: 1, y: 5 - row }).rune !== runes.Null;
      expect(lb).toBe(la);
    }
  });

  // A body confined to one cell renders as a single full block.
  test('TestDrawCandlestickBlockSingleCellBody', () => {
    const s = newStyle();
    const c = New(3, 4);
    DrawCandlestickBlockBottomToTop(c, { x: 1, y: 3 }, 1.0, 1.2, 1.8, 2.0, s);
    expect(c.cell({ x: 1, y: 2 }).rune).toBe(runes.FullBlock);
  });
});
