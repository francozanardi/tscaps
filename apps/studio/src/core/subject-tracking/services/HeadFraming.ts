import type { CropSize } from '@core/subject-tracking/domain/CropSize';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';

// The head sits a third of the way down the crop, not in its middle: the crop's centre is this share of its height below the head.
const CENTRE_BELOW_HEAD = 1 / 2 - 1 / 3;

/**
 * Where a crop of a given size is centred to frame a head: across, on
 * the head; down, with the head a third of the way from the crop's top.
 * Always a centre that keeps the whole crop inside the picture.
 */
export class HeadFraming {
  /** The centre of a `crop`-sized crop that frames `head`. */
  centreFor(head: PicturePosition, crop: CropSize): PicturePosition {
    return this.inside({ x: head.x, y: head.y + crop.height * CENTRE_BELOW_HEAD }, crop);
  }

  /** `centre` moved as little as it takes for a `crop`-sized crop around it to stay inside the picture. */
  inside(centre: PicturePosition, crop: CropSize): PicturePosition {
    return { x: this.within(centre.x, crop.width), y: this.within(centre.y, crop.height) };
  }

  private within(value: number, side: number): number {
    const half = Math.min(side, 1) / 2;
    return Math.min(1 - half, Math.max(half, value));
  }
}
