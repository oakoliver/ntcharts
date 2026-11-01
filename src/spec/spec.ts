// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

/**
 * Package spec defines a neutral, surface-agnostic chart specification.
 *
 * A Spec is a declarative description of a chart (type, data, options,
 * theme) that can be rendered to multiple surfaces. This port renders it to
 * the ntcharts terminal models via Build(). (Upstream also renders to Apache
 * ECharts through a separate Go module; that surface is not ported.)
 *
 * The goal is a single source of truth: author once, render anywhere.
 * Specs are plain JSON objects with upstream's snake_case field names, so a
 * spec written for Go works unchanged here:
 *
 *	const m = spec.Build(JSON.parse(text));
 *	console.log(m.view());
 *
 * Go zero values: a field left out (or null) is the Go zero value: "" for
 * strings, 0 for numbers, false for booleans, nil for pointers and slices.
 * Go `*float64` / `*int` fields are `number | null` (null or absent means
 * nil); Go `any` X values are `number | string | Date`.
 *
 * Errors: where Go returns an error, the port throws an Error whose message
 * is Go's error text.
 *
 * Go methods on the plain-data types become package functions taking the
 * value first: Spec.Validate -> Validate(s), Spec.HasVolume -> HasVolume(s),
 * Spec.MarshalJSON -> MarshalJSON(s), ChartType.IsKnown -> IsKnown(t),
 * Format.IsZero -> IsZero(f).
 */

import { Quote, jsonFloat, jsonString } from '../internal/strconv.js';
import { formatUnixMilliUTC } from '../internal/gotime.js';
import { sprintV } from '../internal/format.js';

/**
 * ChartType identifies the kind of chart described by a Spec.
 * The constants below mirror the chart families exposed by ntcharts.
 */
export type ChartType = string;

// ChartType constants. These mirror the ntcharts chart families. Build
// renders every type except Streamline and Canvas, which are reserved for
// future support.

/** ChartTypeBar renders a bar chart (barchart package). */
export const ChartTypeBar: ChartType = 'bar';
/** ChartTypeLine renders a generic (numeric-X) line chart (linechart package). */
export const ChartTypeLine: ChartType = 'line';
/** ChartTypeTimeSeries renders a time-indexed line chart (linechart/timeserieslinechart package). */
export const ChartTypeTimeSeries: ChartType = 'timeseries';
/** ChartTypeStreamline renders a streamline chart (linechart/streamlinechart package). */
export const ChartTypeStreamline: ChartType = 'streamline';
/** ChartTypeSparkline renders a sparkline (sparkline package). */
export const ChartTypeSparkline: ChartType = 'sparkline';
/** ChartTypeHeatmap renders a heatmap (heatmap package). */
export const ChartTypeHeatmap: ChartType = 'heatmap';
/** ChartTypeOHLC renders an open/high/low/close financial chart. */
export const ChartTypeOHLC: ChartType = 'ohlc';
/** ChartTypeScatter renders a scatter plot. */
export const ChartTypeScatter: ChartType = 'scatter';
/** ChartTypeCanvas renders a raw canvas chart (canvas package). */
export const ChartTypeCanvas: ChartType = 'canvas';

/** IsKnown reports whether the ChartType is one of the recognized constants (Go's ChartType.IsKnown). */
export function IsKnown(t: ChartType): boolean {
  switch (t) {
    case ChartTypeBar:
    case ChartTypeLine:
    case ChartTypeTimeSeries:
    case ChartTypeStreamline:
    case ChartTypeSparkline:
    case ChartTypeHeatmap:
    case ChartTypeOHLC:
    case ChartTypeScatter:
    case ChartTypeCanvas:
      return true;
  }
  return false;
}

// X-axis type constants used by XAxis.type.

/** XAxisCategory indicates a discrete, ordered set of labels (e.g. bar chart categories). */
export const XAxisCategory = 'category';
/** XAxisTime indicates time-valued X coordinates (Date, RFC 3339 string or ms-since-epoch). */
export const XAxisTime = 'time';
/** XAxisValue indicates numeric X coordinates. */
export const XAxisValue = 'value';

// Axis scale constants used by XAxis.scale and YAxis.scale.

/** ScaleLinear spaces values evenly along the axis. It is the default when scale is empty. */
export const ScaleLinear = 'linear';
/**
 * ScaleLog spaces values by their base-10 logarithm, so each decade takes
 * the same length of axis. Every value on the axis, including a pinned
 * YAxis.min / YAxis.max, must be positive.
 */
