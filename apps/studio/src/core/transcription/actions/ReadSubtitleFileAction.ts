import { Document, Line, NarrationPace, Section, Segment } from '@tscaps/engine';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import type { SubtitleFile } from '@core/transcription/domain/SubtitleFile';
import type { SubtitleFileReader } from '@core/transcription/domain/SubtitleFileReader';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { WordOverlapClamper } from '@core/transcription/services/WordOverlapClamper';

/**
 * Builds the run's `Document` from a subtitle file the user brought,
 * in place of transcribing the audio. The result has the shape a
 * transcription has — every word in one segment, in time order, with
 * overlaps clamped — so the passes after it, segmentation included,
 * treat it the same: the file supplies words and timings, not where
 * captions break.
 *
 * Reports to the `progress` it is handed, the progress of the run that
 * asked, as the transcription phase, and cancels it before rethrowing a
 * failure.
 */
export class ReadSubtitleFileAction {
  constructor(
    private readonly reader: SubtitleFileReader,
    private readonly overlapClamper: WordOverlapClamper,
  ) {}

  async execute(
    file: SubtitleFile,
    languageCode: string | null,
    progress: PreprocessingProgressStore,
  ): Promise<Document> {
    progress.start('inferring');
    try {
      const read = await this.reader.read(file);
      const words = this.overlapClamper.clamp(read.getWords());
      const segments = words.length === 0 ? [] : [new Segment({ lines: [new Line({ words })] })];
      return new Document({
        sections: [new Section({ segments, kind: MAIN_SHEET_ID })],
        narrationPace: NarrationPace.fromWords(words),
        language: languageCode,
      });
    } catch (err) {
      progress.cancel();
      throw err;
    }
  }
}
