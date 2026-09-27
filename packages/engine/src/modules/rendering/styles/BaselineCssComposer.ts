import { DECORATION_CONTAINER_BASELINE_CSS } from '@modules/rendering/styles/DecorationContainerBaselineCss';
import { VIDEO_FRAME_LAYER_BASELINE_CSS } from '@modules/rendering/styles/VideoFrameLayerBaselineCss';
import { FROZEN_FRAME_CSS } from '@modules/rendering/styles/FrozenFrameCss';
import { LINE_NO_WRAP_CSS } from '@modules/rendering/styles/LineNoWrapCss';
import { CssLayer } from '@modules/css/CssLayer';

/**
 * CSS that applies to every rendered subtree regardless of which
 * baseline blocks the style opts into. Keep this minimal — every byte
 * here ships in every frame of every export.
 */
const UNIVERSAL_BASELINE_CSS = `html { font-size: 16px; text-rendering: geometricPrecision; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
${LINE_NO_WRAP_CSS}
.segment { position: relative; }
${FROZEN_FRAME_CSS}`;

/**
 * Optional baseline CSS blocks a prepared style depends on. Each flag
 * gates a chunk of baseline CSS that would otherwise ship unused
 * bytes into every rendered SVG.
 */
export interface BaselineNeeds {
  readonly decorations: boolean;
  readonly videoFrame: boolean;
}

/**
 * Builds the baseline CSS string that prefixes a style's own rules.
 * Only the blocks the style declares it needs are appended, so a
 * decoration-free template doesn't carry the `.word-decoration` rules
 * and a template that ignores the video frame doesn't carry the
 * video-frame layer rule.
 *
 * The result is wrapped in {@link CssLayer.FRAMEWORK}. Emitting it
 * first also establishes that layer as the earliest one, which is what
 * makes the baseline's `!important` rules unbeatable by anything a
 * consumer layers after it — and, for normal declarations, what lets a
 * consumer override the baseline without out-specifying it.
 */
export class BaselineCssComposer {

  compose(needs: BaselineNeeds): string {
    return this.layered(UNIVERSAL_BASELINE_CSS + this.optionalBlocks(needs));
  }

  /**
   * The optional blocks alone, for a consumer rendering into a document
   * that already supplies the universal half.
   *
   * The layer is the reason this exists rather than the blocks being
   * pasted in directly. An unlayered rule beats every layered one at any
   * specificity, so a baseline left outside would quietly outrank the
   * stylesheet it is a baseline *for* — and a consumer that renders the
   * same caption twice would get two different pictures.
   */
  composeOptional(needs: BaselineNeeds): string {
    return this.layered(this.optionalBlocks(needs));
  }

  private optionalBlocks(needs: BaselineNeeds): string {
    let css = '';
    if (needs.decorations) css += '\n' + DECORATION_CONTAINER_BASELINE_CSS;
    if (needs.videoFrame) css += '\n' + VIDEO_FRAME_LAYER_BASELINE_CSS;
    return css;
  }

  private layered(css: string): string {
    return `@layer ${CssLayer.FRAMEWORK} {\n${css}\n}`;
  }

  /** Composes the union baseline across every needs entry in `perStyle`. */
  composeUnion(perStyle: ReadonlyArray<BaselineNeeds>): string {
    return this.compose({
      decorations: perStyle.some((n) => n.decorations),
      videoFrame: perStyle.some((n) => n.videoFrame),
    });
  }
}
