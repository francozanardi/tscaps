import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter, ShotLayerRemovalOrigin } from '@core/shots/services/ShotEditTelemetryReporter';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';

/**
 * Takes layers off their shots, wherever those are. The files they show
 * stay in the project. Commits the previous state so the whole removal
 * is one undo step; layers that are already gone are skipped.
 */
export class RemoveShotLayersAction {
  constructor(
    private readonly store: EditorStore,
    private readonly media: MediaAssetStore,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  /** `origin` says where in the editor the layers were taken off from; it changes nothing but what is reported. */
  execute(layerIds: Iterable<string>, origin: ShotLayerRemovalOrigin): void {
    const current = this.store.snapshot().shots;
    const removed = [...layerIds];
    const next = current.withoutLayers(removed);
    if (next === current) return;
    const kinds = removed.flatMap((layerId) => {
      const layer = current.findLayer(layerId);
      return layer === null ? [] : [this.kindOf(layer)];
    });
    this.store.commit('Remove from shot');
    this.store.patch({ shots: next });
    this.telemetry.layersRemoved(kinds, origin);
  }

  /** What a layer shows, as reported: its file's type, `missing` for a file gone, or `graphic`. */
  private kindOf(layer: ShotLayer): string {
    if ('graphic' in layer) return 'graphic';
    return this.media.snapshot().get(layer.mediaId)?.type ?? 'missing';
  }
}
