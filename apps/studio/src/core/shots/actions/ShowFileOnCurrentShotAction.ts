import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import type { ShowFileOnShotAction } from '@core/shots/actions/ShowFileOnShotAction';

// A seek to where a shot opens comes back through source → output →
// source time, and floating point can land it a hair early — on the
// shot before the one the reader is looking at.
const ROUND_TRIP_SLACK_SEC = 1e-6;

/**
 * Shows a file on the shot under the playhead, the way
 * {@link ShowFileOnShotAction} shows it on a shot named by id, and
 * refuses what it refuses. Resolves to the id of that shot, or null
 * when there is no shot to show it on — a video with no shots yet.
 */
export class ShowFileOnCurrentShotAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly showFile: ShowFileOnShotAction,
  ) {}

  async execute(mediaId: string): Promise<string | null> {
    const state = this.store.snapshot();
    const shot = this.materializer.materializeFrom(state).at(state.video.currentTime + ROUND_TRIP_SLACK_SEC);
    if (!shot) return null;
    await this.showFile.execute(shot.id, mediaId, 'bin-current-shot');
    return shot.id;
  }
}
