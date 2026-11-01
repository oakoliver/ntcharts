// TypeScript twins of tests/parity/go/canvas.go. Keep the two files in step.
import { newStyle, type Style } from '@oakoliver/lipgloss';
import { newBinding, withKeys } from '@oakoliver/bubbles';
import * as canvas from '../../src/canvas/index.js';
import { codePoint } from '../../src/canvas/runes/runes.js';
import { register } from './registry.js';

const cvStyle = (fg: string): Style => newStyle().foreground(fg);
const cvRed = cvStyle('1');
const cvGreen = cvStyle('2');
const cvBlue = cvStyle('4');
const cvBold = newStyle().bold(true).foreground('#ff8800').background('#202020');

type AnyMsg = any;

const cvKey = (name: string): AnyMsg => ({ _tag: 'KeyPressMsg', toString: () => name });
const cvText = (c: string): AnyMsg => cvKey(c);
const cvWheel = (button: number): AnyMsg => ({ _tag: 'MouseWheelMsg', x: 0, y: 0, button });
const WheelUp = 4;
const WheelDown = 5;
const WheelLeft = 6;
const WheelRight = 7;

function cvDigits(w: number, h: number, ...opts: canvas.Option[]): canvas.Model {
  const c = canvas.New(w, h, ...opts);
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let s = '';
    for (let x = 0; x < w; x++) s += String.fromCharCode(97 + ((x + y * 3) % 26));
    lines.push(s);
  }
  c.setLines(lines);
  return c;
}

function cvCursor(c: canvas.Model): string {
  const p = c.cursor();
  return `\ncursor=${p.x},${p.y}`;
}

function cvUpdates(c: canvas.Model, ...msgs: AnyMsg[]): canvas.Model {
  for (const m of msgs) c.update(m);
  return c;
}

const P = (x: number, y: number): canvas.Point => ({ x, y });

register('canvas/hello', () => {
  const c = canvas.New(5, 2);
  c.setLinesWithStyle(['hello', 'world'], newStyle().foreground(6));
  return c.view();
});

register('canvas/set-lines-styles', () => {
  const c = canvas.New(12, 4, canvas.WithStyle(cvGreen));
  c.setLines(['default green', 'short', '', 'fourth', 'overflow row']);
  c.setLinesWithStyle(['red top'], cvRed);
  c.setStringWithStyle(P(3, 1), 'bold', cvBold);
  c.setString(P(8, 2), 'truncated text');
  c.setString(P(-2, 3), 'negative x');
  const ok1 = c.setString(P(0, -1), 'above');
  const ok2 = c.setString(P(0, 4), 'below');
  const ok3 = c.setLinesWithStyle(['a', 'b'], cvBlue);
  return `${c.view()}\n${ok1} ${ok2} ${ok3}`;
});

register('canvas/set-runes', () => {
  const c = canvas.New(10, 3);
  c.setRunes(P(1, 0), Array.from('héllo█'));
  c.setRunesWithStyle(P(0, 1), ['日', '本', '語', '⠿'], cvRed);
  c.setRunesWithStyle(P(8, 2), Array.from('abcdef'), cvBold);
  c.setRunesWithStyle(P(-3, 2), Array.from('xyzwv'), cvBlue);
  return c.view();
});

