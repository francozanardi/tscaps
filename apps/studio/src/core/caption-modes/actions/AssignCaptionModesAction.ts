import type { EditorStore } from '@core/editor/store/EditorStore';
import type { CaptionModeAssigner } from '@core/caption-modes/services/CaptionModeAssigner';

/**
 * Sets the template tags of the words in `store`'s document, each sheet's
 * template deciding which of its words go into which of its modes. With
 * `sheetIds`, only the sections of those sheets; their other words keep
 * theirs. Writes the document and nothing else: no undo step of its own,
 * no re-layout, both left to the caller.
 */
export class AssignCaptionModesAction {
  constructor(private readonly assigner: CaptionModeAssigner) {}

  execute(store: EditorStore, sheetIds?: ReadonlySet<string>): void {
    const { document, sheets } = store.snapshot();
    if (!document) return;
    store.patch({ document: this.assigner.assign(document, sheets, sheetIds) });
  }
}
