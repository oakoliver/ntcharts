// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import type { Style } from '@oakoliver/lipgloss';
import type { ZoneManager } from '../internal/zone.js';
import type { BarData, Model, Option } from './barchart.js';

/**
 * WithZoneManager sets the bubblezone Manager used
 * when processing bubbletea Msg mouse events in update().
 */
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

/** WithStyles sets the axis line and label string styles. */
export function WithStyles(as: Style, ls: Style): Option {
  return (m: Model) => {
    m.axisStyle = as;
    m.labelStyle = ls;
  };
}

/** WithNoAxis disables drawing axis and labels on to the barchart. */
export function WithNoAxis(): Option {
  return (m: Model) => {
    m.setShowAxis(false);
  };
}

/**
 * WithHorizontalBars displays bars horizontally from right to left,
 * with each bar displayed from top to bottom.
 */
export function WithHorizontalBars(): Option {
  return (m: Model) => {
    m.setHorizontal(true);
  };
}

/**
 * WithNoAutoMaxValue disables automatically setting the max value
 * if new data greater than the current max is added.
 */
export function WithNoAutoMaxValue(): Option {
  return (m: Model) => {
    m.autoMaxValue = false;
  };
}

/** WithMaxValue sets the expected maximum data value to given number. */
export function WithMaxValue(f: number): Option {
  return (m: Model) => {
    m.setMax(f);
  };
}

/**
 * WithMinValue sets the expected minimum data value
 * to given number. Values above 0 are clamped to 0.
 * Use with negative bar values to fix the axis position
 * instead of letting it follow the data.
 */
export function WithMinValue(f: number): Option {
  return (m: Model) => {
    m.setMin(f);
  };
}

/**
 * WithNoAutoBarWidth disables automatically setting the bar widths
 * to fill the canvas when drawing.
 */
export function WithNoAutoBarWidth(): Option {
  return (m: Model) => {
    m.autoBarWidth = false;
  };
}

/** WithBarWidth sets the bar widths when when drawing. */
export function WithBarWidth(w: number): Option {
  return (m: Model) => {
    m.setBarWidth(w);
  };
}

/** WithBarGap sets the empty spaces between bars when drawing. */
export function WithBarGap(g: number): Option {
  return (m: Model) => {
    m.setBarGap(g);
  };
}

/** WithDataSet adds all bar data values in BarData[] to barchart data set. */
export function WithDataSet(d: BarData[]): Option {
  return (m: Model) => {
    m.pushAll(d);
  };
}
