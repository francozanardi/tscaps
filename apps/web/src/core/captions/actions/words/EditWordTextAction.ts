import { DocumentEditor } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

const docEditor = new DocumentEditor();

// Updates a word's text in the document without re-running the splitter
// pipeline. Splits on whitespace if the new text contains multiple words.
// Effects are reapplied so time-shaping passes (e.g. gap-free padding)
// re-stamp against the post-edit word boundaries.
export class EditWordTextAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(wordId: string, text: string): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return;

    const pos = docEditor.findWordById(document, wordId);
    if (!pos) return;

    const original = document.getSegments()[pos.segIdx]!.lines[pos.lineIdx]!.words[pos.wordIdx]!;
    const newWords = docEditor.computeWordTextSplit(original, text);
    const edited = docEditor.replaceWordAt(document, pos.segIdx, pos.lineIdx, pos.wordIdx, newWords);
    const next = this.deriver.reapplyEffects(edited, snap.sheets, snap.video.duration);

    this.store.commit();
    this.store.patch({ document: next });
  }
}
