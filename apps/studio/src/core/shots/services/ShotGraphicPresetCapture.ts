import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetAnimation } from '@core/graphics/domain/GraphicPresetMotion';
import type { GraphicPresetSound, GraphicPresetSoundSpot } from '@core/graphics/domain/GraphicPresetSound';
import type { GraphicBoxPlacement } from '@core/shots/domain/GraphicBoxPlacement';
import type { ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';

/**
 * A graphic layer as a preset to start others from, as it stands: its
 * code, its fields with the values set on them as their defaults, its
 * shape, its whole style (layout, every kind of motion — a box's way in
 * from the whole frame included —, camera, CSS written by hand), and the
 * bundled sounds placed on it — on its moments, its entry and exit, its
 * layout's transitions and its camera — at their offsets and volumes.
 * The box and the entrance and exit are also read out of that style, to
 * describe the preset as a shipped one is.
 *
 * Left out is what a preset cannot carry: a sound from a file of the
 * user's own, which belongs to a project.
 */
export class ShotGraphicPresetCapture {
  constructor(private readonly boxes: GraphicBoxPlacement) {}

  captured(shots: ShotPartition, audio: AudioMix, layer: ShotGraphicLayer, id: string, name: string): GraphicPreset {
    const { graphic } = layer;
    const placement = shots.placementOf(layer.id);
    return {
      id,
      name,
      description: '',
      category: null,
      graphic: {
        ...graphic,
        fields: graphic.fields.map((field) => ({ ...field, defaultValue: graphic.params[field.id] ?? field.defaultValue })),
        params: {},
        aspectRatio: placement.kind === 'inset' && placement.aspectRatio !== null ? placement.aspectRatio : graphic.aspectRatio,
        presetId: id,
      },
      box: this.boxes.boxOf(placement),
      motion: {
        entrance: this.animationOf(shots, layer.id, ElementAnimationScope.ENTRANCE),
        exit: this.animationOf(shots, layer.id, ElementAnimationScope.EXIT),
      },
      sounds: audio.clips().flatMap((clip) => this.soundOf(clip, layer.id)),
      style: shots.layerStyles.get(layer.id),
    };
  }

  private animationOf(shots: ShotPartition, layerId: string, scope: ElementAnimationScope): GraphicPresetAnimation | null {
    const animation = shots.layerStyles.animationOf(layerId, scope);
    return animation === null || animation.presetId === null ? null : { presetId: animation.presetId, params: animation.params };
  }

  private soundOf(clip: AudioClip, layerId: string): GraphicPresetSound[] {
    const spot = this.spotOf(clip, layerId);
    if (clip.role !== 'effect' || clip.source.kind !== 'builtin' || spot === null) return [];
    return [{ spot, soundId: clip.source.soundId, volume: clip.volume, offsetSec: clip.start.offsetSec }];
  }

  private spotOf(clip: AudioClip, layerId: string): GraphicPresetSoundSpot | null {
    const { anchor } = clip.start;
    if (!('layerId' in anchor) || anchor.layerId !== layerId) return null;
    switch (anchor.kind) {
      case 'layer-moment': return { kind: 'moment', momentId: anchor.momentId };
      case 'layer': return { kind: 'edge', edge: anchor.edge };
      case 'layer-transition': return { kind: 'transition', edge: anchor.edge };
      case 'layer-camera': return { kind: 'camera' };
    }
  }
}
