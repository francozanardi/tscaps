import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DomProbeFontMetricsReader } from '@core/fonts/infrastructure/DomProbeFontMetricsReader';

/**
 * That measuring a face asks the page for it at most once.
 *
 * Asking puts the document's fonts into `loading`, and a document whose
 * fonts are loading is re-derived when they settle — which measures
 * again. An ask that repeats is therefore a request loop with no end,
 * and the faces that drive it are exactly the ones that never arrive:
 * a file that 404s, a family the page describes but cannot fetch. The
 * loop is invisible to every test that only checks what is rendered,
 * so what is guarded here is the number of asks.
 */

class RecordingFontFaceSet {
  readonly asked: string[] = [];
  status = 'loading';
  check(): boolean {
    return false;
  }
  load(font: string): Promise<unknown[]> {
    this.asked.push(font);
    return Promise.resolve([]);
  }
}

let fonts: RecordingFontFaceSet;
let originalDocument: unknown;

beforeEach(() => {
  fonts = new RecordingFontFaceSet();
  originalDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { fonts };
});

afterEach(() => {
  (globalThis as { document?: unknown }).document = originalDocument;
});

describe('a face the page has not loaded', () => {
  it('is asked for once, however many times it is measured', () => {
    const reader = new DomProbeFontMetricsReader();
    for (let attempt = 0; attempt < 20; attempt++) reader.read('Anton');
    expect(fonts.asked).toHaveLength(1);
  });

  it('is asked for once per face, not once per measurement', () => {
    const reader = new DomProbeFontMetricsReader();
    for (let attempt = 0; attempt < 5; attempt++) {
      reader.read('Anton');
      reader.read('Lalezar');
    }
    expect(fonts.asked).toHaveLength(2);
  });

  it('reports no metrics rather than the ones of whatever stood in for it', () => {
    expect(new DomProbeFontMetricsReader().read('Anton')).toBeNull();
  });
});