register('canvas/set-cells', () => {
  const c = canvas.New(8, 4, canvas.WithStyle(cvBlue));
  const r1 = c.setRune(P(0, 0), 'A');
  const r2 = c.setRuneWithStyle(P(1, 1), 'B', cvRed);
  const r3 = c.setCell(P(2, 2), canvas.NewCellWithStyle('C', cvBold));
  const r4 = c.setCell(P(3, 3), canvas.NewCell('D'));
  const r5 = c.setRune(P(8, 0), 'X');
  const r6 = c.setRuneWithStyle(P(0, -1), 'X', cvRed);
  const r7 = c.setCell(P(-1, 0), canvas.NewCell('X'));
  const r8 = c.setCellStyle(P(0, 0), cvGreen);
  const r9 = c.setCellStyle(P(4, 4), cvGreen);
  c.setCellStyle(P(5, 1), cvRed); // style on an empty cell
  const gs = c.getCellStyle(P(0, 0));
  const gn = c.getCellStyle(P(9, 9));
  const cell = c.cell(P(1, 1));
  const out = c.cell(P(99, 1));
  return `${c.view()}\n${r1} ${r2} ${r3} ${r4} ${r5} ${r6} ${r7} ${r8} ${r9} ${gs !== null} ${gn === null} ${codePoint(cell.rune)} ${codePoint(out.rune)} ${gs!.render('z')}`;
});

register('canvas/fill', () => {
  const c = canvas.New(6, 3);
  c.fill(canvas.NewCellWithStyle('#', cvRed));
  c.setString(P(1, 1), 'ok');
  return c.view();
});

register('canvas/fill-line', () => {
  const c = canvas.New(7, 5);
  c.fillLine(0, canvas.NewCellWithStyle('=', cvGreen));
  c.fillLine(2, canvas.NewCell('-'));
  c.fillLine(4, canvas.NewCellWithStyle('~', cvBold));
  c.fillLine(5, canvas.NewCell('!'));
  c.fillLine(-1, canvas.NewCell('!'));
  return c.view();
});

register('canvas/set-style', () => {
  const c = cvDigits(8, 3);
  c.setStyle(cvBlue);
  c.setString(P(2, 1), 'ZZ');
  return c.view();
});

register('canvas/clear', () => {
  const c = cvDigits(6, 3, canvas.WithStyle(cvRed));
  const before = c.view();
  c.clear();
  c.setRune(P(5, 2), '.');
  return `${before}\n--\n${c.view()}`;
});

register('canvas/shift-up', () => {
  const c = cvDigits(5, 4, canvas.WithStyle(cvRed));
  c.setStyle(cvRed);
  c.setRuneWithStyle(P(0, 3), '@', cvBlue);
  c.shiftUp();
  return c.view();
});

register('canvas/shift-down', () => {
  const c = cvDigits(5, 4);
  c.setRuneWithStyle(P(0, 0), '@', cvBlue);
  c.shiftDown();
  c.shiftDown();
  return c.view();
});

register('canvas/shift-left', () => {
  const c = cvDigits(6, 3);
  c.setRuneWithStyle(P(1, 1), '@', cvBlue);
  c.shiftLeft();
  return c.view();
});

register('canvas/shift-right', () => {
  const c = cvDigits(6, 3);
  c.setRuneWithStyle(P(4, 1), '@', cvBlue);
  c.shiftRight();
  c.shiftRight();
  return c.view();
});

register('canvas/shift-single-cell', () => {
  const c = canvas.New(1, 1);
  c.setRune(P(0, 0), 'q');
  c.shiftUp();
  const a = c.view();
  c.setRune(P(0, 0), 'q');
  c.shiftLeft();
  const b = c.view();
  c.setRune(P(0, 0), 'q');
  c.shiftDown();
  const d = c.view();
  c.setRune(P(0, 0), 'q');
  c.shiftRight();
  return `${a}|${b}|${d}|${c.view()}|`;
});

register('canvas/resize-grow', () => {
  const c = cvDigits(4, 2, canvas.WithStyle(cvGreen));
  c.setCursor(P(2, 1));
  c.resize(7, 4);
  c.setString(P(3, 3), 'new');
  return `${c.view()}${cvCursor(c)} ${c.width()}x${c.height()}`;
});

register('canvas/resize-shrink', () => {
  const c = cvDigits(8, 5);
  c.resize(3, 2);
  c.resize(5, 3);
  return `${c.view()} ${c.width()}x${c.height()} view=${c.viewWidth}x${c.viewHeight}`;
});

