import { newStyle } from '@oakoliver/lipgloss';
import * as canvas from '../../src/canvas/index.js';
import { register } from './registry.js';

register('canvas/hello', () => {
  const c = canvas.New(5, 2);
  c.setLinesWithStyle(['hello', 'world'], newStyle().foreground(6));
  return c.view();
});
