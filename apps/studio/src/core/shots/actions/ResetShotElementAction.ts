import type { EditorStore } from '@core/editor/store/EditorStore';
import type { GraphicPresetCatalog } from '@core/graphics/domain/GraphicPresetCatalog';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShotLayer, ShotFileLayer, ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayoutFollower } from '@core/shots/domain/ShotLayoutFollower';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { ShotElementSounds } from '@core/shots/services/ShotElementSounds';
import type { ShotGraphicPresetApplier } from '@core/shots/services/ShotGraphicPresetApplier';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import type { ShotLayerLayoutWriter } from '@core/shots/services/ShotLayerLayoutWriter';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Puts a shot or one of its layers back to its defaults, everything it
 * holds of its own going, CSS written by hand and sounds included:
 *
 * - a graphic, to the preset it started from, as picking that preset does;
 *   one whose preset cannot be named keeps its code, with its fields at
 *   their defaults;
 * - a file (b-roll, picture, GIF), to how a layer of its kind starts: the
 *   fresh layout of its role, its whole file from the start, no motion, no
 *   camera, no CSS, no sound;
 * - a shot, its video to no camera and no CSS, the video's own sound at
 *   its level, and none of the sounds on its start, its end or its camera.
 *
 * A word's sounds, the transition into a shot and its sound, and the
 * shot's other layers stay: they are theirs. Each reset is one undo step;
 * nothing happens for a shot or a layer that is gone.
 */
export class ResetShotElementAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly media: MediaAssetStore,
    private readonly assets: ShotLayerAssetReader,
    private readonly layouts: ShotLayerLayoutWriter,
    private readonly follower: ShotLayoutFollower,
    private readonly graphicPresets: GraphicPresetCatalog,
    private readonly presets: ShotGraphicPresetApplier,
    private readonly sounds: ShotElementSounds,
  ) {}

  resetLayer(layerId: string): void {
    const { shots } = this.store.snapshot();
    const layer = shots.findLayer(layerId);
    if (layer === null) return;
    if ('graphic' in layer) this.resetGraphic(shots, layer);
    else this.resetFile(shots, layer);
  }

  resetShot(shotId: string): void {
    const state = this.store.snapshot();
    const shots = this.materializer.materializeFrom(state);
    if (!shots.list().some((shot) => shot.id === shotId)) return;
    const next = shots.withLayerStyles(shots.layerStyles.without([ShotVideoLayerId.of(shotId)]));
    this.store.commit('Reset shot');
    this.store.patch({ shots: next, audio: this.sounds.withoutShots(state.audio, shotId) });
  }

  private resetGraphic(shots: ShotPartition, layer: ShotGraphicLayer): void {
    const { audio } = this.store.snapshot();
    const origin = this.graphicPresets.originOf(layer.graphic);
    this.store.commit('Reset layer');
    if (origin !== null) {
      const applied = this.presets.applied(shots, audio, layer, origin);
      this.store.patch({ shots: applied.shots, audio: applied.audio });
      return;
    }
    const cleared = shots
      .withLayerReplaced({ id: layer.id, graphic: { ...layer.graphic, params: {} } })
      .withLayerStyles(shots.layerStyles.without([layer.id]));
    this.store.patch({ shots: cleared, audio: this.sounds.withoutLayers(audio, layer.id) });
  }

  private resetFile(shots: ShotPartition, layer: ShotFileLayer): void {
    const state = this.store.snapshot();
    const fresh: ShotLayer = { id: layer.id, mediaId: layer.mediaId, inSec: 0, outSec: null, loop: false };
    const role = this.assets.roleOf(layer.mediaId, this.media.snapshot());
    const replaced = shots.withLayerReplaced(fresh);
    const unstyled = replaced.layerStyles.without([layer.id]);
    const styles = role === null ? unstyled : this.layouts.written(unstyled, layer.id, replaced.freshPlacementFor(role));
    const audio = this.sounds.withoutLayers(state.audio, layer.id);
    this.store.commit('Reset layer');
    // The follower answers with the audio only where the new layout brings sounds of its own.
    this.store.patch({ audio, ...this.follower.patchFor({ ...state, audio }, replaced.withLayerStyles(styles)) });
  }
}
