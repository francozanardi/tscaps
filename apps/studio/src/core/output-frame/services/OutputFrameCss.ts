import { CssClass, DataAttribute } from '@tscaps/engine';
import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { OutputFrameLayerId } from '@core/output-frame/domain/OutputFrameLayerId';

const BACKDROP_BLUR_CQMIN = 4;
// Grown past the frame so the blur does not fade out at its edges.
const BACKDROP_SCALE = 1.1;
const CENTRED = 0.5;
// What the framework's crop reads off a box showing the video's own picture: where the frame crops it, and whether it is fitted.
const FRAME_PICTURE_X = '--layer-frame-picture-x';
const FRAME_PICTURE_Y = '--layer-frame-picture-y';
const PICTURE_FITTED = '--layer-picture-fitted';

/**
 * Writes the rules that put the video's own picture where it goes, on
 * the boxes showing it: how it fills or fits the output frame, where a
 * filled one is cropped, and the blurred copy beneath a fitted one.
 *
 * The crop itself — a box grown past its layout by its camera's
 * closeness, moved to keep the share it looks at, and its picture placed
 * there, at both ends of a move — is the framework's, for every box
 * (`presets/layer/stage/stage.scss`). This hands it what is the
 * project's: where the frame crops the video's own picture
 * (`--layer-frame-picture-x` and `-y`, which a shot's own position
 * fields win over) and whether the picture is fitted whole in its box
 * (`--layer-picture-fitted`).
 *
 * They belong in the framework's cascade layer, after its rule for every
 * box, so a layer's own CSS still wins over them.
 */
export class OutputFrameCss {
  rules(frame: OutputFrame): string[] {
    const filled = !frame.isOriginal() && frame.fit === 'fill';
    const fitted = !frame.isOriginal() && frame.fit === 'fit';
    const position = filled ? frame.position : { x: CENTRED, y: CENTRED };
    const ownPicture = `.${CssClass.FOOTAGE_SOURCE_PICTURE}`;
    const rules = [`${ownPicture} { ${FRAME_PICTURE_X}: ${this.number(position.x)}; ${FRAME_PICTURE_Y}: ${this.number(position.y)};`
      + ` ${PICTURE_FITTED}: ${fitted ? 1 : 0}; }`];
    if (frame.isOriginal()) return rules;
    if (frame.fit === 'fill') return [...rules, `${ownPicture} { object-fit: cover; }`];
    return [
      ...rules,
      `${ownPicture} { object-fit: contain; }`,
      `${this.selectorOf(OutputFrameLayerId.BACKDROP)} { object-fit: cover;`
        + ` filter: blur(${BACKDROP_BLUR_CQMIN}cqmin); transform: scale(${BACKDROP_SCALE}); }`,
    ];
  }

  private number(share: number): string {
    return `${Number(share.toFixed(5))}`;
  }

  private selectorOf(id: OutputFrameLayerId): string {
    return `.${CssClass.FOOTAGE_SOURCE_PICTURE}[${DataAttribute.ELEMENT_ID}="${id}"]`;
  }
}
