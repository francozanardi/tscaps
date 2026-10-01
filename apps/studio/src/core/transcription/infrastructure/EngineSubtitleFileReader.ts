import { SrtTranscriber, VttTranscriber } from '@tscaps/engine';
import type { Document } from '@tscaps/engine';
import type { SubtitleFile } from '@core/transcription/domain/SubtitleFile';
import type { SubtitleFileReader } from '@core/transcription/domain/SubtitleFileReader';
import { SubtitleFileReadFailedError } from '@core/transcription/domain/errors/SubtitleFileReadFailedError';
import type { SkippedCueBlocksStore } from '@core/transcription/store/SkippedCueBlocksStore';

const WEBVTT_HEADER = /^\uFEFF?WEBVTT(?:[ \t]|\r?\n|$)/;

/**
 * Reads SubRip and WebVTT files through the engine's parsers.
 *
 * The format is told by the text, not by the file name: a WebVTT file
 * must open with its `WEBVTT` header, and anything else is read as
 * SubRip. Read the other way round, a WebVTT header would be a block
 * without a timecode and reported as dropped text.
 *
 * Each read starts by clearing `skippedCueBlocks`, then records in it
 * every block the parser left out, so the store always describes the
 * last file read.
 */
export class EngineSubtitleFileReader implements SubtitleFileReader {

  constructor(private readonly skippedCueBlocks: SkippedCueBlocksStore) {}

  async read(file: SubtitleFile): Promise<Document> {
    this.skippedCueBlocks.clear();
    const parser = WEBVTT_HEADER.test(file.text) ? new VttTranscriber(file.text) : new SrtTranscriber(file.text);
    parser.onSkippedCueBlock = (block) => this.skippedCueBlocks.record(block);
    try {
      return await parser.transcribe(new Blob());
    } catch (cause) {
      throw new SubtitleFileReadFailedError({ cause });
    }
  }
}