export const ScaleLog = 'log';

// Series.y_axis values: which Y axis a series is plotted against.

/** YAxisLeft is the chart's main Y axis (Spec.y_axis). It is the default when Series.y_axis is empty. */
export const YAxisLeft = 'left';
/** YAxisRight is the optional right-hand Y axis (Spec.y2_axis). */
export const YAxisRight = 'right';

// Orientation constants for Options.orientation.
export const OrientationVertical = 'vertical';
export const OrientationHorizontal = 'horizontal';

// CandleStyle constants for Options.candle_style.
export const CandleStyleLine = 'line';
export const CandleStyleBlock = 'block';

/**
 * Format describes how numeric or time values render as labels.
 *
 * kind is one of:
 *   - "" or "number": plain numeric formatting
 *   - "percent": v*100 followed by a "%" suffix
 *   - "currency": currency symbol prefix
 *   - "si": k/M/G/T suffix (SI-style magnitude abbreviation)
 *   - "time": ms-since-epoch rendered via layout
 *
 * Note: chart-internal axis values for timeseries charts are
 * seconds-since-epoch (not milliseconds); FormatValue and the timeseries
 * axis formatters convert between the two internally, so callers of
 * FormatValue always pass milliseconds regardless of which surface renders
 * the chart.
 */
export interface Format {
  /** kind selects the formatting family. See the Format doc comment. */
  kind?: string;
  /** precision is the number of decimals. null/absent means the kind's default. */
  precision?: number | null;
  /** currency is the symbol used for kind "currency". Defaults to "$". */
  currency?: string;
  /** layout is the Go time layout string used for kind "time". */
  layout?: string;
}

/** IsZero reports whether f is the zero value (no formatting directive set) (Go's Format.IsZero). */
export function IsZero(f: Format | null | undefined): boolean {
  const n = normFormat(f);
  return n.kind === '' && n.precision === null && n.currency === '' && n.layout === '';
}

/** XAxis describes the X axis of a chart. */
export interface XAxis {
  /** title is the optional axis title. */
  title?: string;
  /**
   * type declares the kind of X axis: XAxisCategory, XAxisTime, or
   * XAxisValue. If empty, a sensible default is inferred from the chart type.
   */
  type?: string;
  /**
   * labels is the optional list of category labels, used when
   * type == XAxisCategory. Line/scatter charts preserve these ordered slots;
   * an omitted line point breaks the connection across that slot. If labels
   * is absent, category order comes from x_axis_data or string X values.
   * For a heatmap, labels[i] names the column of cells at X = i and is drawn
   * under the plot.
   */
  labels?: string[] | null;
  /** format describes how axis labels render. */
  format?: Format | null;
  /**
   * scale is "" or ScaleLinear for a linear axis, or ScaleLog for a
   * base-10 logarithmic one. Build honours ScaleLog for line and scatter
   * charts (numeric X); it is a Build error on every other chart type, and
   * for any X value <= 0. Unknown values fail Validate.
   */
  scale?: string;
}

/** YAxis describes the Y axis of a chart. */
export interface YAxis {
  /** title is the optional axis title. */
  title?: string;
  /** min pins the Y axis minimum. If null/absent, auto-scale. */
  min?: number | null;
  /** max pins the Y axis maximum. If null/absent, auto-scale. */
  max?: number | null;
  /**
   * labels is the optional list of row labels for grid-style charts. For a
   * heatmap, labels[i] names the row of cells at Y = i; row 0 is drawn at
   * the top, and the labels are drawn left of the plot. Other chart types
   * ignore it.
   */
  labels?: string[] | null;
  /** format describes how axis labels render. */
  format?: Format | null;
  /**
   * scale is "" or ScaleLinear for a linear axis, or ScaleLog for a
   * base-10 logarithmic one. Build honours ScaleLog for line, scatter,
   * timeseries, and OHLC charts; it is a Build error on bar, heatmap, and
   * sparkline charts, and for any Y value or min / max pin <= 0. An
   * unpinned bound widens to a whole decade; min and max stay in data
   * units. Unknown values fail Validate.
   */
  scale?: string;
}

/**
 * An X (or OHLC T) value: a category string, a time (Date, an RFC 3339
 * string or ms since the epoch) or a numeric X. Go's `any`.
 */
export type XValue = number | string | Date;

