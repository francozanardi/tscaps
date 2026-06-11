import { Tagger } from '@modules/tagging/Tagger';
import { Document } from '@modules/document/Document';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { Tag } from '@modules/document/Tag';

/**
 * Tags every word that falls inside a span delimited by two
 * boundary patterns: one that marks the word opening the span
 * and one that marks the word closing it. Boundary words are
 * tagged together with everything in between, and the span
 * propagates across line, segment, and section boundaries.
 *
 * A word that matches both patterns is treated as a single-word
 * span. A span that opens but never closes within the document
 * is discarded: no word in it gets tagged.
 */
export class SpanTagger extends Tagger {
  constructor(
    private readonly tagName: string,
    private readonly openPattern: RegExp,
    private readonly closePattern: RegExp,
  ) {
    super();
  }

  tag(document: Document): Document {
    const wordsToTag = this.collectSpannedWords(document);
    return this.rebuildDocument(document, wordsToTag);
  }

  private collectSpannedWords(document: Document): Set<Word> {
    const tagged = new Set<Word>();
    let currentSpan: Word[] = [];
    let isInsideSpan = false;
    for (const word of document.getWords()) {
      const opens = this.openPattern.test(word.text);
      const closes = this.closePattern.test(word.text);
      if (isInsideSpan) {
        currentSpan.push(word);
        if (closes) {
          currentSpan.forEach((spanWord) => tagged.add(spanWord));
          currentSpan = [];
          isInsideSpan = false;
        }
      } else if (opens) {
        currentSpan.push(word);
        isInsideSpan = true;
        if (closes) {
          currentSpan.forEach((spanWord) => tagged.add(spanWord));
          currentSpan = [];
          isInsideSpan = false;
        }
      }
    }
    return tagged;
  }

  private rebuildDocument(document: Document, taggedWords: Set<Word>): Document {
    const sections = document.sections.map((section) =>
      section.with({
        segments: section.segments.map((segment) =>
          segment.with({
            lines: segment.lines.map((line) => this.rebuildLine(line, taggedWords)),
          }),
        ),
      }),
    );
    return document.with({ sections });
  }

  private rebuildLine(line: Line, taggedWords: Set<Word>): Line {
    const words = line.words.map((word) =>
      taggedWords.has(word) ? this.withTag(word) : word,
    );
    return new Line({ words, structureTags: line.structureTags, id: line.id });
  }

  private withTag(word: Word): Word {
    const semanticTags = new Set([...word.semanticTags, Tag.of(this.tagName)]);
    return word.with({ semanticTags });
  }
}