register('canvas/resize-zero-negative', () => {
  const c = cvDigits(4, 3);
  c.resize(-5, 2);
  const a = c.view();
  c.resize(3, -1);
  const b = c.view();
  c.resize(0, 0);
  return `${JSON.stringify(a)} ${JSON.stringify(b)} ${JSON.stringify(c.view())} ${c.width()}x${c.height()}`;
});

register('canvas/resize-with-view-size', () => {
  const c = cvDigits(6, 4, canvas.WithViewWidth(3), canvas.WithViewHeight(2));
  c.resize(9, 6);
  const a = c.view();
  c.viewWidth = 9;
  c.viewHeight = 6;
  return `${a}\n--\n${c.view()}`;
});

register('canvas/with-options', () => {
  const c = canvas.New(
    10,
    4,
    canvas.WithStyle(cvRed),
    canvas.WithContent(['line one', 'line two', 'three']),
    canvas.WithViewWidth(6),
    canvas.WithViewHeight(3),
    canvas.WithCursor(P(2, 1)),
    canvas.WithFocus(),
  );
  return `${c.view()}${cvCursor(c)} focused=${c.focused()}`;
});

register('canvas/cursor-clamp', () => {
  const c = cvDigits(6, 4, canvas.WithViewWidth(3), canvas.WithViewHeight(2));
  c.setCursor(P(99, 99));
  const a = c.view() + cvCursor(c);
  c.setCursor(P(-4, 2));
  return `${a}\n--\n${c.view()}${cvCursor(c)}`;
});

register('canvas/viewport-smaller', () => {
  const c = cvDigits(12, 6, canvas.WithViewWidth(5), canvas.WithViewHeight(3), canvas.WithStyle(cvBlue));
  c.setCursor(P(3, 2));
  return c.view();
});

register('canvas/viewport-clipped-by-canvas', () => {
  const c = cvDigits(6, 4, canvas.WithViewWidth(5), canvas.WithViewHeight(3));
  c.setCursor(P(4, 3));
  return JSON.stringify(c.view());
});

register('canvas/viewport-larger', () => {
  const c = cvDigits(4, 3, canvas.WithViewWidth(9), canvas.WithViewHeight(5));
  return JSON.stringify(c.view());
});

register('canvas/viewport-zero', () => {
  const a = canvas.New(0, 0);
  const b = canvas.New(3, 0);
  const d = canvas.New(0, 3);
  return `${JSON.stringify(a.view())} ${JSON.stringify(b.view())} ${JSON.stringify(d.view())}`;
});

register('canvas/update-keys', () => {
  const c = cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus());
  cvUpdates(c, cvKey('down'), cvText('j'), cvKey('right'), cvText('l'), cvKey('pgdown'));
  const a = c.view() + cvCursor(c);
  cvUpdates(c, cvKey('up'), cvText('k'), cvKey('left'), cvText('h'), cvKey('pgup'));
  return `${a}\n--\n${c.view()}${cvCursor(c)}`;
});

register('canvas/update-keys-limits', () => {
  const c = cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus());
  for (let i = 0; i < 20; i++) cvUpdates(c, cvKey('down'), cvKey('right'));
  const a = c.view() + cvCursor(c);
  for (let i = 0; i < 20; i++) cvUpdates(c, cvKey('up'), cvKey('left'));
  return `${a}\n--\n${c.view()}${cvCursor(c)}`;
});

register('canvas/update-unfocused', () => {
  const c = cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3));
  cvUpdates(c, cvKey('down'), cvWheel(WheelDown));
  const a = cvCursor(c);
  c.focus();
  cvUpdates(c, cvKey('down'));
  const b = cvCursor(c);
  c.blur();
  cvUpdates(c, cvKey('down'));
  return a + b + cvCursor(c);
});

