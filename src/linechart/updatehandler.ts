// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// File contains methods and objects used during linechart Model update()
// to modify internal state.
// linechart is able to zoom in and out of the graph,
// and increase and decrease the X and Y values to simulating moving
// the viewport of the linechart. The zoom and move methods themselves
// (zoomIn, zoomOut, moveLeft, ...) are methods of the Model class.

import { matches } from '@oakoliver/bubbles';
import type { Msg } from '@oakoliver/bubbletea';
import type { Point } from '../canvas/canvas.js';
import { MouseButton, isKeyMsg, isMouseClickMsg, isMouseMotionMsg, isMouseWheelMsg, type MouseLike } from '../internal/msg.js';
import type { Model } from './linechart.js';

/** UpdateHandler callback invoked during an update() and passes in the linechart Model and Bubble Tea Msg. */
export type UpdateHandler = (m: Model, msg: Msg) => void;

/**
 * XYAxesUpdateHandler is used by linechart to enable
 * zooming in and out with the mouse wheel or page up and page down,
 * moving the viewing window by holding down mouse button and moving,
 * and moving the viewing window with the arrow keys.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function XYAxesUpdateHandler(xIncrement: number, yIncrement: number): UpdateHandler {
  const lastPos: Point = { x: 0, y: 0 };
  return (m: Model, msg: Msg) => {
    if (isKeyMsg(msg)) {
      keyXYHandler(m, msg, xIncrement, yIncrement);
      keyXYZoomHandler(m, msg, xIncrement, yIncrement);
    } else if (isMouseWheelMsg(msg)) {
      switch (msg.button) {
        case MouseButton.WheelUp:
          // zoom in limited values cannot cross
          m.zoomIn(xIncrement, yIncrement);
          break;
        case MouseButton.WheelDown:
          // zoom out limited by max values
          m.zoomOut(xIncrement, yIncrement);
          break;
      }
    } else if (isMouseClickMsg(msg)) {
      mouseClickHandler(m, msg, lastPos);
    } else if (isMouseMotionMsg(msg)) {
      mouseMotionXYHandler(m, msg, lastPos, xIncrement, yIncrement);
    }
  };
}

/**
 * XAxisUpdateHandler is used by linechart to enable
 * zooming in and out with the mouse wheel or page up and page down,
 * moving the viewing window by holding down mouse button and moving,
 * and moving the viewing window with the arrow keys.
 * There is only movement along the X axis with the given increment.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function XAxisUpdateHandler(increment: number): UpdateHandler {
  const lastPos: Point = { x: 0, y: 0 };
  return (m: Model, msg: Msg) => {
    if (isKeyMsg(msg)) {
      keyXHandler(m, msg, increment);
      keyXZoomHandler(m, msg, increment);
    } else if (isMouseWheelMsg(msg)) {
      switch (msg.button) {
        case MouseButton.WheelUp:
          // zoom in limited values cannot cross
          m.zoomIn(increment, 0);
          break;
        case MouseButton.WheelDown:
          // zoom out limited by max values
          m.zoomOut(increment, 0);
          break;
      }
    } else if (isMouseClickMsg(msg)) {
      mouseClickHandler(m, msg, lastPos);
    } else if (isMouseMotionMsg(msg)) {
      mouseMotionXHandler(m, msg, lastPos, increment);
    }
  };
}

/**
 * XAxisNoZoomUpdateHandler is used by linechart to enable
 * moving the viewing window along the X axis with mouse wheel,
 * holding down the mouse button and moving, and with arrow keys.
 * There is only movement along the X axis with the given increment.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function XAxisNoZoomUpdateHandler(increment: number): UpdateHandler {
  const lastPos: Point = { x: 0, y: 0 };
  return (m: Model, msg: Msg) => {
    if (isKeyMsg(msg)) {
      keyXHandler(m, msg, increment);
    } else if (isMouseWheelMsg(msg)) {
      switch (msg.button) {
        case MouseButton.WheelUp:
        case MouseButton.WheelLeft:
          m.moveLeft(increment);
          break;
        case MouseButton.WheelDown:
        case MouseButton.WheelRight:
          m.moveRight(increment);
          break;
      }
    } else if (isMouseClickMsg(msg)) {
      mouseClickHandler(m, msg, lastPos);
    } else if (isMouseMotionMsg(msg)) {
      mouseMotionXHandler(m, msg, lastPos, increment);
    }
  };
}

/**
 * YAxisUpdateHandler is used by streamlinechart to enable
 * zooming in and out with the mouse wheel or page up and page down,
 * moving the viewing window by holding down mouse button and moving,
 * and moving the viewing window with the arrow keys.
 * There is only movement along the Y axis with the given increment.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function YAxisUpdateHandler(increment: number): UpdateHandler {
  const lastPos: Point = { x: 0, y: 0 };
  return (m: Model, msg: Msg) => {
    if (isKeyMsg(msg)) {
      keyYHandler(m, msg, increment);
      keyYZoomHandler(m, msg, increment);
    } else if (isMouseWheelMsg(msg)) {
      switch (msg.button) {
        case MouseButton.WheelUp:
          // zoom in limited values cannot cross
          m.zoomIn(0, increment);
          break;
        case MouseButton.WheelDown:
          // zoom out limited by max values
          m.zoomOut(0, increment);
          break;
      }
    } else if (isMouseClickMsg(msg)) {
      mouseClickHandler(m, msg, lastPos);
    } else if (isMouseMotionMsg(msg)) {
      mouseMotionYHandler(m, msg, lastPos, increment);
    }
  };
}

/**
 * YAxisNoZoomUpdateHandler is used by streamlinechart to enable
 * moving the viewing window along the Y axis with mouse wheel,
 * holding down the mouse button and moving, and with arrow keys.
 * There is only movement along the Y axis with the given increment.
 * Uses linechart Canvas KeyMap for keyboard messages.
 */
