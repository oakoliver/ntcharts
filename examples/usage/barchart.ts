import { newStyle } from '@oakoliver/lipgloss';
import * as barchart from '@oakoliver/ntcharts/barchart';

const bc = barchart.New(11, 10);
bc.pushAll([
  { label: 'A', values: [{ name: 'Item1', value: 21.2, style: newStyle().foreground(10) }] }, // green
  { label: 'B', values: [{ name: 'Item1', value: 15.2, style: newStyle().foreground(9) }] }, // red
]);
bc.draw();
console.log(bc.view());
