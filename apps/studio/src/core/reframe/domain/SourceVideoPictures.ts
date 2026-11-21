import type { ProjectFramePictureSet } from '@core/export/domain/ProjectFramePictures';

/**
 * The source video's own picture at chosen moments: the whole of it,
 * before the output frame crops it, with no layer or caption on it. The
 * caller closes the bitmaps.
 */
export interface SourceVideoPictures {
  pictureAt(sourceSecs: ReadonlyArray<number>, signal: AbortSignal): Promise<ProjectFramePictureSet>;
}
