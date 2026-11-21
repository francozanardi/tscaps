import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import type { ShotLayerLayoutChangeReader } from '@core/shots/services/ShotLayerLayoutChangeReader';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayerPatch, ShotLayerPlacementPatch } from '@core/shots/domain/ShotLayerPatch';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotLayoutFollower } from '@core/shots/domain/ShotLayoutFollower';
import type { LastEditedPlacementRecorder } from '@core/shots/services/LastEditedPlacementRecorder';
import type { ShotLayerLayoutWriter } from '@core/shots/services/ShotLayerLayoutWriter';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import type { ShotLayerPatcher } from '@core/shots/services/ShotLayerPatcher';

/**
 * Writes one patch into several layers at once, wherever their shots
 * are: only the fields the patch names change on each, so the layers
 * keep whatever else differs between them. Each layer reads the patch
 * on its own terms — its layout's settings, its own file's length, a
 * stretch only for a video. A layout lands as each layer's own fields,
 * every layer's in the same commit, with what it brings along (its
 * transitions' sounds).
 *
 * One action, one undo step: a run of changes to the same fields of
 * the same layers, such as a slider drag, coalesces into one. A patch
 * that touches layout also remembers, per role, the layout the first of
 * the layers with that role is left with, which is what a new layer of
 * the role starts with. Layers that are gone are skipped;
 * nothing happens, and nothing is remembered, where no layer would
 * change.
 */
export class PatchShotLayersAction {
  constructor(
    private readonly store: EditorStore,
    private readonly media: MediaAssetStore,
    private readonly assets: ShotLayerAssetReader,
    private readonly patcher: ShotLayerPatcher,
    private readonly layouts: ShotLayerLayoutWriter,
    private readonly lastEditedPlacements: LastEditedPlacementRecorder,
    private readonly follower: ShotLayoutFollower,
    private readonly layoutChanges: ShotLayerLayoutChangeReader,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  /** `layerIds` in the order the layers are listed to the user; the first of each role is the one remembered. */
  execute(layerIds: ReadonlyArray<string>, patch: ShotLayerPatch): void {
    const state = this.store.snapshot();
    const current = state.shots;
    const retimed = current.withLayersReplaced(this.patchedLayers(layerIds, patch));
    const replaced = patch.placement ? this.laidOut(retimed, layerIds, patch.placement) : retimed;
    if (replaced === current) return;
    this.store.commit(patch.placement ? 'Change layout' : 'Change layer timing', this.coalesceKeyOf(layerIds, patch));
    this.store.patch(patch.placement
      ? this.follower.patchFor(state, this.lastEditedPlacements.record(replaced, layerIds))
      : { shots: replaced });
    if (patch.placement === undefined) return;
    for (const change of this.layoutChanges.of(patch.placement)) this.telemetry.layoutSet(change.field, change.value, layerIds.length);
  }

  private patchedLayers(layerIds: ReadonlyArray<string>, patch: ShotLayerPatch): ShotLayer[] {
    const current = this.store.snapshot().shots;
    const catalog = this.media.snapshot();
    return layerIds.flatMap((layerId) => {
      const layer = current.findLayer(layerId);
      return layer === null ? [] : [this.patcher.apply(layer, patch, this.assets.assetOf(layer, catalog))];
    });
  }

  private laidOut(partition: ShotPartition, layerIds: ReadonlyArray<string>, patch: ShotLayerPlacementPatch): ShotPartition {
    return layerIds.reduce(
      (laid, layerId) => this.layouts.withLayout(laid, layerId, this.patcher.patchedPlacement(laid.placementOf(layerId), patch)),
      partition,
    );
  }

  /** The same layers and the same fields: what a drag repeats, and only that. */

  private coalesceKeyOf(layerIds: ReadonlyArray<string>, patch: ShotLayerPatch): string {
    const fields = [
      ...(patch.placement?.layout === undefined ? [] : ['layout']),
      ...Object.keys(patch.placement?.settings ?? {}),
      ...Object.keys(patch.timing ?? {}).map((field) => `timing.${field}`),
    ].sort();
    return `shotLayersPatch:${[...layerIds].sort().join(',')}:${fields.join(',')}`;
  }
}
