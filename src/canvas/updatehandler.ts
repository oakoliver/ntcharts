// ntcharts - Copyright (c) 2024 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

// Methods and objects used during canvas Model update() to modify internal
// state. The canvas can move the viewport displaying the contents up, down,
// left and right.

import { type Binding, matches, newBinding, withHelp, withKeys } from '@oakoliver/bubbles';
import type { Msg } from '@oakoliver/bubbletea';
import { MouseButton, isKeyMsg, isMouseClickMsg, isMouseMotionMsg, isMouseWheelMsg } from '../internal/msg.js';
import type { Model, Point } from './canvas.js';

/** KeyMap of the canvas viewport. */
export interface KeyMap {
  up: Binding;
  down: Binding;
  left: Binding;
  right: Binding;
  pgUp: Binding;
  pgDown: Binding;
}

/** DefaultKeyMap returns a default KeyMap for canvas. */
export function DefaultKeyMap(): KeyMap {
  return {
    up: newBinding(withKeys('up', 'k'), withHelp('↑/k', 'move up')),
    down: newBinding(withKeys('down', 'j'), withHelp('↓/j', 'move down')),
    left: newBinding(withKeys('left', 'h'), withHelp('←/h', 'move left')),
    right: newBinding(withKeys('right', 'l'), withHelp('→/l', 'move right')),
    pgUp: newBinding(withKeys('pgup'), withHelp('PgUp', 'zoom in')),
    pgDown: newBinding(withKeys('pgdown'), withHelp('PgDown', 'zoom out')),
  };
}

/** UpdateHandler callback invoked during an update(), with the canvas Model and the Bubble Tea Msg. */
export type UpdateHandler = (m: Model, msg: Msg) => void;

/**
 * DefaultUpdateHandler is used by the canvas to enable moving the viewing
 * window using the mouse wheel, holding down the left mouse button and
 * moving, and with the arrow keys. Uses the canvas KeyMap for keyboard messages.
 */
export function DefaultUpdateHandler(): UpdateHandler {
  let lastPos: Point = { x: 0, y: 0 }; // tracks zone position of last zone mouse position
  return (m: Model, msg: Msg) => {
    if (isKeyMsg(msg)) {
      const km = m.keyMap;
      if (matches(msg, km.up)) m.moveUp(1);
      else if (matches(msg, km.down)) m.moveDown(1);
      else if (matches(msg, km.left)) m.moveLeft(1);
      else if (matches(msg, km.right)) m.moveRight(1);
      else if (matches(msg, km.pgUp)) m.moveUp(1);
      else if (matches(msg, km.pgDown)) m.moveDown(1);
    } else if (isMouseWheelMsg(msg)) {
      switch (msg.button) {
        case MouseButton.WheelUp:
          m.moveUp(1);
          break;
        case MouseButton.WheelDown:
          m.moveDown(1);
          break;
        case MouseButton.WheelRight:
          m.moveRight(1);
          break;
        case MouseButton.WheelLeft:
          m.moveLeft(1);
          break;
      }
    } else if (isMouseClickMsg(msg)) {
      const zm = m.zoneManager();
      if (zm == null) return;
      const zInfo = zm.get(m.zoneID());
      if (zInfo && zInfo.inBounds(msg)) {
        const [x, y] = zInfo.pos(msg);
        lastPos = { x, y }; // set position of last click
      }
    } else if (isMouseMotionMsg(msg)) {
      // event occurs when mouse is pressed
      if (msg.button === MouseButton.None) return;
      const zm = m.zoneManager();
      if (zm == null) return;
      const zInfo = zm.get(m.zoneID());
      if (zInfo && zInfo.inBounds(msg)) {
        const [x, y] = zInfo.pos(msg);
        if (x > lastPos.x) m.moveRight(1);
        else if (x < lastPos.x) m.moveLeft(1);
        if (y > lastPos.y) m.moveDown(1);
        else if (y < lastPos.y) m.moveUp(1);
        lastPos = { x, y }; // update last mouse position
      }
    }
  };
}
