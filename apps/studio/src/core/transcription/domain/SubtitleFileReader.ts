import type { Document } from '@tscaps/engine';
import type { SubtitleFile } from '@core/transcription/domain/SubtitleFile';

/**
 * Turns a subtitle file into captions: its text, and when each word
 * appears, as far as the file says.
 */
export interface SubtitleFileReader {
  /**
   * The file's captions. Blocks that could not be used are left out
   * and reported elsewhere rather than failing the read. Rejects with
   * `SubtitleFileReadFailedError` when nothing in the file is usable.
   */
  read(file: SubtitleFile): Promise<Document>;
}
