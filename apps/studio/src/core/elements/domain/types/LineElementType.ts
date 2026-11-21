import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import type { StyledElementType } from '@core/elements/domain/types/StyledElementType';

/**
 * One line of a caption, wrapping the words that were laid out on it.
 *
 * Restyled like the caption around it, but never placed: a line is
 * where the layout put it, and lifting one out of the flow would leave
 * the caption it belongs to reflowing around a hole.
 */
export class LineElementType implements StyledElementType {
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

  /** Itself, and every word it wraps, each as it comes in and as it leaves. */
  animationScopes(): ReadonlyArray<ElementAnimationScope> {
    return [
      ElementAnimationScope.SELF,
      ElementAnimationScope.WORDS,
      ElementAnimationScope.EXIT,
      ElementAnimationScope.WORDS_EXIT,
    ];
  }

  canBePlaced(): boolean {
    return false;
  }
}
