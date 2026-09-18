import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { VideoBlobMissReason, VideoBlobSource } from '@core/videos/domain/VideoBlobLookup';

/**
 * Emits the `project_open_*` events and owns the shape of their
 * properties, so the four ways an open can end stay comparable
 * against each other.
 *
 * Every outcome reports, including the three that leave the reader
 * with a dialog instead of an editor. Those are dead ends: the only
 * move they offer is going back to the dashboard, so a session that
 * keeps hitting one produces a stream of navigation and nothing else,
 * and is indistinguishable from a reader browsing their projects.
 *
 * Nothing here carries user content: a template that cannot be
 * rendered is counted, never named, because a custom template's id is
 * a string its author wrote.
 *
 * `video_source` says which copy of the original answered — memory,
 * this device, or the server — and is `null` when none had by the
 * time the outcome was decided. On a failure it names the copy whose
 * bytes were being read. When no copy answered, `reason` on the
 * recovery event says whether nothing was here or the browser took
 * away what was, which is the difference between a cache doing its
 * job and a platform dropping data underneath it.
 */
export class ProjectOpenTelemetryReporter {
  constructor(
    private readonly store: EditorStore,
    private readonly telemetry: Telemetry,
    private readonly errorClassifier: AppErrorClassifier,
    private readonly errorDescriber: AppErrorTelemetryDescriber,
  ) {}

  reportOpened(
    substitutedTemplateCount: number,
    videoSource: VideoBlobSource | null,
    elapsedMs: number,
  ): void {
    this.telemetry.capture('project_opened', {
      substituted_templates: substitutedTemplateCount,
      video_source: videoSource,
      elapsed_ms: elapsedMs,
      ...this.previewProperties(),
    });
  }

  reportVideoRecoveryOffered(reason: VideoBlobMissReason, elapsedMs: number): void {
    this.telemetry.capture('project_video_recovery_offered', { reason, elapsed_ms: elapsedMs });
  }

  reportBlockedByTemplates(unsupportedTemplateCount: number, elapsedMs: number): void {
    this.telemetry.capture('project_open_blocked', {
      unsupported_templates: unsupportedTemplateCount,
      elapsed_ms: elapsedMs,
    });
  }

  reportFailed(cause: unknown, videoSource: VideoBlobSource | null, elapsedMs: number): void {
    this.telemetry.capture('project_open_failed', {
      video_source: videoSource,
      elapsed_ms: elapsedMs,
      ...this.errorDescriber.describe(this.errorClassifier.wrap(cause)),
    });
  }

  /**
   * What the preview surface ended up loading separates an open that
   * only had to publish a small stored proxy from one that had to
   * hold the whole original in memory, which is the difference
   * between a cheap open and an expensive one on a weak device.
   */
  private previewProperties(): TelemetryEventProperties {
    const { preview } = this.store.snapshot().video;
    if (!preview) return { preview_kind: null };
    if (preview.kind === 'proxy') return { preview_kind: 'proxy' };
    return { preview_kind: 'original', preview_original_reason: preview.reason };
  }
}
