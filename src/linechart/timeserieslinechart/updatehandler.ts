// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// File contains methods and objects used during
// timeserieslinechart Model update() to modify internal state.
// timeserieslinechart is able to zoom in and out of the graph,
// and increase and decrease the X values to simulating moving
// the viewport of the linechart

import { XAxisNoZoomUpdateHandler, XAxisUpdateHandler, type UpdateHandler } from '../updatehandler.js';

/**
 * DateUpdateHandler is used by timeserieslinechart to enable
 * zooming in and out with the mouse wheel or page up and page down,
 * moving the viewing window by holding down mouse button and moving,
 * and moving the viewing window with the arrow keys.
 * There is only movement along the X axis by day increments.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function DateUpdateHandler(i: number): UpdateHandler {
  const daySeconds = 86400 * i; // number of seconds in a day
  return XAxisUpdateHandler(daySeconds);
}

/**
 * DateNoZoomUpdateHandler is used by timeserieslinechart to enable
 * moving the viewing window by using the mouse scroll wheel,
 * holding down mouse button and moving,
 * and moving the viewing window with the arrow keys.
 * There is only movement along the X axis by day increments.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function DateNoZoomUpdateHandler(i: number): UpdateHandler {
  const daySeconds = 86400 * i; // number of seconds in a day
  return XAxisNoZoomUpdateHandler(daySeconds);
}

/**
 * HourUpdateHandler is used by timeserieslinechart to enable
 * zooming in and out with the mouse wheel or page up and page down,
 * moving the viewing window by holding down mouse button and moving,
 * and moving the viewing window with the arrow keys.
 * There is only movement along the X axis by hour increments.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function HourUpdateHandler(i: number): UpdateHandler {
  const hourSeconds = 3600 * i; // number of seconds in a hour
  return XAxisUpdateHandler(hourSeconds);
}

/**
 * HourNoZoomUpdateHandler is used by timeserieslinechart to enable
 * moving the viewing window by using the mouse scroll wheel,
 * holding down mouse button and moving,
 * and moving the viewing window with the arrow keys.
 * There is only movement along the X axis by hour increments.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function HourNoZoomUpdateHandler(i: number): UpdateHandler {
  const hourSeconds = 3600 * i; // number of seconds in a hour
  return XAxisNoZoomUpdateHandler(hourSeconds);
}

/**
 * SecondUpdateHandler is used by timeserieslinechart to enable
 * zooming in and out with the mouse wheel or page up and page down,
 * moving the viewing window by holding down mouse button and moving,
 * and moving the viewing window with the arrow keys.
 * There is only movement along the X axis by second increments.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function SecondUpdateHandler(i: number): UpdateHandler {
  return XAxisUpdateHandler(i);
}

/**
 * SecondNoZoomUpdateHandler is used by timeserieslinechart to enable
 * moving the viewing window by using the mouse scroll wheel,
 * holding down mouse button and moving,
 * and moving the viewing window with the arrow keys.
 * There is only movement along the X axis by second increments.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function SecondNoZoomUpdateHandler(i: number): UpdateHandler {
  return XAxisNoZoomUpdateHandler(i);
}
