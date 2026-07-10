import type { Document } from '@tscaps/engine';

/**
 * Walks every word in the document and returns the set of Unicode
 * code points the captions will exercise. Used to trim `@font-face`
 * declarations subsetted by `unicode-range` down to the subsets the
 * text actually needs.
 *
 * The uppercase and lowercase variants of each word are included so
 * `text-transform: uppercase|lowercase` keeps working without losing
 * glyphs the source casing didn't expose.
 */
export class DocumentUsedCodepointCollector {

  collect(document: Document): Set<number> {
    const out = new Set<number>();
    for (const section of document.sections) {
      for (const segment of section.segments) {
        for (const line of segment.lines) {
          for (const word of line.words) {
            this.addCodepoints(word.displayText, out);
            this.addCodepoints(word.displayText.toUpperCase(), out);
            this.addCodepoints(word.displayText.toLowerCase(), out);
          }
        }
      }
    }
    return out;
  }

  private addCodepoints(text: string, out: Set<number>): void {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined) out.add(cp);
    }
  }
}
