import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';

/** Who to follow: the person at `position` of the picture shown at `sourceSec` of the source video. */
export interface PersonPick {
  readonly sourceSec: number;
  readonly position: PicturePosition;
}
