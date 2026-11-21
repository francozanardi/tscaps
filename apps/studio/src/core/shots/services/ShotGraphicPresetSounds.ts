import type { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetSoundSpot } from '@core/graphics/domain/GraphicPresetSound';
import type { ShotElementSounds } from '@core/shots/services/ShotElementSounds';

/**
 * The soundtrack a graphic layer has once `preset` is put on it: every
 * sound the layer held is taken away, as a preset starts it afresh, and
 * each sound the preset brings is placed where it says (a moment, the
 * layer's entry or exit, its layout's transition, its camera), at the
 * offset and the volume the preset gives.
 */
export class ShotGraphicPresetSounds {
  constructor(
    private readonly clipDefaults: AudioClipDefaults,
    private readonly elementSounds: ShotElementSounds,
  ) {}

  /** `mix` with the layer `layerId`'s sounds made `preset`'s; the same mix where nothing changes. */
  mixFor(mix: AudioMix, layerId: string, preset: GraphicPreset): AudioMix {
    return preset.sounds.reduce(
      (next, sound) => next.withClipAdded(this.clipDefaults.clipFrom(crypto.randomUUID(), {
        role: 'effect',
        source: { kind: 'builtin', soundId: sound.soundId },
        start: { anchor: this.anchorOf(layerId, sound.spot), offsetSec: sound.offsetSec },
        volume: sound.volume,
      })),
      this.elementSounds.withoutLayers(mix, layerId),
    );
  }

  private anchorOf(layerId: string, spot: GraphicPresetSoundSpot): AudioAnchor {
    switch (spot.kind) {
      case 'moment': return { kind: 'layer-moment', layerId, momentId: spot.momentId };
      case 'edge': return { kind: 'layer', layerId, edge: spot.edge };
      case 'transition': return { kind: 'layer-transition', layerId, edge: spot.edge };
      case 'camera': return { kind: 'layer-camera', layerId };
    }
  }
}
