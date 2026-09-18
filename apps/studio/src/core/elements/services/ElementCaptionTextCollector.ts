import type { Document, Word } from '@tscaps/engine';

/**
 * Gathers the text one addressable element renders, for the resolutions
 * that depend on what it says rather than on how it is styled —
 * classifying the writing systems it is written in, most of all.
 *
 * A segment answers with all of its words; a word answers with its own
 * text. An id nothing in the document carries answers with nothing.
 */
export class ElementCaptionTextCollector {

  /**
   * A decoration's trailing text counts as the host word's: it renders
   * outside the decoration's style scope, in that word's typography, so
   * it draws with the same faces and has the same claim on them.
   */
  collect(document: Document, elementId: string): string {
    for (const section of document.sections) {
      for (const segment of section.segments) {
        const words = segment.getWords();
        if (segment.id === elementId) {
          return words.map((word) => this.textOf(word)).join(' ');
        }
        const word = words.find((candidate) => candidate.id === elementId);
        if (word !== undefined) return this.textOf(word);
      }
    }
    return '';
  }

  private textOf(word: Word): string {
    const trail = word.decoration?.trail;
    return trail ? `${word.displayText} ${trail}` : word.displayText;
  }
}
