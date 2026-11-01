// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// File contains options used by the timeserieslinechart during initialization with New().
//
//	const tslc = New(width, height, WithLineStyle(someLineStyle), WithStyle(someLipglossStyle))

import type { Style } from '@oakoliver/lipgloss';
import type { LineStyle } from '../../canvas/runes/runes.js';
import type { ZoneManager } from '../../internal/zone.js';
import type * as linechart from '../index.js';
import type { Model, Option, TimePoint } from './timeserieslinechart.js';

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

/** WithXLabelFormatter sets the default X label formatter for displaying X values as strings. */
export function WithXLabelFormatter(fmter: linechart.LabelFormatter): Option {
  return (m: Model) => {
    m.xLabelFormatter = fmter;
  };
}

/** WithYLabelFormatter sets the default Y label formatter for displaying Y values as strings. */
export function WithYLabelFormatter(fmter: linechart.LabelFormatter): Option {
  return (m: Model) => {
    m.yLabelFormatter = fmter;
  };
}

/** WithAxesStyles sets the axes line and line label styles. */
export function WithAxesStyles(as: Style, ls: Style): Option {
  return (m: Model) => {
    m.axisStyle = as;
    m.labelStyle = ls;
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
 * The X axis is time and is always linear.
 */
export function WithYScale(s: linechart.Scale): Option {
  return (m: Model) => {
    m.setYScale(s);
  };
}

/** WithYRange sets expected and displayed minimum and maximum Y value range. */
export function WithYRange(min: number, max: number): Option {
  return (m: Model) => {
    m.setYRange(min, max);
    m.setViewYRange(min, max);
  };
}

/** WithTimeRange sets expected and displayed minimum and maximum time values range on the X axis. */
export function WithTimeRange(min: Date, max: Date): Option {
  return (m: Model) => {
    m.setTimeRange(min, max);
    m.setViewTimeRange(min, max);
  };
}

/** WithLineStyle sets the default line style of data sets. */
export function WithLineStyle(ls: LineStyle): Option {
  return (m: Model) => {
    m.setLineStyle(ls);
  };
}

/** WithDataSetLineStyle sets the line style of the data set given by name. */
export function WithDataSetLineStyle(n: string, ls: LineStyle): Option {
  return (m: Model) => {
    m.setDataSetLineStyle(n, ls);
  };
}

/** WithStyle sets the default lipgloss style of data sets. */
export function WithStyle(s: Style): Option {
  return (m: Model) => {
    m.setStyle(s);
  };
}

/** WithDataSetStyle sets the lipgloss style of the data set given by name. */
export function WithDataSetStyle(n: string, s: Style): Option {
  return (m: Model) => {
    m.setDataSetStyle(n, s);
  };
}

/** WithTimeSeries adds TimePoint[] values to the default data set. */
export function WithTimeSeries(p: TimePoint[]): Option {
  return (m: Model) => {
    for (const v of p) m.push(v);
  };
}

/** WithDataSetTimeSeries adds TimePoint[] data points to the data set given by name. */
export function WithDataSetTimeSeries(n: string, p: TimePoint[]): Option {
  return (m: Model) => {
    for (const v of p) m.pushDataSet(n, v);
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
 * set's data (WithDataSetTimeSeries) so that data auto-ranges the right axis.
 */
export function WithDataSetYAxis(n: string, side: linechart.YAxisSide): Option {
  return (m: Model) => {
    m.setDataSetYAxis(n, side);
  };
}
