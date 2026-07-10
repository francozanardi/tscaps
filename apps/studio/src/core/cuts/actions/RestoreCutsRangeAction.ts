import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutRange } from '@core/cuts/domain/CutRegistry';

/**
 * Restores `range` from the editor's cut registry by subtracting it
 * from every overlapping stored cut. A stored cut fully covered by
 * `range` disappears; one with `range` strictly inside it splits in
 * two so only the requested slice is restored. No-op when no cut
 * overlaps. Commits the previous state so the operation
 * participates in undo/redo.
 */
export class RestoreCutsRangeAction {
  constructor(private readonly store: EditorStore) {}

  execute(range: CutRange): void {
    const snap = this.store.snapshot();
    const next = snap.cuts.subtract(range);
    if (next === snap.cuts) return;
    this.store.commit();
    this.store.patch({ cuts: next });
  }
}
