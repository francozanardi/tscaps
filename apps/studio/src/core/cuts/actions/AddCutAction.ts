import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutRange } from '@core/cuts/domain/CutRegistry';

/**
 * Adds a cut range to the editor's cut registry. Commits the previous
 * state so the operation participates in undo/redo.
 */
export class AddCutAction {
  constructor(private readonly store: EditorStore) {}

  execute(range: CutRange): void {
    const snap = this.store.snapshot();
    const next = snap.cuts.add(range);
    if (next === snap.cuts) return;
    this.store.commit();
    this.store.patch({ cuts: next });
  }
}