/**
 * Spec is the top-level neutral description of a chart.
 *
 * A Spec fully describes the chart. Surface-specific concerns (styles,
 * interactivity, mouse/keyboard handling) are derived from Spec by the
 * corresponding renderer.
 */
export interface Spec {
  /** type selects the chart family. Required. */
  type: ChartType;
  /** title is the optional main chart title. */
  title?: string;
  /** subtitle is an optional secondary title. */
  subtitle?: string;
  /**
   * width is the suggested width of the chart. For terminal surfaces this
   * is columns; for web surfaces this is a pixel hint.
   */
  width: number;
  /** height is the suggested height. Columns/rows on terminal, pixels on web. */
  height: number;
  /** x_axis describes the X axis (title, type, labels, format). */
  x_axis?: XAxis | null;
  /** y_axis describes the Y axis (title, min/max, format). */
  y_axis?: YAxis | null;
  /**
   * y2_axis describes the optional right-hand Y axis. Series select it with
   * Series.y_axis = YAxisRight. Build supports it on line, scatter and
   * timeseries charts, and categorical bar/line combos. Its fields match
   * y_axis (labels is ignored). null/absent means the chart has one Y axis.
   */
  y2_axis?: YAxis | null;
  /** data holds the series data for the chart. */
  data?: Data | null;
  /**
   * heat holds heatmap cell/matrix data. Required (non-null, non-empty) for
   * ChartTypeHeatmap.
   */
  heat?: HeatData | null;
  /** options holds common, surface-agnostic rendering options. */
  options?: Options | null;
  /** theme holds surface-agnostic colour theming. */
  theme?: Theme | null;
}

/** Data describes the series of a chart. */
export interface Data {
  /**
   * series is the ordered collection of data series. At least one series is
   * required for most chart types.
   */
  series?: Series[] | null;
  /**
   * x_axis_data is an optional shared X-axis value list (Date, number or
   * string). If provided, per-series DataPoint.x may be omitted and points
   * are zipped against this list. An explicit DataPoint.x takes precedence.
   * Used by bar, line, scatter, and timeseries charts.
   */
  x_axis_data?: (XValue | null)[] | null;
}

/** Series is a named collection of DataPoints. */
export interface Series {
  /** name is the series name (shown in legends and tooltips). Required. */
  name: string;
  /**
   * type optionally overrides the parent Spec.type for this series (e.g.
   * mixing "line" into a "bar" chart). Build supports one left bar and one
   * right line on a categorical bar spec; see ResolveCategoricalCombo.
   * Unsupported mixtures are errors rather than substituting marks.
   */
  type?: string;
  /** values is the ordered list of points in the series. */
  values?: DataPoint[] | null;
  /**
   * ohlc is the ordered list of open/high/low/close points in the series,
   * used by ChartTypeOHLC. Build renders them as candlesticks.
   */
  ohlc?: OHLCPoint[] | null;
  /**
   * color is an optional per-series colour ("#rrggbb" or an ANSI colour
   * number). If empty, the Theme palette or surface default is used.
   */
  color?: string;
  /**
   * y_axis selects the Y axis the series is plotted against: "" or
   * YAxisLeft for the main axis, or YAxisRight for the right-hand axis,
   * which requires Spec.y2_axis.
   */
  y_axis?: string;
}

/**
 * DataPoint is a single datum in a Series.
 *
 * x may be a string (category), a time (Date, RFC 3339 string or ms since
 * the epoch) or a number (numeric value).
 */
export interface DataPoint {
  /** x is the independent-axis coordinate. */
  x?: XValue | null;
  /** y is the dependent-axis value. */
  y: number;
  /**
   * size is an optional scatter point weight. Surfaces that do not support
   * variable point sizing may ignore it.
   */
  size?: number | null;
}

/** OHLCPoint is a single open/high/low/close datum, used by ChartTypeOHLC. */
export interface OHLCPoint {
  /** t is the point's time: Date, RFC 3339 string, or ms-since-epoch. */
  t: XValue | null;
  /** o is the opening value. */
  o: number;
  /** h is the high value. */
  h: number;
  /** l is the low value. */
  l: number;
  /** c is the closing value. */
  c: number;
  /** v is optional non-negative volume. null/absent means missing; zero is a known zero. */
  v?: number | null;
}

/** HeatCell is a single (x, y, z) datum in a HeatData.cells list. */
export interface HeatCell {
  x: number;
  y: number;
  z: number;
}

