import { Tagger } from '@modules/tagging/Tagger';
import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Tag, StructureTag } from '@modules/document/Tag';

export interface PauseTaggerConfig {
  /**
   * Minimum gap, in seconds, between a segment's start and the previous
   * segment's end for the segment to be marked as following a pause.
   */
  readonly minGapSeconds: number;
}

/**
 * Adds `SEGMENT_AFTER_PAUSE` to every segment whose start is preceded by
 * a silent gap of at least `minGapSeconds`. Gaps are measured only within
 * the same section: the first segment of each section is never tagged
 * (positional first/last tags already cover that boundary).
 */
export class PauseTagger extends Tagger {
  constructor(private readonly _config: PauseTaggerConfig) {
    super();
  }

  tag(document: Document): Document {
    const sections = document.sections.map((section) => this.tagSection(section));
    return document.with({ sections });
  }

  private tagSection(section: Section): Section {
    let previousEndSeconds: number | null = null;
    const segments = section.segments.map((segment) => {
      const tagged = this.tagSegmentIfAfterPause(segment, previousEndSeconds);
      previousEndSeconds = segment.time.end;
      return tagged;
    });
    return section.with({ segments });
  }

  private tagSegmentIfAfterPause(segment: Segment, previousEndSeconds: number | null): Segment {
    if (!this.followsPause(segment, previousEndSeconds)) return segment;
    const structureTags = new Set<Tag>(segment.structureTags);
    structureTags.add(Tag.of(StructureTag.SEGMENT_AFTER_PAUSE));
    return segment.with({ structureTags });
  }

  private followsPause(segment: Segment, previousEndSeconds: number | null): boolean {
    if (previousEndSeconds === null) return false;
    return segment.time.start - previousEndSeconds >= this._config.minGapSeconds;
  }
}
