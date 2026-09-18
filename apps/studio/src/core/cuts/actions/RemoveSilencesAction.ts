import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Silence } from '@core/cuts/domain/Silence';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { CutCompactor } from '@core/cuts/services/CutCompactor';

/**
 * Commits a batch of silences as cuts. Each silence's padded range is
 * fused into the existing cut registry, so any range that already
 * overlapped a stored cut merges instead of duplicating. Manual cuts
 * not touched by the batch survive. The registry is then compacted
 * to fuse any pair of cuts left separated only by silence — this
 * cleans up the orphan dead air that appears when a freshly added
 * silence cut, padded inward by its padder, lands a few ms away from
 * a pre-existing bad-take cut. No-op when the batch is empty or
 * every range is already fully contained in the existing cuts.
 * Commits the previous state once so the whole batch undoes in a
 * single step.
 */
export class RemoveSilencesAction {

  constructor(
    private readonly store: EditorStore,
    private readonly compactor: CutCompactor,
    private readonly telemetry: Telemetry,
  ) {}

  execute(silences: ReadonlyArray<Silence>): void {
    if (silences.length === 0) return;
    const snap = this.store.snapshot();
    let next = snap.cuts;
    for (const silence of silences) {
      next = next.add(silence.range);
    }
    if (next === snap.cuts) return;
    if (snap.document) {
      next = this.compactor.compact(next, snap.document);
    }
    this.store.commit();
    this.store.patch({ cuts: next });
    this.telemetry.capture('cuts_applied', { kind: 'silence', count: silences.length });
  }
}
