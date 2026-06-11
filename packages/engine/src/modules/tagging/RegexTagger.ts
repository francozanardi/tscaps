import { Tagger } from '@modules/tagging/Tagger';
import { Document } from '@modules/document/Document';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Tag } from '@modules/document/Tag';

// Tags words whose text matches a given regular expression.
export class RegexTagger extends Tagger {
  private readonly regex: RegExp;

  constructor(
    private readonly tagName: string,
    pattern: string | RegExp,
    flags?: string,
  ) {
    super();
    this.regex =
      pattern instanceof RegExp ? pattern : new RegExp(pattern, flags ?? 'i');
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
      if (!this.regex.test(word.text)) return word;
      const newSemanticTags = new Set([...word.semanticTags, Tag.of(this.tagName)]);
      return word.with({ semanticTags: newSemanticTags });
    });
    return new Line({ words, structureTags: line.structureTags });
  }
}
