// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.
//
// Port of spec/spec_test.go, format_test.go, build_bar_test.go,
// build_sparkline_test.go, build_ts_xlabel_test.go, build_line_test.go,
// build_scatter_test.go, build_heatmap_test.go and build_contract_test.go.
// The scale, Y2, OHLC, categorical and combo tests are in tests/spec-*.test.ts.
import { describe, expect, test } from 'bun:test';
import * as barchart from '../src/barchart/index.js';
import * as heatmap from '../src/heatmap/index.js';
import * as linechart from '../src/linechart/index.js';
import * as tslc from '../src/linechart/timeserieslinechart/index.js';
import * as sparkline from '../src/sparkline/index.js';
import { seriesStyle } from '../src/spec/build.js';
import { labelFormatter } from '../src/spec/format.js';
import { gradientScale } from '../src/spec/gradient.js';
import { makeTimeAxisFormatter } from '../src/spec/build.js';
import { normalize } from '../src/spec/spec.js';
import * as spec from '../src/spec/index.js';
import {
  Build,
  ChartTypeBar,
  ChartTypeHeatmap,
  ChartTypeLine,
  ChartTypeOHLC,
  ChartTypeScatter,
  ChartTypeSparkline,
  ChartTypeTimeSeries,
  FormatValue,
  MarshalJSON,
  OrientationHorizontal,
  ScaleLinear,
  ScaleLog,
  XAxisCategory,
  XAxisTime,
  XAxisValue,
  YAxisLeft,
  YAxisRight,
  type DataPoint,
  type Format,
  type HeatData,
  type Spec,
} from '../src/spec/index.js';
import { barSpec, bgRGB, clone, heatSpec, ohlcSpec, plainRows, rangeSpec, sparkSpec, view, viewOf } from './spec-helpers.js';

