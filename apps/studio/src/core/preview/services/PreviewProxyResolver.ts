import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type {
  PreviewProxyGenerator,
  PreviewProxyProgressCallback,
} from '@core/preview/domain/PreviewProxyGenerator';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';

/**
 * Outcome of a source-based proxy resolution.
 *
 * - `previewBlob` is what the preview surface must load: the freshly
 *   generated proxy, or the source itself when the pipeline is
 *   disabled.
 * - `freshProxy` is the proxy that was just generated from `source`
 *   and still needs to be persisted, or `null` when nothing new was
 *   produced (disabled pipeline).
 */
export interface PreviewProxyResolution {
  readonly previewBlob: Blob;
  readonly freshProxy: PreviewProxy | null;
}

/**
 * Reads or generates a preview proxy. Does not touch the editor
 * store; publishing the resolved blob and persisting the fresh proxy
 * are both caller concerns.
 */
export class PreviewProxyResolver {
  constructor(
    private readonly repository: PreviewProxyRepository,
    private readonly generator: PreviewProxyGenerator,
    private readonly enabled: boolean,
  ) {}

  /**
   * Reads the proxy for `projectId` from the repository. Resolves to
   * `null` when the pipeline is disabled or the repository has no
   * proxy for the project.
   */
  async fromRepository(projectId: string): Promise<PreviewProxy | null> {
    if (!this.enabled) return null;
    return this.repository.load(projectId);
  }

  /**
   * Generates a fresh proxy from `source`. When the pipeline is
   * disabled, resolves to the `source` bytes verbatim as
   * `previewBlob` and a `null` `freshProxy`.
   */
  async fromSource(
    source: Blob,
    onProgress?: PreviewProxyProgressCallback,
  ): Promise<PreviewProxyResolution> {
    if (!this.enabled) return { previewBlob: source, freshProxy: null };
    const proxy = await this.generator.generate(source, onProgress);
    return { previewBlob: proxy.blob, freshProxy: proxy };
  }
}
