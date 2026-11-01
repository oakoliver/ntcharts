import { newStyle, type Style } from '@oakoliver/lipgloss';
import * as barchart from '../../src/barchart/index.js';
import { register } from './registry.js';

const bcFg = (c: string): Style => newStyle().foreground(c);
const bcBlock = (c: string): Style => newStyle().foreground(c).background(c);

const bcAxis = bcFg('3');
const bcLabel = bcFg('63');
const bcRed = bcBlock('9');
const bcGreen = bcBlock('2');
const bcCyan = bcBlock('6');
const bcYel = bcBlock('3');

const bcBar = (label: string, ...values: barchart.BarValue[]): barchart.BarData => ({ label, values });
const bcV = (name: string, value: number, style: Style): barchart.BarValue => ({ name, value, style });

// upstream example data: four bars of four segments, some negative
const bcExample = (): barchart.BarData[] => [
  bcBar('A', bcV('n1', 21.2, bcRed), bcV('n2', 10.1, bcGreen), bcV('n3', 6.5, bcCyan), bcV('n4', 7.7, bcYel)),
  bcBar('B', bcV('n1', 15.1, bcRed), bcV('n2', 15.1, bcGreen), bcV('n3', 3.3, bcCyan), bcV('n4', -7.7, bcYel)),
  bcBar('C', bcV('n1', 13.6, bcRed), bcV('n2', 14.1, bcGreen), bcV('n3', -4.4, bcCyan), bcV('n4', 4.4, bcYel)),
  bcBar('D', bcV('n1', 13.1, bcRed), bcV('n2', 11.1, bcGreen), bcV('n3', 10.9, bcCyan), bcV('n4', -9.8, bcYel)),
];

const bcSimple = (): barchart.BarData[] => [
  bcBar('Mon', bcV('v', 3, bcRed)),
  bcBar('Tue', bcV('v', 7.5, bcGreen)),
  bcBar('Wed', bcV('v', 5.25, bcCyan)),
  bcBar('Thu', bcV('v', 9.9, bcYel)),
  bcBar('Fri', bcV('v', 1.125, bcRed)),
];

const bcDraw = (m: barchart.Model): string => {
  m.draw();
  return m.view();
};

