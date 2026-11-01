// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * Package runes contains commonly used runes and functions to obtain runes.
 *
 * In Go a rune is an int32 code point. In this port a rune is a one code
 * point string ('█', '⠁', ...). `Null` ('\u0000') is the empty rune, the zero
 * value of a canvas cell.
 *
 * https://en.wikipedia.org/wiki/Box-drawing_character
 * https://en.wikipedia.org/wiki/Braille_Patterns
 */

/** A single Unicode code point, as a string. */
export type Rune = string;

export const Null: Rune = '\u0000';

export const LineHorizontal: Rune = '─'; // ─
export const LineVertical: Rune = '│'; // │
export const LineVerticalHeavy: Rune = '┃'; // ┃
export const LineDownRight: Rune = '┌'; // ┌
export const LineDownLeft: Rune = '┐'; // ┐
export const LineUpRight: Rune = '└'; // └
export const LineUpLeft: Rune = '┘'; // ┘
export const LineVerticalRight: Rune = '├'; // ├
export const LineVerticalLeft: Rune = '┤'; // ┤
export const LineHorizontalUp: Rune = '┴'; // ┴
export const LineHorizontalDown: Rune = '┬'; // ┬
export const LineHorizontalVertical: Rune = '┼'; // ┼
export const LineLeft: Rune = '╴'; // ╴
export const LineUp: Rune = '╵'; // ╵
export const LineRight: Rune = '╶'; // ╶
export const LineDown: Rune = '╷'; // ╷
export const LineUpHeavy: Rune = '╹'; // ╹
export const LineDownHeavy: Rune = '╻'; // ╻
export const LineUpDownHeavy: Rune = '╽'; // ╽
export const LineUpHeavyDown: Rune = '╿'; // ╿

export const ArcDownRight: Rune = '╭'; // ╭
export const ArcDownLeft: Rune = '╮'; // ╮
export const ArcUpLeft: Rune = '╯'; // ╯
export const ArcUpRight: Rune = '╰'; // ╰

export const UpperHalfBlock: Rune = '▀'; // ▀
export const LowerBlockOne: Rune = '▁'; // ▁
export const LowerBlockTwo: Rune = '▂'; // ▂
export const LowerBlockThree: Rune = '▃'; // ▃
export const LowerBlockFour: Rune = '▄'; // ▄
export const LowerBlockFive: Rune = '▅'; // ▅
export const LowerBlockSix: Rune = '▆'; // ▆
export const LowerBlockSeven: Rune = '▇'; // ▇
export const FullBlock: Rune = '█'; // █
export const LeftBlockSeven: Rune = '▉'; // ▉
export const LeftBlockSix: Rune = '▊'; // ▊
export const LeftBlockFive: Rune = '▋'; // ▋
export const LeftBlockFour: Rune = '▌'; // ▌
export const LeftBlockThree: Rune = '▍'; // ▍
export const LeftBlockTwo: Rune = '▎'; // ▎
export const LeftBlockOne: Rune = '▏'; // ▏

export const RightHalfBlock: Rune = '▐'; // ▐
export const QuadLowerLeft: Rune = '▖'; // ▖
export const QuadLowerRight: Rune = '▗'; // ▗
export const QuadUpperLeft: Rune = '▘'; // ▘
export const QuadUpperLeftLowerAll: Rune = '▙'; // ▙
export const QuadUpperLeftLowerRight: Rune = '▚'; // ▚
export const QuadUpperAllLowerLeft: Rune = '▛'; // ▛
export const QuadUpperAllLowerRight: Rune = '▜'; // ▜
export const QuadUpperRight: Rune = '▝'; // ▝
export const QuadUpperRightLowerLeft: Rune = '▞'; // ▞
export const QuadUpperRightLowerAll: Rune = '▟'; // ▟

/** Code point of a rune ('' counts as Null). */
export function codePoint(r: Rune): number {
  return r.length === 0 ? 0 : (r.codePointAt(0) as number);
}

/** Rune from a code point. */
export function fromCodePoint(c: number): Rune {
  return String.fromCodePoint(c);
}

/** True for Null and the empty string. */
export function isNull(r: Rune): boolean {
  return r === Null || r === '';
}

// quadrantBlocks is indexed by filled quadrants as bits:
// upper-left=8, upper-right=4, lower-left=2, lower-right=1.
const quadrantBlocks: readonly Rune[] = [
  Null, QuadLowerRight, QuadLowerLeft, LowerBlockFour,
  QuadUpperRight, RightHalfBlock, QuadUpperRightLowerLeft, QuadUpperRightLowerAll,
  QuadUpperLeft, QuadUpperLeftLowerRight, LeftBlockFour, QuadUpperLeftLowerAll,
  UpperHalfBlock, QuadUpperAllLowerRight, QuadUpperAllLowerLeft, FullBlock,
];

