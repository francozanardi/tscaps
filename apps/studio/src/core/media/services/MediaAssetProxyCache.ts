import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { MediaAssetRendition } from '@core/media/domain/MediaAssetRendition';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';

/**
 * Holds in memory what the open project's assets are previewed
 * through — a video's proxy, a picture's original — each read once, so
 * an asset answers with the same bytes, the same object, every time it
 * is asked for. Asking about another project drops what was held.
 */
export class MediaAssetProxyCache {
  private projectId: string | null = null;
  private readonly proxies = new Map<string, Blob | null>();
  private readonly reading = new Map<string, symbol>();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly bytes: MediaAssetBytesRepository,
    private readonly assets: MediaAssetStore,
  ) {}

  /**
   * What `assetId` is previewed through, or null while it is being read
   * and when it cannot be had. The first ask starts the read;
   * subscribers hear when it lands.
   */
  proxyOf(projectId: string | null, assetId: string): Blob | null {
    if (projectId !== this.projectId) this.switchTo(projectId);
    if (this.proxies.has(assetId)) return this.proxies.get(assetId) ?? null;
    if (!this.reading.has(assetId)) void this.read(assetId);
    return null;
  }

  /** Drops what is held of `assetId`, so the next ask reads it again. */
  forget(assetId: string): void {
    this.proxies.delete(assetId);
    this.reading.delete(assetId);
  }

  /** Calls `listener` whenever a read lands. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private switchTo(projectId: string | null): void {
    this.projectId = projectId;
    this.proxies.clear();
    this.reading.clear();
  }

  private async read(assetId: string): Promise<void> {
    const token = Symbol(assetId);
    this.reading.set(assetId, token);
    let proxy: Blob | null;
    try {
      proxy = await this.bytes.load(assetId, this.previewedThrough(assetId));
    } catch (error) {
      console.error(`[media] what asset ${assetId} is previewed through could not be read`, error);
      proxy = null;
    }
    if (this.reading.get(assetId) !== token) return;
    this.reading.delete(assetId);
    this.proxies.set(assetId, proxy);
    for (const listener of this.listeners) listener();
  }

  private previewedThrough(assetId: string): MediaAssetRendition {
    const type = this.assets.snapshot().get(assetId)?.type;
    return type === undefined || type === 'video' ? 'proxy' : 'original';
  }
}
