import { Tagger } from '@modules/tagging/Tagger';
import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { Tag } from '@modules/tags/Tag';
import { StructureTag } from '@modules/tags/StructureTag';

/**
 * Assigns positional structure tags across the Document hierarchy:
 *   - Segment-level: FIRST/LAST_SEGMENT_IN_SECTION, FIRST/LAST_SEGMENT_IN_DOCUMENT
 *   - Line-level:    FIRST/LAST_LINE_IN_SECTION, FIRST/LAST_LINE_IN_SEGMENT
 *   - Word-level:    FIRST/LAST_WORD_IN_SECTION, FIRST/LAST_WORD_IN_SEGMENT,
 *                    FIRST/LAST_WORD_IN_LINE
 *
 * Every tag it assigns is recomputed from scratch. The one line tag it
 * does not assign, ISOLATED_LINE, comes from line splitting and is kept
 * as long as the line still holds a single word: an edit that moves a
 * second word onto the line ends what the tag said about it.
 *
 * Runs once after splitting, before rendering.
 */
export class StructureTagger extends Tagger {
  tag(document: Document): Document {
    const sections = document.sections;
    const taggedSections = sections.map((section, secIdx) =>
      this.tagSection(section, secIdx, sections.length),
    );
    return document.with({ sections: taggedSections });
  }

  private tagSection(section: Section, secIdx: number, totalSections: number): Section {
    const isFirstSection = secIdx === 0;
    const isLastSection = secIdx === totalSections - 1;

    const sectionWords = section.getWords();
    const sectionLines = section.getLines();

    const taggedSegments = section.segments.map((segment, segIdx) =>
      this.tagSegment(segment, segIdx, section.segments.length, isFirstSection, isLastSection, sectionWords, sectionLines),
    );

    return section.with({ segments: taggedSegments });
  }

  private tagSegment(
    segment: Segment,
    segIdx: number,
    totalSegments: number,
    isFirstSection: boolean,
    isLastSection: boolean,
    sectionWords: Word[],
    sectionLines: Line[],
  ): Segment {
    const tags = new Set<Tag>();
    if (segIdx === 0) tags.add(Tag.of(StructureTag.FIRST_SEGMENT_IN_SECTION));
    if (segIdx === totalSegments - 1) tags.add(Tag.of(StructureTag.LAST_SEGMENT_IN_SECTION));
    if (isFirstSection && segIdx === 0) tags.add(Tag.of(StructureTag.FIRST_SEGMENT_IN_DOCUMENT));
    if (isLastSection && segIdx === totalSegments - 1) tags.add(Tag.of(StructureTag.LAST_SEGMENT_IN_DOCUMENT));
    if (segment.lines.length > 1 && this.isStillIsolated(segment.lines[0]!)) tags.add(Tag.of(StructureTag.OPENS_WITH_ISOLATED_LINE));
    if (segment.lines.length > 1 && this.isStillIsolated(segment.lines.at(-1)!)) tags.add(Tag.of(StructureTag.CLOSES_WITH_ISOLATED_LINE));

    const segmentWords = segment.getWords();
    const taggedLines = segment.lines.map((line, lineIdx) =>
      this.tagLine(line, lineIdx, segment.lines.length, segmentWords, sectionWords, sectionLines),
    );

    return segment.with({ lines: taggedLines, structureTags: tags });
  }

  private tagLine(
    line: Line,
    lineIdx: number,
    totalLines: number,
    segmentWords: Word[],
    sectionWords: Word[],
    sectionLines: Line[],
  ): Line {
    const tags = new Set<Tag>();
    if (this.isStillIsolated(line)) tags.add(Tag.of(StructureTag.ISOLATED_LINE));
    if (lineIdx === 0) tags.add(Tag.of(StructureTag.FIRST_LINE_IN_SEGMENT));
    if (lineIdx === totalLines - 1) tags.add(Tag.of(StructureTag.LAST_LINE_IN_SEGMENT));

    const sectionLineIdx = sectionLines.indexOf(line);
    if (sectionLineIdx === 0) tags.add(Tag.of(StructureTag.FIRST_LINE_IN_SECTION));
    if (sectionLineIdx === sectionLines.length - 1) tags.add(Tag.of(StructureTag.LAST_LINE_IN_SECTION));

    const taggedWords = line.words.map((word, wordIdx) =>
      this.tagWord(word, wordIdx, line.words.length, segmentWords, sectionWords),
    );

    return line.with({ words: taggedWords, structureTags: tags });
  }

  private isStillIsolated(line: Line): boolean {
    if (line.words.length !== 1) return false;
    return [...line.structureTags].some((tag) => tag.name === StructureTag.ISOLATED_LINE);
  }

  private tagWord(
    word: Word,
    wordIdx: number,
    totalInLine: number,
    segmentWords: Word[],
    sectionWords: Word[],
  ): Word {
    const tags = new Set<Tag>();
    if (wordIdx === 0) tags.add(Tag.of(StructureTag.FIRST_WORD_IN_LINE));
    if (wordIdx === totalInLine - 1) tags.add(Tag.of(StructureTag.LAST_WORD_IN_LINE));

    const segWordIdx = segmentWords.indexOf(word);
    if (segWordIdx === 0) tags.add(Tag.of(StructureTag.FIRST_WORD_IN_SEGMENT));
    if (segWordIdx === segmentWords.length - 1) tags.add(Tag.of(StructureTag.LAST_WORD_IN_SEGMENT));

    const sectionWordIdx = sectionWords.indexOf(word);
    if (sectionWordIdx === 0) tags.add(Tag.of(StructureTag.FIRST_WORD_IN_SECTION));
    if (sectionWordIdx === sectionWords.length - 1) tags.add(Tag.of(StructureTag.LAST_WORD_IN_SECTION));

    return word.with({ structureTags: tags });
  }
}