// validateErr returns Validate's error message, or null.
function validateErr(s: Spec): string | null {
  try {
    spec.Validate(s);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

function buildErr(s: Spec): string | null {
  try {
    Build(s);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

// ── spec_test.go ────────────────────────────────────────────────────────────

describe('TestValidateSchemaV1', () => {
  const base: Spec = { type: ChartTypeBar, width: 40, height: 10, data: { series: [{ name: 'a', values: [{ y: 1 }] }] } };

  test('valid base', () => {
    expect(validateErr(base)).toBeNull();
  });
  test('bad orientation', () => {
    const s = clone(base);
    s.options = { orientation: 'diagonal' };
    expect(validateErr(s)).toContain('orientation');
  });
  test('bad format kind', () => {
    const s = clone(base);
    s.y_axis = { format: { kind: 'roman-numerals' } };
    expect(validateErr(s)).toContain('format');
  });
  test('bad x_axis type', () => {
    const s = clone(base);
    s.x_axis = { type: 'logarithmic' };
    expect(validateErr(s)).toContain('x_axis type');
  });
  test('x_axis type accepts the three constants and empty', () => {
    for (const typ of ['', XAxisCategory, XAxisTime, XAxisValue]) {
      const s = clone(base);
      s.x_axis = { type: typ };
      expect(validateErr(s)).toBeNull();
    }
  });
  test('bad axis scale', () => {
    let s = clone(base);
    s.x_axis = { scale: 'symlog' };
    expect(validateErr(s)).toBe('spec: x_axis scale "symlog" must be linear or log');
    s = clone(base);
    s.y_axis = { scale: 'Log' };
    expect(validateErr(s)).toBe('spec: y_axis scale "Log" must be linear or log');
  });
  test('axis scale accepts empty, linear and log', () => {
    for (const scale of ['', ScaleLinear, ScaleLog]) {
      const s = clone(base);
      s.x_axis = { scale };
      s.y_axis = { scale };
      expect(validateErr(s)).toBeNull();
    }
  });
  test('bad series type', () => {
    const s = clone(base);
    s.data = { series: [{ name: 'a', type: 'pie', values: [{ y: 1 }] }] };
    expect(validateErr(s)).toContain('series[0] type');
  });
  test('series type accepts empty and any known chart type', () => {
    for (const typ of ['', 'bar', 'line']) {
      const s = clone(base);
      s.data = { series: [{ name: 'a', type: typ, values: [{ y: 1 }] }] };
      expect(validateErr(s)).toBeNull();
    }
  });
  test('heatmap requires heat data', () => {
    expect(validateErr({ type: ChartTypeHeatmap, width: 40, height: 10 })).toContain('Heat');
  });
  test('heatmap with cells needs no series', () => {
    expect(validateErr({ type: ChartTypeHeatmap, width: 40, height: 10, heat: { cells: [{ x: 0, y: 0, z: 1 }] } })).toBeNull();
  });
  test('ohlc requires ohlc points', () => {
    const s: Spec = { type: ChartTypeOHLC, width: 40, height: 10, data: { series: [{ name: 'px', values: [{ y: 1 }] }] } };
    expect(validateErr(s)).toContain('OHLC');
  });
});

test('TestSpecJSONRoundTrip', () => {
  const input: Spec = {
    type: ChartTypeHeatmap,
    title: 't',
    width: 30,
    height: 8,
    x_axis: { title: 'hour', type: XAxisValue, format: { kind: 'number', precision: 0 } },
    y_axis: { title: 'day', min: 0, max: 6, labels: ['Mon', 'Tue'] },
    data: { series: [{ name: 's', values: [{ x: 1.0, y: 2.5, size: 4.5 }] }] },
    heat: { cells: [{ x: 0, y: 1, z: 3.5 }], min_value: 0, max_value: 10 },
    theme: { gradient: ['#000000', '#ff0000'] },
  };
  const out: Spec = JSON.parse(MarshalJSON(input));
  expect(out.x_axis!.title).toBe('hour');
  expect(out.y_axis!.max).toBe(6);
  expect(out.heat!.cells!.length).toBe(1);
  expect(out.heat!.cells![0].z).toBe(3.5);
  expect(out.theme!.gradient!.length).toBe(2);
  expect(out.data!.series!.length).toBe(1);
  expect(out.data!.series![0].values!.length).toBe(1);
  expect(out.data!.series![0].values![0].size).toBe(4.5);
  expect(out.y_axis!.labels).toEqual(['Mon', 'Tue']);
});

// TestSpecJSONMinimalOmitsZeroStructs verifies the omitzero tags on
// x_axis / y_axis / options / theme (and format on each axis) suppress
// emitting empty "{}" objects for a minimal Spec.
test('TestSpecJSONMinimalOmitsZeroStructs', () => {
  const got = MarshalJSON({ type: ChartTypeBar, width: 10, height: 5, data: { series: [{ name: 'a', values: [{ y: 1 }] }] } });
  for (const key of ['"x_axis"', '"y_axis"', '"options"', '"theme"']) expect(got).not.toContain(key);
  expect(got).toBe('{"type":"bar","width":10,"height":5,"data":{"series":[{"name":"a","values":[{"y":1}]}]}}');
});

test('TestFormatIsZero', () => {
  expect(spec.IsZero({})).toBe(true);
  expect(spec.IsZero({ kind: 'si' })).toBe(false);
});

test('TestSpecJSONScaleRoundTrip', () => {
  const input: Spec = {
    type: ChartTypeScatter,
    width: 40,
    height: 10,
    x_axis: { scale: ScaleLog },
    y_axis: { scale: ScaleLog },
    data: { series: [{ name: 'a', values: [{ x: 1.0, y: 1 }] }] },
  };
  let b = MarshalJSON(input);
  expect(b).toContain('"x_axis":{"scale":"log"}');
  expect(b).toContain('"y_axis":{"scale":"log"}');
  const out: Spec = JSON.parse(b);
  expect(out.x_axis!.scale).toBe(ScaleLog);
  expect(out.y_axis!.scale).toBe(ScaleLog);

  // An empty scale is omitted, so linear specs serialize exactly as before.
  input.x_axis!.scale = '';
  input.y_axis!.scale = '';
  input.y_axis!.min = 1;
  b = MarshalJSON(input);
  expect(b).not.toContain('scale');
});

describe('TestY2AxisJSONRoundTrip', () => {
  const base: Spec = { type: ChartTypeTimeSeries, width: 40, height: 10, data: { series: [{ name: 'a', values: [{ y: 1 }] }] } };
  test('omitted', () => {
    const b = MarshalJSON(base);
    expect(b).not.toContain('y2_axis');
    expect(b).not.toContain('"y_axis":"');
  });
  test('preserved', () => {
    const s = clone(base);
    s.y2_axis = { min: 5, max: 20, format: { kind: 'si' }, scale: ScaleLinear };
    s.data!.series!.push({ name: 'r', y_axis: YAxisRight, values: [{ y: 7 }] });
    const b = MarshalJSON(s);
    const back: Spec = JSON.parse(b);
    expect(back.y2_axis).toEqual({ min: 5, max: 20, format: { kind: 'si' }, scale: ScaleLinear });
    expect(back.data!.series![1].y_axis).toBe(YAxisRight);
    expect(back.data!.series![0].y_axis ?? '').toBe('');
    expect(b).toContain('"y2_axis":{');
    expect(b).toContain('"y_axis":"right"');
  });
});

describe('TestValidateY2Axis', () => {
  const base: Spec = { type: ChartTypeTimeSeries, width: 40, height: 10, data: { series: [{ name: 'a', values: [{ y: 1 }] }] } };
  test('bad series y_axis', () => {
    const s = clone(base);
    s.data = { series: [{ name: 'a', y_axis: 'middle', values: [{ y: 1 }] }] };
    expect(validateErr(s)).toBe('spec: series[0] y_axis "middle" must be left or right');
  });
  test('right requires y2_axis', () => {
    const s = clone(base);
    s.data = { series: [{ name: 'a', y_axis: YAxisRight, values: [{ y: 1 }] }] };
    expect(validateErr(s)).toBe('spec: series[0] y_axis "right" requires y2_axis');
  });
  test('left and empty are valid; y2_axis without right series is valid', () => {
    const s = clone(base);
    s.y2_axis = {};
    s.data = {
      series: [
        { name: 'a', y_axis: YAxisLeft, values: [{ y: 1 }] },
        { name: 'b', values: [{ y: 1 }] },
      ],
    };
    expect(validateErr(s)).toBeNull();
  });
  test('right with y2_axis is valid', () => {
    const s = clone(base);
    s.y2_axis = {};
    s.data = { series: [{ name: 'a', y_axis: YAxisRight, values: [{ y: 1 }] }] };
    expect(validateErr(s)).toBeNull();
  });
  test('bad y2_axis format', () => {
    const s = clone(base);
    s.y2_axis = { format: { kind: 'roman-numerals' } };
    expect(validateErr(s)).toContain('y2_axis format kind');
  });
  test('bad y2_axis scale', () => {
    const s = clone(base);
    s.y2_axis = { scale: 'symlog' };
    expect(validateErr(s)).toBe('spec: y2_axis scale "symlog" must be linear or log');
  });
});

test('TestValidateRejectsSameNameOnDifferentYAxes', () => {
  const s: Spec = {
    type: ChartTypeTimeSeries,
    width: 40,
    height: 10,
    y2_axis: {},
    data: {
      series: [
        { name: 'a', y_axis: YAxisRight, values: [{ y: 100 }] },
        { name: 'b', values: [{ y: 1 }] },
        { name: 'a', values: [{ y: 2 }] },
      ],
    },
  };
  expect(validateErr(s)).toBe('spec: series[2] "a" is also series[0] but on a different y_axis');
  // the same name on the same axis is still allowed (it merges)
  s.data!.series![2].y_axis = YAxisRight;
  expect(validateErr(s)).toBeNull();
});

// ── format_test.go ──────────────────────────────────────────────────────────

describe('TestFormatValue', () => {
  const cases: [string, Format, number, string][] = [
    ['default plain', {}, 12.5, '12.5'],
    ['number precision', { kind: 'number', precision: 2 }, 3.14159, '3.14'],
    ['percent default', { kind: 'percent' }, 0.42, '42%'],
    ['percent precision', { kind: 'percent', precision: 1 }, 0.4567, '45.7%'],
    ['currency default', { kind: 'currency' }, 1250, '$1250.00'],
    ['currency symbol', { kind: 'currency', currency: '€', precision: 0 }, 99.9, '€100'],
    ['si thousands', { kind: 'si' }, 12500, '12.5k'],
    ['si millions', { kind: 'si', precision: 2 }, 3400000, '3.40M'],
    ['si small passthrough', { kind: 'si' }, 999, '999.0'],
    ['si negative', { kind: 'si' }, -2500000000, '-2.5G'],
    ['time layout', { kind: 'time', layout: '2006-01' }, 1767225600000, '2026-01'],
  ];
  for (const [name, f, v, want] of cases) {
    test(name, () => {
      expect(FormatValue(f, v)).toBe(want);
    });
  }
});

test('TestLabelFormatterNilWhenZero', () => {
  // zero Format must produce a null LabelFormatter (chart keeps its default)
  expect(labelFormatter({})).toBeNull();
  const lf = labelFormatter({ kind: 'si' });
  expect(lf).not.toBeNull();
  expect(lf!(0, 2000)).toBe('2.0k');
});

test('TestMakeTimeAxisFormatterUsesSecondsUTC', () => {
  const lf = makeTimeAxisFormatter('2006-01-02');
  // 1767225600 seconds = 2026-01-01T00:00:00Z
  expect(lf(0, 1767225600)).toBe('2026-01-01');
  // 1767225599.9996s rounds up across the millisecond boundary
  expect(lf(0, 1767225599.9996)).toBe('2026-01-01');
});

test('TestBuildTimeSeriesWithFormatsSmoke', () => {
  const s: Spec = {
    type: ChartTypeTimeSeries,
    width: 40,
    height: 10,
    x_axis: { format: { kind: 'time', layout: '2006-01' } },
    y_axis: { format: { kind: 'si' } },
    data: {
      series: [
        {
          name: 'a',
          values: [
            { x: '2026-01-01T00:00:00Z', y: 1500 },
            { x: '2026-02-01T00:00:00Z', y: 2500 },
          ],
        },
      ],
    },
  };
  expect(() => Build(s)).not.toThrow();
});

// ── build_bar_test.go ───────────────────────────────────────────────────────

test('TestBuildBarMultiSeriesRequiresStacked', () => {
  const s = barSpec(2); // stacked defaults to false
  expect(buildErr(s)).toContain('stacked');
  s.options = { stacked: true };
  expect(buildErr(s)).toBeNull();
});

test('TestBuildBarSingleSeriesNeedsNoStacked', () => {
  expect(buildErr(barSpec(1))).toBeNull();
});

test('TestBuildBarForwardsYAxisPins', () => {
  const s = barSpec(1);
  s.y_axis = { min: -4, max: 12 };
  const bc = Build(s) as barchart.Model;
  expect(bc.minValue()).toBe(-4); // y_axis.min must reach barchart.WithMinValue
  expect(bc.maxValue()).toBe(12);
});

test('TestBuildBarNegativeValuesAutoScaleBelowZero', () => {
  const s = barSpec(1);
  s.data!.series![0].values = [{ y: 3 }, { y: -5 }, { y: 2 }];
  const m = Build(s) as barchart.Model;
  expect(m.minValue()).toBeLessThanOrEqual(-5); // negative bars auto-scale the floor
});

test('TestBuildBarRejectsInvertedPins', () => {
  const s = barSpec(1);
  s.y_axis = { min: 10, max: 2 };
  expect(buildErr(s)).toContain('exceeds');
});

test('TestBuildBarHorizontal', () => {
  const s = barSpec(1);
  s.options = { orientation: OrientationHorizontal };
  expect(buildErr(s)).toBeNull();
});

// ── build_sparkline_test.go ─────────────────────────────────────────────────

test('TestBuildSparkline', () => {
  const m = Build(sparkSpec());
  expect(m).toBeInstanceOf(sparkline.Model);
  expect(m.view().trim()).not.toBe('');
});

test('TestBuildSparklineSingleSeriesOnly', () => {
  const s = sparkSpec();
  s.data!.series!.push({ name: 'b', values: [{ y: 1 }] });
  expect(buildErr(s)).toContain('one series');
});

test('TestBuildSparklineMaxPin', () => {
  const s = sparkSpec();
  s.y_axis = { max: 20 };
  const m = Build(s);
  expect(m).toBeInstanceOf(sparkline.Model);
  expect((m as sparkline.Model).maxValue()).toBe(20);
});

// ── build_ts_xlabel_test.go ─────────────────────────────────────────────────

// TestTimeSeriesFinalXLabel guards the drawXLabel final-tick rule: the label
// under the newest data must render right-aligned when it does not fit
// left-anchored at the axis end, not silently vanish.
test('TestTimeSeriesFinalXLabel', () => {
  const ms = (mo: number) => Date.UTC(2026, mo - 1, 1);
  const s: Spec = {
    type: ChartTypeTimeSeries,
    width: 44,
    height: 12,
    data: {
      series: [
        {
          name: 'px',
          values: [
            { x: ms(1), y: 104.2 },
            { x: ms(2), y: 108.9 },
            { x: ms(3), y: 101.4 },
            { x: ms(4), y: 115.7 },
            { x: ms(5), y: 119.3 },
            { x: ms(6), y: 112.8 },
          ],
        },
      ],
    },
    x_axis: { type: 'time', format: { kind: 'time', layout: 'Jan' } },
  };
  const v = view(s);
  expect(v).toContain('May');
  expect(v).toContain('Jun'); // final month label missing — last x tick was dropped
  for (const line of v.split('\n')) {
    const idx = line.indexOf('Jun');
    if (idx >= 0) expect(idx).toBeGreaterThanOrEqual(line.length - 'Jun '.length);
  }
});

// ── build_line_test.go ──────────────────────────────────────────────────────

function lineSpec(): Spec {
  return {
    type: ChartTypeLine,
    width: 40,
    height: 10,
    data: {
      series: [
        { name: 'a', color: '#ff0000', values: [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 5 }] },
        { name: 'b', values: [{ x: 0, y: 4 }, { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 1 }] },
      ],
    },
  };
}

test('TestBuildLine', () => {
  const m = Build(lineSpec());
  expect(m).toBeInstanceOf(linechart.Model);
  expect(m.view().trim()).not.toBe('');
});

test('TestBuildLineIndexXWhenOmitted', () => {
  const s = lineSpec();
  for (const ser of s.data!.series!) for (const p of ser.values!) p.x = null; // rely on index-as-X
  expect(buildErr(s)).toBeNull();
});

test('TestBuildLinePinnedYRange', () => {
  const s = lineSpec();
  s.y_axis = { min: 0, max: 10 };
  expect(buildErr(s)).toBeNull();
});

// TestBuildLineOneSidedYPin exercises the one-sided pin rule.
describe('TestBuildLineOneSidedYPin', () => {
  test('min only', () => {
    const s = lineSpec();
    s.y_axis = { min: -10 };
    expect(buildErr(s)).toBeNull();
  });
  test('max only', () => {
    const s = lineSpec();
    s.y_axis = { max: 100 };
    expect(buildErr(s)).toBeNull();
  });
});

// TestBuildLineInvertedYPinErrors pins min above the series' actual data max.
test('TestBuildLineInvertedYPinErrors', () => {
  const s = lineSpec();
  s.y_axis = { min: 50 };
  expect(buildErr(s)).toContain('exceeds');
});

// Constant series must form horizontal lines across the plot, with neither
// baseline spikes nor a connection from the end of one series to the next.
test('TestBuildLineConnectsPointsWithinEachSeries', () => {
  const s: Spec = {
    type: ChartTypeLine,
    width: 40,
    height: 12,
    y_axis: { min: 0, max: 10 },
    data: {
      series: [
        { name: 'low', color: '#ff0000', values: [{ x: 0, y: 2 }, { x: 9, y: 2 }] },
        { name: 'high', color: '#0000ff', values: [{ x: 0, y: 8 }, { x: 9, y: 8 }] },
      ],
    },
  };
  const m = Build(s) as linechart.Model;
  const n = normalize(s);
  const rows = new Map<number, number>();
  for (let y = 0; y < m.origin().y; y++) {
    for (let x = m.origin().x + 1; x < m.width(); x++) {
      const c = m.canvas.cell({ x, y });
      const r = c.rune.codePointAt(0) ?? 0;
      if (r > 0x2800 && r <= 0x28ff) {
        rows.set(y, (rows.get(y) ?? 0) + 1);
        let want = seriesStyle(n.data.series![0], 0, n.theme).getForeground();
        if (y < m.graphHeight() / 2) want = seriesStyle(n.data.series![1], 1, n.theme).getForeground();
        expect(c.style.getForeground()).toEqual(want);
      }
    }
  }
  expect(rows.size).toBe(2);
  for (const count of rows.values()) expect(count).toBe(m.graphWidth());
});

test('TestBuildLineSingletonAndDuplicateX', () => {
  for (const values of [[{ x: 2.0, y: 5 }], [{ x: 2.0, y: 2 }, { x: 2.0, y: 8 }]] as DataPoint[][]) {
    const s: Spec = { type: ChartTypeLine, width: 40, height: 12, y_axis: { min: 0, max: 10 }, data: { series: [{ name: 'a', values }] } };
    const m = Build(s) as linechart.Model;
    const columns = new Set<number>();
    for (let y = 0; y < m.origin().y; y++) {
      for (let x = m.origin().x + 1; x < m.width(); x++) {
        const r = m.canvas.cell({ x, y }).rune.codePointAt(0) ?? 0;
        if (r > 0x2800 && r <= 0x28ff) columns.add(x);
      }
    }
    expect(columns.size).toBe(1); // points at one X occupy one column
  }
});

// ── build_scatter_test.go ───────────────────────────────────────────────────

function scatterSpec(): Spec {
  return {
    type: ChartTypeScatter,
    width: 40,
    height: 12,
    x_axis: { format: { kind: 'si' } },
    data: {
      series: [
        { name: 'japan', color: '#22aadd', values: [{ x: 2100.0, y: 31.5 }, { x: 1980.0, y: 33.1 }] },
        { name: 'usa', color: '#dd8822', values: [{ x: 2875.0, y: 24.0 }, { x: 3200.0, y: 19.2 }, { x: 3600.0, y: 16.5 }] },
      ],
    },
  };
}

test('TestBuildScatter', () => {
  const m = Build(scatterSpec());
  expect(m).toBeInstanceOf(linechart.Model);
  expect(m.view()).toContain('•');
});

test('TestBuildScatterEmptySeriesErrors', () => {
  const s = scatterSpec();
  for (const ser of s.data!.series!) ser.values = null;
  expect(buildErr(s)).not.toBeNull();
});

test('TestBuildScatterPinnedY', () => {
  const s = scatterSpec();
  s.y_axis = { min: 0, max: 40 };
  expect(buildErr(s)).toBeNull();
});

// TestBuildScatterInvertedYPinErrors pins min above the series' data max (33.1).
test('TestBuildScatterInvertedYPinErrors', () => {
  const s = scatterSpec();
  s.y_axis = { min: 50 };
  expect(buildErr(s)).toContain('exceeds');
});

// TestBuildScatterIgnoresSize: DataPoint.size is accepted and ignored.
test('TestBuildScatterIgnoresSize', () => {
  const s = scatterSpec();
  for (const ser of s.data!.series!) for (const p of ser.values!) p.size = 3.0;
  expect(buildErr(s)).toBeNull();
});

// ── build_heatmap_test.go ───────────────────────────────────────────────────

function assertHeatCellsEqual(got: heatmap.Model, want: heatmap.Model): void {
  let colours = 0;
  for (let y = 0; y < got.height(); y++) {
    for (let x = 0; x < got.width(); x++) {
      const a = bgRGB(got, x, y);
      const b = bgRGB(want, x, y);
      expect(a === null).toBe(b === null);
      if (a !== null) {
        colours++;
        expect(a).toEqual(b!);
      }
    }
  }
  expect(colours).toBeGreaterThan(0); // no heat cells rendered
}

test('TestBuildHeatmapOneSidedPins', () => {
  for (const matrix of [false, true]) {
    for (const tc of [
      { min: -5, max: null, wantMin: -5, wantMax: 9 },
      { min: null, max: 20, wantMin: 1, wantMax: 20 },
    ]) {
      const s = heatSpec();
      if (matrix) s.heat = { matrix: [[1, 5, 9], [3, 7, 2]] };
      s.heat!.min_value = tc.min;
      s.heat!.max_value = tc.max;
      const got = Build(s) as heatmap.Model;
      s.heat!.min_value = tc.wantMin;
      s.heat!.max_value = tc.wantMax;
      const want = Build(s) as heatmap.Model;
      assertHeatCellsEqual(got, want);
    }
  }
  for (const axis of [
    { cells: [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 5 }], min_value: 6 },
    { cells: [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 5 }], max_value: 0 },
    { cells: [{ x: 0, y: 0, z: 1 }], min_value: 5, max_value: 1 },
  ] as HeatData[]) {
    const s = heatSpec();
    s.heat = axis;
    expect(buildErr(s)).toContain('exceeds');
  }
});

test('TestBuildHeatmapMatrixRowsMatchCellY', () => {
  const s = heatSpec();
  const want = Build(s) as heatmap.Model;
  // A non-square matrix makes a transposition observable. Matrix takes
  // precedence over the conflicting sparse cells, including its value range.
  s.heat = { matrix: [[1, 5, 9], [3, 7, 2]], cells: [{ x: 50, y: 50, z: 1000 }] };
  assertHeatCellsEqual(Build(s) as heatmap.Model, want);
});

test('TestBuildHeatmapCells', () => {
  const m = Build(heatSpec());
  expect(m).toBeInstanceOf(heatmap.Model);
  expect(m.view().trim()).not.toBe('');
});

test('TestBuildHeatmapMatrix', () => {
  const s = heatSpec();
  s.heat = { matrix: [[1, 5, 9], [3, 7, 2]] };
  expect(buildErr(s)).toBeNull();
});

test('TestBuildHeatmapPinnedValueRange', () => {
  const s = heatSpec();
  s.heat!.min_value = 0;
  s.heat!.max_value = 10;
  expect(buildErr(s)).toBeNull();
});

test('TestGradientScale', () => {
  const cs = gradientScale(['#000000', '#ff0000']);
  expect(cs!.length).toBe(32);
  expect(() => gradientScale(['not-a-color'])).toThrow(); // invalid hex stop
  expect(gradientScale(null)).toBeNull(); // nil stops give nil
});

function labelledHeatSpec(): Spec {
  return {
    type: ChartTypeHeatmap,
    width: 40,
    height: 14,
    x_axis: { labels: ['09', '12', '15'] },
    y_axis: { labels: ['Mon', 'Tuesday', 'Wed'] },
    heat: {
      cells: [
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 0, z: 5 },
        { x: 2, y: 0, z: 9 },
        { x: 0, y: 1, z: 3 },
        { x: 1, y: 1, z: 7 },
        { x: 2, y: 1, z: 2 },
        { x: 0, y: 2, z: 4 },
        { x: 1, y: 2, z: 6 },
        { x: 2, y: 2, z: 8 },
      ],
    },
    theme: { gradient: ['#000044', '#ff4400'] },
  };
}

