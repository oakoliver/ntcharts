// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import { newStyle, type Style } from '@oakoliver/lipgloss';
import * as barchart from '../barchart/index.js';
import { goInt, type Float64Point } from '../canvas/canvas.js';
import * as heatmap from '../heatmap/index.js';
import { compareTime, formatUnixMilliUTC, goInt64, subNanos, type GoTime } from '../internal/gotime.js';
import { sprintV } from '../internal/format.js';
import { Quote } from '../internal/strconv.js';
import * as linechart from '../linechart/index.js';
import * as tslc from '../linechart/timeserieslinechart/index.js';
import * as sparkline from '../sparkline/index.js';
import { roundHalfAway } from '../canvas/canvas.js';
import { buildCategorical, type CategoricalModel } from './build_category.js';
import { buildCombo, type ComboModel } from './build_combo.js';
import { buildOHLCVolume, type OHLCModel } from './build_ohlc_volume.js';
import { isCategoricalCombo } from './combo.js';
import { gradientScale } from './gradient.js';
import { PointX, pointFloat, pointGoTime, pointString } from './helpers.js';
import {
  axisLabelFormatter,
  checkScaleSupport,
  goMax,
  goMin,
  logOK,
  logRange,
  logValueError,
  logXBounds,
  logYBounds,
  resolveLogYRange,
} from './scale.js';
import {
  CandleStyleBlock,
  CandleStyleLine,
  ChartTypeBar,
  ChartTypeCanvas,
  ChartTypeHeatmap,
  ChartTypeLine,
  ChartTypeOHLC,
  ChartTypeScatter,
  ChartTypeSparkline,
  ChartTypeStreamline,
  ChartTypeTimeSeries,
  IsZero,
  OrientationHorizontal,
  ScaleLog,
  XAxisCategory,
  YAxisRight,
  fmtV,
  glen,
  hasVolume,
  normData,
  normalize,
  validate,
  type Data,
  type HeatCell,
  type NData,
  type NDataPoint,
  type NSeries,
  type NSpec,
  type NTheme,
  type NYAxis,
  type Spec,
} from './spec.js';

/**
 * BuildResult is what Build returns: one of the ntcharts terminal models.
 * Every one renders with view().
 */
export type BuildResult =
  | barchart.Model
  | linechart.Model
  | tslc.Model
  | heatmap.Model
  | sparkline.Model
  | CategoricalModel
  | ComboModel
  | OHLCModel;

/**
 * Build converts a Spec into the appropriate ntcharts terminal model.
 *
 * The concrete return type depends on Spec.type:
 *
 *   - ChartTypeBar         -> barchart.Model (categorical combo: ComboModel)
 *   - ChartTypeLine        -> linechart.Model (categorical: CategoricalModel)
 *   - ChartTypeTimeSeries  -> timeserieslinechart.Model
 *   - ChartTypeScatter     -> linechart.Model (categorical: CategoricalModel)
 *   - ChartTypeHeatmap     -> heatmap.Model
 *   - ChartTypeSparkline   -> sparkline.Model
 *   - ChartTypeOHLC        -> timeserieslinechart.Model (volume: OHLCModel)
 *
 * Callers narrow the result with instanceof. Where Go returns an error,
 * Build throws an Error with Go's message; unsupported chart types throw
 * rather than misrender, so future additions to ChartType do not break
 * existing callers.
 *
 * A log axis (x_axis.scale / y_axis.scale == ScaleLog) sets the model's own
 * scale to linechart.ScaleLog; its ranges stay in data units.
 *
 * Spec.y2_axis adds a right-hand Y axis to line, scatter and timeseries
 * charts; series with y_axis == YAxisRight are plotted against it. It obeys
 * the same pin, scale and format rules as y_axis. A categorical bar/line
 * combo also supports y2_axis; see ResolveCategoricalCombo. Other chart types
 * reject it.
 *
 * Build does not mutate s. s may be a parsed JSON spec: absent fields are
 * Go's zero values.
 */
export function Build(s: Spec): BuildResult {
  return build(normalize(s));
}

/** @internal build is Build on a normalized spec. */
export function build(s: NSpec): BuildResult {
  const err = validate(s);
  if (err !== null) throw err;
  if (isCategoricalCombo(s)) return buildCombo(s);
  const series = s.data.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const ser = series[i];
    if (ser.type !== '' && ser.type !== s.type && !(s.type === ChartTypeTimeSeries && ser.type === 'line')) {
      throw new Error(`spec: series[${i}] type ${Quote(ser.type)} is unsupported in terminal ${Quote(s.type)} charts`);
    }
  }
  const e = checkY2Support(s) ?? checkScaleSupport(s);
  if (e !== null) throw e;
  if (s.x_axis.type === XAxisCategory && (s.type === ChartTypeLine || s.type === ChartTypeScatter)) {
    return buildCategorical(s);
  }
  switch (s.type) {
    case ChartTypeBar:
      return buildBar(s);
    case ChartTypeTimeSeries:
      return buildTimeSeries(s);
    case ChartTypeLine:
      return buildLine(s);
    case ChartTypeScatter:
      return buildScatter(s);
    case ChartTypeHeatmap:
      return buildHeatmap(s);
    case ChartTypeSparkline:
      return buildSparkline(s);
    case ChartTypeOHLC:
      return buildOHLC(s);
    case ChartTypeStreamline:
    case ChartTypeCanvas:
      throw new Error(`spec: Build for chart type ${Quote(s.type)} is not yet implemented`);
    default:
      throw new Error(`spec: unknown chart type ${Quote(s.type)}`);
  }
}

