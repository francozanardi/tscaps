import type { Document, Line, Segment, Word } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { CaptionElement } from '@core/editor-operations/services/CaptionRefResolver';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { ElementStyleReadout } from '@core/editor-operations/services/ElementStyleReadout';
import type { ShownDecorationReader } from '@core/editor-operations/services/ShownDecorationReader';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';

/** Where a caption node sits: the sheet its section routes to, its segment, and its line and word where it is inside one. */
interface CaptionPlace {
  readonly sheetId: string;
  readonly segment: Segment;
  readonly line?: Line;
  readonly word?: Word;
}

/** A word as `[ref, text, startSec, endSec]`. */
type WordRow = [string, string, number, number];

/**
 * Reads one caption node (a segment, a line, a word or an emoji) for a
 * read answer: its text and times, the sheet that styles it, the nodes
 * around it, what the person set on it by hand (tags, visibility,
 * behind the person), and the style it carries of its own.
 */
export class CaptionElementReadout {
  constructor(
    private readonly parser: EditorRefParser,
    private readonly styles: ElementStyleReadout,
    private readonly format: ReadoutFormatter,
    private readonly decorations: ShownDecorationReader,
  ) {}

  /** Everything about `caption` in the captions shown in `state`, or null where they no longer hold it. */
  detail(caption: CaptionElement, state: EditorState): Record<string, unknown> | null {
    const place = state.document === null ? null : this.placeOf(state.document, caption);
    if (place === null) return null;
    const style = this.styles.of(state.elementStyles.get(caption.id));
    return {
      ref: caption.ref,
      kind: caption.kind,
      text: caption.text,
      startSec: this.format.sec(caption.startSec),
      endSec: this.format.sec(caption.endSec),
      sheet: this.parser.formatOf('sheet', place.sheetId),
      ...this.kindDetail(caption, place, state),
      ...(style === null ? {} : { style }),
    };
  }

  private placeOf(document: Document, caption: CaptionElement): CaptionPlace | null {
    for (const section of document.sections) {
      for (const segment of section.segments) {
        if (caption.kind === 'segment' && segment.id === caption.id) return { sheetId: section.kind, segment };
        for (const line of segment.lines) {
          if (caption.kind === 'line' && line.id === caption.id) return { sheetId: section.kind, segment, line };
          const word = line.words.find((candidate) => this.names(caption, candidate));
          if (word !== undefined) return { sheetId: section.kind, segment, line, word };
        }
      }
    }
    return null;
  }

  /** Whether `caption` is the word `word`, or the emoji on it. */
  private names(caption: CaptionElement, word: Word): boolean {
    if (caption.kind === 'word') return word.id === caption.id;
    return caption.kind === 'decoration' && word.decoration?.id === caption.id;
  }

  private kindDetail(caption: CaptionElement, place: CaptionPlace, state: EditorState): Record<string, unknown> {
    const segmentRef = this.parser.formatOf('segment', place.segment.id);
    switch (caption.kind) {
      case 'segment':
        return this.segmentDetail(place.segment, state);
      case 'line':
        return { segment: segmentRef, words: (place.line?.words ?? []).map((word) => this.wordRow(word)) };
      case 'word':
        return place.word === undefined || place.line === undefined
          ? { segment: segmentRef }
          : { segment: segmentRef, line: this.parser.formatOf('line', place.line.id), ...this.wordDetail(place.word, state) };
      case 'decoration':
        return {
          segment: segmentRef,
          ...(place.word === undefined ? {} : { word: this.parser.formatOf('word', place.word.id) }),
          ...this.behindPersonOf(caption.id, state),
        };
    }
  }

  private segmentDetail(segment: Segment, state: EditorState): Record<string, unknown> {
    const visibility = state.segmentVisibilityOverrides.get(segment.id);
    const speakers = [...new Set(segment.getWords().flatMap((word) => (word.speakerId === null ? [] : [word.speakerId])))];
    return {
      ...(segment.hidden ? { hidden: true } : {}),
      ...(visibility === 'auto' ? {} : { visibility }),
      ...(state.cuts.containsTimeRange(segment.time.start, segment.time.end) ? { cut: true } : {}),
      ...this.behindPersonOf(segment.id, state),
      ...(speakers.length === 0 ? {} : { speakers }),
      lines: segment.lines.map((line) => ({ ref: this.parser.formatOf('line', line.id), text: line.getText() })),
      words: segment.getWords().map((word) => this.wordRow(word)),
    };
  }

  private wordDetail(word: Word, state: EditorState): Record<string, unknown> {
    const tags = [...word.semanticTags].map((tag) => tag.name);
    return {
      ...(word.speakerId === null ? {} : { speaker: word.speakerId }),
      ...(tags.length === 0 ? {} : { tags }),
      ...this.emojiDetail(word, state),
      ...this.behindPersonOf(word.id, state),
      ...(state.cuts.containsTimeRange(word.time.start, word.time.end) ? { cut: true } : {}),
    };
  }

  /** Whether the element was put behind the person by hand ("on") or kept in front ("off"); nothing while its template decides. */
  private behindPersonOf(elementId: string, state: EditorState): Record<string, unknown> {
    const override = state.behindActorOverrides.get(elementId);
    if (override === 'force-on') return { behindPerson: 'on' };
    return override === 'force-off' ? { behindPerson: 'off' } : {};
  }

  /** The emoji on screen with its ref, or the suggestion its caption would show once automatic emojis are on; nothing else. */
  private emojiDetail(word: Word, state: EditorState): Record<string, unknown> {
    if (word.decoration === null) return {};
    const emojis = this.decorations.emojisOf(state);
    if (emojis.shown.has(word.decoration.id)) {
      return { decoration: { ref: this.parser.formatOf('decoration', word.decoration.id), emoji: word.decoration.glyph } };
    }
    return emojis.suggested.has(word.decoration.id) ? { suggestedEmoji: word.decoration.glyph } : {};
  }

  private wordRow(word: Word): WordRow {
    return [this.parser.formatOf('word', word.id), word.text, this.format.sec(word.time.start), this.format.sec(word.time.end)];
  }
}
