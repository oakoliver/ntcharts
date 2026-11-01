# Changelog

## 1.1.0

Two additions, found while building a dashboard on the port. Neither changes what upstream ntcharts v2.9.0 does by default: `clear()` still keeps a sparkline's maximum and zone IDs still come from the manager's `newPrefix()`, as in Go (`sparkline/sparkline.go` `Clear`, `barchart/barchart.go` `SetZoneManager`). The 342 parity scenarios are unchanged.

### Added

- `sparkline.Model.resetMax()`: puts the expected maximum back to the value last set with `setMax()` or `WithMaxValue()` (1 if none), undoing the growth of the automatic maximum. Call it after `clear()` to reuse a sparkline for new data.
- `WithZoneID(id)` option and `setZoneID(id)` method on `canvas`, `barchart`, `linechart`, `streamlinechart`, `timeserieslinechart` and `wavelinechart`: a fixed zone ID instead of the process-wide generated prefix, so IDs are the same across sessions and programs. Works before or after `WithZoneManager`; an empty ID goes back to a generated prefix.

### Docs

- README, "In Ink": the `ESC[m` problem comes from `@alcalzone/ansi-tokenize` below 0.2.2, which counts it as three visible characters. Ink 5.x and Ink 6.0 to 6.2.0 depend on `^0.1.3` and are affected; Ink 6.2.3 and later (and Ink 7 and 8) resolve 0.2.2 or later and are not. The `replaceAll('\x1b[m', '\x1b[0m')` workaround is kept for those versions; upgrading Ink is the better fix.

## 1.0.0 — parity with ntcharts v2.9.0

First release. A port of [NimbleMarkets/ntcharts](https://github.com/NimbleMarkets/ntcharts) [v2.9.0](https://github.com/NimbleMarkets/ntcharts/releases/tag/v2.9.0), the release on the Bubble Tea v2 branch, for `@oakoliver/bubbletea` 1.2 (parity with Bubble Tea v2.0.10).

### Ported

- `canvas`, `canvas/runes`, `canvas/buffer`, `canvas/graph`.
- `barchart`, `sparkline`, `heatmap`.
- `linechart`, `linechart/streamlinechart`, `linechart/timeserieslinechart`, `linechart/wavelinechart`.
- `spec`, without its `spec/echarts` module.

Each package is a subpath export (`@oakoliver/ntcharts/canvas`, …) and a namespace of the root export. Mouse support works with `@oakoliver/bubblezone` 1.0, an optional peer dependency.

### Not ported

- The `picture` packages (`picture`, `heatpicture`, `pictureurl`, `chartpicture`) and `internal/kittyshm`: they need Go's image decoders, POSIX shared memory and, for `chartpicture`, the Go library go-analyze/charts. See the README.
- `spec/echarts` (go-echarts, a Go web-chart library), `cmd/` and `web/`.

### Tests

- Every upstream test of the ported packages, with upstream's golden files.
- Parity scenarios rendered by upstream Go (`tests/parity/go`) and by the port, compared byte for byte.
- `src/internal/gomath.ts` reproduces Go's fused multiply-add on arm64 and Go's `math.Log`, `Log10`, `Exp` and `Pow`, whose last bits move labels and points.

### Examples

`market.ts` and `netmon.ts`, two full-screen dashboards, and one example per chart type, with recordings.
