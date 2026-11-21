import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';
import type { PictureCutoutReader } from '@core/person-segmentation/domain/PictureCutoutReader';
import type { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';

/**
 * Cuts the people out of one picture with the segmenter worker, started on
 * first use at the mask size `maskMaxSide`. The worker is handed a copy:
 * it closes what it is sent.
 */
export class WorkerPictureCutoutReader implements PictureCutoutReader {
  constructor(
    private readonly worker: PersonSegmenterWorkerClient,
    private readonly maskMaxSide: number,
  ) {}

  async cutout(picture: ImageBitmap): Promise<PersonSegmentationMask> {
    await this.worker.ensureReady(this.maskMaxSide);
    // The worker keeps its own clock increasing; the moment asked only has to be a number.
    return this.worker.segmentPerson(await createImageBitmap(picture), performance.now(), 0);
  }
}
