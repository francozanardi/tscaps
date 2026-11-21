import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SetShotCameraAction } from '@core/shots/actions/SetShotCameraAction';
import type { SetShotFollowAction } from '@core/shots/actions/SetShotFollowAction';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotFollowCrop } from '@core/shots/services/ShotFollowCrop';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import type { PlanPersonFollowAction } from '@core/subject-tracking/actions/PlanPersonFollowAction';
import type { PeopleAtMoment } from '@core/subject-tracking/domain/PeopleAtMoment';
import type { SourceStretch } from '@core/subject-tracking/domain/SourceStretch';

/** Who to follow on which shot: the frame the people were seen in and which of them; and who is told how far it has got. */
export interface FollowPersonOnShotInput {
  readonly shotId: string;
  readonly frame: PeopleAtMoment;
  /** An index into `frame.people`. */
  readonly chosen: number;
  readonly signal: AbortSignal;
  /** How far the following is, from 0 to 1. */
  readonly onProgress: (fraction: number) => void;
}

/**
 * Has a shot's own video follow the person picked on it: follows them
 * from the picked frame forwards and backwards through every frame the
 * shot's video is drawn over, with the crop the shot has, and keeps on
 * the shot where they were and the frame they were picked on, with
 * everyone seen in it. A camera and a follow are one or the other, so
 * the shot's camera keeps only how close it came, with no move; all of
 * it as one undo step.
 */
export class FollowPersonOnShotAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly planner: PlanPersonFollowAction,
    private readonly crops: ShotFollowCrop,
    private readonly setFollow: SetShotFollowAction,
    private readonly setCamera: SetShotCameraAction,
  ) {}

  /**
   * Whether someone was followed: false where `chosen` names nobody in
   * the frame, the person cannot be found there again, the shot is not
   * there, or the video's size or the frame's is not known yet. Rejects with an `AbortError` once the signal fires, and with the
   * cause where the video cannot be read or the detector cannot run;
   * nothing is changed then.
   */
  async execute(input: FollowPersonOnShotInput): Promise<boolean> {
    const person = input.frame.people[input.chosen];
    if (person === undefined) return false;
    const state = this.store.snapshot();
    const shots = this.materializer.materializeFrom(state);
    const stretch = this.stretchOf(shots, input.shotId, state.video.duration);
    const picture = state.video.layout;
    if (stretch === null || picture === null || state.frameLayout === null || !(picture.width > 0 && picture.height > 0)) return false;
    const pictureAspectRatio = picture.width / picture.height;
    const followed = await this.planner.execute({
      stretch,
      pick: { sourceSec: input.frame.sourceSec, position: person.head },
      crop: this.crops.of(shots, input.shotId, pictureAspectRatio, state.frameLayout, state.outputFrame),
      held: null,
      signal: input.signal,
      onProgress: input.onProgress,
    });
    if (followed === null) return false;
    const picked = {
      sourceSec: input.frame.sourceSec,
      people: input.frame.people.map(({ box, head }) => ({ box, head })),
      chosen: input.chosen,
    };
    await this.store.withHistoryGroup({ key: `follow:${input.shotId}:${crypto.randomUUID()}`, author: 'person' }, () => {
      this.setFollow.execute(input.shotId, { pictureAspectRatio, heads: followed.heads, picked });
      this.setCamera.holdClosest({ kind: 'shot', shotId: input.shotId });
    });
    return true;
  }

  /** Where the shot's own video is drawn in the source: from its start to the end of the last shot it runs through. */
  private stretchOf(shots: ShotPartition, shotId: string, videoDurationSec: number): SourceStretch | null {
    const run = shots.videoRunOf(shotId);
    const first = run[0];
    const last = run[run.length - 1];
    if (first === undefined || last === undefined) return null;
    const list = shots.list();
    const endSec = list[list.indexOf(last) + 1]?.startSec ?? videoDurationSec;
    return endSec > first.startSec ? { startSec: first.startSec, endSec } : null;
  }
}
