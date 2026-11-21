import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { PreprocessingRun } from '@core/preprocessing/services/PreprocessingRun';
import type { VideoConversionOffer } from '@core/preprocessing/domain/VideoConversionOffer';
import type {
  VideoConversionAnswer,
  VideoConversionOfferCoordinator,
} from '@core/preprocessing/services/VideoConversionOfferCoordinator';
import type {
  VideoConversionAttempt,
  VideoConversionTelemetryReporter,
} from '@core/preprocessing/services/VideoConversionTelemetryReporter';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import type { VideoConverter } from '@core/videos/domain/VideoConverter';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import { VideoConversionFailedError } from '@core/videos/domain/errors/VideoConversionFailedError';
import type { VideoConversionAvailability } from '@core/videos/services/VideoConversionAvailability';
import type { VideoConversionMemoryRisk } from '@core/videos/services/VideoConversionMemoryRisk';

/** The file a preprocessing run works from. */
export interface AdmittedSource {
  readonly file: File;
  /** `true` when `file` is a conversion of the chosen video rather than the video itself. */
  readonly converted: boolean;
}

/**
 * Decides which file a preprocessing run works from: the run's video
 * when this browser decodes it, or a conversion of it when it does not,
 * a conversion exists for its codec, and the reader accepts one. The
 * offer says how long the conversion should take, and whether it may
 * need more memory than this browser's tab is likely to get.
 *
 * Raises the compatibility checker's refusal when no conversion
 * applies or the reader declines it, and `VideoConversionFailedError`
 * when an accepted conversion does not finish or its result does not
 * decode either. A conversion reports its progress to the run's own
 * progress, as the `converting` phase.
 *
 * The offer and the conversion belong to the run's editor session.
 * When the session leaves the editor before the reader answers, the
 * offer is taken back so no later screen shows it; when it leaves while
 * an accepted conversion runs, the conversion stops at its next frame.
 * Either way the run is admitted nothing.
 */
export class SourceVideoAdmission {
  constructor(
    private readonly compatibilityChecker: VideoCompatibilityChecker,
    private readonly conversionAvailability: VideoConversionAvailability,
    private readonly memoryRisk: VideoConversionMemoryRisk,
    private readonly converter: VideoConverter,
    private readonly offerCoordinator: VideoConversionOfferCoordinator,
    private readonly telemetryReporter: VideoConversionTelemetryReporter,
  ) {}

  /**
   * Resolves to the file `run` works from, or to `null` when the reader
   * left the run's session before answering the offer to convert it, or
   * while the conversion they accepted ran.
   */
  async admit(run: PreprocessingRun, metadata: VideoSourceMetadata | null): Promise<AdmittedSource | null> {
    const source = run.videoFile;
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
      const answer = await this.askReader(attempt, run);
      if (answer === 'withdrawn') return null;
      if (answer === 'declined') throw refusal;
      const converted = await this.convertForSession(attempt, run);
      return converted ? { file: converted, converted: true } : null;
    }
  }

  private async offerFor(source: File): Promise<VideoConversionOffer> {
    const estimate = await this.converter.estimate(source);
    return {
      estimatedSeconds: estimate?.seconds ?? null,
      memoryHeavy: estimate !== null && this.memoryRisk.isHigh(estimate),
    };
  }

  /**
   * Puts the offer to the reader while the editor shows the run's
   * session, and takes it back if the session leaves the editor first.
   * A withdrawn offer is not reported: nobody declined it.
   */
  private async askReader(attempt: VideoConversionAttempt, run: PreprocessingRun): Promise<VideoConversionAnswer> {
    if (!run.ownsEditor()) return 'withdrawn';
    this.telemetryReporter.reportOffered(attempt);
    const offeredAt = performance.now();
    const answering = this.offerCoordinator.offerAndAwait(attempt.offer);
    run.onSessionEnd(() => this.offerCoordinator.withdraw(attempt.offer));
    const answer = await answering;
    const decisionMs = performance.now() - offeredAt;
    if (answer === 'accepted') this.telemetryReporter.reportAccepted(attempt, decisionMs);
    if (answer === 'declined') this.telemetryReporter.reportDeclined(attempt, decisionMs);
    return answer;
  }

  /** Converts while the run's session lasts: leaving it stops the conversion. */
  private convertForSession(attempt: VideoConversionAttempt, run: PreprocessingRun): Promise<File | null> {
    const sessionEnded = new AbortController();
    run.onSessionEnd(() => sessionEnded.abort());
    return this.convert(attempt, run.progress, sessionEnded.signal);
  }

  /**
   * Resolves to the conversion, or to `null` when `stopped` aborted
   * before it was done. Only a conversion that failed on its own raises.
   */
  private async convert(
    attempt: VideoConversionAttempt,
    progress: PreprocessingProgressStore,
    stopped: AbortSignal,
  ): Promise<File | null> {
    progress.start('converting');
    const startedAt = performance.now();
    let reached = 0;
    try {
      const converted = await this.converter.convert(
        attempt.source,
        (fraction) => {
          reached = fraction;
          progress.setConversionProgress(fraction);
        },
        stopped,
      );
      await this.compatibilityChecker.check(converted);
      this.telemetryReporter.reportCompleted(attempt, converted, performance.now() - startedAt);
      return converted;
    } catch (cause) {
      progress.cancel();
      if (stopped.aborted) {
        this.telemetryReporter.reportAbandoned(attempt, reached, performance.now() - startedAt);
        return null;
      }
      const failure = cause instanceof VideoConversionFailedError ? cause : new VideoConversionFailedError({ cause });
      this.telemetryReporter.reportFailed(attempt, failure, performance.now() - startedAt);
      throw failure;
    }
  }
}
