import type { Document } from '@tscaps/engine';

/** What the captions say on screen at a moment, to quote with a note. */
export class CaptionQuoteReader {
  /** The text of every segment showing at `sourceSec`, or null when none is. */
  quoteAt(document: Document | null, sourceSec: number): string | null {
    if (document === null) return null;
    const text = document.getActiveSegments(sourceSec).map((segment) => segment.getText().trim()).filter((each) => each !== '').join(' / ');
    return text === '' ? null : text;
  }
}
