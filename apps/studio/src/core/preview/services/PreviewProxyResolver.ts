import type { BlobDownloadProgressCallback } from '@core/_shared/domain/BlobDownloader';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type {
  PreviewProxyGenerator,
  PreviewProxyProgressCallback,
} from '@core/preview/domain/PreviewProxyGenerator';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type { OriginalPreviewReason, VideoPreview } from '@core/preview/domain/VideoPreview';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { PreviewProxyGenerationPolicy } from '@core/preview/services/PreviewProxyGenerationPolicy';
import type { PreviewProxyGenerationBudget } from '@core/preview/services/PreviewProxyGenerationBudget';
import { PreviewProxyGenerationWatchdog } from '@core/preview/services/PreviewProxyGenerationWatchdog';

/**
 * Outcome of a source-based proxy resolution.
 *
 * - `preview` is what the preview surface must load.
 * - `freshProxy` is the proxy that was just generated from `source`
 *   and still needs to be persisted, or `null` when nothing new was
 *   produced.
 */
export interface PreviewProxyResolution {
  readonly preview: VideoPreview;
  readonly freshProxy: PreviewProxy | null;
}

/**
 * Reads or generates a preview proxy. Does not touch the editor
 * store; publishing the resolved blob and persisting the fresh proxy
 * are both caller concerns.
 *
 * The proxy is an optimization, never a requirement: it makes
 * playback cheap, and the source plays without it. So generation
 * failures resolve to the source bytes rather than propagating.
 * Losing a smooth preview is a far smaller harm than discarding
 * everything the pipeline produced up to that point, which is what
 * a thrown error costs the person waiting on it.
 *
 * Generation is gated twice: a policy decides whether to start, and a
 * budget bounds how long the run may take before it is abandoned.
 *
 * Assigns every `OriginalPreviewReason` an attempt can produce. The
 * one it does not is `none-stored`, where nothing was attempted.
 */
export class PreviewProxyResolver {
  constructor(
    private readonly repository: PreviewProxyRepository,
    private readonly generator: PreviewProxyGenerator,
    private readonly metadataProbe: VideoMetadataProbe,
    private readonly generationPolicy: PreviewProxyGenerationPolicy,
    private readonly budget: PreviewProxyGenerationBudget,
    private readonly fallbackReporter: NonBlockingFailureReporter,
    private readonly enabled: boolean,
  ) {}

  /**
   * Reads the proxy for `projectId` from the repository. Resolves to
   * `null` when the pipeline is disabled or the repository has no
   * proxy for the project. A stored proxy is always worth using —
   * the generation policy only gates producing new ones.
   *
   * `onProgress` only fires when the repository has to pull the proxy
   * over the network.
   */
  async fromRepository(
    projectId: string,
    onProgress?: BlobDownloadProgressCallback,
  ): Promise<PreviewProxy | null> {
    if (!this.enabled) return null;
    return this.repository.load(projectId, onProgress);
  }

  /**
   * Generates a fresh proxy from `source`. Resolves to the `source`
   * bytes and a `null` `freshProxy` when the pipeline is disabled,
   * when the policy refuses to start, when the run outruns its budget,
   * and when generation fails — the failure is reported, not raised,
   * so callers get a playable blob in every case. Which of the four
   * applies is on the resolved preview's `reason`.
   */
  async fromSource(
    source: Blob,
    onProgress?: PreviewProxyProgressCallback,
  ): Promise<PreviewProxyResolution> {
    if (!this.enabled) return this.playingOriginal(source, 'pipeline-disabled');
    const metadata = await this.metadataProbe.probe(source);
    if (!this.generationPolicy.shouldGenerate(metadata)) {
      return this.playingOriginal(source, 'policy-skipped');
    }
    return this.generateUnderBudget(source, metadata.durationSeconds, onProgress);
  }

  /**
   * Generates a fresh proxy from `source` regardless of what the
   * policy says — the path behind an explicit "generate it anyway"
   * request. Unlike {@link fromSource}, a generation failure is
   * thrown: the caller asked for this specific outcome and needs to
   * know it did not happen. Still a no-op passthrough when the
   * pipeline is disabled.
   */
  async fromSourceIgnoringPolicy(
    source: Blob,
    onProgress?: PreviewProxyProgressCallback,
  ): Promise<PreviewProxyResolution> {
    if (!this.enabled) return this.playingOriginal(source, 'pipeline-disabled');
    const proxy = await this.generator.generate(source, onProgress);
    return this.playingProxy(proxy);
  }

  /**
   * Generates under a time budget the source's duration earns.
   * Aborting is not reported as a failure: the original stays playable
   * and generation stays available on demand.
   */
  private async generateUnderBudget(
    source: Blob,
    durationSeconds: number | null,
    onProgress?: PreviewProxyProgressCallback,
  ): Promise<PreviewProxyResolution> {
    const watchdog = new PreviewProxyGenerationWatchdog(this.budget.forDuration(durationSeconds));
    try {
      const proxy = await this.generator.generate(source, this.watching(watchdog, onProgress), watchdog.signal);
      return this.playingProxy(proxy);
    } catch (cause) {
      if (this.isAbort(cause)) return this.playingOriginal(source, 'generation-abandoned');
      console.error('[preview-proxy] generation failed, continuing on the source', cause);
      this.fallbackReporter.report(cause, { source_size_mb: this.sizeInMb(source) });
      return this.playingOriginal(source, 'generation-failed');
    } finally {
      watchdog.dispose();
    }
  }

  /** The caller's progress callback, with the watchdog reading over its shoulder. */
  private watching(
    watchdog: PreviewProxyGenerationWatchdog,
    onProgress: PreviewProxyProgressCallback | undefined,
  ): PreviewProxyProgressCallback {
    return (progress) => {
      watchdog.observe(progress);
      onProgress?.(progress);
    };
  }

  private isAbort(cause: unknown): boolean {
    return cause instanceof Error && cause.name === 'AbortError';
  }

  private playingProxy(proxy: PreviewProxy): PreviewProxyResolution {
    return { preview: { kind: 'proxy', file: proxy.blob }, freshProxy: proxy };
  }

  private playingOriginal(source: Blob, reason: OriginalPreviewReason): PreviewProxyResolution {
    return { preview: { kind: 'original', file: source, reason }, freshProxy: null };
  }

  private sizeInMb(source: Blob): number {
    return Math.round((source.size / (1024 * 1024)) * 10) / 10;
  }
}