/**
 * QuadrantBlock returns the block element rune with the given
 * quadrants of a cell filled, or Null if no quadrant is filled.
 */
export function QuadrantBlock(upperLeft: boolean, upperRight: boolean, lowerLeft: boolean, lowerRight: boolean): Rune {
  let i = 0;
  if (upperLeft) i |= 8;
  if (upperRight) i |= 4;
  if (lowerLeft) i |= 2;
  if (lowerRight) i |= 1;
  return quadrantBlocks[i];
}

/*
Braille dot number offsets

Unicode Braille Patterns can be computed by
adding hex values to the beginning block offset

[0][3] = [0x0001][0x0008]
[1][4]   [0x0002][0x0010]
[2][5]   [0x0004][0x0020]
[6][7]   [0x0040][0x0080]
*/

/** Beginning of Unicode Braille Patterns (empty Braille Pattern), as a code point. */
export const BrailleBlockOffset = 0x2800;
/** The empty Braille Pattern rune ('⠀'). */
export const BrailleBlank: Rune = '⠀';

const brailleDotNumberOffsets = [0x0001, 0x0002, 0x0004, 0x0008, 0x0010, 0x0020, 0x0040, 0x0080] as const;

/** PatternDots indicates whether a dot in a Braille Pattern is displayed (8 entries). */
export type PatternDots = boolean[];

/** Returns a new PatternDots with every dot unset. */
export function NewPatternDots(): PatternDots {
  return [false, false, false, false, false, false, false, false];
}

/**
 * PatternDotsGrid is a 2D array where each row and column indicates whether
 * a dot in a sequence of Braille Patterns runes should be displayed.
 *
 *	 width = 4, height = 4 will give 2 Braille Pattern runes
 *	 [0][3][0][3]
 *	 [1][4][1][4]
 *	 [2][5][2][5]
 *	 [6][7][6][7]
 *
 *	setting (0,0) will set Dot 0 of first braille rune
 *	setting (0,3) will set Dot 6 of first braille rune
 *	setting (3,0) will set Dot 3 of second braille rune
 *	setting (3,3) will set Dot 7 of second braille rune
 */
export class PatternDotsGrid {
  private w: number; // grid width
  private h: number; // grid height
  private g: boolean[][] = []; // each index indicates whether to display Braille Pattern dot

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.reset();
  }

  /** Reset will reset the internal grid. */
  reset(): void {
    const h = Math.max(0, this.h);
    const w = Math.max(0, this.w);
    this.g = new Array(h);
    for (let i = 0; i < h; i++) this.g[i] = new Array<boolean>(w).fill(false);
  }

  /** Set will set value in grid at given column and row. */
  set(x: number, y: number): void {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    this.g[y][x] = true;
  }

  /** Unset will unset value in grid at given column and row. */
  unset(x: number, y: number): void {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    this.g[y][x] = false;
  }

  /** BraillePatterns returns a Rune[][] containing Braille Pattern runes based on internal grid values. */
  braillePatterns(): Rune[][] {
    const p: Rune[][] = [];
    for (let y = 0; y < this.h; y += 4) { // each braille pattern rune has a height of 4
      const xb: Rune[] = [];
      for (let x = 0; x < this.w; x += 2) { // each braille pattern rune has a width of 2
        xb.push(this.getBraillePattern(x, y));
      }
      p.push(xb);
    }
    return p;
  }

  // getBraillePattern returns Braille Pattern rune starting at internal grid column and row.
  private getBraillePattern(x: number, y: number): Rune {
    const { w, h, g } = this;
    if (x < 0 || x >= w || y < 0 || y >= h) return Null;
    let b = BrailleBlockOffset;
    // set left side of braille pattern
    if (g[y][x]) b |= brailleDotNumberOffsets[0];
    if (y + 1 < h && g[y + 1][x]) b |= brailleDotNumberOffsets[1];
    if (y + 2 < h && g[y + 2][x]) b |= brailleDotNumberOffsets[2];
    if (y + 3 < h && g[y + 3][x]) b |= brailleDotNumberOffsets[6];
    // set right side of braille pattern
    if (x + 1 < w && g[y][x + 1]) b |= brailleDotNumberOffsets[3];
    if (y + 1 < h && x + 1 < w && g[y + 1][x + 1]) b |= brailleDotNumberOffsets[4];
    if (y + 2 < h && x + 1 < w && g[y + 2][x + 1]) b |= brailleDotNumberOffsets[5];
    if (y + 3 < h && x + 1 < w && g[y + 3][x + 1]) b |= brailleDotNumberOffsets[7];
    return String.fromCodePoint(b);
  }
}

