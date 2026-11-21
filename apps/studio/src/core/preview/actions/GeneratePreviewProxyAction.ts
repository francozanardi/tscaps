import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type {
  PreviewProxyResolution,
  PreviewProxyResolver,
} from '@core/preview/services/PreviewProxyResolver';
import type { PreviewProxyGenerationStore } from '@core/preview/store/PreviewProxyGenerationStore';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/**
 * Generates the preview proxy the generation policy skipped, on the
 * user's explicit request. Runs the encode with progress on the
 * generation store, publishes the result as the playing preview (the
 * surface flips to the canvas variant on its own) along with where the
 * encode saw the picture change, and persists the
 * proxy in the background so later opens start from it.
 *
 * Re-entrant calls while a run is in flight are ignored, and a call
 * with no original bytes at hand (a project whose original is still
 * downloading) is refused into the store's failed state rather than
 * left hanging.
 */
export class GeneratePreviewProxyAction {

  constructor(
    private readonly editorStore: EditorStore,
    private readonly resolver: PreviewProxyResolver,
    private readonly repository: PreviewProxyRepository,
    private readonly generationStore: PreviewProxyGenerationStore,
    private readonly telemetry: Telemetry,
    private readonly errorClassifier: AppErrorClassifier,
    private readonly errorTelemetryDescriber: AppErrorTelemetryDescriber,
  ) {}

  async execute(): Promise<void> {
    if (this.generationStore.phase === 'generating') return;
    const source = this.editorStore.snapshot().video.file;
    if (!source) {
      this.generationStore.fail();
      return;
    }
    this.generationStore.start();
    const startedAt = performance.now();
    try {
      const resolution = await this.resolver.fromSourceIgnoringPolicy(
        source,
        (progress) => this.generationStore.setProgress(progress),
      );
      this.publish(resolution);
      this.generationStore.finish();
      this.telemetry.capture('preview_proxy_generated', {
        elapsed_ms: Math.round(performance.now() - startedAt),
        source_duration_s: this.editorStore.snapshot().video.duration,
      });
    } catch (err) {
      console.error('[preview-proxy] on-demand generation failed', err);
      this.generationStore.fail();
      this.telemetry.capture('preview_proxy_generation_failed', {
        elapsed_ms: Math.round(performance.now() - startedAt),
        ...this.errorTelemetryDescriber.describe(this.errorClassifier.wrap(err)),
      });
    }
  }

  private publish(resolution: PreviewProxyResolution): void {
    this.editorStore.patchVideo({
      preview: resolution.preview,
      ...(resolution.freshProxy ? { pictureChangesSec: resolution.freshProxy.pictureChangesSec } : {}),
    });
    if (resolution.freshProxy) this.persistInBackground(resolution.freshProxy);
  }

  private persistInBackground(proxy: PreviewProxy): void {
    const projectId = this.editorStore.snapshot().projectId;
    if (projectId === null) return;
    void this.repository.store(projectId, proxy).catch((error) => {
      console.error('[preview-proxy] on-demand proxy store failed', error);
    });
  }
}
