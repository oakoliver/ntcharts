import { ScaleLog } from '@oakoliver/ntcharts/linechart';
import * as wavelinechart from '@oakoliver/ntcharts/linechart/wavelinechart';

const wlc = wavelinechart.New(24, 10,
  wavelinechart.WithYScale(ScaleLog),
  wavelinechart.WithXYRange(0, 5, 1, 10000));
[3, 40, 500, 6000].forEach((v, i) => wlc.plot({ x: i + 1, y: v }));
wlc.draw();
console.log(wlc.view());
