import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import type { SubtitleFile } from '@core/transcription/domain/SubtitleFile';
import type { SubtitleFileReader } from '@core/transcription/domain/SubtitleFileReader';
import { SubtitleFileReadFailedError } from '@core/transcription/domain/errors/SubtitleFileReadFailedError';
import type { SkippedCueBlocksStore } from '@core/transcription/store/SkippedCueBlocksStore';

/** A byte order mark some editors save before the text, which JSON does not allow. */
const BYTE_ORDER_MARK = /^\uFEFF/;

/** One word as a transcription tool writes it: its text under `word` or `text`, its times in seconds. */
interface WordEntry {
  readonly word?: unknown;
  readonly text?: unknown;
  readonly start?: unknown;
  readonly end?: unknown;
}

/**
 * Reads a JSON file that times every word, the way transcription tools
 * write it when asked for word timestamps: a list of words at the top
 * (`{ "words": [...] }`, or the list itself), or a list of segments
 * that each hold theirs (`{ "segments": [{ "words": [...] }] }`). Each
 * word gives its text as `word` or `text` and its `start` and `end` in
 * seconds. This covers the JSON of Whisper, WhisperX, faster-whisper
 * and the transcription APIs built on them.
 *
 * A word the file cannot place (no text, or times that are not numbers
 * with the end at or after the start) is left out and recorded in
 * `skippedCueBlocks` as the text it had, so the store describes the
 * last file read, as it does for SubRip and WebVTT. Rejects with
 * `SubtitleFileReadFailedError` when the text is not JSON, has neither
 * shape, or holds no word that can be placed.
 */
export class JsonWordTimingsSubtitleFileReader implements SubtitleFileReader {
  constructor(private readonly skippedCueBlocks: SkippedCueBlocksStore) {}

  async read(file: SubtitleFile): Promise<Document> {
    this.skippedCueBlocks.clear();
    const words = this.entriesOf(this.parse(file.text)).flatMap((entry) => this.wordOf(entry));
    if (words.length === 0) {
      throw new SubtitleFileReadFailedError({ cause: new Error('the JSON file holds no word with a start and an end') });
    }
    return new Document({
      sections: [new Section({ segments: [new Segment({ lines: [new Line({ words })] })], kind: MAIN_SHEET_ID })],
    });
  }

  private parse(text: string): unknown {
    try {
      return JSON.parse(text.replace(BYTE_ORDER_MARK, ''));
    } catch (cause) {
      throw new SubtitleFileReadFailedError({ cause });
    }
  }

  /** The word entries of either shape, in file order. */
  private entriesOf(json: unknown): ReadonlyArray<WordEntry> {
    if (Array.isArray(json)) return json.filter((entry) => this.isObject(entry));
    if (!this.isObject(json)) throw new SubtitleFileReadFailedError({ cause: new Error('the JSON file is not an object or a list') });
    const { words, segments } = json as { words?: unknown; segments?: unknown };
    if (Array.isArray(words)) return words.filter((entry) => this.isObject(entry));
    if (Array.isArray(segments)) {
      return segments
        .filter((segment) => this.isObject(segment) && Array.isArray((segment as { words?: unknown }).words))
        .flatMap((segment) => ((segment as { words: unknown[] }).words).filter((entry) => this.isObject(entry)));
    }
    throw new SubtitleFileReadFailedError({ cause: new Error('the JSON file has neither "words" nor "segments" with words') });
  }

  /** The entry as a word, or none (recorded as skipped) when it cannot be placed. */
  private wordOf(entry: WordEntry): Word[] {
    const raw = typeof entry.word === 'string' ? entry.word : typeof entry.text === 'string' ? entry.text : '';
    const text = raw.trim();
    const { start, end } = entry;
    const placeable = text !== '' && typeof start === 'number' && typeof end === 'number'
      && Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start;
    if (!placeable) {
      if (text !== '') this.skippedCueBlocks.record(text);
      return [];
    }
    return [new Word({ text, time: new TimeFragment(start, end) })];
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
