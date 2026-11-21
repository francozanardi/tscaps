import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Joins a shot into the one before it. Commits the previous state so
 * the operation participates in undo/redo.
 */
export class JoinShotAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  execute(shotId: string): void {
    const snap = this.store.snapshot();
    const current = this.materializer.materializeFrom(snap);
    const next = current.joinIntoPrevious(shotId);
    if (next === current) return;
    this.store.commit('Join shots');
    this.store.patch({ shots: next });
    this.telemetry.partitionEdited('join', snap.shots.isEmpty());
  }
}
