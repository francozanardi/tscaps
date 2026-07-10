import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PreviewCutsSource, PreviewCutRange } from '@core/preview/domain/PreviewCutsSource';

/**
 * Bridges the editor store's cut registry to the preview surface
 * as a {@link PreviewCutsSource}. Filters the store's `'change'`
 * stream down to the subset where the cut range list reference
 * actually swapped, so the surface re-anchors its time map at
 * most once per cut mutation.
 */
export class EditorStorePreviewCutsSource implements PreviewCutsSource {

  constructor(private readonly store: EditorStore) {}

  getRanges(): ReadonlyArray<PreviewCutRange> {
    return this.store.snapshot().cuts.list();
  }

  onRangesChanged(listener: () => void): () => void {
    let lastSeenRanges = this.store.snapshot().cuts.list();
    const onStoreChange = (): void => {
      const ranges = this.store.snapshot().cuts.list();
      if (ranges === lastSeenRanges) return;
      lastSeenRanges = ranges;
      listener();
    };
    this.store.addEventListener('change', onStoreChange);
    return (): void => this.store.removeEventListener('change', onStoreChange);
  }
}
