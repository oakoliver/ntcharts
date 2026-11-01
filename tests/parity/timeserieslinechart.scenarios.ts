import { newStyle, type Style } from '@oakoliver/lipgloss';
import * as runes from '../../src/canvas/runes/runes.js';
import { sprintfF, sprintV } from '../../src/internal/format.js';
import * as linechart from '../../src/linechart/index.js';
import * as tslc from '../../src/linechart/timeserieslinechart/index.js';
import { register } from './registry.js';

const tsFg = (c: string): Style => newStyle().foreground(c);
const tsKey = (k: string) => ({ _tag: 'KeyPressMsg', toString: () => k });
const tsWheel = (button: number) => ({ _tag: 'MouseWheelMsg', x: 0, y: 0, button });

const SEC = 1e3;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const add = (t: Date, ms: number) => new Date(t.getTime() + ms);
const tsDay0 = new Date(Date.UTC(2026, 2, 1));

// tsSeries returns n points of a deterministic zigzag around base.
function tsSeries(n: number, start: Date, step: number, base: number, amp: number): tslc.TimePoint[] {
  const r: tslc.TimePoint[] = [];
  for (let i = 0; i < n; i++) {
    const v = base + (amp * (((i * 7) % 11) - 5)) / 5;
    r.push({ time: add(start, i * step), value: v });
  }
  return r;
}

// tsCandles pushes n daily OHLC candles.
function tsCandles(m: tslc.Model, n: number, start: Date): void {
  let price = 100.0;
  for (let i = 0; i < n; i++) {
    const ts = add(start, i * DAY);
    const move = (((i * 5) % 9) - 4) * 1.5;
    const open = price;
    const close = price + move;
    const high = Math.max(open, close) + (i % 3) + 0.5;
    const low = Math.min(open, close) - ((i + 1) % 3) - 0.5;
    m.pushDataSet('open', { time: ts, value: open });
    m.pushDataSet('high', { time: ts, value: high });
    m.pushDataSet('low', { time: ts, value: low });
    m.pushDataSet('close', { time: ts, value: close });
    price = close;
  }
}

// upstream examples/linechart/timeseries
register('timeserieslinechart/timeseries_styled', () => {
  const m = tslc.New(
    44,
    14,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 29 * DAY)),
    tslc.WithYRange(0, 100),
    tslc.WithAxesStyles(tsFg('3'), tsFg('6')),
    tslc.WithStyle(tsFg('4')),
    tslc.WithTimeSeries(tsSeries(30, tsDay0, DAY, 50, 40)),
  );
  m.draw();
  return m.view();
});

register('timeserieslinechart/multi_styles', () => {
  const m = tslc.New(
    44,
    12,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 19 * DAY)),
    tslc.WithYRange(0, 20),
    tslc.WithLineStyle(runes.ThinLineStyle),
    tslc.WithDataSetStyle('b', tsFg('9')),
    tslc.WithDataSetLineStyle('b', runes.ArcLineStyle),
    tslc.WithDataSetTimeSeries('a', tsSeries(20, tsDay0, DAY, 6, 5)),
    tslc.WithDataSetTimeSeries('b', tsSeries(20, tsDay0, DAY, 14, 4)),
  );
  m.setDataSetStyle('a', tsFg('2'));
  m.drawAll();
  return m.view();
});

register('timeserieslinechart/braille_styled', () => {
  const m = tslc.New(
    44,
    12,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 19 * DAY)),
    tslc.WithYRange(0, 20),
    tslc.WithDataSetStyle('a', tsFg('2')),
    tslc.WithDataSetStyle('b', tsFg('5')),
    tslc.WithDataSetTimeSeries('a', tsSeries(20, tsDay0, DAY, 6, 5)),
    tslc.WithDataSetTimeSeries('b', tsSeries(20, tsDay0, DAY, 14, 4)),
  );
  m.drawBrailleAll();
  return m.view();
});

