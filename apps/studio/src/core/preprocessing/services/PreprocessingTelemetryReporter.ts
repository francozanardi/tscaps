import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PreprocessingPhaseTimeline } from '@core/preprocessing/services/PreprocessingPhaseTimeline';
import type { PreviewProxyRun } from '@core/preprocessing/services/PreviewProxyStage';
import type { PreprocessingRun } from '@core/preprocessing/services/PreprocessingRun';
import type { AppError } from '@core/errors/domain/AppError';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import type { VisibilitySpan } from '@core/_shared/domain/VisibilityTracker';

/**
 * Emits the `preprocessing_*` events for one run and owns the shape
 * of their properties, so what a run reports stays consistent across
 * the three outcomes.
 *
 * Every event carries the run's opaque `run_id`, so the start of a
 * run pairs with its outcome even when two runs of the same video
 * overlap. The outcome names the run's project, when it has one, and
 * says whether the reader had opened another video before the run was
 * over. `elapsed_ms` runs until the project is saved, which includes
 * the original video's upload where projects keep their video on a
 * server; `editor_ready_ms` is when the editor opened on the result,
 * absent when the reader had left by then.
 *
 * Nothing here carries user content: the source is described by its
 * technical facts (size, codecs, durations) and never by its bytes or
 * its file name.
 */
export class PreprocessingTelemetryReporter {
  constructor(
    private readonly store: EditorStore,
    private readonly telemetry: Telemetry,
    private readonly errorDescriber: AppErrorTelemetryDescriber,
    private readonly surfaceLabel: string,
    private readonly transcribesOnDevice: boolean,
  ) {}

  reportStarted(run: PreprocessingRun, metadata: VideoSourceMetadata | null): void {
    this.telemetry.capture('preprocessing_started', {
      ...this.baseProperties(run),
      ...this.metadataProperties(metadata),
    });
  }

  reportCompleted(
    run: PreprocessingRun,
    metadata: VideoSourceMetadata | null,
    timeline: PreprocessingPhaseTimeline,
    proxyRun: PreviewProxyRun,
    elapsedMs: number,
    editorReadyMs: number | null,
  ): void {
    this.telemetry.capture('preprocessing_completed', {
      ...this.baseProperties(run),
      ...this.metadataProperties(metadata),
      ...timeline.toTelemetryProperties(),
      ...this.proxyGenerationProperties(proxyRun),
      ...this.outcomeProperties(run),
      ...(editorReadyMs !== null ? { editor_ready_ms: editorReadyMs } : {}),
      elapsed_ms: elapsedMs,
    });
  }

  /**
   * `visibility` tells a run the person walked away from apart from one
   * that broke: a reload or a navigation hides the page before it
   * unloads, and the request it cuts short fails like a network error.
   */
  reportFailed(
    run: PreprocessingRun,
    metadata: VideoSourceMetadata | null,
    timeline: PreprocessingPhaseTimeline,
    error: AppError,
    visibility: VisibilitySpan,
    elapsedMs: number,
  ): void {
    this.telemetry.capture('preprocessing_failed', {
      ...this.baseProperties(run),
      ...this.metadataProperties(metadata),
      ...timeline.toTelemetryProperties(),
      ...this.errorDescriber.describe(error),
      ...this.outcomeProperties(run),
      was_hidden: visibility.wasHidden,
      visibility_state: visibility.currentState,
      elapsed_ms: elapsedMs,
    });
  }

  /**
   * Rides on every phase of the run, not just the failing one, so a
   * failure count can be read against how often that configuration is
   * chosen at all.
   */
  private baseProperties(run: PreprocessingRun): TelemetryEventProperties {
    return {
      surface: this.surfaceLabel,
      run_id: run.id,
      video_size_mb: this.videoSizeMb(run.videoFile),
      ...this.onDeviceModelProperties(),
    };
  }

  private outcomeProperties(run: PreprocessingRun): TelemetryEventProperties {
    const projectId = run.latestState().projectId;
    return {
      ...(projectId !== null ? { project_id: projectId } : {}),
      editor_session_replaced: !run.ownsEditor(),
    };
  }

  /**
   * The transcribe settings describe the on-device speech model, whose
   * weights are a large first-use download and the part most likely to
   * fail. They only ship when a model actually runs on this device: a
   * session that transcribes remotely still holds a stored preference,
   * and reporting it would populate the field with a choice that had
   * no bearing on the run.
   */
  private onDeviceModelProperties(): TelemetryEventProperties {
    if (!this.transcribesOnDevice) return {};
    const { transcribePreference } = this.store.snapshot();
    return {
      transcribe_model: transcribePreference.model,
      transcribe_backend: transcribePreference.backend,
    };
  }

  private proxyGenerationProperties(proxyRun: PreviewProxyRun): TelemetryEventProperties {
    return {
      proxy_skipped: proxyRun.skippedByPolicy,
      ...(proxyRun.elapsedMs !== null ? { proxy_generation_ms: proxyRun.elapsedMs } : {}),
    };
  }

  private videoSizeMb(videoFile: File): number {
    return Math.round((videoFile.size / (1024 * 1024)) * 10) / 10;
  }

  private metadataProperties(metadata: VideoSourceMetadata | null): TelemetryEventProperties {
    if (!metadata) return {};
    return {
      mime_type: metadata.mimeType,
      container_format: metadata.containerFormat,
      duration_s: metadata.durationSeconds,
      video_codec: metadata.videoCodec,
      video_width: metadata.videoWidthPx,
      video_height: metadata.videoHeightPx,
      has_audio_track: metadata.hasAudioTrack,
      audio_codec: metadata.audioCodec,
      audio_sample_rate: metadata.audioSampleRate,
      audio_channels: metadata.audioChannels,
    };
  }
}
