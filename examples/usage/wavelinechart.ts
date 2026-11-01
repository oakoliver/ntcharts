import * as wavelinechart from '@oakoliver/ntcharts/linechart/wavelinechart';

const wlc = wavelinechart.New(12, 10, wavelinechart.WithYRange(-3, 3));
wlc.plot({ x: 1, y: 2 });
wlc.plot({ x: 3, y: -2 });
wlc.plot({ x: 5, y: 2 });
wlc.plot({ x: 7, y: -2 });
wlc.plot({ x: 9, y: 2 });
wlc.draw();
console.log(wlc.view());
