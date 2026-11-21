import { MEDIA_ASSET_TYPES, type MediaAssetType } from '@core/media/domain/MediaAssetType';

/** The part of a drag's data this reads and writes: the browser's `DataTransfer`, or a stand-in. */
export interface MediaAssetDragData {
  readonly types: readonly string[];
  setData(format: string, data: string): void;
  getData(format: string): string;
}

const FORMAT_PREFIX = 'application/x-tscaps-media-';

/**
 * How a media file travels in a drag inside the editor: its id, under a
 * format that names its type.
 *
 * The type is in the format rather than in the data because a page
 * may read only the formats of a drag while it is under way, never
 * its data. A drop target that takes only some types — a shot takes no
 * sound — can then refuse the others before they are dropped, rather
 * than after.
 */
export class MediaAssetDragFormat {
  write(data: MediaAssetDragData, assetId: string, type: MediaAssetType): void {
    data.setData(this.formatOf(type), assetId);
  }

  /** Whether the drag carries a media file of one of `accepted`; of any type when `accepted` is omitted. */
  carries(formats: readonly string[], accepted: readonly MediaAssetType[] = MEDIA_ASSET_TYPES): boolean {
    return accepted.some((type) => formats.includes(this.formatOf(type)));
  }

  /**
   * The id of the file of one of `accepted` the drag carries, once
   * dropped; of a file of any type when `accepted` is omitted. Null when
   * it carries none.
   */
  read(data: MediaAssetDragData, accepted: readonly MediaAssetType[] = MEDIA_ASSET_TYPES): string | null {
    for (const candidate of accepted) {
      if (!data.types.includes(this.formatOf(candidate))) continue;
      const assetId = data.getData(this.formatOf(candidate));
      if (assetId !== '') return assetId;
    }
    return null;
  }

  private formatOf(type: MediaAssetType): string {
    return `${FORMAT_PREFIX}${type}`;
  }
}
