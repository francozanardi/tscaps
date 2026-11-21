import type { RenderTimeMap } from '@tscaps/engine';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotLayerReplayRange } from '@presentation/shots/services/ShotLayerReplayRangeResolver';

// Played either side of the transition, so it is seen to start from the
// shot before and to settle into the next.
const PADDING_SEC = 0.3;
// The output's end is the first instant past its last frame.
const LAST_FRAME_SEC = 1 / 60;

/** Which stretch of the video plays a transition between shots, with a moment of either shot around it. */
export class ShotTransitionReplayRangeResolver {
  /**
   * The stretch, in source time, around the transition into `shotId`;
   * null where that shot has none or is gone. `videoDurationSec` closes
   * the output. `leadSec` is how long before the cut something heard
   * with it starts (its sound), which the stretch starts early enough
   * to take in.
   */
  resolve(
    shotId: string,
    shots: ShotPartition,
    timeMap: RenderTimeMap,
    videoDurationSec: number,
    leadSec = 0,
  ): ShotLayerReplayRange | null {
    const transition = shots.list().find((shot) => shot.id === shotId);
    if (transition?.transition === undefined) return null;
    const cutSec = timeMap.toOutputTime(transition.startSec);
    const reachSec = transition.transition.durationSec / 2 + PADDING_SEC;
    const lastSec = timeMap.toOutputTime(videoDurationSec) - LAST_FRAME_SEC;
    const startSec = timeMap.toSourceTime(Math.max(0, cutSec - Math.max(reachSec, leadSec + PADDING_SEC)));
    const endSec = timeMap.toSourceTime(Math.min(lastSec, cutSec + reachSec));
    return endSec > startSec ? { startSec, endSec } : null;
  }
}
