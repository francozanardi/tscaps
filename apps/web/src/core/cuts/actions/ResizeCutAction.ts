import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutRange } from '@core/cuts/domain/CutRegistry';

/**
 * Replaces `originalRange` in the editor's cut registry with
 * `newRange`. The replacement is performed as a subtract-then-add so
 * the new range fuses with any adjacent or overlapping stored cut, and
 * a stored cut split by the subtraction settles back into the merged
 * result on the same commit. No-op when the registry already matches
 * the requested edit. Commits the previous state so the operation
 * participates in undo/redo as a single entry.
 */
export class ResizeCutAction {
  constructor(private readonly store: EditorStore) {}

  execute(originalRange: CutRange, newRange: CutRange): void {
    if (newRange.endSec <= newRange.startSec) return;
    const snap = this.store.snapshot();
    const next = snap.cuts.subtract(originalRange).add(newRange);
    if (next === snap.cuts) return;
    this.store.commit();
    this.store.patch({ cuts: next });
  }
}
