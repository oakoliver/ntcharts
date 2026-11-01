// ntcharts - Copyright (c) 2026 Neomantra Corp.
// TypeScript port - Copyright (c) 2026 Antonio Oliveira.

import type { Cmd, Msg } from '@oakoliver/bubbletea';
import * as canvas from '../canvas/canvas.js';
import { NewCell, NewCellWithStyle, goInt } from '../canvas/canvas.js';
import { compareTime, type GoTime } from '../internal/gotime.js';
import { autoCandleWidth, buildOHLCPrice, candleStyle, defaultDownColor, defaultUpColor, drawableTimeRange } from './build.js';
import { FormatValue } from './format.js';
import { isWindowSizeMsg, pointGoTime } from './helpers.js';
import type { NSpec } from './spec.js';

/**
 * OHLCModel is a candlestick chart with a volume panel sharing its time
 * scale, candle widths, colours and Y-axis gutter. The bottom quarter is
 * reserved for volume; X labels appear only below that panel. resize() and
 * draw() retain the spec data. Panning and zooming are not supported.
 */
export class OHLCModel extends canvas.Model {
  private spec: NSpec;

  /** @internal Use Build. */
  constructor(s: NSpec) {
    super(s.width, s.height);
    this.spec = s;
  }

  /** Resize redraws both panels. Undersized windows are blank and recover on resize. */
  override resize(w: number, h: number): void {
    w = Math.max(0, w);
    h = Math.max(0, h);
    super.resize(w, h);
    this.viewWidth = w;
    this.viewHeight = h;
    this.draw();
  }

  /** Update handles window resizing without enabling independent panel pan/zoom. */
  override update(msg: Msg): [OHLCModel, Cmd] {
    if (isWindowSizeMsg(msg)) this.resize(msg.width, msg.height);
    return [this, null];
  }

  /** Draw redraws the retained spec at the current canvas dimensions. */
  draw(): void {
    try {
      this.drawPanels();
    } catch {
      // Go's Draw discards draw's error: the canvas stays cleared
    }
  }

  /** @internal drawPanels is Go's draw: it throws where draw returns an error. */
  drawPanels(): void {
    this.clear();
    const s: NSpec = { ...this.spec, width: this.width(), height: this.height() };
    if (s.height < 7) throw new Error('spec: ohlc volume requires at least 7 rows');
    const rows = Math.max(2, Math.trunc((s.height - 2) / 4));
    s.height -= rows;
    let maxV = 0;
    for (const ser of s.data.series ?? []) {
      for (const p of ser.ohlc ?? []) {
        if (p.v !== null) maxV = Number.isNaN(p.v) ? NaN : Math.max(maxV, p.v);
      }
    }
    const label = FormatValue({ kind: 'si' }, maxV);
    const price = buildOHLCPrice(s, label.length);
    // Preserve the price canvas exactly, moving its two X-axis rows below volume.
    const top = price.height() - 2;
    for (let y = 0; y < price.height(); y++) {
      const dest = y >= top ? y + rows : y;
      for (let x = 0; x < this.width(); x++) this.setCell({ x, y: dest }, price.canvas.cell({ x, y }));
    }
    const gutter = price.origin().x;
    // The relocated baseline belongs to volume, not the price minimum.
    for (let x = 0; x < gutter; x++) this.setCell({ x, y: this.height() - 2 }, NewCell(' '));
    if (gutter > 0) this.setCell({ x: gutter - 1, y: this.height() - 2 }, NewCellWithStyle('0', price.labelStyle));
    for (let y = top; y < top + rows; y++) this.setCell({ x: gutter, y }, NewCellWithStyle('│', price.axisStyle));
    for (let i = 0; i < label.length; i++) {
      this.setCell({ x: gutter - label.length + i, y: top }, NewCellWithStyle(label[i], price.labelStyle));
    }
    const pts = s.data.series![0].ohlc!;
    const times: GoTime[] = pts.map((p) => pointGoTime(p.t) ?? { ms: -62135596800000, ns: 0 });
    let tMin = times[0];
    let tMax = times[0];
    for (const t of times.slice(1)) {
      if (compareTime(t, tMin) < 0) tMin = t;
      if (compareTime(t, tMax) > 0) tMax = t;
    }
    [tMin, tMax] = drawableTimeRange(tMin, tMax);
    const width = autoCandleWidth(price.graphWidth(), times, tMin, tMax);
    const scale = price.graphWidth() / (price.viewMaxX() - price.viewMinX());
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.v === null || p.v === 0 || maxV === 0) continue;
      const x = (times[i].ms / 1e3 - price.viewMinX()) * scale;
      const center = price.candleColumn(x, width);
      const style = p.c < p.o ? candleStyle(s.theme, 1, defaultDownColor) : candleStyle(s.theme, 0, defaultUpColor);
      const height = Math.max(1, goInt(Math.ceil((p.v / maxV) * rows)));
      for (let col = center - Math.trunc((width - 1) / 2); col <= center + Math.trunc(width / 2); col++) {
        if (col <= gutter || col >= price.graphRight()) continue;
        for (let y = top + rows - height; y < top + rows; y++) this.setCell({ x: col, y }, NewCellWithStyle('█', style));
      }
    }
  }
}

/** @internal buildOHLCVolume builds an OHLC spec with a volume panel. */
export function buildOHLCVolume(s: NSpec): OHLCModel {
  const m = new OHLCModel(s);
  m.drawPanels();
  return m;
}