/**
 * @internal buildBar constructs a barchart.Model from s.
 *
 * The bar chart is built along the following mapping:
 *
 *	spec series              -> stacked BarValue segments within each bar
 *	spec x_axis.labels       -> per-bar label
 *	spec y_axis.max          -> WithMaxValue (if set; otherwise auto-max)
 *	spec series[i].color     -> BarValue style foreground
 *	spec theme.palette       -> fallback colour for series without color
 *	spec options.orientation -> WithHorizontalBars() when OrientationHorizontal
 *
 * Each X-axis label becomes a single bar whose stacked segments are the
 * Y value of every series at the matching index. When x_axis.labels is
 * empty, labels are derived from the first series' DataPoint.x values.
 *
 * ntcharts' barchart.Model only supports stacked segments within a bar — it
 * has no grouped/side-by-side rendering mode. So a Spec with more than one
 * Series must set options.stacked to true; otherwise Build throws rather
 * than silently stacking series the caller may have expected to be grouped.
 */
export function buildBar(s: NSpec): barchart.Model {
  const series = s.data.series ?? [];
  if (series.length > 1 && !s.options.stacked) {
    throw new Error('spec: terminal bar charts cannot render grouped bars; set options.stacked=true or use a single series');
  }

  let labels = s.x_axis.labels ?? [];
  if (labels.length === 0) labels = deriveBarLabels(s.data);
  if (labels.length === 0) throw new Error('spec: bar chart requires x_axis labels or per-series X values');

  const data: barchart.BarData[] = labels.map((label, i) => {
    const values: barchart.BarValue[] = [];
    for (let j = 0; j < series.length; j++) {
      const ser = series[j];
      if (i >= glen(ser.values)) continue;
      values.push({ name: ser.name, value: ser.values![i].y, style: seriesStyle(ser, j, s.theme) });
    }
    return { label, values };
  });

  const { min, max } = s.y_axis;
  if (min !== null && max !== null && min > max) {
    throw new Error(`spec: y_axis min ${sprintV(min)} exceeds max ${sprintV(max)}`);
  }
  const opts: barchart.Option[] = [barchart.WithDataSet(data)];
  // Each pin goes straight to the model; an unset bound stays under the
  // model's own auto-scaling, which already tracks negative values.
  if (min !== null) opts.push(barchart.WithMinValue(min));
  if (max !== null) opts.push(barchart.WithMaxValue(max));
  if (s.options.orientation === OrientationHorizontal) opts.push(barchart.WithHorizontalBars());

  const m = barchart.New(s.width, s.height, ...opts);
  m.draw();
  return m;
}

/**
 * @internal resolveXFloat resolves a point's numeric X: the point's own X,
 * else the shared data.x_axis_data at idx, else the index itself. Shared
 * with buildScatter.
 */
export function resolveXFloat(s: NSpec, p: NDataPoint, idx: number): number {
  const [x, ok] = pointFloat(PointX(p, idx, s.data.x_axis_data));
  return ok ? x : idx;
}

/**
 * @internal yBounds scans every DataPoint.y across series and returns the
 * observed minimum and maximum. ok is false when no series contained any points.
 */
export function yBounds(series: NSeries[]): [number, number, boolean] {
  let min = Infinity;
  let max = -Infinity;
  for (const ser of series) {
    for (const p of ser.values ?? []) {
      min = goMin(min, p.y);
      max = goMax(max, p.y);
    }
  }
  return [min, max, min !== Infinity];
}

/**
 * @internal resolveYRange implements the spec-level one-sided Y-axis pin
 * rule for an axis: a lone min or max pins that bound; the missing bound
 * falls back to the data-derived extreme of the axis's series (via yBounds),
 * or 0 when there is no data to derive it from. It is an error for the
 * resulting min to exceed the resulting max — e.g. a min pin above the
 * data's actual max would silently build an inverted range without this
 * guard.
 */
export function resolveYRange(a: yAxisRef): [number, number] {
  let [min, max, ok] = yBounds(a.series);
  if (!ok) {
    min = 0;
    max = 0;
  }
  return resolvePinnedYRange(a, min, max);
}

/**
 * @internal resolvePinnedYRange preserves explicit bounds when widening a
 * flat range. Two equal pins cannot describe a drawable range and are
 * rejected.
 */
export function resolvePinnedYRange(a: yAxisRef, min: number, max: number): [number, number] {
  const axis = a.axis;
  if (axis.min !== null) min = axis.min;
  if (axis.max !== null) max = axis.max;
  if (min > max) throw new Error(`spec: ${a.name} min ${sprintV(min)} exceeds max ${sprintV(max)}`);
  if (min === max) {
    if (axis.min !== null && axis.max !== null) throw new Error(`spec: ${a.name} min and max must differ`);
    if (axis.min === null) min--;
    if (axis.max === null) max++;
  }
  return [min, max];
}