/** NewPatternDotsGrid returns a new initialized PatternDotsGrid. */
export function NewPatternDotsGrid(w: number, h: number): PatternDotsGrid {
  return new PatternDotsGrid(w, h);
}

/** IsBraillePattern returns whether a given rune is considered a Braille Pattern rune. */
export function IsBraillePattern(r: Rune): boolean {
  const c = codePoint(r);
  return c >= 0x2800 && c <= 0x28ff;
}

/**
 * BraillePatternFromPatternDots returns a Braille Pattern rune using given PatternDots.
 * Each index in PatternDots corresponds to Braille dot number
 * and whether the dot should be displayed.
 */
export function BraillePatternFromPatternDots(p: PatternDots): Rune {
  let r = BrailleBlockOffset;
  for (let i = 0; i < 8; i++) {
    if (p[i]) r |= brailleDotNumberOffsets[i];
  }
  return String.fromCodePoint(r);
}

/** SetPatternDots sets given PatternDots dots based on given rune. */
export function SetPatternDots(r: Rune, p: PatternDots): void {
  if (!IsBraillePattern(r)) return;
  const c = codePoint(r);
  brailleDotNumberOffsets.forEach((b, i) => {
    if ((b & c) !== 0) p[i] = true;
  });
}

/**
 * CombineBraillePatterns returns a rune that is a combination of two braille pattern runes.
 * Any invalid braille pattern rune combinations will return r2.
 */
export function CombineBraillePatterns(r1: Rune, r2: Rune): Rune {
  if (!IsBraillePattern(r1) || !IsBraillePattern(r2)) return r2;
  return String.fromCodePoint(codePoint(r1) | codePoint(r2));
}

const lowerBlockElements: readonly Rune[] = [
  Null,
  LowerBlockOne,
  LowerBlockTwo,
  LowerBlockThree,
  LowerBlockFour,
  LowerBlockFive,
  LowerBlockSix,
  LowerBlockSeven,
  FullBlock,
];

/** IsLowerBlockElement returns whether a given rune is considered a lower block or full block element. */
export function IsLowerBlockElement(r: Rune): boolean {
  const c = codePoint(r);
  return c >= 0x2581 && c <= 0x2588;
}

// Number of 1/8 blocks for a fraction, rounding the remainder to the nearest 1/16.
function eighths(f: number): number {
  let e = Math.trunc(f / 0.125); // number of 1/8s blocks to show
  // round remaining fraction smaller than 1/8 to nearest 1/16
  if (f - e * 0.125 >= 0.0625) e++;
  return e;
}

/**
 * LowerBlockElementFromFloat64 returns either an empty rune
 * or a lower Block Element rune using given number.
 * A value < 1.0 will return the nearest one eights lower block element
 * corresponding to the value. An empty rune will be returned if
 * the value does not round to lowest 1/8 lower block.
 */
export function LowerBlockElementFromFloat64(f: number): Rune {
  if (f >= 1) return lowerBlockElements[8];
  if (f <= 0 || Number.isNaN(f)) return lowerBlockElements[0];
  return lowerBlockElements[eighths(f)];
}

/**
 * InverseLowerBlockElement returns the lower block element whose height is
 * the complement of the given rune: Null and FullBlock swap, ▁ becomes ▇,
 * and so on. Drawn in reverse video, the result fills the top of the cell
 * with the foreground color, which is how bars extending below an axis
 * render their fractional end. Returns Null for any other rune.
 */
export function InverseLowerBlockElement(r: Rune): Rune {
  if (isNull(r)) return FullBlock;
  const i = lowerBlockElements.indexOf(r);
  return i >= 0 ? lowerBlockElements[8 - i] : Null;
}

const leftBlockElements: readonly Rune[] = [
  Null,
  LeftBlockOne,
  LeftBlockTwo,
  LeftBlockThree,
  LeftBlockFour,
  LeftBlockFive,
  LeftBlockSix,
  LeftBlockSeven,
  FullBlock,
];

/** IsLeftBlockElement returns whether a given rune is considered a left block or full block element. */
export function IsLeftBlockElement(r: Rune): boolean {
  const c = codePoint(r);
  return c >= 0x2588 && c <= 0x258f;
}

