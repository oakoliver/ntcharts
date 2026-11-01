# Changelog

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