// y_axis.labels[0] is the first row of the chart, the one at the top.
test('TestBuildHeatmapRowLabelsReadTopDown', () => {
  const rows = plainRows(Build(labelledHeatSpec()));
  let last = -1;
  for (const label of ['Mon', 'Tuesday', 'Wed']) {
    const found = rows.findIndex((r) => r.includes(label));
    expect(found).toBeGreaterThanOrEqual(0);
    expect(found).toBeGreaterThan(last);
    last = found;
  }
  // the column labels sit under the grid
  const under = rows[rows.length - 2];
  for (const label of ['09', '12', '15']) expect(under).toContain(label);
});

// Y=0 is the first label's row, so the first row of cells is the top one.
test('TestBuildHeatmapFirstRowIsOnTop', () => {
  const s = heatSpec(); // Y=0 holds 1, 5, 9; Y=1 holds 3, 7, 2
  s.theme!.gradient = ['#000000', '#ffffff'];
  s.heat!.min_value = 0;
  s.heat!.max_value = 10;
  const m = Build(s) as heatmap.Model;
  let topRow = -1;
  let bottomRow = -1;
  for (let y = 0; y < m.height(); y++) {
    for (let x = 0; x < m.width(); x++) {
      if (bgRGB(m, x, y) !== null) {
        if (topRow < 0) topRow = y;
        bottomRow = y;
      }
    }
  }
  // the cell at X=2 is 9 (Y=0) over 2 (Y=1): the lighter colour is in the upper block
  let x = m.width() - 1;
  for (; x >= 0; x--) if (bgRGB(m, x, topRow) !== null) break;
  const lum = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;
  expect(lum(bgRGB(m, x, topRow)!)).toBeGreaterThan(lum(bgRGB(m, x, bottomRow)!));
});