register('barchart/vertical-styled', () => {
  const m = barchart.New(23, 12, barchart.WithDataSet(bcExample()), barchart.WithStyles(bcAxis, bcLabel));
  return bcDraw(m);
});
register('barchart/vertical-simple-labels', () => {
  const m = barchart.New(20, 10, barchart.WithDataSet(bcSimple()), barchart.WithStyles(bcAxis, bcLabel));
  return bcDraw(m);
});
register('barchart/vertical-stacked-positive', () => {
  const m = barchart.New(16, 14, barchart.WithStyles(bcAxis, bcLabel));
  m.pushAll([
    bcBar('a', bcV('x', 4.3, bcRed), bcV('y', 2.7, bcGreen), bcV('z', 1.4, bcCyan)),
    bcBar('b', bcV('x', 1.2, bcRed), bcV('y', 6.6, bcGreen)),
    bcBar('c', bcV('x', 0.4, bcRed), bcV('y', 0.4, bcGreen), bcV('z', 0.4, bcCyan), bcV('w', 0.4, bcYel)),
  ]);
  return bcDraw(m);
});
register('barchart/vertical-negative-stacked', () => {
  const m = barchart.New(16, 14, barchart.WithStyles(bcAxis, bcLabel));
  m.pushAll([
    bcBar('a', bcV('x', 4, bcRed), bcV('y', -3.3, bcGreen), bcV('z', -2.6, bcCyan)),
    bcBar('b', bcV('x', -5.5, bcRed), bcV('y', -1.2, bcGreen)),
    bcBar('c', bcV('x', 2.5, bcRed), bcV('y', 1.9, bcGreen), bcV('z', -0.7, bcCyan)),
  ]);
  return bcDraw(m);
});
register('barchart/vertical-negative-only', () => {
  const m = barchart.New(12, 10, barchart.WithStyles(bcAxis, bcLabel));
  m.pushAll([
    bcBar('p', bcV('x', -2.3, bcRed)),
    bcBar('q', bcV('x', -6.4, bcGreen)),
    bcBar('r', bcV('x', -4.9, bcCyan)),
  ]);
  return bcDraw(m);
});
register('barchart/vertical-no-axis', () => {
  const m = barchart.New(23, 12, barchart.WithNoAxis(), barchart.WithDataSet(bcExample()));
  return bcDraw(m);
});
register('barchart/vertical-fixed-range', () => {
  const m = barchart.New(
    23,
    12,
    barchart.WithDataSet(bcExample()),
    barchart.WithMaxValue(100.0),
    barchart.WithMinValue(-20.0),
    barchart.WithNoAutoMaxValue(),
    barchart.WithNoAxis(),
  );
  return bcDraw(m);
});
register('barchart/vertical-fixed-range-axis', () => {
  const m = barchart.New(
    23,
    12,
    barchart.WithMaxValue(30.0),
    barchart.WithMinValue(-10.0),
    barchart.WithNoAutoMaxValue(),
    barchart.WithBarGap(0),
    barchart.WithStyles(bcAxis, bcLabel),
    barchart.WithDataSet(bcExample()),
  );
  return bcDraw(m);
});
register('barchart/vertical-gap-zero', () => {
  const m = barchart.New(20, 10, barchart.WithBarGap(0), barchart.WithDataSet(bcSimple()));
  return bcDraw(m);
});
register('barchart/vertical-gap-two', () => {
  const m = barchart.New(24, 10, barchart.WithBarGap(2), barchart.WithDataSet(bcSimple().slice(0, 4)), barchart.WithStyles(bcAxis, bcLabel));
  return bcDraw(m);
});
register('barchart/vertical-fixed-bar-width', () => {
  const m = barchart.New(24, 10, barchart.WithNoAutoBarWidth(), barchart.WithBarWidth(3), barchart.WithDataSet(bcSimple()));
  return bcDraw(m);
});
register('barchart/vertical-label-truncated', () => {
  const m = barchart.New(15, 8, barchart.WithStyles(bcAxis, bcLabel));
  m.pushAll([
    bcBar('alpha', bcV('v', 3, bcRed)),
    bcBar('bravo', bcV('v', 6, bcGreen)),
    bcBar('charlie', bcV('v', 4.5, bcCyan)),
  ]);
  return bcDraw(m);
});
register('barchart/vertical-unicode-label', () => {
  // labels are cut by bytes upstream: a multi-byte rune can be split
  const m = barchart.New(14, 8, barchart.WithStyles(bcAxis, bcLabel));
  m.pushAll([
    bcBar('héllo', bcV('v', 3, bcRed)),
    bcBar('日本語', bcV('v', 6, bcGreen)),
    bcBar('ñ', bcV('v', 4.5, bcCyan)),
  ]);
  return bcDraw(m);
});
register('barchart/vertical-fractions', () => {
  const m = barchart.New(18, 6, barchart.WithMaxValue(8));
  for (let i = 0; i < 9; i++) m.push(bcBar(String(i), bcV('v', i + i / 9, bcGreen)));
  return bcDraw(m);
});
register('barchart/vertical-auto-max-grows', () => {
  const m = barchart.New(20, 10, barchart.WithStyles(bcAxis, bcLabel));
  m.push(bcBar('a', bcV('v', 2, bcRed)));
  m.push(bcBar('b', bcV('v', 4, bcGreen)));
  const first = bcDraw(m);
  m.push(bcBar('c', bcV('v', 40, bcCyan)));
  return `${first}\n--\n${bcDraw(m)}\nmax=${m.maxValue()} min=${m.minValue()} scale=${m.scale()}`;
});
register('barchart/vertical-more-bars-than-width', () => {
  const m = barchart.New(7, 6, barchart.WithDataSet(bcSimple()));
  return bcDraw(m);
});
register('barchart/vertical-resize', () => {
  const m = barchart.New(20, 10, barchart.WithStyles(bcAxis, bcLabel), barchart.WithDataSet(bcSimple().slice(0, 3)));
  let out = bcDraw(m);
  m.resize(12, 7);
  out += '\n--\n' + bcDraw(m);
  m.resize(30, 14);
  out += '\n--\n' + bcDraw(m);
  return out;
});
register('barchart/vertical-clear-repush', () => {
  const m = barchart.New(20, 10, barchart.WithDataSet(bcExample()));
  m.clear();
  m.pushAll(bcSimple().slice(0, 2));
  return bcDraw(m);
});
register('barchart/vertical-tiny', () => {
  const m = barchart.New(3, 3, barchart.WithDataSet(bcSimple().slice(0, 2)));
  return bcDraw(m);
});
register('barchart/horizontal-styled', () => {
  const m = barchart.New(40, 8, barchart.WithHorizontalBars(), barchart.WithDataSet(bcExample()), barchart.WithStyles(bcAxis, bcLabel));
  return bcDraw(m);
});
register('barchart/horizontal-simple-labels', () => {
  const m = barchart.New(30, 5, barchart.WithHorizontalBars(), barchart.WithDataSet(bcSimple()), barchart.WithStyles(bcAxis, bcLabel));
  return bcDraw(m);
});
register('barchart/horizontal-negative', () => {
  const m = barchart.New(36, 6, barchart.WithHorizontalBars(), barchart.WithStyles(bcAxis, bcLabel));
  m.pushAll([
    bcBar('up', bcV('x', 8.4, bcRed), bcV('y', -3.2, bcGreen)),
    bcBar('down', bcV('x', -9.9, bcCyan)),
    bcBar('both', bcV('x', 4.4, bcYel), bcV('y', 2.2, bcRed), bcV('z', -5.6, bcGreen), bcV('w', -1.1, bcCyan)),
  ]);
  m.resize(36, 6);
  return bcDraw(m);
});
register('barchart/horizontal-no-axis', () => {
  const m = barchart.New(30, 6, barchart.WithHorizontalBars(), barchart.WithNoAxis(), barchart.WithDataSet(bcExample()));
  return bcDraw(m);
});
register('barchart/horizontal-long-labels', () => {
  const m = barchart.New(34, 4, barchart.WithHorizontalBars(), barchart.WithStyles(bcAxis, bcLabel));
  m.pushAll([
    bcBar('short', bcV('v', 3, bcRed)),
    bcBar('a rather long label', bcV('v', 5, bcGreen)),
    bcBar('mid label', bcV('v', 4, bcCyan)),
  ]);
  m.resize(34, 4);
  return bcDraw(m);
});
register('barchart/horizontal-stale-label-width', () => {
  // the label column is only recomputed on Resize/SetHorizontal/SetShowAxis,
  // so a label pushed afterwards is cut to the old width
  const m = barchart.New(30, 3, barchart.WithHorizontalBars(), barchart.WithStyles(bcAxis, bcLabel));
  m.push(bcBar('ab', bcV('v', 3, bcRed)));
  m.resize(30, 3);
  m.push(bcBar('abcdefgh', bcV('v', 4, bcGreen)));
  return bcDraw(m);
});
register('barchart/horizontal-fixed-range', () => {
  const m = barchart.New(
    32,
    6,
    barchart.WithHorizontalBars(),
    barchart.WithMaxValue(50),
    barchart.WithMinValue(-30),
    barchart.WithNoAutoMaxValue(),
    barchart.WithBarGap(0),
    barchart.WithStyles(bcAxis, bcLabel),
    barchart.WithDataSet(bcSimple().slice(0, 4)),
  );
  m.resize(32, 6);
  return bcDraw(m);
});
register('barchart/toggle-orientation', () => {
  const m = barchart.New(28, 8, barchart.WithDataSet(bcExample()), barchart.WithStyles(bcAxis, bcLabel));
  let out = bcDraw(m);
  m.setHorizontal(true);
  out += '\n--\n' + bcDraw(m);
  m.setShowAxis(false);
  out += '\n--\n' + bcDraw(m);
  m.setHorizontal(false);
  return out + '\n--\n' + bcDraw(m);
});
register('barchart/hit-map', () => {
  let sb = '';
  for (const horizontal of [false, true]) {
    const m = barchart.New(15, 9, barchart.WithDataSet(bcExample().slice(0, 3)));
    if (horizontal) {
      m.setHorizontal(true);
      m.resize(15, 9);
    }
    m.draw();
    for (let y = -1; y <= m.height(); y++) {
      for (let x = -1; x <= m.width(); x++) {
        const d = m.barDataFromPoint({ x, y });
        sb += `${x},${y}=${d.label}[${d.values.map((v) => v.name).join('+')}] `;
      }
      sb += '\n';
    }
  }
  return sb;
});
register('barchart/viewport-update', () => {
  const m = barchart.New(20, 8, barchart.WithDataSet(bcSimple().slice(0, 4)), barchart.WithStyles(bcAxis, bcLabel));
  m.draw();
  m.canvas.viewWidth = 8;
  m.canvas.viewHeight = 5;
  m.canvas.focus();
  const out = m.view();
  for (const k of ['right', 'right', 'down', 'l']) m.update({ _tag: 'KeyPressMsg', toString: () => k });
  return out + '\n--\n' + m.view();
});
