import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotGraphicTelemetryReporter } from '@core/shots/services/ShotGraphicTelemetryReporter';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { SavedGraphicPresetRepository } from '@core/graphics/domain/SavedGraphicPresetRepository';
import type { GraphicPresetNameValidator } from '@core/graphics/services/GraphicPresetNameValidator';
import type { SavedGraphicPresetStore } from '@core/graphics/store/SavedGraphicPresetStore';
import type { ShotGraphicPresetCapture } from '@core/shots/services/ShotGraphicPresetCapture';

/**
 * Saves a graphic layer as it stands (`ShotGraphicPresetCapture`), kept on
 * this device: as a new preset of the user's own, or over the saved preset
 * it was made from. As a new one (`execute`), it is called `name`
 * (trimmed).
 * The new preset leads the saved ones, and the layer then counts as made
 * from it, so its reset goes back to it. Recording that is not an undo
 * step: what the layer shows does not change.
 *
 * Resolves to the preset saved, or null for a layer that is gone or not a
 * graphic; rejects for a name the validator refuses or a storage that
 * fails, and then changes nothing.
 */
export class SaveShotGraphicPresetAction {
  constructor(
    private readonly store: EditorStore,
    private readonly capture: ShotGraphicPresetCapture,
    private readonly repository: SavedGraphicPresetRepository,
    private readonly saved: SavedGraphicPresetStore,
    private readonly names: GraphicPresetNameValidator,
    private readonly telemetry: ShotGraphicTelemetryReporter,
  ) {}

  async execute(layerId: string, name: string): Promise<GraphicPreset | null> {
    const problem = this.names.problemWith(name);
    if (problem !== null) throw new Error(problem);
    const { shots, audio } = this.store.snapshot();
    const layer = shots.findLayer(layerId);
    if (layer === null || !('graphic' in layer)) return null;
    const preset = this.capture.captured(shots, audio, layer, `saved-${crypto.randomUUID()}`, name.trim());
    await this.repository.save(preset);
    this.saved.set([preset, ...this.saved.snapshot()]);
    this.telemetry.presetSaved('create', layer.graphic);
    this.recordOrigin(layerId, preset.id);
    return preset;
  }

  /**
   * Saves the graphic `layerId` as it stands over the saved preset it was
   * made from, keeping that preset's name and its place in the list.
   * Resolves to the preset saved, or null where the layer is gone, is not a
   * graphic, or was not made from a preset the user saved; rejects for a
   * storage that fails, and then changes nothing.
   */
  async overwrite(layerId: string): Promise<GraphicPreset | null> {
    const { shots, audio } = this.store.snapshot();
    const layer = shots.findLayer(layerId);
    if (layer === null || !('graphic' in layer)) return null;
    const origin = this.saved.snapshot().find((preset) => preset.id === layer.graphic.presetId);
    if (origin === undefined) return null;
    const preset = this.capture.captured(shots, audio, layer, origin.id, origin.name);
    await this.repository.save(preset);
    this.saved.set(this.saved.snapshot().map((held) => (held.id === origin.id ? preset : held)));
    this.telemetry.presetSaved('overwrite', layer.graphic);
    return preset;
  }

  private recordOrigin(layerId: string, presetId: string): void {
    const shots = this.store.snapshot().shots;
    const layer = shots.findLayer(layerId);
    if (layer === null || !('graphic' in layer)) return;
    this.store.patch({ shots: shots.withLayerReplaced({ id: layerId, graphic: { ...layer.graphic, presetId } }) });
  }
}
