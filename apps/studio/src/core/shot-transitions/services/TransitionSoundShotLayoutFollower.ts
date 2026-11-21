import type { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStatePatch } from '@core/editor/store/EditorStore';
import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import type { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import type { ShotLayerPlacementKind } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import type { ShotLayoutFollower } from '@core/shots/domain/ShotLayoutFollower';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type {
  LayerTransitionEdge,
  LayerTransitionKind,
  LayerTransitionSoundSuggestions,
} from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';

const EDGES: readonly LayerTransitionEdge[] = ['entrance', 'exit'];

/**
 * Gives a layer laid out anew the sounds of its new layout's
 * transitions. A layer whose layout changes (a b-roll switched to a
 * split, say), or that arrives already laid out, loses every sound on
 * its old layout's transitions, which are gone, and gains the suggested
 * sound of each transition its new layout plays: a split slides unless
 * told, so it comes in with its whoosh. A layer that keeps its layout
 * (a box dragged, a split's side flipped) keeps its sounds as they are.
 */
export class TransitionSoundShotLayoutFollower implements ShotLayoutFollower {
  constructor(
    private readonly splitTransitions: ShotLayerSplitTransitions,
    private readonly insetTransitions: ShotLayerInsetTransitions,
    private readonly suggestions: LayerTransitionSoundSuggestions,
    private readonly defaults: AudioClipDefaults,
  ) {}

  patchFor(state: EditorState, after: ShotPartition): EditorStatePatch {
    let audio = state.audio;
    for (const shot of after.list()) {
      for (const layer of shot.layers) {
        const layout = after.placementOf(layer.id).kind;
        if (state.shots.findLayer(layer.id) !== null && state.shots.placementOf(layer.id).kind === layout) continue;
        audio = this.relaid(audio, layer.id, layout, after.layerStyles.get(layer.id)?.fields);
      }
    }
    return audio === state.audio ? { shots: after } : { shots: after, audio };
  }

  private relaid(audio: AudioMix, layerId: string, layout: ShotLayerPlacementKind, fields: ElementFieldValues | undefined): AudioMix {
    let relaid = audio.withoutClips(EDGES.flatMap((edge) => this.suggestions.clipsOn(audio, layerId, edge).map((clip) => clip.id)));
    for (const edge of EDGES) {
      const kind = this.kindOf(layout, fields, edge);
      if (kind === null) continue;
      relaid = relaid.withClipAdded(this.defaults.clipFrom(crypto.randomUUID(), this.suggestions.draftFor(layerId, edge, kind)));
    }
    return relaid;
  }

  /** The transition `layout` plays at `edge`, as a sound is suggested for it; null where it plays none. */
  private kindOf(layout: ShotLayerPlacementKind, fields: ElementFieldValues | undefined, edge: LayerTransitionEdge): LayerTransitionKind | null {
    if (layout === 'split') {
      const kind = this.splitTransitions.kindOf(fields, edge);
      return kind === 'cut' ? null : kind;
    }
    if (layout === 'inset') return this.insetTransitions.kindOf(fields, edge) === 'full' ? 'full' : null;
    return null;
  }
}
