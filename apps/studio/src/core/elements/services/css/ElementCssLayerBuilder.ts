import { DataAttribute } from '@tscaps/engine';
import { type CssBlockSealer, type CssKeyframeNamespacer, type CssMinifier } from '@tscaps/engine/advanced';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import type { CssKeyframesLifter } from '@core/elements/services/css/CssKeyframesLifter';
import type { LineTypographyRereads } from '@core/elements/services/css/LineTypographyRereads';

const NON_IDENTIFIER_CHARACTERS = /[^a-zA-Z0-9_-]/g;
const ATTRIBUTE_VALUE_SPECIAL_CHARACTERS = /["\\]/g;

/**
 * Assembles what elements say about themselves into one cascade layer:
 * each element's CSS under `[data-tscaps-el="<id>"]`, in the order given.
 *
 * A fragment is stored as declarations without a selector, so the
 * selector is written here and a fragment moved to another element
 * needs no rewriting. Nested rules ride along inside the wrapper, but
 * `@keyframes` cannot live inside a style rule: those are lifted out
 * and renamed per element first, since keyframe names are global and
 * two elements both defining `fade-in` would otherwise share whichever
 * came last. The keyframes sit outside the layer: they define no
 * declarations, so layering them would only make the name resolution
 * depend on order the rename already settles.
 *
 * Fragments are sealed before they go in. One with an unbalanced brace
 * would otherwise close the layer early and leave every fragment after
 * it unlayered — one element's typo silently changing who wins for all
 * the others.
 */
export class ElementCssLayerBuilder {
  constructor(
    private readonly keyframeNamespacer: CssKeyframeNamespacer,
    private readonly minifier: CssMinifier,
    private readonly sealer: CssBlockSealer,
    private readonly lifter: CssKeyframesLifter,
    private readonly lineRereads: LineTypographyRereads,
  ) {}

  /** The layer named `layerName` holding `styles`, or an empty string when none of them says anything. */
  build(styles: ReadonlyArray<readonly [string, ElementStyle]>, layerName: string): string {
    const rules: string[] = [];
    const keyframes: string[] = [];
    let position = 0;
    for (const [elementId, style] of styles) {
      const sealed = this.sealer.seal(this.minifier.minify(this.cssOf(style))).css;
      const namespaced = this.keyframeNamespacer.namespace(sealed, this.keyframeKeyFor(elementId, position));
      position++;
      const { hoisted, remaining } = this.lifter.lift(namespaced);
      keyframes.push(...hoisted);
      if (remaining.trim().length > 0) {
        rules.push(`[${DataAttribute.ELEMENT_ID}="${this.escapeAttributeValue(elementId)}"] {\n${remaining.trim()}\n}`);
      }
    }
    if (rules.length === 0 && keyframes.length === 0) return '';
    const layered = rules.length > 0 ? `@layer ${layerName} {\n${rules.join('\n')}\n}` : '';
    return [keyframes.join('\n'), layered].filter(Boolean).join('\n');
  }

  /** The element's own CSS, after the declarations a line adds so that its fields reach its words. */
  private cssOf(style: ElementStyle): string {
    const rereads = this.lineRereads.declarationsFor(style);
    return rereads.length === 0 ? style.css : `${rereads}\n${style.css}`;
  }

  /**
   * A keyframe-name suffix unique to this element and spellable as a CSS
   * identifier.
   *
   * Element ids are opaque and some carry punctuation — a decoration's
   * is built from its host word's. Dropped into a name verbatim, one
   * stray character makes the whole `@keyframes` block a syntax error
   * and takes the animation that referenced it down with it, silently.
   * The position is what guarantees uniqueness, since two ids can differ
   * only in the characters being replaced; the id itself rides along so
   * the name still says what it belongs to.
   */
  private keyframeKeyFor(elementId: string, position: number): string {
    return `${elementId.replace(NON_IDENTIFIER_CHARACTERS, '-')}-${position}`;
  }

  /** Escapes what would otherwise end the quoted attribute value early. */
  private escapeAttributeValue(value: string): string {
    return value.replace(ATTRIBUTE_VALUE_SPECIAL_CHARACTERS, '\\$&');
  }
}