// A heatmap is a grid of filled blocks that tile the plot, not isolated cells.
test('TestBuildHeatmapCellsTileThePlot', () => {
  const m = Build(heatSpec()) as heatmap.Model;
  let coloured = 0;
  for (let y = 0; y < m.height(); y++) for (let x = 0; x < m.width(); x++) if (bgRGB(m, x, y) !== null) coloured++;
  expect(coloured).toBe(m.graphWidth() * m.graphHeight());
});

// Without labels the plot has no margin or label rows beyond the cells' own.
test('TestBuildHeatmapUnlabelledHasNoLabelText', () => {
  for (const r of plainRows(Build(heatSpec()))) expect(r.trim()).toBe('');
});

test('TestBuildHeatmapLabelsMatchMatrixRows', () => {
  const s = labelledHeatSpec();
  const want = plainRows(Build(s)).join('\n');
  s.heat = { matrix: [[1, 5, 9], [3, 7, 2], [4, 6, 8]] };
  expect(plainRows(Build(s)).join('\n')).toBe(want);
});

test('TestBuildHeatmapNegativeIndexIsAnError', () => {
  const s = heatSpec();
  s.heat!.cells!.push({ x: -1, y: 0, z: 1 });
  expect(buildErr(s)).toContain('non-negative');
});

