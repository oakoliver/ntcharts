/**
 * market.ts: a trading-desk style dashboard. Every number on it is invented.
 *
 * Eight made-up tickers in four sectors follow a random walk (a market
 * factor, a sector factor, their own noise and the odd news jump). The screen
 * shows:
 *   - a watchlist with last price, change since the open and a sparkline,
 *   - one-minute candles of the selected ticker (timeserieslinechart),
 *   - a volume panel drawn on a plain canvas, aligned with the candles,
 *   - a heatmap of sector moves over the last two hours, in 10-minute buckets.
 *
 * Usage:
 *   bun examples/market.ts          a new random market every run
 *   bun examples/market.ts --demo   seeded PRNG: the same market every run
 *
 * Keys: ↑/↓ (k/j) ticker · ←/→ (h/l) scroll back in time · end follow
 *       live · +/- zoom (or the mouse wheel over the chart) · b line or
 *       block candles · space pause · q quit. Click a watchlist row to
 *       select it.
 */
import { NewProgram, NewView, Quit, Tick, MouseMode, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import {
  newStyle, roundedBorder, joinHorizontal, joinVertical, place, Top, Left, Center, stringWidth, truncate,
  type Style,
} from '@oakoliver/lipgloss';
import * as zone from '@oakoliver/bubblezone';
import { canvas, graph, heatmap, sparkline, timeserieslinechart as tslc } from '../src/index.js';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('usage: bun examples/market.ts [--demo]');
  console.log('  (default)  a new invented market every run');
  console.log('  --demo     seeded PRNG: the same invented market every run');
  process.exit(0);
}
const DEMO = args.includes('--demo');
if (!process.stdout.isTTY || !process.stdin.isTTY) {
  console.error('market needs an interactive terminal.');
  process.exit(1);
}

// ── palette (Catppuccin Mocha) ───────────────────────────────────────────────
const C = {
  text: '#cdd6f4', sub: '#a6adc8', dim: '#6c7086', faint: '#45475a', base: '#1e1e2e',
  green: '#a6e3a1', red: '#f38ba8', blue: '#89b4fa', mauve: '#cba6f7', peach: '#fab387', yellow: '#f9e2af', teal: '#94e2d5',
};
const st = {
  title: newStyle().bold(true).foreground(C.mauve),
  badge: newStyle().bold(true).foreground(C.base).background(C.peach).padding(0, 1),
  text: newStyle().foreground(C.text),
  sub: newStyle().foreground(C.sub),
  dim: newStyle().foreground(C.dim),
  up: newStyle().foreground(C.green),
  down: newStyle().foreground(C.red),
  sel: newStyle().bold(true).foreground(C.text).background('#313244'),
  axis: newStyle().foreground(C.faint),
  label: newStyle().foreground(C.dim),
  box: newStyle().border(roundedBorder()).borderForeground(C.faint),
  boxFocus: newStyle().border(roundedBorder()).borderForeground(C.mauve),
  warn: newStyle().foreground(C.peach),
  volUp: newStyle().foreground('#5a7d5a'),
  volDown: newStyle().foreground('#8a4d5e'),
};

// ── invented market ──────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(DEMO ? 20261101 : (Date.now() ^ 0x5eed) >>> 0);
// standard normal from two uniforms (Box-Muller)
function gauss(): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const SECTORS = ['Tech', 'Energy', 'Health', 'Finance'] as const;
interface Candle { t: Date; o: number; h: number; l: number; c: number; v: number }
interface Ticker { sym: string; sector: number; vol: number; base: number; price: number; open: number; candles: Candle[] }

const tickers: Ticker[] = ([
  ['ACME', 0, 0.0028, 182.4, 52_000], ['NOVA', 0, 0.0042, 64.1, 88_000],
  ['VOLT', 1, 0.0034, 41.25, 61_000], ['FLUX', 1, 0.005, 23.8, 120_000],
  ['CURA', 2, 0.002, 118.7, 34_000], ['MEDI', 2, 0.0026, 57.3, 47_000],
  ['BANX', 3, 0.0021, 92.15, 70_000], ['LEDG', 3, 0.0038, 35.6, 95_000],
] as const).map(([sym, sector, vol, price, base]) => ({ sym, sector, vol, base, price, open: price, candles: [] }));

const MINUTE = 60_000;
const HISTORY = 360; // candles kept per ticker
const WARM = 150; // candles generated before the first frame
const BUCKET = 10; // candles per heatmap bucket
const BUCKETS = 12;
let clock = Date.UTC(2026, 10, 2, 9, 30); // simulated session start, UTC

