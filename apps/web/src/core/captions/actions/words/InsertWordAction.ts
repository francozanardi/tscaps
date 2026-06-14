import { DocumentEditor } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

const docEditor = new DocumentEditor();

// Inserts a new empty word after the given word. Does NOT set
// isStructureLocked — adding a word is a content edit, not a structural one.
// Effects are reapplied so time-shaping passes (e.g. gap-free padding)
// re-stamp against the post-edit segment.
export class InsertWordAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(segIdx: number, lineIdx: number, wordIdx: number): string {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return '';

    const { doc, wordId } = docEditor.insertWordAfter(document, segIdx, lineIdx, wordIdx);
    const next = this.deriver.reapplyEffects(doc, snap.sheets, snap.video.duration);
    this.store.commit();
    this.store.patch({ document: next });
    return wordId;
  }
}
