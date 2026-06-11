import { Tagger } from '@modules/tagging/Tagger';
import { Document } from '@modules/document/Document';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Tag } from '@modules/document/Tag';

// Tags words that appear in a predefined word list (case-insensitive).
export class WordlistTagger extends Tagger {
  private readonly wordSet: Set<string>;

  constructor(
    private readonly tagName: string,
    words: string[],
  ) {
    super();
    this.wordSet = new Set(words.map((w) => w.toLowerCase()));
  }

  tag(document: Document): Document {
    const sections = document.sections.map((section) =>
      section.with({ segments: section.segments.map((segment) => this.tagSegment(segment)) }),
    );
    return document.with({ sections });
  }

  private tagSegment(segment: Segment): Segment {
    const lines = segment.lines.map((line) => this.tagLine(line));
    return segment.with({ lines });
  }

  private tagLine(line: Line): Line {
    const words = line.words.map((word) => {
      if (!this.wordSet.has(word.text.toLowerCase())) return word;
      const newSemanticTags = new Set([...word.semanticTags, Tag.of(this.tagName)]);
      return word.with({ semanticTags: newSemanticTags });
    });
    return new Line({ words, structureTags: line.structureTags });
  }
}
