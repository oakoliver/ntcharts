// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// File contains the Y axes of a linechart: the left axis, kept in the
// Model's own fields, and an optional right axis. The Model methods of
// upstream axis.go (YAxis, SetYAxis, Y2Axis, SetY2Axis, ClearY2Axis, Y2ToY,
// GraphRight, AutoAdjustY2Range) live on the Model class in linechart.ts.

import { newStyle, type Style } from '@oakoliver/lipgloss';
import type { LabelFormatter } from './linechart.js';
import { ScaleLinear, type Scale } from './scale.js';

/**
 * Axis describes one Y axis of a line chart. Read an axis with yAxis() or
 * y2Axis(), change its fields, and set it back with setYAxis() or setY2Axis():
 *
 *	const [a] = m.y2Axis();
 *	a.min = 5; a.max = 20;
 *	m.setY2Axis(a);
 *
 * The left axis's labelStyle is the chart's labelStyle, which the X axis
 * labels share. Right axis labels fall on the left axis's label rows (on a
 * linear right axis) and use the same YStep; there is no separate step.
 *
 * The right axis has no view of its own: its displayed range is derived
 * from where the left axis's view sits within the left axis's range, so
 * zooming or moving the left axis carries the right one along, and
 * setY2Axis() ignores viewMin and viewMax. With a Y step of 0 the right axis
 * is not drawn and reserves no space, but it still maps values through y2ToY().
 *
 * The setters take a Partial<Axis>: a missing field is Go's zero value
 * (0, false, ScaleLinear, no formatter, an empty style).
 */
export interface Axis {
  /** expected data range */
  min: number;
  max: number;
  /** displayed range; viewMin == viewMax means min..max */
  viewMin: number;
  viewMax: number;
  /** ScaleLinear (the default) or ScaleLog */
  scale: Scale;
  /** widen min or max when data falls outside */
  autoMin: boolean;
  autoMax: boolean;
  /** null means DefaultLabelFormatter() */
  labelFormatter: LabelFormatter | null;
  /** style of this axis's labels */
  labelStyle: Style;
}

const zeroStyle = newStyle();

/** Returns an Axis with Go's zero values for the fields a leaves out. */
export function axisWithDefaults(a: Partial<Axis>): Axis {
  return {
    min: a.min ?? 0,
    max: a.max ?? 0,
    viewMin: a.viewMin ?? 0,
    viewMax: a.viewMax ?? 0,
    scale: a.scale ?? ScaleLinear,
    autoMin: a.autoMin ?? false,
    autoMax: a.autoMax ?? false,
    labelFormatter: a.labelFormatter ?? null,
    labelStyle: a.labelStyle ?? zeroStyle,
  };
}

/** YAxisSide selects the left or right Y axis of a line chart. */
export type YAxisSide = number;

/** YAxisLeft is the chart's main Y axis. It is the zero value. */
export const YAxisLeft: YAxisSide = 0;

/** YAxisRight is the optional second Y axis set with setY2Axis(). */
export const YAxisRight: YAxisSide = 1;
