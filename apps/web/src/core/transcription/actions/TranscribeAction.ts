import { Document, Line, NarrationPace, Section, Segment, type TranscriberOptions, type Word } from '@tscaps/engine';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import type { TranscribeProgressStore } from '@core/transcription/store/TranscribeProgressStore';
import type { WordOverlapClamper } from '@core/transcription/services/WordOverlapClamper';

/**
 * Transcribes a video file into a `Document` whose words carry their
 * per-word timing. Configures the underlying transcriber from the
 * supplied preference, reports progress through
 * `TranscribeProgressStore`, and emits `transcription_*` telemetry
 * around the run. The result is returned, not written to a store —
 * the orchestrator that drives the preprocessing pipeline decides
 * what to do with it.
 *
 * Throws on failure after cancelling the progress reporter so the
 * caller can surface the error and reset its own state.
 */
export class TranscribeAction {
  constructor(
    private readonly transcriber: ConfigurableTranscriber,
    private readonly progress: TranscribeProgressStore,
    private readonly overlapClamper: WordOverlapClamper,
  ) {}

  async execute(
    videoFile: File,
    preference: TranscribePreference,
    options?: TranscriberOptions,
  ): Promise<Document> {
    this.transcriber.setConfig({
      model: preference.model,
      device: preference.backend,
    });
    this.progress.start(this.transcriber.initialPhase);

    try {
      const transcribed = await this.transcriber.transcribe(videoFile, options);
      const document = this.assemble(transcribed.getWords());
      this.progress.markComplete();
      return document;
    } catch (err) {
      this.progress.cancel();
      throw err;
    }
  }

  private assemble(rawWords: ReadonlyArray<Word>): Document {
    const allWords = this.overlapClamper.clamp(rawWords);
    const segments = allWords.length === 0
      ? []
      : [new Segment({ lines: [new Line({ words: allWords })] })];
    return new Document({
      sections: [new Section({ segments, kind: MAIN_SHEET_ID })],
      narrationPace: NarrationPace.fromWords(allWords),
    });
  }
}
