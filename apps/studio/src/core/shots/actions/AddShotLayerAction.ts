import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Puts a layer on top of what a shot draws, materialising the proposal
 * first where the partition is still one. Commits the previous state so
 * the operation is one undo step.
 */
export class AddShotLayerAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
  ) {}

  execute(shotId: string, layer: ShotLayer): void {
    const current = this.materializer.materializeFrom(this.store.snapshot());
    const next = current.withLayerAdded(shotId, layer);
    if (next === current) return;
    this.store.commit('Add layer');
    this.store.patch({ shots: next });
  }
}
