import type { Document } from '@tscaps/engine';
import type { SubtitleFile } from '@core/transcription/domain/SubtitleFile';
import type { SubtitleFileReader } from '@core/transcription/domain/SubtitleFileReader';

const JSON_START = /^\uFEFF?\s*[[{]/;

/**
 * Reads a captions file with the reader for its format, told by the
 * text rather than the file name: text that opens with `{` or `[` is a
 * JSON file of word timings, and anything else is a subtitle file
 * (SubRip or WebVTT).
 */
export class FormatPickingSubtitleFileReader implements SubtitleFileReader {
  constructor(
    private readonly wordTimings: SubtitleFileReader,
    private readonly subtitles: SubtitleFileReader,
  ) {}

  read(file: SubtitleFile): Promise<Document> {
    return JSON_START.test(file.text) ? this.wordTimings.read(file) : this.subtitles.read(file);
  }
}