export function YAxisNoZoomUpdateHandler(increment: number): UpdateHandler {
  const lastPos: Point = { x: 0, y: 0 };
  return (m: Model, msg: Msg) => {
    if (isKeyMsg(msg)) {
      keyYHandler(m, msg, increment);
    } else if (isMouseWheelMsg(msg)) {
      switch (msg.button) {
        case MouseButton.WheelUp:
          m.moveUp(increment);
          break;
        case MouseButton.WheelDown:
          m.moveDown(increment);
          break;
      }
    } else if (isMouseClickMsg(msg)) {
      mouseClickHandler(m, msg, lastPos);
    } else if (isMouseMotionMsg(msg)) {
      mouseMotionYHandler(m, msg, lastPos, increment);
    }
  };
}

type KeyLike = { toString(): string };

// keyXYHandler handles keyboard messages for X and Y axis moving
function keyXYHandler(m: Model, msg: KeyLike, xIncrement: number, yIncrement: number): void {
  const km = m.canvas.keyMap;
  if (matches(msg, km.up)) m.moveUp(yIncrement);
  else if (matches(msg, km.down)) m.moveDown(yIncrement);
  else if (matches(msg, km.left)) m.moveLeft(xIncrement);
  else if (matches(msg, km.right)) m.moveRight(xIncrement);
}

// keyXHandler handles keyboard messages for X axis moving
function keyXHandler(m: Model, msg: KeyLike, xIncrement: number): void {
  const km = m.canvas.keyMap;
  if (matches(msg, km.left)) m.moveLeft(xIncrement);
  else if (matches(msg, km.right)) m.moveRight(xIncrement);
}

// keyYHandler handles keyboard messages for Y axis moving
function keyYHandler(m: Model, msg: KeyLike, yIncrement: number): void {
  const km = m.canvas.keyMap;
  if (matches(msg, km.up)) m.moveUp(yIncrement);
  else if (matches(msg, km.down)) m.moveDown(yIncrement);
}

