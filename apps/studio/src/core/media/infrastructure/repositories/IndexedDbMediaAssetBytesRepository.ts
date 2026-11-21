import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { ProjectDependentStore } from '@core/_shared/infrastructure/ProjectDependentStore';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import type { MediaAssetRendition } from '@core/media/domain/MediaAssetRendition';
import type { UnsentMediaAssets } from '@core/media/domain/UnsentMediaAssets';

export const MEDIA_ASSET_BYTES_STORE = 'media-asset-bytes';

const RENDITIONS: readonly MediaAssetRendition[] = ['original', 'proxy'];

interface MediaAssetBytesRecord {
  /** `<rendition>:<asset id>`, so each copy of an asset is a record of its own. */
  readonly key: string;
  readonly assetId: string;
  readonly rendition: MediaAssetRendition;
  /** The project that owns the asset, or null for the library. */
  readonly projectId: string | null;
  readonly blob: Blob;
}

/**
 * `MediaAssetBytesRepository` over one shared IndexedDB store, one
 * record per copy of an asset.
 *
 * It keeps no eviction order of its own. A project's assets live as
 * long as its video on this device, which drops them as a dependent; a
 * library asset's bytes stay until the asset is deleted, and so do the
 * bytes of an asset not sent yet (`UnsentMediaAssets`), which are its
 * only copy. Bytes that go are found again the way the video is —
 * picked again, or fetched again from where they came from.
 *
 * Bytes of an asset held for the session are not this store's to keep:
 * `store` leaves them to whatever holds the session.
 */
export class IndexedDbMediaAssetBytesRepository implements MediaAssetBytesRepository, ProjectDependentStore {
  constructor(
    private readonly db: IndexedDbClient,
    private readonly probe: BlobReadabilityProbe,
    private readonly unsent: UnsentMediaAssets,
  ) {}

  async load(assetId: string, rendition: MediaAssetRendition): Promise<Blob | null> {
    const record = await this.db.readOne<MediaAssetBytesRecord>(MEDIA_ASSET_BYTES_STORE, this.keyOf(assetId, rendition));
    if (!record) return null;
    return await this.probe.probe(record.blob) === 'readable' ? record.blob : null;
  }

  async store(asset: Pick<MediaAsset, 'id' | 'owner'>, rendition: MediaAssetRendition, blob: Blob): Promise<void> {
    if (asset.owner.kind === 'session') return;
    await this.write(asset.id, rendition, asset.owner, blob);
  }

  async reassign(assetId: string, owner: MediaAssetOwner): Promise<void> {
    for (const rendition of RENDITIONS) {
      const record = await this.db.readOne<MediaAssetBytesRecord>(MEDIA_ASSET_BYTES_STORE, this.keyOf(assetId, rendition));
      if (!record) continue;
      if (owner.kind === 'session') await this.db.deleteOne(MEDIA_ASSET_BYTES_STORE, record.key);
      else await this.write(assetId, rendition, owner, record.blob);
    }
  }

  async delete(assetId: string): Promise<void> {
    for (const rendition of RENDITIONS) await this.db.deleteOne(MEDIA_ASSET_BYTES_STORE, this.keyOf(assetId, rendition));
  }

  deleteProject(projectId: string): Promise<void> {
    return this.deleteWhere((record) => record.projectId === projectId);
  }

  async evictProject(projectId: string): Promise<void> {
    const unsent = await this.unsent.unsentIds();
    await this.deleteWhere((record) => record.projectId === projectId && !unsent.has(record.assetId));
  }

  async retainOnly(projectIds: ReadonlySet<string>): Promise<void> {
    const unsent = await this.unsent.unsentIds();
    await this.deleteWhere((record) => record.projectId !== null
      && !projectIds.has(record.projectId)
      && !unsent.has(record.assetId));
  }

  private async write(
    assetId: string,
    rendition: MediaAssetRendition,
    owner: Exclude<MediaAssetOwner, { kind: 'session' }>,
    blob: Blob,
  ): Promise<void> {
    const record: MediaAssetBytesRecord = {
      key: this.keyOf(assetId, rendition),
      assetId,
      rendition,
      projectId: owner.kind === 'project' ? owner.projectId : null,
      blob,
    };
    await this.db.writeOne(MEDIA_ASSET_BYTES_STORE, record);
  }

  private async deleteWhere(drops: (record: MediaAssetBytesRecord) => boolean): Promise<void> {
    const records = await this.db.readAll<MediaAssetBytesRecord>(MEDIA_ASSET_BYTES_STORE);
    for (const record of records) {
      if (drops(record)) await this.db.deleteOne(MEDIA_ASSET_BYTES_STORE, record.key);
    }
  }

  private keyOf(assetId: string, rendition: MediaAssetRendition): string {
    return `${rendition}:${assetId}`;
  }
}
