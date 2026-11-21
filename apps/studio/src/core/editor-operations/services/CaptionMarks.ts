import type { Segment, Word } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { CaptionEmojis } from '@core/editor-operations/services/ShownDecorationReader';

/** What a word carries besides its text and times; only the parts it has. */
export interface WordMarks {
  tags?: string[];
  emoji?: string;
  /** The emoji's own id, for an emoji on screen. */
  decorationId?: string;
  suggestedEmoji?: string;
  styled?: true;
  cut?: true;
}

/** What a segment carries besides its words; only the parts it has. */
export interface SegmentMarks {
  hidden?: true;
  cut?: true;
  styled?: true;
}

/**
 * What a caption carries besides its words and times, read from the
 * editor's state: who says it, whether it shows, whether it is cut,
 * whether it has CSS of its own, and each word's tags and emoji.
 */
export class CaptionMarks {
  /** `speaker` where every attributed word is one speaker's, `speakers` where they are several, nothing where none is known. */
  speakersOf(segment: Segment): { speaker?: string; speakers?: string[] } {
    const speakers = [...new Set(segment.getWords().flatMap((word) => (word.speakerId === null ? [] : [word.speakerId])))];
    if (speakers.length === 0) return {};
    return speakers.length === 1 ? { speaker: speakers[0]! } : { speakers };
  }

  ofSegment(segment: Segment, state: EditorState): SegmentMarks {
    return {
      ...(segment.hidden ? { hidden: true } : {}),
      ...(this.segmentIsCut(segment, state) ? { cut: true } : {}),
      ...(state.elementStyles.has(segment.id) ? { styled: true } : {}),
    };
  }

  /**
   * The word's marks, or null when it carries none. Its emoji is marked as
   * `emojis` says: on screen, a suggestion its caption would show, or not
   * at all. A word of a segment cut whole is not marked cut on its own.
   */
  ofWord(word: Word, segment: Segment, state: EditorState, emojis: CaptionEmojis): WordMarks | null {
    const marks: WordMarks = {};
    const tags = [...word.semanticTags].map((tag) => tag.name);
    if (tags.length > 0) marks.tags = tags;
    if (word.decoration !== null && emojis.shown.has(word.decoration.id)) {
      marks.emoji = word.decoration.glyph;
      marks.decorationId = word.decoration.id;
    } else if (word.decoration !== null && emojis.suggested.has(word.decoration.id)) {
      marks.suggestedEmoji = word.decoration.glyph;
    }
    if (state.elementStyles.has(word.id)) marks.styled = true;
    if (!this.segmentIsCut(segment, state) && state.cuts.containsTimeRange(word.time.start, word.time.end)) marks.cut = true;
    return Object.keys(marks).length === 0 ? null : marks;
  }

  private segmentIsCut(segment: Segment, state: EditorState): boolean {
    return state.cuts.containsTimeRange(segment.time.start, segment.time.end);
  }
}
