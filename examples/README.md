# Examples

Run them from the repository root after `bun install`. They import the source in `src/` (as `../src/index.js` or through the `@oakoliver/ntcharts` paths in `tsconfig.json`) and the sibling ports from `node_modules`. The recordings in `assets/` are made from the tapes in `assets/tapes/`.

## Larger examples

### market.ts

```sh
bun examples/market.ts          # a new invented market on every run
bun examples/market.ts --demo   # seeded PRNG: the same market on every run
```

A trading-desk dashboard. Every number is invented: eight made-up tickers in four sectors follow a random walk made of a market factor, a sector factor, their own noise and the odd news jump. One simulated minute passes per tick.

- Watchlist: last price, change since the session open, and a sparkline of the last 24 closes.
- Candles: one-minute candles of the selected ticker on a time series chart, as line runes or solid blocks. The Y axis is fitted to the candles in view.
- Volume: columns on a plain canvas. Each column is placed with the chart's `candleColumn()`, so it sits under its candle at every zoom level.
- Sector moves: a heatmap of each sector's average move in 10-minute buckets over the last two hours.

Keys: `↑`/`↓` (`k`/`j`) select a ticker · `←`/`→` (`h`/`l`) scroll back in time · `end` follow live again · `+`/`-` or the mouse wheel over the chart zoom · `b` line or block candles · `space` pause · `q` quit. A click on a watchlist row selects it. Needs at least 90×24 cells and resizes with the terminal.

### netmon.ts

```sh
bun examples/netmon.ts          # real measurements
bun examples/netmon.ts --demo   # invented hosts and latencies, nothing sent
```

A latency monitor. Once a second it opens a TCP connection to port 443 of five public hosts (Cloudflare and Google DNS, Quad9, github.com, the npm registry), times how long the connection takes to be accepted, and closes it; nothing else is sent. A host that does not answer within 2 s counts as lost. It keeps 15 minutes of history.

- Host table: last, average and 95th percentile latency, loss, and a sparkline of the last 30 seconds.
- p95 by host: a horizontal bar chart.
- All hosts: one time series chart, braille lines, over a 1, 5 or 15 minute window, with a log or linear Y axis.
- The selected host: a streaming line of the worst latency per column, with its loss on a right-hand Y axis.
- Distribution: a heatmap of the selected host's latencies over time, in buckets relative to its median.

`--demo` uses invented hosts with a seeded PRNG: a congested stretch on one host, loss bursts on another, and the odd spike. It starts with 15 minutes of history and runs at 4× speed.

Keys: `↑`/`↓` (`k`/`j`) select a host · `1`/`2`/`3` window of 1, 5 or 15 minutes · `g` log or linear Y axis · `space` pause · `q` quit. A click on a host row selects it. Needs at least 96×26 cells.

## One example per chart type

Each is a port of the upstream example named in its header.

```sh
bun examples/quickstart.ts            # time series chart, two data sets, keyboard and mouse
bun examples/canvas.ts                # two canvases with movable viewports
bun examples/graph.ts                 # drawing helpers: lines, circles, braille, columns, rows, candlesticks
bun examples/barchart.ts              # stacked bars with negative values (--horizontal for rows)
bun examples/sparkline.ts             # six sparklines, four drawing modes
bun examples/heatmap.ts               # a labelled grid and a radial plot
bun examples/linechart.ts             # lines, circles and a scatter plot you can zoom
bun examples/streamlinechart.ts       # two streams, one on a right Y axis
bun examples/timeserieslinechart.ts   # prices as lines, braille or candles
bun examples/wavelinechart.ts         # sine and cosine waves
bun examples/spec.ts [file.json]      # a chart from a JSON spec, printed once
```

| Example | Keys |
|---|---|
| quickstart.ts | `pgup`/`pgdown` or the mouse wheel zoom, `←`/`→` or a drag move, `q` quit |
| canvas.ts | click a canvas or `enter` to switch, arrow keys, wheel or drag move its viewport, `q` quit |
| graph.ts | `1`–`6` or `tab` page, arrow keys move the origin (click on the lines page) or the viewport (columns, rows), `q` quit |
| barchart.ts | click a bar segment to see its values, `q` quit |
| sparkline.ts | any key pushes one more value, `q` quit |
| heatmap.ts | `tab` switch heatmap, `l` labels on or off, `+`/`-` resize, `q` quit |
| linechart.ts | `space` new random lines, `r` reset, `pgup`/`pgdown` or wheel zoom, arrows or drag move, `q` quit |
| streamlinechart.ts | `space` pause, `r` clear, `pgup`/`pgdown` or wheel zoom, `↑`/`↓` or drag move, `q` quit |
| timeserieslinechart.ts | `c` lines, braille or candles, `f` fit Y to the visible days, `←`/`→` or drag move, `pgup`/`pgdown` or wheel zoom, `q` quit |
| wavelinechart.ts | `s` arc or thin lines, `pgup`/`pgdown` or wheel zoom, `←`/`→` or drag move, `q` quit |

## Charts as strings

[`usage/`](usage/) holds the README's snippets. Each builds a chart, draws it and prints `view()`; no Bubble Tea program runs.

```sh
bun examples/usage/timeserieslinechart.ts
```
