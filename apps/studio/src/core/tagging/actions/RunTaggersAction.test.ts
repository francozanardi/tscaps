import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { describe, expect, it } from 'vitest';
import { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { TaggerRegistry } from '@core/tagging/services/TaggerRegistry';

/**
 * Tagging is asynchronous, and the editor can move to another document
 * while it runs. The promise covered here is that a stale result never
 * replaces the document the editor holds by then.
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

describe('RunTaggersAction', () => {
  const substitute = <T>(stub: object): T => stub as T;

  it('writes the tagged document back', async () => {
    const store = new EditorStore();
    store.patch({ document: documentSaying('untagged') });
    const tagged = documentSaying('tagged');
    const action = new RunTaggersAction(substitute<TaggerRegistry>({ runAll: async () => tagged }));

    await action.execute(store);

    expect(store.snapshot().document).toBe(tagged);
  });

  it('keeps a document that replaced the one being tagged', async () => {
    const store = new EditorStore();
    store.patch({ document: documentSaying('first video') });
    let finishTagging: (document: Document) => void = () => undefined;
    const action = new RunTaggersAction(substitute<TaggerRegistry>({
      runAll: () => new Promise<Document>((resolve) => { finishTagging = resolve; }),
    }));

    const tagging = action.execute(store);
    const replacement = documentSaying('second video');
    store.patch({ document: replacement });
    finishTagging(documentSaying('first video, tagged'));
    await tagging;

    expect(store.snapshot().document).toBe(replacement);
  });
});
