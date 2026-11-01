// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// File contains options used by the linechart during initialization with New().
//
//	const lc = New(width, height, minX, maxX, minY, maxY, WithZoneManager(someZoneManager))

import type { Style } from '@oakoliver/lipgloss';
import type { KeyMap } from '../canvas/updatehandler.js';
import type { ZoneManager } from '../internal/zone.js';
import type { Axis } from './axis.js';
import type { LabelFormatter, Model, Option } from './linechart.js';
import type { Scale } from './scale.js';
import type { UpdateHandler } from './updatehandler.js';

/** WithStyles sets the default style of the axes, the value shown for the axes and runes drawn on linechart. */
export function WithStyles(as: Style, ls: Style, s: Style): Option {
  return (m: Model) => {
    m.axisStyle = as;
    m.labelStyle = ls;
    m.style = s;
  };
}

/** WithXLabelFormatter sets the default X label formatter for displaying X values as strings. */
export function WithXLabelFormatter(fmter: LabelFormatter): Option {
  return (m: Model) => {
    m.xLabelFormatter = fmter;
  };
}

/** WithYLabelFormatter sets the default Y label formatter for displaying Y values as strings. */
export function WithYLabelFormatter(fmter: LabelFormatter): Option {
  return (m: Model) => {
    m.yLabelFormatter = fmter;
  };
}

/** WithKeyMap sets the KeyMap used when processing keyboard event messages in update(). */
export function WithKeyMap(k: KeyMap): Option {
  return (m: Model) => {
    m.canvas.keyMap = k;
  };
}

/** WithUpdateHandler sets the UpdateHandler used when processing Bubble Tea Msg events in update(). */
export function WithUpdateHandler(h: UpdateHandler): Option {
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

/** WithXYSteps sets the number of steps when drawing X and Y axes values. */
export function WithXYSteps(x: number, y: number): Option {
  return (m: Model) => {
    // upstream sets the fields directly, without recomputing the layout
    (m as unknown as { _xStep: number; _yStep: number })._xStep = x;
    (m as unknown as { _xStep: number; _yStep: number })._yStep = y;
  };
}

/** WithXScale sets the scale of the X axis. See setXScale. */
export function WithXScale(s: Scale): Option {
  return (m: Model) => {
    m.setXScale(s);
  };
}

/** WithYScale sets the scale of the Y axis. See setYScale. */
export function WithYScale(s: Scale): Option {
  return (m: Model) => {
    m.setYScale(s);
  };
}

/**
 * WithAutoXYRange enables automatically setting the minimum and maximum
 * expected X and Y values if new data values are beyond the current ranges.
 */
export function WithAutoXYRange(): Option {
  return (m: Model) => {
    m.autoMinX = true;
    m.autoMaxX = true;
    m.autoMinY = true;
    m.autoMaxY = true;
  };
}

/**
 * WithAutoXRange enables automatically setting the minimum and maximum
 * expected X values if new data values are beyond the current range.
 */
export function WithAutoXRange(): Option {
  return (m: Model) => {
    m.autoMinX = true;
    m.autoMaxX = true;
  };
}

/**
 * WithAutoYRange enables automatically setting the minimum and maximum
 * expected Y values if new data values are beyond the current range.
 */
export function WithAutoYRange(): Option {
  return (m: Model) => {
    m.autoMinY = true;
    m.autoMaxY = true;
  };
}

/**
 * WithMaxInterpolationPoints sets the maximum number of points to interpolate
 * for lines and circles. If 0, graph.DefaultMaxPoints is used.
 */
export function WithMaxInterpolationPoints(n: number): Option {
  return (m: Model) => {
    m.maxInterpolationPoints = n;
  };
}

/** WithY2Axis adds a right Y axis. See setY2Axis. */
export function WithY2Axis(a: Partial<Axis>): Option {
  return (m: Model) => {
    m.setY2Axis(a);
  };
}
