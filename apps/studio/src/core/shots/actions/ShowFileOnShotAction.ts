import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter, ShotFileOrigin } from '@core/shots/services/ShotEditTelemetryReporter';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { Shot } from '@core/shots/domain/Shot';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotLayoutFollower } from '@core/shots/domain/ShotLayoutFollower';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import type { ShotLayerLayoutWriter } from '@core/shots/services/ShotLayerLayoutWriter';
import type { ShotFilePlaybackCheck } from '@core/shots/services/ShotFilePlaybackCheck';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Shows a file on a shot, the way its type asks.
 *
 * A video is the shot's b-roll, of which a shot offers one: it takes the
 * place of the file the shot's video layer shows, keeping that layer's
 * id, and so its style — its layout and its motion — and starting its
 * timing over; where the shot has no video layer, it goes beneath
 * everything the shot draws, so a b-roll is always the bottom layer,
 * laid out as the b-roll edited last was left (full screen until one
 * was). A picture or a GIF goes on top of everything the shot draws,
 * laid out as the picture or GIF edited last was left, and replaces
 * nothing. A new layer's style holds its layout's fields and nothing
 * else: no motion. It comes in with the sounds its layout's transitions
 * suggest.
 *
 * Which of these happens is decided from the partition and the files as
 * they stand when this runs, so a file that took a while to arrive
 * never adds a second b-roll to a shot that gained one meanwhile.
 * Materialises the proposal first where the partition is still one, and
 * commits the previous state so the operation is one undo step. Does
 * nothing for a shot that is gone, for a file the catalog does not
 * hold — what it is, and so where it goes, cannot be known — or for a
 * sound, which a shot has nothing to draw of.
 *
 * A GIF is shown only once this browser is known to play it; one it
 * cannot play is refused with a `ShotFileShowFailedError` and nothing
 * changes.
 */
export class ShowFileOnShotAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly media: MediaAssetStore,
    private readonly assets: ShotLayerAssetReader,
    private readonly playback: ShotFilePlaybackCheck,
    private readonly layouts: ShotLayerLayoutWriter,
    private readonly follower: ShotLayoutFollower,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  /** `origin` says where in the editor the file was put on the shot from; it changes nothing but what is reported. */
  async execute(shotId: string, mediaId: string, origin: ShotFileOrigin): Promise<void> {
    await this.ensurePlayable(mediaId, origin);
    const current = this.materializer.materializeFrom(this.store.snapshot());
    const shot = current.list().find((candidate) => candidate.id === shotId);
    const role = this.assets.roleOf(mediaId, this.media.snapshot());
    if (!shot || role === null) return;
    const replacesVideo = role === 'video' && this.assets.videoLayerOf(shot.layers, this.media.snapshot()) !== null;
    const next = role === 'video'
      ? this.withVideoShown(current, shot, mediaId)
      : this.withPictureOnTop(current, shot, mediaId);
    if (next === current) return;
    this.store.commit('Add file to shot');
    this.store.patch(this.follower.patchFor(this.store.snapshot(), next));
    this.telemetry.filePlaced(role, this.typeOf(mediaId), replacesVideo ? 'replaced' : 'added', origin);
  }

  private async ensurePlayable(mediaId: string, origin: ShotFileOrigin): Promise<void> {
    try {
      await this.playback.ensurePlayable(mediaId);
    } catch (error) {
      this.telemetry.filePlaceFailed(this.typeOf(mediaId), origin, error);
      throw error;
    }
  }

  private typeOf(mediaId: string): MediaAssetType | null {
    return this.media.snapshot().get(mediaId)?.type ?? null;
  }

  private withVideoShown(current: ShotPartition, shot: Shot, mediaId: string): ShotPartition {
    const held = this.assets.videoLayerOf(shot.layers, this.media.snapshot());
    if (held) return current.withLayerReplaced({ ...this.freshLayer(mediaId), id: held.id });
    const layer = this.freshLayer(mediaId);
    return this.laidOut(current.withLayerAddedBeneath(shot.id, layer), layer.id, current.placementForNewLayer('video'));
  }

  private withPictureOnTop(current: ShotPartition, shot: Shot, mediaId: string): ShotPartition {
    const layer = this.freshLayer(mediaId);
    return this.laidOut(current.withLayerAdded(shot.id, layer), layer.id, current.placementForNewLayer('picture'));
  }

  /** `partition` with the layer `layerId` laid out by `placement`; the same partition where it holds no such layer. */
  private laidOut(partition: ShotPartition, layerId: string, placement: ShotLayerPlacement): ShotPartition {
    if (partition.findLayer(layerId) === null) return partition;
    return partition.withLayerStyles(this.layouts.written(partition.layerStyles, layerId, placement));
  }

  private freshLayer(mediaId: string): ShotLayer {
    return { id: crypto.randomUUID(), mediaId, inSec: 0, outSec: null, loop: false };
  }

}
