/**
 * netmon.ts: a network latency monitor.
 *
 * Every second it times a TCP connection to each host (the time until the
 * connection is accepted, a round trip plus the server's accept) and keeps
 * 15 minutes of history. The screen shows:
 *   - a host table with last, average, 95th percentile and loss, and a sparkline,
 *   - a horizontal bar chart of the 95th percentile per host,
 *   - all hosts on one time series chart (braille lines), with 1, 5 or 15
 *     minute windows and a linear or log Y axis,
 *   - the selected host as a streaming line, with its loss on a right Y axis,
 *   - a heatmap of the selected host's latency distribution over time.
 *
 * Usage:
 *   bun examples/netmon.ts            real measurements to five public hosts
 *   bun examples/netmon.ts --demo     invented hosts and latencies (seeded
 *                                     PRNG, 15 minutes of history, 4x speed);
 *                                     nothing is sent over the network
 *
 * The real mode opens one TCP connection per host per second (port 443) and
 * closes it at once; nothing else is sent. Hosts that do not answer within
 * 2 s count as lost.
 *
 * Keys: ↑/↓ (k/j) host · 1/2/3 window 1m/5m/15m · g log/linear Y · space
 *       pause · q quit. Click a host row to select it.
 */
import { connect } from 'node:net';
import { NewProgram, NewView, Quit, Tick, MouseMode, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import { newStyle, roundedBorder, joinHorizontal, joinVertical, place, truncate, Top, Left, Center, stringWidth, type Style } from '@oakoliver/lipgloss';
import * as zone from '@oakoliver/bubblezone';
import { barchart, heatmap, linechart, runes, sparkline, streamlinechart, timeserieslinechart as tslc } from '../src/index.js';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('usage: bun examples/netmon.ts [--demo]');
  console.log('  (default)  TCP connect times to five public hosts, once a second');
  console.log('  --demo     invented hosts and latencies, nothing sent over the network');
  process.exit(0);
}
const DEMO = args.includes('--demo');
if (!process.stdout.isTTY || !process.stdin.isTTY) {
  console.error('netmon needs an interactive terminal.');
  process.exit(1);
}

// ── palette (Catppuccin Mocha) ───────────────────────────────────────────────
const C = {
  text: '#cdd6f4', sub: '#a6adc8', dim: '#6c7086', faint: '#45475a', base: '#1e1e2e',
  red: '#f38ba8', peach: '#fab387', green: '#a6e3a1', mauve: '#cba6f7',
};
const HOST_COLORS = ['#89b4fa', '#a6e3a1', '#f9e2af', '#f5c2e7', '#94e2d5'];
const st = {
  title: newStyle().bold(true).foreground(C.mauve),
  badge: newStyle().bold(true).foreground(C.base).background(C.peach).padding(0, 1),
  live: newStyle().bold(true).foreground(C.base).background(C.green).padding(0, 1),
  text: newStyle().foreground(C.text),
  sub: newStyle().foreground(C.sub),
  dim: newStyle().foreground(C.dim),
  bad: newStyle().foreground(C.red),
  warn: newStyle().foreground(C.peach),
  sel: newStyle().bold(true).foreground(C.text).background('#313244'),
  axis: newStyle().foreground(C.faint),
  label: newStyle().foreground(C.dim),
  box: newStyle().border(roundedBorder()).borderForeground(C.faint),
  lossLine: newStyle().foreground(C.red),
};

// ── hosts and samples ────────────────────────────────────────────────────────
interface Sample { t: number; ms: number | null } // null: lost
interface Host { name: string; short: string; addr: string; port: number; samples: Sample[]; color: Style; hex: string }

const HISTORY_MS = 15 * 60_000;
const hosts: Host[] = (DEMO
  ? [['edge-lis-1', 'lis-1', '10.0.4.11'], ['edge-fra-2', 'fra-2', '10.0.7.20'], ['api.example.net', 'api', '203.0.113.8'], ['db-primary', 'db', '10.0.0.5'], ['cdn.example.org', 'cdn', '198.51.100.3']]
  : [['cloudflare dns', '1.1.1.1', '1.1.1.1'], ['google dns', '8.8.8.8', '8.8.8.8'], ['quad9', '9.9.9.9', '9.9.9.9'], ['github.com', 'github', 'github.com'], ['npm registry', 'npm', 'registry.npmjs.org']]
).map(([name, short, addr], i) => ({ name, short, addr, port: 443, samples: [], color: newStyle().foreground(HOST_COLORS[i]), hex: HOST_COLORS[i] }));

