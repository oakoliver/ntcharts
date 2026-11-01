// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.
//
// Port of spec/build_ohlc_test.go and spec/build_ohlc_volume_test.go.
import { describe, expect, test } from 'bun:test';
import * as tslc from '../src/linechart/timeserieslinechart/index.js';
import { autoCandleWidth, candleStyle, defaultUpColor } from '../src/spec/build.js';
import { normalize } from '../src/spec/spec.js';
import {
  Build,
  CandleStyleBlock,
  CandleStyleLine,
  ChartTypeLine,
  MarshalJSON,
  OHLCModel,
  PointTime,
  Validate,
  type OHLCPoint,
  type Spec,
} from '../src/spec/index.js';
import { DAY, HOUR, addMs, golden, ohlcSpec, strip } from './spec-helpers.js';

const winSize = (width: number, height: number) => ({ _tag: 'WindowSizeMsg', width, height });

function buildErr(s: Spec): string | null {
  try {
    Build(s);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

// ── build_ohlc_test.go ──────────────────────────────────────────────────────

test('TestBuildOHLC', () => {
  const s = ohlcSpec();
  s.width = 60;
  s.x_axis = { format: { kind: 'time', layout: 'Jan 02' } };
  const m = Build(s);
  expect(m).toBeInstanceOf(tslc.Model);
  const v = strip(m.view());
  expect(/[│┃╽╿]/.test(v)).toBe(true); // candle runes
  expect(v).toContain('Jan'); // axis labels render
  // Time-scaled placement: candle bodies must reach the right half of the chart.
  let rightmost = -1;
  for (const line of v.split('\n')) {
    const r = [...line];
    for (let i = r.length - 1; i >= 0; i--) {
      if (r[i] === '┃' || r[i] === '╽' || r[i] === '╿') {
        rightmost = Math.max(rightmost, i);
        break;
      }
    }
  }
  expect(rightmost).toBeGreaterThan(s.width / 2);

  const lines = v.split('\n');
  // The y-axis column must survive wide candle drawing.
  const counts = new Map<number, number>();
  for (const line of lines) [...line].forEach((r, i) => r === '│' && counts.set(i, (counts.get(i) ?? 0) + 1));
  let axisCol = -1;
  let best = 0;
  for (const [col, c] of counts) {
    if (c > best) {
      best = c;
      axisCol = col;
    }
  }
  expect(axisCol).toBeGreaterThanOrEqual(0);
  const bodyRows = lines.length > 2 ? lines.slice(0, -2) : lines;
  for (const line of bodyRows) expect([...line][axisCol]).toBe('│');

  // The newest candle must render, not be clipped past the graph edge.
  const newestFound = lines.some((line) => [...line].slice(-4).some((r) => '┃╽╿│'.includes(r)));
  expect(newestFound).toBe(true);
});

// A single-point OHLC spec has tMin == tMax, which would divide by zero in
// the X scale factor without the degenerate-range guard.
test('TestBuildOHLCSingleCandle', () => {
  const s = ohlcSpec();
  s.data!.series![0].ohlc = s.data!.series![0].ohlc!.slice(0, 1);
  expect(/[┃╽╿]/.test(strip(Build(s).view()))).toBe(true);
});

const makeTimes = (base: Date, n: number, step: number): Date[] => Array.from({ length: n }, (_, i) => addMs(base, i * step));

describe('TestAutoCandleWidth', () => {
  const base = new Date(Date.UTC(2026, 0, 1));
  for (const tt of [
    { name: 'no candles', graphWidth: 100, times: [] as Date[], want: 1 },
    { name: 'single candle on a wide chart caps at 7', graphWidth: 200, times: [base], want: 7 },
    { name: 'dense candles on a narrow chart floor at 1', graphWidth: 20, times: makeTimes(base, 100, HOUR), want: 1 },
    {
      name: 'gap-clamped: one close pair narrows the estimate',
      graphWidth: 100,
      times: [base, addMs(base, 6 * HOUR), addMs(base, 100 * HOUR)],
      want: 5,
    },
    { name: 'even share forced odd', graphWidth: 10, times: [base, addMs(base, 100 * HOUR)], want: 3 },
  ]) {
    test(tt.name, () => {
      let tMin = base;
      let tMax = base;
      if (tt.times.length > 0) {
        tMin = tt.times[0];
        tMax = tt.times[0];
        for (const tm of tt.times.slice(1)) {
          if (tm < tMin) tMin = tm;
          if (tm > tMax) tMax = tm;
        }
      }
      expect(autoCandleWidth(tt.graphWidth, tt.times, tMin, tMax)).toBe(tt.want);
    });
  }
});

test('TestBuildOHLCDenseDataStillBuilds', () => {
  const s = ohlcSpec();
  s.width = 12;
  const pts = s.data!.series![0].ohlc!;
  for (let i = 0; i < 40; i++) {
    const t = new Date(Date.UTC(2026, 1, 1 + i)).toISOString().slice(0, 10);
    pts.push({ t, o: 100, h: 101, l: 99, c: 100 });
  }
  expect(buildErr(s)).toBeNull();
});

test('TestBuildOHLCWideBodies', () => {
  const s = ohlcSpec();
  s.width = 60; // 4 candles on a wide chart → auto width > 1
  // A widened body draws the same heavy rune in horizontally adjacent cells.
  expect(strip(Build(s).view())).toContain('┃┃');
});

test('TestBuildOHLCUnparsableTimeErrors', () => {
  const s = ohlcSpec();
  s.data!.series![0].ohlc![0].t = 'not-a-time';
  expect(buildErr(s)).not.toBeNull();
});

test('TestBuildOHLCInvertedPinErrors', () => {
  const s = ohlcSpec();
  s.y_axis = { min: 500 }; // above all highs
  expect(buildErr(s)).not.toBeNull();
});

test('TestPointTimeDateOnly', () => {
  const [tm, ok] = PointTime('2026-01-05');
  expect(ok).toBe(true);
  expect(tm.getTime()).toBe(Date.UTC(2026, 0, 5));
});

test('TestBuildOHLCBlockStyle', () => {
  const s = ohlcSpec();
  s.width = 60;
  s.options = { candle_style: CandleStyleBlock };
  expect(strip(Build(s).view())).toContain('█');
  s.options.candle_style = CandleStyleLine;
  expect(strip(Build(s).view())).not.toContain('█'); // candle_style line must not render full blocks
});

test('TestBuildOHLCUnknownCandleStyleErrors', () => {
  const s = ohlcSpec();
  s.options = { candle_style: 'bogus' };
  expect(buildErr(s)).not.toBeNull();
});

// ── build_ohlc_volume_test.go ───────────────────────────────────────────────

test('TestOHLCVolumeValidation', () => {
  for (const v of [-1, NaN, Infinity]) {
    const s = ohlcSpec();
    s.data!.series![0].ohlc![0].v = v;
    expect(() => Validate(s)).toThrow(/^spec:/);
  }
  const s = ohlcSpec();
  s.type = ChartTypeLine;
  s.options = { volume: true };
  expect(() => Validate(s)).toThrow(); // volume on line accepted
});

test('TestOHLCVolumeOffGolden', () => {
  const s = ohlcSpec();
  const a = Build(s);
  golden('ohlc_no_volume', strip(a.view()));
  const before = MarshalJSON(s);
  expect(before).not.toContain('"v":');
  expect(before).not.toContain('"volume":');
  s.options = { volume: true }; // no V: identical model and output
  let b = Build(s);
  expect(b).toBeInstanceOf(tslc.Model);
  expect(b.view()).toBe(a.view());
  s.options.volume = false;
  s.data!.series![0].ohlc![0].v = 123.0;
  b = Build(s);
  expect(b.view()).toBe(a.view()); // disabled volume changed output
  const decoded: Spec = JSON.parse(MarshalJSON(s));
  expect(decoded.data!.series![0].ohlc![0].v).toBe(123.0); // volume lost in JSON
});

test('TestOHLCVolumeAlignment', () => {
  for (const count of [3, 120]) {
    for (const w of [32, 80, 120]) {
      for (const gaps of [false, true]) {
        const s = ohlcSpec();
        s.width = w;
        s.height = 24;
        s.options = { volume: true };
        const start = new Date(Date.UTC(2026, 0, 1));
        const pts: OHLCPoint[] = [];
        for (let i = 0; i < count; i++) {
          let day = i;
          if (gaps && i >= Math.trunc(count / 2)) day += 7;
          pts.push({ t: addMs(start, day * DAY), o: 102, h: 110, l: 100, c: 108, v: 12000.0 });
        }
        s.data!.series![0].ohlc = pts;
        const m = Build(s) as OHLCModel;
        // Collect the columns actually painted by candle bodies, independently
        // of the volume renderer's coordinates.
        const top = s.height - 2 - Math.max(2, Math.trunc((s.height - 2) / 4));
        const candleCols = new Set<number>();
        const volumeCols = new Set<number>();
        for (let y = 0; y < top; y++) {
          for (let x = 0; x < w; x++) if ('┃╽╿'.includes(m.cell({ x, y }).rune)) candleCols.add(x);
        }
        for (let x = 0; x < w; x++) if (m.cell({ x, y: s.height - 3 }).rune === '█') volumeCols.add(x);
        expect(candleCols.size).toBeGreaterThan(0);
        expect(candleCols.size).toBe(volumeCols.size); // candle/bar spans differ
        for (const x of candleCols) expect(volumeCols.has(x)).toBe(true);
        if (count === 3) {
          // Isolate each volume bar so edge-inset candles that touch or
          // overlap still have independently testable centers.
          for (let i = 0; i < pts.length; i++) {
            const isolated: Spec = { ...s, data: { series: [{ name: 'px', ohlc: pts.map((p, j) => ({ ...p, v: j === i ? p.v : null })) }] } };
            const panel = Build(isolated) as OHLCModel;
            let lo = w;
            let hi = -1;
            for (let x = 0; x < w; x++) {
              if (panel.cell({ x, y: s.height - 3 }).rune === '█') {
                lo = Math.min(lo, x);
                hi = Math.max(hi, x);
              }
            }
            expect(hi).toBeGreaterThanOrEqual(lo); // missing isolated volume
            if (!gaps) expect(hi - lo + 1).toBe(7);
            const wick = panel.cell({ x: Math.trunc((lo + hi) / 2), y: 0 });
            expect(wick.rune).toBe('│');
            expect(wick.style.getForeground()).toEqual(candleStyle(normalize(s).theme, 0, defaultUpColor).getForeground());
          }
        }
        const original = m.view();
        m.resize(1, 1);
        m.resize(w, s.height);
        expect(m.view()).toBe(original); // resize did not restore both panels
      }
    }
  }
});

test('TestOHLCMissingAndZeroVolume', () => {
  const s = ohlcSpec();
  s.options = { volume: true };
  s.data!.series![0].ohlc![0].v = 0.0;
  expect(Build(s).view()).not.toContain('█'); // zero or missing volume drew a bar
  s.height = 6;
  expect(buildErr(s)).not.toBeNull(); // undersized panel accepted
});

test('TestOHLCVolumeLabelsAndColours', () => {
  const s = ohlcSpec();
  s.width = 80;
  s.height = 24;
  s.options = { volume: true };
  s.theme = { palette: ['#123456', '#abcdef'] };
  s.x_axis = { format: { kind: 'time', layout: 'Jan 02' } };
  for (const p of s.data!.series![0].ohlc!) p.v = 12300.0;
  for (const style of [CandleStyleLine, CandleStyleBlock]) {
    s.options.candle_style = style;
    const m = Build(s) as OHLCModel;
    const lines = strip(m.view()).split('\n');
    for (const line of lines.slice(0, -1)) expect(line).not.toContain('Jan'); // X label above volume
    expect(lines[lines.length - 1]).toContain('Jan');
    expect(m.view()).toContain('12.3k');
    // The four separated volume runs must follow candle direction, including
    // the down candle at index two, with exactly the requested palette styles.
    let index = 0;
    let inBar = false;
    for (let x = 0; x < s.width; x++) {
      const cell = m.cell({ x, y: s.height - 3 });
      if (cell.rune !== '█') {
        inBar = false;
        continue;
      }
      if (inBar) continue;
      inBar = true;
      const slot = index === 2 ? 1 : 0;
      expect(cell.style.getForeground()).toEqual(candleStyle(normalize(s).theme, slot, '').getForeground());
      index++;
    }
    expect(index).toBe(4);
  }
});

test('TestOHLCVolumeResizeViewport', () => {
  for (const viaUpdate of [false, true]) {
    const s = ohlcSpec();
    s.width = 40;
    s.height = 16;
    s.options = { volume: true };
    s.x_axis = { format: { kind: 'time', layout: 'Jan 02' } };
    for (const p of s.data!.series![0].ohlc!) p.v = 12300.0;
    let m = Build(s) as OHLCModel;
    for (const [w, h] of [
      [60, 30],
      [32, 12],
      [80, 24],
    ]) {
      if (viaUpdate) [m] = m.update(winSize(w, h));
      else m.resize(w, h);
      const lines = strip(m.view()).split('\n');
      expect(lines.length).toBe(h);
      for (const line of lines) expect([...line].length).toBe(w);
      expect(lines[h - 3]).toContain('█');
      expect(lines[h - 1]).toContain('Jan'); // resized view clips volume or time labels
      s.width = w;
      s.height = h;
      expect(m.view()).toBe(Build(s).view()); // resized view differs from fresh build
    }
  }
});
