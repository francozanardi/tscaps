import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { VideoConversionOffer } from '@core/preprocessing/domain/VideoConversionOffer';
import type { VideoConversionOfferCoordinator } from '@core/preprocessing/services/VideoConversionOfferCoordinator';
import type {
  VideoConversionAttempt,
  VideoConversionTelemetryReporter,
} from '@core/preprocessing/services/VideoConversionTelemetryReporter';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import type { VideoConverter } from '@core/videos/domain/VideoConverter';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import { VideoConversionFailedError } from '@core/videos/domain/errors/VideoConversionFailedError';
import type { VideoConversionAvailability } from '@core/videos/services/VideoConversionAvailability';

/** The file a preprocessing run works from. */
export interface AdmittedSource {
  readonly file: File;
  /** `true` when `file` is a conversion of the chosen video rather than the video itself. */
  readonly converted: boolean;
}

/**
 * Decides which file a preprocessing run works from: the chosen video
 * when this browser decodes it, or a conversion of it when it does not,
 * a conversion exists for its codec, and the reader accepts one.
 *
 * Raises the compatibility checker's refusal when no conversion
 * applies or the reader declines it, and `VideoConversionFailedError`
 * when an accepted conversion does not finish or its result does not
 * decode either. A conversion reports its progress as the `converting`
 * phase.
 */
export class SourceVideoAdmission {
  constructor(
    private readonly compatibilityChecker: VideoCompatibilityChecker,
    private readonly conversionAvailability: VideoConversionAvailability,
    private readonly converter: VideoConverter,
    private readonly offerCoordinator: VideoConversionOfferCoordinator,
    private readonly progressStore: PreprocessingProgressStore,
    private readonly telemetryReporter: VideoConversionTelemetryReporter,
  ) {}

  async admit(source: File, metadata: VideoSourceMetadata | null): Promise<AdmittedSource> {
    try {
      await this.compatibilityChecker.check(source);
      return { file: source, converted: false };
    } catch (refusal) {
      if (!this.conversionAvailability.canConvert(refusal)) throw refusal;
      const attempt: VideoConversionAttempt = {
        source,
        codec: refusal.codec,
        metadata,
        offer: await this.offerFor(source),
      };
      if (!(await this.askReader(attempt))) throw refusal;
      return { file: await this.convert(attempt), converted: true };
    }
  }

  private async offerFor(source: File): Promise<VideoConversionOffer> {
    const estimate = await this.converter.estimate(source);
    return { estimatedSeconds: estimate?.seconds ?? null };
  }

  private async askReader(attempt: VideoConversionAttempt): Promise<boolean> {
    this.telemetryReporter.reportOffered(attempt);
    const offeredAt = performance.now();
    const accepted = await this.offerCoordinator.offerAndAwait(attempt.offer);
    const decisionMs = performance.now() - offeredAt;
    if (accepted) this.telemetryReporter.reportAccepted(attempt, decisionMs);
    else this.telemetryReporter.reportDeclined(attempt, decisionMs);
    return accepted;
  }

  private async convert(attempt: VideoConversionAttempt): Promise<File> {
    this.progressStore.start('converting');
    const startedAt = performance.now();
    try {
      const converted = await this.converter.convert(
        attempt.source,
        (fraction) => this.progressStore.setConversionProgress(fraction),
      );
      await this.compatibilityChecker.check(converted);
      this.telemetryReporter.reportCompleted(attempt, converted, performance.now() - startedAt);
      return converted;
    } catch (cause) {
      this.progressStore.cancel();
      const failure = cause instanceof VideoConversionFailedError ? cause : new VideoConversionFailedError({ cause });
      this.telemetryReporter.reportFailed(attempt, failure, performance.now() - startedAt);
      throw failure;
    }
  }
}
