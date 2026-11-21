import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Opens a shot at `sec`, materialising the proposal first where the
 * partition is still one. Commits the previous state so the operation
 * participates in undo/redo.
 *
 * The new shot is cut out of the same footage, and keeps the level its
 * video's own sound was given: both halves play it alike.
 */
export class SplitShotAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  execute(sec: number): void {
    const snap = this.store.snapshot();
    const current = this.materializer.materializeFrom(snap);
    const id = crypto.randomUUID();
    const next = current.splitAt(sec, id);
    if (next === current) return;
    const split = current.at(sec);
    const audio = split === null ? snap.audio : snap.audio.withShotVideoVolume([id], snap.audio.shotVideoVolumeOf(split.id));
    this.store.commit('Split shot');
    this.store.patch(audio === snap.audio ? { shots: next } : { shots: next, audio });
    this.telemetry.partitionEdited('split', snap.shots.isEmpty());
  }
}
