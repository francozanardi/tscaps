import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import type { StyledElementType } from '@core/elements/domain/types/StyledElementType';

/**
 * Something a shot draws on the frame — a b-roll, a picture, a GIF —
 * styled as a box.
 *
 * It holds no text, so none of a caption's fields mean anything on it;
 * its own say where it sits — a layout and that layout's settings —
 * how a picture fills it, how round its corners are, and — on the box
 * of a shot's own video — how close and where its picture is cropped. It moves in
 * parts of its own life rather than in parts of itself: an entrance on
 * the clock of its start, an exit on the clock of its end, and a motion
 * across its whole stretch, such as a zoom. Where
 * it sits is its CSS's to say, which its fields write; it is never
 * taken out of a flow, since it was never in one.
 */
export class LayerElementType implements StyledElementType {
  readonly surface: ElementStyleSurface = 'box';

  constructor(private readonly library: ElementFieldLibrary) {}

  fields(): ReadonlyArray<ElementField> {
    return this.library.pick(
      ElementFieldId.LAYOUT,
      ElementFieldId.FIT,
      ElementFieldId.BACKDROP,
      ElementFieldId.CORNER_RADIUS,
      ElementFieldId.PADDING,
      ElementFieldId.SPLIT_SIDE,
      ElementFieldId.SPLIT_RATIO,
      ElementFieldId.SPLIT_ENTRANCE,
      ElementFieldId.SPLIT_ENTRANCE_DURATION,
      ElementFieldId.SPLIT_EXIT,
      ElementFieldId.SPLIT_EXIT_DURATION,
      ElementFieldId.CENTER_X,
      ElementFieldId.CENTER_Y,
      ElementFieldId.WIDTH,
      ElementFieldId.ASPECT_RATIO,
      ElementFieldId.CROP_X,
      ElementFieldId.CROP_Y,
      ElementFieldId.PICTURE_X,
      ElementFieldId.PICTURE_Y,
      ElementFieldId.PICTURE_END_X,
      ElementFieldId.PICTURE_END_Y,
      ElementFieldId.INSET_SUBJECT,
      ElementFieldId.INSET_ENTRANCE,
      ElementFieldId.INSET_ENTRANCE_DURATION,
      ElementFieldId.INSET_EXIT,
      ElementFieldId.INSET_EXIT_DURATION,
    );
  }

  animationScopes(): ReadonlyArray<ElementAnimationScope> {
    return [ElementAnimationScope.ENTRANCE, ElementAnimationScope.EXIT, ElementAnimationScope.CAMERA];
  }

  canBePlaced(): boolean {
    return false;
  }
}
