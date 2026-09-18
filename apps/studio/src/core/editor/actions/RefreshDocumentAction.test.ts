import { afterEach, describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { EditorStore } from '@core/editor/store/EditorStore';
import { Sheet } from '@core/sheets/domain/Sheet';
import type { SheetScriptsSynchronizer } from '@core/sheets/services/SheetScriptsSynchronizer';

/**
 * The browser reports its font set through two surfaces that can
 * disagree, and one extra derivation has to follow a real arrival
 * without the disagreement turning into an endless run of them.
 */

class FontSetStub extends EventTarget {
  private settled = Promise.resolve(this);

  constructor(public status: 'loading' | 'loaded') {
    super();
  }

  get ready(): Promise<FontSetStub> {
    return this.settled;
  }

  /** A load beginning, which is the only thing that promises another settlement. */
  startLoading(): void {
    this.status = 'loading';
    this.settled = Promise.resolve(this);
  }
}

const DOCUMENT = new Document({
  sections: [new Section({
    kind: 'main',
    segments: [new Segment({ lines: [new Line({ words: [new Word({ text: 'hey', time: new TimeFragment(0, 1) })] })] })],
  })],
});

const realDocument = globalThis.document;

afterEach(() => {
  (globalThis as { document?: unknown }).document = realDocument;
});

function refreshAgainst(fonts: FontSetStub): { store: EditorStore; refresh: RefreshDocumentAction; derivations: () => number } {
  (globalThis as { document?: unknown }).document = { fonts };
  const store = new EditorStore();
  store.patch({ document: DOCUMENT, sheets: [new Sheet({ id: 'main' } as never)] });
  store.setVideoLayout({ width: 720, height: 1280 });
  let derivations = 0;
  const deriver = {
    derive: () => {
      derivations++;
      return DOCUMENT;
    },
  } as unknown as DocumentDeriver;
  const synchronizer = { sync: (_: Document, sheets: ReadonlyArray<Sheet>) => sheets } as SheetScriptsSynchronizer;
  return { store, refresh: new RefreshDocumentAction(store, deriver, synchronizer), derivations: () => derivations };
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 50; turn++) await Promise.resolve();
}

describe('re-deriving after the fonts settle', () => {
  it('derives once more when a load was in flight', async () => {
    const fonts = new FontSetStub('loading');
    const { refresh, derivations } = refreshAgainst(fonts);
    refresh.execute();
    fonts.status = 'loaded';
    await settle();
    expect(derivations()).toBe(2);
  });

  it('stops at one extra derivation when the set stays on `loading` with nothing left to load', async () => {
    const fonts = new FontSetStub('loading');
    const { refresh, derivations } = refreshAgainst(fonts);
    refresh.execute();
    await settle();
    expect(derivations()).toBe(2);
  });

  it('waits again once a further load actually begins', async () => {
    const fonts = new FontSetStub('loading');
    const { refresh, derivations } = refreshAgainst(fonts);
    refresh.execute();
    await settle();
    fonts.startLoading();
    refresh.execute();
    await settle();
    expect(derivations()).toBe(4);
  });
});
