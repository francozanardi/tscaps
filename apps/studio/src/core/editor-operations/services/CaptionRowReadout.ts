import type { Word } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { PlacedSegment } from '@core/editor-operations/domain/PlacedSegment';
import type { CaptionMarks, WordMarks } from '@core/editor-operations/services/CaptionMarks';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import type { CaptionEmojis } from '@core/editor-operations/services/ShownDecorationReader';

/** What a word carries besides its text and times, as a row writes it: an emoji on screen names its decoration ref. */
type WordRowExtras = Omit<WordMarks, 'decorationId'> & { decoration?: string };

/** A word as `[ref, text, startSec, endSec]`, with its extras last when it has any. */
type WordRow = [string, string, number, number] | [string, string, number, number, WordRowExtras];

/**
 * Captions in full detail, one object per segment: its ref, times,
 * sheet, marks, speaker and text, and every word as
 * `[ref, text, startSec, endSec, extras?]`. The longest way to read
 * captions, for when word times or emoji refs are needed.
 */
export class CaptionRowReadout {
  constructor(
    private readonly parser: EditorRefParser,
    private readonly format: ReadoutFormatter,
    private readonly marks: CaptionMarks,
  ) {}

  rowOf({ segment, sheetId }: PlacedSegment, state: EditorState, emojis: CaptionEmojis): Record<string, unknown> {
    return {
      ref: this.parser.formatOf('segment', segment.id),
      startSec: this.format.sec(segment.time.start),
      endSec: this.format.sec(segment.time.end),
      sheet: this.parser.formatOf('sheet', sheetId),
      ...this.marks.ofSegment(segment, state),
      ...this.marks.speakersOf(segment),
      text: segment.getText(),
      words: segment.getWords().map((word) => this.wordRow(word, { segment, sheetId }, state, emojis)),
    };
  }

  private wordRow(word: Word, { segment }: PlacedSegment, state: EditorState, emojis: CaptionEmojis): WordRow {
    const row: [string, string, number, number] = [
      this.parser.formatOf('word', word.id),
      word.text,
      this.format.sec(word.time.start),
      this.format.sec(word.time.end),
    ];
    const marks = this.marks.ofWord(word, segment, state, emojis);
    if (marks === null) return row;
    const { decorationId, ...rest } = marks;
    const extras: WordRowExtras = decorationId === undefined ? rest : { ...rest, decoration: this.parser.formatOf('decoration', decorationId) };
    return [...row, extras];
  }
}