// Time of a TCP connect, or null after 2 s or on an error.
function probe(h: Host): Promise<number | null> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const sock = connect({ host: h.addr, port: h.port });
    const done = (v: number | null) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(2000, () => done(null));
    sock.once('connect', () => done(performance.now() - t0));
    sock.once('error', () => done(null));
  });
}

// Demo: invented latencies from a seeded PRNG. Each host has a base latency
// and jitter; edge-fra-2 has a congested stretch, api.example.net drops
// packets in bursts, and everyone gets the odd spike.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261101);
const DEMO_BASE = [11, 34, 58, 1.8, 21];
const DEMO_JITTER = [1.5, 4, 9, 0.4, 3];
function demoSample(i: number, t: number): number | null {
  const minute = Math.floor(t / 60_000) % 15;
  if (i === 2 && minute % 5 === 3 && rng() < 0.3) return null; // loss bursts
  if (rng() < 0.002) return null;
  let ms = DEMO_BASE[i] + DEMO_JITTER[i] * (rng() + rng() + rng() - 1.5) * 1.6;
  if (i === 1 && (minute === 6 || minute === 7)) ms += 45 + 30 * rng(); // congestion
  if (rng() < 0.01) ms *= 3 + 4 * rng(); // spikes
  return Math.max(0.3, ms);
}

let now = DEMO ? Date.UTC(2026, 10, 2, 14, 0) : Date.now();
if (DEMO) {
  // 15 minutes of history before the first frame
  for (let t = now - HISTORY_MS; t < now; t += 1000) hosts.forEach((h, i) => h.samples.push({ t, ms: demoSample(i, t) }));
}

function stats(h: Host, since: number) {
  const xs = h.samples.filter((s) => s.t >= since);
  const ok = xs.filter((s) => s.ms !== null).map((s) => s.ms as number);
  const sorted = [...ok].sort((a, b) => a - b);
  const last = xs.length ? xs[xs.length - 1].ms : null;
  return {
    last,
    avg: ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : NaN,
    p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : NaN,
    loss: xs.length ? (xs.length - ok.length) / xs.length : 0,
  };
}

