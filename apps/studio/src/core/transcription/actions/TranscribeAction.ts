import {
  Document,
  Line,
  NarrationPace,
  Section,
  Segment,
  TimeFragment,
  Word,
  type TranscriberOptions,
  type UntranscribedRegion,
} from '@tscaps/engine';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import { UNTRANSCRIBED_PLACEHOLDER_TEXT } from '@core/transcription/domain/UntranscribedPlaceholder';
import type { TranscriptionRequester } from '@core/transcription/domain/TranscriptionRequester';
import type { TranscriptionResult } from '@core/transcription/domain/TranscriptionResult';
import type { WordOverlapClamper } from '@core/transcription/services/WordOverlapClamper';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/**
 * Transcribes a video file into a `Document` whose words carry their
 * per-word timing. Asks the transcriber for the model and device of the
 * supplied preference, reports progress to the requester's progress,
 * and hands the transcriber the requester's project. Each region the
 * call left untranscribed gets a placeholder word covering it in the
 * document, and is returned with it. The result is returned, not
 * written to a store; the orchestrator that drives the preprocessing
 * pipeline decides what to do with it, the notice about the regions
 * included.
 *
 * Throws on failure after cancelling the progress reporter so the
 * caller can surface the error and reset its own state.
 */
export class TranscribeAction {
  constructor(
    private readonly transcriber: ConfigurableTranscriber,
    private readonly overlapClamper: WordOverlapClamper,
    private readonly telemetry: Telemetry,
  ) {}

  async execute(
    videoFile: File,
    preference: TranscribePreference,
    requester: TranscriptionRequester,
    options?: TranscriberOptions,
    languageCode?: string | null,
  ): Promise<TranscriptionResult> {
    requester.progress.start(this.transcriber.initialPhase);

    try {
      const transcribed = await this.transcriber.transcribe(videoFile, requester, {
        config: { model: preference.model, device: preference.backend },
        ...(options ? { options } : {}),
      });
      const regions = transcribed.untranscribedRegions;
      const document = this.assemble(transcribed.document.getWords(), regions, languageCode ?? null);
      if (regions.length > 0) this.reportGaps(regions, preference);
      return { document, untranscribedRegions: regions };
    } catch (err) {
      requester.progress.cancel();
      throw err;
    }
  }

  private reportGaps(regions: readonly UntranscribedRegion[], preference: TranscribePreference): void {
    this.telemetry.capture('transcription_gaps_detected', {
      regions_count: regions.length,
      untranscribed_seconds: Math.round(
        regions.reduce((total, region) => total + (region.endSeconds - region.startSeconds), 0),
      ),
      model: preference.model,
      backend: preference.backend,
    });
  }

  private assemble(
    rawWords: ReadonlyArray<Word>,
    untranscribedRegions: ReadonlyArray<UntranscribedRegion>,
    languageCode: string | null,
  ): Document {
    const allWords = this.overlapClamper.clamp(this.withPlaceholders(rawWords, untranscribedRegions));
    const segments = allWords.length === 0
      ? []
      : [new Segment({ lines: [new Line({ words: allWords })] })];
    return new Document({
      sections: [new Section({ segments, kind: MAIN_SHEET_ID })],
      narrationPace: NarrationPace.fromWords(allWords),
      language: languageCode,
    });
  }

  /**
   * Covers each untranscribed region with one placeholder word spanning
   * it, merged into time order. The placeholder is an ordinary word —
   * editable and deletable like any other.
   */
  private withPlaceholders(
    words: ReadonlyArray<Word>,
    regions: ReadonlyArray<UntranscribedRegion>,
  ): ReadonlyArray<Word> {
    if (regions.length === 0) return words;
    const placeholders = regions.map((region) => new Word({
      text: UNTRANSCRIBED_PLACEHOLDER_TEXT,
      time: new TimeFragment(region.startSeconds, region.endSeconds),
    }));
    return [...words, ...placeholders].sort((a, b) => a.time.start - b.time.start);
  }
}