register('timeserieslinechart/many_points_average', () => {
  const m = tslc.New(30, 10, tslc.WithTimeRange(tsDay0, add(tsDay0, 10 * DAY)), tslc.WithYRange(0, 10));
  for (let i = 0; i <= 240; i++) m.push({ time: add(tsDay0, i * HOUR), value: ((i * 13) % 11) - 0.25 });
  m.draw();
  return m.view();
});

register('timeserieslinechart/candles_styled', () => {
  const m = tslc.New(44, 14, tslc.WithTimeRange(tsDay0, add(tsDay0, 15 * DAY)), tslc.WithYRange(85, 115));
  tsCandles(m, 16, tsDay0);
  m.drawCandle('open', 'high', 'low', 'close', tsFg('10'), tsFg('9'));
  return m.view();
});

register('timeserieslinechart/candles_wide', () => {
  const m = tslc.New(60, 14, tslc.WithTimeRange(tsDay0, add(tsDay0, 9 * DAY)), tslc.WithYRange(85, 115));
  tsCandles(m, 10, tsDay0);
  m.drawCandleWithOpts('open', 'high', 'low', 'close', tsFg('10'), tsFg('9'), { width: 3 });
  return m.view();
});

register('timeserieslinechart/candles_block_even', () => {
  const m = tslc.New(60, 14, tslc.WithTimeRange(tsDay0, add(tsDay0, 9 * DAY)), tslc.WithYRange(85, 115));
  tsCandles(m, 10, tsDay0);
  m.drawCandleWithOpts('open', 'high', 'low', 'close', tsFg('10'), tsFg('9'), { width: 4, block: true, snapTimeBounds: true });
  return m.view();
});

register('timeserieslinechart/candles_missing_sets', () => {
  const m = tslc.New(30, 8, tslc.WithTimeRange(tsDay0, add(tsDay0, 4 * DAY)), tslc.WithYRange(85, 115));
  tsCandles(m, 5, tsDay0);
  m.drawXYAxisAndLabel();
  m.drawCandle('open', 'high', 'low', 'nope', tsFg('10'), tsFg('9')); // no-op
  return m.view();
});

register('timeserieslinechart/hour_formatter_keys', () => {
  const start = new Date(Date.UTC(2026, 2, 1, 9));
  let m = tslc.New(
    48,
    12,
    tslc.WithTimeRange(start, add(start, 12 * HOUR)),
    tslc.WithYRange(0, 50),
    tslc.WithXLabelFormatter(tslc.HourTimeLabelFormatter()),
    tslc.WithUpdateHandler(tslc.HourUpdateHandler(1)),
    tslc.WithXYSteps(10, 2),
    tslc.WithTimeSeries(tsSeries(49, start, 15 * MIN, 25, 20)),
  );
  m.focus();
  for (const k of ['pgup', 'pgup', 'right', 'right', 'left']) [m] = m.update(tsKey(k));
  m.draw();
  return m.view();
});

register('timeserieslinechart/date_nozoom_wheel', () => {
  let m = tslc.New(
    44,
    10,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 29 * DAY)),
    tslc.WithYRange(0, 100),
    tslc.WithUpdateHandler(tslc.DateNoZoomUpdateHandler(2)),
    tslc.WithTimeSeries(tsSeries(30, tsDay0, DAY, 50, 40)),
  );
  m.setViewTimeRange(add(tsDay0, 5 * DAY), add(tsDay0, 15 * DAY));
  m.focus();
  [m] = m.update(tsWheel(5));
  [m] = m.update(tsWheel(5));
  [m] = m.update(tsWheel(4));
  m.drawBraille();
  return m.view();
});

register('timeserieslinechart/second_handlers', () => {
  const start = new Date(1_700_000_000 * SEC);
  let m = tslc.New(
    44,
    10,
    tslc.WithTimeRange(start, add(start, 60 * SEC)),
    tslc.WithYRange(-10, 10),
    tslc.WithXLabelFormatter(tslc.HourTimeLabelFormatter()),
    tslc.WithXYSteps(12, 2),
    tslc.WithUpdateHandler(tslc.SecondUpdateHandler(5)),
    tslc.WithTimeSeries(tsSeries(61, start, SEC, 0, 9)),
  );
  m.focus();
  [m] = m.update(tsWheel(4));
  m.updateHandler = tslc.SecondNoZoomUpdateHandler(3);
  [m] = m.update(tsKey('left'));
  m.updateHandler = tslc.DateUpdateHandler(1);
  [m] = m.update(tsKey('right')); // a day: clamps at the end
  m.updateHandler = tslc.HourNoZoomUpdateHandler(1);
  [m] = m.update(tsKey('left'));
  m.draw();
  return m.view();
});

