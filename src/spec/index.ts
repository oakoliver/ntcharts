// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// Package spec: a neutral, surface-agnostic chart specification, rendered to
// the ntcharts terminal models by Build. Only upstream's exported API is
// re-exported here; the files also export @internal helpers for the tests.

export {
  ChartTypeBar,
  ChartTypeLine,
  ChartTypeTimeSeries,
  ChartTypeStreamline,
  ChartTypeSparkline,
  ChartTypeHeatmap,
  ChartTypeOHLC,
  ChartTypeScatter,
  ChartTypeCanvas,
  IsKnown,
  XAxisCategory,
  XAxisTime,
  XAxisValue,
  ScaleLinear,
  ScaleLog,
  YAxisLeft,
  YAxisRight,
  OrientationVertical,
  OrientationHorizontal,
  CandleStyleLine,
  CandleStyleBlock,
  IsZero,
  Validate,
  HasVolume,
  MarshalJSON,
} from './spec.js';
export type {
  ChartType,
  Format,
  XAxis,
  YAxis,
  XValue,
  Spec,
  Data,
  Series,
  DataPoint,
  OHLCPoint,
  HeatCell,
  HeatData,
  Options,
  Theme,
} from './spec.js';
export { Build, DeriveBarLabels, type BuildResult } from './build.js';
export { CategoricalModel } from './build_category.js';
export { ComboModel } from './build_combo.js';
export { OHLCModel } from './build_ohlc_volume.js';
export {
  IsCategoricalCombo,
  ResolveCategoricalCombo,
  ComboSeriesColor,
  type CategoricalCombo,
} from './combo.js';
export { FormatValue } from './format.js';
export { PointX, PointTime } from './helpers.js';
// category_layout.ts, gradient.ts and scale.ts hold no public API
// (upstream category_layout.go, gradient.go and scale.go export nothing)
