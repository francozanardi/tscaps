import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import type { StyledElementType } from '@core/elements/domain/types/StyledElementType';

/**
 * A glyph riding a word — today, an emoji.
 *
 * Offers almost nothing the words around it offer, because almost none
 * of it means anything here: an emoji has no typeface to pick and no
 * colour to set, and asking for either would be a field that changes
 * nothing on screen. What is left is how big it is, how far it is
 * turned, and where it sits.
 *
 * Its size is the same relative one a word takes. A glyph is sized
 * against the word it rides in the first place, so keeping it that way
 * is what lets a template that grows short lines carry the glyph up
 * with them — the growth arrives through the word, and a ratio follows
 * it without anyone arranging for it to.
 */
export class DecorationElementType implements StyledElementType {
  readonly surface: ElementStyleSurface = 'text';

  constructor(private readonly library: ElementFieldLibrary) {}

  fields(): ReadonlyArray<ElementField> {
    return this.library.pick(ElementFieldId.RELATIVE_SIZE, ElementFieldId.ROTATION);
  }

  /** Itself, as it comes in and as it leaves. A glyph wraps nothing. */
  animationScopes(): ReadonlyArray<ElementAnimationScope> {
    return [ElementAnimationScope.SELF, ElementAnimationScope.EXIT];
  }

  canBePlaced(): boolean {
    return true;
  }
}