// keyXYZoomHandler handles keyboard messages for X and Y axis zooming
function keyXYZoomHandler(m: Model, msg: KeyLike, xIncrement: number, yIncrement: number): void {
  const km = m.canvas.keyMap;
  if (matches(msg, km.pgUp)) m.zoomIn(xIncrement, yIncrement);
  else if (matches(msg, km.pgDown)) m.zoomOut(xIncrement, yIncrement);
}

// keyXZoomHandler handles keyboard messages for X axis zooming
function keyXZoomHandler(m: Model, msg: KeyLike, xIncrement: number): void {
  const km = m.canvas.keyMap;
  if (matches(msg, km.pgUp)) m.zoomIn(xIncrement, 0);
  else if (matches(msg, km.pgDown)) m.zoomOut(xIncrement, 0);
}

// keyYZoomHandler handles keyboard messages for Y axis zooming
function keyYZoomHandler(m: Model, msg: KeyLike, yIncrement: number): void {
  const km = m.canvas.keyMap;
  if (matches(msg, km.pgUp)) m.zoomIn(0, yIncrement);
  else if (matches(msg, km.pgDown)) m.zoomOut(0, yIncrement);
}

// mouseClickHandler handles mouse click messages for every axis
// (upstream's identical mouseClickXYHandler, mouseClickXHandler and
// mouseClickYHandler): it records the position of the click in the zone.
function mouseClickHandler(m: Model, msg: MouseLike, lastPos: Point): void {
  const zm = m.zoneManager();
  if (zm == null) return;
  const zInfo = zm.get(m.zoneID());
  if (zInfo && zInfo.inBounds(msg)) {
    const [x, y] = zInfo.pos(msg);
    lastPos.x = x;
    lastPos.y = y;
  }
}

// zonePos returns the zone position of a motion message with a pressed
// button inside the linechart zone, or null.
function zonePos(m: Model, msg: MouseLike): [number, number] | null {
  if (msg.button === MouseButton.None) return null;
  const zm = m.zoneManager();
  if (zm == null) return null;
  const zInfo = zm.get(m.zoneID());
  if (zInfo && zInfo.inBounds(msg)) return zInfo.pos(msg);
  return null;
}

// mouseMotionXYHandler handles mouse motion messages for X and Y axes
function mouseMotionXYHandler(m: Model, msg: MouseLike, lastPos: Point, xIncrement: number, yIncrement: number): void {
  const pos = zonePos(m, msg);
  if (pos === null) return;
  const [x, y] = pos;
  if (x > lastPos.x) m.moveRight(xIncrement);
  else if (x < lastPos.x) m.moveLeft(xIncrement);
  if (y > lastPos.y) m.moveDown(yIncrement);
  else if (y < lastPos.y) m.moveUp(yIncrement);
  lastPos.x = x;
  lastPos.y = y;
}

// mouseMotionXHandler handles mouse motion messages for X axis
function mouseMotionXHandler(m: Model, msg: MouseLike, lastPos: Point, increment: number): void {
  const pos = zonePos(m, msg);
  if (pos === null) return;
  const [x, y] = pos;
  if (x > lastPos.x) m.moveRight(increment);
  else if (x < lastPos.x) m.moveLeft(increment);
  lastPos.x = x;
  lastPos.y = y;
}

// mouseMotionYHandler handles mouse motion messages for Y axis
function mouseMotionYHandler(m: Model, msg: MouseLike, lastPos: Point, increment: number): void {
  const pos = zonePos(m, msg);
  if (pos === null) return;
  const [x, y] = pos;
  if (y > lastPos.y) m.moveDown(increment);
  else if (y < lastPos.y) m.moveUp(increment);
  lastPos.x = x;
  lastPos.y = y;
}
