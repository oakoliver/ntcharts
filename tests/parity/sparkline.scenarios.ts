import { newStyle } from '@oakoliver/lipgloss';
import * as sparkline from '../../src/sparkline/index.js';
import { register } from './registry.js';

const spPurple = newStyle().foreground('63');
const spRedOnG = newStyle().foreground('9').background('2');
const spCyanOY = newStyle().foreground('6').background('3');
const spYellow = newStyle().foreground('3');
const spHex = newStyle().foreground('#ff8800').bold(true);

// spData returns n deterministic pseudo-random values in 0..max.
const spData = (n: number, max: number): number[] =>
  Array.from({ length: n }, (_, i) => (((i * 37 + 11) % 23) * max) / 23.0);

// spRamp returns n values rising linearly to max.
const spRamp = (n: number, max: number): number[] => Array.from({ length: n }, (_, i) => (i * max) / (n - 1));

register('sparkline/draw-columns', () => {
  const m = sparkline.New(25, 12, sparkline.WithMaxValue(100), sparkline.WithStyle(spPurple));
  m.pushAll(spData(25, 100));
  m.draw();
  return m.view();
});
register('sparkline/draw-columns-background', () => {
  const m = sparkline.New(25, 5, sparkline.WithMaxValue(100), sparkline.WithStyle(spRedOnG));
  m.pushAll(spData(25, 100));
  m.draw();
  return m.view();
});
register('sparkline/draw-columns-only', () => {
  const m = sparkline.New(25, 5, sparkline.WithMaxValue(100), sparkline.WithStyle(spRedOnG));
  m.pushAll(spData(25, 100));
  m.drawColumnsOnly();
  return m.view();
});
register('sparkline/draw-braille', () => {
  const m = sparkline.New(25, 3, sparkline.WithMaxValue(100), sparkline.WithStyle(spYellow));
  m.pushAll(spData(25, 100));
  m.drawBraille();
  return m.view();
});
register('sparkline/draw-braille-tall', () => {
  const m = sparkline.New(30, 8, sparkline.WithMaxValue(100), sparkline.WithStyle(spCyanOY));
  m.pushAll(spData(30, 100));
  m.drawBraille();
  return m.view();
});
register('sparkline/draw-braille-partial', () => {
  const m = sparkline.New(30, 4, sparkline.WithStyle(spPurple));
  m.pushAll(spRamp(11, 50));
  m.drawBraille();
  return m.view();
});
register('sparkline/draw-braille-interpolation-limit', () => {
  const m = sparkline.New(20, 6, sparkline.WithMaxValue(100), sparkline.WithMaxInterpolationPoints(3), sparkline.WithStyle(spPurple));
  m.pushAll(spData(20, 100));
  m.drawBraille();
  return m.view();
});
register('sparkline/draw-quadrants', () => {
  const m = sparkline.New(12, 4, sparkline.WithMaxValue(100), sparkline.WithStyle(spYellow));
  m.pushAll(spData(24, 100));
  m.drawQuadrants();
  return m.view();
});
register('sparkline/draw-quadrants-columns-only', () => {
  const m = sparkline.New(12, 4, sparkline.WithMaxValue(100), sparkline.WithStyle(spRedOnG));
  m.pushAll(spData(17, 100));
  m.drawQuadrantsColumnsOnly();
  return m.view();
});
register('sparkline/push-beyond-width', () => {
  const m = sparkline.New(10, 4, sparkline.WithMaxValue(50), sparkline.WithStyle(spPurple));
  let out = '';
  spData(35, 50).forEach((v, i) => {
    m.push(v);
    if (i === 4 || i === 9 || i === 14 || i === 24 || i === 34) {
      m.draw();
      out += m.view() + `\n-- after ${i + 1} pushes\n`;
    }
  });
  return out;
});
register('sparkline/push-beyond-width-braille', () => {
  const m = sparkline.New(10, 3, sparkline.WithMaxValue(50), sparkline.WithStyle(spYellow));
  m.pushAll(spData(37, 50));
  m.drawBraille();
  return m.view();
});
register('sparkline/push-beyond-width-quadrants', () => {
  const m = sparkline.New(6, 3, sparkline.WithMaxValue(50), sparkline.WithStyle(spYellow));
  m.pushAll(spData(40, 50));
  m.drawQuadrants();
  return m.view();
});
register('sparkline/auto-max-grows', () => {
  const m = sparkline.New(16, 6, sparkline.WithStyle(spPurple));
  m.pushAll([0.2, 0.5, 0.9, 0.4]);
  m.draw();
  const out = m.view() + `\nmax=${m.maxValue()} scale=${m.scale()}\n`;
  m.pushAll([3, 7.5, 2]);
  m.draw();
  return out + m.view() + `\nmax=${m.maxValue()} scale=${m.scale()}`;
});
register('sparkline/fixed-max-clips', () => {
  const m = sparkline.New(16, 5, sparkline.WithMaxValue(10), sparkline.WithNoAutoMaxValue(), sparkline.WithStyle(spPurple));
  m.pushAll([1, 4, 9, 14, 40, 7, 3, 0]);
  m.draw();
  return m.view() + `\nmax=${m.maxValue()} scale=${m.scale()}`;
});
register('sparkline/negative-values-clamp', () => {
  const m = sparkline.New(12, 4, sparkline.WithMaxValue(10), sparkline.WithStyle(spPurple));
  m.pushAll([-5, 3, -1, 8, -20, 6]);
  m.draw();
  return m.view();
});
register('sparkline/with-data-option', () => {
  const m = sparkline.New(14, 6, sparkline.WithData(spRamp(14, 9)), sparkline.WithStyle(spHex));
  m.draw();
  return m.view();
});
register('sparkline/resize', () => {
  const m = sparkline.New(12, 5, sparkline.WithMaxValue(100), sparkline.WithStyle(spPurple));
  m.pushAll(spData(24, 100));
  m.draw();
  let out = m.view();
  m.resize(6, 3);
  m.draw();
  out += '\n--\n' + m.view();
  m.resize(20, 6);
  m.pushAll(spData(5, 100));
  m.draw();
  return out + '\n--\n' + m.view();
});
register('sparkline/resize-same-width', () => {
  const m = sparkline.New(12, 5, sparkline.WithMaxValue(100), sparkline.WithStyle(spPurple));
  m.pushAll(spData(12, 100));
  m.resize(12, 8);
  m.draw();
  return m.view();
});
register('sparkline/clear', () => {
  const m = sparkline.New(12, 4, sparkline.WithMaxValue(100), sparkline.WithStyle(spPurple));
  m.pushAll(spData(12, 100));
  m.draw();
  m.clear();
  m.draw();
  const out = m.view();
  m.pushAll(spData(3, 100));
  m.draw();
  return out + '\n--\n' + m.view();
});
register('sparkline/height-one', () => {
  const m = sparkline.New(24, 1, sparkline.WithMaxValue(8), sparkline.WithStyle(spYellow));
  m.pushAll(spRamp(24, 8));
  m.draw();
  return m.view();
});
register('sparkline/all-zero', () => {
  const m = sparkline.New(8, 3, sparkline.WithStyle(spPurple));
  m.pushAll([0, 0, 0, 0]);
  m.draw();
  let out = m.view();
  m.drawBraille();
  out += '\n--\n' + m.view();
  m.drawQuadrants();
  return out + '\n--\n' + m.view();
});