// One simulated minute for every ticker: shared market and sector shocks,
// own noise, and now and then a news jump. The path inside the minute gives
// the high and low.
function stepMarket(): void {
  const t = new Date(clock);
  clock += MINUTE;
  const market = gauss() * 0.0009;
  const sector = SECTORS.map(() => gauss() * 0.0011);
  for (const k of tickers) {
    const jump = rng() < 0.006 ? (rng() < 0.5 ? -1 : 1) * (0.008 + rng() * 0.012) : 0;
    const drift = market + sector[k.sector] + jump;
    const o = k.price;
    let p = o;
    let h = o;
    let l = o;
    for (let i = 0; i < 6; i++) {
      p *= 1 + drift / 6 + (gauss() * k.vol) / Math.sqrt(6);
      h = Math.max(h, p);
      l = Math.min(l, p);
    }
    const ret = Math.abs(p / o - 1);
    const v = Math.round(k.base * (0.55 + 45 * ret + 0.5 * rng()) * (jump ? 3 : 1));
    k.price = p;
    k.candles.push({ t, o, h, l, c: p, v });
    if (k.candles.length > HISTORY) k.candles.shift();
  }
}
for (let i = 0; i < WARM; i++) stepMarket();

// ── formatting ───────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
function si(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(Math.round(v));
}
function pct(v: number): string {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;
}

// ── heatmap colors: red, through grey, to green ─────────────────────────────
function diverging(): string[] {
  const lo = [243, 139, 168];
  const mid = [69, 71, 90];
  const hi = [166, 227, 161];
  const out: string[] = [];
  const n = 21;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const [a, b, f] = t < 0.5 ? [lo, mid, t * 2] : [mid, hi, (t - 0.5) * 2];
    out.push('#' + [0, 1, 2].map((j) => Math.round(a[j] + (b[j] - a[j]) * f).toString(16).padStart(2, '0')).join(''));
  }
  return out;
}

const ZOOMS = [12, 16, 24, 36, 48, 72, 96, 144];

// ── model ────────────────────────────────────────────────────────────────────
class Market implements Model {
  w = 0;
  h = 0;
  sel = 0;
  zoom = 1; // index into ZOOMS: candles in the window (16)
  back = 0; // candles scrolled back from the newest
  block = false;
  paused = false;
  zm = zone.New();
  chart: tslc.Model | null = null;
  vol: canvas.Model | null = null;
  heat: heatmap.Model | null = null;
  sparks = tickers.map(() => sparkline.New(12, 1));

  init(): Cmd {
    return this.tick();
  }

  private tick(): Cmd {
    return Tick(DEMO ? 700 : 600, () => ({ _tag: 'marketTick' }));
  }

  update(msg: Msg): [Model, Cmd] {
    switch (msg?._tag) {
      case 'WindowSizeMsg':
        this.w = msg.width;
        this.h = msg.height;
        this.layout();
        return [this, null];
      case 'marketTick':
        if (!this.paused) {
          stepMarket();
          this.redraw();
        }
        return [this, this.tick()];
      case 'KeyPressMsg':
        return this.key(msg.toString());
      case 'MouseWheelMsg':
        if (this.chart && this.zm.get(this.chart.zoneID()).inBounds(msg)) {
          if (msg.button === 4) this.zoomBy(-1);
          if (msg.button === 5) this.zoomBy(1);
        }
        return [this, null];
      case 'MouseClickMsg':
        tickers.forEach((_, i) => {
          if (this.zm.get(`row${i}`).inBounds(msg)) this.select(i);
        });
        return [this, null];
    }
    return [this, null];
  }

  private key(k: string): [Model, Cmd] {
    switch (k) {
      case 'q': case 'ctrl+c': return [this, Quit];
      case 'up': case 'k': this.select((this.sel + tickers.length - 1) % tickers.length); break;
      case 'down': case 'j': this.select((this.sel + 1) % tickers.length); break;
      case 'left': case 'h': this.scroll(Math.max(1, Math.trunc(ZOOMS[this.zoom] / 8))); break;
      case 'right': case 'l': this.scroll(-Math.max(1, Math.trunc(ZOOMS[this.zoom] / 8))); break;
      case 'end': this.back = 0; this.redraw(); break;
      case '+': case '=': this.zoomBy(-1); break;
      case '-': case '_': this.zoomBy(1); break;
      case 'b': this.block = !this.block; this.redraw(); break;
      case 'space': this.paused = !this.paused; break;
    }
    return [this, null];
  }

