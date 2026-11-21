import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Sets the shots a layer shows over: through the shot named, a shot
 * after the one holding it, or, with null, only for its own shot. The
 * layer still opens where its own shot opens, unless it is moved to
 * another shot, or asked to show over the whole video, which moves it
 * to the first shot.
 *
 * Commits the previous state so the operation participates in
 * undo/redo; a run of changes to one layer, one shot picked after
 * another, is one undo step. Does nothing for a layer that is gone, a
 * shot that is not after the layer's own, or the shot the layer already
 * ends with.
 */
export class SetShotLayerThroughAction {
  constructor(private readonly store: EditorStore) {}

  execute(layerId: string, throughShotId: string | null): void {
    const current = this.store.snapshot().shots;
    const next = current.withLayerThrough(layerId, throughShotId);
    if (next === current) return;
    this.store.commit('Change how long a layer shows', `shotLayerThrough:${layerId}`);
    this.store.patch({ shots: next });
  }

  /**
   * Has the layer show over the whole video: it moves to the first shot
   * and shows through the last. One undo step with the changes before it
   * to the same layer, as {@link execute}; nothing for a layer that is
   * gone or already shows over the whole video.
   */
  overWholeVideo(layerId: string): void {
    const current = this.store.snapshot().shots;
    const next = current.withLayerOverWholeVideo(layerId);
    if (next === current) return;
    this.store.commit('Change how long a layer shows', `shotLayerThrough:${layerId}`);
    this.store.patch({ shots: next });
  }

  /**
   * Has the layer open on the shot `shotId` and show through
   * `throughShotId` (null: that shot alone), the same layer with all it
   * holds. One undo step with the changes before it to the same layer,
   * as {@link execute}; nothing where the shots are not the layer's to
   * take or it already shows over exactly them.
   */
  moveTo(layerId: string, shotId: string, throughShotId: string | null): void {
    const current = this.store.snapshot().shots;
    const next = current.withLayerMoved(layerId, shotId, throughShotId);
    if (next === current) return;
    this.store.commit('Change when a layer shows', `shotLayerThrough:${layerId}`);
    this.store.patch({ shots: next });
  }
}
