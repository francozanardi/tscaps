import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import type { StyledElementType } from '@core/elements/domain/types/StyledElementType';

/**
 * A single word of the caption.
 *
 * It is the text, so its declarations land on it directly, and it is
 * the one thing a user can pull out of the line and drop anywhere in
 * the frame.
 */
export class WordElementType implements StyledElementType {
  readonly surface: ElementStyleSurface = 'text';

  constructor(private readonly library: ElementFieldLibrary) {}

  fields(): ReadonlyArray<ElementField> {
    return this.library.pick(
      ElementFieldId.ITALIC,
      ElementFieldId.UNDERLINE,
      ElementFieldId.STRIKETHROUGH,
      ElementFieldId.FONT_FAMILY,
      ElementFieldId.RELATIVE_SIZE,
      ElementFieldId.FONT_WEIGHT,
      ElementFieldId.PRIMARY_COLOR,
      ElementFieldId.ROTATION,
    );
  }

  /**
   * Itself, as it comes in and as it leaves. A word holds letters, and
   * the engine only splits them for templates that ask.
   */
  animationScopes(): ReadonlyArray<ElementAnimationScope> {
    return [ElementAnimationScope.SELF, ElementAnimationScope.EXIT];
  }

  canBePlaced(): boolean {
    return true;
  }
}
