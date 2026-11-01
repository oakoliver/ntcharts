/**
 * spec.ts: render a JSON chart spec to the terminal.
 *
 *   bun examples/spec.ts                                  # built-in sample
 *   bun examples/spec.ts examples/specs/ohlc-volume.json
 *
 * Reads a spec (the same JSON upstream's Go spec package reads), builds the
 * chart with spec.Build and prints its view once: no Bubble Tea program.
 * A spec error is printed to stderr with exit code 1.
 */
import { readFileSync } from 'node:fs';
import { spec } from '../src/index.js';

// sample is a line chart of two series with a right-hand Y axis.
const sample: spec.Spec = {
  type: spec.ChartTypeLine,
  title: 'Sample',
  width: 60,
  height: 14,
  y2_axis: { format: { kind: 'si' } },
  data: {
    series: [
      { name: 'a', color: '#4fc3f7', values: [0, 1, 2, 3, 4, 5, 6, 7].map((x) => ({ x, y: [1, 3, 2, 5, 4, 6, 5, 7][x] })) },
      { name: 'b', color: '#ff8a65', y_axis: spec.YAxisRight, values: [0, 1, 2, 3, 4, 5, 6, 7].map((x) => ({ x, y: 1000 * (8 - x) })) },
    ],
  },
};

const path = process.argv[2];
const s: spec.Spec = path === undefined ? sample : JSON.parse(readFileSync(path, 'utf8'));
try {
  process.stdout.write(spec.Build(s).view() + '\n');
} catch (e) {
  process.stderr.write(`${(e as Error).message}\n`);
  process.exit(1);
}