/**
 * LeftBlockElementFromFloat64 returns either an empty rune
 * or a left Block Element rune using given number.
 * A value < 1.0 will return the nearest one eights left block element
 * corresponding to the value. An empty rune will be returned if
 * the value does not round to lowest 1/8 left block.
 */
export function LeftBlockElementFromFloat64(f: number): Rune {
  if (f >= 1) return leftBlockElements[8];
  if (f <= 0 || Number.isNaN(f)) return leftBlockElements[0];
  return leftBlockElements[eighths(f)];
}

/**
 * InverseLeftBlockElement returns the left block element whose width is
 * the complement of the given rune: Null and FullBlock swap, ▏ becomes ▉,
 * and so on. Drawn in reverse video, the result fills the right of the
 * cell with the foreground color, which is how bars extending left of an
 * axis render their fractional end. Returns Null for any other rune.
 */
export function InverseLeftBlockElement(r: Rune): Rune {
  if (isNull(r)) return FullBlock;
  const i = leftBlockElements.indexOf(r);
  return i >= 0 ? leftBlockElements[8 - i] : Null;
}

/** LineStyle enumerates the different style of line runes to display. */
export enum LineStyle {
  ThinLineStyle = 0,
  ArcLineStyle = 1,
}
export const ThinLineStyle = LineStyle.ThinLineStyle;
export const ArcLineStyle = LineStyle.ArcLineStyle;

