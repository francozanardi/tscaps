import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { ElementKind } from '@core/elements/domain/ElementKind';

/**
 * Writes the CSS the user typed against one element, coalescing
 * consecutive edits to the same element into a single history entry so
 * typing does not flood the undo stack.
 *
 * Re-derives only when the write changed which segments are excluded
 * from reflow. Giving a segment CSS of its own excludes it, and
 * clearing that CSS lets it flow back into its neighbours; a word's
 * CSS changes neither, and re-piping the document for it would cost a
 * full derivation per keystroke.
 */
export class SetElementCssAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(elementId: string, kind: ElementKind, css: string): void {
    const snap = this.store.snapshot();
    const elementStyles = snap.elementStyles.withCss(elementId, kind, css);
    if (elementStyles === snap.elementStyles) return;

    this.store.commit('Edit element CSS', `elementCss:${elementId}`);
    this.store.patch({ elementStyles });
    if (this.store.snapshot().frozenSegments !== snap.frozenSegments) this.refresh.execute();
  }
}
