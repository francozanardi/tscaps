import type { EditorStore } from '@core/editor/store/EditorStore';

/** Which stretch of its file a layer plays, and whether it starts that stretch over until its shot ends. */
export interface ShotLayerTimingChange {
  readonly inSec: number;
  /** Null plays to the file's own end. */
  readonly outSec: number | null;
  readonly loop: boolean;
}

/**
 * Sets which stretch of its file a layer plays. A stretch that cannot
 * be read falls back the way a stored one does: a bad start to the
 * file's start, an end at or before the start to the file's own end.
 * Commits the previous state so the operation participates in
 * undo/redo; a run of changes to one layer's timing, such as a slider
 * drag, is one undo step. Does nothing for a layer that is gone, or a
 * graphic, which has no stretch of a file.
 */
export class SetShotLayerTimingAction {
  constructor(private readonly store: EditorStore) {}

  execute(layerId: string, timing: ShotLayerTimingChange): void {
    const current = this.store.snapshot().shots;
    const layer = current.findLayer(layerId);
    if (layer === null || !('mediaId' in layer)) return;
    if (layer.inSec === timing.inSec && layer.outSec === timing.outSec && layer.loop === timing.loop) return;
    const next = current.withLayerReplaced({ ...layer, ...timing });
    if (next === current) return;
    this.store.commit('Change layer timing', `shotLayerTiming:${layerId}`);
    this.store.patch({ shots: next });
  }
}
