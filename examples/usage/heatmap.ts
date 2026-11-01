import * as heatmap from '@oakoliver/ntcharts/heatmap';

// visits per day and time of day; each value fills one cell of the grid
const days = ['Mon', 'Tue', 'Wed'];
const hours = ['00h', '06h', '12h', '18h'];
const visits = [
  [2, 9, 14, 6],
  [1, 11, 16, 8],
  [3, 7, 12, 10],
];
const hm = heatmap.New(24, 8, heatmap.WithValueRange(0, 16), heatmap.WithCellSize(1, 1));
hm.setXLabels(hours);
hm.setYLabels([...days].reverse()); // rows count up from the bottom
visits.forEach((row, d) => row.forEach((v, h) => hm.push(heatmap.NewHeatPointInt(h, days.length - 1 - d, v))));
hm.draw();
console.log(hm.view());
