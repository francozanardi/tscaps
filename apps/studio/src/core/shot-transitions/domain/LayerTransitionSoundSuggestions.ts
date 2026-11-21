import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipDraft } from '@core/audio-mix/domain/AudioClipDraft';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';

/** Which end of a layer its layout transition plays at. */
export type LayerTransitionEdge = 'entrance' | 'exit';

/** A layout's transition as a sound is suggested for it: a split's line sliding or revealing, or a box from or to the whole frame. */
export type LayerTransitionKind = 'slide' | 'reveal' | 'full';

/**
 * A sound of the bundled pack, how far before the transition's middle it
 * starts so its loudest part lands there (measured on the file, in 50 ms
 * windows), and how loud it plays: under the voice, as the owner set it by ear.
 */
interface LayerTransitionSound {
  readonly soundId: string;
  readonly offsetSec: number;
  readonly volume: number;
}

const SUGGESTIONS: Readonly<Record<LayerTransitionKind, LayerTransitionSound>> = {
  slide: { soundId: 'whoosh-fast', offsetSec: -0.1, volume: 0.056 },
  reveal: { soundId: 'swish', offsetSec: -0.05, volume: 0.2 },
  full: { soundId: 'whoosh-pass', offsetSec: -0.35, volume: 0.07 },
};

/**
 * The sound each layout transition of a shot layer suggests, placed as an
 * ordinary sound effect on the transition itself (its middle, where it
 * moves fastest), apart from the layer's entry and exit sounds. The clip
 * that stands for a suggestion is the effect on that transition playing
 * that sound, whoever placed it.
 */
export class LayerTransitionSoundSuggestions {
  anchorOf(layerId: string, edge: LayerTransitionEdge): AudioAnchor {
    return { kind: 'layer-transition', layerId, edge };
  }

  /** The suggested sound of `kind` on the layer's transition at `edge`, as a clip to add. */
  draftFor(layerId: string, edge: LayerTransitionEdge, kind: LayerTransitionKind): AudioClipDraft {
    const { soundId, offsetSec, volume } = SUGGESTIONS[kind];
    return {
      role: 'effect',
      source: { kind: 'builtin', soundId },
      start: { anchor: this.anchorOf(layerId, edge), offsetSec },
      volume,
    };
  }

  /** The clip in `mix` that is `kind`'s suggested sound on the layer's transition at `edge`, or null where none is. */
  clipIn(mix: AudioMix, layerId: string, edge: LayerTransitionEdge, kind: LayerTransitionKind): AudioClip | null {
    const { soundId } = SUGGESTIONS[kind];
    return this.clipsOn(mix, layerId, edge)
      .find((clip) => clip.role === 'effect' && clip.source.kind === 'builtin' && clip.source.soundId === soundId) ?? null;
  }

  /** Every clip in `mix` placed on the layer's transition at `edge`, suggested or not. */
  clipsOn(mix: AudioMix, layerId: string, edge: LayerTransitionEdge): AudioClip[] {
    return mix.clips().filter(({ start }) => start.anchor.kind === 'layer-transition'
      && start.anchor.layerId === layerId
      && start.anchor.edge === edge);
  }
}