// Labels beyond the data still get their rows: a label with no cells is an empty row.
test('TestBuildHeatmapLabelsLongerThanData', () => {
  const s = labelledHeatSpec();
  s.y_axis!.labels!.push('Thu');
  expect(plainRows(Build(s)).join('\n')).toContain('Thu');
});

// ── build_contract_test.go ──────────────────────────────────────────────────

test('TestBuildPreservesYPins', () => {
  for (const kind of [ChartTypeLine, ChartTypeTimeSeries, ChartTypeScatter, ChartTypeOHLC]) {
    for (const tc of [
      { name: 'min', axis: { min: 2 }, min: 2, max: 5 },
      { name: 'max', axis: { max: 4 }, min: 1, max: 4 },
      { name: 'both', axis: { min: 2, max: 4 }, min: 2, max: 4 },
      { name: 'min at data max', axis: { min: 5 }, min: 5, max: 6 },
      { name: 'max at data min', axis: { max: 1 }, min: 0, max: 1 },
    ]) {
      const s = rangeSpec(kind);
      s.y_axis = tc.axis;
      const m = Build(s) as linechart.Model;
      expect([kind, tc.name, m.viewMinY(), m.viewMaxY()]).toEqual([kind, tc.name, tc.min, tc.max]);
    }
    const s = rangeSpec(kind);
    s.y_axis = { min: 3, max: 3 };
    expect(buildErr(s)).toContain('must differ');
  }
});

