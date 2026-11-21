import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Reverts a single segment to auto-layout: drops its own style and the
 * record that its boundaries were drawn by hand, in one atomic update. The next derivation reflows the segment with its
 * sheet's pipeline, merging back into adjacent unfrozen neighbours.
 *
 * Everything keyed to the segment goes, because the reflow can dissolve
 * the segment into its neighbours and take its id with it — state left
 * behind would survive as an entry nothing renders.
 */
export class ResetSegmentLayoutAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(segmentId: string): void {
    const snap = this.store.snapshot();
    if (!snap.frozenSegments.has(segmentId)) return;

    this.store.commit('Reset manual layout');
    this.store.patch({
      elementStyles: snap.elementStyles.without([segmentId]),
      frozenSegments: snap.frozenSegments.withoutStructurallyEdited([segmentId]),
    });
    this.refresh.execute();
  }
}
