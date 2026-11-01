import { newStyle } from '@oakoliver/lipgloss';
import * as canvas from '@oakoliver/ntcharts/canvas';

const c = canvas.New(5, 2);
c.setLinesWithStyle(['hello', 'world'], newStyle().foreground(6)); // cyan
console.log(c.view());
