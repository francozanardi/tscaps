import type { EditorStore } from '@core/editor/store/EditorStore';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';

/**
 * Removes every cut on the active video, restoring it to its source
 * timeline. No-op when no cuts exist. Commits the previous state so
 * the operation participates in undo/redo.
 */
export class ClearAllCutsAction {
  constructor(private readonly store: EditorStore) {}

  execute(): void {
    const snap = this.store.snapshot();
    if (snap.cuts.isEmpty()) return;
    this.store.commit();
    this.store.patch({ cuts: CutRegistry.empty() });
  }
}