test('TestBuildRejectsInsufficientPlotSpace', () => {
  for (const kind of [ChartTypeLine, ChartTypeTimeSeries, ChartTypeScatter, ChartTypeOHLC]) {
    for (const [w, h] of [
      [1, 1],
      [1, 2],
      [2, 3],
      [40, 2],
    ]) {
      const s = rangeSpec(kind);
      s.width = w;
      s.height = h;
      expect(buildErr(s)).toContain('too small');
    }
  }
});

test('TestBuildLineSizesFormattedLabels', () => {
  const s = rangeSpec(ChartTypeLine);
  s.y_axis = { min: 0, max: 10, format: { kind: 'currency' } };
  s.data!.series![0].values = [{ x: 0.0, y: 2 }, { x: 1.0, y: 5 }];
  const v = view(s);
  expect(v.startsWith('$10.00│')).toBe(true);
  expect(v).toContain('$0.00└');
});

test('TestBuildTimeSeriesSingletonTime', () => {
  const base = '2026-01-01T00:00:00';
  // Go adds 1 and 2 nanoseconds to base; RFC 3339 strings carry them here
  for (const points of [
    [{ x: new Date(base + 'Z'), y: 5 }],
    [{ x: new Date(base + 'Z'), y: 3 }, { x: new Date(base + 'Z'), y: 5 }],
    [{ x: base + '.000000001Z', y: 3 }, { x: base + '.000000002Z', y: 5 }],
  ] as DataPoint[][]) {
    const s = rangeSpec(ChartTypeTimeSeries);
    s.data!.series![0].values = points;
    const m = Build(s) as tslc.Model;
    const center = Date.UTC(2026, 0, 1) / 1e3;
    expect(m.viewMinX()).toBe(center - 43200);
    expect(m.viewMaxX()).toBe(center + 43200);
    expect([...m.view()].some((r) => r > '⠀' && r <= '⣿')).toBe(true); // singleton is drawn
  }
});