register('timeserieslinechart/log_scale', () => {
  const m = tslc.New(
    44,
    12,
    tslc.WithYScale(linechart.ScaleLog),
    tslc.WithTimeRange(tsDay0, add(tsDay0, 11 * DAY)),
    tslc.WithYRange(1, 1e5),
    tslc.WithStyle(tsFg('4')),
  );
  [2, 9, 40, 0, 300, 1200, 800, 5000, -2, 30000, 60000, 1e5].forEach((v, i) => m.push({ time: add(tsDay0, i * DAY), value: v }));
  m.draw();
  const a = m.view();
  m.drawBraille();
  return a + '\n--\n' + m.view();
});

register('timeserieslinechart/y2_lines_braille', () => {
  const m = tslc.New(
    48,
    12,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 15 * DAY)),
    tslc.WithYRange(0, 30),
    tslc.WithY2Axis({ min: 0, max: 3000, labelStyle: tsFg('1') }),
    tslc.WithDataSetYAxis('vol', linechart.YAxisRight),
    tslc.WithDataSetStyle('vol', tsFg('1')),
    tslc.WithDataSetTimeSeries('px', tsSeries(16, tsDay0, DAY, 15, 12)),
    tslc.WithDataSetTimeSeries('vol', tsSeries(16, tsDay0, DAY, 1500, 1200)),
  );
  m.drawAll();
  const a = m.view();
  m.drawBrailleAll();
  return a + '\n--\n' + m.view();
});

register('timeserieslinechart/y2_log_candles', () => {
  const m = tslc.New(
    48,
    14,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 9 * DAY)),
    tslc.WithYRange(85, 115),
    tslc.WithY2Axis({ min: 10, max: 1e5, scale: linechart.ScaleLog }),
    tslc.WithDataSetYAxis('vol', linechart.YAxisRight),
  );
  tsCandles(m, 10, tsDay0);
  m.drawCandleWithOpts('open', 'high', 'low', 'close', tsFg('10'), tsFg('9'), { width: 2 });
  return m.view();
});

register('timeserieslinechart/fit_include_zero', () => {
  const m = tslc.New(
    44,
    12,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 19 * DAY)),
    tslc.WithTimeSeries(tsSeries(20, tsDay0, DAY, 60, 25)),
    tslc.WithDataSetTimeSeries('other', tsSeries(20, tsDay0, DAY, 500, 300)),
  );
  m.setViewTimeRange(add(tsDay0, 3 * DAY), add(tsDay0, 12 * DAY));
  m.fitYToViewWithOpts({ dataSets: [tslc.DefaultDataSetName], includeZero: true });
  m.drawAll();
  return m.view() + `\n${sprintV(m.minY())} ${sprintV(m.maxY())} ${sprintV(m.viewMinY())} ${sprintV(m.viewMaxY())}`;
});

register('timeserieslinechart/fit_constant_log', () => {
  const m = tslc.New(40, 10, tslc.WithYScale(linechart.ScaleLog), tslc.WithTimeRange(tsDay0, add(tsDay0, 5 * DAY)));
  for (let i = 0; i < 6; i++) m.push({ time: add(tsDay0, i * DAY), value: 40 });
  m.fitYToView();
  m.draw();
  return m.view() + `\n${sprintV(m.viewMinY())} ${sprintV(m.viewMaxY())}`;
});

register('timeserieslinechart/trim_before', () => {
  const m = tslc.New(
    40,
    10,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 19 * DAY)),
    tslc.WithYRange(0, 100),
    tslc.WithTimeSeries(tsSeries(20, tsDay0, DAY, 50, 40)),
  );
  const n = m.trimBefore(add(tsDay0, 8 * DAY));
  m.draw();
  return m.view() + `\n${n}`;
});

