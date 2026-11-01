// The README snippets in examples/usage/*.ts, run as separate programs:
// their printed output must equal upstream's View() for the same code.
import { join } from 'node:path';
import { register } from './registry.js';

const root = join(import.meta.dir, '..', '..');
for (const name of ['canvas', 'barchart', 'streamlinechart', 'timeserieslinechart', 'wavelinechart', 'sparkline', 'heatmap', 'logscale']) {
  register(`usage/${name}`, () => {
    const r = Bun.spawnSync(['bun', join(root, 'examples', 'usage', `${name}.ts`)], { cwd: root });
    if (r.exitCode !== 0) throw new Error(r.stderr.toString());
    return r.stdout.toString().replace(/\n$/, ''); // console.log adds the newline
  });
}
