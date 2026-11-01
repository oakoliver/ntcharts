// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import { stringWidth, truncate } from '@oakoliver/lipgloss';
import type { Model as LineChartModel } from '../linechart/linechart.js';

/**
 * @internal categoryCenters partitions the full plot into ordered slots,
 * including empty categories. Dense charts may share centers but do not
 * shift later categories.
 */
export function categoryCenters(width: number, count: number): number[] {
  const centers: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const left = Math.trunc((i * width) / count);
    const right = Math.trunc(((i + 1) * width) / count);
    centers[i] = Math.min(width - 1, Math.trunc((left + Math.max(left, right - 1)) / 2));
  }
  return centers;
}

/** @internal drawCategoryLabels draws each label under its slot, skipping labels that would overlap. */
export function drawCategoryLabels(m: LineChartModel, labels: string[], centers: number[]): void {
  const w = m.graphWidth();
  const start = m.origin().x + 1;
  let end = start - 1;
  for (let i = 0; i < labels.length; i++) {
    const left = Math.trunc((i * w) / labels.length);
    const right = Math.trunc(((i + 1) * w) / labels.length);
    const text = truncate(labels[i], Math.max(0, right - left));
    const tw = stringWidth(text);
    const x = start + centers[i] - Math.trunc(tw / 2);
    if (text !== '' && x > end && x >= start && x + tw <= start + w) {
      m.canvas.setStringWithStyle({ x, y: m.origin().y + 1 }, text, m.labelStyle);
      end = x + tw;
    }
  }
}