  private select(i: number): void {
    this.sel = i;
    this.redraw();
  }

  private zoomBy(d: number): void {
    this.zoom = Math.min(ZOOMS.length - 1, Math.max(0, this.zoom + d));
    this.scroll(0);
  }

  private scroll(d: number): void {
    const n = tickers[this.sel].candles.length;
    this.back = Math.min(Math.max(0, n - ZOOMS[this.zoom]), Math.max(0, this.back + d));
    this.redraw();
  }

  // sizes of the panels for the current terminal size
  private dims() {
    const leftW = 45; // watchlist and heatmap, outer width
    const rightW = Math.max(30, this.w - leftW);
    const bodyH = Math.max(14, this.h - 2); // minus header and help line
    const volH = Math.max(4, Math.min(7, Math.trunc(bodyH / 5)));
    return { leftW, rightW, bodyH, chartW: rightW - 2, chartH: bodyH - volH - 4, volH };
  }

  private layout(): void {
    const d = this.dims();
    this.chart = tslc.New(d.chartW, d.chartH,
      tslc.WithZoneManager(this.zm),
      tslc.WithAxesStyles(st.axis, st.label),
      tslc.WithXLabelFormatter((_i, v) => hhmm(new Date(v * 1000))),
      tslc.WithYLabelFormatter((_i, v) => v.toFixed(2)),
    );
    this.vol = canvas.New(d.chartW, d.volH);
    this.heat = heatmap.New(d.leftW - 2, d.bodyH - tickers.length - 6,
      heatmap.WithColorScale(diverging()),
      heatmap.WithValueRange(-1.2, 1.2),
      heatmap.WithCellSize(1, 1),
    );
    this.redraw();
  }

  // the candles in the window, oldest first
  private windowCandles(): Candle[] {
    const cs = tickers[this.sel].candles;
    const end = cs.length - this.back;
    return cs.slice(Math.max(0, end - ZOOMS[this.zoom]), end);
  }

  private redraw(): void {
    if (!this.chart || !this.vol || !this.heat) return;
    const chart = this.chart;
    const win = this.windowCandles();
    if (win.length === 0) return;

    // candles: four data sets of one ticker, then fit the Y range to the window
    chart.clearAllData();
    for (const c of win) {
      chart.pushDataSet('open', { time: c.t, value: c.o });
      chart.pushDataSet('high', { time: c.t, value: c.h });
      chart.pushDataSet('low', { time: c.t, value: c.l });
      chart.pushDataSet('close', { time: c.t, value: c.c });
    }
    const half = MINUTE / 2;
    const t0 = new Date(win[0].t.getTime() - half);
    const t1 = new Date(win[win.length - 1].t.getTime() + half);
    chart.setTimeRange(t0, t1);
    chart.setViewTimeRange(t0, t1);
    chart.fitYToViewWithOpts({ dataSets: ['high', 'low'] });
    // candle body width: about 60% of the space each candle gets
    const cw = Math.max(1, Math.min(7, Math.floor((chart.graphWidth() / ZOOMS[this.zoom]) * 0.6)));
    chart.drawCandleWithOpts('open', 'high', 'low', 'close', st.up, st.down, { width: cw, block: this.block });

    // volume: columns on a plain canvas, at the same columns as the candles
    const vol = this.vol;
    vol.clear();
    const maxV = Math.max(...win.map((c) => c.v));
    const gutter = chart.origin().x;
    vol.setStringWithStyle({ x: Math.max(0, gutter - si(maxV).length), y: 0 }, si(maxV), st.label);
    vol.setStringWithStyle({ x: Math.max(0, gutter - 3), y: vol.height() - 1 }, 'vol', st.label);
    graph.DrawVerticalLineUp(vol, { x: gutter, y: vol.height() - 1 }, st.axis);
    for (const c of win) {
      const sx = chart.scaleFloat64Point({ x: tslc.timeToX(c.t), y: 0 }).x;
      const x = chart.candleColumn(sx, cw);
      const hgt = (c.v / maxV) * vol.height();
      const s = c.c >= c.o ? st.volUp : st.volDown;
      for (let dx = -Math.trunc((cw - 1) / 2); dx <= Math.trunc(cw / 2); dx++) {
        if (x + dx > gutter) graph.DrawColumnBottomToTop(vol, { x: x + dx, y: vol.height() - 1 }, hgt, s);
      }
    }

    // sparklines: the last 24 closes of every ticker
    tickers.forEach((k, i) => {
      const sp = this.sparks[i];
      sp.clear();
      const last = k.candles.slice(-24);
      const floor = Math.min(...last.map((c) => c.l));
      sp.pushAll(last.map((c) => c.c - floor));
      sp.draw();
    });

    // heatmap: average move of each sector in each 10-minute bucket
    const heat = this.heat;
    heat.clearData();
    const n = tickers[0].candles.length;
    const xLabels: string[] = [];
    for (let b = 0; b < BUCKETS; b++) {
      const end = n - (BUCKETS - 1 - b) * BUCKET;
      const start = end - BUCKET;
      xLabels.push(b % 4 === 0 && start >= 0 ? hhmm(tickers[0].candles[start].t) : '');
      SECTORS.forEach((_, s) => {
        const members = tickers.filter((k) => k.sector === s);
        let sum = 0;
        for (const k of members) {
          if (start < 0) continue;
          sum += (k.candles[end - 1].c / k.candles[start].o - 1) * 100;
        }
        heat.push(heatmap.NewHeatPointInt(b, SECTORS.length - 1 - s, sum / members.length));
      });
    }
    heat.setXLabels(xLabels);
    heat.setYLabels([...SECTORS].reverse());
    heat.draw();
  }

