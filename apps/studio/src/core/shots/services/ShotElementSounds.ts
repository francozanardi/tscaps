import type { AudioMix } from '@core/audio-mix/domain/AudioMix';

/**
 * The sounds that belong to a shot or to one of its layers, as a reset
 * takes them away. A layer's are the sounds placed on its edges, its
 * layout transitions, its camera and its moments, and the sound of its own
 * file; a shot's are those placed on its start, its end and its camera,
 * and the level of the video's own sound during it. A word's sounds, and
 * the transition into a shot's, belong to them and stay.
 */
export class ShotElementSounds {
  /** `mix` without anything of the layer `layerId`'s; the same mix where it held nothing. */
  withoutLayers(mix: AudioMix, layerId: string): AudioMix {
    const placed = mix.clips()
      .filter(({ start: { anchor } }) => (anchor.kind === 'layer' || anchor.kind === 'layer-transition'
        || anchor.kind === 'layer-camera' || anchor.kind === 'layer-moment') && anchor.layerId === layerId)
      .map((clip) => clip.id);
    return mix.withoutClips(placed).withFootageSound([layerId], 0);
  }

  /** `mix` without anything of the shot `shotId`'s, its video at its own level; the same mix where it held nothing. */
  withoutShots(mix: AudioMix, shotId: string): AudioMix {
    const placed = mix.clips()
      .filter(({ start: { anchor } }) => (anchor.kind === 'shot' || anchor.kind === 'camera') && anchor.shotId === shotId)
      .map((clip) => clip.id);
    return mix.withoutClips(placed).withShotVideoVolume([shotId], 1);
  }
}
