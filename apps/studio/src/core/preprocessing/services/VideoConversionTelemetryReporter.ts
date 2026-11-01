import type { AppError } from '@core/errors/domain/AppError';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { VideoConversionOffer } from '@core/preprocessing/domain/VideoConversionOffer';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import type { TelemetryEventProperties } from '@shared/telemetry';

/** One video offered the in-browser conversion, as the `video_conversion_*` events describe it. */
export interface VideoConversionAttempt {
  readonly source: File;
  /** The codec this browser refused. */
  readonly codec: string;
  readonly metadata: VideoSourceMetadata | null;
  readonly offer: VideoConversionOffer;
}

/**
 * Emits the `video_conversion_*` events and owns the shape of their
 * properties: every event of one attempt carries the same description
 * of the source, so the funnel from offer to finished conversion can
 * be read per codec, size and length.
 *
 * Nothing here carries user content: the source is described by its
 * technical facts and never by its bytes or its file name.
 */
export class VideoConversionTelemetryReporter {
  constructor(
    private readonly telemetry: Telemetry,
    private readonly errorDescriber: AppErrorTelemetryDescriber,
    private readonly surfaceLabel: string,
  ) {}

  reportOffered(attempt: VideoConversionAttempt): void {
    this.telemetry.capture('video_conversion_offered', this.attemptProperties(attempt));
  }

  /** `decisionMs` is how long the reader took to answer. */
  reportAccepted(attempt: VideoConversionAttempt, decisionMs: number): void {
    this.telemetry.capture('video_conversion_accepted', {
      ...this.attemptProperties(attempt),
      decision_ms: Math.round(decisionMs),
    });
  }

  /** `decisionMs` is how long the reader took to answer. */
  reportDeclined(attempt: VideoConversionAttempt, decisionMs: number): void {
    this.telemetry.capture('video_conversion_declined', {
      ...this.attemptProperties(attempt),
      decision_ms: Math.round(decisionMs),
    });
  }

  /**
   * `realtime_factor` is seconds of video converted per second of
   * work, the figure the estimate is calibrated against.
   */
  reportCompleted(attempt: VideoConversionAttempt, converted: File, elapsedMs: number): void {
    const durationSeconds = attempt.metadata?.durationSeconds ?? null;
    this.telemetry.capture('video_conversion_completed', {
      ...this.attemptProperties(attempt),
      elapsed_ms: Math.round(elapsedMs),
      output_size_mb: this.sizeMb(converted),
      ...(durationSeconds !== null && elapsedMs > 0
        ? { realtime_factor: Math.round((durationSeconds / (elapsedMs / 1000)) * 100) / 100 }
        : {}),
    });
  }

  reportFailed(attempt: VideoConversionAttempt, error: AppError, elapsedMs: number): void {
    this.telemetry.capture('video_conversion_failed', {
      ...this.attemptProperties(attempt),
      ...this.errorDescriber.describe(error),
      elapsed_ms: Math.round(elapsedMs),
    });
  }

  private attemptProperties({ source, codec, metadata, offer }: VideoConversionAttempt): TelemetryEventProperties {
    return {
      surface: this.surfaceLabel,
      video_codec: codec,
      video_size_mb: this.sizeMb(source),
      container_format: metadata?.containerFormat ?? null,
      duration_s: metadata?.durationSeconds ?? null,
      video_width: metadata?.videoWidthPx ?? null,
      video_height: metadata?.videoHeightPx ?? null,
      estimate_s: offer.estimatedSeconds,
      memory_heavy: offer.memoryHeavy,
    };
  }

  private sizeMb(file: File): number {
    return Math.round((file.size / (1024 * 1024)) * 10) / 10;
  }
}
