// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// Options used by the canvas during initialization with New().
//
//	const c = canvas.New(width, height, canvas.WithStyle(someStyle), canvas.WithKeyMap(someKeyMap))

import type { Style } from '@oakoliver/lipgloss';
import type { ZoneManager } from '../internal/zone.js';
import type { Model, Option, Point } from './canvas.js';
import type { KeyMap, UpdateHandler } from './updatehandler.js';

/** WithStyle sets the default Cell style. */
export function WithStyle(s: Style): Option {
  return (m: Model) => {
    m.style = s;
  };
}

/** WithKeyMap sets the KeyMap used when processing keyboard event messages in update(). */
export function WithKeyMap(k: KeyMap): Option {
  return (m: Model) => {
    m.keyMap = k;
  };
}

/** WithUpdateHandler sets the UpdateHandler used when processing Bubble Tea Msg events in update(). */
export function WithUpdateHandler(h: UpdateHandler): Option {
  return (m: Model) => {
    m.updateHandler = h;
  };
}

/** WithZoneManager sets the bubblezone Manager used when processing mouse events in update(). */
export function WithZoneManager(zm: ZoneManager | null): Option {
  return (m: Model) => {
    m.setZoneManager(zm);
  };
}

/** WithCursor sets the cursor starting position for the viewport. */
export function WithCursor(p: Point): Option {
  return (m: Model) => {
    m.setCursor(p);
  };
}

/** WithFocus sets the canvas to be focused. */
export function WithFocus(): Option {
  return (m: Model) => {
    m.focus();
  };
}

/**
 * WithContent copies the given string[] into the contents of the canvas with
 * default style. Each string will be copied into a row starting from the top
 * of the canvas to bottom. Use option WithStyle() to set canvas style before
 * using WithContent() for styling.
 */
export function WithContent(l: string[]): Option {
  return (m: Model) => {
    m.setLines(l);
  };
}

/** WithViewWidth sets the viewport width of the canvas. */
export function WithViewWidth(w: number): Option {
  return (m: Model) => {
    m.viewWidth = w;
  };
}

/** WithViewHeight sets the viewport height of the canvas. */
export function WithViewHeight(h: number): Option {
  return (m: Model) => {
    m.viewHeight = h;
  };
}
