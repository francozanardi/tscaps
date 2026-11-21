import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';

/**
 * Cuts the people out of one picture: a mask of where they are, at a
 * reduced size. The picture stays the caller's, open. Rejects where the
 * segmenter cannot run on this device.
 */
export interface PictureCutoutReader {
  cutout(picture: ImageBitmap): Promise<PersonSegmentationMask>;
}
