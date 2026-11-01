// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import type { Style } from '@oakoliver/lipgloss';
import type { KeyMap, UpdateHandler } from '../canvas/updatehandler.js';
import type { Model, Option } from './sparkline.js';

/** WithStyle sets the default column style. */
export function WithStyle(s: Style): Option {
  return (m: Model) => {
    m.style = s;
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

/** WithData adds all data values in number[] to sparkline data buffer. */
export function WithData(d: number[]): Option {
  return (m: Model) => {
    m.pushAll(d);
  };
}

/**
 * WithMaxInterpolationPoints sets the maximum number of points to interpolate
 * for lines. If 0, graph.DefaultMaxPoints is used.
 */
export function WithMaxInterpolationPoints(n: number): Option {
  return (m: Model) => {
    m.maxInterpolationPoints = n;
  };
}
