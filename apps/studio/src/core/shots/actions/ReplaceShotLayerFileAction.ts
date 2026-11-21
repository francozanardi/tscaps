import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import type { ShotFilePlaybackCheck } from '@core/shots/services/ShotFilePlaybackCheck';

/**
 * Shows another file on a layer, wherever that layer stands: it keeps
 * its id, and so its style — its layout and its motion — and its
 * timing starts over from the new file's start, since a stretch picked
 * in one file means nothing in another. Commits the previous state so the operation is one undo
 * step.
 *
 * A layer keeps its role: a b-roll takes only another video, a picture
 * or a GIF only another picture or GIF. Does nothing for a file of the
 * other role, one the catalog does not hold, a layer that is gone, or
 * one that already shows the file. A GIF this browser cannot play is
 * refused with a `ShotFileShowFailedError`, and the layer keeps its
 * file.
 */
export class ReplaceShotLayerFileAction {
  constructor(
    private readonly store: EditorStore,
    private readonly media: MediaAssetStore,
    private readonly assets: ShotLayerAssetReader,
    private readonly playback: ShotFilePlaybackCheck,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  async execute(layerId: string, mediaId: string): Promise<void> {
    await this.ensurePlayable(mediaId);
    const current = this.store.snapshot().shots;
    const found = current.findLayer(layerId);
    const layer = found === null ? null : this.assets.fileOf(found);
    if (layer === null || layer.mediaId === mediaId || !this.keepsRole(layer.mediaId, mediaId)) return;
    const next = current.withLayerReplaced({ ...layer, mediaId, inSec: 0, outSec: null, loop: false });
    if (next === current) return;
    this.store.commit('Replace file');
    this.store.patch({ shots: next });
    const role = this.assets.roleOf(mediaId, this.media.snapshot());
    if (role !== null) this.telemetry.filePlaced(role, this.typeOf(mediaId), 'replaced', 'layer-replace');
  }

  private async ensurePlayable(mediaId: string): Promise<void> {
    try {
      await this.playback.ensurePlayable(mediaId);
    } catch (error) {
      this.telemetry.filePlaceFailed(this.typeOf(mediaId), 'layer-replace', error);
      throw error;
    }
  }

  private typeOf(mediaId: string): MediaAssetType | null {
    return this.media.snapshot().get(mediaId)?.type ?? null;
  }

  /** Whether `nextMediaId` is a file of the same role as `currentMediaId`; a gone file has no role to keep. */
  private keepsRole(currentMediaId: string, nextMediaId: string): boolean {
    const catalog = this.media.snapshot();
    const next = this.assets.read(nextMediaId, catalog);
    if (next === null) return false;
    const current = this.assets.read(currentMediaId, catalog);
    return current === null || (current.kind === 'video') === (next.kind === 'video');
  }
}
