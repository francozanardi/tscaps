import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ShotLayerRole } from '@core/shots/domain/ShotLayerRole';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';

/** A layer that can be picked to be edited together with others, and what is needed to say what was picked. */
export interface SelectableShotLayer {
  readonly layerId: string;
  readonly role: ShotLayerRole;
  readonly kind: 'video' | 'image' | 'gif';
  /** Its shot's number in the list, from 1. */
  readonly shotNumber: number;
}

/**
 * Lists the layers that can be picked together, in the order the shots
 * panel shows their pills: shot by shot, each shot's b-roll and then
 * its pictures and GIFs, bottom to top. That order is what a range
 * runs along and what decides which layer comes first.
 *
 * A layer whose file is gone has no kind, so nothing could be edited on
 * it together with others: it is not listed.
 */
export class SelectableShotLayerReader {
  constructor(private readonly assets: ShotLayerAssetReader) {}

  read(partition: ShotPartition, catalog: MediaAssetCatalog): SelectableShotLayer[] {
    return partition.list().flatMap((shot, index) => {
      const shotNumber = index + 1;
      const broll = this.assets.videoLayerOf(shot.layers, catalog);
      const pictures = this.assets.pictureLayersOf(shot.layers, catalog);
      return [
        ...(broll === null ? [] : [{ layerId: broll.id, role: 'video' as const, kind: 'video' as const, shotNumber }]),
        ...pictures.map(({ layer, kind }) => ({ layerId: layer.id, role: 'picture' as const, kind, shotNumber })),
      ];
    });
  }
}
