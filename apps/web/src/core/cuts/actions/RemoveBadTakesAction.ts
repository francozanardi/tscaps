import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
import { CutCompactor } from '@core/cuts/services/CutCompactor';

/**
 * Commits a batch of bad-take ranges as cuts. Each range fuses into
 * the existing cut registry, so any range already fully contained in
 * a stored cut is a no-op and any range that touches one is merged.
 * The registry is then compacted to fuse any pair of cuts left
 * separated only by silence — this cleans up the orphan dead air
 * that appears when the freshly added bad-take cut lands next to a
 * pre-existing silence cut whose padder shrank it inward. Manual
 * cuts and silence cuts not touched by the batch survive. Commits
 * the previous state once so the whole batch undoes in a single
 * step.
 */
export class RemoveBadTakesAction {

  constructor(
    private readonly store: EditorStore,
    private readonly compactor: CutCompactor,
  ) {}

  execute(ranges: ReadonlyArray<CutRange>): void {
    if (ranges.length === 0) return;
    const snap = this.store.snapshot();
    let next = snap.cuts;
    for (const range of ranges) {
      next = next.add(range);
    }
    if (next === snap.cuts) return;
    if (snap.document) {
      next = this.compactor.compact(next, snap.document);
    }
    this.store.commit();
    this.store.patch({ cuts: next });
  }
}
