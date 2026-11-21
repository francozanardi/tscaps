import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';

/**
 * Throws the edited shots away and goes back to proposing them, cut
 * to `maxShotSec`. The one path back to a computed partition — every
 * other edit leaves it alone. A drag of the length is one undo step.
 */
export class ReproposeShotsAction {
  constructor(
    private readonly store: EditorStore,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  execute(maxShotSec: number): void {
    const current = this.store.snapshot().shots;
    const next = current.reproposed(maxShotSec);
    if (next === current) return;
    this.store.commit('Recalculate shots', 'shotsRepropose');
    this.store.patch({ shots: next });
    this.telemetry.partitionReproposed(maxShotSec, !current.isEmpty());
  }
}
