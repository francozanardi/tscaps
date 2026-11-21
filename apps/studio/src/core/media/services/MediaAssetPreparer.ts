import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { AudioPlaybackProbe } from '@core/media/domain/AudioPlaybackProbe';
import type { GifPlaybackProbe } from '@core/media/domain/GifPlaybackProbe';
import type { MediaAssetPreparationStatus } from '@core/media/domain/MediaAssetPreparationStatus';
import type { MediaAssetUploader } from '@core/media/domain/MediaAssetUploader';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyGenerator } from '@core/preview/domain/PreviewProxyGenerator';

const READY: MediaAssetPreparationStatus = { phase: 'ready', progress: null, error: null };
const MISSING: MediaAssetPreparationStatus = { phase: 'missing', progress: null, error: null };

interface PreparationJob {
  readonly controller: AbortController;
  readonly done: Promise<void>;
}

/**
 * Makes each asset usable in the editor, which previews it through a
 * rendition of its own, and says when it is.
 *
 * What an asset is previewed through depends on its type:
 *
 * - a video, through its proxy — found where one is kept, or made from
 *   the file itself, one video at a time, in the background. A proxy
 *   made here is kept with the asset and queued to go up with it;
 * - a picture, through its original: nothing is made, and it is ready
 *   as soon as its bytes can be had;
 * - a GIF, through its original too, once this browser is found able to
 *   play it; one it cannot play is `unplayable` rather than ready, so
 *   nothing previews, exports or adds a still of it;
 * - an audio file, through its original too, once the start of its
 *   sound is found to decode here; one that will not is `unplayable`.
 *
 * Whether an asset is ready is never stored — it is whether that
 * rendition can be had — so an asset whose proxy was never finished, on
 * this device or any other, is simply prepared again.
 *
 * Every asset has a status a panel can subscribe to. A failure waits
 * for {@link prepare} to be asked again.
 */
