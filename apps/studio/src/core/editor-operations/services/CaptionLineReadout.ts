import type { Word } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { PlacedSegment } from '@core/editor-operations/domain/PlacedSegment';
import type { CaptionMarks } from '@core/editor-operations/services/CaptionMarks';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import type { CaptionEmojis } from '@core/editor-operations/services/ShownDecorationReader';

/**
 * Captions as short lines, one per segment, each word's ref beside it:
 *
 *     segment:1 0-1.46 sheet:1 A: So(word:2) here(word:3 #emphasis 🔥) is(word:4) the(word:5)
 *
 * After the times come the sheet, the speaker when known, and the
 * segment's marks (`hidden`, `cut`, `styled`); inside a word's brackets,
 * its tags as `#tag`, the emoji on screen, `suggested:🔥` for an emoji
 * that does not show, `styled` and `cut`. About a quarter of the full
 * detail's length, and every ref written out, never left to count.
 */
export class CaptionLineReadout {
  constructor(
    private readonly parser: EditorRefParser,
    private readonly format: ReadoutFormatter,
    private readonly marks: CaptionMarks,
  ) {}

  lineOf({ segment, sheetId }: PlacedSegment, state: EditorState, emojis: CaptionEmojis): string {
    const speakers = this.marks.speakersOf(segment);
    const head = [
      this.parser.formatOf('segment', segment.id),
      `${this.format.sec(segment.time.start)}-${this.format.sec(segment.time.end)}`,
      this.parser.formatOf('sheet', sheetId),
      ...(speakers.speaker !== undefined ? [speakers.speaker] : []),
      ...(speakers.speakers !== undefined ? [speakers.speakers.join(',')] : []),
      ...Object.keys(this.marks.ofSegment(segment, state)),
    ];
    const words = segment.getWords().map((word) => this.wordOf(word, { segment, sheetId }, state, emojis));
    return `${head.join(' ')}: ${words.join(' ')}`;
  }

  private wordOf(word: Word, { segment }: PlacedSegment, state: EditorState, emojis: CaptionEmojis): string {
    const inside = [this.parser.formatOf('word', word.id)];
    const marks = this.marks.ofWord(word, segment, state, emojis);
    if (marks !== null) {
      for (const tag of marks.tags ?? []) inside.push(`#${tag}`);
      if (marks.emoji !== undefined) inside.push(marks.emoji);
      if (marks.suggestedEmoji !== undefined) inside.push(`suggested:${marks.suggestedEmoji}`);
      if (marks.styled) inside.push('styled');
      if (marks.cut) inside.push('cut');
    }
    return `${word.text}(${inside.join(' ')})`;
  }
}
