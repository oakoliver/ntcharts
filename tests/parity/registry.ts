// Scenario registry for the parity tests. Each file in this directory that
// ends in .scenarios.ts registers scenarios with the same names as the Go
// files in ./go, which render them with upstream ntcharts.

export type Scenario = () => string;

export const scenarios = new Map<string, Scenario>();

export function register(name: string, fn: Scenario): void {
  if (scenarios.has(name)) throw new Error(`duplicate scenario ${name}`);
  scenarios.set(name, fn);
}

/**
 * Normalises SGR escape sequences so that the Go and TypeScript lipgloss
 * encodings compare equal: Go packs attributes into one sequence
 * (`ESC[1;7;44m`), the TypeScript port writes one sequence per attribute
 * (`ESC[1mESC[7mESC[44m`). Adjacent SGR sequences are merged and an empty
 * parameter list is written as 0. Text and attribute order are unchanged.
 */
export function normalizeSGR(s: string): string {
  return s.replace(/(?:\x1b\[[0-9;:]*m)+/g, (run) => {
    const params = [...run.matchAll(/\x1b\[([0-9;:]*)m/g)].map((m) => (m[1] === '' ? '0' : m[1]));
    return `\x1b[${params.join(';')}m`;
  });
}
