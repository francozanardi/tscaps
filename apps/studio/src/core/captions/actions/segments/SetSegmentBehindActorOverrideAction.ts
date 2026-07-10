import type { EditorStore } from '@core/editor/store/EditorStore';
import type { BehindActorSegmentOverride } from '@core/person-segmentation/domain/BehindActorSegmentOverride';

export class SetSegmentBehindActorOverrideAction {
  constructor(private readonly store: EditorStore) {}

  /**
   * Commits the segment's text-behind-actor override with an undo entry
   * coalesced per segment, so repeated toggles collapse into a single
   * history step. `'auto'` returns control to the detector and drops
   * the persisted entry.
   */
  execute(segmentId: string, override: BehindActorSegmentOverride): void {
    const current = this.store.snapshot().segmentOverrides;
    const next = current.withBehindActorOverride(segmentId, override);
    if (next === current) return;
    this.store.commit(`segmentBehindActorOverride:${segmentId}`);
    this.store.patch({ segmentOverrides: next });
  }
}
