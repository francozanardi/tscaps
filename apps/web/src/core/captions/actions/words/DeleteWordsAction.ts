import { DocumentEditor } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

const docEditor = new DocumentEditor();

type WordPosition = NonNullable<ReturnType<DocumentEditor['findWordById']>>;

function reverseDocOrder(a: WordPosition, b: WordPosition): number {
  if (b.segIdx !== a.segIdx) return b.segIdx - a.segIdx;
  if (b.lineIdx !== a.lineIdx) return b.lineIdx - a.lineIdx;
  return b.wordIdx - a.wordIdx;
}

// Removes words (by id) from the document without re-running the splitter
// pipeline. Deletes are processed in reverse document order so earlier
// indexes stay valid. Effects are reapplied so time-shaping passes (e.g.
// gap-free padding) re-stamp against the post-edit segments.
export class DeleteWordsAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(wordIds: string[]): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document || wordIds.length === 0) return;

    const idSet = new Set(wordIds);
    let next = document;
    const positions = wordIds
      .map((id) => docEditor.findWordById(next, id))
      .filter((p): p is WordPosition => p !== null)
      .sort(reverseDocOrder);
    for (const pos of positions) {
      const word = next.getSegments()[pos.segIdx]?.lines[pos.lineIdx]?.words[pos.wordIdx];
      if (!word || !idSet.has(word.id)) continue;
      next = docEditor.deleteWord(next, pos.segIdx, pos.lineIdx, pos.wordIdx);
    }
    if (next === document) return;

    next = this.deriver.reapplyEffects(next, snap.sheets, snap.video.duration);

    this.store.commit();
    this.store.patch({ document: next });
  }
}