/** HeatData holds heatmap cell/matrix data, used by ChartTypeHeatmap. */
export interface HeatData {
  /** cells is a sparse list of (x, y, z) cells. */
  cells?: HeatCell[] | null;
  /**
   * matrix is a row-major dense alternative to cells: matrix[y][x].
   * A nonempty matrix takes precedence over cells.
   */
  matrix?: (number[] | null)[] | null;
  /** min_value pins the colour-scale domain minimum. If null/absent, auto. */
  min_value?: number | null;
  /** max_value pins the colour-scale domain maximum. If null/absent, auto. */
  max_value?: number | null;
}

/**
 * Options are common, surface-agnostic rendering options.
 *
 * Surfaces are free to ignore options they do not support.
 */
export interface Options {
  /**
   * volume shows an OHLC volume panel below price when any point has v set.
   * It is supported only for ChartTypeOHLC; missing volumes leave gaps.
   */
  volume?: boolean;
  /** show_legend toggles the legend. */
  show_legend?: boolean;
  /** show_grid toggles the background grid. */
  show_grid?: boolean;
  /**
   * orientation controls bar chart orientation: "" or OrientationVertical
   * for vertical bars, OrientationHorizontal for horizontal bars.
   */
  orientation?: string;
  /** stacked stacks bar chart series instead of grouping them. */
  stacked?: boolean;
  /**
   * candle_style selects the OHLC candle rendering style: "" or
   * CandleStyleLine for box-drawing line runes, CandleStyleBlock for solid
   * block bodies. Unknown values are a Build error.
   */
  candle_style?: string;
}

/**
 * Theme describes surface-agnostic colours. Individual surfaces map these
 * to their native style systems (lipgloss on terminal, CSS colours on web).
 */
export interface Theme {
  /** background is a hex or named background colour for the chart area. */
  background?: string;
  /** foreground is the default colour for axes, labels and text. */
  foreground?: string;
  /** palette is an ordered list of colours used for series that do not supply their own color. */
  palette?: string[] | null;
  /** gradient is an ordered list of hex stops ("#rrggbb") used for sequential colormaps (heatmap). */
  gradient?: string[] | null;
}

// ── normalized ("Go struct") forms ──────────────────────────────────────────
// Build and the other entry points work on a normalized copy of the spec in
// which every field holds its Go value: absent strings are "", absent
// numbers 0, absent pointers and slices null. The copy also keeps Build from
// mutating its input.

