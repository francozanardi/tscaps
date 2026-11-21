import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { ProjectDependentStore } from '@core/_shared/infrastructure/ProjectDependentStore';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { UnsentMediaAssets } from '@core/media/domain/UnsentMediaAssets';
import type { MediaAssetOwner } from '@core/media/domain/MediaAssetOwner';
import type { MediaAssetRepository } from '@core/media/domain/MediaAssetRepository';
import { LOCAL_MEDIA_ASSET_REALM, type MediaAssetRealm } from '@core/media/domain/MediaAssetRealm';
import { MEDIA_ASSET_TYPES, type MediaAssetType } from '@core/media/domain/MediaAssetType';

export const MEDIA_ASSETS_STORE = 'media-assets';

interface MediaAssetRecord {
  readonly id: string;
  /** Who on this device it belongs to; a record from before realms has none and reads as the local one. */
  readonly realm?: string;
  readonly type: MediaAssetType;
  /** The project that owns it, or null for the library. */
  readonly projectId: string | null;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** Null for an audio file; a record from before audio always has both. */
  readonly widthPx: number | null;
  readonly heightPx: number | null;
  readonly durationSec: number | null;
}

/**
 * `MediaAssetRepository` over one shared IndexedDB store, one
 * record per asset: the whole list where the device is where the list
 * lives. Each record is stamped with the realm current when it was
 * written, and only the current realm's records are listed or moved.
 *
 * A project's assets are a dependent of its video on this device: they
 * go when the video is evicted or the project deleted. The library's
 * are not, and go only when deleted. Nor is an asset not sent yet where
 * its list lives — any record outside the local realm — whose copy here
 * is the only one: evicting the video spares it, and only deleting the
 * project takes it. An asset held for the session is never written.
 *
 * Records are read as far as they can be trusted: one that names no
 * file or a type this build does not know is skipped, and one written
 * before records named a realm is the local surface's: the realm whose
 * records are never sent anywhere, so an old record of unknown origin
 * can at worst stay on this device rather than go to someone's copy.
 */
export class IndexedDbMediaAssetRepository implements MediaAssetRepository, UnsentMediaAssets, ProjectDependentStore {
  constructor(
    private readonly db: IndexedDbClient,
    private readonly realm: MediaAssetRealm,
  ) {}

  async list(projectId: string | null): Promise<readonly MediaAsset[]> {
    const records = await this.db.readAll<unknown>(MEDIA_ASSETS_STORE);
    return records
      .filter((record) => this.realm.includes(this.realmOf(record)))
      .map((record) => this.toAsset(record))
      .filter((asset): asset is MediaAsset => asset !== null
        && (asset.owner.kind === 'library' || (asset.owner.kind === 'project' && asset.owner.projectId === projectId)));
  }

  async add(asset: MediaAsset): Promise<void> {
    await this.write(asset, asset.owner, this.realm.current());
  }

  /** Keeps the record's own realm: a move changes the owner, never whose record it is. */
  async move(asset: MediaAsset, owner: MediaAssetOwner): Promise<void> {
    const held = await this.db.readOne<unknown>(MEDIA_ASSETS_STORE, asset.id);
    await this.write(asset, owner, held === null ? this.realm.current() : this.realmOf(held));
  }

  async delete(assetId: string): Promise<void> {
    await this.db.deleteOne(MEDIA_ASSETS_STORE, assetId);
  }

  deleteProject(projectId: string): Promise<void> {
    return this.deleteWhere((record) => record.projectId === projectId);
  }

  evictProject(projectId: string): Promise<void> {
    return this.deleteWhere((record) => record.projectId === projectId && !this.isUnsent(record));
  }

  retainOnly(projectIds: ReadonlySet<string>): Promise<void> {
    return this.deleteWhere((record) => record.projectId !== null
      && !projectIds.has(record.projectId)
      && !this.isUnsent(record));
  }

  async unsentIds(): Promise<ReadonlySet<string>> {
    const records = await this.db.readAll<MediaAssetRecord>(MEDIA_ASSETS_STORE);
    return new Set(records.filter((record) => this.isUnsent(record)).map((record) => record.id));
  }

  /** A record outside the local realm is kept only until the copy where its list lives is confirmed. */
  private isUnsent(record: MediaAssetRecord): boolean {
    return this.realmOf(record) !== LOCAL_MEDIA_ASSET_REALM;
  }

  private async write(asset: MediaAsset, owner: MediaAssetOwner, realm: string): Promise<void> {
    if (owner.kind === 'session') {
      await this.delete(asset.id);
      return;
    }
    const record: MediaAssetRecord = {
      id: asset.id,
      realm,
      type: asset.type,
      projectId: owner.kind === 'project' ? owner.projectId : null,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      widthPx: asset.widthPx,
      heightPx: asset.heightPx,
      durationSec: asset.durationSec,
    };
    await this.db.writeOne(MEDIA_ASSETS_STORE, record);
  }

  private async deleteWhere(drops: (record: MediaAssetRecord) => boolean): Promise<void> {
    const records = await this.db.readAll<MediaAssetRecord>(MEDIA_ASSETS_STORE);
    for (const record of records) {
      if (drops(record)) await this.db.deleteOne(MEDIA_ASSETS_STORE, record.id);
    }
  }

  private realmOf(value: unknown): string {
    const realm = typeof value === 'object' && value !== null ? (value as Partial<MediaAssetRecord>).realm : undefined;
    return typeof realm === 'string' && realm !== '' ? realm : LOCAL_MEDIA_ASSET_REALM;
  }

  private toAsset(value: unknown): MediaAsset | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Partial<MediaAssetRecord>;
    if (typeof record.id !== 'string' || record.id === '') return null;
    if (!MEDIA_ASSET_TYPES.includes(record.type as MediaAssetType)) return null;
    return {
      id: record.id,
      type: record.type as MediaAssetType,
      owner: typeof record.projectId === 'string' ? { kind: 'project', projectId: record.projectId } : { kind: 'library' },
      fileName: typeof record.fileName === 'string' ? record.fileName : '',
      mimeType: typeof record.mimeType === 'string' ? record.mimeType : '',
      sizeBytes: this.positiveOr(record.sizeBytes, 0),
      widthPx: this.positiveOr(record.widthPx, null),
      heightPx: this.positiveOr(record.heightPx, null),
      durationSec: this.positiveOr(record.durationSec, null),
    };
  }

  private positiveOr<T extends number | null>(value: unknown, fallback: T): number | T {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