register('timeserieslinechart/column_background', () => {
  const m = tslc.New(
    40,
    10,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 9 * DAY)),
    tslc.WithYRange(0, 100),
    tslc.WithStyle(tsFg('4')),
    tslc.WithTimeSeries(tsSeries(10, tsDay0, DAY, 50, 40)),
  );
  m.draw();
  const hl = newStyle().background('236');
  m.setColumnBackgroundStyle(add(tsDay0, 3 * DAY), hl);
  m.setColumnBackgroundStyle(add(tsDay0, 7 * DAY), hl);
  m.setColumnBackgroundStyle(add(tsDay0, 30 * DAY), hl); // outside: ignored
  return m.view();
});

register('timeserieslinechart/resize_and_view', () => {
  const m = tslc.New(
    30,
    9,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 19 * DAY)),
    tslc.WithYRange(0, 100),
    tslc.WithTimeSeries(tsSeries(20, tsDay0, DAY, 50, 40)),
  );
  m.draw();
  const before = m.view();
  m.resize(50, 13);
  m.setViewTimeAndYRange(add(tsDay0, 2 * DAY), add(tsDay0, 14 * DAY), 20, 80);
  m.draw();
  return before + '\n--\n' + m.view();
});

register('timeserieslinechart/axes_variants', () => {
  const mk = (x: number, y: number) => {
    const m = tslc.New(
      36,
      9,
      tslc.WithTimeRange(tsDay0, add(tsDay0, 9 * DAY)),
      tslc.WithYRange(0, 100),
      tslc.WithXYSteps(x, y),
      tslc.WithYLabelFormatter((_i, v) => '$' + sprintfF(v, 0)),
      tslc.WithTimeSeries(tsSeries(10, tsDay0, DAY, 50, 40)),
    );
    m.draw();
    return m.view();
  };
  return mk(0, 2) + '\n--\n' + mk(6, 0) + '\n--\n' + mk(0, 0) + '\n--\n' + mk(8, 4);
});

register('timeserieslinechart/year_boundary_labels', () => {
  const start = new Date(Date.UTC(2025, 11, 20));
  const m = tslc.New(
    60,
    9,
    tslc.WithTimeRange(start, add(start, 30 * DAY)),
    tslc.WithYRange(0, 10),
    tslc.WithXYSteps(8, 2),
    tslc.WithTimeSeries(tsSeries(31, start, DAY, 5, 4)),
  );
  m.draw();
  return m.view();
});

register('timeserieslinechart/clear_data', () => {
  const m = tslc.New(
    36,
    9,
    tslc.WithTimeRange(tsDay0, add(tsDay0, 9 * DAY)),
    tslc.WithYRange(0, 100),
    tslc.WithTimeSeries(tsSeries(10, tsDay0, DAY, 50, 40)),
    tslc.WithDataSetTimeSeries('x', tsSeries(10, tsDay0, DAY, 20, 10)),
  );
  m.clearDataSet('x');
  m.drawAll();
  const a = m.view();
  m.clearAllData();
  m.push({ time: add(tsDay0, DAY), value: 30 });
  m.push({ time: add(tsDay0, 5 * DAY), value: 70 });
  m.drawAll();
  return a + '\n--\n' + m.view();
});

register('timeserieslinechart/with_linechart_auto', () => {
  const lc = linechart.New(
    40,
    10,
    tsDay0.getTime() / 1e3,
    add(tsDay0, DAY).getTime() / 1e3,
    0,
    1,
    linechart.WithXYSteps(5, 2),
    linechart.WithAutoXYRange(),
    linechart.WithXLabelFormatter(tslc.DateTimeLabelFormatter()),
    linechart.WithStyles(tsFg('8'), tsFg('7'), tsFg('2')),
  );
  const m = tslc.New(40, 10, tslc.WithLineChart(lc), tslc.WithTimeSeries(tsSeries(12, tsDay0, DAY, 30, 20)));
  m.draw();
  return m.view() + `\n${sprintV(m.minY())} ${sprintV(m.maxY())}`;
});