/** @internal checkGraphSize runs after ranges and formatters have determined the margins. */
export function checkGraphSize(m: linechart.Model): void {
  if (m.graphWidth() < 1 || m.graphHeight() < 1) {
    throw new Error(`spec: ${m.width()} x ${m.height()} chart is too small for axes and labels`);
  }
}

/**
 * @internal yAxisRef is one Y axis of a spec with the series plotted against
 * it. name is "y_axis" or "y2_axis" and prefixes every error about the axis,
 * so the left and right axes report the same mistakes in the same words.
 */
export interface yAxisRef {
  name: string;
  axis: NYAxis;
  series: NSeries[];
}

/** @internal splitYAxes returns the series on the left Y axis and on the right one. */
export function splitYAxes(s: NSpec): [NSeries[], NSeries[]] {
  const left: NSeries[] = [];
  const right: NSeries[] = [];
  for (const ser of s.data.series ?? []) {
    if (ser.y_axis === YAxisRight) right.push(ser);
    else left.push(ser);
  }
  return [left, right];
}

/** @internal leftAxis returns the spec's left Y axis with its series. */
export function leftAxis(s: NSpec): yAxisRef {
  return { name: 'y_axis', axis: s.y_axis, series: splitYAxes(s)[0] };
}

/** @internal rightAxis returns the spec's right Y axis with its series. Requires s.y2_axis !== null. */
export function rightAxis(s: NSpec): yAxisRef {
  return { name: 'y2_axis', axis: s.y2_axis!, series: splitYAxes(s)[1] };
}

/**
 * @internal checkY2Support rejects a right Y axis on chart types that cannot
 * draw one. A right-hand series without y2_axis is already a Validate error.
 */
export function checkY2Support(s: NSpec): Error | null {
  if (s.y2_axis === null) return null;
  switch (s.type) {
    case ChartTypeLine:
    case ChartTypeScatter:
    case ChartTypeTimeSeries:
      return null;
  }
  return new Error(`spec: y2_axis is not supported for chart type ${Quote(s.type)}`);
}

/**
 * @internal newY2Axis returns the right Y axis of a chart from its resolved
 * range: the spec axis's scale and label format, and the label style of the
 * first right-hand series, so the labels read as that series'.
 */
export function newY2Axis(s: NSpec, a: yAxisRef, min: number, max: number): Partial<linechart.Axis> {
  const axis: Partial<linechart.Axis> = {
    min,
    max,
    labelFormatter: axisLabelFormatter(a.axis.format, a.axis.scale),
  };
  if (a.axis.scale === ScaleLog) axis.scale = linechart.ScaleLog;
  const series = s.data.series ?? [];
  for (let i = 0; i < series.length; i++) {
    if (series[i].y_axis === YAxisRight) {
      axis.labelStyle = seriesStyle(series[i], i, s.theme);
      break;
    }
  }
  return axis;
}

/**
 * @internal buildLine joins each series' points in input order on a base
 * linechart. Numeric X comes from the point, shared X data, or the point's
 * index. Linear ranges retain the native defaults (0..1), expanded around
 * the data; Y pins follow resolveYRange. Log ranges widen to whole decades.
 * Ranges and formatters are resolved before drawing so every segment shares
 * the same mapping and series colours, including singleton points.
 * A right-hand series (y_axis == YAxisRight) is resolved against y2_axis
 * with the same rules and drawn through y2ToY.
 */
