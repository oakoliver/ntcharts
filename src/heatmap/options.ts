// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import type { Color, Style } from '@oakoliver/lipgloss';
import type { KeyMap, UpdateHandler } from '../canvas/updatehandler.js';
import type * as linechart from '../linechart/index.js';
import type { HeatPointLike, Model, Option } from './heatmap.js';

/**
 * WithStyle sets the initial LineChart.
 * Upstream replaces the embedded linechart.Model value; here its state is
 * copied over the heatmap's linechart state.
 */
export function WithStyle(lm: linechart.Model): Option {
  return (m: Model) => {
    Object.assign(m, lm);
  };
}

/** WithKeyMap sets the canvas KeyMap used when processing keyboard event messages in update(). */
export function WithKeyMap(k: KeyMap): Option {
  return (m: Model) => {
    m.canvas.keyMap = k;
  };
}

/** WithUpdateHandler sets the canvas UpdateHandler used when processing bubbletea Msg events in update(). */
export function WithUpdateHandler(h: UpdateHandler): Option {
  return (m: Model) => {
    m.canvas.updateHandler = h;
  };
}

/** WithColorScale uses the given Color array for the ColorScale. */
export function WithColorScale(cs: Color[]): Option {
  return (m: Model) => {
    m.colorScale = cs;
  };
}

/** WithCellStyle sets the default cell style. */
export function WithCellStyle(style: Style): Option {
  return (m: Model) => {
    m.cellStyle = style;
  };
}

/** WithValueRange sets the min/max values used for the color mapping. */
export function WithValueRange(minVal: number, maxVal: number): Option {
  return (m: Model) => {
    m.minValue = minVal;
    m.maxValue = maxVal;
  };
}

/**
 * WithAutoValueRange enables automatically setting the minimum and maximum
 * values if new data values are beyond the current ranges.
 */
export function WithAutoValueRange(): Option {
  return (m: Model) => {
    m.autoMinValue = true;
    m.autoMaxValue = true;
  };
}

/** WithPoints adds all heat points in HeatPoint[] to the heatmap data. */
export function WithPoints(d: HeatPointLike[]): Option {
  return (m: Model) => {
    m.pushAll(d);
  };
}

/**
 * WithCellSize sets the size of one data cell in data units and draws each
 * point as a filled block of that size, centred on the point, instead of a
 * single canvas cell. For an index grid (points at whole X and Y) use 1, 1
 * together with ranges of -0.5..n-0.5 (see WithXLabels) and the cells tile
 * the graph. A size that is not positive restores single-cell points.
 */
export function WithCellSize(w: number, h: number): Option {
  return (m: Model) => {
    m.cellW = w;
    m.cellH = h;
  };
}

/**
 * WithXLabels names the cell columns: labels[i] is drawn under the column at
 * X = i. The labels define the grid: the X range becomes -0.5..len(labels)-0.5
 * and is no longer auto-ranged. Draw draws them.
 */
export function WithXLabels(labels: string[]): Option {
  return (m: Model) => {
    m.setXLabels(labels);
  };
}

/**
 * WithYLabels names the cell rows: labels[i] is drawn left of the row at
 * Y = i, counting up from the bottom. The labels define the grid: the Y range
 * becomes -0.5..len(labels)-0.5 and is no longer auto-ranged, and the margin
 * left of the graph grows to fit the longest label. Draw draws them.
 */
export function WithYLabels(labels: string[]): Option {
  return (m: Model) => {
    m.setYLabels(labels);
  };
}