register('canvas/update-wheel', () => {
  const c = cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus());
  cvUpdates(c, cvWheel(WheelDown), cvWheel(WheelDown), cvWheel(WheelRight), cvWheel(WheelRight), cvWheel(WheelRight));
  const a = c.view() + cvCursor(c);
  cvUpdates(c, cvWheel(WheelUp), cvWheel(WheelLeft), cvWheel(WheelLeft), cvWheel(WheelUp), cvWheel(WheelUp));
  return `${a}\n--\n${c.view()}${cvCursor(c)}`;
});

register('canvas/update-ignored-msgs', () => {
  const c = cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus());
  cvUpdates(
    c,
    cvText('x'),
    cvKey('enter'),
    { _tag: 'MouseClickMsg', x: 0, y: 0, button: 1 },
    { _tag: 'MouseMotionMsg', x: 3, y: 3, button: 1 },
    { _tag: 'MouseReleaseMsg', x: 0, y: 0, button: 1 },
    { _tag: 'MouseWheelMsg', x: 0, y: 0, button: 1 },
    { _tag: 'WindowSizeMsg', width: 10, height: 10 },
    'a string',
    42,
    null,
  );
  return cvCursor(c);
});

register('canvas/update-key-release', () => {
  const c = cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus());
  cvUpdates(
    c,
    { _tag: 'KeyReleaseMsg', toString: () => 'down' },
    { _tag: 'KeyReleaseMsg', toString: () => 'right' },
  );
  return cvCursor(c);
});

register('canvas/update-custom-keymap', () => {
  const km = canvas.DefaultKeyMap();
  km.down = newBinding(withKeys('s'));
  km.up = newBinding(withKeys('w'));
  km.right = newBinding(withKeys('d', 'right'));
  const c = cvDigits(10, 8, canvas.WithViewWidth(6), canvas.WithViewHeight(3), canvas.WithFocus(), canvas.WithKeyMap(km));
  cvUpdates(c, cvKey('down'), cvText('j'), cvText('s'), cvText('s'), cvText('d'), cvKey('right'), cvText('l'));
  const a = cvCursor(c);
  cvUpdates(c, cvText('w'), cvKey('up'), cvText('k'), cvText('h'), cvKey('left'));
  return `${a}${cvCursor(c)}\n${c.view()}`;
});

register('canvas/update-custom-handler', () => {
  let calls = 0;
  const h: canvas.UpdateHandler = (m, msg) => {
    calls++;
    const tag = (msg as AnyMsg)?._tag;
    if (tag === 'KeyPressMsg') {
      m.moveRight(2);
      m.moveDown(1);
    } else if (tag === 'MouseWheelMsg') {
      m.moveLeft(1);
    }
  };
  const c = cvDigits(12, 8, canvas.WithViewWidth(5), canvas.WithViewHeight(3), canvas.WithFocus(), canvas.WithUpdateHandler(h));
  cvUpdates(c, cvKey('enter'), cvKey('enter'), cvWheel(WheelUp));
  return `${c.view()}${cvCursor(c)} calls=${calls}`;
});

register('canvas/move-direct', () => {
  const c = cvDigits(10, 6, canvas.WithViewWidth(4), canvas.WithViewHeight(2));
  c.moveDown(3);
  c.moveRight(4);
  const a = cvCursor(c);
  c.moveDown(10);
  c.moveRight(10);
  const b = cvCursor(c);
  c.moveUp(100);
  c.moveLeft(100);
  return `${a}${b}${cvCursor(c)}\n${c.view()}`;
});

register('canvas/draw-then-view-scrolled', () => {
  const c = canvas.New(8, 6, canvas.WithViewWidth(8), canvas.WithViewHeight(3), canvas.WithFocus());
  for (let i = 0; i < 6; i++) c.setStringWithStyle(P(i, i), `r${i}`, cvRed);
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += c.view();
    out += '\n==\n';
    cvUpdates(c, cvKey('down'));
  }
  return out;
});
