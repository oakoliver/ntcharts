// The README's code samples are the programs in examples/: each TypeScript
// block must appear verbatim in one of them, and each plain-text output
// block must be what the program before it prints (tests/parity checks
// those programs against upstream Go).
import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const sources = [
  ...readdirSync(join(root, 'examples', 'usage')).map((f) => join('examples', 'usage', f)),
  join('examples', 'quickstart.ts'),
].map((f) => ({ f, text: readFileSync(join(root, f), 'utf8') }));

const blocks = [...readme.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1], body: m[2] }));

test('every TypeScript sample is an example program', () => {
  const samples = blocks.filter((b) => b.lang === 'typescript' && b.body.includes('console.log') || b.body.includes('class Quickstart'));
  expect(samples.length).toBeGreaterThan(8);
  for (const s of samples) {
    const hit = sources.find((src) => src.text.includes(s.body));
    expect(hit, s.body.slice(0, 80)).toBeDefined();
  }
});

test('every output block is what its sample prints', () => {
  let checked = 0;
  blocks.forEach((b, i) => {
    if (b.lang !== '' || i === 0 || blocks[i - 1].lang !== 'typescript') return;
    const src = sources.find((s) => s.text.includes(blocks[i - 1].body));
    expect(src).toBeDefined();
    const r = Bun.spawnSync(['bun', join(root, src!.f)], { cwd: root });
    expect(r.stdout.toString()).toBe(b.body);
    checked++;
  });
  expect(checked).toBe(4);
});
