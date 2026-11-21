import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Moves where a shot opens, which is the same gesture as growing the
 * one before it. Commits the previous state so the operation
 * participates in undo/redo; a drag on one shot is one undo step.
 */
export class MoveShotStartAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  execute(shotId: string, sec: number): void {
    const snap = this.store.snapshot();
    const current = this.materializer.materializeFrom(snap);
    const next = current.moveStart(shotId, sec);
    if (next === current) return;
    this.store.commit('Move shot start', `shotStart:${shotId}`);
    this.store.patch({ shots: next });
    this.telemetry.partitionEdited('move-boundary', snap.shots.isEmpty());
  }
}
