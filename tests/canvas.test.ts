// Port of canvas/canvas_test.go (ntcharts v2.9.0).
import { describe, expect, test } from 'bun:test';
import {
  Float64PointAdd,
  Float64PointMul,
  Float64PointSub,
  New,
  NewCell,
  WithFocus,
  WithViewHeight,
  WithViewWidth,
  WithZoneID,
  WithZoneManager,
  type Float64Point,
} from '../src/canvas/index.js';
import type { ZoneManager } from '../src/internal/zone.js';
import { Null } from '../src/canvas/runes/runes.js';

describe('canvas', () => {
  test('TestNew', () => {
    const w = 30;
    const h = 15;
    const c = New(w, h);

    const p = c.cursor();
    expect(p.x === 0 && p.y === 0).toBe(true); // Cursor not initialized to (0,0)
    expect(c.width()).toBe(w);
    expect(c.height()).toBe(h);
    expect(c.viewWidth).toBe(w);
    expect(c.viewHeight).toBe(h);
  });

  test('TestCursor', () => {
    const w = 30;
    const h = 15;
    const c = New(w, h);

    c.setCursor({ x: Math.trunc(w / 2), y: Math.trunc(h / 2) });
    let p = c.cursor();
    expect(p.x).toBe(Math.trunc(w / 2));
    expect(p.y).toBe(Math.trunc(h / 2));

    c.clear();
    p = c.cursor();
    expect(p.x).toBe(Math.trunc(w / 2)); // cursor survives clear
    expect(p.y).toBe(Math.trunc(h / 2));

    c.setCursor({ x: -1, y: -1 });
    p = c.cursor();
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);

    c.setCursor({ x: w, y: h });
    p = c.cursor();
    expect(p.x).toBe(w - 1);
    expect(p.y).toBe(h - 1);
  });

  // TestResize_NegativeClampedToZero verifies Resize never lets negative dims
  // reach the underlying allocation (Go: make([]CellLine, h) would panic).
  // Higher layers (heatmap, picture) can pass negative values when their
  // windowsize math underflows.
  test('TestResize_NegativeClampedToZero', () => {
    const c = New(20, 10);
    c.resize(-5, -3);
    expect([c.width(), c.height()]).toEqual([0, 0]);
  });

  test('TestResize', () => {
    const w = 30;
    const h = 15;
    const c = New(w, h);
    c.setCursor({ x: Math.trunc(w / 2), y: Math.trunc(h / 2) });

    c.resize(w + 5, h + 5);

    let p = c.cursor();
    expect(p.x === 0 && p.y === 0).toBe(true); // Cursor not set to (0,0) after Resize()

    c.setCursor({ x: w, y: h });
    p = c.cursor();
    expect(p.x).toBe(w);
    expect(p.y).toBe(h);
  });

  test('TestSetRune', () => {
    const w = 10;
    const h = 5;
    const c = New(w, h);
    const mid = { x: Math.trunc(w / 2), y: Math.trunc(h / 2) };

    expect(c.cell(mid).rune).toBe(Null); // Rune not initialized

    expect(c.setRune({ x: w, y: h }, 'A')).toBe(false); // SetRune not bounded
    expect(c.setRune(mid, 'A')).toBe(true);
    expect(c.cell(mid).rune).toBe('A');

    c.clear();
    expect(c.cell(mid).rune).toBe(Null); // Rune not cleared
  });

  test('TestFill', () => {
    const w = 10;
    const h = 5;
    const c = New(w, h);

    c.fill(NewCell('B'));

    for (let y = 0; y < c.height(); y++) {
      for (let x = 0; x < c.width(); x++) {
        expect(c.cell({ x, y }).rune).toBe('B');
      }
    }
  });

  test('TestFloat64Point', () => {
    const x = -1.5;
    const y = 2.5;
    const f: Float64Point = { x, y };

    const scale = 2.0;
    let nf = Float64PointMul(f, { x: scale, y: scale });
    expect(nf.x).toBe(x * scale);
    expect(nf.y).toBe(y * scale);

    const xOffset = -10.0;
    const yOffset = 3.0;
    const offset: Float64Point = { x: xOffset, y: yOffset };
    nf = Float64PointAdd(f, offset);
    expect(nf.x).toBe(x + xOffset);
    expect(nf.y).toBe(y + yOffset);

    nf = Float64PointSub(f, offset);
    expect(nf.x).toBe(x - xOffset);
    expect(nf.y).toBe(y - yOffset);
  });

  // Not an upstream test (upstream has no zone fixtures): exercises the mouse
  // click/motion branches of DefaultUpdateHandler with a structural fake zone manager.
  test('mouse drag moves the viewport through a zone manager', () => {
    const marked: string[] = [];
    const zm: ZoneManager = {
      newPrefix: () => 'zone1',
      mark: (id, v) => {
        marked.push(id);
        return v;
      },
      get: () => ({
        inBounds: () => true,
        pos: (msg) => [msg.x, msg.y],
      }),
    };
    const c = New(10, 8, WithViewWidth(4), WithViewHeight(3), WithFocus(), WithZoneManager(zm));
    expect(c.zoneID()).toBe('zone1');
    c.view();
    expect(marked).toEqual(['zone1']);

    c.update({ _tag: 'MouseClickMsg', x: 1, y: 1, button: 1 } as never);
    c.update({ _tag: 'MouseMotionMsg', x: 2, y: 1, button: 1 } as never); // right
    c.update({ _tag: 'MouseMotionMsg', x: 2, y: 2, button: 1 } as never); // down
    c.update({ _tag: 'MouseMotionMsg', x: 2, y: 3, button: 0 } as never); // no button: ignored
    expect(c.cursor()).toEqual({ x: 1, y: 1 });
    c.update({ _tag: 'MouseMotionMsg', x: 1, y: 1, button: 1 } as never); // left and up
    expect(c.cursor()).toEqual({ x: 0, y: 0 });

    c.setZoneManager(null);
    c.update({ _tag: 'MouseClickMsg', x: 1, y: 1, button: 1 } as never);
    c.update({ _tag: 'MouseMotionMsg', x: 5, y: 5, button: 1 } as never);
    expect(c.cursor()).toEqual({ x: 0, y: 0 });
  });
});

// Not upstream tests: WithZoneID/setZoneID are an addition.
describe('canvas zone ID', () => {
  const zm = (): ZoneManager => {
    let n = 0;
    return { newPrefix: () => `gen${++n}`, mark: (id, v) => `<${id}>${v}`, get: () => null };
  };

  test('WithZoneID sets a stable ID in either order and skips the generated prefix', () => {
    const a = New(4, 2, WithZoneID('canvas'), WithZoneManager(zm()));
    const b = New(4, 2, WithZoneManager(zm()), WithZoneID('canvas'));
    expect(a.zoneID()).toBe('canvas');
    expect(b.zoneID()).toBe('canvas');
    expect(a.view().startsWith('<canvas>')).toBe(true);
  });

  test('an empty ID goes back to a generated prefix once there is a manager', () => {
    const c = New(4, 2, WithZoneManager(zm()), WithZoneID(''));
    expect(c.zoneID()).not.toBe(''); // a new prefix, as the manager would hand out
    expect(New(4, 2, WithZoneID('')).zoneID()).toBe('');
  });
});
