import { readFileSync } from 'node:fs';
import * as spec from '@oakoliver/ntcharts/spec';

const chart = spec.Build(JSON.parse(readFileSync('examples/specs/stacked-bar.json', 'utf8')));
console.log(chart.view());
