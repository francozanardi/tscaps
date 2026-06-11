import type { Document } from '@tscaps/engine';

export interface WordLocation {
  segIdx: number;
  lineIdx: number;
  wordIdx: number;
}

/**
 * Walks a Document to find the position of a word by id. Returns null if
 * the word is no longer in the document (e.g., it was deleted between the
 * click and the popover dispatch). Used by the overlay popovers to
 * translate a clicked wordId into the (segIdx, lineIdx, wordIdx) tuple
 * that DocumentEditor structural ops expect.
 */
export function locateWord(doc: Document, wordId: string): WordLocation | null {
  const segments = doc.getSegments();
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const lines = segments[segIdx]!.lines;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const words = lines[lineIdx]!.words;
      for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
        if (words[wordIdx]!.id === wordId) {
          return { segIdx, lineIdx, wordIdx };
        }
      }
    }
  }
  return null;
}
