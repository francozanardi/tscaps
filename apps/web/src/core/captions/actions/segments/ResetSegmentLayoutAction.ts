import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Reverts a single segment to auto-layout: drops its style overrides
 * and explicit freeze in one atomic update. The next derivation reflows
 * the segment with its sheet's pipeline, merging back into adjacent
 * unfrozen neighbours.
 */
export class ResetSegmentLayoutAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(segmentId: string): void {
    const snap = this.store.snapshot();
    if (!snap.segmentOverrides.isFrozen(segmentId)) return;

    this.store.commit();
    this.store.patch({ segmentOverrides: snap.segmentOverrides.resetSegment(segmentId) });
    this.refresh.execute();
  }
}
