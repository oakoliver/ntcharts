import * as tslc from '@oakoliver/ntcharts/linechart/timeserieslinechart';

const chart = tslc.New(41, 10);
const day = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 10, 1);
[0, 4, 8, 10, 8, 4, 0, -4, -8, -10, -8, -4, 0].forEach((v, i) => {
  chart.push({ time: new Date(start + i * day), value: v });
});
chart.drawBraille();
console.log(chart.view());
