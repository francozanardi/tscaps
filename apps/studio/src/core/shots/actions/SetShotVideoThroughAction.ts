import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Sets how far a shot's own video is drawn: through the shot named, a
 * shot after it, or, with null, only for its own shot. Its camera, its
 * framing and its CSS then run on as one over those shots, which draw
 * no video of their own; it reaches no further than the shot before the
 * next one whose video has a style of its own.
 *
 * Commits the previous state so the operation participates in
 * undo/redo; a run of changes to one shot, one picked after another, is
 * one undo step. Does nothing for a shot that is gone, one whose video
 * has no style to carry on, a shot that is not after it, or the shot
 * its video already ends with.
 */
export class SetShotVideoThroughAction {
  constructor(private readonly store: EditorStore) {}

  execute(shotId: string, throughShotId: string | null): void {
    const current = this.store.snapshot().shots;
    const next = current.withVideoThrough(shotId, throughShotId);
    if (next === current) return;
    this.store.commit('Change how long a camera runs', `shotVideoThrough:${shotId}`);
    this.store.patch({ shots: next });
  }
}