  view(): View {
    if (!this.chart || !this.vol || !this.heat) return NewView('');
    if (this.w < 90 || this.h < 24) {
      return NewView(place(this.w, this.h, Center, Center, st.sub.render('market needs at least 90×24 cells')));
    }
    const d = this.dims();
    const k = tickers[this.sel];
    const idx = tickers.reduce((a, t) => a + t.price / t.open, 0) / tickers.length;

    // header
    const sim = st.badge.render('SIMULATED DATA');
    const head = ` ${st.title.render('MARKET WATCH')}  ${sim}  ${st.dim.render('invented tickers · not a real market')}`;
    const clockS = `${st.sub.render(hhmm(new Date(clock - MINUTE)) + ' UTC')}  ${st.dim.render('IDX')} ${st.text.render((idx * 1000).toFixed(1))} ${(idx >= 1 ? st.up : st.down).render(pct(idx - 1))} `;
    const header = head + ' '.repeat(Math.max(1, this.w - stringWidth(head) - stringWidth(clockS))) + clockS;

    // watchlist
    const rows = tickers.map((t, i) => {
      const ch = t.price / t.open - 1;
      const line = `${i === this.sel ? '▸' : ' '} ${t.sym.padEnd(5)}${SECTORS[t.sector].padEnd(8)}${t.price.toFixed(2).padStart(7)} ${pct(ch).padStart(7)} `;
      const styled = i === this.sel ? st.sel.render(line) : st.text.render(line);
      const spark = this.sparks[i].view();
      return this.zm.mark(`row${i}`, styled + (ch >= 0 ? st.up : st.down).render(spark));
    });
    const watch = st.box.render(
      [st.sub.render('  SYM  SECTOR     LAST   CHG    24m'), ...rows].join('\n'),
    );
    const heatBox = st.box.render(st.sub.render(' sector moves, % per 10 min') + '\n' + this.heat.view());
    const left = joinVertical(Left, watch, heatBox);

    // chart and volume
    const win = this.windowCandles();
    const last = win[win.length - 1];
    const live = this.back === 0 ? st.up.render('● live') : st.warn.render(`◀ ${this.back}m back`);
    const title = ` ${st.title.render(k.sym)} ${st.dim.render('1m candles ·')} ${st.text.render(String(win.length))} ${st.dim.render('in view ·')} ${live}${this.paused ? st.dim.render(' · paused') : ''}`;
    const ohlc = st.dim.render(`  O ${last.o.toFixed(2)}  H ${last.h.toFixed(2)}  L ${last.l.toFixed(2)}  C ${last.c.toFixed(2)}  V ${si(last.v)}`);
    const right = st.boxFocus.render(
      [truncate(title + ohlc, d.chartW), this.chart.view(), this.vol.view()].join('\n'),
    );

    const body = joinHorizontal(Top, left, right);
    const help = st.dim.render(' ↑/↓ ticker · ←/→ scroll · end live · +/- zoom · b candle style · space pause · q quit');
    const v = NewView(this.zm.scan([header, body, help].join('\n')));
    v.altScreen = true;
    v.mouseMode = MouseMode.CellMotion;
    return v;
  }
}

const program = NewProgram(new Market());
await program.run();
