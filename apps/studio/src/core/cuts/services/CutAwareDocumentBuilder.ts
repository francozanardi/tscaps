import { Document, Line, Section, Segment } from '@tscaps/engine';
import type { Word } from '@tscaps/engine';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';

/**
 * Produces a Document variant where every word whose narration is
 * fully contained in some cut range has been dropped. Lines, segments
 * and sections that lose all their children cascade out of the
 * result. The input is left untouched; an empty registry returns the
 * input verbatim.
 *
 * The host identity (`Word.id`, `Line.id`, `Segment.id`, `Section.id`)
 * is preserved on every surviving container, so downstream lookups
 * keyed by id still resolve.
 */
export class CutAwareDocumentBuilder {

  build(document: Document, cuts: CutRegistry): Document {
    if (cuts.isEmpty()) return document;
    const sections: Section[] = [];
    for (const section of document.sections) {
      const filtered = this.filterSection(section, cuts);
      if (filtered) sections.push(filtered);
    }
    if (this.sameSequence(sections, document.sections)) return document;
    return document.with({ sections });
  }

  /**
   * Returns the projection of a single segment: a copy with cut words
   * dropped (lines and the segment itself collapse out when they lose
   * every word). Returns `null` when nothing survives.
   */
  buildSegment(segment: Segment, cuts: CutRegistry): Segment | null {
    if (cuts.isEmpty()) return segment;
    return this.filterSegment(segment, cuts);
  }

  private filterSection(section: Section, cuts: CutRegistry): Section | null {
    const segments: Segment[] = [];
    for (const segment of section.segments) {
      const filtered = this.filterSegment(segment, cuts);
      if (filtered) segments.push(filtered);
    }
    if (segments.length === 0) return null;
    if (this.sameSequence(segments, section.segments)) return section;
    return section.with({ segments });
  }

  private filterSegment(segment: Segment, cuts: CutRegistry): Segment | null {
    const lines: Line[] = [];
    for (const line of segment.lines) {
      const filtered = this.filterLine(line, cuts);
      if (filtered) lines.push(filtered);
    }
    if (lines.length === 0) return null;
    if (this.sameSequence(lines, segment.lines)) return segment;
    return segment.with({ lines });
  }

  private filterLine(line: Line, cuts: CutRegistry): Line | null {
    const words = line.words.filter((word) => !this.isWordCut(word, cuts));
    if (words.length === 0) return null;
    if (words.length === line.words.length) return line;
    return line.with({ words });
  }

  private isWordCut(word: Word, cuts: CutRegistry): boolean {
    return cuts.containsTimeRange(word.time.start, word.time.end);
  }

  private sameSequence<T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}
