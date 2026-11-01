// Message helpers. Bubble Tea messages are recognised by their `_tag`, not by
// class identity, so charts work with any copy of @oakoliver/bubbletea.

import type { Msg } from '@oakoliver/bubbletea';

/** Mouse button values, identical to @oakoliver/bubbletea's MouseButton enum. */
export const MouseButton = {
  None: 0,
  Left: 1,
  Middle: 2,
  Right: 3,
  WheelUp: 4,
  WheelDown: 5,
  WheelLeft: 6,
  WheelRight: 7,
} as const;

export interface MouseLike {
  x: number;
  y: number;
  button: number;
}

export function tagOf(msg: Msg): string | undefined {
  return msg != null && typeof msg === 'object' ? (msg as { _tag?: string })._tag : undefined;
}

/** Bubble Tea v2 KeyMsg: a key press or a key release. */
export function isKeyMsg(msg: Msg): msg is { toString(): string } {
  const t = tagOf(msg);
  return t === 'KeyPressMsg' || t === 'KeyReleaseMsg';
}

export function isMouseWheelMsg(msg: Msg): msg is MouseLike {
  return tagOf(msg) === 'MouseWheelMsg';
}

export function isMouseClickMsg(msg: Msg): msg is MouseLike {
  return tagOf(msg) === 'MouseClickMsg';
}

export function isMouseReleaseMsg(msg: Msg): msg is MouseLike {
  return tagOf(msg) === 'MouseReleaseMsg';
}

export function isMouseMotionMsg(msg: Msg): msg is MouseLike {
  return tagOf(msg) === 'MouseMotionMsg';
}

/** Any of the four Bubble Tea v2 mouse messages. */
export function isMouseMsg(msg: Msg): msg is MouseLike {
  const t = tagOf(msg);
  return t === 'MouseClickMsg' || t === 'MouseReleaseMsg' || t === 'MouseWheelMsg' || t === 'MouseMotionMsg';
}
