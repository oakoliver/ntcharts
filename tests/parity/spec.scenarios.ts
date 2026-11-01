// The spec scenarios are JSON specs shared with the Go twin
// (tests/parity/go/spec.go) through tests/testdata/spec/scenarios.json, so
// both sides build exactly the same text.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sprintV } from '../../src/internal/format.js';
import { pow10 } from '../../src/internal/gomath.js';
import { FormatFloat, Quote, jsonFloat } from '../../src/internal/strconv.js';
import * as spec from '../../src/spec/index.js';
import { register } from './registry.js';

interface SpecScenario {
  spec: spec.Spec;
  resize?: [number, number][];
  update?: [number, number][];
}

const all: Record<string, SpecScenario> = JSON.parse(
  readFileSync(join(import.meta.dir, '..', 'testdata', 'spec', 'scenarios.json'), 'utf8'),
);
// Go sorts with sort.Strings: byte order
const names = Object.keys(all).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const winSize = (width: number, height: number) => ({ _tag: 'WindowSizeMsg', width, height });

function specRender(sc: SpecScenario): string {
  let built: spec.BuildResult;
  try {
    built = spec.Build(sc.spec);
  } catch (e) {
    return 'error: ' + (e as Error).message;
  }
  const views: string[] = [];
  for (const [w, h] of sc.resize ?? []) {
    if (built instanceof spec.CategoricalModel || built instanceof spec.ComboModel || built instanceof spec.OHLCModel) {
      built.resize(w, h);
    }
    views.push(built.view());
  }
  for (const [w, h] of sc.update ?? []) {
    if (built instanceof spec.CategoricalModel || built instanceof spec.ComboModel || built instanceof spec.OHLCModel) {
      [built] = built.update(winSize(w, h));
    }
    views.push(built.view());
  }
  if (views.length === 0) return built.view();
  return views.join('\n----\n');
}

const errs: string[] = [];
for (const name of names) {
  const sc = all[name];
  if (name.startsWith('err-')) {
    errs.push(name);
    continue;
  }
  register('spec/' + name, () => specRender(sc));
}
register('spec/errors', () => errs.map((name) => `${name}: ${specRender(all[name])}\n`).join(''));

// Every scenario spec re-marshaled as encoding/json does.
register('spec/marshal-json', () =>
  names
    .map((name) => {
      try {
        return `${name}: ${spec.MarshalJSON(all[name].spec)}\n`;
      } catch (e) {
        return `${name}: marshal: ${(e as Error).message}\n`;
      }
    })
    .join(''),
);

register('spec/marshal-json-edge', () => {
  const s = {
    type: spec.ChartTypeScatter,
    title: '<b>&"quotes" </b>\x01\t',
    width: 1,
    height: 2,
    x_axis: { labels: [], format: { precision: 3 } },
    y_axis: { min: -0, labels: ['é', '日本'] },
    y2_axis: {},
    data: {
      x_axis_data: [1e21, 1e-7, 123456789.0, 0.000001, -2.5, 's', null, true],
      series: [
        { name: 'a', values: [{ x: 0, y: 1e20 }, { y: 5e-324 }, { x: 1.5e300, y: -1e-6 }] },
        { name: 'b', values: [], ohlc: [{ t: null, o: 1, h: 0, l: 0, c: 0 }, { t: 12, o: 0, h: 0, l: 0, c: 0, v: -0 }] },
        { name: 'c' },
      ],
    },
    heat: { matrix: [null, [], [1, 2]], cells: [] },
    options: {},
    theme: { palette: [] },
  } as unknown as spec.Spec;
  try {
    return spec.MarshalJSON(s);
  } catch (e) {
    return (e as Error).message;
  }
});

const precOf = (f: spec.Format): number => f.precision ?? -1;

register('spec/format-value', () => {
  const formats: spec.Format[] = [
    {},
    { kind: 'number' },
    { kind: 'number', precision: 0 },
    { kind: 'number', precision: 3 },
    { kind: 'percent' },
    { kind: 'percent', precision: 2 },
    { kind: 'currency' },
    { kind: 'currency', currency: '€', precision: 1 },
    { kind: 'si' },
    { kind: 'si', precision: 0 },
    { kind: 'si', precision: 3 },
    { kind: 'time' },
  ];
  const values = [
    0, -0, 1, -1, 0.5, 1.5, 2.5, -2.5, 0.125, 0.375, 12.5, 999, 999.95, 1000, 12500, -2500000000, 3.4e6, 1e12, 1.2345e15, 1e21,
    1e22, 1e-7, 123456.789, 0.1 + 0.2, 1767225600000, -1767225600000.5, 1e300, Infinity, -Infinity, NaN,
  ];
  let b = '';
  for (const f of formats) {
    for (const v of values) {
      b += `${f.kind ?? ''}/${precOf(f)}/${f.currency ?? ''} ${sprintV(v)} => ${spec.FormatValue(f, v)}\n`;
    }
  }
  return b;
});

register('spec/format-time-layouts', () => {
  const layouts = [
    '2006-01-02',
    '2006-01',
    'Jan',
    'Jan 02',
    'January 2, 2006',
    'Mon Jan _2 15:04:05 2006',
    'Monday 02/01/06 3:04PM',
    '15:04:05.000',
    '15:04:05.999',
    '15:04:05.000000',
    '15:04:05,000',
    '3:4:5 pm',
    '03 PM',
    '2006-01-02T15:04:05Z07:00',
    '2006-01-02T15:04:05.999999999Z07:00',
    '-0700 -07:00 -07 Z0700 Z07 MST',
    '002 __2 _2',
    '06 1 2',
    '.9 .99 .00',
    'literal text',
    '',
    'Mon Monday Jan January',
    '05 5 04 4 15 3 03',
    'Z07:00:00 -07:00:00',
  ];
  const times = [0, 1767225600000, 1767225599999, 1735738512345, 951782400123, -86400001, 4102444800000, 1e14];
  let b = '';
  for (const l of layouts) {
    const f = { kind: 'time', layout: l };
    for (const v of times) b += `${Quote(l)} ${sprintV(v)} => ${Quote(spec.FormatValue(f, v))}\n`;
  }
  return b;
});

