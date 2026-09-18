import type { AudioDiscardReason, VideoFrameDecoderSelection } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SheetCustomizationDiff } from '@core/sheets/services/SheetCustomizationDiff';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import { AppError } from '@core/errors/domain/AppError';
import { ExportFailedError } from '@core/export/domain/ExportFailedError';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { VisibilitySpan } from '@core/_shared/domain/VisibilityTracker';
import type { VideoBlobSource } from '@core/videos/domain/VideoBlobLookup';
// Type-only, so the two files do not depend on each other at runtime.
import type { ExportResolution, ExportVideoOptions } from '@core/export/actions/ExportVideoAction';

/** What an export that reached the end has to say about how it went. */
export interface ExportRunOutcome {
  readonly options: ExportVideoOptions;
  readonly elapsedMs: number;
  readonly sheets: readonly Sheet[];
  readonly audioDiscardedReason: AudioDiscardReason | null;
  readonly decoderSelection: VideoFrameDecoderSelection | null;
  readonly videoSource: VideoBlobSource | null;
}

/**
 * What an export that broke has to say. `visibility` is absent where
 * there is no window to hide: the fields still travel as `null` so a
 * run without them is not read as a run that stayed visible.
 */
export interface ExportRunFailure {
  readonly error: unknown;
  readonly options: ExportVideoOptions;
  readonly elapsedMs: number;
  readonly progressPercent: number;
  readonly visibility: VisibilitySpan | null;
  readonly decoderSelection: VideoFrameDecoderSelection | null;
  readonly videoSource: VideoBlobSource | null;
}

/**
 * The export funnel, for whoever is running one.
 *
 * It lives apart from the action that renders in the editor because a
 * second caller renders the same picture on a machine the user does
 * not own, and a funnel written twice stops agreeing with itself the
 * first time one side gains a property. Which of the two ran an export
 * is answered by the entry point every event already carries, not by a
 * property here.
 *
 * Reads the run's shape off the editor state, which both callers fill
 * before rendering.
 */
export class ExportRunTelemetry {

  constructor(
    private readonly telemetry: Telemetry,
    private readonly editorStore: EditorStore,
    private readonly customizationDiff: SheetCustomizationDiff,
    private readonly errorTelemetryDescriber: AppErrorTelemetryDescriber,
  ) {}

  /**
   * Opens the funnel, and describes how each sheet's template was
   * customized. The customization is captured here rather than at the
   * end so it reflects what is being rendered, not intermediate state
   * the user explored and reverted.
   */
  started(options: ExportVideoOptions, sheets: readonly Sheet[]): void {
    this.telemetry.capture('export_started', this.optionProperties(options));
    for (const sheet of sheets) {
      const customized = this.customizationDiff.diff(sheet);
      this.telemetry.capture('template_used_at_export', {
        template_id: sheet.template.metadata.id,
        template_category: sheet.template.metadata.category,
        customized_properties: [...customized],
        customized_count: customized.length,
      });
    }
  }

  completed(outcome: ExportRunOutcome): void {
    const { cuts, elementStyles } = this.editorStore.snapshot();
    this.telemetry.capture('export_completed', {
      ...this.optionProperties(outcome.options),
      elapsed_ms: outcome.elapsedMs,
      audio_discarded: outcome.audioDiscardedReason !== null,
      ...this.sourceProperties(),
      ...this.decoderProperties(outcome.decoderSelection),
      video_source: outcome.videoSource,
      sheet_count: outcome.sheets.length,
      total_customized_count: this.totalCustomizedCount(outcome.sheets),
      has_cuts: !cuts.isEmpty(),
      has_element_styles: !elementStyles.isEmpty(),
    });
  }

  cancelled(options: ExportVideoOptions, elapsedMs: number): void {
    this.telemetry.capture('export_cancelled', {
      ...this.optionProperties(options),
      elapsed_ms: elapsedMs,
    });
  }

  /**
   * Answers with the failure as it was reported. Anything thrown that
   * is not already one of ours becomes an `ExportFailedError`, so
   * `error_name` groups the same way whoever ran the export; a caller
   * that also has to store or show the failure should use what comes
   * back rather than wrap it a second time.
   */
  failed(failure: ExportRunFailure): AppError {
    const error = failure.error instanceof AppError
      ? failure.error
      : new ExportFailedError({ cause: failure.error });
    this.telemetry.capture('export_failed', {
      ...this.optionProperties(failure.options),
      elapsed_ms: failure.elapsedMs,
      progress_percent: failure.progressPercent,
      was_hidden: failure.visibility?.wasHidden ?? null,
      visibility_state: failure.visibility?.currentState ?? null,
      ...this.sourceProperties(),
      ...this.decoderProperties(failure.decoderSelection),
      video_source: failure.videoSource,
      ...this.errorTelemetryDescriber.describe(error),
    });
    return error;
  }

  /**
   * The run could not get readable bytes for the source. `reason` is
   * what the resolver said was missing.
   */
  originalVideoUnavailable(reason: string, hasRemoteCopy: boolean): void {
    this.telemetry.capture('original_video_unavailable', {
      reason,
      has_remote_copy: hasRemoteCopy,
      ...this.sourceProperties(),
    });
  }

  originalVideoRecovered(videoSource: VideoBlobSource): void {
    this.telemetry.capture('original_video_recovered', {
      video_source: videoSource,
      ...this.sourceProperties(),
    });
  }

  private optionProperties(options: ExportVideoOptions): TelemetryEventProperties {
    return {
      format: options.format,
      quality: options.quality,
      resolution: this.describeResolution(options.resolution),
    };
  }

  /**
   * Describes the decoder the render ran through. Both fields are
   * `null` when the run ended before a decoder was chosen, which is
   * what tells an early failure apart from a decode-time one.
   */
  private decoderProperties(selection: VideoFrameDecoderSelection | null): TelemetryEventProperties {
    return {
      video_decoder: selection?.kind ?? null,
      video_codec: selection?.inputCodec ?? null,
    };
  }

  private sourceProperties(): TelemetryEventProperties {
    const { video } = this.editorStore.snapshot();
    return {
      source_width: video.layout?.width ?? null,
      source_height: video.layout?.height ?? null,
      source_duration_s: video.duration,
      // Read off the committed identity rather than the file, which a
      // project mid-download does not have and a rotted pick no longer
      // describes.
      source_size_mb: video.size === null ? null : this.megabytes(video.size),
    };
  }

  private megabytes(bytes: number): number {
    return Math.round((bytes / (1024 * 1024)) * 10) / 10;
  }

  private totalCustomizedCount(sheets: readonly Sheet[]): number {
    let count = 0;
    for (const sheet of sheets) count += this.customizationDiff.diff(sheet).length;
    return count;
  }

  private describeResolution(resolution: ExportResolution): string {
    if (resolution === 'original') return 'original';
    return `${resolution.width}x${resolution.height}`;
  }
}