/** LineSegments indicates whether a line segment going up, down, left, or right is displayed. */
export interface LineSegments {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/** Returns LineSegments with every segment unset. */
export function NewLineSegments(): LineSegments {
  return { up: false, down: false, left: false, right: false };
}

function segKey(l: LineSegments): number {
  return (l.up ? 8 : 0) | (l.down ? 4 : 0) | (l.left ? 2 : 0) | (l.right ? 1 : 0);
}

// indexed by up=8, down=4, left=2, right=1
const arcLineSegments: readonly Rune[] = [
  Null, // ----
  LineRight, // ---R
  LineLeft, // --L-
  LineHorizontal, // --LR
  LineDown, // -D--
  ArcDownRight, // -D-R
  ArcDownLeft, // -DL-
  LineHorizontalDown, // -DLR
  LineUp, // U---
  ArcUpRight, // U--R
  ArcUpLeft, // U-L-
  LineHorizontalUp, // U-LR
  LineVertical, // UD--
  LineVerticalRight, // UD-R
  LineVerticalLeft, // UDL-
  LineHorizontalVertical, // UDLR
];

const thinLineSegments: readonly Rune[] = [
  Null,
  LineRight,
  LineLeft,
  LineHorizontal,
  LineDown,
  LineDownRight,
  LineDownLeft,
  LineHorizontalDown,
  LineUp,
  LineUpRight,
  LineUpLeft,
  LineHorizontalUp,
  LineVertical,
  LineVerticalRight,
  LineVerticalLeft,
  LineHorizontalVertical,
];

/** SetLineSegments sets given LineSegments directions based on given rune. */
export function SetLineSegments(r: Rune, l: LineSegments): void {
  switch (r) {
    case ArcDownRight:
    case LineDownRight:
      l.down = true; l.right = true; break;
    case ArcDownLeft:
    case LineDownLeft:
      l.down = true; l.left = true; break;
    case ArcUpLeft:
    case LineUpLeft:
      l.up = true; l.left = true; break;
    case ArcUpRight:
    case LineUpRight:
      l.up = true; l.right = true; break;
    case LineHorizontal:
      l.left = true; l.right = true; break;
    case LineVertical:
      l.up = true; l.down = true; break;
    case LineHorizontalUp:
      l.up = true; l.left = true; l.right = true; break;
    case LineHorizontalDown:
      l.down = true; l.left = true; l.right = true; break;
    case LineVerticalRight:
      l.up = true; l.down = true; l.right = true; break;
    case LineVerticalLeft:
      l.up = true; l.down = true; l.left = true; break;
    case LineHorizontalVertical:
      l.up = true; l.down = true; l.left = true; l.right = true; break;
    case LineUp:
      l.up = true; break;
    case LineDown:
      l.down = true; break;
    case LineLeft:
      l.left = true; break;
    case LineRight:
      l.right = true; break;
  }
}

/** IsLine returns whether a given rune is considered a line rune used for drawing lines. */
export function IsLine(r: Rune): boolean {
  const c = codePoint(r);
  return (c >= 0x2500 && c <= 0x253c) || (c >= 0x256d && c <= 0x2570) || (c >= 0x2574 && c <= 0x2577);
}

/**
 * ArcLineFromLineSegments returns either an empty rune or a line rune using given LineSegments.
 * LineSegments contain whether or not the returned rune
 * should display arc lines going up, down, left or right.
 */
export function ArcLineFromLineSegments(l: LineSegments): Rune {
  return arcLineSegments[segKey(l)];
}

/**
 * ThinLineFromLineSegments returns either an empty rune or a line rune using given LineSegments.
 * LineSegments contain whether or not the returned rune
 * should display thin lines going up, down, left or right.
 */
export function ThinLineFromLineSegments(l: LineSegments): Rune {
  return thinLineSegments[segKey(l)];
}

/**
 * CombineLines returns a rune that is a combination of two line runes.
 * Invalid line rune combinations or invalid LineStyle will return r2.
 * The LineStyle determines the output line rune, even if
 * the two input line runes are not of that style.
 */
export function CombineLines(r1: Rune, r2: Rune, ls: LineStyle): Rune {
  let r = r2;
  const r1ok = IsLine(r1);
  const r2ok = IsLine(r2);
  if (!r1ok && !r2ok) return r;
  const l = NewLineSegments();
  if (r1ok) SetLineSegments(r1, l);
  if (r2ok) SetLineSegments(r2, l);
  switch (ls) {
    case LineStyle.ThinLineStyle:
      r = ThinLineFromLineSegments(l);
      break;
    case LineStyle.ArcLineStyle:
      r = ArcLineFromLineSegments(l);
      break;
  }
  return r;
}

/** CandlestickSegments indicates whether a candlestick segment going up and down with thin or heavy lines is displayed. */
export interface CandlestickSegments {
  up: boolean;
  down: boolean;
  upHeavy: boolean;
  downHeavy: boolean;
}

/** Returns CandlestickSegments with every segment unset. */
export function NewCandlestickSegments(): CandlestickSegments {
  return { up: false, down: false, upHeavy: false, downHeavy: false };
}

// indexed by up=8, down=4, upHeavy=2, downHeavy=1
const candlestickSegments: readonly Rune[] = [
  Null,
  LineDownHeavy,
  LineUpHeavy,
  LineVerticalHeavy,
  LineDown,
  LineDownHeavy,
  LineUpHeavyDown,
  LineVerticalHeavy,
  LineUp,
  LineUpDownHeavy,
  LineUpHeavy,
  LineVerticalHeavy,
  LineVertical,
  LineUpDownHeavy,
  LineUpHeavyDown,
  LineVerticalHeavy,
];

/**
 * CandlestickFromCandlestickSegments returns either an empty rune
 * or a candlestick rune using given CandlestickSegments.
 */
export function CandlestickFromCandlestickSegments(c: CandlestickSegments): Rune {
  const k = (c.up ? 8 : 0) | (c.down ? 4 : 0) | (c.upHeavy ? 2 : 0) | (c.downHeavy ? 1 : 0);
  return candlestickSegments[k];
}

/** SetCandlestickSegments sets given CandlestickSegments segments based on given rune. */
export function SetCandlestickSegments(r: Rune, c: CandlestickSegments): void {
  switch (r) {
    case LineVertical:
      c.up = true; c.down = true; break;
    case LineVerticalHeavy:
      c.upHeavy = true; c.downHeavy = true; break;
    case LineUp:
      c.up = true; break;
    case LineDown:
      c.down = true; break;
    case LineUpHeavy:
      c.upHeavy = true; break;
    case LineDownHeavy:
      c.downHeavy = true; break;
    case LineUpDownHeavy:
      c.up = true; c.downHeavy = true; break;
    case LineUpHeavyDown:
      c.upHeavy = true; c.down = true; break;
  }
}

/** IsCandlestick returns whether a given rune is considered a candlestick rune used for drawing candlesticks. */
export function IsCandlestick(r: Rune): boolean {
  switch (codePoint(r)) {
    case 0x2502:
    case 0x2503:
    case 0x2575:
    case 0x2577:
    case 0x2579:
    case 0x257b:
    case 0x257d:
    case 0x257f:
      return true;
  }
  return false;
}

/**
 * CombineCandlesticks returns a rune that is a combination of two candlestick runes.
 * Invalid candlestick rune combinations will return r2.
 */
export function CombineCandlesticks(r1: Rune, r2: Rune): Rune {
  const r1ok = IsCandlestick(r1);
  const r2ok = IsCandlestick(r2);
  if (!r1ok && !r2ok) return r2;
  const c = NewCandlestickSegments();
  if (r1ok) SetCandlestickSegments(r1, c);
  if (r2ok) SetCandlestickSegments(r2, c);
  return CandlestickFromCandlestickSegments(c);
}