test('TestBuildSharedXMatchesExplicitXWithoutMutation', () => {
  for (const kind of [ChartTypeLine, ChartTypeScatter, ChartTypeTimeSeries, ChartTypeBar]) {
    const s = rangeSpec(kind);
    s.data!.x_axis_data = kind === ChartTypeBar ? ['Q1', 'Q2'] : [1000.0, 2000.0];
    s.data!.series![0].values = [{ y: 1 }, { x: s.data!.x_axis_data[1], y: 5 }, { x: null, y: 3 }];
    const before = MarshalJSON(s);
    const shared = Build(s);
    expect(MarshalJSON(s)).toBe(before); // Build changed its input
    s.data!.series![0].values![0].x = s.data!.x_axis_data[0];
    s.data!.x_axis_data = null;
    const explicit = Build(s);
    expect(shared.view()).toBe(explicit.view());
    if (kind === ChartTypeBar) {
      const bars = (shared as barchart.Model).data();
      expect([bars[0].label, bars[1].label, bars[2].label]).toEqual(['Q1', 'Q2', '3']);
    }
  }
});

test('TestBuildOHLCRejectsAdditionalSeries', () => {
  const s = rangeSpec(ChartTypeOHLC);
  s.data!.series!.push({ name: 'other', ohlc: s.data!.series![0].ohlc });
  expect(buildErr(s)).toContain('exactly one');
});

test('TestBuildOHLCTimePlacementDoesNotDependOnInputOrder', () => {
  const s = ohlcSpec();
  const before = MarshalJSON(s);
  const ordered = Build(s);
  expect(MarshalJSON(s)).toBe(before); // Build changed its OHLC input
  const points = s.data!.series![0].ohlc!;
  s.data!.series![0].ohlc = [points[2], points[0], points[3], points[1]];
  expect(Build(s).view()).toBe(ordered.view()); // non-overlapping candles moved when input order changed
});

// ── Port-specific: plain JSON specs ─────────────────────────────────────────

test('Build accepts a parsed JSON spec and leaves it unchanged', () => {
  const text = '{"type":"line","width":30,"height":8,"data":{"series":[{"name":"a","values":[{"x":0,"y":1},{"x":1,"y":3}]}]}}';
  const s = JSON.parse(text);
  const m = Build(s);
  expect(JSON.stringify(s)).toBe(text);
  expect(viewOf(JSON.parse(MarshalJSON(s)))).toBe(viewOf(s));
  expect(m).toBeInstanceOf(linechart.Model);
});
