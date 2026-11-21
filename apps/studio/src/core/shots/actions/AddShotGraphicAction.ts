import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotGraphicTelemetryReporter } from '@core/shots/services/ShotGraphicTelemetryReporter';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import type { ShotGraphicPresetApplier } from '@core/shots/services/ShotGraphicPresetApplier';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Puts `preset`'s graphic on top of everything a shot draws, as the
 * preset ships (`ShotGraphicPresetApplier`): its box, the motion it
 * recommends and the sounds it brings.
 *
 * Materialises the proposal first where the partition is still one,
 * and commits the previous state so the operation is one undo step.
 * Answers the new layer's id, or null where the shot is gone.
 */
export class AddShotGraphicAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly presets: ShotGraphicPresetApplier,
    private readonly telemetry: ShotGraphicTelemetryReporter,
  ) {}

  execute(shotId: string, preset: GraphicPreset): string | null {
    const current = this.materializer.materializeFrom(this.store.snapshot());
    const layer: ShotGraphicLayer = { id: crypto.randomUUID(), graphic: preset.graphic };
    const added = current.withLayerAdded(shotId, layer);
    if (added.findLayer(layer.id) === null) return null;
    const applied = this.presets.applied(added, this.store.snapshot().audio, layer, preset);
    this.store.commit('Add graphic');
    this.store.patch({ shots: applied.shots, audio: applied.audio });
    this.telemetry.graphicAdded(preset, current.list()[0]?.id === shotId);
    return layer.id;
  }
}
