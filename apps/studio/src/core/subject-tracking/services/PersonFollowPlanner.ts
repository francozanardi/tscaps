import type { CropSize } from '@core/subject-tracking/domain/CropSize';
import type { PersonFollow } from '@core/subject-tracking/domain/PersonFollow';
import type { PersonPick } from '@core/subject-tracking/domain/PersonPick';
import type { PersonTrack } from '@core/subject-tracking/domain/PersonTrack';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';
import type { SightedFrame } from '@core/subject-tracking/domain/SightedFrame';
import type { SourceStretch } from '@core/subject-tracking/domain/SourceStretch';
import type { TrackedHead } from '@core/subject-tracking/domain/TrackedHead';
import type { CameraPathPlanner } from '@core/subject-tracking/services/CameraPathPlanner';
import type { PersonTrackFollower } from '@core/subject-tracking/services/PersonTrackFollower';

/**
 * Plans how a crop follows a picked person through a stretch of the
 * video, from the people seen in its frames: the person is followed
 * from the pick through every frame, and the crop's path is planned on
 * where they were.
 */
export class PersonFollowPlanner {
  constructor(
    private readonly follower: PersonTrackFollower,
    private readonly paths: CameraPathPlanner,
  ) {}

  /**
   * The person `pick` names, followed through `stretch` from `frames`
   * of it in time order, and how a `crop`-sized crop follows them. Where
   * `held` is given and the person stays in the middle of the framing it
   * centres, the plan keeps it. Null where nobody is at the pick.
   */
  plan(
    frames: ReadonlyArray<SightedFrame>,
    pick: PersonPick,
    crop: CropSize,
    stretch: SourceStretch,
    held: PicturePosition | null,
  ): PersonFollow | null {
    const track = this.follower.follow(frames, pick);
    if (track === null) return null;
    const heads = this.headsOf(track);
    const plan = this.paths.plan(heads, crop, stretch, held, null);
    return plan === null ? null : { heads, plan };
  }

  private headsOf(track: PersonTrack): TrackedHead[] {
    return track.steps.flatMap((step) => (step.sighting === null ? [] : [{ sourceSec: step.sourceSec, ...step.sighting.head }]));
  }
}
