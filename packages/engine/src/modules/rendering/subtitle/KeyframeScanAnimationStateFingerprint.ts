import type { CssKeyframesScanner } from '@modules/css/CssKeyframesScanner';
import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type { AnimationStateFingerprint } from '@modules/rendering/subtitle/AnimationStateFingerprint';

/** The description every timestamp gets when the style has no animation to be at a point in. */
const NO_ANIMATION = '';

// A transition needs a value to change on an element that was already
// laid out, which a subtree built from scratch never has — except
// under `@starting-style`, which runs on first paint.
const TRANSITION_PATTERN = /transition|@starting-style/;

/**
 * Reads the style's CSS. One that neither defines nor applies any
 * `@keyframes`, and declares no transition, has no animation to be at
 * a point in, so it is described the same way at every timestamp.
 * Anything else is never comparable.
 *
 * Coarse: a style is answered for as a whole, so one animation
 * anywhere in it makes every timestamp incomparable, however still the
 * segment being described happens to be.
 *
 * Defining a `@keyframes` counts even where nothing applies it, which
 * is what covers `animation: var(--name)` — the name is not in the
 * declaration to be found, and only the block gives it away.
 *
 * Every source of CSS the style carries is read, including the inline
 * styles its overrides put on single elements.
 *
 * Read once per style: a prepared style's CSS does not change, and it
 * can carry embedded font faces, which makes it large. The answer is
 * held against the style itself, so one prepared from different CSS is
 * never given another's.
 */
export class KeyframeScanAnimationStateFingerprint implements AnimationStateFingerprint {
  private readonly movesByStyle = new WeakMap<PreparedStyle, boolean>();

  constructor(private readonly keyframesScanner: CssKeyframesScanner) {}

  at(style: PreparedStyle): Promise<string | null> {
    return Promise.resolve(this.moves(style) ? null : NO_ANIMATION);
  }

  private moves(style: PreparedStyle): boolean {
    const known = this.movesByStyle.get(style);
    if (known !== undefined) return known;
    const css = this.everyDeclarationOf(style);
    const moves = this.keyframesScanner.definedNames(css).size > 0
      || this.keyframesScanner.referencedNames(css).size > 0
      || TRANSITION_PATTERN.test(css);
    this.movesByStyle.set(style, moves);
    return moves;
  }

  private everyDeclarationOf(style: PreparedStyle): string {
    return [
      style.baselineCss,
      style.scopedCss,
      this.serialize(style.inlineStyles),
      ...[...style.segmentOverrides.values(), ...style.subtreeOverrides.values()]
        .map((override) => this.serialize(override.inlineStyles)),
    ].join(';');
  }

  private serialize(inlineStyles: InlineStyleMap | undefined): string {
    if (!inlineStyles) return '';
    return Object.entries(inlineStyles).map(([property, value]) => `${property}:${value}`).join(';');
  }
}
