import * as streamlinechart from '@oakoliver/ntcharts/linechart/streamlinechart';

const slc = streamlinechart.New(13, 10);
for (const v of [4, 6, 8, 10, 8, 6, 4, 2, 0, 2, 4]) slc.push(v);
slc.draw();
console.log(slc.view());
