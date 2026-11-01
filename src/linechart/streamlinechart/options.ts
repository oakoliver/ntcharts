// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// Options used by the streamlinechart during initialization with New().
//
//	const slc = New(width, height, WithStyles(someLineStyle, someLipglossStyle))

import type { Style } from '@oakoliver/lipgloss';
import type { LineStyle } from '../../canvas/runes/runes.js';
import type { ZoneManager } from '../../internal/zone.js';
import type * as linechart from '../index.js';
import type { Model, Option } from './streamlinechart.js';

/** WithLineChart sets internal linechart to a copy of the given linechart. */
export function WithLineChart(lc: linechart.Model): Option {
  return (m: Model) => {
    m.setLineChart(lc);
  };
}

/** WithUpdateHandler sets the UpdateHandler used when processing Bubble Tea Msg events in update(). */
export function WithUpdateHandler(h: linechart.UpdateHandler): Option {
  return (m: Model) => {
    m.updateHandler = h;
  };
}

/** WithZoneManager sets the bubblezone Manager used when processing Bubble Tea mouse events in update(). */
export function WithZoneManager(zm: ZoneManager | null): Option {
  return (m: Model) => {
    m.setZoneManager(zm);
  };
}

/**
 * WithZoneID sets the zone ID the chart marks its view with, instead of the unique
 * prefix the zone Manager generates, so zone IDs are stable across sessions and
 * programs. The ID must be unique among the zones of one Manager.
 */
export function WithZoneID(id: string): Option {
  return (m: Model) => {
    m.setZoneID(id);
  };
}

/**
 * WithXYSteps sets the number of steps when drawing X and Y axes values.
 * If X steps 0, then X axis will be hidden.
 * If Y steps 0, then Y axis will be hidden.
 */
export function WithXYSteps(x: number, y: number): Option {
  return (m: Model) => {
    m.setXStep(x);
    m.setYStep(y);
  };
}

/**
 * WithYScale sets the scale of the Y axis: linechart.ScaleLinear (the
 * default) or linechart.ScaleLog. See Model.setYScale.
 * A streamline has no X values to scale.
 */
export function WithYScale(s: linechart.Scale): Option {
  return (m: Model) => {
    m.setYScale(s);
  };
}

/** WithXRange sets expected and displayed minimum and maximum X value range. */
export function WithXRange(min: number, max: number): Option {
  return (m: Model) => {
    m.setXRange(min, max);
    m.setViewXRange(min, max);
  };
}

/** WithYRange sets expected and displayed minimum and maximum Y value range. */
export function WithYRange(min: number, max: number): Option {
  return (m: Model) => {
    m.setYRange(min, max);
    m.setViewYRange(min, max);
  };
}

/** WithXYRange sets expected and displayed minimum and maximum X and Y value ranges. */
export function WithXYRange(minX: number, maxX: number, minY: number, maxY: number): Option {
  return (m: Model) => {
    m.setXRange(minX, maxX);
    m.setViewXRange(minX, maxX);
    m.setYRange(minY, maxY);
    m.setViewYRange(minY, maxY);
  };
}

/** WithStyles sets the default line style and lipgloss style of data sets. */
export function WithStyles(ls: LineStyle, s: Style): Option {
  return (m: Model) => {
    m.setStyles(ls, s);
  };
}

/** WithAxesStyles sets the axes line and line label styles. */
export function WithAxesStyles(as: Style, ls: Style): Option {
  return (m: Model) => {
    m.axisStyle = as;
    m.labelStyle = ls;
  };
}

/** WithDataSetStyles sets the line style and lipgloss style of the data set given by name. */
export function WithDataSetStyles(n: string, ls: LineStyle, s: Style): Option {
  return (m: Model) => {
    m.setDataSetStyles(n, ls, s);
  };
}

/** WithStream adds number[] data points to the default data set. */
export function WithStream(f: number[]): Option {
  return (m: Model) => {
    for (const v of f) m.push(v);
  };
}

/** WithDataSetStream adds number[] data points to the data set given by name. */
export function WithDataSetStream(n: string, f: number[]): Option {
  return (m: Model) => {
    for (const v of f) m.pushDataSet(n, v);
  };
}

/** WithY2Axis adds a right Y axis. See Model.setY2Axis. */
export function WithY2Axis(a: Partial<linechart.Axis>): Option {
  return (m: Model) => {
    m.setY2Axis(a);
  };
}

/**
 * WithDataSetYAxis puts the data set given by name on the left or right Y
 * axis. See Model.setDataSetYAxis. Give it and WithY2Axis before the data
 * set's data (WithDataSetStream) so that data auto-ranges the right axis.
 */
export function WithDataSetYAxis(n: string, side: linechart.YAxisSide): Option {
  return (m: Model) => {
    m.setDataSetYAxis(n, side);
  };
}
