import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicBoxPlacement } from '@core/shots/domain/GraphicBoxPlacement';
import type { ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotGraphicPresetMotion } from '@core/shots/services/ShotGraphicPresetMotion';
import type { ShotGraphicPresetSounds } from '@core/shots/services/ShotGraphicPresetSounds';
import type { ShotLayerLayoutWriter } from '@core/shots/services/ShotLayerLayoutWriter';

/** The shots and the soundtrack once a preset is put on a graphic layer. */
export interface AppliedGraphicPreset {
  readonly shots: ShotPartition;
  readonly audio: AudioMix;
}

/**
 * Puts `preset` on a graphic layer as it ships, whatever the layer was
 * before: the preset's graphic with its fields at their defaults, its box,
 * the motion it recommends — or, for a preset a user saved, the whole
 * style the layer had then — its sounds, and nothing else. The layer's own
 * style goes first, CSS written by hand in its Code tab included, since a
 * preset is the recommended default and anything left from before would
 * spoil it. The moments the layer knows stay where the preset's code is the
 * code it already shows, since the preview, seeing the same code, does not
 * run it again to say so.
 */
export class ShotGraphicPresetApplier {
  constructor(
    private readonly layouts: ShotLayerLayoutWriter,
    private readonly boxes: GraphicBoxPlacement,
    private readonly presetSounds: ShotGraphicPresetSounds,
    private readonly presetMotion: ShotGraphicPresetMotion,
  ) {}

  /** `shots` and `audio` with `preset` on the layer `layer`. */
  applied(shots: ShotPartition, audio: AudioMix, layer: ShotGraphicLayer, preset: GraphicPreset): AppliedGraphicPreset {
    const sameCode = JSON.stringify(layer.graphic.document) === JSON.stringify(preset.graphic.document);
    const graphic = sameCode ? { ...preset.graphic, moments: layer.graphic.moments } : preset.graphic;
    const replaced = shots.withLayerReplaced({ id: layer.id, graphic });
    return { shots: replaced.withLayerStyles(this.stylesFor(replaced, layer.id, preset)), audio: this.presetSounds.mixFor(audio, layer.id, preset) };
  }

  /** The layer's style as `preset` gives it: a saved one's whole, or a shipped one's box and motion. */
  private stylesFor(shots: ShotPartition, layerId: string, preset: GraphicPreset): ElementStyles {
    const cleared = shots.layerStyles.without([layerId]);
    if (preset.style !== null) return cleared.withStyle(layerId, preset.style);
    const laidOut = this.layouts.written(cleared, layerId, this.boxes.placementOf(preset.box));
    return this.presetMotion.stylesFor(laidOut, layerId, preset);
  }
}
