import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';
import type { SeenPerson } from '@core/subject-tracking/domain/SeenPerson';
import type { TrackedHead } from '@core/subject-tracking/domain/TrackedHead';

/**
 * The frame a follow was picked on: when it is shown in the source
 * video, everyone seen in it, from left to right, and which of them is
 * followed (an index into `people`).
 */
export interface FollowPickFrame {
  readonly sourceSec: number;
  readonly people: ReadonlyArray<SeenPerson>;
  readonly chosen: number;
}

/**
 * The person a shot's camera follows: where their head was in the source
 * picture, frame by frame in time order, and the shape of the picture
 * those shares were measured on (its width over its height). Only the
 * heads are kept, not a path: the path is planned from them for the crop
 * the shot has when it is drawn, so a change of output shape, closeness
 * or cuts never leaves it stale. `picked` is the frame the person was
 * picked on, where it is known, so the choice can be shown and changed
 * without looking at the video again. `untilFound` is where the camera
 * looks before the person is first found, where it is known (the
 * framing a reframe chose, which saw them where the detector did not),
 * as the centre of the crop in shares of the picture; without it, the
 * camera holds the first place they were found.
 */
export interface ShotFollow {
  readonly pictureAspectRatio: number;
  readonly heads: ReadonlyArray<TrackedHead>;
  readonly picked?: FollowPickFrame;
  readonly untilFound?: PicturePosition;
}
