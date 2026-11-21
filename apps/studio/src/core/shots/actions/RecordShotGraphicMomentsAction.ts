import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicMoment } from '@core/graphics/domain/GraphicMoment';
import type { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';
import type { ShotGraphicMomentRecorder } from '@core/shots/domain/ShotGraphicMomentRecorder';

/**
 * Writes the moments a graphic's code declared onto its layer, checked as
 * a stored graphic is. Not an undo step: the moments follow from the
 * graphic, so undoing what changed the graphic brings back the moments it
 * had, and the next run declares them again. Does nothing for a layer that
 * is gone, no longer a graphic, showing another document or other values
 * than the run did, or whose moments are already these.
 */
export class RecordShotGraphicMomentsAction implements ShotGraphicMomentRecorder {
  constructor(
    private readonly store: EditorStore,
    private readonly sanitizer: GraphicSanitizer,
  ) {}

  record(layerId: string, graphic: Graphic, moments: ReadonlyArray<GraphicMoment>): void {
    const shots = this.store.snapshot().shots;
    const layer = shots.findLayer(layerId);
    if (layer === null || !('graphic' in layer) || !this.showsTheSame(layer.graphic, graphic)) return;
    const checked = this.sanitizer.momentsOf(moments);
    if (JSON.stringify(checked) === JSON.stringify(layer.graphic.moments)) return;
    this.store.patch({ shots: shots.withLayerReplaced({ id: layerId, graphic: { ...layer.graphic, moments: checked } }) });
  }

  private showsTheSame(current: Graphic, ran: Graphic): boolean {
    return JSON.stringify([current.document, current.params]) === JSON.stringify([ran.document, ran.params]);
  }
}