export function buildLine(s: NSpec): linechart.Model {
  const logX = s.x_axis.scale === ScaleLog;
  const logY = s.y_axis.scale === ScaleLog;
  let minX = 0;
  let maxX = 1;
  let minY = 0;
  let maxY = 1;
  if (logY) {
    const [lo, hi, ok] = logYBounds(leftAxis(s));
    [minY, maxY] = resolveLogYRange(leftAxis(s), lo, hi, ok);
  } else if (s.y_axis.min !== null || s.y_axis.max !== null) {
    [minY, maxY] = resolveYRange(leftAxis(s));
  } else {
    const [lo, hi, ok] = yBounds(leftAxis(s).series);
    if (ok) {
      minY = goMin(minY, lo);
      maxY = goMax(maxY, hi);
    }
  }
  let y2: Partial<linechart.Axis> | null = null;
  if (s.y2_axis !== null) {
    const a = rightAxis(s);
    let minY2 = 0;
    let maxY2 = 1;
    if (a.axis.scale === ScaleLog) {
      const [lo, hi, ok] = logYBounds(a);
      [minY2, maxY2] = resolveLogYRange(a, lo, hi, ok);
    } else if (a.axis.min !== null || a.axis.max !== null) {
      [minY2, maxY2] = resolveYRange(a);
    } else {
      const [lo, hi, ok] = yBounds(a.series);
      if (ok) {
        minY2 = goMin(minY2, lo);
        maxY2 = goMax(maxY2, hi);
      }
    }
    y2 = newY2Axis(s, a, minY2, maxY2);
  }
  if (logX) {
    let [lo, hi, ok] = logXBounds(s);
    if (!ok) {
      lo = 1;
      hi = 10;
    }
    [minX, maxX] = logRange(lo, hi, false, false);
  } else {
    for (const ser of s.data.series ?? []) {
      const values = ser.values ?? [];
      for (let j = 0; j < values.length; j++) {
        const x = resolveXFloat(s, values[j], j);
        minX = goMin(minX, x);
        maxX = goMax(maxX, x);
      }
    }
  }
  const opts: linechart.Option[] = [];
  if (logX) opts.push(linechart.WithXScale(linechart.ScaleLog));
  if (logY) opts.push(linechart.WithYScale(linechart.ScaleLog));
  const xf = axisLabelFormatter(s.x_axis.format, s.x_axis.scale);
  if (xf !== null) opts.push(linechart.WithXLabelFormatter(xf));
  const yf = axisLabelFormatter(s.y_axis.format, s.y_axis.scale);
  if (yf !== null) opts.push(linechart.WithYLabelFormatter(yf));
  if (y2 !== null) opts.push(linechart.WithY2Axis(y2));
  const m = linechart.New(s.width, s.height, minX, maxX, minY, maxY, ...opts);
  checkGraphSize(m);
  m.drawXYAxisAndLabel();
  const series = s.data.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const ser = series[i];
    const style = seriesStyle(ser, i, s.theme);
    const y = ser.y_axis === YAxisRight ? (v: number) => m.y2ToY(v) : (v: number) => v;
    const values = ser.values ?? [];
    for (let j = 0; j < values.length; j++) {
      const p = values[j];
      const from: Float64Point = { x: resolveXFloat(s, p, j), y: y(p.y) };
      let to = from; // a singleton or final point still gets a braille dot
      if (j + 1 < values.length) {
        const next = values[j + 1];
        to = { x: resolveXFloat(s, next, j + 1), y: y(next.y) };
      }
      m.drawBrailleLineWithStyle(from, to, style);
    }
  }
  return m;
}

/**
 * @internal buildScatter renders points onto a base linechart canvas.
 * ntcharts has no scatter model; the spec surface owns range computation and
 * point drawing. DataPoint.size is accepted in the schema but ignored by
 * this surface. y_axis.min / y_axis.max follow the one-sided pin rule (a
 * lone bound pins; the other is data-derived); it is an error for the
 * resulting min to exceed the resulting max. A right-hand series
 * (y_axis == YAxisRight) is resolved against y2_axis with the same rules and
 * drawn through y2ToY.
 */
export function buildScatter(s: NSpec): linechart.Model {
  const logX = s.x_axis.scale === ScaleLog;
  const logY = s.y_axis.scale === ScaleLog;
  const logY2 = s.y2_axis !== null && s.y2_axis.scale === ScaleLog;
  const pts: { x: number; y: number; right: boolean; style: Style }[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minY2 = Infinity;
  let maxY2 = -Infinity;
  const series = s.data.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const ser = series[i];
    const st = seriesStyle(ser, i, s.theme);
    const right = ser.y_axis === YAxisRight;
    const axisName = right ? 'y2_axis' : 'y_axis';
    const logAxis = right ? logY2 : logY;
    const values = ser.values ?? [];
    for (let j = 0; j < values.length; j++) {
      const p = values[j];
      const x = resolveXFloat(s, p, j);
      if (logX && !logOK(x)) throw logValueError('x_axis', `series ${Quote(ser.name)} point ${j} has x`, x);
      if (logAxis && !logOK(p.y)) throw logValueError(axisName, `series ${Quote(ser.name)} point ${j} has y`, p.y);
      pts.push({ x, y: p.y, right, style: st });
      minX = goMin(minX, x);
      maxX = goMax(maxX, x);
      if (right) {
        minY2 = goMin(minY2, p.y);
        maxY2 = goMax(maxY2, p.y);
      } else {
        minY = goMin(minY, p.y);
        maxY = goMax(maxY, p.y);
      }
    }
  }
  if (pts.length === 0) throw new Error('spec: scatter requires at least one data point');
  const okY = minY !== Infinity;
  if (!okY) {
    // no left-hand points
    minY = 0;
    maxY = 0;
  }
  if (logY) [minY, maxY] = resolveLogYRange(leftAxis(s), minY, maxY, okY);
  else [minY, maxY] = resolvePinnedYRange(leftAxis(s), minY, maxY);
  let y2: Partial<linechart.Axis> | null = null;
  if (s.y2_axis !== null) {
    const a = rightAxis(s);
    const ok = minY2 !== Infinity;
    if (!ok) {
      minY2 = 0;
      maxY2 = 0;
    }
    if (logY2) [minY2, maxY2] = resolveLogYRange(a, minY2, maxY2, ok);
    else [minY2, maxY2] = resolvePinnedYRange(a, minY2, maxY2);
    y2 = newY2Axis(s, a, minY2, maxY2);
  }
  if (logX) {
    [minX, maxX] = logRange(minX, maxX, false, false);
  } else if (minX === maxX) {
    minX = minX - 1;
    maxX = maxX + 1;
  }
  const opts: linechart.Option[] = [];
  if (logX) opts.push(linechart.WithXScale(linechart.ScaleLog));
  if (logY) opts.push(linechart.WithYScale(linechart.ScaleLog));
  const xf = axisLabelFormatter(s.x_axis.format, s.x_axis.scale);
  if (xf !== null) opts.push(linechart.WithXLabelFormatter(xf));
  const yf = axisLabelFormatter(s.y_axis.format, s.y_axis.scale);
  if (yf !== null) opts.push(linechart.WithYLabelFormatter(yf));
  if (y2 !== null) opts.push(linechart.WithY2Axis(y2));
  const m = linechart.New(s.width, s.height, minX, maxX, minY, maxY, ...opts);
  checkGraphSize(m);
  m.drawXYAxisAndLabel();
  for (const p of pts) {
    const y = p.right ? m.y2ToY(p.y) : p.y;
    m.drawRuneWithStyle({ x: p.x, y }, '•', p.style);
  }
  return m;
}