const ms = (v: number | null) => (v === null || Number.isNaN(v) ? '  —  ' : v >= 100 ? `${v.toFixed(0)}` : v.toFixed(1));
const pad2 = (n: number) => String(n).padStart(2, '0');
function clockLabel(t: number, seconds = true): string {
  const d = new Date(t);
  const [h, m, s] = DEMO ? [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()] : [d.getHours(), d.getMinutes(), d.getSeconds()];
  return seconds ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(h)}:${pad2(m)}`;
}

// latency buckets of the heatmap, in ms (upper bounds)
// The heatmap's latency buckets are relative to the host's median, so a
// 2 ms host and a 60 ms host both spread over the rows.
const BUCKET_STEPS = [0.8, 0.9, 0.97, 1.03, 1.1, 1.25, 1.6, 2.5, Infinity];
function buckets(median: number): { edges: number[]; labels: string[] } {
  const edges = BUCKET_STEPS.map((f) => median * f);
  const fmt = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
  const labels = edges.map((e, i) => (i === edges.length - 1 ? `${fmt(edges[i - 1])}+` : `<${fmt(e)}`));
  return { edges, labels };
}
const WINDOWS = [60_000, 5 * 60_000, 15 * 60_000];

class NetMon implements Model {
  w = 0;
  h = 0;
  sel = 0;
  win = 1;
  log = true;
  paused = false;
  zm = zone.New();
  all: tslc.Model | null = null;
  stream: streamlinechart.Model | null = null;
  heat: heatmap.Model | null = null;
  bars: barchart.Model | null = null;
  sparks = hosts.map(() => sparkline.New(10, 1));

  init(): Cmd {
    return this.tick();
  }

  private tick(): Cmd {
    return Tick(DEMO ? 250 : 1000, () => ({ _tag: 'probeTick' }));
  }

  update(msg: Msg): [Model, Cmd] {
    switch (msg?._tag) {
      case 'WindowSizeMsg':
        this.w = msg.width;
        this.h = msg.height;
        this.layout();
        return [this, null];
      case 'probeTick':
        if (this.paused) return [this, this.tick()];
        if (DEMO) {
          now += 1000; // 4x speed: one simulated second per 250 ms
          hosts.forEach((h, i) => h.samples.push({ t: now, ms: demoSample(i, now) }));
          this.record();
          return [this, this.tick()];
        }
        now = Date.now();
        // the probes run in the background and report back as one message
        return [this, () => Promise.all(hosts.map(probe)).then((r) => ({ _tag: 'probeResults', t: now, r }))];
      case 'probeResults':
        hosts.forEach((h, i) => h.samples.push({ t: msg.t, ms: msg.r[i] }));
        this.record();
        return [this, this.tick()];
      case 'KeyPressMsg':
        return this.key(msg.toString());
      case 'MouseClickMsg':
        hosts.forEach((_, i) => {
          if (this.zm.get(`host${i}`).inBounds(msg)) {
            this.sel = i;
            this.redraw();
          }
        });
        return [this, null];
    }
    return [this, null];
  }

  private record(): void {
    for (const h of hosts) while (h.samples.length && h.samples[0].t < now - HISTORY_MS) h.samples.shift();
    this.redraw();
  }

  private key(k: string): [Model, Cmd] {
    switch (k) {
      case 'q': case 'ctrl+c': return [this, Quit];
      case 'up': case 'k': this.sel = (this.sel + hosts.length - 1) % hosts.length; this.redraw(); break;
      case 'down': case 'j': this.sel = (this.sel + 1) % hosts.length; this.redraw(); break;
      case '1': case '2': case '3': this.win = Number(k) - 1; this.redraw(); break;
      case 'g': this.log = !this.log; this.layout(); break;
      case 'space': this.paused = !this.paused; break;
    }
    return [this, null];
  }

  private dims() {
    const leftW = 55;
    const rightW = Math.max(40, this.w - leftW);
    const bodyH = Math.max(18, this.h - 2);
    const topH = Math.max(8, Math.trunc((bodyH - 4) * 0.55));
    const botH = bodyH - topH - 6;
    const halfW = Math.trunc((rightW - 4) / 2);
    return { leftW, rightW, bodyH, topH, botH, halfW };
  }

  private layout(): void {
    const d = this.dims();
    this.all = tslc.New(d.rightW - 2, d.topH,
      tslc.WithAxesStyles(st.axis, st.label),
      tslc.WithXLabelFormatter((_i, v) => clockLabel(v * 1000, this.win === 0)),
      tslc.WithYLabelFormatter((_i, v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1))),
      tslc.WithYScale(this.log ? linechart.ScaleLog : linechart.ScaleLinear),
    );
    hosts.forEach((h) => this.all!.setDataSetStyle(h.name, h.color));
    this.stream = streamlinechart.New(d.halfW, d.botH,
      streamlinechart.WithAxesStyles(st.axis, st.label),
      streamlinechart.WithY2Axis({ min: 0, max: 100, labelStyle: st.lossLine, labelFormatter: (_i, v) => `${v.toFixed(0)}%` }),
      streamlinechart.WithDataSetYAxis('loss', linechart.YAxisRight),
      streamlinechart.WithDataSetStyles('loss', runes.ThinLineStyle, st.lossLine),
    );
    this.heat = heatmap.New(d.rightW - d.halfW - 4, d.botH,
      heatmap.WithColorScale(['#1e1e2e', '#313244', '#45475a', '#5b5f8a', '#7f72c2', '#b48ee8', '#f5c2e7', '#fab387', '#f9e2af']),
      heatmap.WithAutoValueRange(),
      heatmap.WithCellSize(1, 1),
    );
    this.bars = barchart.New(d.leftW - 2, hosts.length * 2,
      barchart.WithHorizontalBars(),
      barchart.WithBarWidth(1),
      barchart.WithBarGap(1),
      barchart.WithStyles(st.axis, st.label),
    );
    this.redraw();
  }

  private redraw(): void {
    if (!this.all || !this.stream || !this.heat || !this.bars) return;
    const span = WINDOWS[this.win];
    const from = now - span;
    const sel = hosts[this.sel];

    // all hosts, braille lines over the window
    const all = this.all;
    all.clearAllData();
    let maxMs = 1;
    for (const h of hosts) {
      for (const s of h.samples) {
        if (s.t < from || s.ms === null) continue;
        all.pushDataSet(h.name, { time: new Date(s.t), value: s.ms });
        maxMs = Math.max(maxMs, s.ms);
      }
    }
    all.setTimeRange(new Date(from), new Date(now));
    all.setViewTimeRange(new Date(from), new Date(now));
    if (this.log) {
      all.setYRange(1, Math.max(10, maxMs));
      all.setViewYRange(1, Math.max(10, maxMs));
    } else {
      all.setYRange(0, maxMs * 1.05);
      all.setViewYRange(0, maxMs * 1.05);
    }
    // the selected host last, so it is drawn on top
    all.drawBrailleDataSets([...hosts.filter((h) => h !== sel).map((h) => h.name), sel.name]);

    // the selected host streaming in, and its loss over the last 30 samples
    const stream = this.stream;
    stream.clearAllData();
    stream.setDataSetStyles('default', runes.ArcLineStyle, sel.color);
    // one point per column: the worst latency and the loss of the samples in
    // that slice of the window, oldest on the left
    const n = stream.graphWidth();
    const per = span / n;
    const slices: { ms: number; loss: number }[] = [];
    for (let c = 0; c < n; c++) {
      const xs = sel.samples.filter((s) => s.t >= from + c * per && s.t < from + (c + 1) * per);
      if (xs.length === 0) continue;
      const ok = xs.filter((s) => s.ms !== null).map((s) => s.ms as number);
      slices.push({ ms: ok.length ? Math.max(...ok) : NaN, loss: (100 * (xs.length - ok.length)) / xs.length });
    }
    const peak = Math.max(5, ...slices.map((c) => (Number.isNaN(c.ms) ? 0 : c.ms)));
    stream.setYRange(0, peak * 1.1);
    stream.setViewYRange(0, peak * 1.1);
    for (const c of slices) {
      stream.push(Number.isNaN(c.ms) ? peak * 1.1 : c.ms);
      stream.pushDataSet('loss', c.loss);
    }
    stream.drawAll();

    // heatmap: columns are time slices of the window, rows latency buckets
    const heat = this.heat;
    heat.clearData();
    const cols = 12;
    const slice = span / cols;
    const okAll = sel.samples.filter((s) => s.t >= from && s.ms !== null).map((s) => s.ms as number).sort((a, b) => a - b);
    const { edges, labels } = buckets(okAll.length ? okAll[Math.floor(okAll.length / 2)] : 1);
    const xLabels: string[] = [];
    for (let c = 0; c < cols; c++) {
      const t0 = from + c * slice;
      xLabels.push(c % 4 === 0 ? clockLabel(t0, this.win === 0) : '');
      const counts = edges.map(() => 0);
      for (const s of sel.samples) {
        if (s.t < t0 || s.t >= t0 + slice || s.ms === null) continue;
        counts[edges.findIndex((b) => (s.ms as number) < b)]++;
      }
      counts.forEach((n, b) => heat.push(heatmap.NewHeatPointInt(c, b, Math.log1p(n))));
    }
    heat.setXLabels(xLabels);
    heat.setYLabels(labels);
    heat.draw();

    // p95 per host, horizontal bars
    const bars = this.bars;
    bars.clear();
    bars.pushAll(hosts.map((h) => {
      const p95 = stats(h, from).p95;
      return { label: h.short, values: [{ name: h.name, value: Number.isNaN(p95) ? 0 : p95, style: h.color }] };
    }));
    // as upstream, horizontal label space is measured by setHorizontal and resize, not by push
    bars.setHorizontal(true);
    bars.draw();

    // sparklines: the last 36 samples, three per column
    hosts.forEach((h, i) => {
      const sp = this.sparks[i];
      sp.clear();
      const xs = h.samples.slice(-30).map((s) => s.ms ?? 0);
      const per: number[] = [];
      for (let j = 0; j < xs.length; j += 3) per.push(Math.max(...xs.slice(j, j + 3)));
      sp.pushAll(per);
      sp.draw();
    });
  }

  view(): View {
    if (!this.all || !this.stream || !this.heat || !this.bars) return NewView('');
    if (this.w < 96 || this.h < 26) return NewView(place(this.w, this.h, Center, Center, st.sub.render('netmon needs at least 96×26 cells')));
    const d = this.dims();
    const span = WINDOWS[this.win];
    const sel = hosts[this.sel];

    const mode = DEMO ? st.badge.render('DEMO DATA') + ' ' + st.dim.render('invented hosts · 4× speed') : st.live.render('LIVE') + ' ' + st.dim.render('TCP connect time, port 443');
    const head = ` ${st.title.render('NETMON')}  ${mode}`;
    const right = `${st.sub.render(clockLabel(now))}${this.paused ? st.warn.render('  paused') : ''} `;
    const header = head + ' '.repeat(Math.max(1, this.w - stringWidth(head) - stringWidth(right))) + right;

    // host table
    const rows = hosts.map((h, i) => {
      const s = stats(h, now - span);
      const loss = `${(s.loss * 100).toFixed(1)}%`;
      const name = (i === this.sel ? '▸ ' : '  ') + h.name.padEnd(15).slice(0, 15);
      const cells = `${name}${ms(s.last).padStart(6)}${ms(s.avg).padStart(6)}${ms(s.p95).padStart(6)}${loss.padStart(6)} `;
      const line = (i === this.sel ? st.sel : st.text).render(cells);
      const lossStyled = s.loss > 0.02 ? st.bad : st.dim;
      return this.zm.mark(`host${i}`, h.color.render('●') + line + (s.loss > 0.02 ? lossStyled.render('') : '') + h.color.render(this.sparks[i].view()));
    });
    const table = st.box.render([st.sub.render('  host             last   avg   p95  loss  30s'), ...rows].join('\n'));
    const barsBox = st.box.render(st.sub.render(` p95 by host, ms (${span / 60_000}m window)`) + '\n' + this.bars.view());
    const legend = st.box.width(d.leftW - 2).render(
      [st.sub.render(' legend'), ...hosts.map((h) => ` ${h.color.render('━━')} ${st.text.render(h.name)} ${st.dim.render(h.addr)}`)].join('\n'),
    );
    const left = joinVertical(Left, table, barsBox, legend);

    const winLabel = ['1m', '5m', '15m'].map((l, i) => (i === this.win ? st.title.render(`[${i + 1}] ${l}`) : st.dim.render(`[${i + 1}] ${l}`))).join(' ');
    const top = st.box.render(truncate(` ${st.sub.render('latency, ms · all hosts')}  ${winLabel}  ${st.dim.render(this.log ? 'log Y' : 'linear Y')}`, this.all.width()) + '\n' + this.all.view());
    const streamBox = st.box.render(truncate(` ${sel.color.render(sel.name)} ${st.dim.render('ms ·')} ${st.bad.render('loss %')}`, this.stream.width()) + '\n' + this.stream.view());
    const heatBox = st.box.render(truncate(` ${st.sub.render('distribution · ' + sel.name)}`, this.heat.width()) + '\n' + this.heat.view());
    const rightCol = joinVertical(Left, top, joinHorizontal(Top, streamBox, heatBox));

    const body = joinHorizontal(Top, left, rightCol);
    const help = st.dim.render(' ↑/↓ host · 1/2/3 window · g log/linear · space pause · click a host · q quit');
    const v = NewView(this.zm.scan([header, body, help].join('\n')));
    v.altScreen = true;
    v.mouseMode = MouseMode.CellMotion;
    return v;
  }
}

await NewProgram(new NetMon()).run();