register('spec/point-time', () => {
  const inputs: unknown[] = [
    '2026-01-05',
    '2026-1-05',
    '2026-01-5',
    '2026-02-29',
    '2024-02-29',
    '0000-01-01',
    '9999-12-31',
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:00:00.123Z',
    '2026-01-01T00:00:00.123456789Z',
    '2026-01-01T00:00:00.1234567891Z',
    '2026-01-01T00:00:00,5Z',
    '2026-01-01T00:00:00.Z',
    '2026-01-01T00:00:00+01:00',
    '2026-01-01T00:00:00-07:30',
    '2026-01-01T00:00:00+24:00',
    '2026-01-01T00:00:00+01:60',
    '2026-01-01T00:00:00+0100',
    '2026-01-01T00:00:00',
    '2026-01-01 00:00:00Z',
    '2026-01-01t00:00:00z',
    '2026-01-01T5:04:05Z',
    '2026-01-01T24:00:00Z',
    '2026-01-01T23:59:60Z',
    '2026-01-01T23:59:59.999999999999Z',
    '2026-01-01T00:00:00Z ',
    ' 2026-01-01',
    '2026-01-01x',
    '2026-01-01T00:00:00.5-00:00',
    '1969-12-31T23:59:59.9995Z',
    '2026-1-1T00:00:00Z',
    '+2026-01-01',
    '',
    'now',
    0,
    1767225600000.9,
    -1.5,
    1e15,
    true,
    null,
  ];
  let b = '';
  for (const input of inputs) {
    const [t, ok] = spec.PointTime(input);
    const desc = typeof input === 'string' ? Quote(input) : typeof input === 'number' ? sprintV(input) : input === null ? '<nil>' : String(input);
    b += ok ? `${desc} => ${t.getTime()}\n` : `${desc} => false ${t.getTime()}\n`;
  }
  return b;
});

register('spec/derive-and-resolve', () => {
  let b = '';
  for (const name of names) {
    const s = all[name].spec;
    if (s.type === spec.ChartTypeBar) {
      const labels = spec.DeriveBarLabels(s.data);
      b += `${name} labels [${labels.map(Quote).join(' ')}] combo ${spec.IsCategoricalCombo(s)}\n`;
    }
    if (!spec.IsCategoricalCombo(s)) continue;
    try {
      spec.Validate(s);
    } catch {
      continue;
    }
    let c: spec.CategoricalCombo;
    try {
      c = spec.ResolveCategoricalCombo(s);
    } catch (e) {
      b += `${name} resolve error: ${(e as Error).message}\n`;
      continue;
    }
    const vals = (v: (number | null)[]) => v.map((p) => (p === null ? 'nil' : sprintV(p))).join(',');
    b +=
      `${name} labels [${c.labels.map(Quote).join(' ')}] bars ${vals(c.bars)} line ${vals(c.line)} idx ${c.barIndex}/${c.lineIndex} ` +
      `range ${sprintV(c.min)}..${sprintV(c.max)} right ${sprintV(c.min2)}..${sprintV(c.max2)} colours ` +
      `${spec.ComboSeriesColor(s, c.barIndex)} ${spec.ComboSeriesColor(s, c.lineIndex)}\n`;
  }
  return b;
});

// specFloats is a deterministic spread of float64s: exact ties, powers of
// ten, subnormals, huge and tiny values.
function specFloats(): number[] {
  const vs = [
    0, 1, 0.5, 1.5, 2.5, 0.125, 0.375, 1.005, 2.675, 1e23, 5e-324, 1.7976931348623157e308, 123456789.125, 0.1, 0.2, 9.995, 99.95,
    999999.5, 1e21, 1e-7, 4.35, 0.045, 1.25e-5,
  ];
  let a = 12345;
  for (let k = 0; k < 120; k++) {
    a = (a * 7919 + 13) % 1000003;
    let v = (a / 1024) * pow10((k % 40) - 20);
    if (k % 3 === 0) v = -v;
    vs.push(v);
  }
  return vs;
}

register('spec/strconv-format-float', () => {
  let b = '';
  for (const v of specFloats()) {
    b += `${sprintV(v)}:`;
    for (const p of [-1, 0, 1, 2, 3, 6, 9]) {
      b += ` e${p}=${FormatFloat(v, 'e', p)} f${p}=${FormatFloat(v, 'f', p)} g${p}=${FormatFloat(v, 'g', p)}`;
    }
    b += ` json=${jsonFloat(v)}\n`;
  }
  return b;
});

register('spec/strconv-quote', () => {
  let b = '';
  for (const s of [
    '',
    'plain',
    'tab\there',
    'quote"back\\slash',
    '\x07\b\f\n\r\v\x00\x1f\x7f',
    '\u00e9\u65e5\u672c\u8a9e',
    '\u00ad\u200b\u2028\ufeff',
    '\u{1F600}\u{1F1F5}\u{1F1F9}',
    '\u{1F9FF}\u{E0001}',
    '<&>',
    '\u0085\u00a0',
  ]) {
    b += `${Quote(s)} ${Quote(s)}\n`;
  }
  return b;
});
