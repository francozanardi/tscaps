import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import type { StyledElementType } from '@core/elements/domain/types/StyledElementType';

/**
 * One caption on screen, wrapping the words it is made of.
 *
 * Offers the same fields a word does — a caption is restyled the same
 * way a word in it is — but reaches them through the template's
 * variables, since the declarations that paint the text sit on the
 * words inside it.
 */
export class SegmentElementType implements StyledElementType {
  readonly surface: ElementStyleSurface = 'wrapper';

  constructor(private readonly library: ElementFieldLibrary) {}

  fields(): ReadonlyArray<ElementField> {
    return this.library.pick(
      ElementFieldId.ITALIC,
      ElementFieldId.UNDERLINE,
      ElementFieldId.STRIKETHROUGH,
      ElementFieldId.FONT_FAMILY,
      ElementFieldId.FONT_SIZE,
      ElementFieldId.FONT_WEIGHT,
      ElementFieldId.PRIMARY_COLOR,
      ElementFieldId.ROTATION,
    );
  }

  /**
   * Itself, its words, and the glyphs attached to them — three answers
   * because they are three questions — each as it comes in and as it
   * leaves.
   *
   * The glyphs are their own scope rather than riding on the words:
   * whether a glyph even sits inside its word is the sheet's emoji
   * placement to decide, so an answer given to the words reaches them
   * under one setting and not under the others. This one holds however
   * the glyph is painted.
   */
  animationScopes(): ReadonlyArray<ElementAnimationScope> {
    return [
      ElementAnimationScope.SELF,
      ElementAnimationScope.WORDS,
      ElementAnimationScope.EMOJIS,
      ElementAnimationScope.EXIT,
      ElementAnimationScope.WORDS_EXIT,
      ElementAnimationScope.EMOJIS_EXIT,
    ];
  }

  canBePlaced(): boolean {
    return true;
  }
}
