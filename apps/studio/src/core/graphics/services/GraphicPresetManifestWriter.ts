import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetAnimation } from '@core/graphics/domain/GraphicPresetMotion';
import type { GraphicPresetSound, GraphicPresetSoundSpot } from '@core/graphics/domain/GraphicPresetSound';

/**
 * Writes a preset as the manifest {@link GraphicPresetManifestReader}
 * reads, its document and the moments its code declared inline, so one
 * record holds all of it. Reading what this writes gives the same preset.
 */
export class GraphicPresetManifestWriter {
  write(preset: GraphicPreset): Record<string, unknown> {
    const { graphic } = preset;
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      category: preset.category,
      aspectRatio: graphic.aspectRatio,
      box: preset.box,
      motion: { entrance: this.animationOf(preset.motion.entrance), exit: this.animationOf(preset.motion.exit) },
      sounds: preset.sounds.map((sound) => this.soundOf(sound)),
      fields: graphic.fields,
      moments: graphic.moments,
      hidesCaptions: graphic.hidesCaptions,
      ...(preset.style !== null ? { style: preset.style } : {}),
      document: graphic.document,
    };
  }

  private animationOf(animation: GraphicPresetAnimation | null): Record<string, unknown> | null {
    return animation === null ? null : { ...animation.params, animation: animation.presetId };
  }

  private soundOf(sound: GraphicPresetSound): Record<string, unknown> {
    return { ...this.spotOf(sound.spot), sound: sound.soundId, volume: sound.volume, offset: sound.offsetSec };
  }

  private spotOf(spot: GraphicPresetSoundSpot): Record<string, unknown> {
    switch (spot.kind) {
      case 'moment': return { moment: spot.momentId };
      case 'edge': return { edge: spot.edge };
      case 'transition': return { transition: spot.edge };
      case 'camera': return { camera: true };
    }
  }
}