/** @internal */
export interface NFormat {
  kind: string;
  precision: number | null;
  currency: string;
  layout: string;
}
/** @internal */
export interface NXAxis {
  title: string;
  type: string;
  labels: string[] | null;
  format: NFormat;
  scale: string;
}
/** @internal */
export interface NYAxis {
  title: string;
  min: number | null;
  max: number | null;
  labels: string[] | null;
  format: NFormat;
  scale: string;
}
/** @internal Go's `any` holding a JSON value or a Date; null is nil. */
export type GoAny = unknown;
/** @internal */
export interface NDataPoint {
  x: GoAny;
  y: number;
  size: number | null;
}
/** @internal */
export interface NOHLCPoint {
  t: GoAny;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number | null;
}
/** @internal */
export interface NSeries {
  name: string;
  type: string;
  values: NDataPoint[] | null;
  ohlc: NOHLCPoint[] | null;
  color: string;
  y_axis: string;
}
/** @internal */
export interface NData {
  series: NSeries[] | null;
  x_axis_data: GoAny[] | null;
}
/** @internal */
export interface NHeatData {
  cells: HeatCell[] | null;
  matrix: (number[] | null)[] | null;
  min_value: number | null;
  max_value: number | null;
}
/** @internal */
export interface NOptions {
  volume: boolean;
  show_legend: boolean;
  show_grid: boolean;
  orientation: string;
  stacked: boolean;
  candle_style: string;
}
/** @internal */
export interface NTheme {
  background: string;
  foreground: string;
  palette: string[] | null;
  gradient: string[] | null;
}
/** @internal */
export interface NSpec {
  type: string;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  x_axis: NXAxis;
  y_axis: NYAxis;
  y2_axis: NYAxis | null;
  data: NData;
  heat: NHeatData | null;
  options: NOptions;
  theme: NTheme;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const ptr = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const bool = (v: unknown): boolean => v === true;
const anyv = (v: unknown): GoAny => (v === undefined ? null : v);
const arr = <T, U>(v: unknown, f: (e: T) => U): U[] | null => (Array.isArray(v) ? (v as T[]).map(f) : null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = any;

/** @internal */
export function normFormat(f: Obj): NFormat {
  f = f ?? {};
  return { kind: str(f.kind), precision: ptr(f.precision), currency: str(f.currency), layout: str(f.layout) };
}
function normXAxis(a: Obj): NXAxis {
  a = a ?? {};
  return { title: str(a.title), type: str(a.type), labels: arr(a.labels, str), format: normFormat(a.format), scale: str(a.scale) };
}
/** @internal */
export function normYAxis(a: Obj): NYAxis {
  a = a ?? {};
  return {
    title: str(a.title),
    min: ptr(a.min),
    max: ptr(a.max),
    labels: arr(a.labels, str),
    format: normFormat(a.format),
    scale: str(a.scale),
  };
}
function normSeries(s: Obj): NSeries {
  s = s ?? {};
  return {
    name: str(s.name),
    type: str(s.type),
    values: arr(s.values, (p: Obj) => ({ x: anyv(p?.x), y: num(p?.y), size: ptr(p?.size) })),
    ohlc: arr(s.ohlc, (p: Obj) => ({ t: anyv(p?.t), o: num(p?.o), h: num(p?.h), l: num(p?.l), c: num(p?.c), v: ptr(p?.v) })),
    color: str(s.color),
    y_axis: str(s.y_axis),
  };
}
/** @internal */
export function normData(d: Obj): NData {
  d = d ?? {};
  return { series: arr(d.series, normSeries), x_axis_data: arr(d.x_axis_data, anyv) };
}

/** @internal normalize returns the Go value of a spec: a deep copy with Go's zero values filled in. */
export function normalize(s: Spec | NSpec): NSpec {
  const o: Obj = s ?? {};
  const h: Obj = o.heat;
  const op: Obj = o.options ?? {};
  const th: Obj = o.theme ?? {};
  return {
    type: str(o.type),
    title: str(o.title),
    subtitle: str(o.subtitle),
    width: num(o.width),
    height: num(o.height),
    x_axis: normXAxis(o.x_axis),
    y_axis: normYAxis(o.y_axis),
    y2_axis: o.y2_axis == null ? null : normYAxis(o.y2_axis),
    data: normData(o.data),
    heat:
      h == null
        ? null
        : {
            cells: arr(h.cells, (c: Obj) => ({ x: num(c?.x), y: num(c?.y), z: num(c?.z) })),
            matrix: arr(h.matrix, (row: unknown) => arr(row, num)),
            min_value: ptr(h.min_value),
            max_value: ptr(h.max_value),
          },
    options: {
      volume: bool(op.volume),
      show_legend: bool(op.show_legend),
      show_grid: bool(op.show_grid),
      orientation: str(op.orientation),
      stacked: bool(op.stacked),
      candle_style: str(op.candle_style),
    },
    theme: {
      background: str(th.background),
      foreground: str(th.foreground),
      palette: arr(th.palette, str),
      gradient: arr(th.gradient, str),
    },
  };
}

/** @internal len() of a Go slice. */
export const glen = (a: readonly unknown[] | null): number => (a === null ? 0 : a.length);

/** @internal fmtV formats a value as Go's %v does for the dynamic types a spec holds. */
export function fmtV(v: unknown): string {
  if (v === null || v === undefined) return '<nil>';
  if (typeof v === 'number') return sprintV(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return formatUnixMilliUTC(BigInt(v.getTime()), '2006-01-02 15:04:05.999999999 -0700 MST');
  if (Array.isArray(v)) return '[' + v.map(fmtV).join(' ') + ']';
  if (typeof v === 'object') {
    const keys = Object.keys(v).sort();
    return 'map[' + keys.map((k) => `${k}:${fmtV((v as Record<string, unknown>)[k])}`).join(' ') + ']';
  }
  return String(v);
}

// ── validation ──────────────────────────────────────────────────────────────

// validFormatKinds enumerates the recognized Format.kind values.
const validFormatKinds = new Set(['', 'number', 'percent', 'currency', 'si', 'time']);

// validateFormat reports an error if f.kind is not one of the recognized
// Format kinds. name identifies the axis in the error message (e.g. "x_axis").
function validateFormat(name: string, f: NFormat): Error | null {
  if (!validFormatKinds.has(f.kind)) {
    return new Error(`spec: ${name} format kind ${Quote(f.kind)} is not one of number|percent|currency|si|time`);
  }
  return null;
}

// validateScale reports an error if scale is not a recognized axis scale.
// name identifies the axis in the error message (e.g. "x_axis").
function validateScale(name: string, scale: string): Error | null {
  switch (scale) {
    case '':
    case ScaleLinear:
    case ScaleLog:
      return null;
  }
  return new Error(`spec: ${name} scale ${Quote(scale)} must be linear or log`);
}

/**
 * Validate throws the first structural error in the Spec, if any (Go's
 * Spec.Validate, which returns it).
 *
 * Validate is intentionally lightweight: it catches the obvious mistakes
 * (missing type, zero dimensions, empty series, a right-hand series without
 * y2_axis) without prejudging what the target surface considers renderable.
 */
export function Validate(s: Spec): void {
  const err = validate(normalize(s));
  if (err !== null) throw err;
}

/** @internal validate returns Validate's error, or null. */
export function validate(s: NSpec): Error | null {
  if (s.type === '') return new Error('spec: Type is required');
  if (!IsKnown(s.type)) return new Error(`spec: unknown chart type ${Quote(s.type)}`);
  if (s.width <= 0 || s.height <= 0) {
    return new Error(`spec: Width and Height must be positive (got ${s.width} x ${s.height})`);
  }

  if (s.type === ChartTypeHeatmap) {
    if (s.heat === null || (glen(s.heat.cells) === 0 && glen(s.heat.matrix) === 0)) {
      return new Error('spec: heatmap requires Heat data (cells or matrix)');
    }
  } else if (glen(s.data.series) === 0) {
    return new Error('spec: at least one Series is required');
  }

  if (s.options.volume && s.type !== ChartTypeOHLC) return new Error('spec: volume requires an ohlc chart');

  // Series that share a name share a data set on the terminal, so they
  // must share a Y axis too.
  const seen = new Map<string, { index: number; right: boolean }>();
  const series = s.data.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const ser = series[i];
    const ohlc = ser.ohlc ?? [];
    for (let j = 0; j < ohlc.length; j++) {
      const v = ohlc[j].v;
      if (v !== null && (Number.isNaN(v) || !Number.isFinite(v) || v < 0)) {
        return new Error(`spec: series[${i}] ohlc point ${j} volume must be finite and non-negative`);
      }
    }
    if (ser.name === '') return new Error(`spec: series[${i}] Name is required`);
    if (ser.type !== '' && !IsKnown(ser.type)) {
      return new Error(`spec: series[${i}] type ${Quote(ser.type)} is not a known chart type`);
    }
    switch (ser.y_axis) {
      case '':
      case YAxisLeft:
        break;
      case YAxisRight:
        if (s.y2_axis === null) return new Error(`spec: series[${i}] y_axis ${Quote(YAxisRight)} requires y2_axis`);
        break;
      default:
        return new Error(`spec: series[${i}] y_axis ${Quote(ser.y_axis)} must be left or right`);
    }
    const right = ser.y_axis === YAxisRight;
    const prev = seen.get(ser.name);
    if (prev !== undefined && prev.right !== right) {
      return new Error(`spec: series[${i}] ${Quote(ser.name)} is also series[${prev.index}] but on a different y_axis`);
    } else if (prev === undefined) {
      seen.set(ser.name, { index: i, right });
    }
  }

  switch (s.x_axis.type) {
    case '':
    case XAxisCategory:
    case XAxisTime:
    case XAxisValue:
      break;
    default:
      return new Error(`spec: x_axis type ${Quote(s.x_axis.type)} must be category, time, or value`);
  }

  if (s.type === ChartTypeOHLC) {
    if (!series.some((ser) => glen(ser.ohlc) > 0)) return new Error('spec: ohlc requires Series.OHLC points');
  }

  switch (s.options.orientation) {
    case '':
    case OrientationVertical:
    case OrientationHorizontal:
      break;
    default:
      return new Error(`spec: orientation ${Quote(s.options.orientation)} must be vertical or horizontal`);
  }

  return (
    validateFormat('x_axis', s.x_axis.format) ??
    validateFormat('y_axis', s.y_axis.format) ??
    validateScale('x_axis', s.x_axis.scale) ??
    validateScale('y_axis', s.y_axis.scale) ??
    (s.y2_axis === null ? null : validateFormat('y2_axis', s.y2_axis.format) ?? validateScale('y2_axis', s.y2_axis.scale))
  );
}

/** HasVolume reports whether the OHLC volume panel is enabled and has data (Go's Spec.HasVolume). */
export function HasVolume(s: Spec): boolean {
  return hasVolume(normalize(s));
}

/** @internal */
export function hasVolume(s: NSpec): boolean {
  if (s.type !== ChartTypeOHLC || !s.options.volume) return false;
  return (s.data.series ?? []).some((ser) => (ser.ohlc ?? []).some((p) => p.v !== null));
}

// ── JSON ────────────────────────────────────────────────────────────────────

/**
 * MarshalJSON returns the JSON text Go's json.Marshal writes for s (Go's
 * Spec.MarshalJSON): fields in struct order, `omitempty` / `omitzero`
 * fields left out at their zero values, HTML-safe string escaping, and a
 * Date X value as an RFC 3339 string. A NaN or infinite number throws, as
 * json.Marshal fails on it. JSON.stringify(s) is also accepted by Build,
 * but is not byte-identical to Go's output.
 */
export function MarshalJSON(s: Spec): string {
  try {
    return marshalSpec(normalize(s));
  } catch (e) {
    throw new Error(`json: error calling MarshalJSON for type spec.Spec: ${(e as Error).message}`);
  }
}

class JSONObject {
  private parts: string[] = [];
  add(key: string, v: string): this {
    this.parts.push(`${jsonString(key)}:${v}`);
    return this;
  }
  /** omitempty for a string, bool, number, pointer or slice */
  opt(key: string, v: string | null, empty: boolean): this {
    if (!empty && v !== null) this.add(key, v);
    return this;
  }
  get empty(): boolean {
    return this.parts.length === 0;
  }
  toString(): string {
    return `{${this.parts.join(',')}}`;
  }
}

// a Go int field: JSON has no negative zero for it
const jsonInt = (v: number): string => (Object.is(v, -0) ? '0' : jsonFloat(v));
const jstrs = (a: string[] | null): string => (a === null ? 'null' : `[${a.map(jsonString).join(',')}]`);
const jnums = (a: number[] | null): string => (a === null ? 'null' : `[${a.map(jsonFloat).join(',')}]`);

/** @internal JSON of a Go `any` value: a JSON-decoded value or a Date. */
export function jsonAny(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return jsonFloat(v);
  if (typeof v === 'string') return jsonString(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) {
    const ms = v.getTime();
    const y = v.getUTCFullYear();
    if (y < 0 || y > 9999) throw new Error('Time.MarshalJSON: year outside of range [0,9999]');
    return jsonString(formatUnixMilliUTC(BigInt(ms), '2006-01-02T15:04:05.999999999Z07:00'));
  }
  if (Array.isArray(v)) return `[${v.map(jsonAny).join(',')}]`;
  if (typeof v === 'object') {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${jsonString(k)}:${jsonAny((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return 'null';
}

function marshalFormat(f: NFormat): string {
  return new JSONObject()
    .opt('kind', jsonString(f.kind), f.kind === '')
    .opt('precision', f.precision === null ? null : jsonInt(f.precision), false)
    .opt('currency', jsonString(f.currency), f.currency === '')
    .opt('layout', jsonString(f.layout), f.layout === '')
    .toString();
}

const formatIsZero = (f: NFormat) => f.kind === '' && f.precision === null && f.currency === '' && f.layout === '';

function marshalYAxis(a: NYAxis): string {
  return new JSONObject()
    .opt('title', jsonString(a.title), a.title === '')
    .opt('min', a.min === null ? null : jsonFloat(a.min), false)
    .opt('max', a.max === null ? null : jsonFloat(a.max), false)
    .opt('labels', jstrs(a.labels), glen(a.labels) === 0)
    .opt('format', marshalFormat(a.format), formatIsZero(a.format))
    .opt('scale', jsonString(a.scale), a.scale === '')
    .toString();
}

// omitzero on a struct without an IsZero method: every field is zero (a
// slice only when nil).
const yAxisIsZero = (a: NYAxis) =>
  a.title === '' && a.min === null && a.max === null && a.labels === null && formatIsZero(a.format) && a.scale === '';

function marshalSpec(s: NSpec): string {
  const x = s.x_axis;
  const xIsZero = x.title === '' && x.type === '' && x.labels === null && formatIsZero(x.format) && x.scale === '';
  const xs = new JSONObject()
    .opt('title', jsonString(x.title), x.title === '')
    .opt('type', jsonString(x.type), x.type === '')
    .opt('labels', jstrs(x.labels), glen(x.labels) === 0)
    .opt('format', marshalFormat(x.format), formatIsZero(x.format))
    .opt('scale', jsonString(x.scale), x.scale === '');
  const series =
    s.data.series === null
      ? 'null'
      : `[${s.data.series
          .map((ser) =>
            new JSONObject()
              .add('name', jsonString(ser.name))
              .opt('type', jsonString(ser.type), ser.type === '')
              .add(
                'values',
                ser.values === null
                  ? 'null'
                  : `[${ser.values
                      .map((p) =>
                        new JSONObject()
                          .opt('x', p.x === null ? null : jsonAny(p.x), false)
                          .add('y', jsonFloat(p.y))
                          .opt('size', p.size === null ? null : jsonFloat(p.size), false)
                          .toString(),
                      )
                      .join(',')}]`,
              )
              .opt(
                'ohlc',
                ser.ohlc === null
                  ? null
                  : `[${ser.ohlc
                      .map((p) =>
                        new JSONObject()
                          .add('t', jsonAny(p.t))
                          .add('o', jsonFloat(p.o))
                          .add('h', jsonFloat(p.h))
                          .add('l', jsonFloat(p.l))
                          .add('c', jsonFloat(p.c))
                          .opt('v', p.v === null ? null : jsonFloat(p.v), false)
                          .toString(),
                      )
                      .join(',')}]`,
                glen(ser.ohlc) === 0,
              )
              .opt('color', jsonString(ser.color), ser.color === '')
              .opt('y_axis', jsonString(ser.y_axis), ser.y_axis === '')
              .toString(),
          )
          .join(',')}]`;
  const data = new JSONObject()
    .add('series', series)
    .opt('x_axis_data', s.data.x_axis_data === null ? null : jsonAny(s.data.x_axis_data), glen(s.data.x_axis_data) === 0);
  const h = s.heat;
  const heat =
    h === null
      ? null
      : new JSONObject()
          .opt(
            'cells',
            h.cells === null
              ? null
              : `[${h.cells
                  .map((c) => new JSONObject().add('x', jsonFloat(c.x)).add('y', jsonFloat(c.y)).add('z', jsonFloat(c.z)).toString())
                  .join(',')}]`,
            glen(h.cells) === 0,
          )
          .opt('matrix', h.matrix === null ? null : `[${h.matrix.map(jnums).join(',')}]`, glen(h.matrix) === 0)
          .opt('min_value', h.min_value === null ? null : jsonFloat(h.min_value), false)
          .opt('max_value', h.max_value === null ? null : jsonFloat(h.max_value), false)
          .toString();
  const o = s.options;
  const options = new JSONObject()
    .opt('volume', 'true', !o.volume)
    .opt('show_legend', 'true', !o.show_legend)
    .opt('show_grid', 'true', !o.show_grid)
    .opt('orientation', jsonString(o.orientation), o.orientation === '')
    .opt('stacked', 'true', !o.stacked)
    .opt('candle_style', jsonString(o.candle_style), o.candle_style === '');
  const t = s.theme;
  const themeIsZero = t.background === '' && t.foreground === '' && t.palette === null && t.gradient === null;
  const theme = new JSONObject()
    .opt('background', jsonString(t.background), t.background === '')
    .opt('foreground', jsonString(t.foreground), t.foreground === '')
    .opt('palette', jstrs(t.palette), glen(t.palette) === 0)
    .opt('gradient', jstrs(t.gradient), glen(t.gradient) === 0);
  return new JSONObject()
    .add('type', jsonString(s.type))
    .opt('title', jsonString(s.title), s.title === '')
    .opt('subtitle', jsonString(s.subtitle), s.subtitle === '')
    .add('width', jsonInt(s.width))
    .add('height', jsonInt(s.height))
    .opt('x_axis', xs.toString(), xIsZero)
    .opt('y_axis', marshalYAxis(s.y_axis), yAxisIsZero(s.y_axis))
    .opt('y2_axis', s.y2_axis === null ? null : marshalYAxis(s.y2_axis), false)
    .add('data', data.toString())
    .opt('heat', heat, false)
    .opt('options', options.toString(), options.empty)
    .opt('theme', theme.toString(), themeIsZero)
    .toString();
}
