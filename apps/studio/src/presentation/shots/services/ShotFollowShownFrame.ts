import type { FollowPickFrame } from '@core/shots/domain/ShotFollow';
import type { PeopleAtMoment } from '@core/subject-tracking/domain/PeopleAtMoment';
import type { ShotFollowFlowState } from '@presentation/shots/controllers/ShotFollowFlowController';

/**
 * A frame of the shot as a *Follow* section shows it: the people seen in
 * it (none where they are not known on it), which of them is followed
 * (an index into them, or null where none is marked), and whether the
 * camera's view of it is drawn on it instead of the followed person.
 */
export interface ShownFollowFrame {
  readonly frame: PeopleAtMoment;
  readonly chosen: number | null;
  readonly camera: boolean;
}

// How near the frame shown must be to the one the person was picked on for the people seen there to be drawn on it.
const PICKED_FRAME_SLACK_SEC = 0.05;

/**
 * Which frame a shot's *Follow* section shows: the one being picked on
 * or followed from right now; else, while the shot follows someone and
 * nothing is under way, the frame at the moment asked for with the
 * camera's view of it, and the people seen there only where it is the
 * frame they were picked on, the one place they are known; while people
 * are looked for, the one shown before the look began, so the section
 * keeps its place until the answer.
 */
export class ShotFollowShownFrame {
  /**
   * @param picked the frame the shot's follow was picked on, where it is known.
   * @param momentSec the moment of the source to show while the shot follows someone and nothing is under way.
   */
  of(state: ShotFollowFlowState, following: boolean, picked: FollowPickFrame | null, momentSec: number): ShownFollowFrame | null {
    if (state.phase === 'choosing') return { frame: state.frame, chosen: null, camera: false };
    if (state.phase === 'following') return { frame: state.frame, chosen: state.chosen, camera: false };
    if (state.phase === 'looking') return this.of(state.before, following, picked, momentSec);
    if (!following) return null;
    if (picked === null || Math.abs(picked.sourceSec - momentSec) > PICKED_FRAME_SLACK_SEC) {
      return { frame: { sourceSec: momentSec, people: [] }, chosen: null, camera: true };
    }
    return { frame: { sourceSec: picked.sourceSec, people: picked.people }, chosen: picked.chosen, camera: true };
  }
}
