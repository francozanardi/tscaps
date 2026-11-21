import type { CssBlockSealer, CssKeyframeNamespacer, CssMinifier } from '@tscaps/engine/advanced';
import { CaptionCssLayer } from '@core/captions/domain/CaptionCssLayer';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { CssKeyframesLifter } from '@core/elements/services/css/CssKeyframesLifter';
import type { ElementCssLayerBuilder } from '@core/elements/services/css/ElementCssLayerBuilder';
import type { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';

// The sheet's blocks address different kinds, so one key for all of
// them can never collide with itself.
const SHEET_KEYFRAME_KEY = 'sheet';

/**
 * Assembles the CSS a caption renders with, one cascade layer per
 * question answered: the template it started from, what the sheet said
 * about every element of a kind, and what one element said about
 * itself. Each wins over the one before it by arriving later, so none
 * of them has to out-specify another.
 *
 * What one element said about itself is assembled by
 * {@link ElementCssLayerBuilder}: each fragment under its element's
 * selector, sealed, its keyframes renamed per element and lifted out.
 *
 * The elements that wrap others are written first. A fragment can carry
 * a rule for what is inside the element, which meets that element's own
 * fragment at the same weight in the same layer, and then only the
 * order they were written in decides.
 */
export class LayeredCaptionCssBuilder {
  constructor(
    private readonly keyframeNamespacer: CssKeyframeNamespacer,
    private readonly minifier: CssMinifier,
    private readonly sealer: CssBlockSealer,
    private readonly lifter: CssKeyframesLifter,
    private readonly elementLayer: ElementCssLayerBuilder,
  ) {}

  build(templateCss: string, animations: SheetAnimationSet, styles: ElementStyles): string {
    const layers = [`@layer ${CaptionCssLayer.TEMPLATE} {\n${templateCss}\n}`];
    const sheetLayer = this.buildSheetLayer(animations);
    if (sheetLayer) layers.push(sheetLayer);
    const elementLayer = this.elementLayer.build(styles.outermostFirst(), CaptionCssLayer.ELEMENT);
    if (elementLayer) layers.push(elementLayer);
    return layers.join('\n');
  }

  /**
   * What the sheet says about every element of a kind.
   *
   * Its keyframes are namespaced under one key for the whole sheet:
   * the blocks address different kinds, and a name two of them define
   * is the same library block twice, so keeping the names off the scope
   * means two sheets picking one entrance still get a definition each.
   */
  private buildSheetLayer(animations: SheetAnimationSet): string {
    const css = animations.css();
    if (css.trim().length === 0) return '';
    const sealed = this.sealer.seal(this.minifier.minify(css)).css;
    const namespaced = this.keyframeNamespacer.namespace(sealed, SHEET_KEYFRAME_KEY);
    const { hoisted, remaining } = this.lifter.lift(namespaced);
    const layer = `@layer ${CaptionCssLayer.SHEET} {\n${remaining.trim()}\n}`;
    return hoisted.length > 0 ? `${hoisted.join('\n')}\n${layer}` : layer;
  }
}
