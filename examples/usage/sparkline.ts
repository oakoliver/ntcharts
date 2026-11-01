import * as sparkline from '@oakoliver/ntcharts/sparkline';

const sl = sparkline.New(10, 3);
sl.pushAll([7.81, 3.82, 8.39, 2.06, 4.19, 4.74, 6.21, 4.41, 9.87, 3.53]);
sl.draw();
console.log(sl.view());
