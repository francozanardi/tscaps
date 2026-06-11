import { Tagger } from '@modules/tagging/Tagger';
import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { Tag, StructureTag } from '@modules/document/Tag';

/**
 * Assigns positional structure tags across the Document hierarchy:
 *   - Section-level: FIRST/LAST_SECTION_IN_DOCUMENT
 *   - Segment-level: FIRST/LAST_SEGMENT_IN_SECTION
 *   - Line-level:    FIRST/LAST_LINE_IN_SECTION, FIRST/LAST_LINE_IN_SEGMENT
 *   - Word-level:    FIRST/LAST_WORD_IN_SECTION, FIRST/LAST_WORD_IN_SEGMENT,
 *                    FIRST/LAST_WORD_IN_LINE
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
    const tags = new Set<Tag>();
    if (secIdx === 0) tags.add(Tag.of(StructureTag.FIRST_SECTION_IN_DOCUMENT));
    if (secIdx === totalSections - 1) tags.add(Tag.of(StructureTag.LAST_SECTION_IN_DOCUMENT));

    const sectionWords = section.getWords();
    const sectionLines = section.getLines();

    const taggedSegments = section.segments.map((segment, segIdx) =>
      this.tagSegment(segment, segIdx, section.segments.length, sectionWords, sectionLines),
    );

    return section.with({ segments: taggedSegments, structureTags: tags });
  }

  private tagSegment(
    segment: Segment,
    segIdx: number,
    totalSegments: number,
    sectionWords: Word[],
    sectionLines: Line[],
  ): Segment {
    const tags = new Set<Tag>();
    if (segIdx === 0) tags.add(Tag.of(StructureTag.FIRST_SEGMENT_IN_SECTION));
    if (segIdx === totalSegments - 1) tags.add(Tag.of(StructureTag.LAST_SEGMENT_IN_SECTION));

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
    if (lineIdx === 0) tags.add(Tag.of(StructureTag.FIRST_LINE_IN_SEGMENT));
    if (lineIdx === totalLines - 1) tags.add(Tag.of(StructureTag.LAST_LINE_IN_SEGMENT));

    const sectionLineIdx = sectionLines.indexOf(line);
    if (sectionLineIdx === 0) tags.add(Tag.of(StructureTag.FIRST_LINE_IN_SECTION));
    if (sectionLineIdx === sectionLines.length - 1) tags.add(Tag.of(StructureTag.LAST_LINE_IN_SECTION));

    const taggedWords = line.words.map((word, wordIdx) =>
      this.tagWord(word, wordIdx, line.words.length, segmentWords, sectionWords),
    );

    return new Line({ words: taggedWords, structureTags: tags, id: line.id });
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
