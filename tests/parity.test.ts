// Byte-for-byte parity with upstream ntcharts v2.9.0 (modulo SGR packing, see
// normalizeSGR). Goldens come from tests/parity/go:
//
//	cd tests/parity/go && go run . > ../goldens.json
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeSGR, scenarios } from './parity/registry.js';

const dir = join(import.meta.dir, 'parity');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.scenarios.ts')).sort()) {
  await import(join(dir, f));
}
const goldens: Record<string, string> = JSON.parse(readFileSync(join(dir, 'goldens.json'), 'utf8'));

describe('parity with upstream ntcharts', () => {
  test('every Go scenario has a TypeScript twin and vice versa', () => {
    expect([...scenarios.keys()].sort()).toEqual(Object.keys(goldens).sort());
  });
  for (const [name, fn] of [...scenarios].sort(([a], [b]) => a.localeCompare(b))) {
    test(name, () => {
      expect(goldens[name]).toBeDefined();
      expect(normalizeSGR(fn())).toBe(normalizeSGR(goldens[name]));
    });
  }
});