/** Go's time.UnixMilli(t.ms) as a JavaScript Date (sub-millisecond time is dropped). */
const toDate = (t: GoTime): Date => new Date(t.ms);

/**
 * @internal buildTimeSeries constructs a timeserieslinechart.Model from s.
 *
 *  1. Each spec Series becomes a named data set in the timeserieslinechart
 *     (see setDataSetStyle / pushDataSet).
 *  2. DataPoint.x accepts a Date, RFC 3339 strings or numeric ms; PointTime
 *     converts all three.
 *  3. y_axis.min / y_axis.max pin the Y axis via WithYRange following the
 *     one-sided pin rule: a lone min or max pins that bound and the missing
 *     bound is derived from the pushed points; when both are null the chart
 *     auto-scales.
 *  4. y_axis.format / x_axis.format (when kind == "time") thread custom
 *     LabelFormatters through WithYLabelFormatter / WithXLabelFormatter at
 *     construction time; when unset, the chart's own defaults (including
 *     DateTimeLabelFormatter for X) are used.
 *  5. Per-series color is applied via setDataSetStyle using a lipgloss
 *     foreground. Background and gridlines are not rendered.
 *  6. y2_axis adds a right Y axis with the same range rules; series with
 *     y_axis == YAxisRight are assigned to it with setDataSetYAxis before
 *     their points are pushed, so their data auto-ranges the right axis.
 */
export function buildTimeSeries(s: NSpec): tslc.Model {
  let [tMin, tMax, ok] = timeBounds(s.data);
  if (!ok) throw new Error('spec: timeseries chart requires at least one DataPoint with a time X value');
  [tMin, tMax] = drawableTimeRange(tMin, tMax);

  const opts: tslc.Option[] = [tslc.WithTimeRange(toDate(tMin), toDate(tMax))];
  const logY = s.y_axis.scale === ScaleLog;
  if (logY) {
    const [lo, hi, okY] = logYBounds(leftAxis(s));
    const [minY, maxY] = resolveLogYRange(leftAxis(s), lo, hi, okY);
    opts.push(tslc.WithYScale(linechart.ScaleLog), tslc.WithYRange(minY, maxY));
  } else if (s.y_axis.min !== null || s.y_axis.max !== null) {
    const [minY, maxY] = resolveYRange(leftAxis(s));
    opts.push(tslc.WithYRange(minY, maxY));
  }
  const yf = axisLabelFormatter(s.y_axis.format, s.y_axis.scale);
  if (yf !== null) opts.push(tslc.WithYLabelFormatter(yf));
  if (s.y2_axis !== null) {
    const a = rightAxis(s);
    const logY2 = a.axis.scale === ScaleLog;
    let minY2 = 0; // the model's own default, widened by auto-ranging
    let maxY2 = 1;
    if (logY2) {
      const [lo, hi, okY2] = logYBounds(a);
      [minY2, maxY2] = resolveLogYRange(a, lo, hi, okY2);
    } else if (a.axis.min !== null || a.axis.max !== null) {
      [minY2, maxY2] = resolveYRange(a);
    }
    const axis = newY2Axis(s, a, minY2, maxY2);
    axis.autoMin = !logY2 && a.axis.min === null;
    axis.autoMax = !logY2 && a.axis.max === null;
    opts.push(tslc.WithY2Axis(axis));
  }
  // Only kind == "time" X formats apply to a timeseries X axis; other kinds
  // (number/percent/currency/si) are intentionally ignored here since the X
  // axis values are time, not the quantity those kinds format.
  if (!IsZero(s.x_axis.format) && s.x_axis.format.kind === 'time') {
    const layout = s.x_axis.format.layout === '' ? '2006-01-02' : s.x_axis.format.layout;
    opts.push(tslc.WithXLabelFormatter(makeTimeAxisFormatter(layout)));
  }

  const m = tslc.New(s.width, s.height, ...opts);
  m.autoMinY = !logY && s.y_axis.min === null;
  m.autoMaxY = !logY && s.y_axis.max === null;

  const series = s.data.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const ser = series[i];
    const name = ser.name;
    if (ser.y_axis === YAxisRight) m.setDataSetYAxis(name, linechart.YAxisRight);
    m.setDataSetStyle(name, seriesStyle(ser, i, s.theme));
    const values = ser.values ?? [];
    for (let j = 0; j < values.length; j++) {
      const t = pointGoTime(PointX(values[j], j, s.data.x_axis_data));
      if (t === null) continue;
      m.pushDataSet(name, { time: toDate(t), value: values[j].y });
    }
  }

  checkGraphSize(m);
  m.drawBrailleAll();
  return m;
}

