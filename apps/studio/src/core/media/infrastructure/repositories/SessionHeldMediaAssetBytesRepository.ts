import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import type { MediaAssetRendition } from '@core/media/domain/MediaAssetRendition';

const RENDITIONS: readonly MediaAssetRendition[] = ['original', 'proxy'];

/**
 * `MediaAssetBytesRepository` that also holds every copy stored this
 * session, in front of a durable one.
 *
 * What this buys is the bytes the durable layer does not keep: those
 * of an asset held for the session, and those a device with no room
 * left refused. The durable write still rejects in the second case, so
 * whoever asked learns the file will not outlive the page.
 *
 * The durable copy is asked first. A held blob is often the file the
 * reader picked, and on iOS a picked file is a temporary copy the
 * system removes on its own schedule; the durable copy is the one the
 * browser keeps alive.
 */
export class SessionHeldMediaAssetBytesRepository implements MediaAssetBytesRepository {
  private readonly held = new Map<string, Blob>();

  constructor(private readonly durable: MediaAssetBytesRepository) {}

  async load(assetId: string, rendition: MediaAssetRendition): Promise<Blob | null> {
    return (await this.durable.load(assetId, rendition)) ?? this.held.get(this.keyOf(assetId, rendition)) ?? null;
  }

  async store(asset: Pick<MediaAsset, 'id' | 'owner'>, rendition: MediaAssetRendition, blob: Blob): Promise<void> {
    this.held.set(this.keyOf(asset.id, rendition), blob);
    await this.durable.store(asset, rendition, blob);
  }

  async reassign(assetId: string, owner: MediaAssetOwner): Promise<void> {
    if (owner.kind === 'session') await this.holdWhatIsKept(assetId);
    else await this.keepWhatIsHeld(assetId, owner);
    await this.durable.reassign(assetId, owner);
  }

  delete(assetId: string): Promise<void> {
    for (const rendition of RENDITIONS) this.held.delete(this.keyOf(assetId, rendition));
    return this.durable.delete(assetId);
  }

  /** An asset becoming the session's is let go by the durable layer; its bytes stay playable here. */
  private async holdWhatIsKept(assetId: string): Promise<void> {
    for (const rendition of RENDITIONS) {
      const kept = await this.durable.load(assetId, rendition);
      if (kept) this.held.set(this.keyOf(assetId, rendition), kept);
    }
  }

  /**
   * An asset leaving the session was never written durably, so the
   * durable layer has nothing of it to reassign: what is held here is
   * the only copy, and it is written now under its new owner.
   */
  private async keepWhatIsHeld(assetId: string, owner: Exclude<MediaAssetOwner, { kind: 'session' }>): Promise<void> {
    for (const rendition of RENDITIONS) {
      const held = this.held.get(this.keyOf(assetId, rendition));
      if (held) await this.durable.store({ id: assetId, owner }, rendition, held);
    }
  }

  private keyOf(assetId: string, rendition: MediaAssetRendition): string {
    return `${rendition}:${assetId}`;
  }
}
