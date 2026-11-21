import type { NormalizedBbox } from '@core/person-segmentation/domain/NormalizedBbox';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';

/** A person seen in a frame: the box around what was seen of them and where their head is, shares of the picture. */
export interface SeenPerson {
  readonly box: NormalizedBbox;
  readonly head: PicturePosition;
}