/**
 * @internal makeTimeAxisFormatter returns a LabelFormatter for the X axis
 * of a timeserieslinechart that renders the given Go time layout instead of
 * the package default DateTimeLabelFormatter's "MM/DD" / "'YY MM/DD" scheme.
 *
 * timeserieslinechart passes X label values as seconds-since-epoch; this
 * mirrors DateTimeLabelFormatter's value->time conversion exactly
 * (time.UnixMilli(int64(math.Round(v * 1e3)))), only swapping in a custom
 * layout.
 */
export function makeTimeAxisFormatter(layout: string): linechart.LabelFormatter {
  return (_i: number, v: number) => formatUnixMilliUTC(goInt64(roundHalfAway(v * 1e3)), layout);
}

/**
 * DeriveBarLabels returns the category labels for a bar chart whose Spec
 * did not set x_axis.labels: the first series' DataPoint.x values, falling
 * back to data.x_axis_data for omitted X values, then the 1-based point
 * index where the resolved X is not a string. Every surface that renders
 * bar charts applies this same rule so labels agree across them.
 */
export function DeriveBarLabels(data: Data | null | undefined): string[] {
  return deriveBarLabels(normData(data));
}

function deriveBarLabels(data: NData): string[] {
  const series = data.series ?? [];
  if (series.length === 0) return [];
  const first = series[0].values ?? [];
  return first.map((p, i) => {
    const [label, ok] = pointString(PointX(p, i, data.x_axis_data));
    return ok ? label : String(i + 1);
  });
}

/**
 * @internal timeBounds scans every resolved DataPoint.x and returns the
 * minimum and maximum time. The third return value is false if no series
 * contained a time-valued X.
 */
export function timeBounds(data: NData): [GoTime, GoTime, boolean] {
  let min: GoTime = { ms: 0, ns: 0 };
  let max: GoTime = { ms: 0, ns: 0 };
  let found = false;
  for (const ser of data.series ?? []) {
    const values = ser.values ?? [];
    for (let i = 0; i < values.length; i++) {
      const t = pointGoTime(PointX(values[i], i, data.x_axis_data));
      if (t === null) continue;
      if (!found) {
        min = t;
        max = t;
        found = true;
        continue;
      }
      if (compareTime(t, min) < 0) min = t;
      if (compareTime(t, max) > 0) max = t;
    }
  }
  return [min, max, found];
}

const hourMs = 3600 * 1000;

/**
 * @internal The timeseries model stores millisecond timestamps. Widen
 * singleton ranges, including distinct sub-millisecond times that collapse
 * to one value.
 */
export function drawableTimeRange(min: GoTime, max: GoTime): [GoTime, GoTime] {
  if (max.ms <= min.ms) {
    return [
      { ms: min.ms - 12 * hourMs, ns: 0 },
      { ms: min.ms + 12 * hourMs, ns: 0 },
    ];
  }
  return [min, max];
}

/**
 * @internal buildHeatmap renders heat data onto a heatmap model.
 * theme.gradient (hex stops) becomes an interpolated color scale; absent,
 * the package default grayscale applies.
 */
