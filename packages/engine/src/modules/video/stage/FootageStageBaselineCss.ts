import { CssClass } from '@modules/document/CssClass';
import { CssLayer } from '@modules/css/CssLayer';

/**
 * How a stage's animations run: `frozen` pauses every one, so each holds
 * the moment its clock says, which is how a frame is resolved;
 * `running` lets them play on their own, for a box shown moving.
 */
export type FootageStageClock = 'frozen' | 'running';

/**
 * The stage's own rules, which a `FootageStyle` stylesheet is written
 * over: the stage a size container of the frame's size that clips what
 * leaves it, and each box absolutely placed over the whole of it,
 * covering, with no margin, padding or border. Frozen, every box's
 * animations are paused, `!important`.
 *
 * All of it in the `CssLayer.FRAMEWORK` cascade layer, so it goes first
 * in the stylesheet: anything after it wins, and nothing after it can
 * set a frozen box's animations running.
 *
 * A consumer showing a stage of its own — a box playing in a page, a
 * thumbnail — writes it with these rules, so it looks as resolved.
 */
export class FootageStageBaselineCss {
  compose(frameWidth: number, frameHeight: number, clock: FootageStageClock): string {
    const rules = [
      `.${CssClass.FOOTAGE_STAGE} { position: relative; overflow: hidden; container-type: size;`
        + ` width: ${frameWidth}px; height: ${frameHeight}px; }`,
      `.${CssClass.FOOTAGE_LAYER} { position: absolute; box-sizing: border-box; left: 0; top: 0; width: 100%; height: 100%;`
        + ' margin: 0; padding: 0; border: 0; overflow: hidden; object-fit: cover; }',
    ];
    if (clock === 'frozen') rules.push(`.${CssClass.FOOTAGE_LAYER} { animation-play-state: paused !important; }`);
    return `@layer ${CssLayer.FRAMEWORK} {\n${rules.join('\n')}\n}`;
  }
}
