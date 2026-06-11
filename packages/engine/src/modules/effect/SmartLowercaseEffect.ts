import type { Effect } from '@modules/effect/Effect';
import type { Document } from '@modules/document/Document';
import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';

/**
 * Lowercases each matching word's `displayText`, preserving only words
 * tagged as `entity` (proper nouns) and the English pronoun "I"
 * (including contractions like "I'm", "I'll"). Targets the casual
 * "all-lowercase" caption aesthetic where even sentence starts stay
 * lowercased.
 */
export class SmartLowercaseEffect implements Effect {

  private static readonly I_PRONOUN = /^I(?:$|['’])/;

  constructor(
    private readonly segmentFilter: (segment: Segment) => boolean = () => true,
  ) {}

  apply(document: Document): Document {
    return document.with({
      sections: document.sections.map((section) =>
        section.with({
          segments: section.segments.map((segment) => this.rewriteSegment(segment)),
        }),
      ),
    });
  }

  private rewriteSegment(segment: Segment): Segment {
    if (!this.segmentFilter(segment)) return segment;
    return segment.with({
      lines: segment.lines.map((line) => this.rewriteLine(line)),
    });
  }

  private rewriteLine(line: Line): Line {
    return line.with({
      words: line.words.map((word) => this.rewriteWord(word)),
    });
  }

  private rewriteWord(word: Word): Word {
    if (this.isPreserved(word)) return word;
    const lowered = word.displayText.toLowerCase();
    if (lowered === word.displayText) return word;
    return word.with({ displayText: lowered });
  }

  private isPreserved(word: Word): boolean {
    return word.hasTagName('entity') || SmartLowercaseEffect.I_PRONOUN.test(word.text);
  }
}