export function buildHeatmap(s: NSpec): heatmap.Model {
  const heat = s.heat;
  if (heat === null || (glen(heat.cells) === 0 && glen(heat.matrix) === 0)) {
    throw new Error('spec: heatmap requires Heat data (cells or matrix)');
  }
  const opts: heatmap.Option[] = [];
  const cs = gradientScale(s.theme.gradient);
  if (cs !== null) opts.push(heatmap.WithColorScale(cs));
  if (heat.min_value !== null || heat.max_value !== null) {
    let minValue = Infinity;
    let maxValue = -Infinity;
    const observe = (v: number) => {
      minValue = goMin(minValue, v);
      maxValue = goMax(maxValue, v);
    };
    if (glen(heat.matrix) > 0) {
      for (const row of heat.matrix!) for (const v of row ?? []) observe(v);
    } else {
      for (const cell of heat.cells ?? []) observe(cell.z);
    }
    if (minValue === Infinity) throw new Error('spec: heatmap requires at least one cell');
    if (heat.min_value !== null) minValue = heat.min_value;
    if (heat.max_value !== null) maxValue = heat.max_value;
    if (minValue > maxValue) {
      throw new Error(`spec: heat min_value ${sprintV(minValue)} exceeds max_value ${sprintV(maxValue)}`);
    }
    opts.push(heatmap.WithValueRange(minValue, maxValue));
  } else {
    opts.push(heatmap.WithAutoValueRange());
  }
  // The cells form an index grid, drawn as filled blocks that tile the plot.
  // Cell (x, y) is column x and row y, with row 0 first: the topmost row,
  // where y_axis.labels[0] is drawn, as in flint's own heatmaps. The model
  // counts rows up from the bottom, so rows and row labels are mirrored.
  let cells: HeatCell[] = [];
  if (glen(heat.matrix) > 0) {
    heat.matrix!.forEach((row, y) => (row ?? []).forEach((value, x) => cells.push({ x, y, z: value })));
  } else {
    cells = heat.cells ?? [];
  }
  const xl = s.x_axis.labels ?? [];
  const yl = s.y_axis.labels ?? [];
  let nx = xl.length;
  let ny = yl.length;
  for (const c of cells) {
    if (c.x < 0 || c.y < 0) {
      throw new Error(`spec: heatmap cell indices must be non-negative; got cell (${sprintV(c.x)}, ${sprintV(c.y)})`);
    }
    nx = Math.max(nx, goInt(Math.floor(c.x)) + 1);
    ny = Math.max(ny, goInt(Math.floor(c.y)) + 1);
  }
  opts.push(heatmap.WithCellSize(1, 1));
  const m = heatmap.New(s.width, s.height, ...opts);
  if (xl.length === 0) m.setXStep(0); // no column labels: no rows reserved for them
  if (yl.length === 0) m.setYStep(0); // no row labels: no margin reserved for them
  const xLabels: string[] = new Array(nx).fill('');
  for (let i = 0; i < Math.min(nx, xl.length); i++) xLabels[i] = xl[i];
  const yLabels: string[] = new Array(ny).fill('');
  for (let j = 0; j < ny; j++) {
    const i = ny - 1 - j;
    if (i < yl.length) yLabels[j] = yl[i];
  }
  m.setXLabels(xLabels);
  m.setYLabels(yLabels);
  for (const c of cells) m.push(heatmap.NewHeatPoint(c.x, ny - 1 - c.y, c.z));
  m.draw();
  return m;
}

/**
 * @internal buildSparkline renders a single series onto a sparkline model.
 * The sparkline package is single-series and has no Y-minimum: multiple
 * series throw (like grouped bars), y_axis.min is documented-ignored,
 * y_axis.max maps to WithMaxValue.
 */
export function buildSparkline(s: NSpec): sparkline.Model {
  const series = s.data.series ?? [];
  if (series.length !== 1) throw new Error(`spec: sparkline supports exactly one series; got ${series.length}`);
  const ser = series[0];
  const opts: sparkline.Option[] = [sparkline.WithStyle(seriesStyle(ser, 0, s.theme))];
  if (s.y_axis.max !== null) opts.push(sparkline.WithMaxValue(s.y_axis.max));
  const m = sparkline.New(s.width, s.height, ...opts);
  for (const p of ser.values ?? []) m.push(p.y);
  m.draw();
  return m;
}

// Default up/down candle colors (overridden by theme.palette slots 0/1).
/** @internal */
export const defaultUpColor = '#26a69a';
/** @internal */
export const defaultDownColor = '#ef5350';

/**
 * @internal buildOHLC constructs a timeserieslinechart.Model that renders
 * the series' OHLC candlesticks at time-scaled X positions across the full
 * graph width, with labeled axes (the same axis machinery as
 * ChartTypeTimeSeries). The Y range derives from the data's low/high and may
 * be pinned by y_axis.min/max (one-sided pins allowed; it is an error for
 * the resulting min to exceed the max). Candle body width is chosen
 * automatically from chart density (see autoCandleWidth); dense data
 * overdraws like any dense timeseries — no points are dropped.
 */
export function buildOHLC(s: NSpec): tslc.Model | OHLCModel {
  if (hasVolume(s)) return buildOHLCVolume(s);
  return buildOHLCPrice(s, 0);
}

