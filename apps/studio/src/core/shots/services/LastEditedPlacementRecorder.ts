import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShotLayerRole } from '@core/shots/domain/ShotLayerRole';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';

/**
 * Remembers, per role, the layout a layer whose layout was just edited
 * was left with, so the next layer of that role starts there.
 * A remembered value, not a link: no layer moves when it changes. Where
 * a file is cropped is that file's, and is not remembered.
 */
export class LastEditedPlacementRecorder {
  constructor(
    private readonly media: MediaAssetStore,
    private readonly assets: ShotLayerAssetReader,
  ) {}

  /**
   * `partition` remembering, for each role among `editedLayerIds`, the
   * layout of the first of them with that role, as its fields in
   * `partition` hold it. A layer that is gone, a graphic, whose box its
   * own preset decides, or a layer whose file is of no known type, says
   * nothing.
   */
  record(partition: ShotPartition, editedLayerIds: ReadonlyArray<string>): ShotPartition {
    const catalog = this.media.snapshot();
    const recordedRoles = new Set<ShotLayerRole>();
    let recorded = partition;
    for (const layerId of editedLayerIds) {
      const layer = partition.findLayer(layerId);
      const file = layer === null ? null : this.assets.fileOf(layer);
      const role = file === null ? null : this.assets.roleOf(file.mediaId, catalog);
      if (layer === null || role === null || recordedRoles.has(role)) continue;
      recordedRoles.add(role);
      recorded = recorded.withLastEditedPlacement(role, this.withoutCrop(partition.placementOf(layerId)));
    }
    return recorded;
  }

  /** `placement` without where its file is cropped, which is about that file and no other. */
  private withoutCrop(placement: ShotLayerPlacement): ShotLayerPlacement {
    if (placement.position === undefined) return placement;
    const { position: _cropped, ...rest } = placement;
    return rest;
  }
}
