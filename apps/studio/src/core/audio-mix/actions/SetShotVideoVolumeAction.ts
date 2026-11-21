import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Sets how loud the video's own sound is during every shot named,
 * linear 0 to 2 on top of the video's overall level and clamped there;
 * 0 turns it off for those shots, while music, sound effects and the
 * shots' b-roll sound play on.
 *
 * One undo step; a run of changes to the same shots, such as a slider
 * drag, coalesces into one. Changing a shot of the proposal makes the
 * partition real in the same step, as any other edit of a shot does,
 * keeping the ids the proposal shows. Nothing happens where nothing
 * would change.
 */
export class SetShotVideoVolumeAction {
  constructor(
    private readonly store: EditorStore,
    private readonly shotPartitions: ShotPartitionMaterializer,
  ) {}

  execute(shotIds: ReadonlyArray<string>, volume: number): void {
    const state = this.store.snapshot();
    const audio = state.audio.withShotVideoVolume(shotIds, volume);
    if (audio === state.audio) return;
    const shots = this.shotPartitions.materializeFrom(state);
    this.store.commit('Change video sound', `shotVideoVolume:${[...shotIds].sort().join(',')}`);
    this.store.patch(shots === state.shots ? { audio } : { audio, shots });
  }
}
