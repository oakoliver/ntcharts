/**
 * barchart.ts: three bar charts fed the same stacked, partly negative data.
 * Port of upstream examples/barchart/{vertical,horizontal}.
 *
 *   bun examples/barchart.ts               vertical bars
 *   bun examples/barchart.ts --horizontal  horizontal bars
 *
 * Click a bar segment to see its values. q quits.
 */
import { NewProgram, NewView, Quit, MouseMode, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import { newStyle, normalBorder, joinHorizontal, joinVertical, Top, Left } from '@oakoliver/lipgloss';
import * as zone from '@oakoliver/bubblezone';
import { barchart, runes } from '../src/index.js';

const horizontal = process.argv.includes('--horizontal');

const box = newStyle().borderStyle(normalBorder()).borderForeground(63); // purple
const axisStyle = newStyle().foreground(3); // yellow
const labelStyle = newStyle().foreground(63); // purple
const block = (c: number) => newStyle().foreground(c).background(c);
const [red, green, cyan, yellow] = [block(9), block(2), block(6), block(3)];

// negative values stack away from the axis in the opposite direction
const values: barchart.BarData[] = [
  { label: 'A', values: [{ name: 'Name1', value: 21.2, style: red }, { name: 'Name2', value: 10.1, style: green }, { name: 'Name3', value: 6.5, style: cyan }, { name: 'Name4', value: 7.7, style: yellow }] },
  { label: 'B', values: [{ name: 'Name1', value: 15.1, style: red }, { name: 'Name2', value: 15.1, style: green }, { name: 'Name3', value: 3.3, style: cyan }, { name: 'Name4', value: -7.7, style: yellow }] },
  { label: 'C', values: [{ name: 'Name1', value: 13.6, style: red }, { name: 'Name2', value: 14.1, style: green }, { name: 'Name3', value: -4.4, style: cyan }, { name: 'Name4', value: 4.4, style: yellow }] },
  { label: 'D', values: [{ name: 'Name1', value: 13.1, style: red }, { name: 'Name2', value: 11.1, style: green }, { name: 'Name3', value: 10.9, style: cyan }, { name: 'Name4', value: -9.8, style: yellow }] },
];

const title = (m: barchart.Model) =>
  `Max:${m.maxValue().toFixed(1)}, Min:${m.minValue().toFixed(1)}, AutoMax:${m.autoMaxValue}\nBarGap:${m.barGap()}, ShowAxis:${m.showAxis()}\n`;

const legend = (bd: barchart.BarData) =>
  'Legend\n' + bd.values.map((bv) => '\n' + (bv.style ?? newStyle()).render(`${runes.FullBlock} ${bv.name}`)).join('');

const totals = () =>
  'Totals\n' + values.map((bd) => `\n${bd.label} ${bd.values.reduce((s, v) => s + v.value, 0).toFixed(1)}`).join('');

class BarModel implements Model {
  selected: barchart.BarData = { label: '', values: [] };
  constructor(public charts: barchart.Model[], public zm: zone.Manager) {
    for (const c of charts) c.draw();
  }

  init(): Cmd {
    return null;
  }

  update(msg: Msg): [Model, Cmd] {
    if (msg?._tag === 'KeyPressMsg' && ['q', 'ctrl+c'].includes(msg.toString())) return [this, Quit];
    if (msg?._tag === 'MouseClickMsg') {
      for (const c of this.charts) {
        const z = this.zm.get(c.zoneID());
        if (z?.inBounds(msg)) {
          const [x, y] = z.pos(msg);
          this.selected = c.barDataFromPoint({ x, y });
        }
      }
    }
    return [this, null];
  }

  view(): View {
    const picked = this.selected.values.map((bv) => (bv.style ?? newStyle()).render(bv.value.toFixed(1))).join(' ');
    const [c1, c2, c3] = this.charts;
    const s =
      `Same data values are pushed to all ${horizontal ? 'horizontal' : 'vertical'} bar charts, q/ctrl+c to quit\n` +
      'Click bar segment to select and display values\n' +
      joinHorizontal(Top,
        box.render(title(c1) + c1.view()),
        box.render(title(c2) + c2.view()),
        box.render(title(c3) + c3.view()),
        joinVertical(Left,
          joinHorizontal(Top, box.render(totals()), box.render(legend(values[0]))),
          box.render('Selected\n' + (picked ? this.selected.label + ' ' + picked : ''))));
    const v = NewView(this.zm.scan(s)); // call the zone manager's scan() at the root model
    v.altScreen = true;
    v.mouseMode = MouseMode.CellMotion;
    return v;
  }
}

function build(zm: zone.Manager): BarModel {
  const [w, h] = [23, 12];
  const dir = horizontal ? [barchart.WithHorizontalBars()] : [];
  return new BarModel(
    [
      barchart.New(w, h, barchart.WithZoneManager(zm), barchart.WithDataSet(values), barchart.WithStyles(axisStyle, labelStyle), ...dir),
      barchart.New(w, h, barchart.WithZoneManager(zm), barchart.WithDataSet(values), barchart.WithMaxValue(100), barchart.WithMinValue(-20), barchart.WithNoAutoMaxValue(), barchart.WithNoAxis(), ...dir),
      barchart.New(w, h, barchart.WithZoneManager(zm), barchart.WithDataSet(values), barchart.WithMaxValue(30), barchart.WithMinValue(-10), barchart.WithNoAutoMaxValue(), barchart.WithBarGap(0), ...dir),
    ],
    zm,
  );
}

await NewProgram(build(zone.New())).run();