/** @internal */
export function buildOHLCPrice(s: NSpec, labelWidth: number): tslc.Model {
  const series = s.data.series ?? [];
  if (series.length !== 1) throw new Error(`spec: ohlc supports exactly one series; got ${series.length}`);
  const pts = series[0].ohlc ?? [];
  if (pts.length === 0) throw new Error('spec: ohlc requires Series.OHLC points');

  let block = false;
  switch (s.options.candle_style) {
    case '':
    case CandleStyleLine:
      break;
    case CandleStyleBlock:
      block = true;
      break;
    default:
      throw new Error(`spec: unknown candle_style ${Quote(s.options.candle_style)}`);
  }

  const times: GoTime[] = pts.map((p, i) => {
    const t = pointGoTime(p.t);
    if (t === null) throw new Error(`spec: ohlc point ${i} has unparsable time ${fmtV(p.t)}`);
    return t;
  });
  let tMin = times[0];
  let tMax = times[0];
  for (const t of times.slice(1)) {
    if (compareTime(t, tMin) < 0) tMin = t;
    if (compareTime(t, tMax) > 0) tMax = t;
  }
  [tMin, tMax] = drawableTimeRange(tMin, tMax);

  const logY = s.y_axis.scale === ScaleLog;
  let minP = Infinity;
  let maxP = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (logY) {
      for (const f of [
        { name: 'open', v: p.o },
        { name: 'high', v: p.h },
        { name: 'low', v: p.l },
        { name: 'close', v: p.c },
      ]) {
        if (!logOK(f.v)) throw logValueError('y_axis', `ohlc point ${i} has ${f.name}`, f.v);
      }
    }
    minP = goMin(minP, p.l);
    maxP = goMax(maxP, p.h);
  }
  if (logY) [minP, maxP] = resolveLogYRange(leftAxis(s), minP, maxP, true);
  else [minP, maxP] = resolvePinnedYRange(leftAxis(s), minP, maxP);

  const opts: tslc.Option[] = [tslc.WithTimeRange(toDate(tMin), toDate(tMax))];
  if (logY) opts.push(tslc.WithYScale(linechart.ScaleLog));
  opts.push(tslc.WithYRange(minP, maxP));
  const yf = axisLabelFormatter(s.y_axis.format, s.y_axis.scale);
  if (yf !== null) opts.push(tslc.WithYLabelFormatter(yf));
  if (!IsZero(s.x_axis.format) && s.x_axis.format.kind === 'time') {
    const layout = s.x_axis.format.layout === '' ? '2006-01-02' : s.x_axis.format.layout;
    opts.push(tslc.WithXLabelFormatter(makeTimeAxisFormatter(layout)));
  }

  const m = tslc.New(s.width, s.height, ...opts);
  if (labelWidth > 0) {
    const original = m.yLabelFormatter;
    // fmt.Sprintf("%*s", labelWidth, label): pad to labelWidth runes
    m.yLabelFormatter = (i: number, v: number) => {
      const label = original(i, v);
      const n = [...label].length;
      return n < labelWidth ? ' '.repeat(labelWidth - n) + label : label;
    };
    m.resize(s.width, s.height);
  }
  m.autoMinY = !logY && s.y_axis.min === null;
  m.autoMaxY = !logY && s.y_axis.max === null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const time = toDate(times[i]);
    m.pushDataSet('open', { time, value: p.o });
    m.pushDataSet('high', { time, value: p.h });
    m.pushDataSet('low', { time, value: p.l });
    m.pushDataSet('close', { time, value: p.c });
  }

  const up = candleStyle(s.theme, 0, defaultUpColor);
  const down = candleStyle(s.theme, 1, defaultDownColor);

  checkGraphSize(m);
  m.drawCandleWithOpts('open', 'high', 'low', 'close', up, down, {
    width: autoCandleWidth(m.graphWidth(), times, tMin, tMax),
    block,
    snapTimeBounds: labelWidth > 0,
  });
  return m;
}

/**
 * @internal autoCandleWidth picks a candle body width (in columns, odd,
 * >= 1) from chart density: roughly an equal share of the graph width per
 * candle, clamped so adjacent time-scaled candles cannot overlap on
 * irregular calendars, and capped at 7 so sparse charts stay recognizable
 * candles. Times are Dates or GoTimes (Go's nanosecond instants).
 */
export function autoCandleWidth(graphWidth: number, times: (GoTime | Date)[], tMin: GoTime | Date, tMax: GoTime | Date): number {
  const g = (t: GoTime | Date): GoTime => (t instanceof Date ? { ms: t.getTime(), ns: 0 } : t);
  const n = times.length;
  if (n === 0 || graphWidth < 1) return 1;
  let w = Math.trunc(graphWidth / n) - 1;
  const lo = g(tMin);
  const hi = g(tMax);
  if (n > 1 && compareTime(hi, lo) > 0) {
    const span = subNanos(hi, lo);
    // Match the draw path's column formula exactly: int(...) truncates a
    // scaled-by-graphWidth fraction, it does not round a
    // scaled-by-(graphWidth-1) fraction.
    const cols = times.map((t) => goInt((subNanos(g(t), lo) / span) * graphWidth));
    cols.sort((a, b) => a - b);
    let minGap = graphWidth;
    for (let i = 1; i < n; i++) {
      const gap = cols[i] - cols[i - 1];
      if (gap > 0 && gap < minGap) minGap = gap;
    }
    if (w > minGap - 1) w = minGap - 1;
  }
  if (w > 7) w = 7;
  if (w % 2 === 0) w--;
  if (w < 1) w = 1;
  return w;
}

/**
 * @internal candleStyle returns the lipgloss Style for a candle, preferring
 * theme.palette[slot] and falling back to fallback (a hex colour) when the
 * palette does not have that slot set.
 */
export function candleStyle(t: NTheme, slot: number, fallback: string): Style {
  let color = fallback;
  const palette = t.palette ?? [];
  if (slot < palette.length && palette[slot] !== '') color = palette[slot];
  return newStyle().foreground(color);
}

/**
 * @internal seriesStyle returns the lipgloss Style for a Series, preferring
 * the series' own color, then the theme palette (by index), then the default.
 */
export function seriesStyle(ser: NSeries, index: number, theme: NTheme): Style {
  let colour = ser.color;
  const palette = theme.palette ?? [];
  if (colour === '' && index < palette.length) colour = palette[index];
  if (colour === '') return newStyle();
  return newStyle().foreground(colour);
}
