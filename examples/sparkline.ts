/**
 * sparkline.ts: six sparklines fed the same random value.
 * Port of upstream examples/sparkline.
 *
 *   bun examples/sparkline.ts
 *
 * A new random value arrives every 150 ms; any other key pushes one more.
 * The sparklines draw the same data with Draw, DrawColumnsOnly, DrawBraille
 * and DrawQuadrants. q quits.
 */
import { NewProgram, NewView, Quit, Tick, type Cmd, type Model, type Msg, type View } from '@oakoliver/bubbletea';
import { newStyle, normalBorder, joinHorizontal, joinVertical, Top, Left } from '@oakoliver/lipgloss';
import { sparkline } from '../src/index.js';

const box = newStyle().borderStyle(normalBorder()).borderForeground(63); // purple
const titleStyle = newStyle().foreground(3); // yellow
const blockStyle = newStyle().foreground(63);
const blockStyle2 = newStyle().foreground(9).background(2); // red on green
const blockStyle3 = newStyle().foreground(6).background(3); // cyan on yellow
const blockStyle4 = newStyle().foreground(3);

const tick = (): Cmd => Tick(150, () => ({ _tag: 'SparkTick' }) as unknown as Msg);

class SparkModel implements Model {
  random = 0;
  constructor(public s: sparkline.Model[], public max: number) {}

  init(): Cmd {
    return tick();
  }

  update(msg: Msg): [Model, Cmd] {
    let again: Cmd = null;
    if (msg?._tag === 'KeyPressMsg') {
      if (['q', 'ctrl+c'].includes(msg.toString())) return [this, Quit];
    } else if ((msg as { _tag?: string } | null)?._tag === 'SparkTick') again = tick();
    else return [this, null];

    this.random = Math.random() * this.max;
    // add same random value to all sparklines
    for (const s of this.s) s.push(this.random);
    // call different draw functions with different style combinations
    const [s1, s2, s3, s4, s5, s6] = this.s;
    s1.draw();
    s2.drawColumnsOnly();
    s3.draw();
    s4.draw();
    s5.drawBraille();
    s6.drawQuadrants();
    return [this, again];
  }

  view(): View {
    const [s1, s2, s3, s4, s5, s6] = this.s;
    const s =
      'a random value is pushed to all sparklines every 150ms, any key pushes one more, q/ctrl+c to quit\n' +
      joinHorizontal(Top,
        box.render('Draw() w/o background\n' + s1.view()),
        box.render(titleStyle.render('style w/ background') + '\nDrawColumnsOnly()\n' + s2.view() + '\nDraw()\n' + s3.view()),
        joinVertical(Left,
          box.render(`Max: ${this.max.toFixed(0)}, Random: ${this.random.toFixed(2)}`),
          box.render('Draw() w/ background\n' + s4.view() + '\nDrawBraille()\n' + s5.view() + '\nDrawQuadrants()\n' + s6.view()))) +
      '\n';
    const v = NewView(s);
    v.altScreen = true;
    return v;
  }
}

const [width, height, max] = [25, 12, 100];
const m = new SparkModel(
  [
    sparkline.New(width, height, sparkline.WithMaxValue(max), sparkline.WithStyle(blockStyle)),
    sparkline.New(width, Math.trunc(height / 2) - 1, sparkline.WithMaxValue(max), sparkline.WithStyle(blockStyle2)),
    sparkline.New(width, Math.trunc(height / 2) - 1, sparkline.WithMaxValue(max), sparkline.WithStyle(blockStyle2)),
    sparkline.New(width, Math.trunc(height / 4), sparkline.WithMaxValue(max), sparkline.WithStyle(blockStyle3)),
    sparkline.New(width, Math.trunc(height / 4), sparkline.WithMaxValue(max), sparkline.WithStyle(blockStyle4)),
    sparkline.New(width, Math.trunc(height / 4), sparkline.WithMaxValue(max), sparkline.WithStyle(blockStyle4)),
  ],
  max,
);
await NewProgram(m).run();
