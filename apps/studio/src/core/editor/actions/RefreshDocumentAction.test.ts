import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { describe, expect, it } from 'vitest';
import { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { SheetScriptsSynchronizer } from '@core/sheets/services/SheetScriptsSynchronizer';
import type { Sheet } from '@core/sheets/domain/Sheet';

/**
 * A session the editor has left still has its document derived, in the
 * store that holds it. The promise covered here is that a refresh handed
 * such a store works on it and leaves the editor's alone.
 */

function documentSaying(text: string): Document {
  return new Document({
    sections: [
      new Section({
        segments: [
          new Segment({
            lines: [new Line({ words: [new Word({ text, time: new TimeFragment(0, 1) })] })],
          }),
        ],
        kind: '',
      }),
    ],
  });
}

function storeHolding(text: string): EditorStore {
  const store = new EditorStore();
  store.patch({
    document: documentSaying(text),
    sheets: [{ id: 'main' } as unknown as Sheet],
    video: { layout: { width: 1080, height: 1920 }, duration: 30 },
  });
  return store;
}

describe('RefreshDocumentAction', () => {
  const substitute = <T>(stub: object): T => stub as T;

  it('derives the document of the store it is handed, and leaves the editor alone', () => {
    const editor = storeHolding('on screen');
    const editorDocument = editor.snapshot().document;
    const elsewhere = storeHolding('left behind');
    const derived = documentSaying('left behind, derived');
    const action = new RefreshDocumentAction(
      editor,
      substitute<DocumentDeriver>({ derive: () => derived }),
      substitute<SheetScriptsSynchronizer>({ sync: (_document: Document, sheets: ReadonlyArray<Sheet>) => sheets }),
    );

    action.execute(elsewhere);

    expect(elsewhere.snapshot().document).toBe(derived);
    expect(elsewhere.snapshot().status).toBe('ready');
    expect(editor.snapshot().document).toBe(editorDocument);
    expect(editor.snapshot().status).toBe('idle');
  });
});