export class MediaAssetPreparer {
  private readonly statuses = new Map<string, MediaAssetPreparationStatus>();
  private readonly jobs = new Map<string, PreparationJob>();
  /** Originals being looked up (and GIFs and audio files checked), so asking again while one is waits for it. */
  private readonly lookups = new Map<string, Promise<void>>();
  private readonly listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly bytes: MediaAssetBytesRepository,
    private readonly generator: PreviewProxyGenerator,
    private readonly uploader: MediaAssetUploader,
    private readonly gifs: GifPlaybackProbe,
    private readonly audio: AudioPlaybackProbe,
  ) {}

  /**
   * Makes `asset` ready from the file itself, unless it is ready, found
   * unplayable, or being made already. Resolves once it is settled,
   * whichever way.
   */
  prepare(asset: MediaAsset): Promise<void> {
    const running = this.jobs.get(asset.id);
    if (running) return running.done;
    if (this.isSettledForGood(asset.id)) return Promise.resolve();
    if (asset.type !== 'video') return this.findOriginal(asset);
    const controller = new AbortController();
    this.setStatus(asset.id, { phase: 'preparing', progress: 0, error: null });
    const done = this.queue.then(() => this.makeProxy(asset, controller.signal));
    this.queue = done;
    this.jobs.set(asset.id, { controller, done });
    return done;
  }

  /**
   * Brings every one of `assets` to ready: what it is previewed through
   * is found where it is kept, or made again. Resolves once the assets
   * in `awaited` are settled; the rest go on in the background, behind
   * them.
   */
  async ensurePrepared(assets: readonly MediaAsset[], awaited: ReadonlySet<string>): Promise<void> {
    const ordered = [...assets].sort((a, b) => Number(awaited.has(b.id)) - Number(awaited.has(a.id)));
    const settled = ordered.map((asset) => ({ asset, done: this.ensureOne(asset) }));
    await Promise.all(settled.filter(({ asset }) => awaited.has(asset.id)).map(({ done }) => done));
  }

  /** Stops preparing `assetId` and forgets it. Resolves once nothing of it is still being written. */
  async cancel(assetId: string): Promise<void> {
    const job = this.jobs.get(assetId);
    this.jobs.delete(assetId);
    this.statuses.delete(assetId);
    this.notify();
    if (!job) return;
    job.controller.abort();
    await job.done;
  }

  /** Where `assetId` stands, or null for an asset never seen. The same object until it changes. */
  statusOf(assetId: string): MediaAssetPreparationStatus | null {
    return this.statuses.get(assetId) ?? null;
  }

  /** Calls `listener` on every change of any asset's status. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async ensureOne(asset: MediaAsset): Promise<void> {
    const running = this.jobs.get(asset.id);
    if (running) return running.done;
    if (this.isSettledForGood(asset.id)) return;
    if (asset.type !== 'video') return this.findOriginal(asset);
    let proxy: Blob | null;
    try {
      proxy = await this.bytes.load(asset.id, 'proxy');
    } catch (error) {
      console.error(`[media] the proxy of asset ${asset.id} could not be looked up`, error);
      this.setStatus(asset.id, { phase: 'failed', progress: null, error });
      return;
    }
    if (proxy) this.markProxyReady(asset);
    else await this.prepare(asset);
  }

  /** Whether `assetId` is ready, or can never be here: asking again would change nothing. */
  private isSettledForGood(assetId: string): boolean {
    const phase = this.statuses.get(assetId)?.phase;
    return phase === 'ready' || phase === 'unplayable';
  }

  private findOriginal(asset: MediaAsset): Promise<void> {
    const running = this.lookups.get(asset.id);
    if (running) return running;
    const lookup = this.lookUpOriginal(asset).finally(() => this.lookups.delete(asset.id));
    this.lookups.set(asset.id, lookup);
    return lookup;
  }

  private async lookUpOriginal(asset: MediaAsset): Promise<void> {
    let original: Blob | null;
    try {
      original = await this.bytes.load(asset.id, 'original');
    } catch (error) {
      console.error(`[media] asset ${asset.id} could not be looked up`, error);
      this.setStatus(asset.id, { phase: 'failed', progress: null, error });
      return;
    }
    if (!original) this.setStatus(asset.id, MISSING);
    else if (asset.type === 'gif') await this.checkPlayable(asset, () => this.gifs.ensurePlayable(original));
    else if (asset.type === 'audio') await this.checkPlayable(asset, () => this.audio.ensurePlayable(original));
    else this.setStatus(asset.id, READY);
  }

  private async checkPlayable(asset: MediaAsset, ensurePlayable: () => Promise<void>): Promise<void> {
    try {
      await ensurePlayable();
      this.setStatus(asset.id, READY);
    } catch (error) {
      console.warn(`[media] the ${asset.type} ${asset.id} cannot play in this browser`, error);
      this.setStatus(asset.id, { phase: 'unplayable', progress: null, error });
    }
  }

  private async makeProxy(asset: MediaAsset, signal: AbortSignal): Promise<void> {
    try {
      if (signal.aborted) return;
      const original = await this.bytes.load(asset.id, 'original');
      if (signal.aborted) return;
      if (!original) {
        this.setStatus(asset.id, MISSING);
        return;
      }
      const proxy = await this.generator.generate(original, (progress) => this.reportProgress(asset.id, signal, progress), signal);
      await this.bytes.store(asset, 'proxy', this.typed(proxy));
      if (!signal.aborted) this.markProxyReady(asset);
    } catch (error) {
      if (signal.aborted) return;
      console.error(`[media] the proxy of asset ${asset.id} could not be made`, error);
      this.setStatus(asset.id, { phase: 'failed', progress: null, error });
    } finally {
      if (this.jobs.get(asset.id)?.controller.signal === signal) this.jobs.delete(asset.id);
    }
  }

  private markProxyReady(asset: MediaAsset): void {
    this.setStatus(asset.id, READY);
    this.uploader.enqueue(asset, 'proxy');
  }

  private reportProgress(assetId: string, signal: AbortSignal, progress: number): void {
    if (!signal.aborted) this.setStatus(assetId, { phase: 'preparing', progress, error: null });
  }

  /** The proxy's bytes as they are kept and sent, which is with the type they are. */
  private typed(proxy: PreviewProxy): Blob {
    return proxy.blob.type ? proxy.blob : new Blob([proxy.blob], { type: proxy.mimeType });
  }

  private setStatus(assetId: string, status: MediaAssetPreparationStatus): void {
    this.statuses.set(assetId, status);
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
