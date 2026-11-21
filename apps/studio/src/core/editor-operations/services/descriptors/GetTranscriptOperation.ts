import { z } from 'zod';
import type { Document } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { ORIGINAL_CAPTION_TRACK_ID } from '@core/translations/domain/CaptionTrack';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { PlacedSegment } from '@core/editor-operations/domain/PlacedSegment';
import type { CaptionLineReadout } from '@core/editor-operations/services/CaptionLineReadout';
import type { CaptionRowReadout } from '@core/editor-operations/services/CaptionRowReadout';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import type { ShownDecorationReader } from '@core/editor-operations/services/ShownDecorationReader';
import type { TranscriptTextReadout } from '@core/editor-operations/services/TranscriptTextReadout';

// The longest stretch read with refs at once: a minute of speech is a few hundred words, and a whole video read
// that way would fill the reader's context.
const MAX_CAPTIONS_SPAN_SEC = 60;

/**
 * `get_transcript`: what the captions shown now say, at the detail asked:
 * plain text with a time every ten seconds (any stretch, the whole video
 * by default), or the captions themselves, segment by segment with every
 * word's ref (`words`, short lines) or also every word's times and marks
 * (`timed`), at most a minute at a time. Reads only.
 */
export class GetTranscriptOperation implements EditorOperation {
  readonly name = 'get_transcript';
  readonly effect = 'read';
  readonly description = [
    'Read the captions shown now (a segment is one caption on screen), at one of three details.',
    '`text`: what they say, as lines of about ten seconds each opening with its time ("[12.4 s] ..."), no refs; any stretch, the whole video by default. Read it to know what is said, for instance again after a large edit.',
    '`words` (the default): at most a minute from fromSec, one line per segment with every word\'s ref, for any edit that names segments or words: "segment:1 0-1.46 sheet:1 A: So(word:2) here(word:3 #emphasis 🔥)".',
    'After the times come the sheet, the speaker when known, and hidden (not painted), cut (inside a cut) or styled (own CSS); inside a word\'s brackets, its ref, its tags as #tag, its emoji on screen, suggested:🔥 for an emoji suggested for this layout that does not show (set_caption_effects turns them on), styled or cut.',
    '`timed`: at most a minute, each segment as {ref, startSec, endSec, sheet, marks, speaker, text, words}, each word as [ref, text, startSec, endSec, extras?] with its emoji\'s decoration ref: read it when you need when a word is said (to time a graphic, a sound or a cut to it) or an emoji\'s ref.',
    'A minute read with more after it answers nextFromSec: read from there for the next minute.',
    'Times are seconds of the source video. Word refs stay valid across edits; segment and line refs change when captions are re-split, so read again after editing text or timing. While a translation is shown, its captions are what is read.',
  ].join(' ');

  private readonly input = new OperationInput({
    detail: z.enum(['text', 'words', 'timed']).default('words').describe('How much to read: text only, segments with word refs, or with word times and marks too.'),
    fromSec: z.number().min(0).optional().describe('Start of the stretch, in seconds of the source video. The video\'s start when omitted.'),
    toSec: z.number().min(0).optional().describe('End of the stretch, in seconds of the source video; must be after fromSec. For words and timed, at most a minute after fromSec, which is also the default.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly format: ReadoutFormatter,
    private readonly decorations: ShownDecorationReader,
    private readonly text: TranscriptTextReadout,
    private readonly lines: CaptionLineReadout,
    private readonly rows: CaptionRowReadout,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { detail, fromSec = 0, toSec } = checked.value;
    if (toSec !== undefined && toSec <= fromSec) {
      return this.refused([{ severity: 'error', message: `toSec (${toSec}) must be after fromSec (${fromSec}).` }]);
    }
    const state = this.store.snapshot();
    if (state.document === null) {
      return this.refused([{ severity: 'error', message: 'The project has no captions yet: the video has not been transcribed.' }]);
    }
    const track = this.shownTranslationOf(state);
    const header = track === null ? {} : { track };
    if (detail === 'text') {
      return this.answered({ ...header, text: this.text.textOf(state.document, fromSec, toSec ?? Number.POSITIVE_INFINITY) });
    }
    return this.answered({ ...header, ...this.captionsOf(state, state.document, detail, fromSec, toSec) });
  }

  /** The segments of one stretch of at most a minute, as lines or rows, and where the next minute starts when there is one. */
  private captionsOf(state: EditorState, document: Document, detail: 'words' | 'timed', fromSec: number, askedToSec: number | undefined): Record<string, unknown> {
    const toSec = Math.min(askedToSec ?? Number.POSITIVE_INFINITY, fromSec + MAX_CAPTIONS_SPAN_SEC);
    const all = this.placedSegments(document);
    const placed = all.filter(({ segment }) => segment.time.end > fromSec && segment.time.start < toSec);
    const emojis = this.decorations.emojisOf(state);
    const captions = detail === 'words'
      ? { captions: placed.map((each) => this.lines.lineOf(each, state, emojis)).join('\n') }
      : { segments: placed.map((each) => this.rows.rowOf(each, state, emojis)) };
    const nextFromSec = this.nextFromSecOf(all, placed, toSec, askedToSec);
    return nextFromSec === null ? captions : { ...captions, nextFromSec };
  }

  /**
   * Where to read on from, or null when nothing the person asked for is
   * left: past the end of the last segment answered, so a segment that
   * runs across the minute's end is not answered twice.
   */
  private nextFromSecOf(all: ReadonlyArray<PlacedSegment>, placed: ReadonlyArray<PlacedSegment>, toSec: number, askedToSec: number | undefined): number | null {
    const next = Math.max(toSec, ...placed.map(({ segment }) => segment.time.end));
    const limit = askedToSec ?? Number.POSITIVE_INFINITY;
    const remains = all.some(({ segment }) => segment.time.end > next && segment.time.start < limit);
    return remains ? this.format.sec(next) : null;
  }

  /** Every segment with the sheet its section routes it to, in time order. */
  private placedSegments(document: Document): PlacedSegment[] {
    return document.sections
      .flatMap((section) => section.segments.map((segment) => ({ segment, sheetId: section.kind })))
      .sort((first, second) => first.segment.time.start - second.segment.time.start);
  }

  /** The translation shown, or null while the captions shown are the original ones. */
  private shownTranslationOf(state: EditorState): { id: string; name: string } | null {
    if (state.activeCaptionTrackId === null || state.activeCaptionTrackId === ORIGINAL_CAPTION_TRACK_ID) return null;
    const track = state.captionTracks.find((candidate) => candidate.id === state.activeCaptionTrackId);
    return track === undefined ? null : { id: track.id, name: track.name };
  }

  private answered(output: Record<string, unknown>): OperationResult {
    return { ok: true, output, problems: [] };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
